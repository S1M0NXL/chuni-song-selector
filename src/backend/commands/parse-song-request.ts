import {
  buildDifficultyAliasEntries,
  getDifficultyLabel
} from "../../shared/difficulty.js";
import type {
  CommandParseResult,
  DifficultyConfig,
  DifficultyName,
  ParsedSongRequest
} from "../../shared/types.js";

interface BoundaryDifficultyMatch {
  difficulty: DifficultyName;
  remaining: string;
}

interface CompactText {
  normalized: string;
  spans: Array<[start: number, end: number]>;
}

interface DifficultyAliasCandidate {
  difficulty: DifficultyName;
  alias: string;
  normalizedAlias: string;
  isAsciiWord: boolean;
  allowsLeadingAsciiAdjacency: boolean;
}

const ASCII_DIFFICULTY_ABBREVIATIONS = new Set([
  "we",
  "bas",
  "adv",
  "exp",
  "mas",
  "ult"
]);

export interface ParseSongRequestOptions {
  commandPrefix: string;
  difficulty: DifficultyConfig;
}

export function parseSongRequest(
  raw: string,
  options: ParseSongRequestOptions
): CommandParseResult {
  const commandMatch = new RegExp(
    `^\\s*${escapeRegExp(options.commandPrefix)}\\s+(.+?)\\s*$`,
    "u"
  ).exec(raw);

  if (!commandMatch) {
    return {
      ok: false,
      raw,
      reason: `指令必须以「${options.commandPrefix} 」开头`
    };
  }

  const content = commandMatch[1]?.trim() ?? "";
  if (content.length === 0) {
    return {
      ok: false,
      raw,
      reason: "缺少歌曲名称或别名"
    };
  }

  const leading = matchBoundaryDifficulty(content, "leading", options.difficulty);
  const afterLeading = leading?.remaining ?? content;
  const trailing = matchBoundaryDifficulty(
    afterLeading,
    "trailing",
    options.difficulty
  );

  if (leading && trailing && leading.difficulty !== trailing.difficulty) {
    return {
      ok: false,
      raw,
      reason: "前后填写的难度不一致"
    };
  }

  const query = (trailing?.remaining ?? afterLeading).trim();
  if (query.length === 0) {
    return {
      ok: false,
      raw,
      reason: "缺少歌曲名称或别名"
    };
  }

  const requestedDifficulty = leading?.difficulty ?? trailing?.difficulty ?? null;
  const requestedDifficultyLabel = requestedDifficulty
    ? getDifficultyLabel(requestedDifficulty, options.difficulty)
    : null;

  const value: ParsedSongRequest = {
    raw,
    query,
    requestedDifficulty,
    requestedDifficultyLabel,
    difficultySource: resolveDifficultySource(leading, trailing)
  };

  return { ok: true, value };
}

function resolveDifficultySource(
  leading: BoundaryDifficultyMatch | null,
  trailing: BoundaryDifficultyMatch | null
): ParsedSongRequest["difficultySource"] {
  if (leading && trailing) {
    return "both";
  }
  if (leading) {
    return "leading";
  }
  if (trailing) {
    return "trailing";
  }
  return null;
}

function matchBoundaryDifficulty(
  content: string,
  side: "leading" | "trailing",
  difficulty: DifficultyConfig
): BoundaryDifficultyMatch | null {
  const compact = compactWithSpans(content);
  if (compact.normalized.length === 0) {
    return null;
  }

  for (const entry of buildDifficultyAliasCandidates(difficulty)) {
    const match =
      side === "leading"
        ? matchLeadingDifficulty(content, compact, entry)
        : matchTrailingDifficulty(content, compact, entry);
    if (match) {
      return match;
    }
  }

  return null;
}

function matchLeadingDifficulty(
  content: string,
  compact: CompactText,
  entry: DifficultyAliasCandidate
): BoundaryDifficultyMatch | null {
  if (!compact.normalized.startsWith(entry.normalizedAlias)) {
    return null;
  }

  const lastAliasSpan = compact.spans[entry.normalizedAlias.length - 1];
  if (!lastAliasSpan) {
    return null;
  }

  const end = lastAliasSpan[1];
  const remaining = content.slice(end).trim();
  if (
    remaining.length === 0 ||
    hasLeadingAsciiWordCollision(content, end, entry)
  ) {
    return null;
  }

  return {
    difficulty: entry.difficulty,
    remaining
  };
}

