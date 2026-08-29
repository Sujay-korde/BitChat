import { describe, it, expect } from 'vitest';
import { validateMessageEnvelope } from '../src/core/protocol/schema';
import { MessageType, TargetType } from '../src/core/protocol/types';

describe('Protocol Schema', () => {
  it('should validate a correct message envelope', () => {
    const valid = {
      type: "MSG",
      msg_id: "test-123",
      sender: "alice",
      target: "room1",
      target_type: "room",
      timestamp: 1234567890,
      payload: "encrypted_payload_here"
    };
    const envelope = validateMessageEnvelope(valid);
    expect(envelope.type).toBe(MessageType.MSG);
    expect(envelope.target_type).toBe(TargetType.ROOM);
  });

  it('should reject missing fields', () => {
    const invalid = {
      type: "MSG",
      sender: "alice"
      // missing fields
    };
    expect(() => validateMessageEnvelope(invalid)).toThrow("Missing required fields");
  });

  it('should reject invalid message types', () => {
    const invalid = {
      type: "INVALID_TYPE",
      msg_id: "test-123",
      sender: "alice",
      target: "room1",
      target_type: "room",
      timestamp: 1234567890,
      payload: ""
    };
    expect(() => validateMessageEnvelope(invalid)).toThrow("Invalid MessageType");
  });
});
