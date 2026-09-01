import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecureChatClient } from '../SecureChatClient';
import { ConnectionState } from '../events';
import type { Transport } from '../../transport/Transport';
import type { CryptoProvider } from '../../crypto/CryptoProvider';
import type { ModerationProvider } from '../../moderation/ModerationProvider';

describe('SecureChatClient', () => {
  let mockTransport: any;
  let mockCrypto: any;
  let mockModeration: any;
  let client: SecureChatClient;
  let states: ConnectionState[];

  beforeEach(() => {
    mockTransport = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendFrame: vi.fn(),
      recvFrame: vi.fn()
    };

    mockCrypto = {
      generateIdentity: vi.fn(),
      getPublicKey: vi.fn(),
      deriveSharedKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn()
    };

    mockModeration = {
      moderate: vi.fn().mockResolvedValue(true)
    };

    client = new SecureChatClient(
      mockTransport as Transport,
      mockCrypto as CryptoProvider,
      mockModeration as ModerationProvider
    );

    states = [];
    client.onEvent((event) => {
      if (event.type === 'ConnectionChanged') {
        states.push(event.state);
      }
    });
  });

  it('maintains CONNECTING state when initial connection fails', async () => {
    mockTransport.connect.mockRejectedValueOnce(new Error('Connection refused'));
    
    // Call connect but don't await because it loops indefinitely on failure
    client.connect('Alice');
    
    // Wait for the first loop to process the rejection
    await new Promise(r => setTimeout(r, 50));
    
    // It should have transitioned to CONNECTING, and stayed there (not RECONNECTING or READY)
    expect(states[states.length - 1]).toBe(ConnectionState.CONNECTING);
    expect(states).not.toContain(ConnectionState.READY);
    expect(states).not.toContain(ConnectionState.RECONNECTING);
    
    // Stop the client loop
    await client.disconnect();
  });

  it('transitions to RECONNECTING when connection drops after being connected', async () => {
    mockTransport.connect.mockResolvedValueOnce(undefined);
    
    let rejectRecv: any;
    mockTransport.recvFrame.mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        rejectRecv = reject;
      });
    });

    client.connect('Alice');
    
    // Let the event loop process connection
    await new Promise(r => setTimeout(r, 50));
    
    expect(states).toContain(ConnectionState.CONNECTED);
    
    // Simulate drop
    rejectRecv(new Error('Socket closed'));
    
    await new Promise(r => setTimeout(r, 50));
    
    expect(states[states.length - 1]).toBe(ConnectionState.RECONNECTING);
    
    await client.disconnect();
  });
});
