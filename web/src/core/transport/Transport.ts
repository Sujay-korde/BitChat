export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportError";
  }
}

export interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendFrame(frame: any): Promise<void>;
  recvFrame(): Promise<any>;
}
