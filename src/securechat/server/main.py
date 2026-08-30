from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

import websockets
from websockets.asyncio.server import ServerConnection

from securechat.protocol.framing import FrameError, read_frame, write_frame
from securechat.protocol.schema import SchemaError, validate_message_envelope
from securechat.protocol.types import MessageType, TargetType
from .presence import PresenceManager
from .rooms import RoomManager
from .router import MessageRouter
from .session import ChatSession

logger = logging.getLogger("securechat.server")

# Type alias: an async function that sends a protocol message dict to a client.
SendFn = Callable[[dict[str, object]], Awaitable[None]]


@dataclass
class ChatServer:
    host: str = "127.0.0.1"
    port: int = 8765
    ws_port: int = 8766
    router: MessageRouter = field(default_factory=MessageRouter)
    rooms: RoomManager = field(default_factory=RoomManager)
    presence: PresenceManager = field(default_factory=PresenceManager)
    sessions: dict[str, ChatSession] = field(default_factory=dict)
    _prune_task: asyncio.Task | None = None

    async def start(self) -> None:
        self._prune_task = asyncio.create_task(self._prune_dead_sessions())
        try:
            server = await asyncio.start_server(self._handle_tcp_client, self.host, self.port)
            logger.info("TCP server listening on %s:%d", self.host, self.port)
            async with server:
                await server.serve_forever()
        finally:
            if self._prune_task:
                self._prune_task.cancel()

    async def start_all(self) -> None:
        """Start both TCP and WebSocket servers concurrently."""
        self._prune_task = asyncio.create_task(self._prune_dead_sessions())
        try:
            tcp_server = await asyncio.start_server(self._handle_tcp_client, self.host, self.port)
            logger.info("TCP server listening on %s:%d", self.host, self.port)

            ws_server = await websockets.serve(
                self._handle_ws_client,
                self.host,
                self.ws_port,
            )
            logger.info("WebSocket server listening on %s:%d", self.host, self.ws_port)

            async with tcp_server:
                await asyncio.gather(
                    tcp_server.serve_forever(),
                    ws_server.wait_closed(),
                )
        finally:
            if self._prune_task:
                self._prune_task.cancel()

    async def start_ws(self) -> None:
        """Start only the WebSocket server."""
        self._prune_task = asyncio.create_task(self._prune_dead_sessions())
        try:
            async with websockets.serve(
                self._handle_ws_client,
                self.host,
                self.ws_port,
            ) as ws_server:
                logger.info("WebSocket server listening on %s:%d", self.host, self.ws_port)
                await ws_server.wait_closed()
        finally:
            if self._prune_task:
                self._prune_task.cancel()

    # ------------------------------------------------------------------ #
    #  Session pruning (shared by both transports)
    # ------------------------------------------------------------------ #

    async def _prune_dead_sessions(self) -> None:
        while True:
            try:
                await asyncio.sleep(5.0)
                now = time.time()
                dead_users = [
                    username for username, session in self.sessions.items()
                    if now - session.last_heartbeat > 15.0
                ]
                for user in dead_users:
                    logger.info("Pruning stale session: %s", user)
                    await self._cleanup_session(user)
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    async def _cleanup_session(self, username: str) -> None:
        if username not in self.sessions:
            return

        session = self.sessions.pop(username)
        self.presence.set_offline(username)

        for room in list(session.rooms):
            self.rooms.leave(room, username)
            await self._broadcast_presence(room, username, "offline")

        if session.writer:
            if hasattr(session.writer, "is_closing"):
                if not session.writer.is_closing():
                    session.writer.close()
                    try:
                        await session.writer.wait_closed()
                    except Exception:
                        pass
            else:
                try:
                    await session.writer.close()
                except Exception:
                    pass

    # ------------------------------------------------------------------ #
    #  TCP transport handler
    # ------------------------------------------------------------------ #

    async def _handle_tcp_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        username: str | None = None

        async def tcp_send(msg: dict[str, object]) -> None:
            await write_frame(writer, msg)

        try:
            while True:
                try:
                    raw_message = await read_frame(reader)
                    envelope = validate_message_envelope(raw_message)
                    action = self.router.route(envelope)
                except (FrameError, SchemaError) as exc:
                    err_user = username or "anonymous"
                    try:
                        await tcp_send(self._response(MessageType.ERROR, "server", err_user, "user", str(exc)))
                    except Exception:
                        pass
                    continue

                result = await self._process_action(action, tcp_send, username, writer)
                if result is not None:
                    username = result
        except (asyncio.IncompleteReadError, ConnectionResetError, OSError):
            pass
        finally:
            if username:
                await self._cleanup_session(username)
            else:
                writer.close()
                try:
                    await writer.wait_closed()
                except Exception:
                    pass

    # ------------------------------------------------------------------ #
    #  WebSocket transport handler
    # ------------------------------------------------------------------ #

    async def _handle_ws_client(self, websocket: ServerConnection) -> None:
        username: str | None = None

        async def ws_send(msg: dict[str, object]) -> None:
            await websocket.send(json.dumps(msg, separators=(",", ":"), ensure_ascii=False))

        try:
            async for raw_text in websocket:
                if not isinstance(raw_text, str):
                    await ws_send(self._response(MessageType.ERROR, "server", username or "anonymous", "user", "Binary frames not supported"))
                    continue
                try:
                    raw_message = json.loads(raw_text)
                    envelope = validate_message_envelope(raw_message)
                    action = self.router.route(envelope)
                except (json.JSONDecodeError, SchemaError) as exc:
                    err_user = username or "anonymous"
                    try:
                        await ws_send(self._response(MessageType.ERROR, "server", err_user, "user", str(exc)))
                    except Exception:
                        pass
                    continue

                result = await self._process_action(action, ws_send, username, websocket)
                if result is not None:
                    username = result
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception:
            pass
        finally:
            if username:
                await self._cleanup_session(username)

    # ------------------------------------------------------------------ #
    #  Shared protocol processing (transport-agnostic)
    # ------------------------------------------------------------------ #

    async def _process_action(
        self,
        action: Any,
        send_fn: SendFn,
        username: str | None,
        writer: Any,
    ) -> str | None:
        """Process a routed action.

        Returns the username if authentication occurred, otherwise None.
        The caller must track username state.
        """
        if action.kind == "auth":
            new_username = action.payload["username"]
            self.sessions[new_username] = ChatSession(
                username=new_username,
                writer=writer,
                send_fn=send_fn,
                is_authenticated=True,
                last_heartbeat=time.time(),
            )
            self.presence.set_online(new_username)
            logger.info("Authenticated: %s", new_username)
            await send_fn(self._response(MessageType.AUTH_OK, new_username, new_username, "user", "ok"))
            return new_username

        if username is None:
            await send_fn(self._response(MessageType.AUTH_FAIL, "server", "anonymous", "user", "authenticate first"))
            return None

        session = self.sessions.setdefault(
            username,
            ChatSession(username=username, writer=writer, send_fn=send_fn, is_authenticated=True),
        )
        session.last_heartbeat = time.time()

        if action.kind == "join":
            room = action.payload["room"]
            self.rooms.join(room, username)
            session.rooms.add(room)
            logger.info("JOIN: %s -> %s", username, room)
            await self._broadcast_presence(room, username, "joined")

        elif action.kind == "leave":
            room = action.payload["room"]
            self.rooms.leave(room, username)
            session.rooms.discard(room)
            logger.info("LEAVE: %s -> %s", username, room)
            await self._broadcast_presence(room, username, "left")

        elif action.kind == "heartbeat":
            session.last_heartbeat = time.time()
            await send_fn(self._response(MessageType.ACK, "server", username, "user", "alive"))

        elif action.kind == "key_exchange":
            logger.info("KEY_EXCHANGE: %s -> %s", username, action.payload["target"])
            await self._relay_key_exchange(username, action.payload)

        elif action.kind == "room_key":
            logger.info("ROOM_KEY: %s -> %s", username, action.payload["target"])
            await self._relay_room_key(username, action.payload)

        elif action.kind == "message":
            logger.info("MSG: %s -> %s [id=%s]", username, action.payload["target"], action.payload["msg_id"])
            await self._relay_ciphertext(action.payload)
            await send_fn(self._response(MessageType.ACK, "server", username, "user", action.payload["msg_id"]))

        elif action.kind == "error":
            await send_fn(self._response(MessageType.ERROR, "server", username, "user", action.payload["reason"]))

        return None

    # ------------------------------------------------------------------ #
    #  Relay helpers (transport-agnostic, use session.send_fn)
    # ------------------------------------------------------------------ #

    async def _broadcast_presence(self, room: str, username: str, event: str) -> None:
        message = self._response(MessageType.PRESENCE, "server", room, TargetType.ROOM.value, f"{username}:{event}")
        for member in self.rooms.members(room):
            if member != username and member in self.sessions:
                session = self.sessions[member]
                try:
                    await session.send_fn(message)
                except Exception:
                    pass

    async def _relay_key_exchange(self, username: str, payload: dict[str, str]) -> None:
        target = payload["target"]
        sender = payload["sender"]
        if target in self.sessions:
            session = self.sessions[target]
            message = self._response(MessageType.KEY_EXCHANGE, sender, target, TargetType.USER.value, payload["payload"])
            try:
                await session.send_fn(message)
            except Exception:
                pass

    async def _relay_room_key(self, username: str, payload: dict[str, str]) -> None:
        target = payload["target"]
        sender = payload["sender"]
        if target in self.sessions:
            session = self.sessions[target]
            message = self._response(MessageType.ROOM_KEY, sender, target, TargetType.USER.value, payload["payload"])
            try:
                await session.send_fn(message)
            except Exception:
                pass

    async def _relay_ciphertext(self, payload: dict[str, str]) -> None:
        target = payload["target"]
        target_type = payload["target_type"]
        sender = payload["sender"]

        message = self._response(MessageType.MSG, sender, target, target_type, payload["ciphertext"])

        if target_type == TargetType.ROOM.value:
            for member in self.rooms.members(target):
                if member != sender and member in self.sessions:
                    session = self.sessions[member]
                    try:
                        await session.send_fn(message)
                    except Exception:
                        pass
        elif target_type == TargetType.USER.value:
            if target in self.sessions:
                session = self.sessions[target]
                try:
                    await session.send_fn(message)
                except Exception:
                    pass

    def _response(self, message_type: MessageType, sender: str, target: str, target_type: str, payload: str) -> dict[str, object]:
        return {
            "type": message_type.value,
            "msg_id": "server-response",
            "sender": sender,
            "target": target,
            "target_type": target_type,
            "timestamp": int(time.time()),
            "payload": payload,
        }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    asyncio.run(ChatServer().start_all())

if __name__ == "__main__":
    main()
