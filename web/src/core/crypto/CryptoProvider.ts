export interface CryptoProvider {
  generateIdentity(): Promise<void>;
  getPublicKey(): Promise<string>;
  deriveSharedKey(peerPublicKey: string): Promise<void>;
  encrypt(target: string, plaintext: string): Promise<string>;
  decrypt(sender: string, ciphertext: string): Promise<string>;
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
  async getPublicKey(): Promise<string> {
    return "dummy-public-key";
  }
  async deriveSharedKey(_peerPublicKey: string): Promise<void> {}
  
  async encrypt(_target: string, _plaintext: string): Promise<string> {
    throw new CryptoNotAvailableError();
  }
  
  async decrypt(_sender: string, _ciphertext: string): Promise<string> {
    throw new CryptoNotAvailableError();
  }
}
