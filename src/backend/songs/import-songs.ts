import { readFileSync, writeFileSync } from "node:fs";
import { loadAppConfig } from "../config/app-config.js";
import { loadSongs } from "./song-loader.js";
import type {
  DifficultyMap,
  DifficultyName,
  Song,
  SongDifficulty
} from "../../shared/types.js";

const REIWA_URL = "https://reiwa.f5.si/chunithm_record.json";
const CHUNITHM_UTIL_ALIAS_URL =
  "https://raw.githubusercontent.com/AmethystTim/ChunithmUtil/master/data/alias.json";
const CHUNI_PENGUIN_SONGS_URL =
  "https://raw.githubusercontent.com/beer-psi/chuni-penguin/develop/chuni_penguin/database/seeds/songs.json";

const DIFFICULTY_MAP: Record<string, DifficultyName> = {
  BAS: "basic",
  ADV: "advanced",
  EXP: "expert",
  MAS: "master",
  ULT: "ultima",
  WE: "worlds_end"
};

interface ReiwaRecord {
  title: string;
  artist: string;
  img: string;
  genre: string;
  const: number;
  level: number;
  diff: string;
  notes?: number;
  chunirec_id: string;
  idx: string;
  bpm?: number;
  version: string;
}

interface PenguinSong {
  id: number;
  title: string;
  genre: string;
  artist: string;
  version: string;
  bpm?: number;
  jacket?: string | null;
  jackets?: string[];
  aliases?: string[];
}

interface AliasRecord {
  cid: string;
  aliases: string[];
}

interface ExistingSongAliasSource {
  id?: string;
  title?: string;
  source?: {
    idx?: string;
  };
  aliases: string[];
}

const config = loadAppConfig();
const existingSongs = loadExistingSongs(config.songDataPath);
const reiwaRecords = await fetchJson<ReiwaRecord[]>(REIWA_URL);
const aliasRecords = await fetchJson<{ songs: AliasRecord[] }>(
  CHUNITHM_UTIL_ALIAS_URL
);
const penguinSongs = await fetchJson<PenguinSong[]>(CHUNI_PENGUIN_SONGS_URL);

const songs = buildSongs(
  reiwaRecords,
  aliasRecords.songs,
  penguinSongs,
  existingSongs
);
writeFileSync(config.songDataPath, `${JSON.stringify(songs, null, 2)}\n`);

console.log(`Imported ${songs.length} songs to ${config.songDataPath}`);

function loadExistingSongs(songDataPath: string): ExistingSongAliasSource[] {
  try {
    return loadSongs(songDataPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`旧曲库严格读取失败，尝试只合并别名: ${message}`);
  }

  try {
    const raw = JSON.parse(readFileSync(songDataPath, "utf8")) as unknown;
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter(isRecord)
      .map((song) => {
        const aliasSource: ExistingSongAliasSource = {
          aliases: Array.isArray(song.aliases)
            ? song.aliases.filter(
                (alias): alias is string => typeof alias === "string"
              )
            : []
        };
        const id = readLooseString(song.id);
        const title = readLooseString(song.title);

        if (id) {
          aliasSource.id = id;
        }
        if (title) {
          aliasSource.title = title;
        }
        if (isRecord(song.source)) {
          const idx = readLooseString(song.source.idx);
          if (idx) {
            aliasSource.source = { idx };
          }
        }

        return aliasSource;
      })
      .filter((song) => song.aliases.length > 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`跳过旧曲库别名合并: ${message}`);
    return [];
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "chuni-song-selector/0.1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`下载失败: ${url} ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return JSON.parse(text.replace(/^\uFEFF/u, "")) as T;
}

function buildSongs(
  records: ReiwaRecord[],
  aliasRecords: AliasRecord[],
  penguinSongs: PenguinSong[],
  existingSongs: ExistingSongAliasSource[]
): Song[] {
  const aliasesByCid = new Map(
    aliasRecords.map((record) => [String(record.cid), record.aliases])
  );
  const penguinById = new Map(penguinSongs.map((song) => [String(song.id), song]));
  const existingAliases = buildExistingAliasMap(existingSongs);
  const recordsByIdx = groupBy(records, getRecordGroupKey);
  const sourceAliasOwners = buildSourceAliasOwnerMap(
    recordsByIdx,
    aliasesByCid,
    penguinById
  );

  return [...recordsByIdx.entries()]
    .sort(compareSongGroups)
    .map(([groupKey, songRecords]) => {
      const first = songRecords[0];
      if (!first) {
        throw new Error(`曲库记录为空: ${groupKey}`);
      }

      const idx = first.idx.trim();
      const songId = idx || slugifyId(first.title);
      const penguin = penguinById.get(idx);
      const preservedAliases = skipAliasesOwnedByOtherSongs(
        songId,
        [
          ...(existingAliases.get(normalizeKey(songId)) ?? []),
          ...(idx ? existingAliases.get(normalizeKey(idx)) ?? [] : []),
          ...(existingAliases.get(normalizeKey(first.title)) ?? [])
        ],
        sourceAliasOwners
      );
      const aliases = uniqueStrings([
        ...(penguin?.aliases ?? []),
        ...(aliasesByCid.get(idx) ?? []),
        ...preservedAliases
      ]);
      const cover = pickCover(idx, first, penguin);
      const covers = uniqueStrings([cover, ...(penguin?.jackets ?? [])]);
      const source = {
        chunirecId: first.chunirec_id,
        imageHash: first.img
      };
      if (idx) {
        Object.assign(source, { idx });
      }

      const song: Song = {
        id: songId,
        title: first.title,
        aliases,
        artist: first.artist || penguin?.artist || "",
        genre: first.genre || penguin?.genre || "",
        version: first.version || penguin?.version || "",
        cover,
        covers,
        source,
        difficulties: Object.fromEntries(
          songRecords
            .map((record) => [DIFFICULTY_MAP[record.diff], toDifficulty(record)] as const)
            .filter((entry): entry is [DifficultyName, SongDifficulty] =>
              Boolean(entry[0])
            )
        ) as DifficultyMap
      };

      const bpm = first.bpm ?? penguin?.bpm;
      if (typeof bpm === "number" && Number.isFinite(bpm)) {
        song.bpm = bpm;
      }

      return song;
    });
}

function buildSourceAliasOwnerMap(
  recordsByIdx: Map<string, ReiwaRecord[]>,
  aliasesByCid: Map<string, string[]>,
  penguinById: Map<string, PenguinSong>
): Map<string, string> {
  const owners = new Map<string, string>();

  for (const songRecords of recordsByIdx.values()) {
    const first = songRecords[0];
    if (!first) {
      continue;
    }

    const idx = first.idx.trim();
    const songId = idx || slugifyId(first.title);
    const penguin = penguinById.get(idx);
    const aliases = uniqueStrings([
      ...(penguin?.aliases ?? []),
      ...(aliasesByCid.get(idx) ?? [])
    ]);

    for (const alias of aliases) {
      const normalized = normalizeKey(alias);
      if (!owners.has(normalized)) {
        owners.set(normalized, songId);
      }
    }
  }

  return owners;
}

function skipAliasesOwnedByOtherSongs(
  songId: string,
  aliases: string[],
  sourceAliasOwners: Map<string, string>
): string[] {
  return aliases.filter((alias) => {
    const owner = sourceAliasOwners.get(normalizeKey(alias));
    return !owner || owner === songId;
  });
}

function buildExistingAliasMap(
  songs: ExistingSongAliasSource[]
): Map<string, string[]> {
  const aliasesByKey = new Map<string, string[]>();

  for (const song of songs) {
    const keys = [song.id, song.title, song.source?.idx].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );

    for (const key of keys) {
      aliasesByKey.set(normalizeKey(key), [
        ...(aliasesByKey.get(normalizeKey(key)) ?? []),
        ...song.aliases
      ]);
    }
  }

  return aliasesByKey;
}

