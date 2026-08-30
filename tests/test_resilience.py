import asyncio
import pytest
import pytest_asyncio
import time
from unittest.mock import patch

from securechat.server.main import ChatServer
from securechat.client.app import SecureChatApp
from securechat.client.transport import TCPTransport
from securechat.client.events import ConnectionState, MessageState, MessageReceived

def create_client(username: str, port: int, reconnect_delays=(1, 2, 4)) -> SecureChatApp:
    transport = TCPTransport(port=port)
    return SecureChatApp(username=username, transport=transport, reconnect_delays=reconnect_delays)

@pytest_asyncio.fixture
async def test_server():
    server = ChatServer(port=8890)
    task = asyncio.create_task(server.start())
    await asyncio.sleep(0.1) # Wait for server
    try:
        yield server
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

@pytest.mark.asyncio
async def test_heartbeat_and_timeout(test_server):
    alice = create_client("alice", 8890)
    await alice.connect()
    
    alice_listen_task = asyncio.create_task(alice.listen())
    try:
        # Wait for READY
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        assert test_server.presence.status("alice") == "online"
        
        # Disable client heartbeat so it doesn't reset our artificial timeout
        if alice._heartbeat_task:
            alice._heartbeat_task.cancel()
        
        # We manually advance the clock for the server session or just change last_heartbeat
        session = test_server.sessions["alice"]
        session.last_heartbeat -= 16.0
        
        # Wait for prune task to kick in
        await asyncio.sleep(5.1)
        
        # Timeout triggers cleanup
        assert "alice" not in test_server.sessions
        assert test_server.presence.status("alice") == "offline"
        
        # Alice's client should detect the disconnect
        await asyncio.sleep(0.1)
        assert alice.state == ConnectionState.DISCONNECTED
    finally:
        alice_listen_task.cancel()
        await alice.disconnect()

@pytest.mark.asyncio
async def test_graceful_and_unexpected_disconnect(test_server):
    alice = create_client("alice", 8890)
    await alice.connect()
    alice_listen_task = asyncio.create_task(alice.listen())
    
    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        # Graceful disconnect
        await alice.disconnect()
        assert alice.state == ConnectionState.DISCONNECTED
        
        # Server should clean up quickly
        await asyncio.sleep(0.1)
        assert "alice" not in test_server.sessions
        assert test_server.presence.status("alice") == "offline"
    finally:
        alice_listen_task.cancel()
        await alice.disconnect()
        
    bob = create_client("bob", 8890)
    await bob.connect()
    bob_listen_task = asyncio.create_task(bob.listen())
    try:
        while bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        # Manually close Bob's socket on the server
        test_server.sessions["bob"].writer.close()
        
        await asyncio.sleep(0.1)
        # Bob's listen task should detect disconnect
        assert bob.state == ConnectionState.DISCONNECTED
    finally:
        bob_listen_task.cancel()
        await bob.disconnect()

@pytest.mark.asyncio
async def test_reconnection_and_backoff(test_server):
    alice = create_client("alice", 8890, reconnect_delays=(0.1, 0.2))
    
    # Intentionally connect to wrong port to test exponential backoff
    alice.transport.port = 9999
    
    start_time = time.time()
    try:
        await alice.reconnect_forever()
        pytest.fail("Should have raised ConnectionError")
    except ConnectionError:
        pass
    elapsed = time.time() - start_time
    # delays are 0.1, 0.2 -> at least 0.3s elapsed
    assert elapsed >= 0.3
    
    # Now fix the port and test successful recovery
    alice.transport.port = 8890
    await alice.reconnect_forever()
    # If successful, we don't need a background listen yet, but state should be AUTHENTICATING
    assert alice.state == ConnectionState.AUTHENTICATING
    
    alice_listen_task = asyncio.create_task(alice.listen())
    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
        assert alice.state == ConnectionState.READY
    finally:
        alice_listen_task.cancel()
        await alice.disconnect()

