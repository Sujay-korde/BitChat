import type { Transport } from "../transport/Transport";
import { validateMessageEnvelope } from "../protocol/schema";
import type { MessageEnvelope } from "../protocol/schema";
import { MessageType, TargetType } from "../protocol/types";
import { ConnectionState, MessageState } from "./events";
import type { EventCallback, SecureChatEvent } from "./events";
import type { CryptoProvider } from "../crypto/CryptoProvider";
import type { ModerationProvider } from "../moderation/ModerationProvider";

export class SecureChatClient {
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
    this.shouldReconnect = true;
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
        this.setState(this.state === ConnectionState.DISCONNECTED ? ConnectionState.CONNECTING : ConnectionState.RECONNECTING);
        await this.transport.connect();
        this.setState(ConnectionState.CONNECTED);
        
        // Start receiving messages
        void this._receiveLoop();

        // Authenticate
        this.setState(ConnectionState.AUTHENTICATING);
        await this._sendRaw(MessageType.AUTH, "server", TargetType.USER, { username: this.username });
        
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
        this.setState(ConnectionState.DISCONNECTED);
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
            const roomCtx = this.roomKeys.get(envelope.target);
            if (!roomCtx) throw new Error("No room key");
            
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
              text: plaintext
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
            
            this.dispatch({
              type: "MessageReceived",
              sender: envelope.sender,
              target: envelope.target,
              text: plaintext
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
          this.dispatch({ type: "KeyExchangeCompleted", peer: envelope.sender });
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
    
    const envelope: MessageEnvelope = {
      type,
      msg_id: `${this.username}-${Date.now()}`,
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
      const roomCtx = this.roomKeys.get(room);
      if (!roomCtx) throw new Error("No room key for room");
      
      const seq = (this.myRoomSequences.get(room) || 0) + 1;
      this.myRoomSequences.set(room, seq);

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
      type: "MessageStatusChanged",
      msg_id: msgId,
      state: MessageState.PENDING
    });
  }

  async sendDirectMessage(peer: string, text: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");

    const isValid = await this.moderation.moderate(text);
    if (!isValid) {
      this.dispatch({ type: "ModerationRejected", target: peer, text });
      return;
    }

    let payloadJson: string;
    try {
      const sharedKey = this.sharedKeys.get(peer);
      if (!sharedKey) throw new Error("No shared key for peer");
      
      const seq = (this.myDmSequences.get(peer) || 0) + 1;
      this.myDmSequences.set(peer, seq);
      
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
      type: "MessageStatusChanged",
      msg_id: msgId,
      state: MessageState.PENDING
    });
  }

  async sendKeyExchange(target: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    if (!this.username) throw new Error("Not authenticated");
    const payload = await this.crypto.getPublicKey(this.username, target);
    await this._sendRaw(MessageType.KEY_EXCHANGE, target, TargetType.USER, payload);
  }

  async joinRoom(room: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    await this._sendRaw(MessageType.JOIN, room, TargetType.ROOM, "");
  }

  async leaveRoom(room: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    await this._sendRaw(MessageType.LEAVE, room, TargetType.ROOM, "");
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
}