function toDifficulty(record: ReiwaRecord): SongDifficulty {
  const difficulty: SongDifficulty = {
    level: formatLevel(record.level),
    const: roundConst(record.const),
    constDisplay: roundConst(record.const).toFixed(1)
  };

  if (typeof record.notes === "number" && Number.isFinite(record.notes)) {
    difficulty.notes = record.notes;
  }

  return difficulty;
}

function pickCover(
  idx: string,
  record: ReiwaRecord,
  penguin: PenguinSong | undefined
): string {
  const preferred = penguin?.jackets?.find((url) =>
    url.endsWith(`/assets/jackets/${idx}.webp`)
  );
  if (preferred) {
    return preferred;
  }

  const webp = penguin?.jackets?.find((url) => url.endsWith(".webp"));
  if (webp) {
    return webp;
  }

  if (penguin?.jacket) {
    return `https://new.chunithm-net.com/chuni-mobile/html/mobile/img/${penguin.jacket}`;
  }

  return `https://new.chunithm-net.com/chuni-mobile/html/mobile/img/${record.img}.jpg`;
}

function formatLevel(level: number): string {
  return Number.isInteger(level) ? String(level) : `${Math.floor(level)}+`;
}

function roundConst(value: number): number {
  return Math.round(value * 10) / 10;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, "");
}

function groupBy<T>(
  values: T[],
  keyOf: (value: T) => string
): Map<string, T[]> {
  const result = new Map<string, T[]>();

  for (const value of values) {
    const key = keyOf(value);
    const group = result.get(key) ?? [];
    group.push(value);
    result.set(key, group);
  }

  return result;
}

function getRecordGroupKey(record: ReiwaRecord): string {
  const idx = record.idx.trim();
  if (idx) {
    return idx;
  }

  return `${record.chunirec_id.trim() || record.title.trim()}:${record.title.trim()}`;
}

function compareSongGroups(
  [leftKey]: [string, ReiwaRecord[]],
  [rightKey]: [string, ReiwaRecord[]]
): number {
  const leftNumber = Number(leftKey);
  const rightNumber = Number(rightKey);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  if (Number.isFinite(leftNumber)) {
    return -1;
  }

  if (Number.isFinite(rightNumber)) {
    return 1;
  }

  return leftKey.localeCompare(rightKey);
}

function slugifyId(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/['"`’]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return normalized || `song-${Buffer.from(value).toString("hex").slice(0, 16)}`;
}

function readLooseString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
