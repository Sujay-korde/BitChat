import { describe, it, expect, beforeEach } from 'vitest';
import { WebCryptoProvider } from '../src/core/crypto/WebCryptoProvider';

describe('WebCryptoProvider Interoperability Guarantees', () => {
  let alice: WebCryptoProvider;
  let bob: WebCryptoProvider;

  beforeEach(async () => {
    alice = new WebCryptoProvider();
    bob = new WebCryptoProvider();
    
    await alice.generateIdentity();
    await bob.generateIdentity();
  });

  it('Test C: Browser <-> Browser encrypt/decrypt', async () => {
    const alicePub = await alice.getPublicKey("alice", "bob");
    const bobPub = await bob.getPublicKey("bob", "alice");

    const aliceShared = await alice.deriveSharedKey("bob", "alice", bobPub);
    const bobShared = await bob.deriveSharedKey("alice", "bob", alicePub);

    const plaintext = "Hello from browser A to browser B!";
    
    // Alice encrypts
    const ciphertext = await alice.encrypt(aliceShared, plaintext);
    expect(ciphertext).toBeTypeOf('string');
    expect(ciphertext.length).toBeGreaterThan(plaintext.length);

    // Bob decrypts
    const decrypted = await bob.decrypt(bobShared, ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('Test D: Shared Secret Equality', async () => {
    const alicePub = await alice.getPublicKey("alice", "bob");
    const bobPub = await bob.getPublicKey("bob", "alice");

    const aliceShared = await alice.deriveSharedKey("bob", "alice", bobPub);
    const bobShared = await bob.deriveSharedKey("alice", "bob", alicePub);

    // Ensure they derived the exact same raw bytes
    expect(aliceShared).toEqual(bobShared);
    // Ensure it's 32 bytes (256 bits)
    expect(aliceShared.length).toBe(32);
  });

  it('Test E: Tampering detection', async () => {
    const alicePub = await alice.getPublicKey("alice", "bob");
    const bobPub = await bob.getPublicKey("bob", "alice");

    const aliceShared = await alice.deriveSharedKey("bob", "alice", bobPub);
    const bobShared = await bob.deriveSharedKey("alice", "bob", alicePub);

    const ciphertext = await alice.encrypt(aliceShared, "secret message");
    
    // Decode base64, flip a bit, re-encode
    const binary = atob(ciphertext);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Flip bit in the ciphertext portion
    bytes[20] = bytes[20] ^ 0x01;
    
    let tamperedBinary = '';
    for (let i = 0; i < bytes.length; i++) {
      tamperedBinary += String.fromCharCode(bytes[i]);
    }
    const tamperedCiphertext = btoa(tamperedBinary);

    // Expect decrypt to throw DecryptionError (or OperationError caught by the provider)
    await expect(bob.decrypt(bobShared, tamperedCiphertext)).rejects.toThrow('Failed to decrypt message');
  });

  it('Test F: Wrong Key', async () => {
    const eve = new WebCryptoProvider();
    await eve.generateIdentity();
    const evePub = await eve.getPublicKey("eve", "alice");

    const alicePub = await alice.getPublicKey("alice", "bob");
    const bobPub = await bob.getPublicKey("bob", "alice");

    const aliceShared = await alice.deriveSharedKey("bob", "alice", bobPub);
    const bobShared = await bob.deriveSharedKey("alice", "bob", alicePub);

    const aliceToEvePub = await alice.getPublicKey("alice", "eve");
    const eveShared = await eve.deriveSharedKey("alice", "eve", aliceToEvePub);

    const ciphertext = await alice.encrypt(aliceShared, "secret message to bob");

    // Eve tries to decrypt with her shared key with Alice
    await expect(eve.decrypt(eveShared, ciphertext)).rejects.toThrow('Failed to decrypt message');
  });

  it('Test G: Nonce Reuse Protection', async () => {
    const alicePub = await alice.getPublicKey("alice", "bob");
    const bobPub = await bob.getPublicKey("bob", "alice");

    const aliceShared = await alice.deriveSharedKey("bob", "alice", bobPub);

    const ciphertext1 = await alice.encrypt(aliceShared, "message 1");
    const ciphertext2 = await alice.encrypt(aliceShared, "message 2");

    // Base64 decode to compare nonces (first 12 bytes)
    const b1 = atob(ciphertext1);
    const b2 = atob(ciphertext2);
    
    const nonce1 = b1.substring(0, 12);
    const nonce2 = b2.substring(0, 12);

    expect(nonce1).not.toEqual(nonce2);
  });
});
