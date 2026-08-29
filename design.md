# SecureChat — System Design Document

> **Purpose of this file:** This is the single source of truth for the project's architecture, protocol, and feature scope. Use this as context for AI coding assistance — every module, message type, and function signature described here should be implemented as specified, not reinvented.

---

## 1. Product Overview

**What it is:** A client-server chat application built on a custom application-layer protocol (over raw TCP), with end-to-end encryption and real-time AI-based content moderation.

**Why it exists (the pitch):** Most chat apps are built on top of existing libraries (Socket.IO, Firebase, etc.), which hides the actual networking. This project demonstrates protocol design, secure key exchange, and applied ML — three distinct engineering skills in one working system.

**Target user:** Small teams / groups needing private, moderated real-time messaging. Not aiming for internet scale — aiming for a correct, well-documented, defensible design.

---

## 2. Requirements (PRD Summary)

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | User can register/authenticate with a username |
| FR2 | User can join/leave named rooms |
| FR3 | User can send/receive messages in a room in real time |
| FR4 | User can send direct messages (1:1) |
| FR5 | Server maintains presence (online/offline) per user |
| FR6 | Messages are end-to-end encrypted — server never sees plaintext |
| FR7 | Every outgoing message is scanned for toxic/harassing content before delivery |
| FR8 | Flagged messages are blocked or warned, not silently delivered |
| FR9 | Client reconnects gracefully after a dropped connection, without losing session |
| FR10 | Server supports multiple concurrent clients (target: 50+ for demo purposes) |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Protocol must handle TCP stream issues (partial reads, fused messages) correctly |
| NFR2 | Encryption handshake must provide forward secrecy (stretch goal) |
| NFR3 | Moderation inference must not noticeably delay message delivery (<300ms) |
| NFR4 | System must degrade gracefully — moderation model failure should not crash the server |
| NFR5 | Code must be modular: protocol, crypto, and ML layers independently testable |

### 2.3 Explicit Non-Goals (keep scope sane for 2–4 weeks)

- No horizontal scaling / distributed server cluster
- No mobile client — CLI or simple desktop client only
- No persistent database at first pass (in-memory + optional SQLite for history)
- No group-key encryption complexity (pairwise E2E for DMs; rooms can be server-visible initially, see §6.4 for upgrade path)

---

## 3. System Architecture

### 3.1 High-Level Diagram

```
┌─────────────┐        Custom TCP Protocol        ┌─────────────┐
│  Client A   │◄──────────────────────────────────►│             │
│ (CLI/GUI)   │      (length-prefixed frames)       │             │
└─────────────┘                                     │             │
                                                     │   Server    │
┌─────────────┐                                     │             │
│  Client B   │◄──────────────────────────────────►│  (asyncio)  │
└─────────────┘                                     │             │
                                                     └──────┬──────┘
                                                            │
                                              ┌─────────────┴─────────────┐
                                              │   Moderation Service      │
                                              │  (local ML classifier,    │
                                              │   in-process or subprocess)│
                                              └────────────────────────────┘
```

### 3.2 Component Breakdown

- **Client**
  - Connection manager (socket, reconnect/heartbeat logic)
  - Crypto module (DH key exchange, AES encrypt/decrypt)
  - CLI/UI layer (input handling, message rendering)
- **Server**
  - Connection handler (accepts clients, manages sessions)
  - Router (dispatches messages by `type` to the right handler)
  - Presence manager (tracks online/offline state)
  - Room manager (membership, broadcast)
  - Moderation gateway (calls ML service before relaying message)
- **Moderation Service**
  - Lightweight text classifier (see §7)
  - Exposed as a local function call or small internal API — not a network hop in v1

### 3.3 Data Flow (sending a message)

1. Client encrypts message body with session AES key
2. Client wraps it in a protocol frame (`type: MSG`) and sends over TCP
3. Server reads frame, identifies message type, routes to Room/DM handler
4. **Server cannot read the ciphertext body** — but plaintext moderation requires visibility. See §7.1 for how this tension is resolved.
5. Server relays frame to recipient(s)
6. Recipient decrypts and renders

---

## 4. Protocol Design

### 4.1 Framing

Every message on the wire:

