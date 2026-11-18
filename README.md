<div align="center">

# ⚡ BitChat

### Truly Private, Phone-Numberless Messaging for Everyone.

**No phone numbers. No email signups. No tracking. Just fast, simple, encrypted chat.**

[![Tests](https://img.shields.io/badge/tests-45%20backend%20%7C%2024%20web%20passed-23a55a?style=for-the-badge&logo=pytest)](https://github.com/Sujay-korde/BitChat)
[![License: MIT](https://img.shields.io/badge/License-MIT-5865f2.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178c6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<p align="center">
  <a href="https://bitchat-client.vercel.app"><b>🚀 Try Live Demo</b></a> •
  <a href="#-why-bitchat">Why BitChat?</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works-in-plain-english">How It Works</a> •
  <a href="#-fork--build-with-us">Fork & Build</a>
</p>

> 🌟 **Love open-source privacy? Please give this repository a ⭐ Star and 🍴 Fork it to support independent communication!**

</div>

---

## 💡 Why BitChat?

Most messaging apps today track you before you even send your first message: they demand your phone number, sync your private contacts, and store conversation records on corporate cloud servers.

**BitChat changes that completely:**

- 📱 **No Phone Number or Email:** You never have to give away your phone number or verify via SMS. Choose any username, and your device generates its own private cryptographic keys on the spot.
- 🔒 **100% Private (End-to-End Encrypted):** Everything you send—text, photos, files—is encrypted right on your device. The server only sees scrambled data and cannot read your messages.
- 💬 **Direct Messages & Channels:** Talk 1-on-1 with friends or create group channels for your projects with instant real-time sync.
- 📎 **Encrypted File & Photo Sharing:** Send images, documents, and videos safely. Each file is encrypted with a unique key before uploading.
- 💾 **Your History Stays on Your Device:** Your conversations and contacts remain saved locally on your device across reloads, never mined on a server database.
- ⚡ **1-Click Self-Hostable:** Run your own private server using Docker in 30 seconds, or connect to our free public cloud server.

---

## 🚀 Quick Start (Try It in 30 Seconds!)

### Option 1: Use the Live Web App (No Installation Needed)

1. Open the live app: **[https://bitchat-client.vercel.app](https://bitchat-client.vercel.app)**
2. In the **SERVER** box, click **`⚡ Cloud (Railway)`**.
3. Choose any username and click **Connect**.
4. Open another tab or share the link with a friend to start chatting!

---

### Option 2: Run Locally on Your Machine

#### 1. Clone the repository
```bash
git clone https://github.com/Sujay-korde/BitChat.git
cd BitChat
```

#### 2. Start the Backend Server (Python 3.11+)
```bash
# Setup virtual environment
python -m venv .venv

# Activate:
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -e .[dev]

# Start the server (runs TCP, WebSockets, and Media API)
python -m securechat.server.main
```

#### 3. Start the Web Client
In a second terminal:
```bash
cd web
npm install
npm run dev
```
Open **`http://localhost:5173`**, click **`💻 Localhost`**, and enjoy!

---

## ✨ Features at a Glance

| Feature | What It Does | Why You’ll Love It |
| :--- | :--- | :--- |
| **No Phone Number Needed** | Generates keys locally in your browser | Zero identity leaks, SIM-swap immune |
| **Direct Messages (1-on-1)** | Encrypted using X25519 & AES-256-GCM | No one between you can read your chat |
| **Group Channels** | Megolm group encryption ratchets | Fast group chats that remain completely private |
| **Encrypted Attachments** | Files encrypted before upload | Safe photo, video, and document sharing |
| **Local Chat History** | Automatically saved in your browser storage | Re-login anytime and all your chats are intact |
| **Modern Dark Theme** | Obsidian slate aesthetic | Clean, fast, distraction-free chatting |
| **Anti-Replay Protection** | Verified message sequences | Protects against message spoofing and tampering |

---

## 🔍 How It Works (In Plain English)

```
[ Your Device ]                           [ BitChat Server ]                           [ Friend's Device ]
  Generates private keys                      (Untrusted Relay)                           Receives message
        │                                             │                                          │
        ├── 1. Encrypts message on your device ───────┤                                          │
        │      (Only friend's key can open it)        │                                          │
        │                                             │                                          │
        └── 2. Sends scrambled ciphertext ───────────┼── 3. Relays scrambled code ──────────────┤
                                                      │      (Server CANNOT read it!)            │
                                                      │                                          └── 4. Decrypts locally
                                                                                                        and displays text
```

1. **You own your keys:** When you type a username, your device creates cryptographic keys (Ed25519 for identity, X25519 for encryption).
2. **Messages are locked before sending:** Your device locks your message using AES-256-GCM encryption.
3. **The server is a blind messenger:** The server passes the locked data along. It has no key, so it cannot read a single word.
4. **Only the recipient can unlock:** When your friend receives the data, their device unlocks it and displays the message.

---

## 🍴 Fork & Build With Us

BitChat is **100% open-source under the MIT license**. 

We encourage you to:
- 🍴 **Fork the repository** to build your own private company/team messenger.
- 🎨 **Customize the UI theme** or add custom emojis and notifications.
- 🛠️ **Add new features** (like voice/video calls or mobile apps).
- ⭐ **Star the repo** so more people discover private, phone-numberless communication.

```bash
# Fork the repo on GitHub, then clone your fork:
git clone https://github.com/YOUR_USERNAME/BitChat.git
git checkout -b feature/my-new-feature
```

---

## 🧪 Tested & Verified

BitChat includes a full automated test suite to ensure rock-solid reliability and security:

```bash
# Run backend cryptographic & network tests (45 tests)
pytest tests -v

# Run web client tests (24 tests)
cd web
npm test
```

- ✅ **45/45 Backend Tests Passed:** Anti-replay, encryption, group ratchets, and media uploads.
- ✅ **24/24 Web Client Tests Passed:** Key exchange, offline persistence, and browser WebCrypto interoperability.

---

## 🐳 1-Command Docker Run

Want to self-host for your friends, family, or team?

```bash
# Build & run with Docker on port 8080
docker build -t bitchat .
docker run -p 8080:8080 -e PORT=8080 bitchat
```

---

## 📄 License

Distributed under the **MIT License**. Free for personal and commercial use.

---

<div align="center">

### ⭐ Support Private Communication

If you believe people should be able to chat without giving away their phone numbers, please **give this project a star** and share it with friends!

[![Star on GitHub](https://img.shields.io/github/stars/Sujay-korde/BitChat?style=social)](https://github.com/Sujay-korde/BitChat)
[![Fork on GitHub](https://img.shields.io/github/forks/Sujay-korde/BitChat?style=social)](https://github.com/Sujay-korde/BitChat/fork)

</div>
