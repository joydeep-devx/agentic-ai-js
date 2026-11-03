# 🧠 07 - Giving Your Agent Memory (Checkpointers)

The graph from section 06 forgets everything between requests — every `POST /api/chat` starts from an empty `messages` array. In this section we add a **checkpointer** so LangGraph **saves the state after every step** and reloads it on the next call, first with in-process memory and then with **MongoDB Atlas** for persistence that survives a restart.


## 🗂️ 1. Folder Structure

```
07-memory/
├── package.json        # ESM project; adds the MongoDB checkpointer
└── src/
    ├── app.js          # Tools + model + graph + checkpointer + Express route
    └── .env            # PORT, GOOGLE_API_KEY, MONGO_URI (git-ignored)
```

| Package | Purpose |
| --- | --- |
| `@langchain/langgraph` | `StateGraph`, `MessagesAnnotation`, `MemorySaver`, prebuilt `ToolNode` |
| `@langchain/langgraph-checkpoint-mongodb` | `MongoDBSaver` — persists checkpoints to MongoDB |
| `mongodb` | `MongoClient`, the driver the saver writes through |
| `@langchain/google` | `ChatGoogle` (imported from `@langchain/google/node`) |
| `langchain` + `zod` | `tool()` helper and input schemas |
| `express`, `dotenv` | HTTP server and env loading |


## 🧩 2. Short-Term vs. Long-Term Memory

*   **Short-term memory 💬:** The conversation **inside one thread** — the growing `messages` array. This is what a checkpointer gives you, and it's what this section builds.
*   **Long-term memory 🗄️:** Facts remembered **across threads and users** (preferences, profile data), usually stored in a separate store or vector DB and injected into the prompt. Not covered here.
*   **Checkpointer 💾:** The LangGraph component that **writes the whole state to storage after every super-step**, keyed by a `thread_id`, and restores it when that thread is invoked again.
*   **Thread 🧵:** One conversation. Same `thread_id` ➡️ same history; new `thread_id` ➡️ a clean slate.


## 💾 3. Two Checkpointer Options

```javascript
/* Short Term memory (Using local memory) */
// const checkpointer = new MemorySaver();

/* Short Term memory using MongoDB(Atlas) */
const client = new MongoClient(process.env.MONGO_URI);
const checkpointer = new MongoDBSaver({ client });
```

| Saver | Where state lives | Survives restart? | Use for |
| --- | --- | --- | --- |
| `MemorySaver` | In the Node.js process (RAM) | ❌ No | Local experiments, tests |
| `MongoDBSaver` | A MongoDB / Atlas collection | ✅ Yes | Real apps, multiple instances |

*   The `MemorySaver` line is left **commented out** in `app.js` — swap the two blocks to switch back to RAM-only memory.
*   `MongoDBSaver` only needs a connected `MongoClient`; it creates and manages its own checkpoint collections.
*   Because state is in Mongo, several server instances can serve the **same thread** 🔁.


## 🧰 4. The Graph (Unchanged from 06)

The agent itself is exactly the section 06 setup — four tools, a bound model, a `ToolNode`, and a conditional edge:

| Tool | Behaviour |
| --- | --- |
| `send_email_tool` | Mock email sender — returns a success string |
| `add` | Returns `a + b` |
| `multiply` | Returns `a * b` |
| `divide` | Returns `a / b` |

```javascript
const model = new ChatGoogle({
  model: "gemini-3.5-flash",
  temperature: 0,
}).bindTools(tools);

const toolNode = new ToolNode(tools);

const agent = async (state) => {
  const result = await model.invoke(state.messages);
  return { messages: [result] };
};

const shouldContinue = async (state) => {
  if (state.messages[state.messages.length - 1].tool_calls.length > 0) {
    return "tool_node";
  } else {
    return "__end__";
  }
};
```

*   The **only** change to the graph is the argument to `.compile()` 👇


## 🔌 5. Plugging the Checkpointer In

```javascript
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agent)
  .addNode("tool_node", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tool_node", "agent")
  .compile({ checkpointer });   // 👈 memory enabled
```

*   One option — `{ checkpointer }` — turns a stateless graph into a **stateful, resumable** one.
*   After every node, the current `messages` array is written to storage under the active `thread_id`.
*   On the next invoke with that same id, LangGraph **loads the saved messages first**, then appends the new user message.


## 🌐 6. Passing the `thread_id`

```javascript
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  const result = await graph.invoke(
    {
      messages: [{ role: "user", content: prompt }],
    },
    {
      configurable: { thread_id: "1" },
    },
  );

  return res.json(result.messages[result.messages.length - 1].content);
});
```

*   The second argument to `invoke()` is the **config**; `configurable.thread_id` selects which conversation to load.
*   Note the request body still sends **only the new message** — the history comes from the checkpointer, not the client 📥.
*   ⚠️ The id is **hard-coded to `"1"`**, so every caller shares one conversation. In a real app, derive it from the user/session (section 08 shows a `randomUUID()` thread id returned to the client).


## ▶️ 7. Running It

There's no `start` script, and `.env` sits in `src/`, so run from there:

```bash
cd 07-memory
npm install
cd src
node app.js
```

Send two requests and watch the second one use the first's context:

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"My name is Arqam.\"}"
```

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"What is my name?\"}"
```

*   With the checkpointer, the second call answers correctly ✅. Comment out `{ checkpointer }` and it won't.
*   Restart the server and ask again — with `MongoDBSaver` the memory is **still there** 💾.


## ⚠️ 8. Things to Watch Out For

*   **Growing context 📈:** Every turn is replayed to the model, so tokens (and cost) grow with the thread. Production agents **trim or summarize** old messages.
*   **Thread isolation 🔒:** Two users must never share a `thread_id`, or they'll read each other's conversation.
*   **Secrets in state 🔐:** Checkpoints store the raw messages — avoid putting credentials or PII into them.
*   **Connection lifecycle 🔌:** The `MongoClient` is created once at startup and reused; don't open one per request.


## 🎯 9. Interview Takeaways

*   **How do you add memory to a LangGraph agent?** 💾 Compile the graph with a **checkpointer** and invoke it with a `thread_id` in `configurable`.
*   **`MemorySaver` vs. `MongoDBSaver`?** ⚖️ RAM-only and lost on restart vs. persisted in MongoDB and shareable across instances.
*   **What exactly is a `thread_id`?** 🧵 The key that identifies one conversation's saved state — same id resumes it, a new id starts fresh.
*   **Short-term vs. long-term memory?** Short-term = the message history of one thread (checkpointer); long-term = facts stored separately and recalled across threads.
*   **Why doesn't the client resend the history?** The checkpointer rehydrates it server-side, so each request only carries the new message.
