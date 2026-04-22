import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig, getConfigPath } from "./config.js";
import { registerTools, dispatch } from "./tool-registry.js";
import { startHttpServer } from "./http-server.js";
import { getHistory, getEntry, readLog } from "./history.js";
import { startNgrokTunnel, stopNgrokTunnel, getNgrokStatus } from "./ngrok.js";
import { registerUser, listUsers, deleteUser, getUser } from "./user-registry.js";
import { createPeerClient, getPeerClient } from "./relay/peer.js";
import { handleClaudeCli } from "./handlers/claude-cli.js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load relay config (pre-configured server URL)
const __dirname = dirname(fileURLToPath(import.meta.url));
const relayConfigPath = join(__dirname, "..", "relay-config.json");
let relayConfig: { relayServer?: string } = {};
if (existsSync(relayConfigPath)) {
  try {
    relayConfig = JSON.parse(readFileSync(relayConfigPath, "utf-8"));
  } catch { /* ignore */ }
}

// --- Load config ---
let config;
try {
  config = loadConfig();
  console.error(`[mcp-expose] Config loaded: ${config.name} (${config.tools.length} tools, port ${config.port})`);
} catch {
  config = null;
}

// --- Create MCP server for HTTP (remote access) ---
if (config) {
  const httpMcpServer = new McpServer({
    name: config.name,
    version: "0.1.0",
  });

  // Register user-defined tools
  registerTools(httpMcpServer, config.tools);

  // Register get_status on HTTP server too (so remote users can check progress)
  httpMcpServer.tool(
    "get_status",
    "Get the status and log of a running or completed task",
    { runId: z.string().describe("Run ID from a claude-cli tool") },
    async ({ runId }: { runId: string }) => {
      const entry = getEntry(runId);
      if (!entry) {
        return { content: [{ type: "text" as const, text: `Run not found: ${runId}` }] };
      }
      const log = entry.status !== "running" ? readLog(runId) : "(still running...)";

      // Extract result from stream-json log
      let resultText = "";
      if (log !== "(still running...)") {
        for (const line of log.split("\n").reverse()) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "result" && parsed.result) {
              resultText = parsed.result;
              break;
            }
          } catch { /* skip */ }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...entry,
            result: resultText || "(no result yet)",
          }, null, 2),
        }],
      };
    }
  );

  // Start HTTP server
  startHttpServer(httpMcpServer, {
    port: config.port,
    host: config.host,
    serverName: config.name,
  });
}

// --- Create MCP server for local stdio (Claude Code plugin) ---
const localServer = new McpServer({
  name: "mcp-expose",
  version: "0.1.0",
});

// Built-in tool: expose_scan
localServer.tool(
  "expose_scan",
  "Scan the current project and return info about available scripts, commands, and structure. Use this to help generate mcp-expose.yaml",
  {},
  async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cwd = process.cwd();
    const result: Record<string, unknown> = { cwd };

    // Check package.json
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        result.packageJson = {
          name: pkg.name,
          scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
        };
      } catch { /* ignore */ }
    }

    // Check Makefile
    const makefilePath = path.join(cwd, "Makefile");
    if (fs.existsSync(makefilePath)) {
      try {
        const content = fs.readFileSync(makefilePath, "utf-8");
        const targets = content.match(/^[\w-]+(?=:)/gm) || [];
        result.makefile = { targets: targets.filter(t => !t.startsWith(".")) };
      } catch { /* ignore */ }
    }

    // Check for scripts/ or bin/ directories
    for (const dir of ["scripts", "bin"]) {
      const dirPath = path.join(cwd, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        result[dir] = fs.readdirSync(dirPath).filter(f => !f.startsWith("."));
      }
    }

    // Check if mcp-expose.yaml already exists
    result.configExists = fs.existsSync(path.join(cwd, "mcp-expose.yaml"));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// Built-in tool: expose_status
localServer.tool(
  "expose_status",
  "Show the status of the exposed MCP server",
  {},
  async () => {
    const configPath = getConfigPath();
    const ngrok = getNgrokStatus();
    const users = listUsers();
    const status = config
      ? {
          running: true,
          name: config.name,
          port: config.port,
          host: config.host,
          tools: config.tools.map((t) => t.name),
          configPath,
          tunnel: ngrok.publicUrl
            ? { url: ngrok.publicUrl, port: ngrok.port, since: ngrok.startedAt }
            : null,
          users: {
            count: users.length,
            ids: users.map((u) => u.id),
          },
        }
      : {
          running: false,
          reason: "No mcp-expose.yaml found",
          configPath: null,
        };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
    };
  }
);

// Built-in tool: expose_history
localServer.tool(
  "expose_history",
  "Show recent run history from exposed tools",
  {},
  async () => {
    const history = getHistory(20);
    if (history.length === 0) {
      return { content: [{ type: "text" as const, text: "No history yet." }] };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }],
    };
  }
);

