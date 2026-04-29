import { existsSync, readFileSync } from "node:fs";
import type { DifficultyMap, Song, SongDifficulty } from "../../shared/types.js";

export function loadSongs(songDataPath: string): Song[] {
  if (!existsSync(songDataPath)) {
    throw new Error(`曲库文件不存在: ${songDataPath}`);
  }

  const raw = JSON.parse(readFileSync(songDataPath, "utf8")) as unknown;

  if (!Array.isArray(raw)) {
    throw new Error("曲库文件必须是歌曲数组");
  }

  const songs = raw.map(normalizeSong);
  assertUniqueIds(songs);

  return songs;
}

function normalizeSong(raw: unknown, index: number): Song {
  if (!isRecord(raw)) {
    throw new Error(`第 ${index + 1} 首歌必须是对象`);
  }

  const id = readRequiredString(raw, "id", index);
  const title = readRequiredString(raw, "title", index);
  const artist = readRequiredString(raw, "artist", index);
  const version = readOptionalString(raw.version) ?? "";
  const genre = readOptionalString(raw.genre) ?? "";
  const aliases = readStringArray(raw.aliases, index);
  const difficulties = readDifficulties(raw.difficulties, index);

  const song: Song = {
    id,
    title,
    aliases,
    artist,
    version,
    genre,
    difficulties
  };

  const bpm = readOptionalNumber(raw.bpm);
  const cover = readOptionalString(raw.cover);
  const covers = readStringArray(raw.covers, index);
  if (bpm !== undefined) {
    song.bpm = bpm;
  }
  if (cover !== undefined) {
    song.cover = cover;
  }
  if (covers.length > 0) {
    song.covers = covers;
  }
  if (isRecord(raw.source)) {
    song.source = readSource(raw.source);
  }

  return song;
}

function assertUniqueIds(songs: Song[]): void {
  const seen = new Set<string>();
  for (const song of songs) {
    if (seen.has(song.id)) {
      throw new Error(`曲库中存在重复歌曲 id: ${song.id}`);
    }
    seen.add(song.id);
  }
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  index: number
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`第 ${index + 1} 首歌缺少字段: ${key}`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown, index: number): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`第 ${index + 1} 首歌的 aliases 必须是字符串数组`);
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readDifficulties(value: unknown, index: number): DifficultyMap {
  if (!isRecord(value)) {
    throw new Error(`第 ${index + 1} 首歌缺少 difficulties 对象`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, rawDifficulty]) => [
      key,
      normalizeDifficulty(rawDifficulty)
    ])
  ) as DifficultyMap;
}

function normalizeDifficulty(value: unknown): SongDifficulty | null {
  if (typeof value === "string") {
    const level = value.trim();
    return level.length > 0
      ? {
          level,
          const: Number.parseFloat(level.replace("+", ".5")),
          constDisplay: Number.parseFloat(level.replace("+", ".5")).toFixed(1)
        }
      : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const level = readOptionalString(value.level);
  const constValue = readOptionalNumber(value.const);
  if (!level || constValue === undefined) {
    return null;
  }

  const difficulty: SongDifficulty = {
    level,
    const: Math.round(constValue * 10) / 10,
    constDisplay:
      readOptionalString(value.constDisplay) ??
      (Math.round(constValue * 10) / 10).toFixed(1)
  };

  const notes = readOptionalNumber(value.notes);
  if (notes !== undefined) {
    difficulty.notes = notes;
  }

  return difficulty;
}

function readSource(value: Record<string, unknown>): NonNullable<Song["source"]> {
  const source: NonNullable<Song["source"]> = {};
  const idx = readOptionalString(value.idx);
  const chunirecId = readOptionalString(value.chunirecId);
  const imageHash = readOptionalString(value.imageHash);

  if (idx) {
    source.idx = idx;
  }
  if (chunirecId) {
    source.chunirecId = chunirecId;
  }
  if (imageHash) {
    source.imageHash = imageHash;
  }

  return source;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
