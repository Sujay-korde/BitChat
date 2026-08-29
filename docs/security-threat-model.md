# SecureChat Security Threat Model & Audit

This document details the exact security properties and vulnerabilities of the current SecureChat protocol and implementation (Phase 5C.1 checkpoint).

## Threat Classifications

| Threat Actor / Vector | Status | Description |
| :--- | :--- | :--- |
| **Passive Network Observer** | **PROTECTED** | TLS/WSS secures the transport. Even if TLS is stripped, end-to-end payloads are encrypted with AES-256-GCM. Passive observers cannot decrypt payloads without the shared keys. |
| **Malicious Server (Reading)** | **PROTECTED** | The server acts only as a ciphertext relay and reads routing metadata (`sender`, `target`, `msg_id`). It never sees plaintexts and does not possess private/shared keys. |
| **Malicious Server (Tampering)** | **PROTECTED** | AES-GCM generates a 16-byte authentication tag. Any tampering with the ciphertext or nonce will fail decryption (`InvalidTag` in Python or `OperationError` in JS). |
| **Malicious Server (Replay)** | **NOT PROTECTED** | The protocol lacks sequence numbers or cryptographic timestamp binding inside the ciphertext. A server or MITM can capture a valid encrypted `MSG` and replay it indefinitely. |
| **Malicious Server (Spoofing/Routing)** | **NOT PROTECTED** | The AES-GCM encryption does not use Associated Data (AAD) to bind the routing envelope (`sender`, `target`). A malicious router can spoof the `sender` identity for users who share the same AES key (e.g., in a Room). |
| **Man-in-the-Middle (Key Exchange)** | **PROTECTED** | The `KEY_EXCHANGE` protocol now uses Signed Ephemeral Keys via long-term Ed25519 Identity Keys. Active MITM attacks attempting to substitute ephemeral keys are detected via signature validation failure. |
| **Compromised Endpoints** | **NOT PROTECTED** | Memory scraping, malware, or XSS can extract keys directly from the JS heap or Python process memory. |

## Required Security Matrix

| Security Property | Status | Evidence |
| :--- | :--- | :--- |
| Server cannot read message plaintext | **PROTECTED** | `test_server_ciphertext_only_invariant` passes. Code review of `router.py` shows only metadata is read. |
| Passive network observer cannot read plaintext | **PROTECTED** | AES-256-GCM encryption is applied before transmission in `app.py`. |
| Ciphertext tampering detected | **PROTECTED** | `test_tampered_ciphertext` passes. |
| Wrong-key decryption rejected | **PROTECTED** | `test_wrong_key` passes. |
| Peer identity authenticated | **PROTECTED** | `KEY_EXCHANGE` is signed by a long-term Ed25519 Identity Key. |
| MITM resistance | **PROTECTED** | `test_key_exchange_mitm_protection` passes. Ephemeral keys are bound to the Identity Key via cryptographic signatures. |
| Replay protection | **NOT PROTECTED** | Missing sequence tracking and cryptographic timestamps. |
| Message metadata authenticity | **NOT PROTECTED** | AES-GCM AAD is `None`. Routing metadata can be manipulated without failing decryption. |
| Room isolation | **NOT PROTECTED** | Room keys are stubs and not rotated. Currently hardcoded in tests (`alice.shared_keys["room_x"]`). |
| Room forward secrecy | **NOT PROTECTED** | Room keys do not rotate on join/leave. |
| Forward secrecy | **NOT PROTECTED** | Ephemeral keys remain static for the entire application session lifecycle. |
| Post-compromise security | **NOT PROTECTED** | No key ratcheting implemented (e.g., Double Ratchet). |
| Private keys protected from persistence | **PROTECTED** | Keys generated and stored only in RAM (no `localStorage`). |
| Shared keys protected from persistence | **PROTECTED** | Stored in in-memory dictionaries. |
| Nonce safety | **PROTECTED** | 12 bytes `os.urandom` and `crypto.getRandomValues`. Nonce reuse under same key prevented by random generation per `encrypt()` call. |
| Moderation occurs before encryption | **PROTECTED** | `test_moderation_before_encryption_and_rejection` passes. `app.py` moderates before encryption. |
| Plaintext never reaches server | **PROTECTED** | `router.py` never decrypts. Moderated rejections happen client-side. |
| Malformed protocol input handled safely | **PROTECTED** | Server router drops unknown `MessageType` variants. Schema validation rejects bad JSON. |
| Reconnection preserves security invariants | **PROTECTED** | `reconnect_forever` maintains shared keys in memory without exposing them. |

## Cryptographic Implementation Audit

### X25519 Key Exchange
* **Status**: Authenticated.
* **Compatibility**: Interoperable between Python `cryptography.hazmat` and TypeScript `@noble/curves`. Uses a JSON payload containing Ed25519 Identity Keys, X25519 ephemeral keys, and Ed25519 signatures.

### HKDF-SHA256
* **Status**: Correctly implemented and interoperable.
* **Parameters**: 32-byte output length, empty salt, and `info=b"securechat-aes-256-gcm"`.

### AES-256-GCM
* **Status**: Correctly implemented for payload confidentiality and payload integrity.
* **Weakness**: Does not use AAD to authenticate the `MessageEnvelope` routing metadata.

## Claims SecureChat CAN Safely Make
* "Messages are encrypted client-side using AES-256-GCM before transmission."
* "The server operates as a ciphertext relay and cannot decrypt or read the plaintext of messages."
* "Browser and Python clients use highly interoperable, standards-compliant cryptographic primitives (X25519/HKDF/AES-GCM)."
* "AES-GCM authentication tags detect any ciphertext tampering and incorrectly derived keys."
* "Client-side moderation successfully prevents restricted plaintexts from ever reaching the encryption layer or the network."

## Claims SecureChat MUST NOT Make
* "Forward-secret" or "Post-compromise secure"
* "Replay-proof" or "Spoof-proof"
* "Military-grade" or "Unbreakable"
* "Room confidentiality guaranteed" (since room keys are completely stubbed out).
