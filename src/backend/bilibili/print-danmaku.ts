import { loadAppConfig } from "../config/app-config.js";
import {
  inspectSongRequest,
  isSongCommandText
} from "../commands/song-request-inspector.js";
import { SongDatabase } from "../songs/song-database.js";
import { loadSongs } from "../songs/song-loader.js";
import { BilibiliDanmakuClient } from "./danmaku-client.js";

const config = loadAppConfig();
const cliOptions = readCliOptions();
const roomId = cliOptions.roomId ?? config.bilibiliRoomId;
const database = new SongDatabase(loadSongs(config.songDataPath));

if (!roomId) {
  throw new Error("缺少直播间房间号。请传入 roomId 或配置 BILIBILI_ROOM_ID。");
}

const client = new BilibiliDanmakuClient({
  roomId,
  debug: cliOptions.debug
});

client.onStatus((event) => {
  console.error(`[${event.type}] ${event.message}`);
});

client.onText((text: string) => {
  const result = inspectSongRequest(text, database, config);
  if (result.ok) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (isSongCommandText(text, config)) {
    console.error(`[ignored] ${result.error}: ${text}`);
  }
});

await client.connect();

function readCliOptions(): { roomId: number | null; debug: boolean } {
  let roomId: number | null = null;
  let debug = process.env.BILIBILI_DEBUG === "1";

  for (const arg of process.argv.slice(2)) {
    if (arg === "--debug") {
      debug = true;
      continue;
    }

    const value = Number(arg);
    if (Number.isInteger(value) && value > 0) {
      roomId = value;
    }
  }

  return { roomId, debug };
}
