from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

# Type alias matching the server's SendFn.
SendFn = Callable[[dict[str, object]], Awaitable[None]]

async def _noop_send(msg: dict[str, object]) -> None:
    """Default no-op sender for sessions created without an explicit send_fn."""
    pass


@dataclass(slots=True)
class ChatSession:
    username: str
    rooms: set[str] = field(default_factory=set)
    writer: Any | None = None
    send_fn: SendFn = _noop_send
    is_authenticated: bool = False
    last_heartbeat: float = 0.0
