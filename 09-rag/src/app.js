import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { ChatGoogle } from "@langchain/google/node";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { QdrantVectorStore } from "@langchain/qdrant";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

/* Generate Embeddings  */
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
});

/* Qdrant vector store to store embeddings */
const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "nodejsDocumentation",
  apiKey: process.env.QDRANT_API_KEY,
});

/* LLM Model */
const model = new ChatGoogle({
  model: "gemini-3.5-flash",
  temperature: 0,
});

/* To upload the file  */
const upload = async () => {
  const pdfPath = "../knowledge.pdf";
  const buffer = fs.readFileSync(pdfPath);
  const pdfResult = new PDFParse({ data: buffer });
  const result = await pdfResult.getText();
  const text = result.text;
  /* Text splitter  */
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await splitter.createDocuments([text]);
  /* store in vector db */
  await vectorStore.addDocuments(docs);
  console.log(docs);
};

// upload();

/* API endpoint to send prompt and get response */
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;
  const docs = await vectorStore.similaritySearch(prompt);
  const context = docs.map((doc) => doc.pageContent).join("/n");
  const result = await model.invoke([
    {
      role: "system",
      content: `You are RAG assistant and use this context ${context}`,
    },
    {
      role: "human",
      content: prompt,
    },
  ]);

  console.log(result);
  return res.json(result.content);
});

app.listen(PORT, () => {
  console.log(`Server is Running on PORT : ${PORT}`);
});
