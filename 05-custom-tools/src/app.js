import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { ChatGoogle } from "@langchain/google";
import { tool, createAgent } from "langchain";
import { z } from "zod";

const app = express();

app.use(express.json());

/* Custom Tool for Addition */
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

/* Custom email Tool */
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

const model = new ChatGoogle({
  model: "gemini-3.1-flash-lite",
  temperature: 0,
});

// AI Agent = LLM + Tools
const agent = createAgent({
  model,
  tools: [customTool,emailTool],
});

app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  const result = await agent.invoke({
    messages: [
      // {
      //   role: "system",
      //   content: `You are an assistant with access to a custom addition-tool.
      //             Whenever the user asks you to add two numbers,
      //             you MUST call the addition tool.
      //             Never calculate addition yourself.`,
      // },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  res.json(result.messages[result.messages.length - 1].content);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
