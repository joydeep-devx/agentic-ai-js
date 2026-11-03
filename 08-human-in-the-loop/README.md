# ✋ 08 - Human-in-the-Loop with `interrupt()`

Some actions shouldn't happen on the model's word alone — sending an email, deleting a file, moving money. In this section the graph **pauses itself** mid-run with LangGraph's `interrupt()`, returns control to the caller, and only continues once a human replies. This also introduces a **custom state schema** instead of `MessagesAnnotation`, and **structured output** so the model itself flags what needs approval.


## 🗂️ 1. Folder Structure

```
08-human-in-the-loop/
├── package.json        # ESM project; same deps as 07 (checkpointer required)
└── src/
    ├── app.js          # Custom state + 3 nodes + interrupt/resume routes
    └── .env            # PORT, GOOGLE_API_KEY, MONGO_URI (git-ignored)
```

| Package | Purpose |
| --- | --- |
| `@langchain/langgraph` | `StateGraph`, `StateSchema`, `ReducedValue`, `interrupt`, `Command` |
| `@langchain/langgraph-checkpoint-mongodb` | `MongoDBSaver` — **mandatory**, an interrupt needs saved state |
| `mongodb` | `MongoClient` for the saver |
| `@langchain/google` | `ChatGoogle` + `withStructuredOutput()` |
| `zod` | The structured-output and state schemas |
| `node:crypto` | `randomUUID()` for thread ids |
| `express`, `dotenv` | HTTP server and env loading |


## 🧩 2. Why Human-in-the-Loop?

*   **Approval gate ✅:** The agent prepares the action, a human says yes or no before it executes.
*   **Pause, don't block ⏸️:** `interrupt()` doesn't hold the HTTP request open — the graph **stops and checkpoints**, the server responds, and a later request resumes it.
*   **Requires memory 💾:** The paused state must live somewhere, so a **checkpointer is not optional** here. That's why section 07 came first.
*   **Thread-scoped 🧵:** The resume call must target the **same `thread_id`**, which is why the first response hands the client a `threadId`.


## 🧬 3. A Custom State Schema

Section 06 and 07 used the prebuilt `MessagesAnnotation`. Here the state carries extra fields, so it's declared explicitly:

```javascript
const customState = new StateSchema({
  messages: new ReducedValue(z.array(z.any()).default([]), {
    reducer: (current, update) => [...current, ...update],
  }),
  prompt: z.string(),
  approvalRequired: z.boolean().default(false),
  aiResponse: z.string().default(""),
  approved: z.boolean().default(false),
  result: z.string().default(""),
});
```

| Field | Written by | Meaning |
| --- | --- | --- |
| `messages` | `agent` (appended) | Conversation history |
| `prompt` | The route | The raw user prompt, shown to the approver |
| `approvalRequired` | `agent` | Did the model classify this as sensitive? |
| `aiResponse` | `agent` | The model's text answer |
| `approved` | `approval_node` | The human's decision |
| `result` | `action_node` | Outcome string returned to the client |

*   **`ReducedValue` + reducer 🔁:** `messages` is the only **appending** channel — `[...current, ...update]` is exactly what `MessagesAnnotation` does under the hood.
*   Every other field is a **plain value**: a node returning it **overwrites** the previous one.
*   `.default(...)` keeps the first invoke valid without passing every field.


## 🤖 4. Structured Output: Letting the Model Decide

```javascript
const responseSchema = z.object({
  response: z.string(),
  approvalRequired: z.boolean(),
});

const structuredModel = model.withStructuredOutput(responseSchema);
```

The system prompt tells the model how to set that flag:

*   Greeting or normal question ➡️ answer normally, `approvalRequired: false`.
*   Sensitive external action (send an email, delete a file) ➡️ `approvalRequired: true`.

```javascript
const agent = async (state) => {
  const result = await structuredModel.invoke([
    { role: "system", content: `...rules...` },
    ...state.messages,
  ]);

  return {
    aiResponse: result.response,
    approvalRequired: result.approvalRequired,
    messages: [{ role: "assistant", content: result.response }],
  };
};
```

*   **`withStructuredOutput()` 📐** makes the model return a **validated object**, not a string — no `JSON.parse()`, no prompt-parsing bugs.
*   Note this agent has **no bound tools**: approval is driven by a *classification*, not by `tool_calls`. A production version would gate the `ToolNode` instead.
*   ⚠️ The prompt's example JSON spells the key `approvalRequires`, while the schema uses `approvalRequired` — the Zod schema is what's actually enforced.


## ⏸️ 5. The Approval Node and `interrupt()`

