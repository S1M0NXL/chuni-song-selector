export const DIFFICULTY_NAMES = [
  "worlds_end",
  "basic",
  "advanced",
  "expert",
  "master",
  "ultima"
] as const;

export type DifficultyName = (typeof DIFFICULTY_NAMES)[number];

export interface SongDifficulty {
  level: string;
  const: number;
  constDisplay: string;
  notes?: number;
}

export type DifficultyMap = Partial<Record<DifficultyName, SongDifficulty | null>>;

export interface DifficultyConfig {
  priority: DifficultyName[];
  labels: Record<DifficultyName, string>;
  aliases: Record<DifficultyName, string[]>;
}

export interface Song {
  id: string;
  title: string;
  aliases: string[];
  artist: string;
  version: string;
  genre: string;
  bpm?: number;
  cover?: string;
  covers?: string[];
  source?: {
    idx?: string;
    chunirecId?: string;
    imageHash?: string;
  };
  difficulties: DifficultyMap;
}

export interface ParsedSongRequest {
  raw: string;
  query: string;
  requestedDifficulty: DifficultyName | null;
  requestedDifficultyLabel: string | null;
  difficultySource: "leading" | "trailing" | "both" | null;
}

export interface InvalidCommandResult {
  ok: false;
  raw: string;
  reason: string;
}

export type CommandParseResult =
  | {
      ok: true;
      value: ParsedSongRequest;
    }
  | InvalidCommandResult;

export interface SearchResult {
  song: Song;
  score: number;
  matchedTerm: string;
  matchedField: "id" | "title" | "alias";
}

export interface SelectedDifficulty {
  name: DifficultyName;
  label: string;
  level: string;
  const: number;
  constDisplay: string;
  notes?: number;
}

export interface SongSelectedEvent {
  type: "song-selected";
  query: string;
  requestedDifficulty: string | null;
  matchedScore: number;
  song: Song;
  selectedDifficulty: SelectedDifficulty;
}

export interface SongCandidatesEvent {
  type: "song-candidates";
  query: string;
  candidates: SearchResult[];
}

export interface SongSearchFailedEvent {
  type: "song-search-failed";
  query: string;
  reason: string;
}

export interface SongCommandInvalidEvent {
  type: "song-command-invalid";
  raw: string;
  reason: string;
}

export type SongSelectorEvent =
  | SongSelectedEvent
  | SongCandidatesEvent
  | SongSearchFailedEvent
  | SongCommandInvalidEvent;
