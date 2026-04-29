import {
  DIFFICULTY_NAMES,
  type DifficultyConfig,
  type DifficultyMap,
  type DifficultyName
} from "./types.js";

export const DEFAULT_DIFFICULTY_PRIORITY: DifficultyName[] = [
  "worlds_end",
  "basic",
  "advanced",
  "expert",
  "master",
  "ultima"
];

export const DEFAULT_DIFFICULTY_LABELS: Record<DifficultyName, string> = {
  worlds_end: "彩",
  basic: "绿",
  advanced: "黄",
  expert: "红",
  master: "紫",
  ultima: "黑"
};

export const DEFAULT_DIFFICULTY_ALIASES: Record<DifficultyName, string[]> = {
  worlds_end: ["彩", "彩谱", "WE", "World's End", "Worlds End"],
  basic: ["绿", "绿谱", "BAS", "Basic"],
  advanced: ["黄", "黄谱", "ADV", "Advanced"],
  expert: ["红", "红谱", "EXP", "Expert"],
  master: ["紫", "紫谱", "MAS", "Master"],
  ultima: ["黑", "黑谱", "ULT", "Ultima"]
};

export const DEFAULT_DIFFICULTY_CONFIG: DifficultyConfig = {
  priority: DEFAULT_DIFFICULTY_PRIORITY,
  labels: DEFAULT_DIFFICULTY_LABELS,
  aliases: DEFAULT_DIFFICULTY_ALIASES
};

export interface DifficultyAliasEntry {
  difficulty: DifficultyName;
  alias: string;
  normalizedAlias: string;
}

export function isDifficultyName(value: string): value is DifficultyName {
  return (DIFFICULTY_NAMES as readonly string[]).includes(value);
}

export function normalizeDifficultyAlias(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, "");
}

export function buildDifficultyAliasEntries(
  config: DifficultyConfig = DEFAULT_DIFFICULTY_CONFIG
): DifficultyAliasEntry[] {
  const entries: DifficultyAliasEntry[] = [];

  for (const difficulty of config.priority) {
    const values = new Set([
      config.labels[difficulty],
      difficulty,
      ...(config.aliases[difficulty] ?? [])
    ]);

    for (const alias of values) {
      const normalizedAlias = normalizeDifficultyAlias(alias);
      if (normalizedAlias.length > 0) {
        entries.push({ difficulty, alias, normalizedAlias });
      }
    }
  }

  return entries.sort((left, right) => right.alias.length - left.alias.length);
}

export function findDifficultyByAlias(
  value: string,
  config: DifficultyConfig = DEFAULT_DIFFICULTY_CONFIG
): DifficultyName | null {
  const normalizedValue = normalizeDifficultyAlias(value);

  for (const entry of buildDifficultyAliasEntries(config)) {
    if (entry.normalizedAlias === normalizedValue) {
      return entry.difficulty;
    }
  }

  return null;
}

export function getDifficultyLabel(
  difficulty: DifficultyName,
  config: DifficultyConfig = DEFAULT_DIFFICULTY_CONFIG
): string {
  return config.labels[difficulty] ?? difficulty;
}

export function getHighestAvailableDifficulty(
  difficulties: DifficultyMap,
  priority: DifficultyName[] = DEFAULT_DIFFICULTY_PRIORITY
): DifficultyName | null {
  for (const difficulty of [...priority].reverse()) {
    const chart = difficulties[difficulty];
    if (chart && typeof chart.level === "string" && chart.level.trim().length > 0) {
      return difficulty;
    }
  }

  return null;
}
