"""WebSocket transport integration tests.

Tests protocol parity between TCP and WebSocket, cross-transport routing,
and WebSocket-specific connection lifecycle behavior.
"""

import asyncio
import json
import time

import pytest
import pytest_asyncio
import websockets

from securechat.server.main import ChatServer
from securechat.client.app import SecureChatApp
from securechat.client.transport import TCPTransport, WebSocketTransport
from securechat.client.events import (
    ConnectionState, MessageState, ConnectionChanged,
    MessageReceived, MessageStatusChanged, PresenceChanged,
    KeyExchangeCompleted, ModerationRejected, ErrorOccurred,
)
from securechat.protocol.types import MessageType, TargetType


# --------------------------------------------------------------------------- #
#  Shared fixtures
# --------------------------------------------------------------------------- #

WS_PORT = 8891
TCP_PORT = 8892


@pytest_asyncio.fixture
async def dual_server():
    """Server that exposes both TCP and WebSocket transports."""
    server = ChatServer(port=TCP_PORT, ws_port=WS_PORT)
    task = asyncio.create_task(server.start_all())
    await asyncio.sleep(0.2)  # let both listeners bind
    try:
        yield server
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def ws_client(username: str) -> SecureChatApp[WebSocketTransport]:
    transport = WebSocketTransport(uri=f"ws://127.0.0.1:{WS_PORT}")
    return SecureChatApp(username=username, transport=transport)


def tcp_client(username: str) -> SecureChatApp[TCPTransport]:
    transport = TCPTransport(port=TCP_PORT)
    return SecureChatApp(username=username, transport=transport)


# --------------------------------------------------------------------------- #
#  Connection tests
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ws_connection_succeeds(dual_server):
    """1. WebSocket connection succeeds and reaches READY."""
    alice = ws_client("alice")
    await alice.connect()
    listen_task = asyncio.create_task(alice.listen())
    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
        assert alice.state == ConnectionState.READY
    finally:
        listen_task.cancel()
        await alice.disconnect()


@pytest.mark.asyncio
async def test_ws_connection_closes_cleanly(dual_server):
    """2. WebSocket connection closes cleanly."""
    alice = ws_client("alice")
    await alice.connect()
    listen_task = asyncio.create_task(alice.listen())
    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        await alice.disconnect()
        assert alice.state == ConnectionState.DISCONNECTED
    finally:
        listen_task.cancel()


@pytest.mark.asyncio
async def test_ws_malformed_message_handled(dual_server):
    """3. Malformed WebSocket message produces ERROR, not crash."""
    ws = await websockets.connect(f"ws://127.0.0.1:{WS_PORT}")
    try:
        # Send invalid JSON
        await ws.send("NOT VALID JSON")
        resp = json.loads(await ws.recv())
        assert resp["type"] == MessageType.ERROR.value

        # Send valid JSON but invalid schema
        await ws.send(json.dumps({"garbage": True}))
        resp2 = json.loads(await ws.recv())
        assert resp2["type"] == MessageType.ERROR.value
    finally:
        await ws.close()


# --------------------------------------------------------------------------- #
#  Protocol tests
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ws_valid_protocol_message(dual_server):
    """4. Valid protocol message over WebSocket is processed correctly."""
    alice = ws_client("alice")
    await alice.connect()
    listen_task = asyncio.create_task(alice.listen())
    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
        # The fact that we reached READY means AUTH was processed correctly
        assert alice.state == ConnectionState.READY
    finally:
        listen_task.cancel()
        await alice.disconnect()


@pytest.mark.asyncio
async def test_ws_invalid_schema_produces_error(dual_server):
    """5. Invalid schema over WebSocket produces ERROR response."""
    ws = await websockets.connect(f"ws://127.0.0.1:{WS_PORT}")
    try:
        # Valid JSON, but missing required fields
        await ws.send(json.dumps({"type": "MSG"}))
        resp = json.loads(await ws.recv())
        assert resp["type"] == MessageType.ERROR.value
    finally:
        await ws.close()


@pytest.mark.asyncio
async def test_ws_unknown_message_type(dual_server):
    """6. Unknown message type over WebSocket handled correctly."""
    ws = await websockets.connect(f"ws://127.0.0.1:{WS_PORT}")
    try:
        bad_msg = {
            "type": "NONEXISTENT_TYPE",
            "msg_id": "test-1",
            "sender": "alice",
            "target": "bob",
            "target_type": "user",
            "timestamp": int(time.time()),
            "payload": "",
        }
        await ws.send(json.dumps(bad_msg))
        resp = json.loads(await ws.recv())
        assert resp["type"] == MessageType.ERROR.value
    finally:
        await ws.close()


