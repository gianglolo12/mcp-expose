import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type {
  ClientMessage,
  ServerMessage,
  PeerInfo,
} from "./protocol.js";

interface ConnectedPeer {
  ws: WebSocket;
  info: PeerInfo;
}

export class RelayHub {
  private wss: WebSocketServer;
  private peers: Map<string, ConnectedPeer> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.setupHandlers();
    console.error("[relay] WebSocket relay hub started at /ws");
  }

  private setupHandlers() {
    this.wss.on("connection", (ws: WebSocket) => {
      let peerName: string | null = null;

      ws.on("message", (data: Buffer) => {
        try {
          const msg: ClientMessage = JSON.parse(data.toString());
          peerName = this.handleMessage(ws, peerName, msg);
        } catch (e) {
          this.send(ws, { type: "error", message: "Invalid message format" });
        }
      });

      ws.on("close", () => {
        if (peerName) {
          this.removePeer(peerName);
        }
      });

      ws.on("error", (err) => {
        console.error("[relay] WebSocket error:", err.message);
        if (peerName) {
          this.removePeer(peerName);
        }
      });
    });
  }

  private handleMessage(
    ws: WebSocket,
    currentName: string | null,
    msg: ClientMessage
  ): string | null {
    switch (msg.type) {
      case "connect":
        return this.handleConnect(ws, msg.name, msg.tools || []);

      case "disconnect":
        if (currentName) {
          this.removePeer(currentName);
        }
        return null;

      case "list_peers":
        this.handleListPeers(ws);
        return currentName;

      case "list_peer_tools":
        this.handleListPeerTools(ws, msg.peer);
        return currentName;

      case "ask":
        if (currentName) {
          this.handleAsk(currentName, msg.id, msg.to, msg.question);
        }
        return currentName;

      case "call_tool":
        if (currentName) {
          this.handleCallTool(currentName, msg.id, msg.to, msg.tool, msg.params);
        }
        return currentName;

      case "response":
        if (currentName) {
          this.handleResponse(currentName, msg.id, msg.result, msg.error);
        }
        return currentName;

      default:
        this.send(ws, { type: "error", message: "Unknown message type" });
        return currentName;
    }
  }

  private handleConnect(ws: WebSocket, name: string, tools: string[]): string | null {
    // Check if name already taken
    if (this.peers.has(name)) {
      this.send(ws, { type: "error", message: `Name "${name}" already taken` });
      return null;
    }

    // Register peer
    const peer: ConnectedPeer = {
      ws,
      info: { name, tools, connectedAt: new Date() },
    };
    this.peers.set(name, peer);

    // Send connected confirmation
    const peerNames = Array.from(this.peers.keys()).filter((n) => n !== name);
    this.send(ws, { type: "connected", name, peers: peerNames });

    // Notify other peers
    this.broadcast(name, { type: "peer_joined", name, tools });

    console.error(`[relay] Peer connected: ${name} (${tools.length} tools)`);
    return name;
  }

  private removePeer(name: string) {
    const peer = this.peers.get(name);
    if (peer) {
      this.peers.delete(name);
      this.broadcast(name, { type: "peer_left", name });
      console.error(`[relay] Peer disconnected: ${name}`);
    }
  }

  private handleListPeers(ws: WebSocket) {
    const peers = Array.from(this.peers.values()).map((p) => ({
      name: p.info.name,
      tools: p.info.tools,
    }));
    this.send(ws, { type: "peers_list", peers });
  }

  private handleListPeerTools(ws: WebSocket, peerName: string) {
    const peer = this.peers.get(peerName);
    if (!peer) {
      this.send(ws, { type: "error", message: `Peer "${peerName}" not found` });
      return;
    }
    this.send(ws, { type: "peer_tools", peer: peerName, tools: peer.info.tools });
  }

  private handleAsk(from: string, id: string, to: string, question: string) {
    const target = this.peers.get(to);
    const sender = this.peers.get(from);

    if (!target) {
      if (sender) {
        this.send(sender.ws, { type: "result", id, from: to, error: `Peer "${to}" not found or offline` });
      }
      return;
    }

    // Forward ask to target peer
    this.send(target.ws, { type: "incoming_ask", id, from, question });
  }

  private handleCallTool(
    from: string,
    id: string,
    to: string,
    tool: string,
    params: Record<string, unknown>
  ) {
    const target = this.peers.get(to);
    const sender = this.peers.get(from);

    if (!target) {
      if (sender) {
        this.send(sender.ws, { type: "result", id, from: to, error: `Peer "${to}" not found or offline` });
      }
      return;
    }

    // Check if tool exists
    if (!target.info.tools.includes(tool)) {
      if (sender) {
        this.send(sender.ws, { type: "result", id, from: to, error: `Tool "${tool}" not found on peer "${to}"` });
      }
      return;
    }

    // Forward call_tool to target peer
    this.send(target.ws, { type: "incoming_call_tool", id, from, tool, params });
  }

  private handleResponse(from: string, id: string, result?: string, error?: string) {
    // Find the original requester by checking pending requests
    // For simplicity, broadcast to all - the id will match on the right client
    for (const [name, peer] of this.peers) {
      if (name !== from) {
        this.send(peer.ws, { type: "result", id, from, result, error });
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(exclude: string, msg: ServerMessage) {
    for (const [name, peer] of this.peers) {
      if (name !== exclude) {
        this.send(peer.ws, msg);
      }
    }
  }

  public getPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).map((p) => p.info);
  }
}