// Built-in tool: expose_config
localServer.tool(
  "expose_config",
  "Show the current mcp-expose.yaml configuration",
  {},
  async () => {
    if (!config) {
      return { content: [{ type: "text" as const, text: "No config loaded." }] };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }],
    };
  }
);

// Built-in tool: openport
localServer.tool(
  "openport",
  "Open a public ngrok tunnel to the MCP HTTP server so outside users can connect",
  {
    port: z.number().optional().describe("Port to tunnel (defaults to config port)"),
    authtoken: z.string().optional().describe("Ngrok auth token for authenticated tunnels"),
    region: z.string().optional().describe("Ngrok region: us, eu, ap, au, sa, jp, in"),
  },
  async ({ port, authtoken, region }: { port?: number; authtoken?: string; region?: string }) => {
    if (!config) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: "No mcp-expose config loaded. HTTP server is not running." }),
        }],
      };
    }

    const targetPort = port ?? config.port;
    const result = await startNgrokTunnel({ port: targetPort, authtoken, region });

    if ("error" in result) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: result.error }) }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "tunnel_open",
          publicUrl: result.url,
          localPort: targetPort,
          legacyEndpoints: {
            sse: `${result.url}/sse`,
            mcp: `${result.url}/mcp`,
          },
          multiTenant: {
            register: `POST ${result.url}/register`,
            userEndpoints: `${result.url}/u/{userId}/sse | /mcp`,
          },
          message: "Use 'create_user' tool to generate unique URLs for each user, or use legacy endpoints for single-user access.",
        }, null, 2),
      }],
    };
  }
);

// Built-in tool: closeport
localServer.tool(
  "closeport",
  "Close the ngrok tunnel and stop exposing the MCP server publicly",
  {},
  async () => {
    const result = await stopNgrokTunnel();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// Built-in tool: create_user
localServer.tool(
  "create_user",
  "Create a new user with unique MCP endpoints. Share the returned URLs with others to let them connect.",
  {
    customId: z.string().optional().describe("Custom user ID (optional, auto-generated if not provided)"),
  },
  async ({ customId }: { customId?: string }) => {
    if (!config) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: "No mcp-expose config loaded. HTTP server is not running." }),
        }],
      };
    }

    const user = registerUser(customId);
    const ngrok = getNgrokStatus();
    const baseUrl = ngrok.publicUrl || `http://${config.host}:${config.port}`;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          userId: user.id,
          createdAt: user.createdAt,
          endpoints: {
            sse: `${baseUrl}/u/${user.id}/sse`,
            mcp: `${baseUrl}/u/${user.id}/mcp`,
          },
          message: "Share these URLs with the user to let them connect to your MCP server.",
        }, null, 2),
      }],
    };
  }
);

// Built-in tool: list_users
localServer.tool(
  "list_users",
  "List all registered users and their endpoints",
  {},
  async () => {
    const users = listUsers();
    if (users.length === 0) {
      return { content: [{ type: "text" as const, text: "No users registered yet." }] };
    }

    const ngrok = getNgrokStatus();
    const baseUrl = config
      ? ngrok.publicUrl || `http://${config.host}:${config.port}`
      : "http://localhost:3000";

    const usersWithEndpoints = users.map((u) => ({
      ...u,
      endpoints: {
        sse: `${baseUrl}/u/${u.id}/sse`,
        mcp: `${baseUrl}/u/${u.id}/mcp`,
      },
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(usersWithEndpoints, null, 2) }],
    };
  }
);

// Built-in tool: delete_user
localServer.tool(
  "delete_user",
  "Delete a user and revoke their access to the MCP server",
  {
    userId: z.string().describe("The user ID to delete"),
  },
  async ({ userId }: { userId: string }) => {
    const user = getUser(userId);
    if (!user) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: "User not found", userId }),
        }],
      };
    }

    const deleted = deleteUser(userId);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          deleted,
          userId,
          message: deleted ? "User deleted successfully. Their endpoints will no longer work." : "Failed to delete user.",
        }, null, 2),
      }],
    };
  }
);

// =====================================================
// P2P Relay Tools
// =====================================================

