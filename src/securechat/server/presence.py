from __future__ import annotations

from enum import StrEnum


class PresenceStatus(StrEnum):
    ONLINE = "online"
    OFFLINE = "offline"


class PresenceManager:
    def __init__(self) -> None:
        self._status_by_user: dict[str, PresenceStatus] = {}

    def set_online(self, username: str) -> None:
        self._status_by_user[username] = PresenceStatus.ONLINE

    def set_offline(self, username: str) -> None:
        self._status_by_user[username] = PresenceStatus.OFFLINE

    def status(self, username: str) -> PresenceStatus:
        return self._status_by_user.get(username, PresenceStatus.OFFLINE)

    def online_users(self) -> set[str]:
        return {username for username, status in self._status_by_user.items() if status == PresenceStatus.ONLINE}
