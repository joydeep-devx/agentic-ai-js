import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

/* Create an instance of the server */
const server = new McpServer({
  name: "calculator",
  description: "a server to manage calcultor tools",
  version: "1.0.0",
});

/* Create a tool and register */
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

const transport = new StdioServerTransport();

server.connect(transport);
