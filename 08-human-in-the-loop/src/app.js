import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { ChatGoogle } from "@langchain/google/node";
import z from "zod";
import {
  ReducedValue,
  StateGraph,
  StateSchema,
  interrupt,
  Command,
} from "@langchain/langgraph";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { randomUUID } from "node:crypto";

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

/* Short Term memory using MongoDB(Atlas) */
const client = new MongoClient(process.env.MONGO_URI);
const checkpointer = new MongoDBSaver({ client });

/* Structured output schema  */
const responseSchema = z.object({
  response: z.string(),
  approvalRequired: z.boolean(),
});

/* LLM model  */
const model = new ChatGoogle({
  model: "gemini-3.5-flash",
  temperature: 0,
});

/* Model with stuctued output schema  */
const structuredModel = model.withStructuredOutput(responseSchema);

/* Create Custom State which every node can access */
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

/* Agent Node */
const agent = async (state) => {
  const result = await structuredModel.invoke([
    {
      role: "system",
      content: `
          If the user is greeting or asking a normal question,
          respond normally and set approvalRequired to false.

          If the request requires a sensitive external action,
          such as sending an email or deleting a file,
          set approvalRequired to true.
          Return JSON with:
            {
              "response": "your response",
              "approvalRequires": true or false
            }`,
    },
    ...state.messages,
  ]);
  // console.log(result);
  // const parsed = JSON.parse(result);
  // console.log("Messages received by agent:", state.messages);
  return {
    aiResponse: result.response,
    approvalRequired: result.approvalRequired,
    messages: [
      {
        role: "assistant",
        content: result.response,
      },
    ],
  };
};

/* Approval Node */
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

/* Action Node */
const actionNode = async (state) => {
  if (state.approved) {
    return {
      result: `action approved `,
    };
  }

  return {
    result: "action reject by human",
  };
};

/* to decide approval is needed or not */
const shouldContinue = async (state) => {
  return state.approvalRequired ? "approval_node" : "__end__";
};

/* Crate Graph */
const graph = new StateGraph(customState)
  .addNode("agent", agent)
  .addNode("approval_node", approvalNode)
  .addNode("action_node", actionNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("approval_node", "action_node")
  .addEdge("action_node", "__end__")
  .compile({ checkpointer });

/* Route to send prompt */
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;
  /* Reuse the previous threadId if available */
  const threadId = req.body.threadId || randomUUID();
  const response = await graph.invoke(
    {
      prompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    },
    {
      configurable: { thread_id: threadId },
    },
  );

  // console.log(response);
  return res.json({
    threadId,
    result: response.aiResponse,
  });
});

/* Route to resume after interrupt */
app.post("/api/chat/resume", async (req, res) => {
  const { threadId, answer } = req.body;

  const response = await graph.invoke(
    new Command({
      resume: String(answer),
    }),
    {
      configurable: { thread_id: threadId },
    },
  );

  return res.json({
    threadId,
    result: response.result,
  });
});

app.listen(PORT, () => {
  console.log(`Server is Running on PORT : ${PORT}`);
});
