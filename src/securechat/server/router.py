from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from securechat.protocol.schema import MessageEnvelope
from securechat.protocol.types import MessageType, TargetType


@dataclass(slots=True)
class RoutedAction:
    kind: str
    payload: dict[str, Any]


class MessageRouter:
    def route(self, envelope: MessageEnvelope) -> RoutedAction:
        if envelope.type == MessageType.AUTH:
            auth_payload: dict[str, Any] = {"username": envelope.sender}
            try:
                data = json.loads(envelope.payload)
                if isinstance(data, dict):
                    auth_payload.update(data)
            except Exception:
                pass
            return RoutedAction("auth", auth_payload)
        if envelope.type == MessageType.JOIN:
            return RoutedAction("join", {"room": envelope.target.strip().lstrip("#@").lower(), "username": envelope.sender})
        if envelope.type == MessageType.LEAVE:
            return RoutedAction("leave", {"room": envelope.target.strip().lstrip("#@").lower(), "username": envelope.sender})
        if envelope.type == MessageType.MSG:
            raw_target = envelope.target
            target = raw_target.strip().lstrip("#@").lower() if envelope.target_type == TargetType.ROOM else raw_target
            return RoutedAction(
                "message",
                {
                    "msg_id": envelope.msg_id,
                    "sender": envelope.sender,
                    "target": target,
                    "target_type": envelope.target_type.value,
                    "ciphertext": envelope.payload,
                },
            )
        if envelope.type == MessageType.HEARTBEAT:
            return RoutedAction("heartbeat", {"username": envelope.sender})
        if envelope.type == MessageType.KEY_EXCHANGE:
            return RoutedAction("key_exchange", {"sender": envelope.sender, "target": envelope.target, "payload": envelope.payload})
        if envelope.type == MessageType.ROOM_KEY:
            return RoutedAction("room_key", {"sender": envelope.sender, "target": envelope.target, "payload": envelope.payload})
        if envelope.type == MessageType.PRESENCE:
            return RoutedAction("presence", {"username": envelope.sender, "status": envelope.payload})
        return RoutedAction("error", {"reason": f"Unsupported message type: {envelope.type}"})
