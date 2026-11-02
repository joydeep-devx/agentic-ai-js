# 🕸️ 06 - Building Your Own Agent Workflow with LangGraph

`createAgent()` hides the agent loop. In this section we **build that loop ourselves** using **LangGraph**: we define the state, the nodes, and the edges (including a conditional one) explicitly. This is how production agents get custom steps, branching, and full control.


## 🗂️ 1. Folder Structure

```
06-langGraph/
├── package.json        # ESM project; adds @langchain/langgraph
└── src/
    ├── app.js          # Tools + model + graph + Express route
    └── .env            # PORT, GOOGLE_API_KEY (git-ignored)
```

| Package | Purpose |
| --- | --- |
| `@langchain/langgraph` | `StateGraph`, `MessagesAnnotation`, prebuilt `ToolNode` |
| `@langchain/google` | `ChatGoogle` (imported from `@langchain/google/node`) |
| `langchain` + `zod` | `tool()` helper and input schemas |
| `express`, `dotenv` | HTTP server and env loading |


## 🧩 2. LangGraph Core Concepts (Recap)

*   **State 🗃️:** The shared data that flows through the graph. Here: `MessagesAnnotation` — a `messages` array where each node's returned messages are **appended**, not overwritten.
*   **Node 🟩:** A function (or prebuilt runnable) that reads the state and returns an update.
*   **Edge ➡️:** A fixed transition from one node to the next.
*   **Conditional Edge 🔀:** A function that inspects the state and returns the **name of the next node**.
*   **`__start__` / `__end__`:** Special built-in entry and exit points of every graph.


## 🧰 3. The Tools

Four custom tools are defined with `tool()` + Zod:

| Tool | Behaviour |
| --- | --- |
| `send_email_tool` | Mock email sender — returns a success string |
| `add` | Returns `a + b` |
| `multiply` | Returns `a * b` |
| `divide` | Returns `a / b` |

```javascript
const add = tool(({ a, b }) => a + b, {
  name: "add",
  description: "Add two numbers",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
});

const tools = [emailTool, add, multiply, divide];
```

*   Unlike section 05's "always 7" experiment, these math tools return **real** results, so the agent can chain them (e.g. *"(3 + 5) × 2"* ➡️ `add` then `multiply`).


## 🔗 4. Binding Tools vs. Executing Tools

Two separate steps that `createAgent()` used to do for us:

```javascript
// 1. Tell the LLM which tools exist (it can now emit tool_calls)
const model = new ChatGoogle({
  model: "gemini-3.1-flash-lite",
  temperature: 0,
}).bindTools(tools);

// 2. A node that actually RUNS the requested tools
const toolNode = new ToolNode(tools);
```

*   **`.bindTools(tools)`** 📎 attaches the tool schemas to every model call. The model only *requests* tools.
*   **`ToolNode`** ⚙️ reads `tool_calls` from the last AI message, executes the matching functions, and returns their results as `ToolMessage`s.


## 🟩 5. The Nodes and the Router

### Agent node
```javascript
const agent = async (state) => {
  const result = await model.invoke(state.messages);
  return { messages: [result] };
};
```
*   Sends the **entire conversation so far** (user + previous tool results) to the model.
*   Returns the new `AIMessage`, which `MessagesAnnotation` appends to the state.

### Conditional edge function
```javascript
const shouldContinue = async (state) => {
  if (state.messages[state.messages.length - 1].tool_calls.length > 0) {
    return "tool_node";
  } else {
    return "__end__";
  }
};
```
*   Looks at the **last message**: did the model ask for any tools?
    *   **YES** ➡️ go to `tool_node`.
    *   **NO** ➡️ the model gave a final answer ➡️ `__end__`.
*   The code also `console.log`s the full state on every decision — handy for watching the loop.


## 🕸️ 6. Assembling the Graph

```javascript
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agent)
  .addNode("tool_node", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tool_node", "agent")
  .compile();
```

```
            ┌──────────────┐
__start__ ─▶│    agent     │──── no tool_calls ───▶ __end__
            └──────────────┘
               ▲        │
               │        │ has tool_calls
               │        ▼
            ┌──────────────┐
            │  tool_node   │
            └──────────────┘
```

*   **`tool_node ➡️ agent`** closes the loop: after tools run, the model sees the results and decides again.
*   **`.compile()`** validates the graph and turns it into a runnable with `.invoke()` / `.stream()`.
*   This hand-built graph is functionally the same **ReAct loop** that `createAgent()` provided in sections 04–05 — now fully visible and customizable.


## 🌐 7. The API Endpoint

```javascript
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  const result = await graph.invoke({
    messages: [{ role: "user", content: prompt }],
  });

  return res.json(result.messages[result.messages.length - 1].content);
});
```

*   `graph.invoke()` runs from `__start__` until it reaches `__end__` and returns the **final state**.
*   The full message trace is logged; only the last message's content is returned to the client.


## ▶️ 8. Running It

There's no `start` script, and `.env` sits in `src/`, so run from there:

```bash
cd 06-langGraph
npm install
cd src
node app.js
```

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"What is (12 + 8) divided by 4?\"}"
```

Expected flow in the logs: `agent` (calls `add`) ➡️ `tool_node` ➡️ `agent` (calls `divide`) ➡️ `tool_node` ➡️ `agent` (final answer `5`) ➡️ `__end__`.


## 🚀 9. Where to Go Next

Because you now own the graph, it's easy to extend:
*   **Memory 🧠:** Add a checkpointer (e.g. `MemorySaver`) and a `thread_id` so conversations persist across requests.
*   **Human-in-the-loop ✋:** Interrupt before `tool_node` when the tool is `send_email_tool` and wait for approval.
*   **Extra nodes 🟦:** Input validation, guardrails, summarization, or a RAG retrieval step before the agent.
*   **Streaming 📡:** Use `graph.stream()` to push intermediate steps to the client.
*   **Safety limits 🛑:** Set a `recursionLimit` to stop runaway tool loops.


## 🎯 10. Interview Takeaways

*   **`createAgent()` vs. LangGraph?** ⚖️ `createAgent()` = quick prebuilt loop; LangGraph = explicit, controllable graph for production workflows.
*   **What is `MessagesAnnotation`?** A prebuilt state schema with a `messages` channel whose reducer **appends** new messages.
*   **`bindTools()` vs. `ToolNode`?** Binding lets the model *request* tools; `ToolNode` *executes* them.
*   **How does the loop end?** The conditional edge routes to `__end__` once the model's latest message has **no `tool_calls`**.
