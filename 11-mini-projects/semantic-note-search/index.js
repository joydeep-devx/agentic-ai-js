import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogle } from "@langchain/google";
import { notes } from "./notes.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

// Convert the objects to documents
const docs = notes.map((note) => {
  return new Document({
    pageContent: note.content,
    metadata: {
      id: note.id,
      topic: note.topic,
    },
  });
});

// Create an instance of the model
const model = new ChatGoogle({
  model: "gemini-3.5-flash-lite",
});

// Create an instance of the embedding model
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  outputDimensionality: 1024,
});

// Create a splitter instance
const splitter = new RecursiveCharacterTextSplitter();

// Create chunks of the docs
const chunks = await splitter.splitDocuments(docs);
// console.log(chunks);

// Count no. of chunks
console.log(chunks.length);

// Initialize vector store
const vectorStore = new MemoryVectorStore(embeddings);

// Generate embeddings and store chunks
await vectorStore.addDocuments(chunks);

// Semantic Search
const results = await vectorStore.similaritySearch(
  "How does JavaScript handle asynchronous operations?",
);

// Print the result properly
for (let doc of results) {
  console.log(`- ${doc.pageContent}`);
  console.log();
}
