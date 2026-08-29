import asyncio
import pytest
import time
import json
from securechat.server.main import ChatServer
from securechat.client.app import SecureChatApp
from securechat.client.transport import TCPTransport
from securechat.client.events import ConnectionState, AppEvent
from securechat.protocol.framing import read_frame, write_frame
from securechat.protocol.types import MessageType, TargetType

import pytest_asyncio

def create_client(username: str, port: int) -> SecureChatApp:
    transport = TCPTransport(port=port)
    return SecureChatApp(username=username, transport=transport)

@pytest_asyncio.fixture
async def test_server():
    server = ChatServer(port=8888)
    task = asyncio.create_task(server.start())
    await asyncio.sleep(0.1) # wait for server to start
    try:
        yield server
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

@pytest.mark.asyncio
async def test_room_broadcast(test_server):
    alice = create_client("alice", 8888)
    bob = create_client("bob", 8888)
    charlie = create_client("charlie", 8888)

    await alice.connect()
    await bob.connect()
    await charlie.connect()
    
    assert alice.transport.reader and alice.transport.writer
    assert bob.transport.reader and bob.transport.writer
    assert charlie.transport.reader and charlie.transport.writer
    
    # Authenticate all (read AUTH_OK)
    for client in (alice, bob, charlie):
        assert client.transport.reader
        await read_frame(client.transport.reader)
    
    # Alice and Bob join room
    await write_frame(alice.transport.writer, alice._message(MessageType.JOIN, "alice", "room_a", TargetType.ROOM, ""))
    await write_frame(bob.transport.writer, bob._message(MessageType.JOIN, "bob", "room_a", TargetType.ROOM, ""))
    await asyncio.sleep(0.1)
    
    # Clear their readers of PRESENCE messages
    for client in (alice, bob, charlie):
        assert client.transport.reader
        while not client.transport.reader.at_eof():
            try:
                msg = await asyncio.wait_for(read_frame(client.transport.reader), timeout=0.1)
            except asyncio.TimeoutError:
                break
    
    # Alice sends a room message
    test_payload = "ciphertext-opaque-payload-from-alice"
    msg_env = alice._message(MessageType.MSG, "alice", "room_a", TargetType.ROOM, test_payload)
    await write_frame(alice.transport.writer, msg_env)
    
    # Alice should get ACK
    ack_frame = await asyncio.wait_for(read_frame(alice.transport.reader), timeout=0.5)
    assert ack_frame["type"] == MessageType.ACK.value
    assert ack_frame["payload"] == msg_env["msg_id"]

    # Bob should get the MSG
    bob_frame = await asyncio.wait_for(read_frame(bob.transport.reader), timeout=0.5)
    assert bob_frame["type"] == MessageType.MSG.value
    assert bob_frame["sender"] == "alice"
    assert bob_frame["payload"] == test_payload
    
    # Charlie should get NOTHING
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(read_frame(charlie.transport.reader), timeout=0.5)

@pytest.mark.asyncio
async def test_direct_messaging(test_server):
    alice = create_client("alice", 8888)
    bob = create_client("bob", 8888)

    await alice.connect()
    await bob.connect()

    assert alice.transport.reader and alice.transport.writer
    assert bob.transport.reader and bob.transport.writer
    
    # AUTH_OK
    await read_frame(alice.transport.reader)
    await read_frame(bob.transport.reader)
    
    # Alice sends DM to Bob
    dm_payload = "secret-dm-ciphertext"
    msg_env = alice._message(MessageType.MSG, "alice", "bob", TargetType.USER, dm_payload)
    await write_frame(alice.transport.writer, msg_env)
    
    # Alice gets ACK
    ack_frame = await asyncio.wait_for(read_frame(alice.transport.reader), timeout=0.5)
    assert ack_frame["type"] == MessageType.ACK.value
    
    # Bob gets DM
    bob_frame = await asyncio.wait_for(read_frame(bob.transport.reader), timeout=0.5)
    assert bob_frame["type"] == MessageType.MSG.value
    assert bob_frame["sender"] == "alice"
    assert bob_frame["payload"] == dm_payload
    
@pytest.mark.asyncio
async def test_protocol_safety(test_server):
    alice = create_client("alice", 8888)
    await alice.connect()
    assert alice.transport.reader and alice.transport.writer
    await read_frame(alice.transport.reader) # AUTH_OK
    
    # Send malformed frame (invalid JSON)
    malformed_json = b"NOT JSON"
    frame_len = len(malformed_json).to_bytes(4, byteorder="big")
    alice.transport.writer.write(frame_len + malformed_json)
    await alice.transport.writer.drain()
    
    # Send invalid type
    invalid_type_msg = alice._message(MessageType.MSG, "alice", "bob", TargetType.USER, "")
    invalid_type_msg["type"] = "NOT_A_REAL_TYPE"
    await write_frame(alice.transport.writer, invalid_type_msg)
    
    # Server should not crash.
    # We should be able to send a valid message afterwards and get an ACK.
    valid_msg = alice._message(MessageType.MSG, "alice", "bob", TargetType.USER, "hello")
    await write_frame(alice.transport.writer, valid_msg)
    
    # Wait for the first ERROR message (from malformed json)
    error_frame1 = await asyncio.wait_for(read_frame(alice.transport.reader), timeout=0.5)
    assert error_frame1["type"] == MessageType.ERROR.value

    # Wait for the second ERROR message (from invalid type)
    error_frame2 = await asyncio.wait_for(read_frame(alice.transport.reader), timeout=0.5)
    assert error_frame2["type"] == MessageType.ERROR.value
    
    # Wait for the ACK from the valid message
    ack_frame = await asyncio.wait_for(read_frame(alice.transport.reader), timeout=0.5)
    assert ack_frame["type"] == MessageType.ACK.value

