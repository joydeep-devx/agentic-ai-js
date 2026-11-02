# 🔗 03 - Calling LLMs with LangChain (Groq)

In this section we stop talking to an LLM provider's raw SDK and put **LangChain** in the middle. The result is a small Express API that sends a user prompt (plus a system persona) to a Groq-hosted model through LangChain's `ChatGroq` wrapper and returns the reply.

This is still a **plain LLM call** — no tools and no agent loop yet. It is the foundation that sections 04–06 build on.


## 🗂️ 1. Folder Structure

```
03-langchain/
├── index.js                     # Entry point: loads .env and starts the server
├── package.json                 # ESM project, "npm start" → node index.js
├── .env                         # PORT, GROQ_API_KEY (git-ignored)
└── src/
    ├── app.js                   # Express app + route mounting
    ├── routes/
    │   └── chat.route.js        # POST /api/chat
    └── services/
        └── ai.service.js        # LangChain + Groq model call
```

*   **Layered design 🧱:** `index.js` (boot) ➡️ `app.js` (HTTP setup) ➡️ `chat.route.js` (request handling) ➡️ `ai.service.js` (AI logic).
*   Keeping the AI logic in a **service** means the route never knows which LLM provider is used — swapping Groq for Gemini only touches one file.


## 📦 2. Dependencies

| Package | Purpose |
| --- | --- |
| `@langchain/core` | Core LangChain abstractions (messages, runnables) |
| `@langchain/groq` | `ChatGroq` — LangChain chat model wrapper for the Groq API |
| `express` | HTTP server and routing |
| `dotenv` | Loads `PORT` and `GROQ_API_KEY` from `.env` |

*   `ChatGroq` reads the **`GROQ_API_KEY`** environment variable automatically — no key is passed in code.


## 🧠 3. The AI Service (`src/services/ai.service.js`)

The model is created **once** at module load and reused for every request:

```javascript
import { ChatGroq } from "@langchain/groq";

const llm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0.7,
  maxTokens: undefined,
  maxRetries: 2,
});

export const main = async (prompt) => {
  const aiMsg = await llm.invoke([
    { role: "system", content: "You are Joule ,my helpful AI assistant." },
    { role: "user", content: prompt },
  ]);

  return aiMsg.content;
};
```

### 🎛️ Key model parameters
*   **`model`**: Which hosted model Groq should run (`openai/gpt-oss-120b`, an open-weight model).
*   **`temperature` (0.7) 🌡️:** Controls randomness. `0` = deterministic, higher = more creative.
*   **`maxTokens`**: Upper limit on output tokens. `undefined` lets the provider decide.
*   **`maxRetries` (2) 🔁:** LangChain retries failed/rate-limited calls automatically.

### 🎭 Message roles in action
*   **`system`** gives the assistant its persona ("Joule").
*   **`user`** carries the prompt from the HTTP request.
*   `llm.invoke()` returns an **`AIMessage`**; we return only its `.content` (the text).


## 🌐 4. The HTTP Layer

### `src/app.js`
*   Creates the Express app, enables JSON body parsing with `express.json()`, and mounts the chat router at **`/api/chat`**.

### `src/routes/chat.route.js`
*   `POST /api/chat` reads `prompt` from the JSON body, calls `main(prompt)`, and responds with `{ response }`.
*   Errors are caught, logged, and returned as **HTTP 500** `{ error: "Internal Server Error" }`.

### `index.js`
*   `import "dotenv/config"` loads environment variables **before** the app is imported, then starts listening on `PORT` (default `3000`).


## ▶️ 5. Running It

1.  Create `03-langchain/.env`:
    ```
    PORT=3000
    GROQ_API_KEY=your_groq_key
    ```
2.  Install and start:
    ```bash
    cd 03-langchain
    npm install
    npm start
    ```
3.  Send a prompt:
    ```bash
    curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"Explain JWT in one line\"}"
    ```
    ```json
    { "response": "A JWT is a signed, compact token ..." }
    ```


## 🎯 6. Interview Takeaways

*   **Why LangChain instead of the raw SDK?** 🔄 A unified interface (`invoke`, message roles) across providers — Groq, Gemini, OpenAI, Ollama — so switching models is a one-line change.
*   **Where should the model be instantiated?** At module scope (once), not inside the request handler — avoids re-creating clients per request.
*   **What is `AIMessage.content`?** The model's text output; the full message object can also carry `tool_calls` and metadata (used from section 04 onward).
*   **LLM ≠ Agent ⚠️:** This app can only *talk*. It can't fetch live data or take actions — that's what tools add next.