```
[4 bytes: big-endian uint32 payload length][payload bytes, UTF-8 JSON]
```

This solves TCP's core problem for this project: `recv()` gives you a byte stream, not message boundaries. The length prefix tells the receiver exactly how many bytes to buffer before attempting to parse — never assume one `recv()` call equals one message.

### 4.2 Message Envelope (JSON schema)

```json
{
  "type": "MSG",
  "msg_id": "uuid4-string",
  "sender": "alice",
  "target": "general",        // room name or username for DMs
  "target_type": "room",      // "room" | "user"
  "timestamp": 1755000000,
  "payload": "base64-ciphertext-or-plaintext-control-data"
}
```

### 4.3 Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `AUTH` | C→S | Register/login with username |
| `AUTH_OK` / `AUTH_FAIL` | S→C | Auth result |
| `KEY_EXCHANGE` | C↔S↔C | Carries DH public parameters between two clients (server relays only, never derives the key) |
| `JOIN` | C→S | Join a room |
| `LEAVE` | C→S | Leave a room |
| `MSG` | C→S→C | Chat message (room or DM) |
| `ACK` | S→C | Delivery confirmation |
| `PRESENCE` | S→C | Broadcast user online/offline change |
| `HEARTBEAT` | C↔S | Keep-alive, sent every N seconds |
| `MODERATION_WARN` | S→C | Message was flagged/blocked, with reason |
| `ERROR` | S→C | Generic protocol error |

### 4.4 Connection Lifecycle

```
Connect → AUTH → AUTH_OK → KEY_EXCHANGE (per-peer) → JOIN → 
  [MSG / HEARTBEAT loop] → LEAVE / disconnect
```

### 4.5 Reconnection Strategy

- Client sends `HEARTBEAT` every 15s; if server misses 2 consecutive heartbeats from a client, mark offline and broadcast `PRESENCE`
- On client-side disconnect detection, attempt reconnect with exponential backoff (1s, 2s, 4s... capped at 30s)
- On reconnect, client re-sends `AUTH` and re-`JOIN`s previously active rooms (tracked client-side)

---

## 5. Encryption Design

### 5.1 Handshake (per DM pair, or per room key for group chat)

1. Client A generates DH keypair, sends public value via `KEY_EXCHANGE` (server relays, cannot compute the shared secret)
2. Client B does the same, replies via `KEY_EXCHANGE`
3. Both derive the same shared secret independently
4. Shared secret → HKDF → AES-256 session key
5. All subsequent `MSG` payloads between A and B are AES-GCM encrypted with this session key

### 5.2 What the Server Can and Cannot See

| Data | Server visibility |
|------|-------------------|
| Sender, recipient, timestamp, message type | **Visible** (needed for routing) |
| Message body (plaintext) | **Not visible** — encrypted client-side |

### 5.3 Forward Secrecy (stretch goal)

Rotate the session key every N messages or every T minutes by re-running the DH exchange. Old keys are discarded, so a compromised key doesn't expose message history.

---

## 6. Room Architecture

### 6.1 v1 (in scope): Server-visible rooms

Room messages are encrypted with a per-room symmetric key shared among members (distributed via pairwise `KEY_EXCHANGE` to each joining member). Simpler to implement; server still can't read content, but a compromised member exposes the room key.

### 6.2 Membership

Server keeps an in-memory map: `room_name → set(usernames)`. On `JOIN`/`LEAVE`, update this map and broadcast `PRESENCE`.

### 6.3 Message History (optional)

If implemented, store only **ciphertext** + metadata in SQLite, so history persists without the server ever holding plaintext.

### 6.4 Upgrade Path (explicitly out of scope, mention in README as future work)

True group E2E (Signal-style sender keys / MLS protocol) — worth naming in your write-up to show you know the limitation of v1's shared-room-key approach.

---

## 7. AI Moderation Layer

### 7.1 The Core Tension (and how to resolve it — this is a good interview talking point)

You can't run content moderation on ciphertext. Two honest options:

- **Option A (recommended for this project):** Moderation runs **client-side**, before encryption. The client scans its own outgoing message, blocks/warns locally if flagged, and only encrypts+sends if it passes. This preserves true E2E privacy — the server still never sees plaintext, ever.
- **Option B:** Moderation runs server-side, which requires either non-E2E group messages (server has room key) or a "moderation-only" decrypt scope. More realistic for platform-operated moderation, but weakens the privacy story.

