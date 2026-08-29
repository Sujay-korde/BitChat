from __future__ import annotations

import asyncio
import json
from typing import Protocol, Any

import websockets
from websockets.asyncio.client import ClientConnection as WSClientConnection

from securechat.protocol.framing import read_frame, write_frame

class TransportError(Exception):
    pass

class Transport(Protocol):
    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...
    async def send_frame(self, frame: dict[str, Any]) -> None: ...
    async def recv_frame(self) -> dict[str, Any]: ...

class TCPTransport:
    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        self.host = host
        self.port = port
        self.reader: asyncio.StreamReader | None = None
        self.writer: asyncio.StreamWriter | None = None

    async def connect(self) -> None:
        try:
            self.reader, self.writer = await asyncio.open_connection(self.host, self.port)
        except OSError as e:
            raise TransportError(f"Failed to connect: {e}") from e

    async def disconnect(self) -> None:
        if self.writer:
            self.writer.close()
            try:
                await self.writer.wait_closed()
            except Exception:
                pass
        self.reader = None
        self.writer = None

    async def send_frame(self, frame: dict[str, Any]) -> None:
        if not self.writer:
            raise TransportError("Not connected")
        try:
            await write_frame(self.writer, frame)
        except Exception as e:
            raise TransportError(f"Send failed: {e}") from e

    async def recv_frame(self) -> dict[str, Any]:
        if not self.reader:
            raise TransportError("Not connected")
        try:
            return await read_frame(self.reader)
        except asyncio.IncompleteReadError as e:
            raise TransportError("Connection closed by peer") from e
        except Exception as e:
            raise TransportError(f"Receive failed: {e}") from e


class WebSocketTransport:
    """Client-side WebSocket transport.

    Uses native WebSocket text frames containing JSON — no length prefix.
    Implements the same Transport protocol as TCPTransport so SecureChatApp
    works identically regardless of which transport is injected.
    """

    def __init__(self, uri: str = "ws://127.0.0.1:8766"):
        self.uri = uri
        self._ws: WSClientConnection | None = None

    async def connect(self) -> None:
        try:
            self._ws = await websockets.connect(self.uri)
        except Exception as e:
            raise TransportError(f"WebSocket connect failed: {e}") from e

    async def disconnect(self) -> None:
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

    async def send_frame(self, frame: dict[str, Any]) -> None:
        if not self._ws:
            raise TransportError("Not connected")
        try:
            text = json.dumps(frame, separators=(",", ":"), ensure_ascii=False)
            await self._ws.send(text)
        except Exception as e:
            raise TransportError(f"WebSocket send failed: {e}") from e

    async def recv_frame(self) -> dict[str, Any]:
        if not self._ws:
            raise TransportError("Not connected")
        try:
            raw = await self._ws.recv()
            if isinstance(raw, bytes):
                raise TransportError("Unexpected binary frame")
            return json.loads(raw)
        except websockets.exceptions.ConnectionClosed as e:
            raise TransportError("WebSocket connection closed") from e
        except json.JSONDecodeError as e:
            raise TransportError(f"Invalid JSON from server: {e}") from e
        except TransportError:
            raise
        except Exception as e:
            raise TransportError(f"WebSocket recv failed: {e}") from e

