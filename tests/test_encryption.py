import asyncio
import base64
import pytest
import pytest_asyncio
from unittest.mock import patch

from securechat.server.main import ChatServer
from securechat.client.app import SecureChatApp
from securechat.client.transport import TCPTransport
from securechat.client.events import ConnectionState, KeyExchangeCompleted, MessageReceived, ModerationRejected
from securechat.protocol.framing import read_frame, write_frame
from securechat.protocol.types import MessageType, TargetType
from securechat.client.crypto import ChatCrypto

def create_client(username: str, port: int) -> SecureChatApp:
    transport = TCPTransport(port=port)
    return SecureChatApp(username=username, transport=transport)

@pytest_asyncio.fixture
async def test_server():
    server = ChatServer(port=8889)
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
async def test_key_exchange(test_server):
    alice = create_client("alice", 8889)
    bob = create_client("bob", 8889)
    await alice.connect()
    await bob.connect()
    
    alice_task = asyncio.create_task(alice.listen())
    bob_task = asyncio.create_task(bob.listen())
    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
        
        # Alice sends a key exchange to Bob
        await alice.send_key_exchange("bob")
        
        # Bob should receive a KeyExchangeCompleted event
        while True:
            event = await asyncio.wait_for(bob._event_queue.get(), timeout=1.0)
            if isinstance(event, KeyExchangeCompleted): break
        assert event.peer == "alice"
        
        # Bob should have Alice's shared key computed
        assert "alice" in bob.shared_keys
        
        # Verify both computed the SAME shared key
        await bob.send_key_exchange("alice")
        while True:
            event2 = await asyncio.wait_for(alice._event_queue.get(), timeout=1.0)
            if isinstance(event2, KeyExchangeCompleted): break
        assert "bob" in alice.shared_keys
        
        assert alice.shared_keys["bob"] == bob.shared_keys["alice"]
    finally:
        alice_task.cancel()
        bob_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

@pytest.mark.asyncio
async def test_encryption_and_decryption(test_server):
    alice = create_client("alice", 8889)
    bob = create_client("bob", 8889)
    await alice.connect()
    await bob.connect()
    
    alice_task = asyncio.create_task(alice.listen())
    bob_task = asyncio.create_task(bob.listen())
    
    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        await alice.send_key_exchange("bob")
        await bob.send_key_exchange("alice")
        
        while True:
            evt = await bob._event_queue.get()
            if isinstance(evt, KeyExchangeCompleted): break
        while True:
            evt = await alice._event_queue.get()
            if isinstance(evt, KeyExchangeCompleted): break
        
        # Alice sends Bob a direct encrypted message
        secret_text = "This is a strictly confidential message."
        await alice.send_direct_message("bob", secret_text)
        
        # Bob should receive the decrypted message
        while True:
            msg_evt = await asyncio.wait_for(bob._event_queue.get(), timeout=1.0)
            if isinstance(msg_evt, MessageReceived):
                assert msg_evt.sender == "alice"
                assert msg_evt.text == secret_text
                break
    finally:
        alice_task.cancel()
        bob_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

@pytest.mark.asyncio
async def test_wrong_key(test_server):
    alice = create_client("alice", 8889)
    bob = create_client("bob", 8889)
    await alice.connect()
    await bob.connect()
    
    alice_task = asyncio.create_task(alice.listen())
    bob_task = asyncio.create_task(bob.listen())
    
    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Fake key exchange but use the WRONG shared key for Bob
        alice.shared_keys["bob"] = b"12345678901234567890123456789012"
        bob.shared_keys["alice"] = b"wrong_key_1234567890123456789012"
        
        # Clear inbox
        while not alice._event_queue.empty(): alice._event_queue.get_nowait()
        while not bob._event_queue.empty(): bob._event_queue.get_nowait()

        # Alice sends message
        await alice.send_direct_message("bob", "Should fail")
        
        # Bob receives the frame, but decryption fails. 
        # The client ignores the tampered message safely and continues.
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(bob._event_queue.get(), timeout=0.5)
    finally:
        alice_task.cancel()
        bob_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

