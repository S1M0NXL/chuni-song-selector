import type { SongSelectorEvent } from "../shared/types.js";

export interface OverlayState {
  status: "idle" | "selected" | "candidates" | "failed" | "invalid";
  event: SongSelectorEvent | null;
}

export type OverlayListener = (state: OverlayState) => void;

export class OverlayStore {
  private state: OverlayState = {
    status: "idle",
    event: null
  };

  private readonly listeners = new Set<OverlayListener>();
  private socket: WebSocket | null = null;

  subscribe(listener: OverlayListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setEvent(event: SongSelectorEvent): void {
    this.state = {
      status: mapEventToStatus(event),
      event
    };
    this.emit();
  }

  connect(url: string): void {
    this.socket?.close();
    this.socket = new WebSocket(url);

    this.socket.addEventListener("message", (message) => {
      const event = parseOverlayEvent(message.data);
      if (event) {
        this.setEvent(event);
      }
    });
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function mapEventToStatus(event: SongSelectorEvent): OverlayState["status"] {
  switch (event.type) {
    case "song-selected":
      return "selected";
    case "song-candidates":
      return "candidates";
    case "song-search-failed":
      return "failed";
    case "song-command-invalid":
      return "invalid";
  }
}

function parseOverlayEvent(data: unknown): SongSelectorEvent | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    return JSON.parse(data) as SongSelectorEvent;
  } catch {
    return null;
  }
}
