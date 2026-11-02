import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { ChatGoogle } from "@langchain/google";
import { TavilySearch } from "@langchain/tavily";
import { createAgent } from "langchain";

const app = express();

app.use(express.json());

/* Tavily Tool */
const tool = new TavilySearch({
  maxResults: 5,
  topic: "general",
  // includeAnswer: false,
  // includeRawContent: false,
  // includeImages: false,
  // includeImageDescriptions: false,
  // searchDepth: "basic",
  // timeRange: "day",
  // includeDomains: [],
  // excludeDomains: [],
});

const model = new ChatGoogle("gemini-3.1-flash-lite");

// AI Agent = LLM + Tools
const agent = createAgent({
  model,
  tools: [tool],
});

app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  res.json(result.messages[result.messages.length-1].content);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
