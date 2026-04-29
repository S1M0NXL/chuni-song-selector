import type { SongSelectorEvent } from "../shared/types.js";
import { renderOverlay } from "./overlay-renderer.js";
import { OverlayStore } from "./overlay-store.js";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("缺少 #app 根节点");
}

const store = new OverlayStore();
store.subscribe((state) => renderOverlay(root, state));

const overlayWebSocketUrl = new URLSearchParams(window.location.search).get("ws");
if (overlayWebSocketUrl) {
  store.connect(overlayWebSocketUrl);
} else {
  store.setEvent(createSampleEvent());
}

function createSampleEvent(): SongSelectorEvent {
  return {
    type: "song-selected",
    query: "玩具狂奏曲",
    requestedDifficulty: "紫",
    matchedScore: 1,
    song: {
      id: "219",
      title: "玩具狂奏曲 -終焉-",
      aliases: ["玩具狂奏曲", "Toy Frenzy"],
      artist: "きくお",
      version: "AIR",
      genre: "ORIGINAL",
      bpm: 130,
      cover: "https://chunithm.beerpsi.cc/assets/jackets/219.webp",
      difficulties: {
        basic: { level: "5", const: 5, constDisplay: "5.0" },
        advanced: { level: "9", const: 9, constDisplay: "9.0" },
        expert: { level: "13+", const: 13.9, constDisplay: "13.9" },
        master: { level: "15", const: 15.3, constDisplay: "15.3" }
      }
    },
    selectedDifficulty: {
      name: "master",
      label: "紫",
      level: "15",
      const: 15.3,
      constDisplay: "15.3"
    }
  };
}
