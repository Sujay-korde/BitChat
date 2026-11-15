import type { AttachmentDescriptor } from "../client/events";
export type { AttachmentDescriptor };

export interface CryptoProvider {
  generateIdentity(username?: string): Promise<void>;
  getPublicKey(sender: string, target: string): Promise<string>;
  deriveSharedKey(sender: string, target: string, peerPayloadJson: string): Promise<string | Uint8Array>;
  encrypt(target: string | Uint8Array, plaintext: string, aad?: Uint8Array): Promise<string>;
  decrypt(sender: string | Uint8Array, ciphertext: string, aad?: Uint8Array): Promise<string>;
  generateRoomKey(): Promise<Uint8Array>;
  signAuth?(username: string, timestamp: number): Promise<{ username: string; identity_key: string; signature: string; timestamp: string }>;
  getFingerprint?(identityKeyB64?: string): Promise<string>;
  encryptAttachment?(fileBytes: Uint8Array, fileName: string, mimeType: string): Promise<{ ciphertext: Uint8Array; descriptor: Omit<AttachmentDescriptor, "blob_id"> }>;
  decryptAttachment?(ciphertext: Uint8Array, keyB64: string, ivB64: string, expectedSha256: string): Promise<Uint8Array>;
}

export class CryptoNotAvailableError extends Error {
  constructor(message: string = "Cryptography is not yet implemented.") {
    super(message);
    this.name = "CryptoNotAvailableError";
  }
}

/**
 * EXPERIMENTAL PLACEHOLDER
 * NOT READY FOR PRODUCTION
 * 
 * This class DOES NOT perform actual cryptography.
 * To maintain the ciphertext-only invariant, it is now FAIL-CLOSED.
 * It will throw an error if encryption or decryption is attempted.
 */
export class DummyCryptoProvider implements CryptoProvider {
  async generateIdentity(): Promise<void> {}
  async getPublicKey(_sender: string, _target: string): Promise<string> {
    return "dummy-public-key";
  }
  async deriveSharedKey(_sender: string, _target: string, _peerPayloadJson: string): Promise<string | Uint8Array> {
    return "dummy-key";
  }
  
  async encrypt(_target: string | Uint8Array, _plaintext: string, _aad?: Uint8Array): Promise<string> {
    throw new CryptoNotAvailableError();
  }
  
  async decrypt(_sender: string | Uint8Array, _ciphertext: string, _aad?: Uint8Array): Promise<string> {
    throw new CryptoNotAvailableError();
  }

  async generateRoomKey(): Promise<Uint8Array> {
    throw new CryptoNotAvailableError();
  }
}
