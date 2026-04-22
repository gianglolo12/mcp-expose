import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "http";
import { registerUser, getUser, listUsers, userExists } from "./user-registry.js";
import { RelayHub } from "./relay/hub.js";

interface HttpServerOptions {
  port: number;
  host: string;
  serverName: string;
}

function parseUserPath(pathname: string): { userId: string; endpoint: string } | null {
  const match = pathname.match(/^\/u\/([^/]+)\/(sse|mcp|messages)$/);
  if (match) {
    return { userId: match[1], endpoint: match[2] };
  }
  return null;
}

export function startHttpServer(mcpServer: McpServer, options: HttpServerOptions) {
  const { port, host, serverName } = options;
  // Nested map: userId -> sessionId -> transport
  const sseTransports: Map<string, Map<string, SSEServerTransport>> = new Map();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Register new user: POST /register
    if (url.pathname === "/register" && req.method === "POST") {
      const user = registerUser();
      const baseUrl = `http://${host}:${port}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        userId: user.id,
        createdAt: user.createdAt,
        endpoints: {
          sse: `${baseUrl}/u/${user.id}/sse`,
          mcp: `${baseUrl}/u/${user.id}/mcp`,
        },
      }, null, 2));
      return;
    }

    // List users: GET /users
    if (url.pathname === "/users" && req.method === "GET") {
      const users = listUsers();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(users, null, 2));
      return;
    }

    // Parse user-specific routes: /u/{userId}/{endpoint}
    const userPath = parseUserPath(url.pathname);
    if (userPath) {
      const { userId, endpoint } = userPath;

      // Validate user exists
      if (!userExists(userId)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "User not found", userId }));
        return;
      }

      // Update last active
      getUser(userId);

      // Ensure user has a session map
      if (!sseTransports.has(userId)) {
        sseTransports.set(userId, new Map());
      }
      const userSessions = sseTransports.get(userId)!;

      // User-specific MCP: /u/{userId}/mcp
      if (endpoint === "mcp") {
        if (req.method === "POST" || req.method === "GET") {
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res);
          return;
        }
        if (req.method === "DELETE") {
          res.writeHead(200);
          res.end();
          return;
        }
        res.writeHead(405);
        res.end("Method not allowed");
        return;
      }

      // User-specific SSE: /u/{userId}/sse
      if (endpoint === "sse" && req.method === "GET") {
        const transport = new SSEServerTransport(`/u/${userId}/messages`, res);
        userSessions.set(transport.sessionId, transport);
        res.on("close", () => userSessions.delete(transport.sessionId));
        await mcpServer.connect(transport);
        return;
      }

      // User-specific messages: /u/{userId}/messages
      if (endpoint === "messages" && req.method === "POST") {
        const sessionId = url.searchParams.get("sessionId");
        const transport = sessionId ? userSessions.get(sessionId) : undefined;
        if (!transport) {
          res.writeHead(400);
          res.end("Invalid session");
          return;
        }
        await transport.handlePostMessage(req, res);
        return;
      }
    }

    // Legacy routes (backward compatible)
    // StreamableHTTP: /mcp
    if (url.pathname === "/mcp") {
      if (req.method === "POST" || req.method === "GET") {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }
      if (req.method === "DELETE") {
        res.writeHead(200);
        res.end();
        return;
      }
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    // Legacy SSE: /sse (uses "default" user)
    if (url.pathname === "/sse" && req.method === "GET") {
      if (!sseTransports.has("_default")) {
        sseTransports.set("_default", new Map());
      }
      const defaultSessions = sseTransports.get("_default")!;
      const transport = new SSEServerTransport("/messages", res);
      defaultSessions.set(transport.sessionId, transport);
      res.on("close", () => defaultSessions.delete(transport.sessionId));
      await mcpServer.connect(transport);
      return;
    }

    // Legacy SSE messages: /messages
    if (url.pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      const defaultSessions = sseTransports.get("_default");
      const transport = sessionId && defaultSessions ? defaultSessions.get(sessionId) : undefined;
      if (!transport) {
        res.writeHead(400);
        res.end("Invalid session");
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      const totalConnections = Array.from(sseTransports.values())
        .reduce((sum, sessions) => sum + sessions.size, 0);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        name: serverName,
        version: "0.1.0",
        users: listUsers().length,
        connections: totalConnections,
      }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[mcp-expose] Port ${port} is already in use. HTTP server not started.`);
      console.error(`[mcp-expose] Tip: change port in mcp-expose.yaml or kill the process using port ${port}`);
    } else {
      console.error(`[mcp-expose] HTTP server error: ${err.message}`);
    }
  });

  // Create relay hub for P2P communication
  const relayHub = new RelayHub(httpServer);

  httpServer.listen(port, host, () => {
    console.error(`[mcp-expose] ${serverName} running on http://${host}:${port}`);
    console.error(`  WebSocket: ws://${host}:${port}/ws (P2P relay)`);
    console.error(`  Register:  POST http://${host}:${port}/register`);
    console.error(`  User SSE:  http://${host}:${port}/u/{userId}/sse`);
    console.error(`  User MCP:  http://${host}:${port}/u/{userId}/mcp`);
    console.error(`  Legacy:    http://${host}:${port}/sse | /mcp`);
  });

  return { httpServer, relayHub };
}
