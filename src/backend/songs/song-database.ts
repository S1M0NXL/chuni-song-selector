import type { Song } from "../../shared/types.js";

export interface SongSearchTerm {
  song: Song;
  term: string;
  field: "id" | "title" | "alias";
}

export class SongDatabase {
  private readonly songsById = new Map<string, Song>();
  private readonly searchTerms: SongSearchTerm[];

  constructor(private readonly songs: Song[]) {
    for (const song of songs) {
      this.songsById.set(song.id, song);
    }

    this.searchTerms = songs.flatMap((song) => {
      const ids = new Set([
        song.id,
        `c${song.id}`,
        song.source?.idx,
        song.source?.idx ? `c${song.source.idx}` : undefined
      ]);

      return [
        ...[...ids]
          .filter(
            (term): term is string => typeof term === "string" && term.length > 0
          )
          .map((term) => ({ song, term, field: "id" as const })),
        { song, term: song.title, field: "title" as const },
        ...song.aliases.map((alias) => ({
          song,
          term: alias,
          field: "alias" as const
        }))
      ];
    });
  }

  all(): Song[] {
    return [...this.songs];
  }

  findById(id: string): Song | null {
    return this.songsById.get(id) ?? null;
  }

  terms(): SongSearchTerm[] {
    return [...this.searchTerms];
  }
}
