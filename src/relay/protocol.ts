// Message types for P2P relay protocol

// Client → Server messages
export interface ConnectMessage {
  type: "connect";
  name: string;
  tools?: string[]; // Tools from mcp-expose.yaml to expose
}

export interface DisconnectMessage {
  type: "disconnect";
}

export interface AskMessage {
  type: "ask";
  id: string;
  to: string;
  question: string;
}

export interface CallToolMessage {
  type: "call_tool";
  id: string;
  to: string;
  tool: string;
  params: Record<string, unknown>;
}

export interface ResponseMessage {
  type: "response";
  id: string;
  result?: string;
  error?: string;
}

export interface ListPeersMessage {
  type: "list_peers";
}

export interface ListPeerToolsMessage {
  type: "list_peer_tools";
  peer: string;
}

export type ClientMessage =
  | ConnectMessage
  | DisconnectMessage
  | AskMessage
  | CallToolMessage
  | ResponseMessage
  | ListPeersMessage
  | ListPeerToolsMessage;

// Server → Client messages
export interface ConnectedMessage {
  type: "connected";
  name: string;
  peers: string[];
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export interface PeerJoinedMessage {
  type: "peer_joined";
  name: string;
  tools: string[];
}

export interface PeerLeftMessage {
  type: "peer_left";
  name: string;
}

export interface PeersListMessage {
  type: "peers_list";
  peers: Array<{ name: string; tools: string[] }>;
}

export interface PeerToolsMessage {
  type: "peer_tools";
  peer: string;
  tools: string[];
}

export interface IncomingAskMessage {
  type: "incoming_ask";
  id: string;
  from: string;
  question: string;
}

export interface IncomingCallToolMessage {
  type: "incoming_call_tool";
  id: string;
  from: string;
  tool: string;
  params: Record<string, unknown>;
}

export interface ResultMessage {
  type: "result";
  id: string;
  from: string;
  result?: string;
  error?: string;
}

export type ServerMessage =
  | ConnectedMessage
  | ErrorMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | PeersListMessage
  | PeerToolsMessage
  | IncomingAskMessage
  | IncomingCallToolMessage
  | ResultMessage;

// Peer info stored on server
export interface PeerInfo {
  name: string;
  tools: string[];
  connectedAt: Date;
}
