# 🌍 04 - Giving the LLM Tools (Tavily Web Search Agent)

This is the moment an LLM becomes an **AI Agent**. We take a Gemini model, hand it a built-in **web search tool** (Tavily), and let LangChain's `createAgent()` decide on its own when to search the internet before answering.

> **AI Agent = LLM + Tools** (+ a loop that lets the LLM use them)


## 🗂️ 1. Folder Structure

```
04-tools-llm/
├── package.json        # ESM project with LangChain, Google, Tavily deps
└── src/
    ├── app.js          # Express server + agent definition (single file)
    └── .env            # PORT, GOOGLE_API_KEY, TAVILY_API_KEY (git-ignored)
```

*   Everything lives in **one file** (`src/app.js`) to keep focus on the agent itself.


## 📦 2. Dependencies

| Package | Purpose |
| --- | --- |
| `langchain` | Provides `createAgent()` — a prebuilt agent loop |
| `@langchain/google` | `ChatGoogle` — Gemini chat model wrapper |
| `@langchain/tavily` | `TavilySearch` — ready-made web search tool |
| `@langchain/core` | Core message/tool abstractions |
| `express`, `dotenv` | HTTP server and env loading |

*   🔑 **Environment variables:** `GOOGLE_API_KEY` (Gemini), `TAVILY_API_KEY` (search), `PORT`.
*   `@langchain/groq` is installed but not used in this section.


## 🔎 3. The Built-in Tool: Tavily Search

**Tavily** is a search API designed for LLMs — it returns clean, summarized results instead of raw HTML.

```javascript
import { TavilySearch } from "@langchain/tavily";

const tool = new TavilySearch({
  maxResults: 5,
  topic: "general",
});
```

*   **`maxResults`**: How many search results get fed back into the model's context.
*   **`topic`**: `"general"` (or e.g. `"news"`) tunes the search type.
*   Other options left commented in the code for experimenting: `searchDepth`, `timeRange`, `includeDomains`, `excludeDomains`, `includeImages`, `includeAnswer`, `includeRawContent`.

💡 This is a **built-in / utility tool**: its name, description and input schema are already defined, so the LLM knows how to call it without any extra work.


## 🤖 4. Creating the Agent

```javascript
import { ChatGoogle } from "@langchain/google";
import { createAgent } from "langchain";

const model = new ChatGoogle("gemini-3.1-flash-lite");

// AI Agent = LLM + Tools
const agent = createAgent({
  model,
  tools: [tool],
});
```

### 🔁 What `createAgent()` does behind the scenes
1.  Sends the user's messages + the tool definitions to the model.
2.  If the model responds with a **tool call** (e.g. `tavily_search({ query: "..." })`) ➡️ the tool is executed.
3.  The tool result is appended as a **`tool` message** and sent back to the model.
4.  Steps 1–3 repeat until the model replies with plain text and no tool calls ➡️ **done**.

This is the classic **ReAct loop** (Reason ➡️ Act ➡️ Observe), packaged into a single function.


## 🌐 5. The API Endpoint

```javascript
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  const result = await agent.invoke({
    messages: [{ role: "user", content: prompt }],
  });

  res.json(result.messages[result.messages.length - 1].content);
});
```

*   `agent.invoke()` returns the **full message history** of the run: `human ➡️ ai (tool_call) ➡️ tool ➡️ ai (final answer)`.
*   We return only the **last message's content** — the final answer.
*   Note: unlike section 03, there's no `try/catch` here, so a failed API call will surface as an unhandled rejection.


## ▶️ 6. Running It

The `.env` file sits in `src/`, and `dotenv.config()` loads `.env` from the **current working directory**, so start the server from inside `src/`:

```bash
cd 04-tools-llm
npm install
cd src
node app.js
```

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"What is the latest Node.js LTS version?\"}"
```

*   ⚠️ The `npm start` script runs `node app.js` from the project root, where `app.js` doesn't exist — use the commands above instead.


## 🎯 7. Interview Takeaways

*   **How does an LLM "call" a tool?** 🧩 It doesn't run code — it outputs a structured `tool_call` (name + JSON args). The framework executes the function and feeds the result back.
*   **Why do LLMs need web search?** Their knowledge is frozen at training time; tools provide **real-time** data.
*   **What does the agent return?** The whole conversation trace, which is great for debugging and observability.
*   **Trade-off of `createAgent()`:** ⚡ Fastest way to build an agent, but the loop is a black box — you can't easily add custom steps, approvals, or branching. That's what LangGraph solves (section 06).
