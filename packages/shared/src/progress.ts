import type { Season } from './media.js';
import type { EpisodeWatch } from './watch.js';

export interface SeasonProgress {
  seasonNumber: number;
  watched: number;
  total: number;
}

export interface EpisodePointer {
  seasonNumber: number;
  episodeNumber: number;
}

export interface SeriesProgress {
  /** Watched and total over regular seasons only (specials are markable but not counted). */
  watched: number;
  total: number;
  complete: boolean;
  perSeason: SeasonProgress[];
  /** First unwatched episode after the latest watched one; null when complete or when there are no episodes. */
  nextUp: EpisodePointer | null;
  /** Latest watched regular episode in season-episode order, if any. */
  lastWatched: EpisodePointer | null;
}

export const episodeKey = (seasonNumber: number, episodeNumber: number): string =>
  `${seasonNumber}:${episodeNumber}`;

const compare = (a: EpisodePointer, b: EpisodePointer): number =>
  a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;

/**
 * Derives progress from TMDB's season list and the owner's episode watches.
 * "Next up" is the first unwatched episode strictly after the latest watched one, so gaps left
 * behind (skipped episodes) do not drag the pointer backwards.
 */
export function computeProgress(seasons: Season[], watches: EpisodeWatch[]): SeriesProgress {
  const regular = seasons
    .filter((s) => !s.isSpecials && s.seasonNumber > 0)
    .slice()
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const watchedSet = new Set(watches.map((w) => episodeKey(w.seasonNumber, w.episodeNumber)));

  const perSeason: SeasonProgress[] = regular.map((s) => {
    let watched = 0;
    for (let e = 1; e <= s.episodeCount; e++)
      if (watchedSet.has(episodeKey(s.seasonNumber, e))) watched++;
    return { seasonNumber: s.seasonNumber, watched, total: s.episodeCount };
  });

  const total = perSeason.reduce((n, s) => n + s.total, 0);
  const watched = perSeason.reduce((n, s) => n + s.watched, 0);

  const regularWatches = watches
    .filter((w) => w.seasonNumber > 0 && regular.some((s) => s.seasonNumber === w.seasonNumber))
    .sort(compare);
  const lastWatched =
    regularWatches.length > 0
      ? (regularWatches[regularWatches.length - 1] as EpisodePointer)
      : null;

  let nextUp: EpisodePointer | null = null;
  if (total > 0) {
    outer: for (const s of regular) {
      for (let e = 1; e <= s.episodeCount; e++) {
        const candidate = { seasonNumber: s.seasonNumber, episodeNumber: e };
        if (lastWatched && compare(candidate, lastWatched) <= 0) continue;
        if (!watchedSet.has(episodeKey(s.seasonNumber, e))) {
          nextUp = candidate;
          break outer;
        }
      }
    }
  }

  return {
    watched,
    total,
    complete: total > 0 && watched >= total,
    perSeason,
    nextUp,
    lastWatched: lastWatched
      ? { seasonNumber: lastWatched.seasonNumber, episodeNumber: lastWatched.episodeNumber }
      : null,
  };
}

export function formatEpisode(p: EpisodePointer): string {
  return `S${p.seasonNumber} E${p.episodeNumber}`;
}
