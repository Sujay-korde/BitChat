from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

class ConnectionState(StrEnum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    AUTHENTICATING = "authenticating"
    READY = "ready"
    RECONNECTING = "reconnecting"

class MessageState(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"

@dataclass
class AppEvent:
    pass

@dataclass
class ConnectionChanged(AppEvent):
    state: ConnectionState

@dataclass
class MessageReceived(AppEvent):
    sender: str
    target: str
    text: str

@dataclass
class MessageStatusChanged(AppEvent):
    msg_id: str
    state: MessageState

@dataclass
class PresenceChanged(AppEvent):
    user: str
    room: str
    status: str

@dataclass
class KeyExchangeCompleted(AppEvent):
    peer: str

@dataclass
class ModerationRejected(AppEvent):
    target: str
    text: str

@dataclass
class ErrorOccurred(AppEvent):
    reason: str