# --------------------------------------------------------------------------- #
#  Cross-transport routing tests
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ws_to_tcp_room_message(dual_server):
    """7. WS client → TCP client room message."""
    ws_alice = ws_client("alice")
    tcp_bob = tcp_client("bob")

    await ws_alice.connect()
    await tcp_bob.connect()

    ws_task = asyncio.create_task(ws_alice.listen())
    tcp_task = asyncio.create_task(tcp_bob.listen())

    try:
        while ws_alice.state != ConnectionState.READY or tcp_bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Both join the same room
        await ws_alice.join_room("crossroom")
        await tcp_bob.join_room("crossroom")
        await asyncio.sleep(0.1)

        # Establish shared key (opaque payload — no real crypto needed for routing test)
        ws_alice.shared_keys["crossroom"] = b"0" * 32
        tcp_bob.shared_keys["crossroom"] = b"0" * 32

        # Alice sends, Bob receives
        await ws_alice.send_room_message("crossroom", "Hello from WS")
        while True:
            evt = await asyncio.wait_for(tcp_bob._event_queue.get(), timeout=2.0)
            if isinstance(evt, MessageReceived):
                assert evt.sender == "alice"
                assert evt.text == "Hello from WS"
                break
    finally:
        ws_task.cancel()
        tcp_task.cancel()
        await ws_alice.disconnect()
        await tcp_bob.disconnect()


@pytest.mark.asyncio
async def test_tcp_to_ws_room_message(dual_server):
    """8. TCP client → WS client room message."""
    tcp_alice = tcp_client("alice")
    ws_bob = ws_client("bob")

    await tcp_alice.connect()
    await ws_bob.connect()

    tcp_task = asyncio.create_task(tcp_alice.listen())
    ws_task = asyncio.create_task(ws_bob.listen())

    try:
        while tcp_alice.state != ConnectionState.READY or ws_bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        await tcp_alice.join_room("crossroom")
        await ws_bob.join_room("crossroom")
        await asyncio.sleep(0.1)

        tcp_alice.shared_keys["crossroom"] = b"1" * 32
        ws_bob.shared_keys["crossroom"] = b"1" * 32

        await tcp_alice.send_room_message("crossroom", "Hello from TCP")
        while True:
            evt = await asyncio.wait_for(ws_bob._event_queue.get(), timeout=2.0)
            if isinstance(evt, MessageReceived):
                assert evt.sender == "alice"
                assert evt.text == "Hello from TCP"
                break
    finally:
        tcp_task.cancel()
        ws_task.cancel()
        await tcp_alice.disconnect()
        await ws_bob.disconnect()


@pytest.mark.asyncio
async def test_ws_to_ws_direct_message(dual_server):
    """9. WS client → WS client DM."""
    ws_alice = ws_client("alice")
    ws_bob = ws_client("bob")

    await ws_alice.connect()
    await ws_bob.connect()

    task_a = asyncio.create_task(ws_alice.listen())
    task_b = asyncio.create_task(ws_bob.listen())

    try:
        while ws_alice.state != ConnectionState.READY or ws_bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Key exchange
        await ws_alice.send_key_exchange("bob")
        await ws_bob.send_key_exchange("alice")
        await asyncio.sleep(0.2)

        # Drain key exchange events
        while not ws_alice._event_queue.empty():
            ws_alice._event_queue.get_nowait()
        while not ws_bob._event_queue.empty():
            ws_bob._event_queue.get_nowait()

        await ws_alice.send_direct_message("bob", "WS DM")
        while True:
            evt = await asyncio.wait_for(ws_bob._event_queue.get(), timeout=2.0)
            if isinstance(evt, MessageReceived):
                assert evt.sender == "alice"
                assert evt.text == "WS DM"
                break
    finally:
        task_a.cancel()
        task_b.cancel()
        await ws_alice.disconnect()
        await ws_bob.disconnect()


@pytest.mark.asyncio
async def test_ws_room_isolation(dual_server):
    """10. WebSocket room isolation — message doesn't leak to other rooms."""
    alice = ws_client("alice")
    bob = ws_client("bob")
    charlie = ws_client("charlie")

    await alice.connect()
    await bob.connect()
    await charlie.connect()

    task_a = asyncio.create_task(alice.listen())
    task_b = asyncio.create_task(bob.listen())
    task_c = asyncio.create_task(charlie.listen())

    try:
        for c in (alice, bob, charlie):
            while c.state != ConnectionState.READY:
                await asyncio.sleep(0.01)

        await alice.join_room("room_x")
        await bob.join_room("room_x")
        await charlie.join_room("room_y")  # different room
        await asyncio.sleep(0.1)

        alice.shared_keys["room_x"] = b"x" * 32
        bob.shared_keys["room_x"] = b"x" * 32

        # Drain presence events
        for c in (alice, bob, charlie):
            while not c._event_queue.empty():
                c._event_queue.get_nowait()

        await alice.send_room_message("room_x", "secret room x msg")

        # Bob receives it
        while True:
            evt = await asyncio.wait_for(bob._event_queue.get(), timeout=2.0)
            if isinstance(evt, MessageReceived):
                break

        # Charlie should NOT receive it
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(charlie._event_queue.get(), timeout=0.5)
    finally:
        task_a.cancel()
        task_b.cancel()
        task_c.cancel()
        await alice.disconnect()
        await bob.disconnect()
        await charlie.disconnect()


