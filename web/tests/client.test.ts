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
  async getPublicKey() { return "pub"; }
  async deriveSharedKey() {}
  async encrypt(target: string, text: string) { return `enc-${text}`; }
  async decrypt(sender: string, text: string) { return text.replace('enc-', ''); }
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
    
    transport.sentFrames = [];
    await client.sendDirectMessage("bob", "hello");
    
    const msgFrame = transport.sentFrames[0];
    expect(msgFrame.type).toBe("MSG");
    expect(msgFrame.target).toBe("bob");
    expect(msgFrame.payload).toBe("enc-hello"); 
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
    
    transport.sentFrames = [];
    await failClient.sendDirectMessage("bob", "secret plaintext message");
    
    expect(encUnavailable).toBe(true);
    expect(transport.sentFrames.length).toBe(0);
    
    const anyPlaintext = JSON.stringify(transport.sentFrames).includes("secret plaintext message");
    expect(anyPlaintext).toBe(false);
  });
});
