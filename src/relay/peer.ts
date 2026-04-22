import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import type {
  ClientMessage,
  ServerMessage,
  IncomingAskMessage,
  IncomingCallToolMessage,
} from "./protocol.js";

type RequestHandler = (result: string | null, error: string | null) => void;
type AskHandler = (from: string, question: string) => Promise<string>;
type CallToolHandler = (from: string, tool: string, params: Record<string, unknown>) => Promise<string>;

export class PeerClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private name: string | null = null;
  private tools: string[] = [];
  private pendingRequests: Map<string, RequestHandler> = new Map();
  private onAsk: AskHandler | null = null;
  private onCallTool: CallToolHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  setAskHandler(handler: AskHandler) {
    this.onAsk = handler;
  }

  setCallToolHandler(handler: CallToolHandler) {
    this.onCallTool = handler;
  }

  async connect(name: string, tools: string[] = []): Promise<{ success: boolean; peers?: string[]; error?: string }> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
        this.name = name;
        this.tools = tools;

        this.ws.on("open", () => {
          this.send({ type: "connect", name, tools });
        });

        this.ws.on("message", (data: Buffer) => {
          const msg: ServerMessage = JSON.parse(data.toString());
          this.handleMessage(msg, resolve);
        });

        this.ws.on("close", () => {
          console.error("[peer] Connection closed");
          this.ws = null;
        });

        this.ws.on("error", (err) => {
          console.error("[peer] Connection error:", err.message);
          resolve({ success: false, error: err.message });
        });
      } catch (err) {
        resolve({ success: false, error: String(err) });
      }
    });
  }

  private handleMessage(
    msg: ServerMessage,
    connectResolve?: (result: { success: boolean; peers?: string[]; error?: string }) => void
  ) {
    switch (msg.type) {
      case "connected":
        console.error(`[peer] Connected as "${msg.name}"`);
        if (connectResolve) {
          connectResolve({ success: true, peers: msg.peers });
        }
        break;

      case "error":
        console.error(`[peer] Error: ${msg.message}`);
        if (connectResolve) {
          connectResolve({ success: false, error: msg.message });
        }
        break;

      case "peer_joined":
        console.error(`[peer] Peer joined: ${msg.name} (${msg.tools.length} tools)`);
        break;

      case "peer_left":
        console.error(`[peer] Peer left: ${msg.name}`);
        break;

      case "peers_list":
        // Handled by listPeers()
        break;

      case "peer_tools":
        // Handled by listPeerTools()
        break;

      case "incoming_ask":
        this.handleIncomingAsk(msg);
        break;

      case "incoming_call_tool":
        this.handleIncomingCallTool(msg);
        break;

      case "result":
        this.handleResult(msg.id, msg.result || null, msg.error || null);
        break;
    }
  }

  private async handleIncomingAsk(msg: IncomingAskMessage) {
    if (!this.onAsk) {
      this.send({ type: "response", id: msg.id, error: "No ask handler configured" });
      return;
    }

    try {
      console.error(`[peer] Incoming ask from ${msg.from}: ${msg.question.substring(0, 50)}...`);
      const result = await this.onAsk(msg.from, msg.question);
      this.send({ type: "response", id: msg.id, result });
    } catch (err) {
      this.send({ type: "response", id: msg.id, error: String(err) });
    }
  }

  private async handleIncomingCallTool(msg: IncomingCallToolMessage) {
    if (!this.onCallTool) {
      this.send({ type: "response", id: msg.id, error: "No call_tool handler configured" });
      return;
    }

    try {
      console.error(`[peer] Incoming call_tool from ${msg.from}: ${msg.tool}`);
      const result = await this.onCallTool(msg.from, msg.tool, msg.params);
      this.send({ type: "response", id: msg.id, result });
    } catch (err) {
      this.send({ type: "response", id: msg.id, error: String(err) });
    }
  }

  private handleResult(id: string, result: string | null, error: string | null) {
    const handler = this.pendingRequests.get(id);
    if (handler) {
      this.pendingRequests.delete(id);
      handler(result, error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.send({ type: "disconnect" });
      this.ws.close();
      this.ws = null;
      this.name = null;
    }
  }

  async listPeers(): Promise<Array<{ name: string; tools: string[] }>> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve([]);
        return;
      }

      const handler = (data: Buffer) => {
        const msg: ServerMessage = JSON.parse(data.toString());
        if (msg.type === "peers_list") {
          this.ws?.off("message", handler);
          resolve(msg.peers);
        }
      };

      this.ws.on("message", handler);
      this.send({ type: "list_peers" });

      // Timeout after 5s
      setTimeout(() => {
        this.ws?.off("message", handler);
        resolve([]);
      }, 5000);
    });
  }

  async listPeerTools(peer: string): Promise<string[]> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve([]);
        return;
      }

      const handler = (data: Buffer) => {
        const msg: ServerMessage = JSON.parse(data.toString());
        if (msg.type === "peer_tools" && msg.peer === peer) {
          this.ws?.off("message", handler);
          resolve(msg.tools);
        } else if (msg.type === "error") {
          this.ws?.off("message", handler);
          resolve([]);
        }
      };

      this.ws.on("message", handler);
      this.send({ type: "list_peer_tools", peer });

      setTimeout(() => {
        this.ws?.off("message", handler);
        resolve([]);
      }, 5000);
    });
  }

  async askPeer(peer: string, question: string): Promise<{ result?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve({ error: "Not connected" });
        return;
      }

      const id = uuidv4();
      this.pendingRequests.set(id, (result, error) => {
        resolve({ result: result || undefined, error: error || undefined });
      });

      this.send({ type: "ask", id, to: peer, question });

      // Timeout after 60s (Claude may take time)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ error: "Request timeout" });
        }
      }, 60000);
    });
  }

  async callPeerTool(
    peer: string,
    tool: string,
    params: Record<string, unknown>
  ): Promise<{ result?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve({ error: "Not connected" });
        return;
      }

      const id = uuidv4();
      this.pendingRequests.set(id, (result, error) => {
        resolve({ result: result || undefined, error: error || undefined });
      });

      this.send({ type: "call_tool", id, to: peer, tool, params });

      // Timeout after 120s (tool execution may take time)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ error: "Request timeout" });
        }
      }, 120000);
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getName(): string | null {
    return this.name;
  }

  getTools(): string[] {
    return this.tools;
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

// Singleton instance
let peerClient: PeerClient | null = null;

export function getPeerClient(): PeerClient | null {
  return peerClient;
}

export function createPeerClient(serverUrl: string): PeerClient {
  if (peerClient) {
    peerClient.disconnect();
  }
  peerClient = new PeerClient(serverUrl);
  return peerClient;
}
