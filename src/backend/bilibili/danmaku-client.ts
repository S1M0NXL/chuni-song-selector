import { brotliDecompressSync, inflateSync } from "node:zlib";
import type {
  DanmakuClient,
  DanmakuMessage,
  DanmakuMessageHandler,
  DanmakuTextHandler,
  DanmakuStatusEvent,
  DanmakuStatusHandler
} from "./types.js";
import {
  DEFAULT_DANMAKU_HOST_LIST,
  fetchBilibiliWebRoomInfo,
  type BilibiliDanmakuHost,
  type BilibiliWebRoomInfo
} from "./web-room-info.js";

const BILIBILI_DANMAKU_URL = "wss://broadcastlv.chat.bilibili.com/sub";
const HEADER_LENGTH = 16;
const PROTOCOL_VERSION = 1;
const AUTH_PROTOCOL_VERSION = 3;
const SEQUENCE = 1;
const WEBSOCKET_OPEN_STATE = 1;

const enum Operation {
  Heartbeat = 2,
  HeartbeatReply = 3,
  Message = 5,
  Auth = 7,
  AuthReply = 8
}

export interface BilibiliDanmakuClientOptions {
  roomId: number;
  url?: string;
  heartbeatIntervalMs?: number;
  reconnectDelayMs?: number;
  debug?: boolean;
  websocketFactory?: (url: string) => WebSocket;
}

export class BilibiliDanmakuClient implements DanmakuClient {
  private socket: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectRequested = false;
  private roomInfo: BilibiliWebRoomInfo | null = null;
  private readonly messageHandlers = new Set<DanmakuMessageHandler>();
  private readonly textHandlers = new Set<DanmakuTextHandler>();
  private readonly statusHandlers = new Set<DanmakuStatusHandler>();

  constructor(private readonly options: BilibiliDanmakuClientOptions) {}

  async connect(): Promise<void> {
    if (this.socket) {
      return;
    }

    this.disconnectRequested = false;
    this.clearReconnectTimer();
    const socket = await this.createSocket();
    this.socket = socket;
    socket.binaryType = "arraybuffer";

    socket.addEventListener("open", () => {
      this.sendAuth();
      this.startHeartbeat();
      this.emitStatus({
        type: "connected",
        message: `已连接 Bilibili 直播间 ${this.options.roomId}`
      });
    });

    socket.addEventListener("message", (event) => {
      void this.handleSocketMessage(event.data);
    });

    socket.addEventListener("close", () => {
      this.stopHeartbeat();
      this.socket = null;
      this.emitStatus({ type: "disconnected", message: "Bilibili 弹幕连接已断开" });
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      this.emitStatus({ type: "error", message: "Bilibili 弹幕连接发生错误" });
    });
  }

  disconnect(): void {
    this.disconnectRequested = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }

