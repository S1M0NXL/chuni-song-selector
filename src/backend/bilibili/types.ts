export interface DanmakuMessage {
  roomId: number;
  text: string;
  userId?: number;
  userName?: string;
  receivedAt: string;
}

export interface DanmakuStatusEvent {
  type: "connected" | "disconnected" | "error" | "warning" | "debug";
  message: string;
}

export type DanmakuMessageHandler = (message: DanmakuMessage) => void;
export type DanmakuTextHandler = (text: string) => void;
export type DanmakuStatusHandler = (event: DanmakuStatusEvent) => void;

export interface DanmakuClient {
  connect(): Promise<void>;
  disconnect(): void;
  onMessage(handler: DanmakuMessageHandler): () => void;
  onText(handler: DanmakuTextHandler): () => void;
  onStatus(handler: DanmakuStatusHandler): () => void;
}
