import { existsSync, writeFileSync } from "node:fs";
import { loadAppConfig } from "../config/app-config.js";
import { normalizeSearchTerm } from "../search/fuzzy-search.js";
import type { Song } from "../../shared/types.js";
import { loadSongs } from "./song-loader.js";

const config = loadAppConfig();
const args = process.argv.slice(2);
const deleteFromAll = args[0] === "--all";
const [songKey, ...aliasParts] = deleteFromAll ? ["", ...args.slice(1)] : args;
const alias = aliasParts.join(" ").trim();

if ((!deleteFromAll && !songKey) || alias.length === 0) {
  throw new Error(
    [
      "用法:",
      "npm run delete:alias -- <歌曲id|标题|现有别名> <要删除的别名>",
      "npm run delete:alias -- --all <要删除的别名>"
    ].join("\n")
  );
}

const result = deleteFromAll
  ? deleteAliasFromAllSongs(config.songDataPath, alias)
  : deleteSongAlias(config.songDataPath, songKey ?? "", alias);
console.log(JSON.stringify(result, null, 2));

export interface DeletedAliasSong {
  songId: string;
  title: string;
  removedCount: number;
}

export interface DeleteSongAliasResult {
  ok: boolean;
  alias: string;
  removed: boolean;
  removedCount: number;
  songId?: string;
  title?: string;
  songs?: DeletedAliasSong[];
  reason?: string;
}

export function deleteSongAlias(
  songDataPath: string,
  songKey: string,
  alias: string
): DeleteSongAliasResult {
  const songs = readSongs(songDataPath);
  if (!songs) {
    return {
      ok: false,
      alias,
      removed: false,
      removedCount: 0,
      reason: "曲库文件不存在"
    };
  }
  if (normalizeSearchTerm(alias).length === 0) {
    return {
      ok: false,
      alias,
      removed: false,
      removedCount: 0,
      reason: "别名必须包含可搜索的文字或数字"
    };
  }

  const target = findSong(songs, songKey);
  if (!target) {
    return {
      ok: false,
      alias,
      removed: false,
      removedCount: 0,
      reason: "没有找到目标歌曲"
    };
  }

  const removedCount = removeAliasFromSong(target, alias);
  if (removedCount > 0) {
    writeSongs(songDataPath, songs);
  }

  const result: DeleteSongAliasResult = {
    ok: true,
    songId: target.id,
    title: target.title,
    alias,
    removed: removedCount > 0,
    removedCount
  };
  if (removedCount === 0) {
    result.reason = "目标歌曲不存在该别名";
  }

  return result;
}

export function deleteAliasFromAllSongs(
  songDataPath: string,
  alias: string
): DeleteSongAliasResult {
  const songs = readSongs(songDataPath);
  if (!songs) {
    return {
      ok: false,
      alias,
      removed: false,
      removedCount: 0,
      reason: "曲库文件不存在"
    };
  }
  if (normalizeSearchTerm(alias).length === 0) {
    return {
      ok: false,
      alias,
      removed: false,
      removedCount: 0,
      reason: "别名必须包含可搜索的文字或数字"
    };
  }

  const changedSongs: DeletedAliasSong[] = [];
  let removedCount = 0;

  for (const song of songs) {
    const removedFromSong = removeAliasFromSong(song, alias);
    if (removedFromSong === 0) {
      continue;
    }

    removedCount += removedFromSong;
    changedSongs.push({
      songId: song.id,
      title: song.title,
      removedCount: removedFromSong
    });
  }

  if (removedCount > 0) {
    writeSongs(songDataPath, songs);
  }

  const result: DeleteSongAliasResult = {
    ok: true,
    alias,
    removed: removedCount > 0,
    removedCount,
    songs: changedSongs
  };
  if (removedCount === 0) {
    result.reason = "曲库中不存在该别名";
  }

  return result;
}

function readSongs(songDataPath: string): Song[] | null {
  if (!existsSync(songDataPath)) {
    return null;
  }

  return loadSongs(songDataPath);
}

function writeSongs(songDataPath: string, songs: Song[]): void {
  writeFileSync(songDataPath, `${JSON.stringify(songs, null, 2)}\n`);
}

function removeAliasFromSong(song: Song, alias: string): number {
  const normalizedAlias = normalizeSearchTerm(alias);
  const before = song.aliases.length;
  song.aliases = song.aliases.filter(
    (item) => normalizeSearchTerm(item) !== normalizedAlias
  );

  return before - song.aliases.length;
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