// Built-in tool: connect
localServer.tool(
  "connect",
  "Connect to the P2P relay server with a custom name. Others can then reach you via ask_peer or call_peer_tool.",
  {
    name: z.string().describe("Your display name on the relay (e.g., 'alice', 'bob-dev', 'qa-team')"),
    server: z.string().optional().describe("Relay server URL (default: from relay-config.json)"),
  },
  async ({ name, server }: { name: string; server?: string }) => {
    // Priority: param > relay-config.json > local config > localhost
    const serverUrl = server
      || relayConfig.relayServer
      || (config ? `ws://${config.host}:${config.port}/ws` : "ws://localhost:8788/ws");

    // Get tools to expose from config
    const tools = config?.tools.map((t) => t.name) || [];

    const client = createPeerClient(serverUrl);

    // Setup handler for incoming ask requests (proxy to Claude CLI)
    client.setAskHandler(async (from: string, question: string) => {
      console.error(`[p2p] Incoming ask from ${from}: ${question.substring(0, 50)}...`);

      const result = await handleClaudeCli(
        {
          prompt: question,
          model: "sonnet",
          allowedTools: ["Read", "Glob", "Grep", "Bash"],
        },
        {},
        true // waitForResult - đợi Claude CLI trả về kết quả
      );

      return result;
    });

    // Setup handler for incoming call_tool requests
    client.setCallToolHandler(async (from: string, tool: string, params: Record<string, unknown>) => {
      console.error(`[p2p] Incoming call_tool from ${from}: ${tool}`);

      if (!config) {
        return JSON.stringify({ error: "No config loaded" });
      }

      const toolDef = config.tools.find((t) => t.name === tool);
      if (!toolDef) {
        return JSON.stringify({ error: `Tool "${tool}" not found` });
      }

      try {
        const result = await dispatch(toolDef, params);
        return result;
      } catch (err) {
        return JSON.stringify({ error: String(err) });
      }
    });

    const result = await client.connect(name, tools);

    if (!result.success) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: result.error || "Connection failed" }),
        }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "connected",
          name,
          server: serverUrl,
          exposedTools: tools,
          onlinePeers: result.peers,
          message: `Connected as "${name}". Others can reach you via ask_peer("${name}", "...") or call_peer_tool("${name}", "tool", {...})`,
        }, null, 2),
      }],
    };
  }
);

// Built-in tool: disconnect
localServer.tool(
  "disconnect",
  "Disconnect from the P2P relay server",
  {},
  async () => {
    const client = getPeerClient();
    if (!client || !client.isConnected()) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Not connected" }) }],
      };
    }

    const name = client.getName();
    client.disconnect();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ status: "disconnected", name }),
      }],
    };
  }
);

// Built-in tool: list_peers
localServer.tool(
  "list_peers",
  "List all online peers on the relay server",
  {},
  async () => {
    const client = getPeerClient();
    if (!client || !client.isConnected()) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Not connected. Use 'connect' first." }) }],
      };
    }

    const peers = await client.listPeers();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          myName: client.getName(),
          peers: peers.filter((p) => p.name !== client.getName()),
        }, null, 2),
      }],
    };
  }
);

// Built-in tool: ask_peer
localServer.tool(
  "ask_peer",
  "Ask a question to another peer. Their Claude CLI will process the question with full context (skills, memory, local files).",
  {
    peer: z.string().describe("Name of the peer to ask"),
    question: z.string().describe("Question or request for the peer's Claude"),
  },
  async ({ peer, question }: { peer: string; question: string }) => {
    const client = getPeerClient();
    if (!client || !client.isConnected()) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Not connected. Use 'connect' first." }) }],
      };
    }

    console.error(`[p2p] Asking ${peer}: ${question.substring(0, 50)}...`);
    const result = await client.askPeer(peer, question);

    if (result.error) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: result.error }) }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          from: peer,
          response: result.result,
        }, null, 2),
      }],
    };
  }
);

// Built-in tool: list_peer_tools
localServer.tool(
  "list_peer_tools",
  "List tools exposed by a specific peer",
  {
    peer: z.string().describe("Name of the peer"),
  },
  async ({ peer }: { peer: string }) => {
    const client = getPeerClient();
    if (!client || !client.isConnected()) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Not connected. Use 'connect' first." }) }],
      };
    }

    const tools = await client.listPeerTools(peer);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ peer, tools }, null, 2),
      }],
    };
  }
);

// Built-in tool: call_peer_tool
localServer.tool(
  "call_peer_tool",
  "Call a specific tool on another peer's machine. The tool must be exposed in their mcp-expose.yaml.",
  {
    peer: z.string().describe("Name of the peer"),
    tool: z.string().describe("Name of the tool to call"),
    params: z.record(z.unknown()).optional().describe("Parameters for the tool"),
  },
  async ({ peer, tool, params }: { peer: string; tool: string; params?: Record<string, unknown> }) => {
    const client = getPeerClient();
    if (!client || !client.isConnected()) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Not connected. Use 'connect' first." }) }],
      };
    }

    console.error(`[p2p] Calling ${peer}.${tool}(${JSON.stringify(params || {})})`);
    const result = await client.callPeerTool(peer, tool, params || {});

    if (result.error) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: result.error }) }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          peer,
          tool,
          result: result.result,
        }, null, 2),
      }],
    };
  }
);

// Built-in tool: my_status
localServer.tool(
  "my_status",
  "Show your current P2P connection status",
  {},
  async () => {
    const client = getPeerClient();

    if (!client || !client.isConnected()) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            connected: false,
            message: "Not connected to any relay server. Use 'connect' to join.",
          }, null, 2),
        }],
      };
    }

    const peers = await client.listPeers();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          connected: true,
          name: client.getName(),
          exposedTools: client.getTools(),
          onlinePeers: peers.filter((p) => p.name !== client.getName()).map((p) => p.name),
        }, null, 2),
      }],
    };
  }
);

// Connect local server via stdio
const transport = new StdioServerTransport();
await localServer.connect(transport);
