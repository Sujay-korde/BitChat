from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

import websockets
from websockets.asyncio.server import ServerConnection

from securechat.protocol.framing import FrameError, read_frame, write_frame
from securechat.protocol.schema import SchemaError, validate_message_envelope
from securechat.protocol.types import MessageType, TargetType
from .media import MediaBlobServer
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
    media_port: int = 8767
    router: MessageRouter = field(default_factory=MessageRouter)
    rooms: RoomManager = field(default_factory=RoomManager)
    presence: PresenceManager = field(default_factory=PresenceManager)
    sessions: dict[str, ChatSession] = field(default_factory=dict)
    message_queue: dict[str, list[dict[str, object]]] = field(default_factory=dict)
    registered_identities: dict[str, str] = field(default_factory=dict)
    room_message_history: dict[str, list[dict[str, object]]] = field(default_factory=dict)
    media_server: MediaBlobServer | None = None
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
        """Start TCP, WebSocket, and Media Blob servers concurrently."""
        self._prune_task = asyncio.create_task(self._prune_dead_sessions())
        media_p = self.media_port
        if self.media_port == 8767 and (self.port != 8765 or self.ws_port != 8766):
            media_p = max(self.port, self.ws_port) + 1
        self.media_server = MediaBlobServer(host=self.host, port=media_p)
        await self.media_server.start()
        try:
            tcp_server = await asyncio.start_server(self._handle_tcp_client, self.host, self.port)
            logger.info("TCP server listening on %s:%d", self.host, self.port)

            ws_server = await websockets.serve(
                self._handle_ws_client,
                self.host,
                self.ws_port,
            )
            logger.info("WebSocket server listening on %s:%d", self.host, self.ws_port)

            async with tcp_server, ws_server:
                await asyncio.gather(
                    tcp_server.serve_forever(),
                    ws_server.wait_closed(),
                )
        finally:
            if self.media_server:
                await self.media_server.stop()
            if self._prune_task:
                self._prune_task.cancel()

    async def start_cloud(self, public_port: int) -> None:
        """Start servers with an asynchronous multiplexer on public_port (for Railway/Render)."""
        self._prune_task = asyncio.create_task(self._prune_dead_sessions())
        
        internal_ws_port = 8766
        internal_media_port = 8767
        
        self.media_server = MediaBlobServer(host="127.0.0.1", port=internal_media_port)
        await self.media_server.start()
        
        ws_server = await websockets.serve(
            self._handle_ws_client,
            "127.0.0.1",
            internal_ws_port,
        )
        logger.info("Internal WebSocket server listening on 127.0.0.1:%d", internal_ws_port)
        
        async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, initial: bytes = b"") -> None:
            if initial:
                writer.write(initial)
                await writer.drain()
            try:
                while not reader.at_eof():
                    chunk = await reader.read(65536)
                    if not chunk:
                        break
                    writer.write(chunk)
                    await writer.drain()
            except Exception:
                pass
            finally:
                try:
                    writer.close()
                except Exception:
                    pass

        async def mux_handler(client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter) -> None:
            try:
                peek = await client_reader.read(4096)
                if not peek:
                    client_writer.close()
                    return

                # Health check endpoint for cloud platforms
                if peek.startswith(b"GET /health") or peek.startswith(b"GET /healthz"):
                    resp = (
                        b"HTTP/1.1 200 OK\r\n"
                        b"Content-Type: application/json\r\n"
                        b"Connection: close\r\n\r\n"
                        b'{"status":"healthy","service":"bitchat"}\n'
                    )
                    client_writer.write(resp)
                    await client_writer.drain()
                    client_writer.close()
                    return

                # Route media endpoints to media server
                if b"/api/media" in peek or (peek.startswith(b"POST") and b"/api/" in peek):
                    target_port = internal_media_port
                else:
                    target_port = internal_ws_port

                t_reader, t_writer = await asyncio.open_connection("127.0.0.1", target_port)
                asyncio.create_task(pipe(client_reader, t_writer, peek))
                asyncio.create_task(pipe(t_reader, client_writer))
            except Exception as e:
                logger.error("Mux error: %s", e)
                client_writer.close()

        mux_server = await asyncio.start_server(mux_handler, "0.0.0.0", public_port)
        logger.info("Cloud multiplexer server listening on 0.0.0.0:%d (routing to WS:%d, Media:%d)", public_port, internal_ws_port, internal_media_port)

        try:
            async with mux_server:
                await asyncio.gather(
                    mux_server.serve_forever(),
                    ws_server.wait_closed(),
                )
        finally:
            if self.media_server:
                await self.media_server.stop()
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

    MAX_OFFLINE_QUEUE_PER_USER: int = 100

    def _enqueue_offline_message(self, target: str, message: dict[str, object]) -> None:
        queue = self.message_queue.setdefault(target, [])
        if len(queue) >= self.MAX_OFFLINE_QUEUE_PER_USER:
            queue.pop(0)  # Drop oldest message to bound memory usage
        queue.append(message)

    async def _cleanup_session(self, username: str, writer: Any = None) -> None:
        if username not in self.sessions:
            return

        session = self.sessions[username]
        if writer is not None and session.writer is not writer:
            return  # The session has been replaced by a newer connection! Do not clean up the new one.

        session = self.sessions.pop(username)
        self.presence.set_offline(username)
        await self._broadcast_global_presence(username, "offline")

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
                    if "Frame too large" in str(exc):
                        break  # An oversized payload was not read, leaving the TCP stream unaligned
                    continue

                result = await self._process_action(action, tcp_send, username, writer)
                if result is not None:
                    username = result
        except (asyncio.IncompleteReadError, ConnectionResetError, OSError):
            pass
        finally:
            if username:
                await self._cleanup_session(username, writer)
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
                if len(raw_text) > 1024 * 1024:
                    await ws_send(self._response(MessageType.ERROR, "server", username or "anonymous", "user", "Frame too large: maximum size is 1MB"))
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
                await self._cleanup_session(username, websocket)

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

            # Cryptographic signature verification if provided
            identity_key = action.payload.get("identity_key")
            signature = action.payload.get("signature")
            timestamp_str = action.payload.get("timestamp")

            if identity_key and signature:
                from securechat.client.crypto import ChatCrypto
                ts = int(timestamp_str) if timestamp_str else int(time.time())
                is_valid = ChatCrypto.verify_auth_signature(new_username, ts, identity_key, signature)
                if not is_valid:
                    logger.warning("AUTH_FAIL: Invalid cryptographic signature for %s", new_username)
                    await send_fn(self._response(MessageType.AUTH_FAIL, "server", new_username, "user", "Invalid authentication signature"))
                    return None

                # Enforce identity binding per username to prevent account takeover
                if new_username in self.registered_identities:
                    if self.registered_identities[new_username] != identity_key:
                        logger.warning("AUTH_FAIL: Identity key mismatch for %s", new_username)
                        await send_fn(self._response(MessageType.AUTH_FAIL, "server", new_username, "user", "Identity key does not match registered owner"))
                        return None
                else:
                    self.registered_identities[new_username] = identity_key

            if new_username in self.sessions:
                old_session = self.sessions[new_username]
                if old_session.writer is not writer:
                    try:
                        if hasattr(old_session.writer, "close"):
                            res = old_session.writer.close()
                            if asyncio.iscoroutine(res):
                                await res
                    except Exception:
                        pass

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
            
            if new_username in self.message_queue:
                for msg in self.message_queue[new_username]:
                    try:
                        await send_fn(msg)
                    except Exception as e:
                        logger.error("Failed to deliver offline message to %s: %s", new_username, e)
                del self.message_queue[new_username]
                
            return new_username

        if username is None:
            await send_fn(self._response(MessageType.AUTH_FAIL, "server", "anonymous", "user", "authenticate first"))
            return None

        # Enforce sender authenticity: an authenticated client cannot forge another sender
        if hasattr(action, "payload") and isinstance(action.payload, dict):
            if "sender" in action.payload:
                action.payload["sender"] = username
            if "username" in action.payload:
                action.payload["username"] = username

        session = self.sessions.setdefault(
            username,
            ChatSession(username=username, writer=writer, send_fn=send_fn, is_authenticated=True),
        )
        session.last_heartbeat = time.time()

        if action.kind in ("message", "key_exchange", "room_key") and not session.consume_token():
            logger.warning("Rate limit exceeded for %s", username)
            await send_fn(self._response(MessageType.ERROR, "server", username, "user", "Rate limit exceeded. Please slow down."))
            return None

        if action.kind == "join":
            room = action.payload["room"].strip().lstrip("#@").lower()
            self.rooms.join(room, username)
            session.rooms.add(room)
            logger.info("JOIN: %s -> %s", username, room)
            await self._broadcast_presence(room, username, "joined")
            for past_msg in self.room_message_history.get(room, []):
                if past_msg.get("sender") != username:
                    await self._safe_send(session, past_msg)

        elif action.kind == "leave":
            room = action.payload["room"].strip().lstrip("#@").lower()
            self.rooms.leave(room, username)
            session.rooms.discard(room)
            logger.info("LEAVE: %s -> %s", username, room)
            await self._broadcast_presence(room, username, "left")

        elif action.kind == "presence":
            status = action.payload.get("status", "online")
            if status == "query":
                for other_user in list(self.sessions.keys()):
                    if other_user != username:
                        await self._safe_send(session, self._response(MessageType.PRESENCE, "server", "global", TargetType.USER.value, f"{other_user}:online"))
            else:
                if status in ("offline", "left"):
                    self.presence.set_offline(username)
                else:
                    self.presence.set_online(username)
                await self._broadcast_global_presence(username, status)

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

    async def _safe_send(self, session: ChatSession, message: dict[str, object], timeout: float = 2.0) -> None:
        try:
            await asyncio.wait_for(session.send_fn(message), timeout=timeout)
        except Exception:
            pass

    async def _broadcast_presence(self, room: str, username: str, event: str) -> None:
        message = self._response(MessageType.PRESENCE, "server", room, TargetType.ROOM.value, f"{username}:{event}")
        send_tasks = [
            self._safe_send(self.sessions[member], message)
            for member in self.rooms.members(room)
            if member != username and member in self.sessions
        ]
        if send_tasks:
            await asyncio.gather(*send_tasks, return_exceptions=True)

    async def _broadcast_global_presence(self, username: str, status: str) -> None:
        message = self._response(MessageType.PRESENCE, "server", "global", TargetType.USER.value, f"{username}:{status}")
        send_tasks = [
            self._safe_send(session, message)
            for user, session in list(self.sessions.items())
            if user != username
        ]
        if send_tasks:
            await asyncio.gather(*send_tasks, return_exceptions=True)

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
        else:
            message = self._response(MessageType.KEY_EXCHANGE, sender, target, TargetType.USER.value, payload["payload"])
            self._enqueue_offline_message(target, message)

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
        else:
            message = self._response(MessageType.ROOM_KEY, sender, target, TargetType.USER.value, payload["payload"])
            self._enqueue_offline_message(target, message)

    async def _relay_ciphertext(self, payload: dict[str, str]) -> None:
        target = payload["target"]
        target_type = payload["target_type"]
        sender = payload["sender"]
        msg_id = payload.get("msg_id", "server-response")

        message = {
            "type": MessageType.MSG.value,
            "msg_id": msg_id,
            "sender": sender,
            "target": target,
            "target_type": target_type,
            "timestamp": int(time.time()),
            "payload": payload["ciphertext"],
        }

        if target_type == TargetType.ROOM.value:
            norm_target = target.strip().lstrip("#@").lower()
            message["target"] = norm_target
            history = self.room_message_history.setdefault(norm_target, [])
            if len(history) >= 50:
                history.pop(0)
            history.append(message)

            send_tasks = [
                self._safe_send(self.sessions[member], message)
                for member in self.rooms.members(norm_target)
                if member != sender and member in self.sessions
            ]
            if send_tasks:
                await asyncio.gather(*send_tasks, return_exceptions=True)
        elif target_type == TargetType.USER.value:
            if target in self.sessions:
                await self._safe_send(self.sessions[target], message)
            else:
                self._enqueue_offline_message(target, message)

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
    
    port_env = os.environ.get("PORT")
    if port_env:
        public_port = int(port_env)
        logger.info("PORT environment variable detected (%d) - starting cloud multiplexer", public_port)
        server = ChatServer()
        asyncio.run(server.start_cloud(public_port))
    else:
        logger.info("Starting local standalone servers (TCP: 8765, WS: 8766, Media: 8767)")
        server = ChatServer()
        asyncio.run(server.start_all())

if __name__ == "__main__":
    main()
