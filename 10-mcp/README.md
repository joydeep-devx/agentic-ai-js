# 🔌 10 - Serving Tools over MCP (Model Context Protocol)

Until now every tool lived **inside** the agent's own process — defined with `tool()` in the same file as the graph. **MCP (Model Context Protocol)** moves tools *out* into a standalone server that any client can discover and call over a standard protocol. This section builds **both halves**: an MCP server exposing a calculator tool, and an Express client that spawns it, discovers its tools at runtime, and hands them to a Groq model.


## 🗂️ 1. Folder Structure

```
10-mcp/
├── package.json        # ESM project; MCP server + client SDKs
└── src/
    ├── server.js       # MCP server — registers the `addition` tool (stdio)
    ├── client.js       # Express + Groq — spawns the server, binds its tools
    └── .env            # PORT, GROQ_API_KEY (git-ignored)
```

| Package | Purpose |
| --- | --- |
| `@modelcontextprotocol/server` | `McpServer`, `StdioServerTransport` — host tools |
| `@modelcontextprotocol/client` | `Client`, `StdioClientTransport` — discover and call them |
| `@langchain/groq` | `ChatGroq`, the model that decides which tool to call |
| `zod` | Input schema for the registered tool |
| `express`, `dotenv` | HTTP server and env loading |

*   📌 This is the first section with **two entry points**. `client.js` is the one you run — it starts `server.js` itself as a child process.


## 🧩 2. What MCP Is and Why It Exists

*   **The problem 🧱:** Tools defined with `tool()` are locked to one codebase. Every agent that needs them has to re-implement or import them.
*   **MCP 🔌:** An open protocol with a **server** side (exposes tools, resources and prompts) and a **client** side (discovers and invokes them). Think "USB-C for LLM tools".
*   **Discovery at runtime 📡:** The client doesn't hard-code tool names — it asks `listTools()` and learns what's available. Add a tool to the server and the client picks it up on next connect, with no client change.
*   **Transport-agnostic 🚇:** The same server works over **stdio** (local child process) or HTTP/SSE (remote). This section uses stdio.
*   **Separation of concerns ⚖️:** The model still only *requests* a tool; the **client** executes it by forwarding the call to the server.

```
┌─────────────────────────┐          ┌──────────────────────┐
│  client.js (Express)    │  stdio   │     server.js        │
│  ChatGroq + MCP Client  │ ◀──────▶ │     MCP Server       │
│  decides WHICH tool     │   JSON   │  owns the tool CODE  │
└─────────────────────────┘   RPC    └──────────────────────┘
```


## 🖥️ 3. The Server — `server.js`

```javascript
const server = new McpServer({
  name: "calculator",
  description: "a server to manage calcultor tools",
  version: "1.0.0",
});
```

*   The metadata identifies the server to any client that connects — name, description, semantic version.

### Registering a tool
```javascript
server.registerTool(
  "addition",
  {
    description: "to add two numbers",
    inputSchema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  },
  async ({ a, b }) => {
    return {
      content: [
        {
          type: "text",
          text: `sum using this mcp tool ${a} & ${b} = ${a + b}`,
        },
      ],
    };
  },
);
```

| Argument | Role |
| --- | --- |
| `"addition"` | The tool **name** the model will emit in `tool_calls` |
| `{ description, inputSchema }` | The **advertisement** — what the client/model sees via `listTools()` |
| `async ({ a, b }) => ...` | The **handler** — the actual work |

*   **`inputSchema` 📐** is a Zod object, exactly like the `tool()` helper in sections 05–07. MCP serializes it to JSON Schema for the wire.
*   **The return shape is MCP's, not LangChain's ⚠️:** a `content` array of typed parts (`{ type: "text", text }`), not a bare value. That's why the client reads `response.content[0].text`.
*   The text deliberately says *"sum using this mcp tool"* — proof the answer came from the MCP server and not the model's own arithmetic 🧪.

### Connecting the transport
```javascript
const transport = new StdioServerTransport();
server.connect(transport);
```

*   **`StdioServerTransport` 🚇** speaks JSON-RPC over **stdin/stdout**. The server is not an HTTP service — it has no port and is meant to be **spawned**, not visited.
*   📌 This is why `server.js` must never `console.log()` anything: stdout *is* the protocol channel.


## 🤖 4. The Client — `client.js`

### Spawning the server
```javascript
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["./server.js"],
});

await client.connect(transport);
```

*   **`process.execPath`** is the path to the running Node binary — so the child is launched with the same Node version, no `node` on `PATH` required.
*   **`args: ["./server.js"]`** is resolved against the **current working directory**, so the client must be started from inside `src/` 📌.
*   `connect()` performs the MCP handshake and keeps the child process alive for the lifetime of the client.