function matchTrailingDifficulty(
  content: string,
  compact: CompactText,
  entry: DifficultyAliasCandidate
): BoundaryDifficultyMatch | null {
  if (!compact.normalized.endsWith(entry.normalizedAlias)) {
    return null;
  }

  const startOffset = compact.normalized.length - entry.normalizedAlias.length;
  const firstAliasSpan = compact.spans[startOffset];
  if (!firstAliasSpan) {
    return null;
  }

  const start = firstAliasSpan[0];
  const remaining = content.slice(0, start).trim();
  if (
    remaining.length === 0 ||
    hasAsciiWordCollisionBefore(content, start, entry)
  ) {
    return null;
  }

  return {
    difficulty: entry.difficulty,
    remaining
  };
}

function buildDifficultyAliasCandidates(
  difficulty: DifficultyConfig
): DifficultyAliasCandidate[] {
  return buildDifficultyAliasEntries(difficulty)
    .map((entry) => ({
      difficulty: entry.difficulty,
      alias: entry.alias,
      normalizedAlias: normalizeAlias(entry.alias),
      isAsciiWord: isAsciiWordAlias(entry.alias),
      allowsLeadingAsciiAdjacency: ASCII_DIFFICULTY_ABBREVIATIONS.has(
        normalizeAlias(entry.alias)
      )
    }))
    .filter((entry) => entry.normalizedAlias.length > 0)
    .sort((left, right) => {
      const normalizedLengthDiff =
        right.normalizedAlias.length - left.normalizedAlias.length;
      return normalizedLengthDiff !== 0
        ? normalizedLengthDiff
        : right.alias.length - left.alias.length;
    });
}

function compactWithSpans(content: string): CompactText {
  const chars: string[] = [];
  const spans: Array<[number, number]> = [];

  for (const { char, start, end } of iterateCodePoints(content)) {
    if (/\s/u.test(char)) {
      continue;
    }

    const normalized = normalizePiece(char);
    for (const normalizedChar of Array.from(normalized)) {
      chars.push(normalizedChar);
      spans.push([start, end]);
    }
  }

  return {
    normalized: chars.join(""),
    spans
  };
}

function* iterateCodePoints(
  value: string
): Generator<{ char: string; start: number; end: number }> {
  let index = 0;
  for (const char of value) {
    const start = index;
    index += char.length;
    yield { char, start, end: index };
  }
}

function normalizeAlias(value: string): string {
  return Array.from(value)
    .filter((char) => !/\s/u.test(char))
    .map(normalizePiece)
    .join("");
}

function normalizePiece(value: string): string {
  return value.normalize("NFKC").replace(/[’`]/gu, "'").toLocaleLowerCase();
}

function hasLeadingAsciiWordCollision(
  content: string,
  aliasEnd: number,
  entry: DifficultyAliasCandidate
): boolean {
  if (!entry.isAsciiWord) {
    return false;
  }

  const nextChar = content.slice(aliasEnd, aliasEnd + 1);
  if (nextChar.length === 0 || /\s/u.test(nextChar) || !isAsciiWordChar(nextChar)) {
    return false;
  }

  if (entry.allowsLeadingAsciiAdjacency && /^[A-Z]$/u.test(nextChar)) {
    return false;
  }

  return true;
}

function hasAsciiWordCollisionBefore(
  content: string,
  aliasStart: number,
  entry: DifficultyAliasCandidate
): boolean {
  if (!entry.isAsciiWord) {
    return false;
  }

  const previousChar = content.slice(aliasStart - 1, aliasStart);
  return (
    previousChar.length > 0 &&
    !/\s/u.test(previousChar) &&
    isAsciiWordChar(previousChar)
  );
}

function isAsciiWordAlias(value: string): boolean {
  const compact = Array.from(value).filter((char) => !/\s/u.test(char));
  return (
    compact.length > 0 &&
    compact.every((char) => isAsciiWordChar(char) || char === "'")
  );
}

function isAsciiWordChar(value: string): boolean {
  return /^[A-Za-z0-9_]$/u.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
