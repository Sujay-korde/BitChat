import asyncio
import json
import pytest
import pytest_asyncio
import websockets
from websockets.asyncio.client import connect
import os
import base64
import struct

from securechat.protocol.types import MessageType, TargetType
from securechat.server.main import ChatServer
from securechat.client.crypto import ChatCrypto

@pytest_asyncio.fixture
async def server():
    srv = ChatServer(port=9996, ws_port=9997)
    task = asyncio.create_task(srv.start_all())
    await asyncio.sleep(0.1)
    yield srv
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

def build_aad(protocol_version: int, msg_type: str, target_type: str, target: str, key_version: int, sender: str, sequence: int) -> bytes:
    # 1 byte version
    aad = bytearray([protocol_version])
    aad += msg_type.encode("utf-8")
    aad += target_type.encode("utf-8")
    aad += target.encode("utf-8")
    # 4 byte big-endian key_version
    aad += struct.pack(">I", key_version)
    aad += sender.encode("utf-8")
    # 8 byte big-endian sequence
    aad += struct.pack(">Q", sequence)
    return bytes(aad)

@pytest.mark.asyncio
async def test_room_crypto_tampering(server: ChatServer):
    alice_crypto = ChatCrypto()
    bob_crypto = ChatCrypto()

    async with connect("ws://127.0.0.1:9997") as ws_alice, \
               connect("ws://127.0.0.1:9997") as ws_bob:
        
        # 1. Auth Alice and Bob
        await ws_alice.send(json.dumps({"type": MessageType.AUTH.value, "msg_id": "a1", "sender": "alice", "target": "server", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": "a"}))
        await ws_alice.recv()
        await ws_bob.send(json.dumps({"type": MessageType.AUTH.value, "msg_id": "b1", "sender": "bob", "target": "server", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": "b"}))
        await ws_bob.recv()

        # 2. Join room
        await ws_alice.send(json.dumps({"type": MessageType.JOIN.value, "msg_id": "a2", "sender": "alice", "target": "room_a", "target_type": TargetType.ROOM.value, "timestamp": 123456, "payload": ""}))
        await ws_bob.send(json.dumps({"type": MessageType.JOIN.value, "msg_id": "b2", "sender": "bob", "target": "room_a", "target_type": TargetType.ROOM.value, "timestamp": 123456, "payload": ""}))

        # 3. Key Exchange (pairwise)
        await ws_alice.send(json.dumps({"type": MessageType.KEY_EXCHANGE.value, "msg_id": "a3", "sender": "alice", "target": "bob", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": alice_crypto.get_key_exchange_payload("alice", "bob")}))
        # Wait for bob to receive presence (from JOINs)
        msg1 = json.loads(await ws_bob.recv())
        if msg1["type"] == MessageType.PRESENCE.value:
            msg1 = json.loads(await ws_bob.recv())
        assert msg1["type"] == MessageType.KEY_EXCHANGE.value
        bob_shared_key = bob_crypto.verify_and_derive_shared_key("alice", "bob", msg1["payload"])

        await ws_bob.send(json.dumps({"type": MessageType.KEY_EXCHANGE.value, "msg_id": "b3", "sender": "bob", "target": "alice", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": bob_crypto.get_key_exchange_payload("bob", "alice")}))
        msg2 = json.loads(await ws_alice.recv())
        if msg2["type"] == MessageType.PRESENCE.value:
            msg2 = json.loads(await ws_alice.recv())
        assert msg2["type"] == MessageType.KEY_EXCHANGE.value
        alice_shared_key = alice_crypto.verify_and_derive_shared_key("bob", "alice", msg2["payload"])

        # 4. Generate and distribute Room Key
        room_key = os.urandom(32)
        room_key_payload = {
            "room_id": "room_a",
            "key_version": 1,
            "room_key": base64.b64encode(room_key).decode("ascii")
        }
        enc_room_key = alice_crypto.encrypt(alice_shared_key, room_key_payload)
        await ws_alice.send(json.dumps({"type": MessageType.ROOM_KEY.value, "msg_id": "a4", "sender": "alice", "target": "bob", "target_type": TargetType.USER.value, "timestamp": 123456, "payload": enc_room_key}))
        
        rk_msg = json.loads(await ws_bob.recv())
        assert rk_msg["type"] == MessageType.ROOM_KEY.value
        dec_room_key_payload = bob_crypto.decrypt(bob_shared_key, rk_msg["payload"])
        assert dec_room_key_payload["room_id"] == "room_a"
        bob_room_key = base64.b64decode(dec_room_key_payload["room_key"])
        assert bob_room_key == room_key

        # 5. Send Room Message
        seq = 1
        aad = build_aad(1, MessageType.MSG.value, TargetType.ROOM.value, "room_a", 1, "alice", seq)
        enc_msg = alice_crypto.encrypt(room_key, {"text": "hello room"}, aad=aad)
        
        msg_payload = {
            "key_version": 1,
            "sequence_number": seq,
            "ciphertext": enc_msg
        }

        await ws_alice.send(json.dumps({"type": MessageType.MSG.value, "msg_id": "a5", "sender": "alice", "target": "room_a", "target_type": TargetType.ROOM.value, "timestamp": 123456, "payload": json.dumps(msg_payload)}))
        await ws_alice.recv() # ACK

        b_msg = json.loads(await ws_bob.recv())
        assert b_msg["type"] == MessageType.MSG.value
        
        # Bob decrypts it
        b_payload = json.loads(b_msg["payload"])
        b_aad = build_aad(1, MessageType.MSG.value, TargetType.ROOM.value, "room_a", 1, "alice", seq)
        dec_text = bob_crypto.decrypt(bob_room_key, b_payload["ciphertext"], aad=b_aad)
        assert dec_text["text"] == "hello room"

        # 6. TAMPERING TEST: Change sender
        # If Bob tries to decrypt it assuming it came from Charlie, the AAD won't match
        b_aad_tampered = build_aad(1, MessageType.MSG.value, TargetType.ROOM.value, "room_a", 1, "charlie", seq)
        with pytest.raises(ValueError, match="Message authentication failed"):
            bob_crypto.decrypt(bob_room_key, b_payload["ciphertext"], aad=b_aad_tampered)

        # 7. TAMPERING TEST: Change room ID
        b_aad_tampered2 = build_aad(1, MessageType.MSG.value, TargetType.ROOM.value, "room_b", 1, "alice", seq)
        with pytest.raises(ValueError, match="Message authentication failed"):
            bob_crypto.decrypt(bob_room_key, b_payload["ciphertext"], aad=b_aad_tampered2)
