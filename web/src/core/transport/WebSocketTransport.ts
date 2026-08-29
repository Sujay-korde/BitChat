import type { Transport } from "./Transport";
import { TransportError } from "./Transport";

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private uri: string;
  private messageQueue: any[] = [];
  private resolveQueue: ((value: any) => void)[] = [];
  private errorQueue: ((error: Error) => void)[] = [];
  private rejectConnect: ((error: Error) => void) | null = null;
  private isClosed: boolean = true;

  constructor(uri: string = "ws://127.0.0.1:8766") {
    this.uri = uri;
  }

  async connect(): Promise<void> {
    if (this.ws && !this.isClosed) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.rejectConnect = reject;
      try {
        this.ws = new WebSocket(this.uri);
      } catch (e) {
        throw new TransportError(`WebSocket connect failed: ${e}`);
      }

      this.ws.onopen = () => {
        this.isClosed = false;
        this.rejectConnect = null;
        resolve();
      };

      this.ws.onclose = () => {
        this.isClosed = true;
        this._cleanup(new TransportError("WebSocket connection closed"));
      };

      this.ws.onerror = () => {
        const err = new TransportError("WebSocket error");
        if (this.rejectConnect) {
          this.rejectConnect(err);
          this.rejectConnect = null;
        }
        this._cleanup(err);
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data !== "string") {
          this._cleanup(new TransportError("Unexpected binary frame"));
          return;
        }
        try {
          const frame = JSON.parse(event.data);
          if (this.resolveQueue.length > 0) {
            const resolver = this.resolveQueue.shift();
            // Need to shift error as well to keep in sync
            this.errorQueue.shift();
            if (resolver) resolver(frame);
          } else {
            this.messageQueue.push(frame);
          }
        } catch (e) {
          this._cleanup(new TransportError(`Invalid JSON from server: ${e}`));
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isClosed = true;
    this._cleanup(new TransportError("Disconnected by client"));
  }

  async sendFrame(frame: any): Promise<void> {
    if (!this.ws || this.isClosed) {
      throw new TransportError("Not connected");
    }
    try {
      const text = JSON.stringify(frame);
      this.ws.send(text);
    } catch (e) {
      throw new TransportError(`WebSocket send failed: ${e}`);
    }
  }

  async recvFrame(): Promise<any> {
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift();
    }
    if (this.isClosed) {
      throw new TransportError("Not connected");
    }
    return new Promise((resolve, reject) => {
      this.resolveQueue.push(resolve);
      this.errorQueue.push(reject);
    });
  }

  private _cleanup(error: Error) {
    while (this.errorQueue.length > 0) {
      const reject = this.errorQueue.shift();
      if (reject) reject(error);
    }
    this.resolveQueue = [];
  }
}
