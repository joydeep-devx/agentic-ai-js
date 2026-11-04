import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { ChatGroq } from "@langchain/groq";

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

/* Create a Model */
const ai = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

/* Create Client */
const client = new Client({
  name: "client",
  version: "1.0.0",
});

async function start() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["./server.js"],
  });

  await client.connect(transport);

  const { tools } = await client.listTools();

  /* Model + Tools  */
  const modelWithTools = ai.bindTools(
    tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    })),
  );

  /* chat route  */
  app.post("/api/chat", async (req, res) => {
    const { prompt } = req.body;
    const result = await modelWithTools.invoke([
      {
        role: "user",
        content: prompt,
      },
    ]);

    if (result.tool_calls.length > 0) {
      const tool = result.tool_calls[0];
      const response= await client.callTool({
        name: tool.name,
        arguments: tool.args,
      });

      return res.json({
        reponse: response.content[0].text,
      });
    } else {
      return res.json(response.content);
    }
  });
}

start();

app.listen(PORT, () => {
  console.log(`Server is running on PORT : ${PORT}`);
});
