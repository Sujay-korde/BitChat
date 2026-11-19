import type { Transport } from "../transport/Transport";
import { validateMessageEnvelope } from "../protocol/schema";
import type { MessageEnvelope } from "../protocol/schema";
import { MessageType, TargetType } from "../protocol/types";
import { ConnectionState, MessageState } from "./events";
import type { EventCallback, SecureChatEvent, AttachmentDescriptor } from "./events";
import type { CryptoProvider } from "../crypto/CryptoProvider";
import type { ModerationProvider } from "../moderation/ModerationProvider";

export class SecureChatClient {
  private async _deriveRoomKey(room: string): Promise<Uint8Array> {
    const normalized = room.trim().toLowerCase();
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(`bitchat-room-v1:${normalized}`));
    return new Uint8Array(hash);
  }

  private _bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private _base64ToBytes(base64: string): Uint8Array {
    if (!base64 || typeof base64 !== 'string') return new Uint8Array(0);
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      return new Uint8Array(0);
    }
  }

  private _saveState() {
    if (!this.username) return;
    try {
      if (typeof localStorage === 'undefined') return;
      const state = {
        sharedKeys: Array.from(this.sharedKeys.entries()).map(([k, v]) => [
          k,
          typeof v === 'string' ? v : this._bytesToBase64(v)
        ]),
        roomKeys: Array.from(this.roomKeys.entries()).map(([k, v]) => [
          k,
          { key: this._bytesToBase64(v.key), version: v.version }
        ]),
        dmSequences: Array.from(this.dmSequences.entries()),
        myDmSequences: Array.from(this.myDmSequences.entries()),
        roomSequences: Array.from(this.roomSequences.entries()).map(([room, userMap]) => [
          room,
          Array.from(userMap.entries())
        ]),
        myRoomSequences: Array.from(this.myRoomSequences.entries()),
      };
      localStorage.setItem(`securechat_client_state_${this.username}`, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save state", e);
    }
  }

  private _loadState() {
    if (!this.username) return;
    try {
      if (typeof localStorage === 'undefined') return;
      const saved = localStorage.getItem(`securechat_client_state_${this.username}`);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.sharedKeys && Array.isArray(state.sharedKeys)) {
          for (const [k, v] of state.sharedKeys) {
            if (typeof v === 'string') {
              const b = this._base64ToBytes(v);
              if (b.length > 0) this.sharedKeys.set(k, b);
            }
          }
        }
        if (state.roomKeys && Array.isArray(state.roomKeys)) {
          for (const [room, rk] of state.roomKeys) {
            if (rk && typeof rk.key === 'string') {
              const b = this._base64ToBytes(rk.key);
              if (b.length > 0) {
                this.roomKeys.set(room, { key: b, version: rk.version || 1 });
              }
            }
          }
        }
        if (state.dmSequences) this.dmSequences = new Map(state.dmSequences);
        if (state.myDmSequences) this.myDmSequences = new Map(state.myDmSequences);
        if (state.roomSequences && Array.isArray(state.roomSequences)) {
          for (const [room, userList] of state.roomSequences) {
            this.roomSequences.set(room, new Map(userList));
          }
        }
        if (state.myRoomSequences) this.myRoomSequences = new Map(state.myRoomSequences);
      }
    } catch (e) {
      console.warn("Failed to load state", e);
    }
  }

  private transport: Transport;
  private crypto: CryptoProvider;
  private moderation: ModerationProvider;
  private username: string | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private listeners: EventCallback[] = [];
  private sharedKeys: Map<string, string | Uint8Array> = new Map();
  private roomKeys: Map<string, { key: Uint8Array, version: number }> = new Map();
  private roomSequences: Map<string, Map<string, number>> = new Map();
  private myRoomSequences: Map<string, number> = new Map();
  private dmSequences: Map<string, number> = new Map();
  private myDmSequences: Map<string, number> = new Map();
  private joinedRooms: Set<string> = new Set();
  private sentKxPeers: Set<string> = new Set();
  private pendingOutgoingMessages: Map<string, Array<{ msgId: string; text: string; timestamp: number }>> = new Map();
  
  private heartbeatInterval: any = null;
  private shouldReconnect: boolean = true;

  constructor(
    transport: Transport,
    crypto: CryptoProvider,
    moderation: ModerationProvider
  ) {
    this.transport = transport;
    this.crypto = crypto;
    this.moderation = moderation;
  }

  onEvent(callback: EventCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private dispatch(event: SecureChatEvent) {
    this.listeners.forEach(cb => cb(event));
  }

  private setState(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.dispatch({ type: "ConnectionChanged", state: newState });
    }
  }

  async connect(username: string) {
    if (this.state !== ConnectionState.DISCONNECTED && this.state !== ConnectionState.RECONNECTING) {
       return; // Already connecting or connected
    }
    this.username = username;
    this._loadState();
    this.shouldReconnect = true;
    this.setState(ConnectionState.CONNECTING);
    this._connectLoop();
  }

  async disconnect() {
    this.shouldReconnect = false;
    this._stopHeartbeat();
    await this.transport.disconnect();
    this.setState(ConnectionState.DISCONNECTED);
  }

  private async _connectLoop() {
    while (this.shouldReconnect) {
      try {
        await this.transport.connect();
        this.setState(ConnectionState.CONNECTED);
        
        // Start receiving messages
        void this._receiveLoop();

        // Authenticate
        this.setState(ConnectionState.AUTHENTICATING);
        const currentUsername = this.username || "";
        let authPayload: any = { username: currentUsername };
        if (this.crypto.signAuth && currentUsername) {
          try {
            const signed = await this.crypto.signAuth(currentUsername, Math.floor(Date.now() / 1000));
            authPayload = signed;
          } catch (e) {
            console.warn("Failed to sign auth payload, falling back to plain username", e);
          }
        }
        await this._sendRaw(MessageType.AUTH, "server", TargetType.USER, authPayload);
        
        // Wait for AUTH_OK or AUTH_FAIL
        // The receive loop will handle it and set state to READY
        
        break; // Successfully connected, break out of retry loop
      } catch (e) {
        this.dispatch({ type: "ErrorOccurred", reason: `Connection failed: ${e}` });
        await new Promise(r => setTimeout(r, 2000)); // basic backoff
      }
    }
  }

  private async _receiveLoop() {
    try {
      while (this.shouldReconnect) {
        const frame = await this.transport.recvFrame();
        try {
          const envelope = validateMessageEnvelope(frame);
          await this._handleEnvelope(envelope);
        } catch (e) {
          console.error("Invalid frame:", e);
        }
      }
    } catch (e) {
      if (this.shouldReconnect) {
        this.dispatch({ type: "ErrorOccurred", reason: "Connection lost" });
        this.setState(ConnectionState.RECONNECTING);
        this._stopHeartbeat();
        // Trigger reconnect
        setTimeout(() => this._connectLoop(), 1000);
      }
    }
  }

  private async _handleEnvelope(envelope: MessageEnvelope) {
    switch (envelope.type) {
      case MessageType.AUTH_OK:
        this.setState(ConnectionState.READY);
        this._startHeartbeat();
        // Restore room memberships on reconnect
        for (const room of this.joinedRooms) {
          void this._sendRaw(MessageType.JOIN, room, TargetType.ROOM, "");
        }
        void this.sendPresence("active");
        void this.queryPresence();
        break;
      case MessageType.AUTH_FAIL:
        this.dispatch({ type: "ErrorOccurred", reason: `Auth failed: ${envelope.payload}` });
        this.disconnect();
        break;
      case MessageType.ROOM_KEY:
        try {
          // Payload is encrypted with pairwise key
          const senderKey = this.sharedKeys.get(envelope.sender);
          if (!senderKey) throw new Error("No shared key for room key distribution");
          
          const decryptedPayload = await this.crypto.decrypt(senderKey, envelope.payload);
          const data = JSON.parse(decryptedPayload);
          
          if (!data.room_id || !data.key_version || !data.room_key) {
            throw new Error("Invalid room key payload");
          }
          
          const rawKey = new Uint8Array(atob(data.room_key).split('').map(c => c.charCodeAt(0)));
          this.roomKeys.set(data.room_id, { key: rawKey, version: data.key_version });
          console.log(`Received room key for ${data.room_id}, v${data.key_version}`);
        } catch (e) {
          console.error("Failed to process ROOM_KEY", e);
        }
        break;
      case MessageType.MSG:
        try {
          if (envelope.target_type === TargetType.ROOM) {
            let roomCtx = this.roomKeys.get(envelope.target);
            if (!roomCtx) {
              const rawKey = await this._deriveRoomKey(envelope.target);
              roomCtx = { key: rawKey, version: 1 };
              this.roomKeys.set(envelope.target, roomCtx);
              this._saveState();
            }
            
            // For room MSG, payload is JSON containing { key_version, sequence_number, ciphertext }
            const data = JSON.parse(envelope.payload);
            if (data.key_version !== roomCtx.version) {
              throw new Error("Message key version mismatch");
            }
            
            // Check sequence number for replay protection
            let roomSeqs = this.roomSequences.get(envelope.target);
            if (!roomSeqs) {
              roomSeqs = new Map();
              this.roomSequences.set(envelope.target, roomSeqs);
            }
            const lastSeq = roomSeqs.get(envelope.sender) || 0;
            if (data.sequence_number <= lastSeq) {
              throw new Error("Message rejected: Replay detected");
            }
            
            const aad = this._buildAAD(1, envelope.type, envelope.target_type, envelope.target, data.key_version, envelope.sender, data.sequence_number);
            const plaintext = await this.crypto.decrypt(roomCtx.key, data.ciphertext, aad);
            
            // Update sequence
            roomSeqs.set(envelope.sender, data.sequence_number);
            
            this.dispatch({
              type: "MessageReceived",
              sender: envelope.sender,
              target: envelope.target,
              text: plaintext,
              msg_id: envelope.msg_id
            });
          } else {
            const sharedKey = this.sharedKeys.get(envelope.sender);
            if (!sharedKey) throw new Error("No shared key");
            
            const data = JSON.parse(envelope.payload);
            if (data.key_version !== 0) {
              throw new Error("Invalid key version for DM");
            }
            
            const seq = data.sequence_number || 0;
            const lastSeq = this.dmSequences.get(envelope.sender) || 0;
            if (seq <= lastSeq) {
              throw new Error("Message rejected: Replay detected");
            }
            
            const aad = this._buildAAD(1, envelope.type, envelope.target_type, envelope.target, 0, envelope.sender, seq);
            const plaintext = await this.crypto.decrypt(sharedKey, data.ciphertext, aad);
            
            this.dmSequences.set(envelope.sender, seq);
            this._saveState();
            
            this.dispatch({
              type: "MessageReceived",
              sender: envelope.sender,
              target: envelope.target,
              text: plaintext,
              msg_id: envelope.msg_id
            });
          }
        } catch (e) {
          console.error("Failed to decrypt message", e);
          this.dispatch({ type: "EncryptionUnavailable" });
        }
        break;
      case MessageType.ACK:
        this.dispatch({
          type: "MessageStatusChanged",
          msg_id: envelope.payload,
          state: MessageState.SENT
        });
        break;
      case MessageType.PRESENCE:
        const parts = envelope.payload.split(":");
        if (parts.length >= 2) {
          const user = parts[0];
          const status = parts.slice(1).join(":");
          this.dispatch({
            type: "PresenceChanged",
            user,
            room: envelope.target,
            status
          });
        }
        break;
      case MessageType.ERROR:
        this.dispatch({ type: "ErrorOccurred", reason: envelope.payload });
        break;
      case MessageType.KEY_EXCHANGE:
        try {
          if (!this.username) throw new Error("Not authenticated");
          const sharedKey = await this.crypto.deriveSharedKey(envelope.sender, this.username, envelope.payload);
          this.sharedKeys.set(envelope.sender, sharedKey);
          this._saveState();
          this.dispatch({ type: "KeyExchangeCompleted", peer: envelope.sender });

          // Bidirectional key exchange: if we have not initiated key exchange to this peer yet, send ours back
          if (!this.sentKxPeers.has(envelope.sender)) {
            this.sentKxPeers.add(envelope.sender);
            await this.sendKeyExchange(envelope.sender);
          }

          // Automatically drain any queued pending messages for this peer
          const queued = this.pendingOutgoingMessages.get(envelope.sender);
          if (queued && queued.length > 0) {
            this.pendingOutgoingMessages.delete(envelope.sender);
            for (const item of queued) {
              try {
                const seq = (this.myDmSequences.get(envelope.sender) || 0) + 1;
                this.myDmSequences.set(envelope.sender, seq);
                this._saveState();

                const aad = this._buildAAD(1, MessageType.MSG, TargetType.USER, envelope.sender, 0, this.username, seq);
                const ciphertext = await this.crypto.encrypt(sharedKey, item.text, aad);
                const payload = {
                  key_version: 0,
                  sequence_number: seq,
                  ciphertext
                };
                await this._sendRaw(MessageType.MSG, envelope.sender, TargetType.USER, JSON.stringify(payload));
              } catch (drainErr) {
                console.error(`Failed to drain pending message ${item.msgId} to ${envelope.sender}:`, drainErr);
              }
            }
          }
        } catch (e) {
          console.error("Key exchange failed", e);
        }
        break;
    }
  }

  private _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this._sendRaw(MessageType.HEARTBEAT, "server", TargetType.USER, "ping").catch(e => {
        console.error("Heartbeat failed", e);
      });
    }, 10000);
  }

  private _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async _sendRaw(type: MessageType, target: string, targetType: TargetType, payload: any) {
    if (!this.username) throw new Error("Not authenticated");
    
    const randSuffix = Math.random().toString(36).substring(2, 8);
    const envelope: MessageEnvelope = {
      type,
      msg_id: `${this.username}-${Date.now()}-${randSuffix}`,
      sender: this.username,
      target,
      target_type: targetType,
      timestamp: Math.floor(Date.now() / 1000),
      payload: typeof payload === "string" ? payload : JSON.stringify(payload)
    };
    
    await this.transport.sendFrame(envelope);
    return envelope.msg_id;
  }

  private _buildAAD(protocolVersion: number, msgType: string, targetType: string, target: string, keyVersion: number, sender: string, sequenceNumber: number): Uint8Array {
    const encoder = new TextEncoder();
    
    // KeyVersion is 4-byte BigEndian
    const kvBuf = new ArrayBuffer(4);
    new DataView(kvBuf).setUint32(0, keyVersion, false); // false = big endian
    
    // SequenceNumber is 8-byte BigEndian
    const snBuf = new ArrayBuffer(8);
    // Number is 53-bit safe in JS, we can just setBigUint64
    new DataView(snBuf).setBigUint64(0, BigInt(sequenceNumber), false);

    const parts = [
      new Uint8Array([protocolVersion]),
      encoder.encode(msgType),
      encoder.encode(targetType),
      encoder.encode(target),
      new Uint8Array(kvBuf),
      encoder.encode(sender),
      new Uint8Array(snBuf)
    ];

    const totalLen = parts.reduce((acc, val) => acc + val.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  async sendRoomMessage(room: string, text: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    if (!this.username) throw new Error("Not authenticated");
    
    const isValid = await this.moderation.moderate(text);
    if (!isValid) {
      this.dispatch({ type: "ModerationRejected", target: room, text });
      return;
    }

    let payloadJson: string;
    try {
      let roomCtx = this.roomKeys.get(room);
      if (!roomCtx) {
        const rawKey = await this._deriveRoomKey(room);
        roomCtx = { key: rawKey, version: 1 };
        this.roomKeys.set(room, roomCtx);
        this._saveState();
      }
      
      const seq = (this.myRoomSequences.get(room) || 0) + 1;
      this.myRoomSequences.set(room, seq);
      this._saveState();

      const aad = this._buildAAD(1, MessageType.MSG, TargetType.ROOM, room, roomCtx.version, this.username, seq);
      const ciphertext = await this.crypto.encrypt(roomCtx.key, text, aad);
      
      const payload = {
        key_version: roomCtx.version,
        sequence_number: seq,
        ciphertext
      };
      payloadJson = JSON.stringify(payload);
    } catch (e) {
      this.dispatch({ type: "EncryptionUnavailable" });
      return;
    }

    const msgId = await this._sendRaw(MessageType.MSG, room, TargetType.ROOM, payloadJson);
    
    this.dispatch({
      type: "MessageReceived",
      sender: this.username,
      target: room,
      text: text,
      msg_id: msgId
    });

    this.dispatch({
      type: "MessageStatusChanged",
      msg_id: msgId,
      state: MessageState.PENDING
    });
  }

  async sendDirectMessage(peer: string, text: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    if (!this.username) throw new Error("Not authenticated");

    const isValid = await this.moderation.moderate(text);
    if (!isValid) {
      this.dispatch({ type: "ModerationRejected", target: peer, text });
      return;
    }

    const sharedKey = this.sharedKeys.get(peer);
    if (!sharedKey) {
      // Key exchange not yet established: queue message and transparently perform key exchange
      const randSuffix = Math.random().toString(36).substring(2, 8);
      const msgId = `${this.username}-${Date.now()}-${randSuffix}`;

      const pendingList = this.pendingOutgoingMessages.get(peer) || [];
      pendingList.push({ msgId, text, timestamp: Date.now() });
      this.pendingOutgoingMessages.set(peer, pendingList);

      // Immediately display locally with PENDING status (WhatsApp style clock / pending)
      this.dispatch({
        type: "MessageReceived",
        sender: this.username,
        target: peer,
        text: text,
        msg_id: msgId
      });

      this.dispatch({
        type: "MessageStatusChanged",
        msg_id: msgId,
        state: MessageState.PENDING
      });

      // Initiate key exchange if not already in flight
      if (!this.sentKxPeers.has(peer)) {
        try {
          await this.sendKeyExchange(peer);
        } catch (e) {
          console.warn(`Auto key-exchange initiation failed for ${peer}:`, e);
        }
      }
      return;
    }

    let payloadJson: string;
    try {
      const seq = (this.myDmSequences.get(peer) || 0) + 1;
      this.myDmSequences.set(peer, seq);
      this._saveState();
      
      const aad = this._buildAAD(1, MessageType.MSG, TargetType.USER, peer, 0, this.username, seq);
      const ciphertext = await this.crypto.encrypt(sharedKey, text, aad);
      
      const payload = {
        key_version: 0,
        sequence_number: seq,
        ciphertext
      };
      payloadJson = JSON.stringify(payload);
    } catch (e) {
      this.dispatch({ type: "EncryptionUnavailable" });
      return;
    }

    const msgId = await this._sendRaw(MessageType.MSG, peer, TargetType.USER, payloadJson);
    
    this.dispatch({
      type: "MessageReceived",
      sender: this.username,
      target: peer,
      text: text,
      msg_id: msgId
    });

    this.dispatch({
      type: "MessageStatusChanged",
      msg_id: msgId,
      state: MessageState.PENDING
    });
  }

  async sendKeyExchange(target: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    if (!this.username) throw new Error("Not authenticated");
    this.sentKxPeers.add(target);
    const payload = await this.crypto.getPublicKey(this.username, target);
    await this._sendRaw(MessageType.KEY_EXCHANGE, target, TargetType.USER, payload);
  }

  async joinRoom(room: string) {
    this.joinedRooms.add(room);
    if (this.state !== ConnectionState.READY) return;
    await this._sendRaw(MessageType.JOIN, room, TargetType.ROOM, "");
  }

  async leaveRoom(room: string) {
    this.joinedRooms.delete(room);
    if (this.state !== ConnectionState.READY) return;
    await this._sendRaw(MessageType.LEAVE, room, TargetType.ROOM, "");
  }

  public syncRooms(rooms: string[]) {
    for (const r of rooms) {
      this.joinedRooms.add(r);
      if (this.state === ConnectionState.READY) {
        void this._sendRaw(MessageType.JOIN, r, TargetType.ROOM, "");
      }
    }
  }

  async sendPresence(status: string) {
    if (this.state !== ConnectionState.READY || !this.username) return;
    try {
      await this._sendRaw(MessageType.PRESENCE, "global", TargetType.USER, status);
    } catch (e) {
      console.warn("Failed to send presence:", e);
    }
  }

  async queryPresence() {
    if (this.state !== ConnectionState.READY || !this.username) return;
    try {
      await this._sendRaw(MessageType.PRESENCE, "server", TargetType.USER, "query");
    } catch (e) {
      console.warn("Failed to query presence:", e);
    }
  }

  async generateAndDistributeRoomKey(room: string, members: string[]) {
    if (!this.username) throw new Error("Not authenticated");
    const rawKey = await this.crypto.generateRoomKey();
    const currentVersion = this.roomKeys.get(room)?.version || 0;
    const newVersion = currentVersion + 1;
    
    this.roomKeys.set(room, { key: rawKey, version: newVersion });
    
    const roomKeyBase64 = btoa(String.fromCharCode(...rawKey));
    const payload = JSON.stringify({
      room_id: room,
      key_version: newVersion,
      room_key: roomKeyBase64
    });

    for (const member of members) {
      if (member === this.username) continue;
      const sharedKey = this.sharedKeys.get(member);
      if (!sharedKey) {
        console.warn(`No pairwise key to distribute room key to ${member}`);
        continue; // Could queue or throw, for now warn
      }
      
      const ciphertext = await this.crypto.encrypt(sharedKey, payload);
      await this._sendRaw(MessageType.ROOM_KEY, member, TargetType.USER, ciphertext);
    }
  }

  async encryptAttachment(fileBytes: Uint8Array, fileName: string, mimeType: string): Promise<{ ciphertext: Uint8Array; descriptor: Omit<AttachmentDescriptor, "blob_id"> }> {
    if (!this.crypto.encryptAttachment) {
      throw new Error("Attachment encryption not supported by crypto provider");
    }
    return this.crypto.encryptAttachment(fileBytes, fileName, mimeType);
  }

  async decryptAttachment(ciphertext: Uint8Array, keyB64: string, ivB64: string, expectedSha256: string): Promise<Uint8Array> {
    if (!this.crypto.decryptAttachment) {
      throw new Error("Attachment decryption not supported by crypto provider");
    }
    return this.crypto.decryptAttachment(ciphertext, keyB64, ivB64, expectedSha256);
  }

  async getFingerprint(identityKeyB64?: string): Promise<string> {
    if (this.crypto.getFingerprint) {
      return this.crypto.getFingerprint(identityKeyB64);
    }
    return "N/A";
  }

  getMediaBaseUrl(): string {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MEDIA_URL) {
      return (import.meta as any).env.VITE_MEDIA_URL;
    }
    const wsUri = this.transport.getUri ? this.transport.getUri() : "ws://127.0.0.1:8766";
    if (wsUri.includes("127.0.0.1") || wsUri.includes("localhost")) {
      return "http://127.0.0.1:8767";
    }
    return wsUri.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://").replace(/\/$/, "");
  }
}
