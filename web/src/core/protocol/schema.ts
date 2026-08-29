import { MessageType, TargetType } from "./types";

export interface MessageEnvelope {
  type: MessageType;
  msg_id: string;
  sender: string;
  target: string;
  target_type: TargetType;
  timestamp: number;
  payload: string;
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export function validateMessageEnvelope(message: any): MessageEnvelope {
  if (!message || typeof message !== "object") {
    throw new SchemaError("Message must be an object");
  }

  const requiredFields = ["type", "msg_id", "sender", "target", "target_type", "timestamp", "payload"];
  const missingFields = requiredFields.filter((field) => !(field in message));
  
  if (missingFields.length > 0) {
    throw new SchemaError(`Missing required fields: ${missingFields.join(", ")}`);
  }

  if (!Object.values(MessageType).includes(message.type)) {
    throw new SchemaError(`Invalid MessageType: ${message.type}`);
  }
  
  if (!Object.values(TargetType).includes(message.target_type)) {
    throw new SchemaError(`Invalid TargetType: ${message.target_type}`);
  }

  if (typeof message.msg_id !== "string" || !message.msg_id) {
    throw new SchemaError("msg_id must be a non-empty string");
  }
  if (typeof message.sender !== "string" || !message.sender) {
    throw new SchemaError("sender must be a non-empty string");
  }
  if (typeof message.target !== "string" || !message.target) {
    throw new SchemaError("target must be a non-empty string");
  }
  if (typeof message.timestamp !== "number") {
    throw new SchemaError("timestamp must be a number");
  }
  if (typeof message.payload !== "string") {
    throw new SchemaError("payload must be a string");
  }

  return {
    type: message.type as MessageType,
    msg_id: message.msg_id,
    sender: message.sender,
    target: message.target,
    target_type: message.target_type as TargetType,
    timestamp: message.timestamp,
    payload: message.payload,
  };
}
