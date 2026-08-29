from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .types import MessageType, TargetType


@dataclass(slots=True)
class MessageEnvelope:
    type: MessageType
    msg_id: str
    sender: str
    target: str
    target_type: TargetType
    timestamp: int
    payload: str


class SchemaError(ValueError):
    """Raised when a message envelope fails validation."""


def validate_message_envelope(message: dict[str, Any]) -> MessageEnvelope:
    required_fields = ("type", "msg_id", "sender", "target", "target_type", "timestamp", "payload")
    missing_fields = [field for field in required_fields if field not in message]
    if missing_fields:
        raise SchemaError(f"Missing required fields: {', '.join(missing_fields)}")

    try:
        message_type = MessageType(message["type"])
        target_type = TargetType(message["target_type"])
    except ValueError as exc:
        raise SchemaError(str(exc)) from exc

    if not isinstance(message["msg_id"], str) or not message["msg_id"]:
        raise SchemaError("msg_id must be a non-empty string")
    if not isinstance(message["sender"], str) or not message["sender"]:
        raise SchemaError("sender must be a non-empty string")
    if not isinstance(message["target"], str) or not message["target"]:
        raise SchemaError("target must be a non-empty string")
    if not isinstance(message["timestamp"], int):
        raise SchemaError("timestamp must be an integer")
    if not isinstance(message["payload"], str):
        raise SchemaError("payload must be a string")

    return MessageEnvelope(
        type=message_type,
        msg_id=message["msg_id"],
        sender=message["sender"],
        target=message["target"],
        target_type=target_type,
        timestamp=message["timestamp"],
        payload=message["payload"],
    )