  onMessage(handler: DanmakuMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onText(handler: DanmakuTextHandler): () => void {
    this.textHandlers.add(handler);
    return () => this.textHandlers.delete(handler);
  }

  onStatus(handler: DanmakuStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private async createSocket(): Promise<WebSocket> {
    const url = this.options.url ?? (await this.resolveWebSocketUrl());

    if (this.options.websocketFactory) {
      return this.options.websocketFactory(url);
    }

    if (!globalThis.WebSocket) {
      throw new Error(
        "当前 Node.js 环境没有内置 WebSocket，请注入 websocketFactory 或升级运行时"
      );
    }

    return new globalThis.WebSocket(url);
  }

  private async resolveWebSocketUrl(): Promise<string> {
    try {
      this.roomInfo = await fetchBilibiliWebRoomInfo(this.options.roomId);
      const host = pickDanmakuHost(this.roomInfo.hostList);
      this.emitDebug(
        `弹幕服务器: ${host.host}:${host.wss_port}, room=${this.roomInfo.roomId}, buvid=${maskValue(this.roomInfo.buvid)}, token=${maskValue(this.roomInfo.token ?? "")}`
      );
      return `wss://${host.host}:${host.wss_port}/sub`;
    } catch (error) {
      this.emitStatus({
        type: "warning",
        message: `获取弹幕服务器失败，降级使用默认服务器: ${toErrorMessage(error)}`
      });
      this.roomInfo = {
        requestedRoomId: this.options.roomId,
        roomId: this.options.roomId,
        ownerUid: 0,
        hostList: DEFAULT_DANMAKU_HOST_LIST,
        token: null,
        buvid: ""
      };
      return BILIBILI_DANMAKU_URL;
    }
  }

  private sendAuth(): void {
    const body = JSON.stringify({
      uid: 0,
      roomid: this.roomInfo?.roomId ?? this.options.roomId,
      protover: AUTH_PROTOCOL_VERSION,
      platform: "web",
      type: 2,
      buvid: this.roomInfo?.buvid ?? "",
      key: this.roomInfo?.token ?? ""
    });

    this.sendPacket(Operation.Auth, body);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.options.heartbeatIntervalMs ?? 30000);
  }

  private sendHeartbeat(): void {
    this.sendPacket(Operation.Heartbeat, JSON.stringify({}));
    this.emitDebug("已发送心跳包");
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.disconnectRequested || this.reconnectTimer) {
      return;
    }

    const delay = this.options.reconnectDelayMs ?? 5000;
    this.emitStatus({
      type: "warning",
      message: `${Math.round(delay / 1000)} 秒后尝试重新连接 Bilibili 弹幕`
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch((error: unknown) => {
        this.emitStatus({
          type: "error",
          message: `Bilibili 弹幕重连失败: ${toErrorMessage(error)}`
        });
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private sendPacket(operation: Operation, body: string): void {
    if (!this.socket || this.socket.readyState !== WEBSOCKET_OPEN_STATE) {
      return;
    }

    this.socket.send(encodePacket(operation, body));
  }

  private async handleSocketMessage(data: unknown): Promise<void> {
    const buffer = await toArrayBuffer(data);
    if (!buffer) {
      return;
    }

    for (const packet of decodePackets(buffer)) {
      this.handlePacket(packet);
    }
  }

  private handlePacket(packet: BilibiliPacket): void {
    this.emitDebug(
      `收到包: operation=${packet.operation}, version=${packet.version}, body=${packet.body.byteLength}`
    );

    if (packet.operation === Operation.HeartbeatReply) {
      return;
    }

    if (packet.operation === Operation.AuthReply) {
      const payload = parseAuthReply(packet.body);
      if (payload && payload.code !== 0) {
        this.emitStatus({
          type: "error",
          message: `Bilibili 弹幕认证失败: code=${payload.code}`
        });
        return;
      }

      this.sendHeartbeat();
      this.emitStatus({ type: "connected", message: "Bilibili 弹幕认证成功" });
      return;
    }

    if (packet.operation !== Operation.Message) {
      return;
    }

    if (packet.version === 3) {
      const nestedPackets = decodePackets(
        toExactArrayBuffer(brotliDecompressSync(packet.body))
      );
      this.emitDebug(`Brotli 解包: nested=${nestedPackets.length}`);
      for (const nestedPacket of nestedPackets) {
        this.handlePacket(nestedPacket);
      }
      return;
    }

    if (packet.version === 2) {
      const nestedPackets = decodePackets(
        toExactArrayBuffer(inflateSync(packet.body))
      );
      this.emitDebug(`zlib 解包: nested=${nestedPackets.length}`);
      for (const nestedPacket of nestedPackets) {
        this.handlePacket(nestedPacket);
      }
      return;
    }

    if (packet.version !== 0 && packet.version !== 1) {
      this.emitStatus({
        type: "warning",
        message: `暂未处理压缩弹幕包版本: ${packet.version}`
      });
      return;
    }

    const payload = new TextDecoder().decode(packet.body);
    for (const line of payload.split(/\0+/u).filter(Boolean)) {
      this.handleJsonPayload(line);
    }
  }

  private handleJsonPayload(payload: string): void {
    let event: unknown;
    try {
      event = JSON.parse(payload) as unknown;
    } catch {
      this.emitDebug(`JSON 解析失败: ${payload.slice(0, 120)}`);
      return;
    }

    if (isRecord(event) && typeof event.cmd === "string") {
      this.emitDebug(`收到业务消息: ${event.cmd}`);
    }

    const message = parseDanmakuMessage(event, this.options.roomId);
    if (!message) {
      return;
    }

    for (const handler of this.textHandlers) {
      handler(message.text);
    }

    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  private emitStatus(event: DanmakuStatusEvent): void {
    for (const handler of this.statusHandlers) {
      handler(event);
    }
  }

  private emitDebug(message: string): void {
    if (!this.options.debug) {
      return;
    }

    this.emitStatus({ type: "debug", message });
  }
}

interface BilibiliPacket {
  operation: number;
  version: number;
  body: Uint8Array;
}

function encodePacket(operation: Operation, body: string): ArrayBuffer {
  const bodyBytes = new TextEncoder().encode(body);
  const packetLength = HEADER_LENGTH + bodyBytes.byteLength;
  const buffer = new ArrayBuffer(packetLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, packetLength);
  view.setUint16(4, HEADER_LENGTH);
  view.setUint16(6, PROTOCOL_VERSION);
  view.setUint32(8, operation);
  view.setUint32(12, SEQUENCE);
  bytes.set(bodyBytes, HEADER_LENGTH);

  return buffer;
}

function decodePackets(buffer: ArrayBuffer): BilibiliPacket[] {
  const packets: BilibiliPacket[] = [];
  const view = new DataView(buffer);
  let offset = 0;

  while (offset + HEADER_LENGTH <= buffer.byteLength) {
    const packetLength = view.getUint32(offset);
    const headerLength = view.getUint16(offset + 4);
    const version = view.getUint16(offset + 6);
    const operation = view.getUint32(offset + 8);

    if (packetLength <= 0 || offset + packetLength > buffer.byteLength) {
      break;
    }

    packets.push({
      operation,
      version,
      body: new Uint8Array(buffer.slice(offset + headerLength, offset + packetLength))
    });

    offset += packetLength;
  }

  return packets;
}

function pickDanmakuHost(hostList: BilibiliDanmakuHost[]): BilibiliDanmakuHost {
  const host = hostList[0] ?? DEFAULT_DANMAKU_HOST_LIST[0];
  if (!host) {
    throw new Error("缺少可用弹幕服务器");
  }
  return host;
}

async function toArrayBuffer(data: unknown): Promise<ArrayBuffer | null> {
  if (data instanceof ArrayBuffer) {
    return data;
  }

  if (data instanceof Blob) {
    return data.arrayBuffer();
  }

  if (ArrayBuffer.isView(data)) {
    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const copy = new Uint8Array(view.byteLength);
    copy.set(view);
    return copy.buffer;
  }

  if (typeof data === "string") {
    return new TextEncoder().encode(data).buffer;
  }

  return null;
}

function toExactArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

function parseAuthReply(body: Uint8Array): { code: number } | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(body)) as unknown;
    if (isRecord(value) && typeof value.code === "number") {
      return { code: value.code };
    }
  } catch {
    return null;
  }

  return null;
}

function parseDanmakuMessage(event: unknown, roomId: number): DanmakuMessage | null {
  if (!isRecord(event) || typeof event.cmd !== "string") {
    return null;
  }

  if (!event.cmd.startsWith("DANMU_MSG") || !Array.isArray(event.info)) {
    return null;
  }

  const text = event.info[1];
  const user = event.info[2];

  if (typeof text !== "string") {
    return null;
  }

  const message: DanmakuMessage = {
    roomId,
    text,
    receivedAt: new Date().toISOString()
  };

  if (Array.isArray(user) && typeof user[0] === "number") {
    message.userId = user[0];
  }

  if (Array.isArray(user) && typeof user[1] === "string") {
    message.userName = user[1];
  }

  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function maskValue(value: string): string {
  if (value.length <= 8) {
    return value.length > 0 ? "***" : "";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
