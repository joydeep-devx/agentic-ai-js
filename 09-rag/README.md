# 📚 09 - RAG: Grounding the Model in Your Own Documents

An LLM only knows what it was trained on. **RAG (Retrieval-Augmented Generation)** fixes that: split your documents into chunks, turn them into **embeddings**, store them in a **vector database**, then on every question retrieve the most similar chunks and paste them into the prompt as context. This section builds that pipeline over a PDF with **Google embeddings** and **Qdrant**.


## 🗂️ 1. Folder Structure

```
09-rag/
├── knowledge.pdf       # The source document (Node.js documentation)
├── package.json        # ESM project; adds embeddings, Qdrant, PDF + splitter
└── src/
    ├── app.js          # Ingestion pipeline + retrieval chat endpoint
    └── .env            # PORT, GOOGLE_API_KEY, QDRANT_URL, QDRANT_API_KEY (git-ignored)
```

| Package | Purpose |
| --- | --- |
| `@langchain/google-genai` | `GoogleGenerativeAIEmbeddings` — turns text into vectors |
| `@google/generative-ai` | `TaskType` enum for embedding intent |
| `@langchain/qdrant` | `QdrantVectorStore` — store and similarity-search vectors |
| `@langchain/textsplitters` | `RecursiveCharacterTextSplitter` for chunking |
| `pdf-parse` | `PDFParse` — extracts raw text from the PDF |
| `@langchain/google` | `ChatGoogle` for the answer generation |
| `express`, `dotenv`, `fs` | HTTP server, env loading, file reading |


## 🧩 2. The RAG Vocabulary

*   **Embedding 🔢:** A vector of numbers representing *meaning*. Similar text ➡️ nearby vectors.
*   **Chunking ✂️:** Documents are too big for one embedding (and for the context window), so they're sliced into overlapping pieces.
*   **Vector store 🗄️:** A database that indexes vectors and answers *"which chunks are closest to this query?"* — here **Qdrant**.
*   **Similarity search 🔍:** Embed the question, find the nearest chunks by distance (cosine / dot product).
*   **Augmented generation 💬:** Those chunks are injected into the system prompt so the model answers **from your data**, not from memory.

```
PDF ➡️ extract text ➡️ split into chunks ➡️ embed ➡️ Qdrant     (ingestion, run once)
                                                      ⬇️
question ➡️ embed ➡️ similarity search ➡️ context ➡️ LLM ➡️ answer   (per request)
```


## 🔢 3. The Embedding Model

```javascript
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
});
```

*   **Dimensions 📏:** 768 numbers per vector. The collection in Qdrant must be created with the **same dimension** — switching embedding models means re-indexing everything.
*   **`taskType` 🎯:** Tells Google *why* you're embedding. `RETRIEVAL_DOCUMENT` optimizes vectors for being **stored and searched**; `RETRIEVAL_QUERY` is its counterpart for questions.
*   The same `embeddings` instance is reused for ingestion **and** for queries, so both sides land in the same vector space.


## 🗄️ 4. The Qdrant Vector Store

```javascript
const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "nodejsDocumentation",
  apiKey: process.env.QDRANT_API_KEY,
});
```

*   **`fromExistingCollection()` 🔗** attaches to a collection that **already exists** — create `nodejsDocumentation` in Qdrant first (768 dimensions).
*   This is a **top-level `await`**, legal because the project is ESM (`"type": "module"`). The server won't start if Qdrant is unreachable ⚠️.
*   Works with both Qdrant Cloud (`QDRANT_API_KEY`) and a local Docker instance (key unused).


## ✂️ 5. Ingestion: The `upload()` Function

```javascript
const upload = async () => {
  const pdfPath = "../knowledge.pdf";
  const buffer = fs.readFileSync(pdfPath);
  const pdfResult = new PDFParse({ data: buffer });
  const result = await pdfResult.getText();
  const text = result.text;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await splitter.createDocuments([text]);

  await vectorStore.addDocuments(docs);
  console.log(docs);
};

// upload();
```

| Step | What happens |
| --- | --- |
| 1️⃣ `readFileSync` | Loads `knowledge.pdf` into a buffer — path is `../knowledge.pdf` because the script runs from `src/` |
| 2️⃣ `PDFParse().getText()` | Extracts the plain text of the whole PDF |
| 3️⃣ `createDocuments()` | Splits into ~1000-character chunks with 200 characters of **overlap** |
| 4️⃣ `addDocuments()` | Embeds every chunk and upserts it into Qdrant |

