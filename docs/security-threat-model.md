# SecureChat Security Threat Model & Audit

This document details the exact security properties and vulnerabilities of the current SecureChat protocol and implementation (Phase 5C.1 checkpoint).

## Threat Classifications

| Threat Actor / Vector | Status | Description |
| :--- | :--- | :--- |
| **Passive Network Observer** | **PROTECTED** | TLS/WSS secures the transport. Even if TLS is stripped, end-to-end payloads are encrypted with AES-256-GCM. Passive observers cannot decrypt payloads without the shared keys. |
| **Malicious Server (Reading)** | **PROTECTED** | The server acts only as a ciphertext relay and reads routing metadata (`sender`, `target`, `msg_id`). It never sees plaintexts and does not possess private/shared keys. |
| **Malicious Server (Tampering)** | **PROTECTED** | AES-GCM generates a 16-byte authentication tag. Any tampering with the ciphertext or nonce will fail decryption (`InvalidTag` in Python or `OperationError` in JS). |
| **Malicious Server (Replay)** | **PROTECTED** | The protocol uses explicit `sequence_number` tracking bound via AAD for room messages and DMs. The unified `_handle_frame` logic tracks per-sender monotonic sequence numbers; an identical replay of a valid ciphertext is immediately rejected. |
| **Malicious Server (Spoofing/Routing)** | **PROTECTED** | The AES-GCM encryption uses Associated Data (AAD) to cryptographically bind the routing envelope (`sender`, `target`, `room_id`, `key_version`). A malicious router cannot spoof the `sender` identity or move messages between rooms, as any alteration triggers an authentication tag failure. |
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
| Replay protection | **PROTECTED** | Implemented sequence tracking and cryptographic timestamps via AAD; `test_dm_replay_and_aad_tampering` confirms strict sequence enforcement for DMs. |
| Message metadata authenticity | **PROTECTED** | AES-GCM AAD now securely binds metadata like `room_id`, `sender`, and `key_version` to the ciphertext. |
| Room isolation | **PROTECTED** | Room keys are securely generated via `WebCrypto` and distributed using E2E pairwise channels. |
| Room forward secrecy | **PARTIALLY PROTECTED** | Room keys rotate (epochs) when a member leaves (via new key distribution), but there is no per-message Double Ratchet forward secrecy. |
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
* **AAD Extension**: Implemented deterministic AAD formatting (Version, Type, TargetType, Target, KeyVersion, Sender, Sequence) ensuring routing metadata cannot be tampered with.

## Claims SecureChat CAN Safely Make
* "Messages are encrypted client-side using AES-256-GCM before transmission."
* "The server operates as a ciphertext relay and cannot decrypt or read the plaintext of messages."
* "Browser and Python clients use highly interoperable, standards-compliant cryptographic primitives (X25519/HKDF/AES-GCM)."
* "AES-GCM authentication tags and AAD detect any ciphertext or routing metadata tampering."
* "Client-side moderation successfully prevents restricted plaintexts from ever reaching the encryption layer or the network."
* "Room Messaging is protected via distributed Shared Symmetric Keys that rotate upon membership changes, secured by the pairwise X25519 authenticated channel."

## Claims SecureChat MUST NOT Make
* "Forward-secret" or "Post-compromise secure"
* "Replay-proof" or "Spoof-proof"
* "Military-grade" or "Unbreakable"
