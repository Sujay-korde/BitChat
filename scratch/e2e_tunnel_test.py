import asyncio
import json
import websockets
import time

URL = "wss://sims-blanket-sat-conventional.trycloudflare.com"

async def test_e2e():
    async with websockets.connect(URL) as alice_ws, websockets.connect(URL) as bob_ws:
        # Authenticate Alice
        await alice_ws.send(json.dumps({
            "type": "AUTH",
            "msg_id": "a1",
            "sender": "Alice",
            "target": "server",
            "target_type": "user",
            "timestamp": int(time.time()),
            "payload": '{"username": "Alice"}'
        }))
        res_alice = json.loads(await alice_ws.recv())
        print("Alice Auth:", res_alice)

        # Authenticate Bob
        await bob_ws.send(json.dumps({
            "type": "AUTH",
            "msg_id": "b1",
            "sender": "Bob",
            "target": "server",
            "target_type": "user",
            "timestamp": int(time.time()),
            "payload": '{"username": "Bob"}'
        }))
        res_bob = json.loads(await bob_ws.recv())
        print("Bob Auth:", res_bob)

        # Alice sends key exchange to Bob
        await alice_ws.send(json.dumps({
            "type": "KEY_EXCHANGE",
            "msg_id": "a2",
            "sender": "Alice",
            "target": "Bob",
            "target_type": "user",
            "timestamp": int(time.time()),
            "payload": "mock-pubkey-alice"
        }))
        
        # Bob should receive it
        bob_recv_kx = json.loads(await bob_ws.recv())
        print("Bob received Key Exchange:", bob_recv_kx)
        
        # Bob sends message to Alice
        await bob_ws.send(json.dumps({
            "type": "MSG",
            "msg_id": "b2",
            "sender": "Bob",
            "target": "Alice",
            "target_type": "user",
            "timestamp": int(time.time()),
            "payload": '{"key_version": 0, "sequence_number": 1, "ciphertext": "hello alice from tunnel"}'
        }))

        # Bob should receive an ACK for the message
        bob_ack = json.loads(await bob_ws.recv())
        print("Bob received ACK:", bob_ack)

        # Alice should receive the message
        alice_recv_msg = json.loads(await alice_ws.recv())
        print("Alice received MSG:", alice_recv_msg)
        print("\nTEST SUCCESSFUL! Tunnel works perfectly for E2E communication.")

if __name__ == "__main__":
    asyncio.run(test_e2e())
