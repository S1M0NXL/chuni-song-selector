import {
  getDifficultyLabel,
  getHighestAvailableDifficulty
} from "../../shared/difficulty.js";
import type {
  DifficultyName,
  SearchResult,
  Song,
  SongDifficulty
} from "../../shared/types.js";
import type { AppConfig } from "../config/app-config.js";
import { searchSongs } from "../search/fuzzy-search.js";
import type { SongDatabase } from "../songs/song-database.js";
import { parseSongRequest } from "./parse-song-request.js";

export type InspectResult = InspectSuccessResult | InspectFailedResult;

export interface InspectSuccessResult {
  ok: true;
  searchRawData: string;
  matchedScore: number;
  matchedTerm: string;
  matchedField: SearchResult["matchedField"];
  song: InspectSong;
  chart: InspectChart;
}

export interface InspectFailedResult {
  ok: false;
  error: string;
  searchRawData?: string;
  matchedScore?: number;
  matchedTerm?: string;
  matchedField?: SearchResult["matchedField"];
  song?: InspectSong;
}

export interface InspectSong {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  genre: string;
  version: string;
  cover: string | null;
}

export interface InspectChart {
  difficulty: DifficultyName;
  difficultyLabel: string;
  level: string;
  const: number;
  constDisplay: string;
  notes: number | null;
}

export function inspectSongRequest(
  rawInput: string,
  database: SongDatabase,
  config: AppConfig
): InspectResult {
  const result = parseSongRequest(rawInput, {
    commandPrefix: config.commandPrefix,
    difficulty: config.difficulty
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.reason
    };
  }

  const results = searchSongs(database.terms(), result.value.query, {
    threshold: config.fuzzyMatchThreshold,
    limit: config.maxSearchResults
  });
  const best = results[0];

  if (!best) {
    return {
      ok: false,
      searchRawData: result.value.query,
      error: "没有找到匹配曲目"
    };
  }

  const chart = selectChart(best.song, result.value.requestedDifficulty, config);
  if (!chart) {
    return {
      ok: false,
      searchRawData: result.value.query,
      matchedScore: roundScore(best.score),
      matchedTerm: best.matchedTerm,
      matchedField: best.matchedField,
      song: toInspectSong(best.song),
      error: result.value.requestedDifficulty
        ? "该曲目没有指定难度"
        : "该曲目没有可用难度"
    };
  }

  return {
    ok: true,
    searchRawData: result.value.query,
    matchedScore: roundScore(best.score),
    matchedTerm: best.matchedTerm,
    matchedField: best.matchedField,
    song: toInspectSong(best.song),
    chart
  };
}

export function isSongCommandText(rawInput: string, config: AppConfig): boolean {
  return new RegExp(`^\\s*${escapeRegExp(config.commandPrefix)}\\s+`, "u").test(
    rawInput
  );
}

function selectChart(
  song: Song,
  requestedDifficulty: DifficultyName | null,
  config: AppConfig
): InspectChart | null {
  const difficulty = resolveDifficulty(song, requestedDifficulty, config);

  if (!difficulty) {
    return null;
  }

  const chart = song.difficulties[difficulty];
  if (!isAvailableChart(chart)) {
    return null;
  }

  return {
    difficulty,
    difficultyLabel: getDifficultyLabel(difficulty, config.difficulty),
    level: chart.level,
    const: chart.const,
    constDisplay: chart.constDisplay,
    notes: chart.notes ?? null
  };
}

function resolveDifficulty(
  song: Song,
  requestedDifficulty: DifficultyName | null,
  config: AppConfig
): DifficultyName | null {
  if (requestedDifficulty) {
    return requestedDifficulty;
  }

  if (config.defaultDifficulty !== "highest") {
    return config.defaultDifficulty;
  }

  return getHighestAvailableDifficulty(song.difficulties, config.difficulty.priority);
}

function toInspectSong(song: Song): InspectSong {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    bpm: song.bpm ?? null,
    genre: song.genre,
    version: song.version,
    cover: song.cover ?? null
  };
}

function isAvailableChart(
  chart: SongDifficulty | null | undefined
): chart is SongDifficulty {
  return Boolean(chart?.level.trim());
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