@pytest.mark.asyncio
async def test_state_restoration(test_server):
    alice = create_client("alice", 8890)
    await alice.connect()
    alice_listen_task = asyncio.create_task(alice.listen())
    
    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        await alice.join_room("room_xyz")
        await asyncio.sleep(0.1)
        assert "alice" in test_server.rooms.members("room_xyz")
        
        # Simulate network drop
        await alice.disconnect()
        await asyncio.sleep(0.1)
        assert "alice" not in test_server.rooms.members("room_xyz")
        
        # Reconnect
        await alice.reconnect_forever()
        # Note: listen task needs to be restarted since it died
        alice_listen_task = asyncio.create_task(alice.listen())
        
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        await asyncio.sleep(0.2) # wait for JOINs to be processed
        
        # Room membership should be restored
        members = test_server.rooms.members("room_xyz")
        assert "alice" in members
        assert len(members) == 1
    finally:
        alice_listen_task.cancel()
        await alice.disconnect()

@pytest.mark.asyncio
async def test_message_state_tracking(test_server):
    alice = create_client("alice", 8890)
    bob = create_client("bob", 8890)
    await alice.connect()
    await bob.connect()
    alice_listen_task = asyncio.create_task(alice.listen())
    bob_listen_task = asyncio.create_task(bob.listen())
    
    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        await alice.send_key_exchange("bob")
        await bob.send_key_exchange("alice")
        await asyncio.sleep(0.1)
        
        # Healthy message
        await alice.send_direct_message("bob", "Hello Bob")
        await asyncio.sleep(0.1)
        
        # Verify it transitioned to SENT
        msg_states = list(alice.pending_messages.values())
        assert msg_states[-1] == MessageState.SENT
        
        # Message during disconnect
        await alice.disconnect()
        with pytest.raises(RuntimeError):
            await alice.send_direct_message("bob", "Lost message")
            
        # Reconnect and send a message right before dropping connection to test PENDING -> FAILED
        await alice.reconnect_forever()
        alice_listen_task = asyncio.create_task(alice.listen())
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        # Mock write_frame to simulate a dropped packet / disconnect mid-flight
        with patch('securechat.client.transport.write_frame') as mock_write:
            mock_write.side_effect = Exception("Network dropped")
            try:
                await alice.send_direct_message("bob", "Doomed message")
            except Exception:
                pass
            
            alice._handle_disconnect()
            
            # The doomed message should be FAILED
            failed_msgs = [k for k, v in alice.pending_messages.items() if v == MessageState.FAILED]
            assert len(failed_msgs) >= 1
            
    finally:
        alice_listen_task.cancel()
        bob_listen_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

@pytest.mark.asyncio
async def test_crypto_state_after_reconnect(test_server):
    alice = create_client("alice", 8890)
    bob = create_client("bob", 8890)
    await alice.connect()
    await bob.connect()
    alice_listen_task = asyncio.create_task(alice.listen())
    bob_listen_task = asyncio.create_task(bob.listen())
    
    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        await alice.send_key_exchange("bob")
        await bob.send_key_exchange("alice")
        await asyncio.sleep(0.2)
        
        # Ensure Bob receives message
        await alice.send_direct_message("bob", "Pre-disconnect")
        await asyncio.sleep(0.1)
        
        # Disconnect Alice
        await alice.disconnect()
        
        # Reconnect Alice
        await alice.reconnect_forever()
        alice_listen_task = asyncio.create_task(alice.listen())
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        # Clear bob's queue
        while not bob._event_queue.empty():
            bob._event_queue.get_nowait()
            
        # Crypto state (shared_keys) must persist. E2E encryption should work immediately.
        assert "bob" in alice.shared_keys
        await alice.send_direct_message("bob", "Post-disconnect")
        
        while True:
            msg_evt = await asyncio.wait_for(bob._event_queue.get(), timeout=1.0)
            if isinstance(msg_evt, MessageReceived):
                assert msg_evt.text == "Post-disconnect"
                break
    finally:
        alice_listen_task.cancel()
        bob_listen_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

