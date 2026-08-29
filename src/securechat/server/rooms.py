from __future__ import annotations

from collections import defaultdict


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[str]] = defaultdict(set)

    def join(self, room_name: str, username: str) -> None:
        self._rooms[room_name].add(username)

    def leave(self, room_name: str, username: str) -> None:
        members = self._rooms.get(room_name)
        if members is None:
            return
        members.discard(username)
        if not members:
            self._rooms.pop(room_name, None)

    def members(self, room_name: str) -> set[str]:
        return set(self._rooms.get(room_name, set()))

    def rooms_for_user(self, username: str) -> set[str]:
        return {room_name for room_name, members in self._rooms.items() if username in members}
