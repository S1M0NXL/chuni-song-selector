import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_DIFFICULTY_ALIASES,
  DEFAULT_DIFFICULTY_LABELS,
  DEFAULT_DIFFICULTY_PRIORITY,
  isDifficultyName
} from "../../shared/difficulty.js";
import type { DifficultyConfig, DifficultyName } from "../../shared/types.js";

export type DefaultDifficulty = "highest" | DifficultyName;

export interface AppConfig {
  bilibiliRoomId: number | null;
  songDataPath: string;
  coverBasePath: string;
  commandPrefix: string;
  difficulty: DifficultyConfig;
  defaultDifficulty: DefaultDifficulty;
  fuzzyMatchThreshold: number;
  maxSearchResults: number;
}

export function loadAppConfig(cwd = process.cwd()): AppConfig {
  loadDotEnv(resolve(cwd, ".env"));

  return {
    bilibiliRoomId: readOptionalNumber("BILIBILI_ROOM_ID"),
    songDataPath: resolve(cwd, readEnv("SONG_DATA_PATH", "data/songs.json")),
    coverBasePath: resolve(cwd, readEnv("COVER_BASE_PATH", "assets/covers")),
    commandPrefix: readEnv("COMMAND_PREFIX", "点歌"),
    difficulty: readDifficultyConfig(),
    defaultDifficulty: readDefaultDifficulty(),
    fuzzyMatchThreshold: readNumber("FUZZY_MATCH_THRESHOLD", 0.6),
    maxSearchResults: readInteger("MAX_SEARCH_RESULTS", 5)
  };
}

function loadDotEnv(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= stripOptionalQuotes(value);
  }
}

function stripOptionalQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function readEnv(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readOptionalNumber(key: string): number | null {
  const raw = process.env[key]?.trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readNumber(key: string, fallback: number): number {
  const value = readOptionalNumber(key);
  return value ?? fallback;
}

function readInteger(key: string, fallback: number): number {
  return Math.max(1, Math.floor(readNumber(key, fallback)));
}

function readDefaultDifficulty(): DefaultDifficulty {
  const value = readEnv("DEFAULT_DIFFICULTY", "highest");
  if (value === "highest" || isDifficultyName(value)) {
    return value;
  }

  return "highest";
}

function readDifficultyConfig(): DifficultyConfig {
  const priority = parseDifficultyPriority(
    readEnv("DIFFICULTY_PRIORITY", DEFAULT_DIFFICULTY_PRIORITY.join(","))
  );
  const labels = parseDifficultyLabels(readEnv("DIFFICULTY_LABELS", ""));
  const aliases = parseDifficultyAliases(readEnv("DIFFICULTY_ALIASES", ""));

  return {
    priority,
    labels: { ...DEFAULT_DIFFICULTY_LABELS, ...labels },
    aliases: { ...DEFAULT_DIFFICULTY_ALIASES, ...aliases }
  };
}

function parseDifficultyPriority(raw: string): DifficultyName[] {
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(isDifficultyName);

  return parsed.length > 0 ? parsed : DEFAULT_DIFFICULTY_PRIORITY;
}

function parseDifficultyLabels(raw: string): Partial<Record<DifficultyName, string>> {
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length !== DEFAULT_DIFFICULTY_PRIORITY.length) {
    return {};
  }

  return Object.fromEntries(
    DEFAULT_DIFFICULTY_PRIORITY.map((difficulty, index) => [
      difficulty,
      values[index] ?? DEFAULT_DIFFICULTY_LABELS[difficulty]
    ])
  ) as Partial<Record<DifficultyName, string>>;
}

function parseDifficultyAliases(
  raw: string
): Partial<Record<DifficultyName, string[]>> {
  const groups = raw.split(",").map((group) => group.trim());
  if (groups.length !== DEFAULT_DIFFICULTY_PRIORITY.length) {
    return {};
  }

  return Object.fromEntries(
    DEFAULT_DIFFICULTY_PRIORITY.map((difficulty, index) => [
      difficulty,
      groups[index]?.split("|").map((item) => item.trim()).filter(Boolean) ??
        DEFAULT_DIFFICULTY_ALIASES[difficulty]
    ])
  ) as Partial<Record<DifficultyName, string[]>>;
}
