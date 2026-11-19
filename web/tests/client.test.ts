import { describe, it, expect, beforeEach } from 'vitest';
import { SecureChatClient } from '../src/core/client/SecureChatClient';
import { Transport } from '../src/core/transport/Transport';
import { CryptoProvider } from '../src/core/crypto/CryptoProvider';
import { ModerationProvider } from '../src/core/moderation/ModerationProvider';
import { ConnectionState } from '../src/core/client/events';

class MockTransport implements Transport {
  public connected = false;
  public sentFrames: any[] = [];
  public receiveQueue: any[] = [];
  public resolveQueue: ((v: any) => void)[] = [];

  async connect() { this.connected = true; }
  async disconnect() { this.connected = false; }
  async sendFrame(frame: any) { this.sentFrames.push(frame); }
  async recvFrame() {
    if (this.receiveQueue.length > 0) return this.receiveQueue.shift();
    return new Promise(resolve => this.resolveQueue.push(resolve));
  }
  
  injectFrame(frame: any) {
    if (this.resolveQueue.length > 0) {
      this.resolveQueue.shift()!(frame);
    } else {
      this.receiveQueue.push(frame);
    }
  }
}

class MockCrypto implements CryptoProvider {
  async generateIdentity() {}
  async getPublicKey(sender: string, target: string) { return "pub"; }
  async deriveSharedKey(sender: string, target: string, payload: string) { return "dummy-key"; }
  async encrypt(target: string | Uint8Array, text: string, aad?: Uint8Array) { return `enc-${text}`; }
  async decrypt(sender: string | Uint8Array, text: string, aad?: Uint8Array) { 
    if (aad && text.includes("bad-aad")) throw new Error("bad aad");
    return text.replace('enc-', ''); 
  }
}

class MockModeration implements ModerationProvider {
  async moderate(text: string) { return !text.includes("bad"); }
}

describe('SecureChatClient', () => {
  let transport: MockTransport;
  let client: SecureChatClient;
  
  beforeEach(() => {
    transport = new MockTransport();
    client = new SecureChatClient(transport, new MockCrypto(), new MockModeration());
  });

  it('should authenticate and reach READY state', async () => {
    const states: ConnectionState[] = [];
    client.onEvent(e => {
      if (e.type === 'ConnectionChanged') states.push(e.state);
    });

    const connectPromise = client.connect("alice");
    
    transport.injectFrame({
      type: "AUTH_OK",
      msg_id: "s-1",
      sender: "server",
      target: "alice",
      target_type: "user",
      timestamp: 123,
      payload: "ok"
    });

    await connectPromise;
    await new Promise(r => setTimeout(r, 50)); 

    expect(transport.connected).toBe(true);
    expect(states).toContain(ConnectionState.READY);
    
    const authFrame = transport.sentFrames.find(f => f.type === "AUTH");
    expect(authFrame).toBeDefined();
    expect(JSON.parse(authFrame.payload).username).toBe("alice");
  });

  it('should encrypt and send messages', async () => {
    transport.injectFrame({
      type: "AUTH_OK", msg_id: "s-1", sender: "server", target: "alice", target_type: "user", timestamp: 123, payload: "ok"
    });
    await client.connect("alice");
    await new Promise(r => setTimeout(r, 50));
    
    transport.injectFrame({
      type: "KEY_EXCHANGE", msg_id: "s-2", sender: "bob", target: "alice", target_type: "user", timestamp: 123, payload: "{}"
    });
    await new Promise(r => setTimeout(r, 50));
    
    transport.sentFrames = [];
    await client.sendDirectMessage("bob", "hello");
    
    const msgFrame = transport.sentFrames[0];
    expect(msgFrame.type).toBe("MSG");
    expect(msgFrame.target).toBe("bob");
    const payload = JSON.parse(msgFrame.payload);
    expect(payload.ciphertext).toBe("enc-hello"); 
    expect(payload.key_version).toBe(0);
    expect(payload.sequence_number).toBe(1);
  });

  it('should block bad words in moderation', async () => {
    transport.injectFrame({
      type: "AUTH_OK", msg_id: "s-1", sender: "server", target: "alice", target_type: "user", timestamp: 123, payload: "ok"
    });
    await client.connect("alice");
    await new Promise(r => setTimeout(r, 50));
    
    let rejected = false;
    client.onEvent(e => {
      if (e.type === 'ModerationRejected') rejected = true;
    });

    transport.sentFrames = [];
    await client.sendDirectMessage("bob", "this is bad");
    
    expect(rejected).toBe(true);
    expect(transport.sentFrames.length).toBe(0);
  });

  it('should not call sendFrame or transmit plaintext if crypto is unavailable', async () => {
    class FailClosedCrypto extends MockCrypto {
      async encrypt(target: string, text: string): Promise<string> { 
        throw new Error("CryptoUnavailable"); 
      }
    }
    const failClient = new SecureChatClient(transport, new FailClosedCrypto(), new MockModeration());
    
    let encUnavailable = false;
    failClient.onEvent(e => {
      if (e.type === 'EncryptionUnavailable') encUnavailable = true;
    });

    transport.injectFrame({
      type: "AUTH_OK", msg_id: "s-1", sender: "server", target: "alice", target_type: "user", timestamp: 123, payload: "ok"
    });
    
    const connectPromise = failClient.connect("alice");
    await new Promise(r => setTimeout(r, 50));
    await connectPromise;
    
    transport.injectFrame({
      type: "KEY_EXCHANGE", msg_id: "s-2", sender: "bob", target: "alice", target_type: "user", timestamp: 123, payload: "{}"
    });
    await new Promise(r => setTimeout(r, 50));
    
    transport.sentFrames = [];
    await failClient.sendDirectMessage("bob", "secret plaintext message");
    
    expect(encUnavailable).toBe(true);
    expect(transport.sentFrames.length).toBe(0);
    
    const anyPlaintext = JSON.stringify(transport.sentFrames).includes("secret plaintext message");
    expect(anyPlaintext).toBe(false);
  });

  it('should join a room and send and receive encrypted room messages', async () => {
    transport.injectFrame({
      type: "AUTH_OK", msg_id: "s-1", sender: "server", target: "alice", target_type: "user", timestamp: 123, payload: "ok"
    });
    await client.connect("alice");
    await new Promise(r => setTimeout(r, 50));

    // Join room dev
    transport.sentFrames = [];
    await client.joinRoom("dev");
    expect(transport.sentFrames.some(f => f.type === "JOIN" && f.target === "dev")).toBe(true);

    // Send room message
    transport.sentFrames = [];
    await client.sendRoomMessage("dev", "hello dev group");
    const roomMsgFrame = transport.sentFrames.find(f => f.type === "MSG" && f.target === "dev");
    expect(roomMsgFrame).toBeDefined();
    expect(roomMsgFrame.target_type).toBe("room");

    // Receive room message from Bob in dev
    let receivedText = "";
    client.onEvent(e => {
      if (e.type === "MessageReceived" && e.target === "dev") {
        receivedText = e.text;
      }
    });

    transport.injectFrame({
      type: "MSG",
      msg_id: "bob-msg-1",
      sender: "bob",
      target: "dev",
      target_type: "room",
      timestamp: 123456,
      payload: JSON.stringify({
        key_version: 1,
        sequence_number: 1,
        ciphertext: "enc-bob reply in dev"
      })
    });
    await new Promise(r => setTimeout(r, 50));

    expect(receivedText).toBe("bob reply in dev");
  });
});
