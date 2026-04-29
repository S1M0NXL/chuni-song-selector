import type { OverlayState } from "./overlay-store.js";

export function renderOverlay(root: HTMLElement, state: OverlayState): void {
  root.replaceChildren(createOverlayElement(state));
}

function createOverlayElement(state: OverlayState): HTMLElement {
  const container = document.createElement("section");
  container.className = `overlay overlay--${state.status}`;

  if (!state.event) {
    container.append(createIdle());
    return container;
  }

  switch (state.event.type) {
    case "song-selected":
      container.append(createSelectedSong(state.event));
      return container;
    case "song-candidates":
      container.append(createCandidates(state.event));
      return container;
    case "song-search-failed":
      container.append(createMessage("未找到曲目", state.event.reason));
      return container;
    case "song-command-invalid":
      container.append(createMessage("无效指令", state.event.reason));
      return container;
  }
}

function createIdle(): HTMLElement {
  return createMessage("等待点歌", "发送「点歌 歌曲名」开始匹配");
}

function createSelectedSong(
  event: Extract<NonNullable<OverlayState["event"]>, { type: "song-selected" }>
): HTMLElement {
  const wrapper = document.createElement("article");
  wrapper.className = "song-card";

  const cover = createCover(event.song.cover, event.song.title);

  const body = document.createElement("div");
  body.className = "song-card__body";

  const title = document.createElement("h1");
  title.className = "song-card__title";
  title.textContent = event.song.title;

  const meta = document.createElement("p");
  meta.className = "song-card__meta";
  meta.textContent = [
    event.song.artist,
    event.song.version,
    event.song.genre,
    formatBpm(event.song.bpm)
  ]
    .filter(Boolean)
    .join(" / ");

  const difficulty = document.createElement("p");
  difficulty.className = "song-card__difficulty";
  difficulty.textContent = `${event.selectedDifficulty.label} ${event.selectedDifficulty.level} · ${event.selectedDifficulty.constDisplay}`;

  const query = document.createElement("p");
  query.className = "song-card__query";
  query.textContent = `匹配: ${event.query} · ${(event.matchedScore * 100).toFixed(1)}%`;

  body.append(title, meta, difficulty, query);
  wrapper.append(cover, body);

  return wrapper;
}

function createCandidates(
  event: Extract<NonNullable<OverlayState["event"]>, { type: "song-candidates" }>
): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "candidate-list";

  const heading = document.createElement("h1");
  heading.textContent = "找到多个相近结果";

  const list = document.createElement("ol");
  for (const candidate of event.candidates) {
    const item = document.createElement("li");
    item.textContent = `${candidate.song.title} · ${(candidate.score * 100).toFixed(1)}%`;
    list.append(item);
  }

  wrapper.append(heading, list);
  return wrapper;
}

function createMessage(titleText: string, bodyText: string): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "message";

  const title = document.createElement("h1");
  title.textContent = titleText;

  const body = document.createElement("p");
  body.textContent = bodyText;

  wrapper.append(title, body);
  return wrapper;
}

function createCover(coverPath: string | undefined, title: string): HTMLElement {
  if (coverPath) {
    const cover = document.createElement("img");
    cover.className = "song-card__cover";
    cover.alt = title;
    cover.src = coverPath;
    return cover;
  }

  const fallback = document.createElement("div");
  fallback.className = "song-card__cover song-card__cover--fallback";
  fallback.setAttribute("aria-label", title);
  return fallback;
}

function formatBpm(bpm: number | undefined): string | null {
  return typeof bpm === "number" ? `BPM ${bpm}` : null;
}