### Discovering tools
```javascript
const { tools } = await client.listTools();
```

*   Returns the server's advertised tools with their names, descriptions and JSON schemas — **no hard-coded list** on the client side 📡.

### Adapting MCP tools to the model
```javascript
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
```

*   MCP tool descriptors and the model's function-calling format are **not identical**, so each one is mapped into an OpenAI-style function definition before binding.
*   This is the manual version of what `createAgent()` / `bindTools(tools)` did automatically when the tools were local LangChain `tool()` objects ⚙️.

### The chat route — a one-step tool loop
```javascript
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;
  const result = await modelWithTools.invoke([{ role: "user", content: prompt }]);

  if (result.tool_calls.length > 0) {
    const tool = result.tool_calls[0];
    const response = await client.callTool({
      name: tool.name,
      arguments: tool.args,
    });

    return res.json({ reponse: response.content[0].text });
  } else {
    return res.json(response.content);
  }
});
```

1.  The model is invoked with the user prompt and the bound MCP tools.
2.  If it emitted a `tool_call`, **`client.callTool()`** forwards the name and arguments over MCP; the server runs the handler and returns `content`.
3.  The tool's text is returned **directly to the caller**.

*   ⚠️ **The tool result never goes back to the model.** Unlike the ReAct loop in 06–07, there's no second `invoke()` — so the model can't chain tools or phrase the answer. This is deliberately the simplest possible MCP integration.
*   ⚠️ Only **`tool_calls[0]`** is handled; if the model requests several tools the rest are dropped.
*   📌 Two rough edges worth knowing in the current code: the JSON key is spelled **`reponse`**, and the `else` branch references `response`, which is scoped to the `if` block — a prompt with no tool call will throw rather than reply.

### Startup order
```javascript
start();

app.listen(PORT, () => { ... });
```

*   `start()` is **not awaited**, and `app.listen()` runs immediately — so the port opens before `/api/chat` is registered. Requests sent in that first moment get a 404; give the process a second after boot ⏱️.


## ▶️ 5. Running It

Run from `src/`, because `.env` lives there and `./server.js` is a relative path:

```bash
cd 10-mcp
npm install
cd src
node client.js
```

Required environment variables:

```
PORT=3000
GROQ_API_KEY=your_groq_key
```

Ask it something that needs the tool:

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"prompt\": \"What is 24 plus 18?\"}"
```

Expected: `{"reponse":"sum using this mcp tool 24 & 18 = 42"}` — the *"using this mcp tool"* prefix confirms the MCP round trip ✅.

*   Don't run `node server.js` yourself — it waits on stdin forever and looks like a hang. The client spawns it 🔌.
*   A prompt with no arithmetic (e.g. *"hello"*) hits the broken `else` branch — see the note above.


## 🚀 6. Where to Go Next

*   **Close the loop 🔁:** Feed the `ToolMessage` back into the model for a natural-language answer, and handle **all** `tool_calls`, not just the first.
*   **Use the LangChain adapter 🔗:** `@langchain/mcp-adapters` converts MCP tools into real LangChain tools, so they drop straight into a `ToolNode` and the section 06 graph.
*   **Remote transport 🌐:** Swap stdio for HTTP/SSE to call an MCP server running on another machine.
*   **More MCP primitives 📦:** Servers can also expose **resources** (readable data) and **prompts** (reusable templates), not just tools.
*   **Real servers 🗄️:** Point the client at existing MCP servers for filesystems, GitHub or databases instead of your own calculator.


## 🎯 7. Interview Takeaways

*   **What is MCP?** 🔌 An open client–server protocol for exposing tools, resources and prompts to LLM applications — a standard interface so tools aren't welded to one agent's codebase.
*   **Server vs. client?** ⚖️ The **server** owns and executes the tool code; the **client** discovers tools, lets the model choose one, and forwards the call.
*   **What does stdio transport mean?** 🚇 JSON-RPC over the child process's stdin/stdout — the server is spawned, not hosted on a port, so it must never print to stdout.
*   **How does the client know what tools exist?** 📡 `listTools()` at runtime, which is MCP's main advantage: add a tool server-side and no client code changes.
*   **How is this different from a LangChain `tool()`?** A local tool is a function in your process; an MCP tool is a **remote capability** behind a protocol boundary, reusable by any MCP-aware client.
*   **Who actually executes the tool?** The MCP **server** — the model only emits a `tool_call`, and the client relays it. Same split as `bindTools()` vs. `ToolNode`.
*   **Why map `inputSchema` into `parameters`?** The model needs function-calling descriptors; MCP's tool format isn't the same shape, so the client adapts between them.
