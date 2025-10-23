#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "get_current_time",
    description: "Get the current date and time",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "Timezone (e.g., 'America/New_York', 'UTC'). Defaults to local timezone.",
        },
      },
    },
  },
  {
    name: "calculate",
    description: "Perform a basic mathematical calculation",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "echo",
    description: "Echo back a message with optional formatting",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to echo back",
        },
        uppercase: {
          type: "boolean",
          description: "Convert message to uppercase",
          default: false,
        },
      },
      required: ["message"],
    },
  },
];

// Function to create a new server instance for each connection
function createServer() {
  const server = new Server(
    {
      name: "example-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_current_time": {
          const timezone = args?.timezone as string | undefined;
          const date = new Date();

          const timeString = timezone
            ? date.toLocaleString("en-US", { timeZone: timezone })
            : date.toLocaleString();

          return {
            content: [
              {
                type: "text",
                text: `Current time${timezone ? ` in ${timezone}` : ""}: ${timeString}`,
              },
            ],
          };
        }

        case "calculate": {
          const expression = args?.expression as string;
          if (!expression) {
            throw new Error("Expression is required");
          }

          // Simple safe evaluation (only allows numbers and basic operators)
          const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
          if (sanitized !== expression) {
            throw new Error("Invalid characters in expression");
          }

          const result = eval(sanitized);

          return {
            content: [
              {
                type: "text",
                text: `${expression} = ${result}`,
              },
            ],
          };
        }

        case "echo": {
          const message = args?.message as string;
          const uppercase = args?.uppercase as boolean;

          if (!message) {
            throw new Error("Message is required");
          }

          const output = uppercase ? message.toUpperCase() : message;

          return {
            content: [
              {
                type: "text",
                text: output,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Configuration
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "your-secret-api-key-change-this";

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);
  if (token !== API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Store transports and servers by session ID
const transports = new Map<string, { transport: SSEServerTransport; server: Server }>();
let currentTransport: SSEServerTransport | null = null;

// MCP SSE endpoint (no auth for testing with Claude.ai)
app.get("/sse", async (req, res) => {
  console.log("=== New SSE connection established ===");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));

  try {
    // Generate a session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log("Session ID:", sessionId);

    const transport = new SSEServerTransport("/message", res);
    console.log("SSEServerTransport created");

    const serverInstance = createServer();
    console.log("Server instance created");

    // Store transport and server for message handling
    transports.set(sessionId, { transport, server: serverInstance });
    currentTransport = transport; // Track most recent for single-user mode

    // Set session ID header for client
    res.setHeader("X-Session-ID", sessionId);

    console.log("About to connect server to transport...");
    await serverInstance.connect(transport);
    console.log("Server connected to transport successfully!");
    console.log("Active sessions:", transports.size);

    // Clean up on connection close
    req.on("close", () => {
      console.log("=== SSE connection closed ===, session:", sessionId);
      transports.delete(sessionId);
      if (currentTransport === transport) {
        currentTransport = null;
      }
      console.log("Remaining sessions:", transports.size);
    });

    req.on("error", (err) => {
      console.error("Request error:", err);
    });

    res.on("error", (err) => {
      console.error("Response error:", err);
    });

  } catch (error) {
    console.error("!!! Error establishing SSE connection:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "no stack");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to establish SSE connection" });
    }
  }
});

// MCP message endpoint
app.post("/message", express.raw({ type: "application/json" }), async (req, res) => {
  console.log("=== Received message on /message endpoint ===");
  console.log("Current transport available:", !!currentTransport);
  console.log("Active transports:", transports.size);

  try {
    // Try to handle the message with the current transport
    if (currentTransport && typeof (currentTransport as any).handlePostMessage === 'function') {
      console.log("Calling transport.handlePostMessage");
      await (currentTransport as any).handlePostMessage(req, res);
      console.log("handlePostMessage completed successfully");
    } else {
      console.log("No handlePostMessage method found on transport");
      console.log("Transport methods:", currentTransport ? Object.getOwnPropertyNames(Object.getPrototypeOf(currentTransport)) : "no transport");
      res.status(202).end();
    }
  } catch (error) {
    console.error("!!! Error handling message:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "no stack");
    if (!res.headersSent) {
      res.status(500).json({ error: "Message handling failed" });
    }
  }
});

// Start server
async function main() {
  app.listen(PORT, () => {
    console.log(`MCP Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`API Key: ${API_KEY}`);
    console.log("\nIMPORTANT: Change the API_KEY environment variable for security!");
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