@pytest.mark.asyncio
async def test_tampered_ciphertext(test_server):
    alice = create_client("alice", 8889)
    bob = create_client("bob", 8889)
    await alice.connect()
    await bob.connect()
    
    alice_task = asyncio.create_task(alice.listen())
    bob_task = asyncio.create_task(bob.listen())
    
    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        await alice.send_key_exchange("bob")
        await bob.send_key_exchange("alice")
        
        while True:
            if isinstance(await bob._event_queue.get(), KeyExchangeCompleted): break
        while True:
            if isinstance(await alice._event_queue.get(), KeyExchangeCompleted): break
        
        # Alice creates a valid encrypted payload
        shared_key = alice.shared_keys["bob"]
        payload = {"text": "Hello Bob"}
        encrypted_payload = alice.crypto.encrypt(shared_key, payload)
        
        # Tamper with the ciphertext (change the last character in base64)
        tampered_payload = encrypted_payload[:-2] + "AA"
        
        # Send manually
        assert alice.transport.writer is not None
        await write_frame(alice.transport.writer, alice._message(MessageType.MSG, "alice", "bob", TargetType.USER, tampered_payload))
        
        # Bob should reject it
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(bob._event_queue.get(), timeout=0.5)
    finally:
        alice_task.cancel()
        bob_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

@pytest.mark.asyncio
async def test_server_ciphertext_only_invariant(test_server):
    alice = create_client("alice", 8889)
    bob = create_client("bob", 8889)
    await alice.connect()
    await bob.connect()
    
    alice_task = asyncio.create_task(alice.listen())
    bob_task = asyncio.create_task(bob.listen())
    
    try:
        while alice.state != ConnectionState.READY or bob.state != ConnectionState.READY:
            await asyncio.sleep(0.01)
            
        await alice.send_key_exchange("bob")
        await bob.send_key_exchange("alice")
        
        while True:
            if isinstance(await bob._event_queue.get(), KeyExchangeCompleted): break
        while True:
            if isinstance(await alice._event_queue.get(), KeyExchangeCompleted): break
            
        # We patch the server's _relay_ciphertext to inspect the payload it handles
        original_relay = test_server._relay_ciphertext
        
        relayed_payloads = []
        
        async def intercept_relay(payload: dict):
            relayed_payloads.append(payload["ciphertext"])
            await original_relay(payload)
            
        with patch.object(test_server, "_relay_ciphertext", new=intercept_relay):
            secret_msg = "SUPER SECRET PLAINTEXT"
            await alice.send_direct_message("bob", secret_msg)
            
            while True:
                msg_evt = await asyncio.wait_for(bob._event_queue.get(), timeout=1.0)
                if isinstance(msg_evt, MessageReceived):
                    break
                    
        # Verify the server handled exactly one MSG, and it contains NO plaintext
        assert len(relayed_payloads) == 1
        assert secret_msg not in relayed_payloads[0]
        
        # Also verify it's properly base64 encoded by trying to decode it
        base64.b64decode(relayed_payloads[0])
    finally:
        alice_task.cancel()
        bob_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

@pytest.mark.asyncio
async def test_moderation_before_encryption_and_rejection(test_server):
    alice = create_client("alice", 8889)
    bob = create_client("bob", 8889)
    await alice.connect()
    await bob.connect()
    
    alice.shared_keys["bob"] = b"0"*32 # Fake key
    
    alice_task = asyncio.create_task(alice.listen())
    
    try:
        while alice.state != ConnectionState.READY:
            await asyncio.sleep(0.01)

        # Using patch to verify ChatCrypto.encrypt is NEVER called on a rejected message
        with patch.object(alice.crypto, 'encrypt') as mock_encrypt:
            # A known bad word that classifier.py rejects ("fuck")
            bad_message = "I hate this idiot, kill him"
            await alice.send_direct_message("bob", bad_message)
            
            # Ensure it wasn't encrypted
            mock_encrypt.assert_not_called()
            
            # Ensure it emitted ModerationRejected
            while True:
                evt = await alice._event_queue.get()
                if isinstance(evt, ModerationRejected):
                    assert evt.text == bad_message
                    break
                    
    finally:
        alice_task.cancel()
        await alice.disconnect()
        await bob.disconnect()

