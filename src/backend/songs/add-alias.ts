import { existsSync, writeFileSync } from "node:fs";
import { loadAppConfig } from "../config/app-config.js";
import { normalizeSearchTerm } from "../search/fuzzy-search.js";
import type { Song } from "../../shared/types.js";
import { loadSongs } from "./song-loader.js";

const config = loadAppConfig();
const [songKey, ...aliasParts] = process.argv.slice(2);
const alias = aliasParts.join(" ").trim();

if (!songKey || alias.length === 0) {
  throw new Error("用法: npm run add:alias -- <歌曲id|标题|现有别名> <新别名>");
}

const result = addSongAlias(config.songDataPath, songKey, alias);
console.log(JSON.stringify(result, null, 2));

export interface AddSongAliasResult {
  ok: boolean;
  songId?: string;
  title?: string;
  alias: string;
  added: boolean;
  reason?: string;
}

export function addSongAlias(
  songDataPath: string,
  songKey: string,
  alias: string
): AddSongAliasResult {
  if (!existsSync(songDataPath)) {
    return { ok: false, alias, added: false, reason: "曲库文件不存在" };
  }

  const songs = loadSongs(songDataPath);
  const normalizedAlias = normalizeSearchTerm(alias);
  if (normalizedAlias.length === 0) {
    return {
      ok: false,
      alias,
      added: false,
      reason: "别名必须包含可搜索的文字或数字"
    };
  }

  const owners = findAliasOwners(songs, normalizedAlias);

  const target = findSong(songs, songKey);
  if (!target) {
    return { ok: false, alias, added: false, reason: "没有找到目标歌曲" };
  }

  if (owners.some((owner) => owner.id === target.id)) {
    const otherOwners = owners.filter((owner) => owner.id !== target.id);
    return {
      ok: true,
      songId: target.id,
      title: target.title,
      alias,
      added: false,
      reason:
        otherOwners.length > 0
          ? `别名已存在，且也被其他歌曲使用: ${otherOwners
              .map((owner) => owner.title)
              .join(", ")}`
          : "别名已存在"
    };
  }

  const owner = owners[0];
  if (owner) {
    return {
      ok: false,
      alias,
      added: false,
      reason: `别名已被其他歌曲使用: ${owner.title}`
    };
  }

  target.aliases = [...target.aliases, alias];
  writeFileSync(songDataPath, `${JSON.stringify(songs, null, 2)}\n`);

  return {
    ok: true,
    songId: target.id,
    title: target.title,
    alias,
    added: true
  };
}

function findAliasOwners(songs: Song[], normalizedAlias: string): Song[] {
  return songs.filter((song) => {
    if (
      normalizeSearchTerm(song.id) === normalizedAlias ||
      normalizeSearchTerm(`c${song.id}`) === normalizedAlias ||
      normalizeSearchTerm(song.title) === normalizedAlias
    ) {
      return true;
    }

    return song.aliases.some(
      (item) => normalizeSearchTerm(item) === normalizedAlias
    );
  });
}

function findSong(songs: Song[], key: string): Song | undefined {
  const normalizedKey = normalizeSearchTerm(key.replace(/^c/iu, ""));
  const normalizedRawKey = normalizeSearchTerm(key);

  return songs.find((song) => {
    if (
      normalizeSearchTerm(song.id) === normalizedKey ||
      normalizeSearchTerm(`c${song.id}`) === normalizedRawKey ||
      normalizeSearchTerm(song.title) === normalizedRawKey
    ) {
      return true;
    }

    return song.aliases.some(
      (alias) => normalizeSearchTerm(alias) === normalizedRawKey
    );
  });
}