*   **Why overlap 🔁?** A sentence cut across a boundary would lose its meaning in both chunks; 200 shared characters keep the context stitched together.
*   **`RecursiveCharacterTextSplitter`** tries paragraph ➡️ line ➡️ sentence ➡️ character breaks in order, so chunks land on natural boundaries where possible.
*   📌 The call is **commented out on purpose** — ingestion is a **one-time** job. Uncomment `upload()`, start the server once to index, then comment it out again, or you'll store duplicate chunks on every boot.


## 🌐 6. Retrieval and Generation

```javascript
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  const docs = await vectorStore.similaritySearch(prompt);
  const context = docs.map((doc) => doc.pageContent).join("/n");

  const result = await model.invoke([
    {
      role: "system",
      content: `You are RAG assistant and use this context ${context}`,
    },
    { role: "human", content: prompt },
  ]);

  return res.json(result.content);
});
```

*   **`similaritySearch(prompt)` 🔍** embeds the question and returns the closest chunks (default `k = 4`).
*   The chunks' `pageContent` is concatenated into one `context` string and placed in the **system message**.
*   **`temperature: 0`** on `ChatGoogle` keeps the answer close to the retrieved text instead of inventing details.
*   This endpoint is **stateless** — no graph, no checkpointer. Combining RAG with section 07's memory means retrieving inside a LangGraph node.
*   📌 The separator is the literal string `"/n"`, not a newline `"\n"` — chunks run together, which the model usually tolerates but is worth knowing.


## ▶️ 7. Running It

There's no `start` script, and `.env` sits in `src/`, so run from there:

```bash
cd 09-rag
npm install
cd src
node app.js
```

Required environment variables:

```
PORT=3000
GOOGLE_API_KEY=your_gemini_key
QDRANT_URL=https://your-cluster.qdrant.tech
QDRANT_API_KEY=your_qdrant_key
```

**First run — index the PDF:** uncomment `upload();` in `app.js`, start the server once, confirm the chunks are logged, then comment it out again.

**Then ask a question about the document:**

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"How does the Node.js event loop work?\"}"
```

*   A local Qdrant works too: `docker run -p 6333:6333 qdrant/qdrant` and set `QDRANT_URL=http://localhost:6333`.
*   Remember to create the `nodejsDocumentation` collection with **768 dimensions** before the first run 📐.


## ⚠️ 8. Tuning and Pitfalls

*   **Chunk size ⚖️:** Too small loses context, too large dilutes the embedding and burns tokens. 500–1500 characters is the usual range.
*   **`k` too low 📉:** Only 4 chunks reach the model by default — raise it for broad questions, lower it for precise ones.
*   **Garbage in, garbage out 🗑️:** PDF extraction can mangle tables and columns; inspect `result.text` before trusting the index.
*   **Duplicate ingestion 🔁:** Re-running `upload()` adds the chunks **again**. Clear the collection or use stable document ids.
*   **No citations 🔗:** Only `pageContent` is passed along — keep `doc.metadata` if you want to show sources.
*   **Grounding isn't guaranteed 🛡️:** Tell the model explicitly to say *"I don't know"* when the context doesn't cover the question.


## 🎯 9. Interview Takeaways

*   **What is RAG and why use it?** 📚 Retrieve relevant chunks of your own data and inject them into the prompt — it grounds answers in private/current information without fine-tuning.
*   **Why chunk with overlap?** ✂️ Chunks must fit the embedding and context window; overlap stops ideas from being split across a boundary.
*   **What does an embedding represent?** 🔢 Semantic meaning as a vector — similarity in vector space approximates similarity in meaning.
*   **Why must the query use the same embedding model?** Different models produce incompatible vector spaces, so distances become meaningless.
*   **`RETRIEVAL_DOCUMENT` vs. `RETRIEVAL_QUERY`?** 🎯 Task hints that optimize the vector for being indexed vs. for being searched with.
*   **Where does the retrieved context go?** Into the **system prompt** of the generation call, alongside the user's question.
*   **RAG vs. tool calling?** ⚖️ RAG injects context *before* the model answers; a tool lets the model *decide* to fetch data mid-loop.
