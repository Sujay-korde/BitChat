export interface CryptoProvider {
  generateIdentity(): Promise<void>;
  getPublicKey(): Promise<string>;
  deriveSharedKey(peerPublicKey: string): Promise<void>;
  encrypt(target: string, plaintext: string): Promise<string>;
  decrypt(sender: string, ciphertext: string): Promise<string>;
}

/**
 * EXPERIMENTAL PLACEHOLDER
 * NOT READY FOR PRODUCTION
 * 
 * This class DOES NOT perform actual X25519/AES-GCM encryption.
 * It passes through plaintext for the sake of frontend UI development
 * until WebCrypto interoperability is verified in Phase 5C.
 */
export class DummyCryptoProvider implements CryptoProvider {
  async generateIdentity(): Promise<void> {}
  async getPublicKey(): Promise<string> {
    return "dummy-public-key";
  }
  async deriveSharedKey(_peerPublicKey: string): Promise<void> {}
  
  async encrypt(_target: string, plaintext: string): Promise<string> {
    // FAKE ENCRYPTION - DO NOT USE IN PRODUCTION
    return plaintext;
  }
  
  async decrypt(_sender: string, ciphertext: string): Promise<string> {
    // FAKE DECRYPTION - DO NOT USE IN PRODUCTION
    return ciphertext;
  }
}
