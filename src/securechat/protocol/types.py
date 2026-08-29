from __future__ import annotations

from enum import StrEnum


class MessageType(StrEnum):
    AUTH = "AUTH"
    AUTH_OK = "AUTH_OK"
    AUTH_FAIL = "AUTH_FAIL"
    KEY_EXCHANGE = "KEY_EXCHANGE"
    JOIN = "JOIN"
    LEAVE = "LEAVE"
    MSG = "MSG"
    ACK = "ACK"
    PRESENCE = "PRESENCE"
    HEARTBEAT = "HEARTBEAT"
    MODERATION_WARN = "MODERATION_WARN"
    ERROR = "ERROR"


class TargetType(StrEnum):
    ROOM = "room"
    USER = "user"
