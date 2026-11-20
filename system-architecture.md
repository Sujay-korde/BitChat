# BitChat — System Architecture & Protocol Specification

## 1. Executive Overview

**BitChat** is a zero-knowledge, local-first, end-to-end encrypted (E2EE) messaging platform engineered for high-assurance confidentiality, cryptographic integrity, and sovereign data ownership. 

The system implements a **Hybrid Zero-Knowledge Relational Architecture** (similar to Signal and WhatsApp):
* **Cryptographic Sovereignty**: Encryption and decryption occur strictly on client endpoints using **AES-256-GCM** with authenticated metadata binding (**AAD**), authenticated identity signatures (**Ed25519**), and ephemeral key exchange (**X25519 ECDH**).
* **Zero-Knowledge Transport & Relay**: The central server acts as an untrusted message router. It inspects only message routing metadata and never has access to encryption keys, plaintext message text, or media attachments.
* **ACID Relational Persistence**: An embedded **SQLite 3** relational database operates in WAL (Write-Ahead Logging) mode on the server to provide persistent offline store-and-forward queues, user registries, and channel topologies without violating zero-knowledge invariants.

---

## 2. Layered System Architecture Diagram (IEEE Block Style)

```mermaid
flowchart TD
    %% ==========================================
    %% IEEE Minimalist Layered Architecture Diagram
    %% ==========================================

    subgraph TIER_CLIENT ["1. CLIENT TIER (User Endpoint Application)"]
        direction TB
        subgraph CLIENT_UI ["Presentation & State Subsystem"]
            UI_VIEW["User Interface Layer\n(React 19 / TypeScript / Virtualized Viewports)"]
            STATE_STORE["Reactive Local State Store\n(Zustand Conversation Graph & Presence Cache)"]
        end

        subgraph CLIENT_CORE ["Client Core & Cryptographic Subsystem"]
            SEC_CLIENT["SecureChatClient Core Engine\n(Envelope Assembly, Monotonic Sequence Counter)"]
            CRYPTO_ENGINE["Cryptographic Operations Unit (Web Crypto API)\n(X25519 ECDH, Ed25519 Signatures, AES-256-GCM, HKDF-SHA256)"]
            LOCAL_STORE[("Local Document Store (LocalStorage)\n• Decrypted History (securechat_{user}_messages)\n• Anti-Replay Sequences (securechat_client_state)")]
        end

        UI_VIEW <--> STATE_STORE
        STATE_STORE <--> SEC_CLIENT
        SEC_CLIENT <--> CRYPTO_ENGINE
        SEC_CLIENT <--> LOCAL_STORE
    end

    TIER_CLIENT <===> |"Full-Duplex TLS 1.3 / WSS Framing\n(Zero-Knowledge Ciphertext Envelopes)"| TIER_SERVER

    subgraph TIER_SERVER ["2. SERVER TIER (Zero-Knowledge Relay Node)"]
        direction TB
        subgraph INGRESS_LAYER ["Protocol Ingress & Demultiplexing"]
            CONN_HANDLER["Connection Multiplexer (Asyncio)\n(Dual-Stack WebSocket & TCP Ingress)"]
            ROUTER["Message Router & Policy Enforcement\n(Schema Validation, Rate Limiter, Sender Binding)"]
        end

        subgraph RELAY_CORE ["State & Event Orchestration"]
            SESSION_REG["Active Session & Presence Broker\n(Ephemeral In-Memory Connection Map)"]
            MEDIA_SERVICE["Encrypted Media Ingestion Daemon\n(HTTP Binary Streaming Handler)"]
        end

        CONN_HANDLER <--> ROUTER
        ROUTER <--> SESSION_REG
        ROUTER <--> MEDIA_SERVICE
    end

    TIER_SERVER <===> |"Thread-Safe ACID Operations\n(WAL Journaling Mode, Foreign Keys: ON)"| TIER_STORAGE

    subgraph TIER_STORAGE ["3. PERSISTENCE TIER (Storage Layer)"]
        direction LR
        SQLITE_DB[("Relational Database (bitchat.db)\n• users (Identities & Last Seen)\n• messages (Ciphertext Offline Queue & History)\n• rooms & room_members (Channel Topology)\n• media_blobs (Encrypted File Index)")]
        BLOB_STORE[("Media Object Store (media_storage/)\n(Opaque Ciphertext Binary Files Keyed by UUIDv4)")]
    end

    ROUTER <--> SQLITE_DB
    MEDIA_SERVICE <--> BLOB_STORE
```

