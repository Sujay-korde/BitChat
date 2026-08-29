# SecureChat — System Architecture

```mermaid
flowchart LR
  %% =========================
  %% Styles
  %% =========================
  classDef client fill:#F8FBFF,stroke:#2563EB,stroke-width:1.5px,color:#0F172A;
  classDef server fill:#FFF7ED,stroke:#EA580C,stroke-width:2px,color:#7C2D12;
  classDef secure fill:#ECFDF5,stroke:#16A34A,stroke-width:2px,color:#064E3B;
  classDef plaintext fill:#FEF3C7,stroke:#D97706,stroke-width:1.5px,color:#78350F;
  classDef relay fill:#F3F4F6,stroke:#6B7280,stroke-width:1.5px,color:#111827;
  classDef legend fill:#F9FAFB,stroke:#94A3B8,color:#0F172A;

  %% =========================
  %% Clients
  %% =========================
  subgraph CA[Chat Client A]
    direction TB
    AUI[Message Composer / UI]
    AMod[Local ML Moderation Classifier]
    ACrypto[🔒 Crypto Module\nDH key exchange + AES-GCM]
    AConn[Connection Manager]
    AUI -->|plaintext message| AMod -->|approved message| ACrypto -->|encrypted frame| AConn
  end

  subgraph CB[Chat Client B]
    direction TB
    BUI[Message Composer / UI]
    BMod[Local ML Moderation Classifier]
    BCrypto[🔒 Crypto Module\nDH key exchange + AES-GCM]
    BConn[Connection Manager]
    BUI -->|plaintext message| BMod -->|approved message| BCrypto -->|encrypted frame| BConn
  end

  subgraph CC[Chat Client C...]
    direction TB
    CUI[Message Composer / UI]
    CMod[Local ML Moderation Classifier]
    CCrypto[🔒 Crypto Module\nDH key exchange + AES-GCM]
    CConn[Connection Manager]
    CUI -->|plaintext message| CMod -->|approved message| CCrypto -->|encrypted frame| CConn
  end

  %% =========================
  %% Server
  %% =========================
  subgraph SRV[Central Chat Server (async, TCP-based)]
    direction TB
    SH[Connection Handler]
    SRouter[Message Router]
    SRoom[Room Manager]
    SPresence[Presence Manager]
    SRelay[Key Exchange Relay Only\n(server forwards, does not compute)]
    SH --> SRouter
    SRouter --> SRoom
    SRouter --> SPresence
    SRouter -.-> SRelay
  end

  %% =========================
  %% TCP data path: ciphertext only
  %% =========================
  AConn -->|TCP + length-prefixed frames\nciphertext only — server cannot read content| SH
  BConn -->|TCP + length-prefixed frames\nciphertext only — server cannot read content| SH
  CConn -->|TCP + length-prefixed frames\nciphertext only — server cannot read content| SH

  SH -->|ciphertext only relay| SRouter
  SRouter -->|ciphertext only relay| AConn
  SRouter -->|ciphertext only relay| BConn
  SRouter -->|ciphertext only relay| CConn

  %% =========================
  %% Logical key exchange path
  %% =========================
  ACrypto -.->|KEY_EXCHANGE (DH public values)| SRelay -.->|relayed only| BCrypto
  BCrypto -.->|KEY_EXCHANGE (DH public values)| SRelay -.->|relayed only| ACrypto

  %% =========================
  %% Styling
  %% =========================
  class AUI,BUI,CUI plaintext;
  class AMod,BMod,CMod plaintext;
  class ACrypto,BCrypto,CCrypto secure;
  class AConn,BConn,CConn client;
  class SH,SRouter,SRoom,SPresence,SRelay server;

  %% Legend
  subgraph LEGEND[Legend]
    direction TB
    L1[Solid line = TCP connection using length-prefixed framing]
    L2[Dashed line = logical key-derivation relationship\n(no direct network hop / server relays only)]
    L3[🔒 / green = encrypted path\nplaintext is removed before leaving the client]
    L4[Orange server = routing, rooms, presence, and relay only]\n
  end
  class L1,L2,L3,L4 legend;
```

**Notes**
- Moderation is client-side and happens before encryption to preserve end-to-end privacy.
- The server relays ciphertext only and never receives plaintext message content.
