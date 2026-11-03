import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { ChatGoogle } from "@langchain/google/node";
import { tool } from "langchain";
import z from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";


const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

/* Short Term memory (Using local memory) */
// const checkpointer = new MemorySaver();

/* Short Term memory using MongoDB(Atlas) */
const client = new MongoClient(process.env.MONGO_URI);
const checkpointer = new MongoDBSaver({ client });

/* Custom Tool */
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

// Define tools
const add = tool(({ a, b }) => a + b, {
  name: "add",
  description: "Add two numbers",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
});

const multiply = tool(({ a, b }) => a * b, {
  name: "multiply",
  description: "Multiply two numbers",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
});

const divide = tool(({ a, b }) => a / b, {
  name: "divide",
  description: "Divide two numbers",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
});

/* An array of tools to bind to the LLM */
const tools = [emailTool, add, multiply, divide];

/* Bind tools to LLM */
const model = new ChatGoogle({
  /* LLM model */ model: "gemini-3.5-flash",
  temperature: 0,
}).bindTools(tools);

/* Add tools array to the ToolNode */
const toolNode = new ToolNode(tools);

/* Create Agent Node */
const agent = async (state) => {
  const result = await model.invoke(state.messages);

  return { messages: [result] };
};

/* Function for conditional Edge */
const shouldContinue = async (state) => {
  console.log(state);
  if (state.messages[state.messages.length - 1].tool_calls.length > 0) {
    return "tool_node";
  } else {
    return "__end__";
  }
};

/* Create Graph for LangGraph */
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agent)
  .addNode("tool_node", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tool_node", "agent")
  .compile({ checkpointer });

/* Route to send prompt */
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  const result = await graph.invoke(
    {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    },
    {
      configurable: { thread_id: "1" },
    },
  );

  console.log(result.messages);
  return res.json(result.messages[result.messages.length - 1].content);
});

app.listen(PORT, () => {
  console.log(`Server is Running on PORT : ${PORT}`);
});