---

## 3. End-to-End Cryptographic Protocol Workflow

The diagram below details the 8 sequential stages of message delivery between two clients (Alice and Bob):

```mermaid
flowchart TD
    %% 8-Stage E2EE Workflow
    B1["1. Key Agreement (X25519 ECDH + HKDF-SHA256)\nAlice and Bob exchange public keys; derive a shared 256-bit symmetric key (K)."] --> 
    B2["2. Nonce Generation (CSPRNG)\nAlice generates a single-use 12-byte random Initialization Vector (IV)."]

    B2 --> 
    B3["3. AAD Construction (Anti-Tampering & Anti-Replay)\nAlice binds metadata: Version (1) + Target (bob) + Sender (alice) + Sequence (seq + 1)."]

    B3 --> 
    B4["4. Symmetric Encryption (AES-256-GCM)\nAlice encrypts Plaintext + AAD with Key (K) producing Ciphertext + 16-byte Auth Tag."]

    B4 --> 
    B5["5. Wire Packaging & Zero-Knowledge Relay\nWrapped in MessageEnvelope; server validates sender, stores in SQLite, and relays blindly."]

    B5 --> 
    B6["6. Anti-Replay Verification\nBob receives frame and verifies msgSeq > lastRecordedSeq (rejects replayed frames)."]

    B6 --> 
    B7["7. Authentication & Decryption (AES-256-GCM)\nBob verifies 16-byte Auth Tag against AAD with Key (K). If valid, decrypts to Plaintext."]

    B7 --> 
    B8["8. Local Persistence & UI Display\nBob updates local sequence counter, saves message to LocalStorage, and renders in UI."]
```

---

## 4. Database Architecture & Entity-Relationship Model (`bitchat.db`)

The server uses an embedded relational database to persist state across sessions without holding plaintext:

```mermaid
erDiagram
    USERS ||--o{ MESSAGES : "sends"
    USERS ||--o{ ROOM_MEMBERS : "joins"
    ROOMS ||--o{ ROOM_MEMBERS : "contains"
    ROOMS ||--o{ MESSAGES : "receives"
    
    USERS {
        TEXT username PK "Unique user handle (e.g. alice)"
        TEXT identity_key "Base64-encoded Ed25519 public key"
        INTEGER created_at "Unix epoch timestamp"
        INTEGER last_seen "Unix epoch timestamp"
    }

    ROOMS {
        TEXT room_name PK "Normalized channel identifier (e.g. dev)"
        INTEGER created_at "Unix epoch timestamp"
    }

    ROOM_MEMBERS {
        INTEGER id PK "Auto-increment primary key"
        TEXT room_name FK "References rooms(room_name) ON DELETE CASCADE"
        TEXT username FK "References users(username) ON DELETE CASCADE"
        INTEGER joined_at "Unix epoch timestamp"
    }

    MESSAGES {
        TEXT msg_id PK "Unique message identifier"
        TEXT sender FK "References users(username)"
        TEXT target "Recipient username or room name"
        TEXT target_type "CHECK: 'user' or 'room'"
        TEXT ciphertext "Opaque AES-256-GCM payload"
        INTEGER timestamp "Unix epoch timestamp"
        INTEGER is_delivered "0 = Pending Offline Queue, 1 = Delivered"
    }

    MEDIA_BLOBS {
        TEXT blob_id PK "UUIDv4 storage reference"
        INTEGER file_size "Size in bytes"
        INTEGER uploaded_at "Unix epoch timestamp"
    }
```

