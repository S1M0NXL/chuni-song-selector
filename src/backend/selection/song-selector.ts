import {
  getDifficultyLabel,
  getHighestAvailableDifficulty
} from "../../shared/difficulty.js";
import type {
  DifficultyConfig,
  DifficultyName,
  SelectedDifficulty,
  Song,
  SongSelectorEvent
} from "../../shared/types.js";
import { parseSongRequest } from "../commands/parse-song-request.js";
import { searchSongs } from "../search/fuzzy-search.js";
import type { SongDatabase } from "../songs/song-database.js";

export interface SongSelectorOptions {
  commandPrefix: string;
  difficulty: DifficultyConfig;
  defaultDifficulty?: "highest" | DifficultyName;
  fuzzyMatchThreshold: number;
  maxSearchResults: number;
}

export function selectSongFromMessage(
  raw: string,
  database: SongDatabase,
  options: SongSelectorOptions
): SongSelectorEvent {
  const parsed = parseSongRequest(raw, {
    commandPrefix: options.commandPrefix,
    difficulty: options.difficulty
  });

  if (!parsed.ok) {
    return {
      type: "song-command-invalid",
      raw,
      reason: parsed.reason
    };
  }

  const results = searchSongs(database.terms(), parsed.value.query, {
    threshold: options.fuzzyMatchThreshold,
    limit: options.maxSearchResults
  });

  if (results.length === 0) {
    return {
      type: "song-search-failed",
      query: parsed.value.query,
      reason: "没有找到匹配曲目"
    };
  }

  const best = results[0];
  if (!best) {
    return {
      type: "song-search-failed",
      query: parsed.value.query,
      reason: "没有找到匹配曲目"
    };
  }

  const selectedDifficulty = selectDifficulty(
    best.song,
    parsed.value.requestedDifficulty,
    options.difficulty,
    options.defaultDifficulty ?? "highest"
  );

  if (!selectedDifficulty) {
    return {
      type: "song-search-failed",
      query: parsed.value.query,
      reason: parsed.value.requestedDifficulty
        ? "该曲目没有指定难度"
        : "该曲目没有可用难度"
    };
  }

  return {
    type: "song-selected",
    query: parsed.value.query,
    requestedDifficulty: parsed.value.requestedDifficultyLabel,
    matchedScore: roundScore(best.score),
    song: best.song,
    selectedDifficulty
  };
}

function selectDifficulty(
  song: Song,
  requestedDifficulty: DifficultyName | null,
  difficulty: DifficultyConfig,
  defaultDifficulty: "highest" | DifficultyName
): SelectedDifficulty | null {
  const name =
    requestedDifficulty ??
    (defaultDifficulty === "highest"
      ? getHighestAvailableDifficulty(song.difficulties, difficulty.priority)
      : defaultDifficulty);

  if (!name) {
    return null;
  }

  const chart = song.difficulties[name];
  if (!chart || typeof chart.level !== "string" || chart.level.trim().length === 0) {
    return null;
  }

  const selected: SelectedDifficulty = {
    name,
    label: getDifficultyLabel(name, difficulty),
    level: chart.level,
    const: chart.const,
    constDisplay: chart.constDisplay
  };

  if (chart.notes !== undefined) {
    selected.notes = chart.notes;
  }

  return selected;
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}
