import type { SearchResult, Song } from "../../shared/types.js";
import type { SongSearchTerm } from "../songs/song-database.js";

export interface FuzzySearchOptions {
  threshold: number;
  limit: number;
}

export function searchSongs(
  terms: SongSearchTerm[],
  query: string,
  options: FuzzySearchOptions
): SearchResult[] {
  const normalizedQuery = normalizeSearchTerm(query);
  const bestBySong = new Map<string, SearchResult>();

  if (normalizedQuery.length === 0) {
    return [];
  }

  for (const term of terms) {
    const score = scoreTerm(normalizedQuery, normalizeSearchTerm(term.term));
    const current = bestBySong.get(term.song.id);

    if (!current || score > current.score) {
      bestBySong.set(term.song.id, {
        song: term.song,
        score,
        matchedTerm: term.term,
        matchedField: term.field
      });
    }
  }

  return [...bestBySong.values()]
    .filter((result) => result.score >= options.threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, options.limit);
}

export function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, "")
    .replace(/[^\p{L}\p{N}+#'._-]/gu, "");
}

function scoreTerm(normalizedQuery: string, normalizedTerm: string): number {
  if (normalizedTerm.length === 0) {
    return 0;
  }

  if (normalizedQuery === normalizedTerm) {
    return 1;
  }

  if (normalizedQuery.length <= 1) {
    return 0;
  }

  if (normalizedTerm.startsWith(normalizedQuery)) {
    return 0.96;
  }

  if (normalizedTerm.includes(normalizedQuery)) {
    return 0.9;
  }

  if (normalizedQuery.includes(normalizedTerm)) {
    return 0.84;
  }

  return Math.max(
    diceCoefficient(normalizedQuery, normalizedTerm),
    levenshteinSimilarity(normalizedQuery, normalizedTerm)
  );
}

function diceCoefficient(left: string, right: string): number {
  if (left.length < 2 || right.length < 2) {
    return left === right ? 1 : 0;
  }

  const leftPairs = toBigrams(left);
  const rightPairs = toBigrams(right);
  let intersections = 0;
  const rightCounts = new Map<string, number>();

  for (const pair of rightPairs) {
    rightCounts.set(pair, (rightCounts.get(pair) ?? 0) + 1);
  }

  for (const pair of leftPairs) {
    const count = rightCounts.get(pair) ?? 0;
    if (count > 0) {
      intersections += 1;
      rightCounts.set(pair, count - 1);
    }
  }

  return (2 * intersections) / (leftPairs.length + rightPairs.length);
}

function toBigrams(value: string): string[] {
  const pairs: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    pairs.push(value.slice(index, index + 2));
  }
  return pairs;
}

function levenshteinSimilarity(left: string, right: string): number {
  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + cost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}

export function toSearchPreview(results: SearchResult[]): Pick<
  SearchResult,
  "score" | "matchedTerm" | "matchedField"
>[] {
  return results.map(({ score, matchedTerm, matchedField }) => ({
    score,
    matchedTerm,
    matchedField
  }));
}

export function getSongSearchTerms(song: Song): string[] {
  return [song.title, ...song.aliases];
}