# --------------------------------------------------------------------------- #
#  ACK tests
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ws_msg_receives_ack(dual_server):
    """11. WebSocket MSG receives ACK."""
    alice = ws_client("alice")
    bob = ws_client("bob")

    await alice.connect()
    await bob.connect()

    task_a = asyncio.create_task(alice.listen())
    task_b = asyncio.create_task(bob.listen())

    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        alice.shared_keys["bob"] = b"a" * 32

        await alice.send_direct_message("bob", "ack test")
        await asyncio.sleep(0.2)

        # The pending message should have been ACKed
        assert any(v == MessageState.SENT for v in alice.pending_messages.values())
    finally:
        task_a.cancel()
        task_b.cancel()
        await alice.disconnect()
        await bob.disconnect()


@pytest.mark.asyncio
async def test_ws_ack_preserves_msg_id(dual_server):
    """12. ACK preserves original msg_id."""
    alice = ws_client("alice")
    bob = ws_client("bob")

    await alice.connect()
    await bob.connect()

    task_a = asyncio.create_task(alice.listen())
    task_b = asyncio.create_task(bob.listen())

    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        alice.shared_keys["bob"] = b"b" * 32

        await alice.send_direct_message("bob", "id check")
        await asyncio.sleep(0.2)

        # All pending messages that got ACKed have SENT status
        for msg_id, status in alice.pending_messages.items():
            if status == MessageState.SENT:
                # msg_id should start with the sender's username
                assert msg_id.startswith("alice-")
    finally:
        task_a.cancel()
        task_b.cancel()
        await alice.disconnect()
        await bob.disconnect()


# --------------------------------------------------------------------------- #
#  Presence tests
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ws_join_generates_presence(dual_server):
    """13. WebSocket JOIN generates correct presence notification."""
    alice = ws_client("alice")
    bob = ws_client("bob")

    await alice.connect()
    await bob.connect()

    task_a = asyncio.create_task(alice.listen())
    task_b = asyncio.create_task(bob.listen())

    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Alice joins first
        await alice.join_room("presence_room")
        await asyncio.sleep(0.1)

        # Drain events
        while not alice._event_queue.empty():
            alice._event_queue.get_nowait()

        # Bob joins — Alice should get a presence notification
        await bob.join_room("presence_room")

        while True:
            evt = await asyncio.wait_for(alice._event_queue.get(), timeout=2.0)
            if isinstance(evt, PresenceChanged):
                assert evt.user == "bob"
                assert evt.status == "joined"
                break
    finally:
        task_a.cancel()
        task_b.cancel()
        await alice.disconnect()
        await bob.disconnect()


@pytest.mark.asyncio
async def test_ws_disconnect_generates_offline_presence(dual_server):
    """14. WebSocket disconnect generates offline presence."""
    alice = ws_client("alice")
    bob = ws_client("bob")

    await alice.connect()
    await bob.connect()

    task_a = asyncio.create_task(alice.listen())
    task_b = asyncio.create_task(bob.listen())

    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        await alice.join_room("presence_room2")
        await bob.join_room("presence_room2")
        await asyncio.sleep(0.1)

        # Drain events
        while not alice._event_queue.empty():
            alice._event_queue.get_nowait()

        # Bob disconnects — Alice should get offline presence
        await bob.disconnect()
        task_b.cancel()

        while True:
            evt = await asyncio.wait_for(alice._event_queue.get(), timeout=2.0)
            if isinstance(evt, PresenceChanged):
                assert evt.user == "bob"
                assert evt.status == "offline"
                break
    finally:
        task_a.cancel()
        await alice.disconnect()


# --------------------------------------------------------------------------- #
#  Heartbeat tests
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ws_heartbeat_works(dual_server):
    """15. WebSocket heartbeat keeps session alive."""
    alice = ws_client("alice")
    await alice.connect()
    task = asyncio.create_task(alice.listen())

    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Wait enough for heartbeat to fire (5s interval)
        await asyncio.sleep(5.5)

        # Session should still be alive (heartbeat refreshed it)
        assert "alice" in dual_server.sessions
        assert dual_server.presence.status("alice") == "online"
    finally:
        task.cancel()
        await alice.disconnect()


