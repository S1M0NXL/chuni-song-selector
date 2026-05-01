import type { SongSelectorEvent } from "../shared/types.js";
import { renderOverlay } from "./overlay-renderer.js";
import { OverlayStore } from "./overlay-store.js";
import "./styles.css";

const EIRENE_IMAGE_URL = "/images/irene-curious-2.png";
const SONG_QUEUE_BACKGROUND_URL = "/images/uni.jpeg";
const SONG_QUEUE_TITLE_URL = "/images/song-queue-tag.png?v=2";
const GITHUB_URL = "https://github.com/S1M0NXL/chuni-song-selector";
const PICTURE_URL = "https://chunithmstory.miraheze.org/wiki/Eirene_Curious";
const HOME_URL = "/";
const SELECTOR_URL = "/?overlay=1";
const SONG_SEARCH_URL = "/?page=song-search";
const ALIAS_MANAGER_URL = "/?page=alias-manager";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("缺少 #app 根节点");
}

const params = new URLSearchParams(window.location.search);
const overlayWebSocketUrl = params.get("ws");

if (overlayWebSocketUrl) {
  const store = new OverlayStore();
  store.subscribe((state) => renderOverlay(root, state));
  store.connect(overlayWebSocketUrl);
} else if (params.get("overlay") === "1") {
  renderSongQueuePage(root);
} else {
  renderHomePage(root);
}

function renderSongQueuePage(rootElement: HTMLElement): void {
  const page = document.createElement("section");
  page.className = "song-queue-page";
  page.style.setProperty("--song-queue-bg", `url("${SONG_QUEUE_BACKGROUND_URL}")`);

  const title = document.createElement("img");
  title.className = "song-queue-page__title";
  title.src = SONG_QUEUE_TITLE_URL;
  title.alt = "点歌队列";

  const placeholders = document.createElement("div");
  placeholders.className = "song-queue-page__placeholders";

  for (let index = 0; index < 4; index += 1) {
    const placeholder = document.createElement("div");
    placeholder.className = "song-queue-page__placeholder";
    placeholder.textContent = "?";
    placeholders.append(placeholder);
  }

  const instructions = document.createElement("section");
  instructions.className = "song-queue-page__instructions";

  const format = document.createElement("p");
  format.textContent = "点歌格式（注意空格）： 点歌 (难度) <歌曲名称/别名> (难度)";

  const example = document.createElement("p");
  example.textContent = "例：点歌 黑牛奶    点歌 exp 奶龙      点歌 腐外道 黑谱";

  instructions.append(format, example);
  page.append(title, placeholders, instructions);
  rootElement.replaceChildren(page);
}

function renderHomePage(rootElement: HTMLElement): void {
  const page = document.createElement("section");
  page.className = "home-page";
  page.style.setProperty("--home-art", `url("${EIRENE_IMAGE_URL}")`);
  page.append(createMenuBar());

  const hero = document.createElement("div");
  hero.className = "home-page__hero";

  const title = document.createElement("h1");
  title.className = "home-page__title";
  title.textContent = "Chunithm\nSong\nSelector";

  const startButton = document.createElement("a");
  startButton.className = "home-page__start";
  startButton.href = SELECTOR_URL;
  startButton.textContent = "要开始了哟！";

  const footer = document.createElement("footer");
  footer.className = "home-page__footer";

  const author = document.createElement("span");
  author.className = "home-page__footer-line";
  author.textContent = "Produced by Simon Liang";

  const links = document.createElement("span");
  links.className = "home-page__footer-line";
  footer.append(
    author,
    links
  );

  links.append(
    createFooterLink("Github", GITHUB_URL),
    createFooterSeparator(),
    createFooterLink("About picture", PICTURE_URL)
  );

  hero.append(title, startButton);
  page.append(hero, footer);
  rootElement.replaceChildren(page);
}

function createMenuBar(): HTMLElement {
  const menu = document.createElement("details");
  menu.className = "menu-bar";

  const trigger = document.createElement("summary");
  trigger.className = "menu-bar__trigger";
  trigger.setAttribute("aria-label", "打开菜单");
  trigger.append(createMenuLine(), createMenuLine(), createMenuLine());

  const panel = document.createElement("nav");
  panel.className = "menu-bar__panel";

  panel.append(
    createMenuLink("主页", HOME_URL),
    createMenuSeparator(),
    createMenuLink("点歌器", SELECTOR_URL),
    createMenuLink("歌曲查找", SONG_SEARCH_URL),
    createMenuLink("别名管理", ALIAS_MANAGER_URL)
  );

  menu.append(trigger, panel);
  return menu;
}

function createMenuLine(): HTMLSpanElement {
  const line = document.createElement("span");
  line.className = "menu-bar__line";
  return line;
}

function createMenuLink(label: string, href: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  return link;
}

function createMenuSeparator(): HTMLHRElement {
  const separator = document.createElement("hr");
  separator.className = "menu-bar__separator";
  return separator;
}

function createFooterLink(label: string, href: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

function createFooterSeparator(): HTMLSpanElement {
  const separator = document.createElement("span");
  separator.className = "home-page__separator";
  separator.textContent = "｜";
  return separator;
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
