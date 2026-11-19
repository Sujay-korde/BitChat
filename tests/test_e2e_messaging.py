import asyncio
import json
import pytest
import pytest_asyncio
import websockets
from websockets.asyncio.client import connect

from securechat.protocol.types import MessageType, TargetType
from securechat.server.main import ChatServer

@pytest_asyncio.fixture
async def server():
    srv = ChatServer(port=9998, ws_port=9999)
    # Start both explicitly to test cross-transport
    task = asyncio.create_task(srv.start_all())
    await asyncio.sleep(0.1)
    yield srv
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

@pytest.mark.asyncio
async def test_cross_transport_messaging(server: ChatServer):
    """
    Test that Alice (WebSocket) and Bob (TCP, mocked as another WS for ease of test, 
    since we already tested TCP <-> WS in other tests) can exchange messages.
    We'll just use two WS clients to test the MSG -> ACK flow and KEY_EXCHANGE.
    """
    async with connect("ws://127.0.0.1:9999") as ws_alice, \
               connect("ws://127.0.0.1:9999") as ws_bob:
        
        # 1. Auth Alice
        await ws_alice.send(json.dumps({
            "type": MessageType.AUTH.value,
            "msg_id": "a1",
            "sender": "alice",
            "target": "server",
            "target_type": TargetType.USER.value,
            "timestamp": 123456,
            "payload": "auth-payload"
        }))
        resp = json.loads(await ws_alice.recv())
        assert resp["type"] == MessageType.AUTH_OK.value

        # 2. Auth Bob
        await ws_bob.send(json.dumps({
            "type": MessageType.AUTH.value,
            "msg_id": "b1",
            "sender": "bob",
            "target": "server",
            "target_type": TargetType.USER.value,
            "timestamp": 123456,
            "payload": "auth-payload"
        }))
        resp = json.loads(await ws_bob.recv())
        assert resp["type"] == MessageType.AUTH_OK.value

        # 3. Alice sends KEY_EXCHANGE to Bob
        await ws_alice.send(json.dumps({
            "type": MessageType.KEY_EXCHANGE.value,
            "msg_id": "a2",
            "sender": "alice",
            "target": "bob",
            "target_type": TargetType.USER.value,
            "timestamp": 123456,
            "payload": "alice-pub-key"
        }))
        
        # Bob should receive KEY_EXCHANGE
        resp = json.loads(await ws_bob.recv())
        assert resp["type"] == MessageType.KEY_EXCHANGE.value
        assert resp["sender"] == "alice"
        assert resp["payload"] == "alice-pub-key"

        # 4. Alice sends MSG to Bob
        await ws_alice.send(json.dumps({
            "type": MessageType.MSG.value,
            "msg_id": "a3",
            "sender": "alice",
            "target": "bob",
            "target_type": TargetType.USER.value,
            "timestamp": 123456,
            "payload": "ciphertext-data"
        }))

        # Alice should get ACK from server
        resp = json.loads(await ws_alice.recv())
        assert resp["type"] == MessageType.ACK.value
        assert resp["payload"] == "a3"

        # Bob should receive MSG
        resp = json.loads(await ws_bob.recv())
        assert resp["type"] == MessageType.MSG.value
        assert resp["sender"] == "alice"
        assert resp["payload"] == "ciphertext-data"

