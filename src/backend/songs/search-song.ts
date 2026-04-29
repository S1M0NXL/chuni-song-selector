import { loadAppConfig } from "../config/app-config.js";
import { searchSongs } from "../search/fuzzy-search.js";
import { SongDatabase } from "./song-database.js";
import { loadSongs } from "./song-loader.js";

const config = loadAppConfig();
const query = process.argv.slice(2).join(" ").trim();

if (query.length === 0) {
  throw new Error("用法: npm run search:song -- <歌曲名|别名|cid>");
}

const database = new SongDatabase(loadSongs(config.songDataPath));
const results = searchSongs(database.terms(), query, {
  threshold: config.fuzzyMatchThreshold,
  limit: config.maxSearchResults
});

console.log(JSON.stringify(results, null, 2));
