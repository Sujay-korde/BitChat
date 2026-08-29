export const ConnectionState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  AUTHENTICATING: "authenticating",
  READY: "ready",
  RECONNECTING: "reconnecting",
} as const;
export type ConnectionState = typeof ConnectionState[keyof typeof ConnectionState];

export const MessageState = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
} as const;
export type MessageState = typeof MessageState[keyof typeof MessageState];

export interface AppEvent {
  type: string;
}

export interface ConnectionChanged extends AppEvent {
  type: "ConnectionChanged";
  state: ConnectionState;
}

export interface MessageReceived extends AppEvent {
  type: "MessageReceived";
  sender: string;
  target: string;
  text: string;
}

export interface MessageStatusChanged extends AppEvent {
  type: "MessageStatusChanged";
  msg_id: string;
  state: MessageState;
}

export interface PresenceChanged extends AppEvent {
  type: "PresenceChanged";
  user: string;
  room: string;
  status: string;
}

export interface KeyExchangeCompleted extends AppEvent {
  type: "KeyExchangeCompleted";
  peer: string;
}

export interface ModerationRejected extends AppEvent {
  type: "ModerationRejected";
  target: string;
  text: string;
}

export interface ErrorOccurred extends AppEvent {
  type: "ErrorOccurred";
  reason: string;
}

export type SecureChatEvent = 
  | ConnectionChanged 
  | MessageReceived 
  | MessageStatusChanged 
  | PresenceChanged 
  | KeyExchangeCompleted 
  | ModerationRejected 
  | ErrorOccurred;

export type EventCallback = (event: SecureChatEvent) => void;