@pytest.mark.asyncio
async def test_group_chat_multiuser_e2e(server: ChatServer):
    """
    Verify multi-user group chat:
    1. Alice joins '#dev' and Bob joins 'dev' (verifying '#dev' and 'dev' join the exact same room).
    2. Alice sends a message to '#dev'.
    3. Bob receives Alice's message in 'dev'.
    4. Bob replies to 'dev', and Alice receives Bob's message.
    5. Charlie joins 'dev' later and receives the recent room history!
    """
    async with connect("ws://127.0.0.1:9999") as ws_alice, \
               connect("ws://127.0.0.1:9999") as ws_bob:
        
        # 1. Auth Alice and Bob
        await ws_alice.send(json.dumps({"type": MessageType.AUTH.value, "msg_id": "a-auth", "sender": "alice", "target": "server", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": "auth"}))
        assert (json.loads(await ws_alice.recv()))["type"] == MessageType.AUTH_OK.value

        await ws_bob.send(json.dumps({"type": MessageType.AUTH.value, "msg_id": "b-auth", "sender": "bob", "target": "server", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": "auth"}))
        assert (json.loads(await ws_bob.recv()))["type"] == MessageType.AUTH_OK.value

        # 2. Alice joins "#dev" and Bob joins "dev"
        await ws_alice.send(json.dumps({"type": MessageType.JOIN.value, "msg_id": "a-join", "sender": "alice", "target": "#dev", "target_type": TargetType.ROOM.value, "timestamp": 123456, "payload": ""}))
        await ws_bob.send(json.dumps({"type": MessageType.JOIN.value, "msg_id": "b-join", "sender": "bob", "target": "dev", "target_type": TargetType.ROOM.value, "timestamp": 123456, "payload": ""}))

        # Alice gets Bob's joined presence
        presence_msg = json.loads(await ws_alice.recv())
        assert presence_msg["type"] == MessageType.PRESENCE.value
        assert "bob" in presence_msg["payload"]

        # 3. Alice sends a group message to '#dev'
        alice_text = "Hello dev team from Alice"
        await ws_alice.send(json.dumps({
            "type": MessageType.MSG.value,
            "msg_id": "a-msg-1",
            "sender": "alice",
            "target": "#dev",
            "target_type": TargetType.ROOM.value,
            "timestamp": 123456,
            "payload": alice_text
        }))
        ack = json.loads(await ws_alice.recv())
        assert ack["type"] == MessageType.ACK.value

        # Bob receives Alice's message in room 'dev'
        bob_recvd = json.loads(await ws_bob.recv())
        assert bob_recvd["type"] == MessageType.MSG.value
        assert bob_recvd["sender"] == "alice"
        assert bob_recvd["target"] == "dev"
        assert bob_recvd["payload"] == alice_text

        # 4. Bob replies in 'dev'
        bob_text = "Hey Alice, Bob here in dev"
        await ws_bob.send(json.dumps({
            "type": MessageType.MSG.value,
            "msg_id": "b-msg-1",
            "sender": "bob",
            "target": "dev",
            "target_type": TargetType.ROOM.value,
            "timestamp": 123456,
            "payload": bob_text
        }))
        ack = json.loads(await ws_bob.recv())
        assert ack["type"] == MessageType.ACK.value

        # Alice receives Bob's message in room 'dev'
        alice_recvd = json.loads(await ws_alice.recv())
        assert alice_recvd["type"] == MessageType.MSG.value
        assert alice_recvd["sender"] == "bob"
        assert alice_recvd["target"] == "dev"
        assert alice_recvd["payload"] == bob_text

    # 5. Charlie connects and joins 'dev' later -> gets past history!
    async with connect("ws://127.0.0.1:9999") as ws_charlie:
        await ws_charlie.send(json.dumps({"type": MessageType.AUTH.value, "msg_id": "c-auth", "sender": "charlie", "target": "server", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": "auth"}))
        assert (json.loads(await ws_charlie.recv()))["type"] == MessageType.AUTH_OK.value

        await ws_charlie.send(json.dumps({"type": MessageType.JOIN.value, "msg_id": "c-join", "sender": "charlie", "target": "dev", "target_type": TargetType.ROOM.value, "timestamp": 123456, "payload": ""}))

        # Charlie receives Alice's message and Bob's message from history
        h1 = json.loads(await ws_charlie.recv())
        h2 = json.loads(await ws_charlie.recv())
        assert h1["sender"] == "alice" and h1["payload"] == alice_text
        assert h2["sender"] == "bob" and h2["payload"] == bob_text
