export const MessageType = {
  AUTH: "AUTH",
  AUTH_OK: "AUTH_OK",
  AUTH_FAIL: "AUTH_FAIL",
  KEY_EXCHANGE: "KEY_EXCHANGE",
  JOIN: "JOIN",
  LEAVE: "LEAVE",
  MSG: "MSG",
  ACK: "ACK",
  ROOM_KEY: "ROOM_KEY",
  PRESENCE: "PRESENCE",
  HEARTBEAT: "HEARTBEAT",
  MODERATION_WARN: "MODERATION_WARN",
  ERROR: "ERROR",
} as const;
export type MessageType = typeof MessageType[keyof typeof MessageType];

export const TargetType = {
  ROOM: "room",
  USER: "user",
} as const;
export type TargetType = typeof TargetType[keyof typeof TargetType];