**Design decision for this project: Option A**, framed explicitly in your README as: *"Moderation is enforced client-side to preserve end-to-end privacy — a deliberate tradeoff, not an oversight."* This is a stronger, more defensible design than silently making the server semi-trusted.

### 7.2 Model

- Lightweight text classifier — start with a pretrained toxicity model (e.g., a small fine-tuned DistilBERT or even a classical TF-IDF + logistic regression baseline for the first pass, upgrade if time allows)
- Runs as a local inference call in the client process, not a network call — keeps NFR3 (<300ms) achievable

### 7.3 Flow

```
User types message → client runs moderation check →
  PASS → encrypt → send as MSG
  FAIL → show local warning, do not send (optionally: send MODERATION_WARN to self for logging)
```

### 7.4 Stretch: Anomaly/Spam Detection

Server-side (this one *can* be server-side since it only needs metadata, not content): track message timing per user; flag bursty/bot-like patterns using a simple rate/statistical model. Ties back to your networking traffic-analysis instincts without touching plaintext.

---

## 8. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | Python 3.11+ | Fast to build, readable for demos/interviews |
| Networking | `asyncio` + `asyncio.start_server` | Handles concurrency cleanly without manual thread management |
| Crypto | `cryptography` library (DH, AES-GCM, HKDF) | Don't hand-roll crypto primitives — do explain the handshake yourself |
| ML | `scikit-learn` (baseline) → `transformers` (upgrade) | Fast baseline first, upgrade if time allows |
| Client UI | CLI first (`prompt_toolkit` for a nicer terminal UX); optional `Tkinter`/`PyQt` GUI stretch | Keeps scope realistic |
| Storage (optional) | SQLite | Zero-setup persistence for ciphertext history |

---

## 9. Project Structure

```
securechat/
├── design.md                  # this file
├── README.md                  # setup + protocol writeup for resume/demo
├── server/
│   ├── main.py                 # asyncio server entrypoint
│   ├── router.py                # message type dispatch
│   ├── session.py               # per-client session state
│   ├── rooms.py                  # room membership management
│   └── presence.py               # online/offline tracking
├── client/
│   ├── main.py                 # CLI entrypoint
│   ├── connection.py            # socket + reconnect/heartbeat logic
│   ├── crypto.py                 # DH exchange, AES encrypt/decrypt
│   └── ui.py                      # terminal rendering
├── protocol/
│   ├── framing.py               # length-prefix encode/decode
│   ├── schema.py                 # message envelope validation
│   └── types.py                   # message type constants
├── moderation/
│   ├── classifier.py             # model load + predict
│   └── train.py                    # (if fine-tuning) training script
└── tests/
    ├── test_framing.py
    ├── test_crypto.py
    └── test_moderation.py
```

---

## 10. Build Plan (4 weeks)

- **Week 1:** `protocol/` (framing + schema) + basic `server/` and `client/` — plaintext MSG working end-to-end, multi-client, JOIN/LEAVE, presence, heartbeat/reconnect
- **Week 2:** `client/crypto.py` — DH handshake, AES-GCM encrypt/decrypt integrated into the MSG flow; verify server genuinely cannot decrypt
- **Week 3:** `moderation/` — baseline classifier, wire into client pre-send flow, test with adversarial examples
- **Week 4:** Polish CLI UX, add SQLite ciphertext history (optional), write README (protocol diagram + design rationale), record a short demo

---

## 11. Resume/Interview Framing

**One-liner:** *"Designed and implemented a custom TCP-based chat protocol with end-to-end encryption (Diffie-Hellman + AES-GCM) and client-side ML-based content moderation, supporting concurrent multi-client sessions with graceful reconnection handling."*

**Anticipated interview questions this project prepares you for:**
- "How does TCP framing work, and why can't you just read JSON off a socket?" → §4.1
- "Walk me through your key exchange." → §5.1
- "How do you moderate content you can't read?" → §7.1 (this is your best answer — it shows real design thinking, not just feature-stacking)
- "What would you change for production scale?" → §6.4, NFR list, non-goals
