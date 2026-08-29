import { x25519 } from '@noble/curves/ed25519.js';
import type { CryptoProvider } from './CryptoProvider';
import { CryptoNotAvailableError } from './CryptoProvider';

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class KeyExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyExchangeError';
  }
}

export class WebCryptoProvider implements CryptoProvider {
  private privateKey: Uint8Array | null = null;
  private publicKey: Uint8Array | null = null;
  
  // Convert byte array to Base64 string
  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert Base64 string to byte array
  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async generateIdentity(): Promise<void> {
    // noble-curves uses 32 bytes of secure random for x25519 private key
    this.privateKey = x25519.utils.randomSecretKey();
    this.publicKey = x25519.getPublicKey(this.privateKey);
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) throw new CryptoNotAvailableError("Identity not generated");
    return this.bytesToBase64(this.publicKey);
  }

  async deriveSharedKey(peerPublicKeyB64: string): Promise<Uint8Array> {
    if (!this.privateKey) throw new CryptoNotAvailableError("Identity not generated");
    
    try {
      const peerPublicKey = this.base64ToBytes(peerPublicKeyB64);
      
      // 1. X25519 DH Exchange to get shared secret
      const sharedSecret = x25519.getSharedSecret(this.privateKey, peerPublicKey);
      
      // 2. HKDF Derivation to match Python backend
      const importedSecret = await crypto.subtle.importKey(
        "raw",
        sharedSecret,
        { name: "HKDF" },
        false,
        ["deriveKey", "deriveBits"]
      );

      // Derive exactly 256 bits (32 bytes) AES-GCM key
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: new Uint8Array(0), // empty salt
          info: new TextEncoder().encode("securechat-aes-256-gcm")
        },
        importedSecret,
        { name: "AES-GCM", length: 256 },
        true, // exportable so we can store it as raw bytes to match the interface if needed
        ["encrypt", "decrypt"]
      );
      
      // Export it as raw bytes to match the dictionary signature expected by the app, 
      // or we can just return it. The current interface deriveSharedKey returns Promise<void> 
      // but wait, the Python `derive_shared_key` returns `bytes` and the app stores it.
      // Let's modify CryptoProvider to return CryptoKey or Uint8Array.
      // Currently CryptoProvider has: deriveSharedKey(_peerPublicKey: string): Promise<void>
      // Oh, in the Python client, `shared_keys` maps to `bytes`.
      // Let's export it as raw bytes so it can be stored as a string or Uint8Array.
      
      const rawDerivedKey = await crypto.subtle.exportKey("raw", derivedKey);
      return new Uint8Array(rawDerivedKey);
    } catch (e) {
      throw new KeyExchangeError(`Failed to derive shared key: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async encrypt(targetRawKey: string | Uint8Array, plaintext: string): Promise<string> {
    try {
      let keyBytes: Uint8Array;
      if (typeof targetRawKey === 'string') {
        keyBytes = this.base64ToBytes(targetRawKey); // if we stored it as base64
      } else {
        keyBytes = targetRawKey;
      }

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes as unknown as BufferSource,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );

      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const encodedPayload = new TextEncoder().encode(plaintext);
      
      const ciphertextBuffer = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: nonce as unknown as BufferSource
        },
        cryptoKey,
        encodedPayload as unknown as BufferSource
      );

      const combined = new Uint8Array(12 + ciphertextBuffer.byteLength);
      combined.set(nonce, 0);
      combined.set(new Uint8Array(ciphertextBuffer), 12);
      
      return this.bytesToBase64(combined);
    } catch (e) {
      throw new EncryptionError(`Failed to encrypt message`);
    }
  }

  async decrypt(senderRawKey: string | Uint8Array, ciphertextB64: string): Promise<string> {
    try {
      let keyBytes: Uint8Array;
      if (typeof senderRawKey === 'string') {
        keyBytes = this.base64ToBytes(senderRawKey);
      } else {
        keyBytes = senderRawKey;
      }

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes as unknown as BufferSource,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const combined = this.base64ToBytes(ciphertextB64);
      if (combined.byteLength < 28) { // 12 nonce + at least 16 auth tag
        throw new Error("Ciphertext too short");
      }

      const nonce = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const plaintextBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: nonce as unknown as BufferSource
        },
        cryptoKey,
        ciphertext as unknown as BufferSource
      );

      return new TextDecoder().decode(plaintextBuffer);
    } catch (e) {
      throw new DecryptionError(`Failed to decrypt message`);
    }
  }
}
