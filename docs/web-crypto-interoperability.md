# SecureChat Web Crypto Interoperability Contract

This document explicitly defines the cryptographic contract required to maintain interoperability between the browser frontend (Phase 5C) and the existing Python backend implementation.

## 1. Cryptographic Primitives

| Primitive | Python Implementation | Browser Target |
| :--- | :--- | :--- |
| **Key Exchange** | `x25519` (cryptography.hazmat) | `crypto.subtle` (if supported) or `@noble/curves/ed25519` for X25519 |
| **Shared Secret Derivation** | X25519 Exchange | X25519 Exchange |
| **KDF** | `HKDF` | WebCrypto `HKDF` |
| **KDF Hash** | `SHA-256` | WebCrypto `SHA-256` |
| **Symmetric Encryption** | `AES-GCM` | WebCrypto `AES-GCM` |
| **Authentication Tag** | 16 bytes (appended) | WebCrypto (128-bit tag length, appended) |
| **Nonce/IV** | 12 bytes (`os.urandom`) | WebCrypto `crypto.getRandomValues(12)` |

## 2. Key Generation & Serialization

- **Key Generation**: 
  - Each client generates one X25519 key pair per session lifetime.
- **Public Key Representation**:
  - Raw 32 bytes.
- **Key Exchange Message**:
  - The `KEY_EXCHANGE` payload is the standard Base64 string representation of the raw 32 bytes of the public key (decoded as ASCII on wire).
- **Private Key Storage**:
  - Exists entirely in-memory within the `CryptoProvider` implementation.
  - Never persisted to `localStorage` or `sessionStorage`.

## 3. Shared Key Derivation (HKDF)

Once the 32-byte shared secret is computed via X25519 DH, the actual 256-bit AES key is derived via HKDF-SHA256:

- **Algorithm**: HKDF
- **Hash**: SHA-256
- **Length**: 32 bytes (256 bits)
- **Salt**: `None` (empty byte array)
- **Info**: `b"securechat-aes-256-gcm"`

## 4. Encryption & Decryption (AES-GCM)

- **Input Plaintext**: 
  - A JSON dictionary object containing the payload (e.g., `{"text": "message"}`).
  - Encoded to `UTF-8` bytes.
- **Nonce/IV**: 
  - 12 random bytes generated per message.
- **Associated Data (AAD)**: 
  - `None` (empty).
- **Ciphertext Output**: 
  - AES-GCM output bytes + 16-byte authentication tag (Standard for Python `cryptography` and `WebCrypto`).

### Wire Format

The final encrypted string sent over the network is:
```text
Base64( Nonce [12 bytes] || Ciphertext || AuthTag [16 bytes] )
```
*Note: `crypto.subtle.encrypt` with AES-GCM returns `Ciphertext || AuthTag` as a single ArrayBuffer. Thus, the JS implementation simply prepends the Nonce and Base64-encodes the result.*

## 5. Message Lifecycle & Error Behavior

- **Moderation**: Must occur *before* encryption. 
- **Encryption Failure**: Aborts sending.
- **Decryption Failure**: Emits an error or is silently ignored by the client (Python drops it with `ValueError("Message authentication failed")`). The browser must catch WebCrypto `OperationError` (invalid tag/wrong key) and gracefully drop the message.
- **Server Knowledge**: The server routes messages opaquely based on the message envelope. The server NEVER sees plaintext and NEVER sees private keys.

## 6. Compatibility Strategy for X25519

X25519 is notoriously inconsistent across WebCrypto implementations (only recently standardized in modern browsers). 
- **Strategy**: The client will attempt to use native `crypto.subtle.generateKey({ name: "X25519" })`. 
- **Fallback/Polyfill**: If the target baseline requires broader support, a verified pure-JS library (e.g., `@noble/curves` or `tweetnacl`) will be injected solely for the DH exchange, while HKDF and AES-GCM will strictly use native WebCrypto for performance and security.
