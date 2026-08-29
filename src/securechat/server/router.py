from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from securechat.protocol.schema import MessageEnvelope
from securechat.protocol.types import MessageType


@dataclass(slots=True)
class RoutedAction:
    kind: str
    payload: dict[str, Any]


class MessageRouter:
    def route(self, envelope: MessageEnvelope) -> RoutedAction:
        if envelope.type == MessageType.AUTH:
            return RoutedAction("auth", {"username": envelope.sender})
        if envelope.type == MessageType.JOIN:
            return RoutedAction("join", {"room": envelope.target, "username": envelope.sender})
        if envelope.type == MessageType.LEAVE:
            return RoutedAction("leave", {"room": envelope.target, "username": envelope.sender})
        if envelope.type == MessageType.MSG:
            return RoutedAction(
                "message",
                {
                    "msg_id": envelope.msg_id,
                    "sender": envelope.sender,
                    "target": envelope.target,
                    "target_type": envelope.target_type.value,
                    "ciphertext": envelope.payload,
                },
            )
        if envelope.type == MessageType.HEARTBEAT:
            return RoutedAction("heartbeat", {"username": envelope.sender})
        if envelope.type == MessageType.KEY_EXCHANGE:
            return RoutedAction("key_exchange", {"sender": envelope.sender, "target": envelope.target, "payload": envelope.payload})
        return RoutedAction("error", {"reason": f"Unsupported message type: {envelope.type}"})