### Relational Database Constraints & Indexing
* **Foreign Key Constraints**: Enforced via `PRAGMA foreign_keys = ON;`. Deleting a user or channel cascades to its memberships.
* **Concurrency**: Configured with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging) and `PRAGMA synchronous = NORMAL;`, permitting concurrent non-blocking reads during active writes.
* **Performance Indexes**:
  * `idx_messages_target`: Speeds up room and direct message lookups.
  * `idx_messages_undelivered`: Filtered index on `(target, is_delivered) WHERE target_type = 'user'` for $O(1)$ offline message flushes on user authentication.
  * `idx_messages_timestamp`: Chronological sort optimization for channel history replay.

---

## 5. Protocol Specifications

### 5.1 Transport Framing
Messages travel across full-duplex TCP or WebSocket streams wrapped in length-prefixed framing:
$$\text{Wire Frame} = [\text{4-byte Big-Endian Length Header}] + [\text{UTF-8 JSON MessageEnvelope}]$$

### 5.2 Message Envelope Schema
All network exchanges conform to a strictly validated protocol envelope:
```json
{
  "type": "MSG",
  "msg_id": "alice-1711234567-xyz",
  "sender": "alice",
  "target": "bob",
  "target_type": "user",
  "timestamp": 1711234567,
  "payload": "{\"key_version\":0,\"sequence_number\":1,\"ciphertext\":\"...\"}"
}
```

### 5.3 Cryptographic Primitives
| Cryptographic Operation | Algorithm / Standard | Purpose |
| :--- | :--- | :--- |
| **Identity Authentication** | Ed25519 (`edwards25519`) | Digital signatures binding user session to username |
| **Key Agreement** | X25519 (`curve25519`) | Elliptic-Curve Diffie-Hellman ephemeral key exchange |
| **Key Derivation** | HKDF-SHA256 (RFC 5869) | Derives 256-bit symmetric key from shared secret |
| **Payload Encryption** | AES-256-GCM (NIST SP 800-38D) | Authenticated encryption with 12-byte IV + 16-byte tag |
| **Group Key Derivation** | SHA-256 (`bitchat-room-v1:{room}`) | Deterministic room key derivation for group channels |
| **Attachment Encryption** | AES-256-GCM + SHA-256 Hash | File encryption with unique random symmetric key per blob |

---

## 6. Security & Threat Mitigation Matrix

| Attack Vector | Threat Description | Architectural Mitigation |
| :--- | :--- | :--- |
| **Replay Attacks** | Attacker intercepts and replays valid ciphertext frames. | **Monotonic Sequence Numbers + AAD**: Sequence numbers are cryptographically bound inside the GCM auth tag and checked via `msgSeq > lastSeq`. |
| **Man-in-the-Middle (MITM)** | Malicious network node intercepts or modifies traffic. | **TLS 1.3 Transport Encryption + Out-of-Band Fingerprints**: All traffic is secured via TLS, and clients compute SHA-256 visual fingerprints from identity keys. |
| **Identity Spoofing** | Attacker transmits frames with another user's `sender` field. | **Server-Enforced Sender Binding**: Server overwrites envelope sender with the verified authenticated session identity. |
| **Server Compromise / Subpoena** | Server filesystem or database is inspected by an adversary. | **Zero-Knowledge Architecture**: The database stores only opaque ciphertexts. Plaintext messages and keys are never present in server RAM or disk. |
| **Metadata Tampering** | Attacker alters recipient, channel name, or message ID in transit. | **Associated Authenticated Data (AAD)**: Metadata fields are included in the GCM tag computation; any modification invalidates the auth tag. |
