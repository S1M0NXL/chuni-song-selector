import { loadAppConfig } from "./config/app-config.js";
import { BilibiliDanmakuClient } from "./bilibili/danmaku-client.js";
import {
  inspectSongRequest,
  isSongCommandText
} from "./commands/song-request-inspector.js";
import { SongDatabase } from "./songs/song-database.js";
import { loadSongs } from "./songs/song-loader.js";

const config = loadAppConfig();
const songs = loadSongs(config.songDataPath);
const database = new SongDatabase(songs);
const cliMessage = process.argv.slice(2).join(" ").trim();

if (cliMessage.length > 0) {
  console.log(JSON.stringify(inspectSongRequest(cliMessage, database, config), null, 2));
} else if (config.bilibiliRoomId) {
  const client = new BilibiliDanmakuClient({ roomId: config.bilibiliRoomId });

  client.onStatus((event) => {
    console.error(`[${event.type}] ${event.message}`);
  });

  client.onMessage((message) => {
    const result = inspectSongRequest(message.text, database, config);
    if (result.ok) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (isSongCommandText(message.text, config)) {
      console.error(`[ignored] ${result.error}: ${message.text}`);
    }
  });

  await client.connect();
} else {
  console.log("未配置 BILIBILI_ROOM_ID。可先用 npm run dev:sample 验证点歌核心逻辑。");
}
