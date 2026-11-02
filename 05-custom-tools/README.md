# 🛠️ 05 - Building Custom Tools (with Zod)

Built-in tools are great, but real agents need to talk to **your** systems — your database, your email service, your business logic. In this section we write our own tools with LangChain's `tool()` helper, describe their inputs with **Zod**, and plug them into a `createAgent()` agent.


## 🗂️ 1. Folder Structure

```
05-custom-tools/
├── package.json        # ESM project; adds zod on top of section 04's deps
└── src/
    ├── app.js          # Express server + custom tools + agent
    └── .env            # PORT, GOOGLE_API_KEY (git-ignored)
```

*   🔑 Only `GOOGLE_API_KEY` is needed — no third-party tool API this time.
*   `package.json` still carries the name `04-tools-llm` (copied from the previous section).


## 🧬 2. Anatomy of a Custom Tool

A tool is **a JavaScript function + metadata** that tells the LLM when and how to call it:

```javascript
import { tool } from "langchain";
import { z } from "zod";

const myTool = tool(
  (args) => { /* 1. The implementation */ },
  {
    name: "tool_name",          // 2. Unique identifier the LLM uses in tool_calls
    description: "When to use", // 3. The LLM reads this to decide IF it should call the tool
    schema: z.object({ ... }),  // 4. Input contract — converted to JSON Schema for the LLM
  },
);
```

*   **`name`** 🏷️: snake_case, short, unique.
*   **`description`** 📝: The most important part for reliability — it's effectively a prompt.
*   **`schema`** 📐: Zod validates the arguments the LLM produces *before* your function runs.
*   **Return value**: Usually a string; it becomes the `tool` message the LLM observes.


## ➕ 3. Tool #1 — `addition_tool`

```javascript
const customTool = tool(
  ({ a, b }) => {
    console.log(`Tool called`);
    return `The Addition of ${a} and ${b} is 7`;
  },
  {
    name: "addition_tool",
    description:
      "MANDATORY TOOL: Use this tool whenever the user asks to add, sum, or calculate the total of two numbers. Never perform addition yourself.",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  },
);
```

### 🧪 Why does it always return `7`?
This is a deliberate **experiment** to prove the agent really uses the tool:
*   Ask *"What is 2 + 2?"* ➡️ if the reply says **7**, the LLM trusted the tool over its own math. ✅
*   If it says **4**, the model skipped the tool and answered itself. ❌
*   The `console.log("Tool called")` gives a second confirmation in the server logs.

### 💬 Forcing tool usage
*   The **`MANDATORY TOOL ... Never perform addition yourself`** wording pushes the model to call the tool for trivial tasks it could otherwise do on its own.
*   A commented-out **system message** in `app.js` shows the alternative: putting the same instruction in the system prompt instead of the tool description.


## 📧 4. Tool #2 — `send_email_tool`

```javascript
const emailTool = tool(
  ({ email, content }) => {
    return `Email sent successfully to ${email} with content ${content}`;
  },
  {
    name: "send_email_tool",
    description: "Use this tool to send email",
    schema: z.object({
      email: z.string().describe("sender email"),
      content: z.string().describe("email content to send"),
    }),
  },
);
```

*   A **mock** action tool — it doesn't send anything yet, it just returns a success string. Swap the body for Nodemailer / SendGrid / Resend to make it real.
*   **`.describe()`** on each field adds per-argument hints the LLM sees in the JSON Schema.
*   Shows the agent **extracting structured args** from free text, e.g. *"Email bob@test.com saying the meeting moved to 5pm"* ➡️ `{ email: "bob@test.com", content: "The meeting moved to 5pm" }`.


## 🤖 5. Wiring the Agent

```javascript
const model = new ChatGoogle({
  model: "gemini-3.1-flash-lite",
  temperature: 0,
});

const agent = createAgent({
  model,
  tools: [customTool, emailTool],
});
```

*   **`temperature: 0`** 🎯 makes tool selection more deterministic — important when you want the model to follow tool rules consistently.
*   The model can pick **either tool, both, or none** based on the prompt and the tool descriptions.
*   `POST /api/chat` works exactly like section 04: invoke with the user message, return the last message's `content`.


## ▶️ 6. Running It

`.env` lives in `src/`, so run from there (the `npm start` script points to a non-existent root `app.js`):

```bash
cd 05-custom-tools
npm install
cd src
node app.js
```

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"What is 2 + 2?\"}"
```


## 🎯 7. Interview Takeaways

*   **Why Zod?** 🛡️ The LLM generates arguments as text; a schema guarantees types and required fields, and the same schema becomes the JSON Schema the model is shown.
*   **What decides whether a tool gets called?** Mainly the tool's **name + description** (and the system prompt). Vague descriptions ➡️ unreliable tool use.
*   **How do you verify an agent actually used a tool?** Log inside the tool, inspect the returned `messages` for `tool_calls`, or use a deliberately "wrong" output like this section's `7`.
*   **Security note 🔐:** Tools that take real actions (emails, payments, DB writes) should validate inputs, enforce permissions, and often require human approval — never trust LLM-generated arguments blindly.