```javascript
const approvalNode = async (state) => {
  const answer = interrupt({
    message: "Do you approve this action",
    prompt: state.prompt,
    aiResponse: state.aiResponse,
  });

  return {
    approved: String(answer).trim().toLowerCase() === "yes",
  };
};
```

*   **`interrupt(payload)` ✋** throws a special signal: LangGraph checkpoints the state and surfaces `payload` to the caller — the object is the "question" the human sees.
*   On resume, the **node re-runs from the top** and `interrupt()` **returns** the resumed value instead of pausing again.
*   Anything other than `"yes"` (case- and space-insensitive) counts as a rejection ❌.


## 🟩 6. The Action Node and the Router

```javascript
const actionNode = async (state) => {
  if (state.approved) {
    return { result: `action approved ` };
  }
  return { result: "action reject by human" };
};

const shouldContinue = async (state) => {
  return state.approvalRequired ? "approval_node" : "__end__";
};
```

*   `action_node` is where the **real side effect** would go — the mock just records the outcome in `result`.
*   The conditional edge is simpler than 06's: it reads a **boolean field**, not `tool_calls`.


## 🕸️ 7. Assembling the Graph

```javascript
const graph = new StateGraph(customState)
  .addNode("agent", agent)
  .addNode("approval_node", approvalNode)
  .addNode("action_node", actionNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("approval_node", "action_node")
  .addEdge("action_node", "__end__")
  .compile({ checkpointer });
```

```
                              ┌─────────────────┐
__start__ ─▶ agent ─ needs approval ──▶│  approval_node  │ ⏸️ interrupt
              │                        └─────────────────┘
              │ no approval needed              │ resume
              ▼                                 ▼
          __end__                      ┌─────────────────┐
                                       │   action_node   │ ─▶ __end__
                                       └─────────────────┘
```

*   A safe question runs **agent ➡️ `__end__`** in one request.
*   A sensitive one runs **agent ➡️ approval_node ⏸️**, then **approval_node ➡️ action_node ➡️ `__end__`** on the resume request.


## 🌐 8. The Two Endpoints

### `POST /api/chat` — start (or continue) a thread
```javascript
const threadId = req.body.threadId || randomUUID();

const response = await graph.invoke(
  { prompt, messages: [{ role: "user", content: prompt }] },
  { configurable: { thread_id: threadId } },
);

return res.json({ threadId, result: response.aiResponse });
```
*   Generates a fresh `threadId` unless the client sends one back 🧵.
*   The `threadId` is returned **every time**, because the client needs it to resume.

### `POST /api/chat/resume` — deliver the human's answer
```javascript
const response = await graph.invoke(
  new Command({ resume: String(answer) }),
  { configurable: { thread_id: threadId } },
);

return res.json({ threadId, result: response.result });
```
*   **`new Command({ resume })` ▶️** is the special input that says *"don't start over, continue the paused run with this value."*
*   The value lands as the return of `interrupt()` inside `approval_node`.
*   This response returns `result` (the action outcome), not `aiResponse`.


## ▶️ 9. Running It

There's no `start` script, and `.env` sits in `src/`, so run from there:

```bash
cd 08-human-in-the-loop
npm install
cd src
node app.js
```

**A normal question** — finishes immediately:

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"Hello, who are you?\"}"
```

**A sensitive request** — pauses and returns a `threadId`:

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"Send an email to test@example.com saying hi\"}"
```

**Approve it** using that `threadId`:

```bash
curl -X POST http://localhost:3000/api/chat/resume -H "Content-Type: application/json" -d "{\"threadId\": \"<paste-thread-id>\", \"answer\": \"yes\"}"
```

*   Reply with anything but `yes` and `result` becomes `action reject by human` ❌.
*   The pause survives a server restart, because the state is in MongoDB 💾.


## 🎯 10. Interview Takeaways

*   **How does `interrupt()` work?** ✋ It checkpoints the graph mid-node and surfaces a payload to the caller; the run is resumed later with `new Command({ resume })`, which re-runs that node and makes `interrupt()` return the value.
*   **Why is a checkpointer required?** Without saved state there is nothing to come back to — the paused run would be lost.
*   **`StateSchema` vs. `MessagesAnnotation`?** ⚖️ `MessagesAnnotation` is the prebuilt message-only state; a custom `StateSchema` lets you add your own fields and pick a **reducer** per channel.
*   **What does `ReducedValue` do?** Defines how updates to a channel merge — here, appending messages instead of replacing them.
*   **Why `withStructuredOutput()`?** 📐 It forces a Zod-validated object out of the model, so `approvalRequired` is a real boolean instead of text to parse.
*   **Why return the `threadId` to the client?** It's the only handle to the paused conversation — the resume call can't find the interrupt without it.
