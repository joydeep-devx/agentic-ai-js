# 🛠️ 02 - Tool Calling & AI Agents

This section explains how to give our LLMs a "hands" to interact with the outside world, moving from a standard text generator to a fully functional AI Agent[cite: 1.2].


## 🤖 1. LLM vs. AI Agent

Understanding the difference is critical for system design:

*   **LLM (Text Only) 🧠:** Takes a user input and strictly generates a text response[cite: 1.2]. 
    *   *Example:* "Explain JWT." ➡️ It simply replies with the explanation[cite: 1.2].
*   **AI Agent 🕵️‍♂️:** Uses the LLM as a brain to make decisions, execute actions using **Tools**, observe the results, and figure out the next step until a goal is complete[cite: 1.2].
    *   *Example:* "Check my sales and email a report." ➡️ Agent checks database ➡️ Generates report ➡️ Sends email[cite: 1.2].



## 🔧 2. What is a Tool?

A **Tool** is simply a function that allows an AI Agent to perform a real-world action or access external information[cite: 1.2]. 

*Without a tool:* 
User: "What's the weather in Delhi?" ➡️ LLM: "I don't have access to real-time data."[cite: 1.2]

*With a tool:*
User: "What's the weather in Delhi?" ➡️ LLM calls `getWeather("Delhi")` ➡️ Weather API returns `32°C` ➡️ LLM replies: "Delhi is currently 32°C."[cite: 1.2]

### Types of Tools
1.  **Built-in / Utility Tools:** Pre-made tools provided by frameworks (like Tavily for web search)[cite: 1.2].
2.  **Custom Tools:** JavaScript functions you write yourself to connect to your own databases or APIs[cite: 1.2].



## 🏗️ 3. Building Custom Tools (with Zod)

To make sure the LLM passes the exact right data to our JS functions, we use **Zod** to define a schema[cite: 1.2]. Here is how a custom tool looks in LangChain:

\`\`\`javascript
import * as z from "zod";
import { tool } from "langchain";

// Defining a custom database search tool
const searchDatabase = tool(
  ({ query, limit }) => \`Found \${limit} results for '\${query}'\`,
  {
    name: "search_database",
    description: "Search the customer database for records matching the query.",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
      limit: z.number().describe("Maximum number of results to return"),
    }),
  }
);
\`\`\`
*(This strict typing ensures the LLM knows exactly what arguments your function expects!)[cite: 1.2]*



## 🛤️ 4. Approaches for Building Agents

There are two main ways to construct an agent workflow:

### A. Simple Langchain Agent
Using built-in functions like `createAgent()`[cite: 1.2]. You just pass the model (e.g., Gemini), your tools, and a system prompt[cite: 1.2]. It is easy but offers less control over the exact step-by-step logic[cite: 1.2].

### B. LangGraph Agent
For production-level agents, we use LangGraph to manually map out the workflow[cite: 1.2]. You define exactly how the agent behaves using 4 core concepts[cite: 1.2]:

1.  **State 🗃️:** The memory/information available at the current step (messages, inputs, tool results)[cite: 1.2].
2.  **Node 🟩:** A specific step or function in the workflow (e.g., the Agent Node or the Tool Node)[cite: 1.2].
3.  **Edge ➡️:** The direct connection moving data from one Node to another (e.g., Agent ➡️ Tool)[cite: 1.2].
4.  **Conditional Edge 🔀:** A decision point that checks a condition to decide where to go next[cite: 1.2]. (e.g., *Is a tool required?* If YES ➡️ Go to Tool Node. If NO ➡️ Go to END)[cite: 1.2].