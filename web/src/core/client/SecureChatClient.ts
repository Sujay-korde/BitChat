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
      case MessageType.MSG:
        try {
          const plaintext = await this.crypto.decrypt(envelope.sender, envelope.payload);
          this.dispatch({
            type: "MessageReceived",
            sender: envelope.sender,
            target: envelope.target,
            text: plaintext
          });
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
        this.dispatch({ type: "KeyExchangeCompleted", peer: envelope.sender });
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

  async sendRoomMessage(room: string, text: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    
    const isValid = await this.moderation.moderate(text);
    if (!isValid) {
      this.dispatch({ type: "ModerationRejected", target: room, text });
      return;
    }

    let ciphertext: string;
    try {
      ciphertext = await this.crypto.encrypt(room, text);
    } catch (e) {
      this.dispatch({ type: "EncryptionUnavailable" });
      return;
    }

    const msgId = await this._sendRaw(MessageType.MSG, room, TargetType.ROOM, ciphertext);
    
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

    let ciphertext: string;
    try {
      ciphertext = await this.crypto.encrypt(peer, text);
    } catch (e) {
      this.dispatch({ type: "EncryptionUnavailable" });
      return;
    }

    const msgId = await this._sendRaw(MessageType.MSG, peer, TargetType.USER, ciphertext);
    
    this.dispatch({
      type: "MessageStatusChanged",
      msg_id: msgId,
      state: MessageState.PENDING
    });
  }

  async joinRoom(room: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    await this._sendRaw(MessageType.JOIN, room, TargetType.ROOM, "");
  }

  async leaveRoom(room: string) {
    if (this.state !== ConnectionState.READY) throw new Error("Not ready");
    await this._sendRaw(MessageType.LEAVE, room, TargetType.ROOM, "");
  }
}
