# 🤖 Agentic AI with JavaScript & Node.js

A hands-on technical handbook and interview prep guide for building **AI Agents** in JavaScript. Each folder is one step on the path from "what is an LLM?" to a persistent, human-approved, document-grounded **LangGraph** agent, with runnable Express + LangChain code and notes written for interviews.


## 🗺️ 1. Learning Path

| # | Folder | Topic | What you build |
| --- | --- | --- | --- |
| 01 | [01-introduction](01-introduction/README.md) | 🚀 AI, LLMs, tokens, agents | Theory only |
| 02 | [02-model-calling](02-model-calling/README.md) | 🛠️ Tool calling & agent concepts | Express chat API |
| 03 | [03-langchain](03-langchain/README.md) | 🔗 Calling LLMs via LangChain (Groq) | `POST /api/chat` with a system persona |
| 04 | [04-tools-llm](04-tools-llm/README.md) | 🌍 Built-in tools (Tavily search) | Web-searching agent with `createAgent()` |
| 05 | [05-custom-tools](05-custom-tools/README.md) | 🛠️ Custom tools with Zod | Agent with addition + email tools |
| 06 | [06-langGraph](06-langGraph/README.md) | 🕸️ LangGraph workflows | Hand-built agent ↔ tool loop |
| 07 | [07-memory](07-memory/README.md) | 🧠 Checkpointers & thread memory | Agent that remembers, persisted in MongoDB |
| 08 | [08-human-in-the-loop](08-human-in-the-loop/README.md) | ✋ `interrupt()` & approval gates | Graph that pauses for a human yes/no |
| 09 | [09-rag](09-rag/README.md) | 📚 Embeddings, chunking & vector search | PDF-grounded RAG assistant on Qdrant |

*   Work through the folders **in order** — each section builds on the previous one.
*   Every README ends with **🎯 Interview Takeaways** for quick revision.


## 🧱 2. Tech Stack

*   **Runtime:** Node.js (ES Modules) + **Express** for the HTTP API.
*   **Framework:** **LangChain** (`langchain`, `@langchain/core`) and **LangGraph** (`@langchain/langgraph`).
*   **LLM providers:** **Groq** (`@langchain/groq`) and **Google Gemini** (`@langchain/google`).
*   **Tools:** **Tavily** web search (`@langchain/tavily`) and custom tools validated with **Zod**.
*   **Memory:** **MongoDB Atlas** checkpointer (`@langchain/langgraph-checkpoint-mongodb`, `mongodb`).
*   **RAG:** **Qdrant** vector store (`@langchain/qdrant`), Gemini embeddings (`@langchain/google-genai`), `pdf-parse` and `@langchain/textsplitters`.
*   **Config:** `dotenv` for API keys and `PORT`.


## 🧠 3. The Big Picture

```
LLM call (03)  ➡️  LLM + Tools (04)  ➡️  Custom Tools (05)  ➡️  Own Workflow (06)
  "talks"          "searches the web"     "acts on your systems"   "full control"

       ➡️  Memory (07)  ➡️  Human Approval (08)  ➡️  Your Documents (09)
           "remembers"      "asks before acting"     "answers from your data"
```

*   **LLM 💬:** Takes input and generates text.
*   **AI Agent 🕵️‍♂️:** LLM as the "brain" + **Tools** + a loop: Reason ➡️ Act ➡️ Observe ➡️ repeat until done.
*   **`createAgent()` ⚡:** Ready-made agent loop — quick, but a black box.
*   **LangGraph 🕸️:** Build the loop yourself with **State, Nodes, Edges and Conditional Edges**.
*   **Checkpointer 💾:** Saves the graph state per `thread_id`, which is what turns a stateless call into a conversation — and what makes a paused run resumable.
*   **`interrupt()` ✋:** Stops the graph mid-run so a human can approve a sensitive action, then `Command({ resume })` continues it.
*   **RAG 📚:** Retrieve the most similar chunks of your own documents and inject them into the prompt before the model answers.


## ▶️ 4. Getting Started

1.  Clone the repo and open a section folder:
    ```bash
    git clone <repo-url>
    cd agentic-ai-js/03-langchain
    npm install
    ```
2.  Create a `.env` file with the keys that section needs:
    ```
    PORT=3000
    GROQ_API_KEY=your_groq_key        # 03
    GOOGLE_API_KEY=your_gemini_key    # 04–09
    TAVILY_API_KEY=your_tavily_key    # 04
    MONGO_URI=your_mongodb_uri        # 07, 08
    QDRANT_URL=your_qdrant_url        # 09
    QDRANT_API_KEY=your_qdrant_key    # 09
    ```
3.  Start the server (each section README has the exact command) and send a prompt:
    ```bash
    curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"Hello!\"}"
    ```

*   📌 In **04–09**, `.env` lives in `src/` — run `node app.js` from inside `src/`.
*   📌 Section **09** needs a Qdrant collection (`nodejsDocumentation`, 768 dimensions) and a one-time ingestion run — see its README.
*   🔐 `.env` files are git-ignored; never commit API keys.


## 🔮 5. Coming Next

Planned topics for future sections:
*   **Long-term memory 🗄️:** Facts remembered across threads and users, not just one conversation.
*   **Agentic RAG 🔍:** Retrieval as a tool/node the agent chooses, with re-ranking and citations.
*   **Multi-agent systems 👥:** Supervisor and collaborating agents.
*   **Production 🚀:** Streaming, observability, guardrails, and deployment.
