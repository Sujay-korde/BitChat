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
