from __future__ import annotations

import time
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
    tokens: float = 60.0
    max_tokens: float = 60.0
    refill_rate: float = 30.0
    last_refill: float = field(default_factory=time.time)

    def consume_token(self) -> bool:
        """Token bucket rate limiter. Returns True if token available, False if rate-limited."""
        now = time.time()
        elapsed = now - self.last_refill
        self.last_refill = now
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.refill_rate)
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False