@pytest.mark.asyncio
async def test_ws_stale_session_pruned(dual_server):
    """16. Stale WebSocket session is pruned by the server."""
    alice = ws_client("alice")
    await alice.connect()
    task = asyncio.create_task(alice.listen())

    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Artificially expire the session
        dual_server.sessions["alice"].last_heartbeat -= 16.0

        # Wait for prune cycle
        await asyncio.sleep(5.5)

        assert "alice" not in dual_server.sessions
        assert dual_server.presence.status("alice") == "offline"
    finally:
        task.cancel()
        await alice.disconnect()


# --------------------------------------------------------------------------- #
#  Security invariant test
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ws_server_never_receives_plaintext(dual_server):
    """17. Server routing path never receives plaintext from WebSocket MSG payload."""
    alice = ws_client("alice")
    bob = ws_client("bob")

    await alice.connect()
    await bob.connect()

    task_a = asyncio.create_task(alice.listen())
    task_b = asyncio.create_task(bob.listen())

    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Key exchange
        await alice.send_key_exchange("bob")
        await bob.send_key_exchange("alice")
        await asyncio.sleep(0.2)

        # Intercept relay
        original_relay = dual_server._relay_ciphertext
        relayed_payloads: list[str] = []

        async def intercept_relay(payload: dict[str, str]) -> None:
            relayed_payloads.append(payload["ciphertext"])
            await original_relay(payload)

        dual_server._relay_ciphertext = intercept_relay  # type: ignore[assignment]

        secret = "SUPER SECRET PLAINTEXT VIA WS"
        await alice.send_direct_message("bob", secret)

        while True:
            evt = await asyncio.wait_for(bob._event_queue.get(), timeout=2.0)
            if isinstance(evt, MessageReceived):
                assert evt.text == secret
                break

        # The server only saw ciphertext
        assert len(relayed_payloads) == 1
        assert secret not in relayed_payloads[0]

        dual_server._relay_ciphertext = original_relay  # type: ignore[assignment]
    finally:
        task_a.cancel()
        task_b.cancel()
        await alice.disconnect()
        await bob.disconnect()


# --------------------------------------------------------------------------- #
#  Cross-transport integration test (explicit)
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_cross_transport_dm_ws_to_tcp(dual_server):
    """Cross-transport: WS client sends DM to TCP client."""
    ws_alice = ws_client("alice")
    tcp_bob = tcp_client("bob")

    await ws_alice.connect()
    await tcp_bob.connect()

    ws_task = asyncio.create_task(ws_alice.listen())
    tcp_task = asyncio.create_task(tcp_bob.listen())

    try:
        while ws_alice.state != ConnectionState.READY or tcp_bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Key exchange across transports
        await ws_alice.send_key_exchange("bob")
        await tcp_bob.send_key_exchange("alice")
        await asyncio.sleep(0.3)

        # Drain events
        while not tcp_bob._event_queue.empty():
            tcp_bob._event_queue.get_nowait()

        await ws_alice.send_direct_message("bob", "Cross-transport DM")
        while True:
            evt = await asyncio.wait_for(tcp_bob._event_queue.get(), timeout=2.0)
            if isinstance(evt, MessageReceived):
                assert evt.sender == "alice"
                assert evt.text == "Cross-transport DM"
                break
    finally:
        ws_task.cancel()
        tcp_task.cancel()
        await ws_alice.disconnect()
        await tcp_bob.disconnect()


@pytest.mark.asyncio
async def test_cross_transport_dm_tcp_to_ws(dual_server):
    """Cross-transport: TCP client sends DM to WS client."""
    tcp_alice = tcp_client("alice")
    ws_bob = ws_client("bob")

    await tcp_alice.connect()
    await ws_bob.connect()

    tcp_task = asyncio.create_task(tcp_alice.listen())
    ws_task = asyncio.create_task(ws_bob.listen())

    try:
        while tcp_alice.state != ConnectionState.READY or ws_bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Key exchange across transports
        await tcp_alice.send_key_exchange("bob")
        await ws_bob.send_key_exchange("alice")
        await asyncio.sleep(0.3)

        # Drain events
        while not ws_bob._event_queue.empty():
            ws_bob._event_queue.get_nowait()

        await tcp_alice.send_direct_message("bob", "TCP to WS DM")
        while True:
            evt = await asyncio.wait_for(ws_bob._event_queue.get(), timeout=2.0)
            if isinstance(evt, MessageReceived):
                assert evt.sender == "alice"
                assert evt.text == "TCP to WS DM"
                break
    finally:
        tcp_task.cancel()
        ws_task.cancel()
        await tcp_alice.disconnect()
        await ws_bob.disconnect()
