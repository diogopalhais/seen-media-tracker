import type { Season } from './media.js';
import type { EpisodeWatch } from './watch.js';

export interface SeasonProgress {
  seasonNumber: number;
  /** Watched episodes of the season, whether aired or not. */
  watched: number;
  /** Watched episodes among the aired ones. */
  watchedAired: number;
  /** Episodes aired so far. Equals `total` once the season has fully aired. */
  aired: number;
  total: number;
}

export interface EpisodePointer {
  seasonNumber: number;
  episodeNumber: number;
}

export interface AiredEpisodeRef extends EpisodePointer {
  airDate: string | null;
}

/** A season or whole-series log; `season` null means the whole series. */
export interface SeriesLog {
  season: number | null;
  watchedOn: string;
}

export interface ProgressOptions {
  /**
   * The provider's last episode to air. Every regular episode up to and including it counts as
   * aired; later ones do not. Omit (or pass null) when unknown: every listed episode then counts.
   */
  lastAired?: AiredEpisodeRef | null;
  /**
   * Season and whole-series logs, folded into the watched set. A season log covers the aired
   * episodes of that season; a whole-series log covers everything that had aired by its date.
   */
  logs?: SeriesLog[];
  /**
   * Air dates of the episodes in the last aired season. Lets a whole-series log dated inside that
   * season be placed exactly; without them the season counts as unwatched and `exact` is false.
   */
  currentSeasonEpisodes?: { episodeNumber: number; airDate: string | null }[];
  /** Whether the provider says the series is still running. A running series is "up to date", never "watched". */
  ongoing?: boolean;
}

/**
 * Where the owner stands with a series:
 * - `unwatched`: nothing logged or ticked
 * - `behind`: at least one aired episode is unwatched
 * - `up_to_date`: every aired episode is watched and more are still to come (or the series is running)
 * - `watched`: every episode is watched and nothing more is expected
 */
export type SeriesStatus = 'unwatched' | 'behind' | 'up_to_date' | 'watched';

export interface SeriesProgress {
  /** Watched and total over regular seasons only (specials are markable but not counted). */
  watched: number;
  total: number;
  /** Regular episodes aired so far. */
  aired: number;
  /** Watched episodes among the aired ones. */
  watchedAired: number;
  /** Aired episodes not yet watched. */
  behind: number;
  /** Episodes listed by the provider but not aired yet. */
  remaining: number;
  status: SeriesStatus;
  /** Shorthand for `status === 'watched'`. */
  complete: boolean;
  /**
   * False when a whole-series log falls inside the running season and its episode air dates were
   * not supplied: `behind` then overstates by the episodes seen before the log.
   */
  exact: boolean;
  perSeason: SeasonProgress[];
  /** First unwatched aired episode after the latest watched one; null when up to date or nothing has aired. */
  nextUp: EpisodePointer | null;
  /** Latest watched regular episode in season-episode order, if any. */
  lastWatched: EpisodePointer | null;
}

export const episodeKey = (seasonNumber: number, episodeNumber: number): string =>
  `${seasonNumber}:${episodeNumber}`;

const compare = (a: EpisodePointer, b: EpisodePointer): number =>
  a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;

/**
 * Derives progress from TMDB's season list, the owner's episode watches and, optionally, their
 * season and series logs and the provider's last aired episode.
 * "Next up" is the first unwatched aired episode strictly after the latest watched one, so gaps
 * left behind (skipped episodes) do not drag the pointer backwards.
 */
export function computeProgress(
  seasons: Season[],
  watches: EpisodeWatch[],
  options: ProgressOptions = {},
): SeriesProgress {
  const regular = seasons
    .filter((s) => !s.isSpecials && s.seasonNumber > 0)
    .slice()
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  // A last aired episode in specials says nothing about the regular seasons; treat it as unknown.
  const lastAired =
    options.lastAired && options.lastAired.seasonNumber > 0 ? options.lastAired : null;

  const airedIn = (s: Season): number => {
    if (!lastAired) return s.episodeCount;
    if (s.seasonNumber < lastAired.seasonNumber) return s.episodeCount;
    if (s.seasonNumber === lastAired.seasonNumber)
      return Math.min(s.episodeCount, lastAired.episodeNumber);
    return 0;
  };

  const watchedSet = new Set<string>();
  for (const w of watches) watchedSet.add(episodeKey(w.seasonNumber, w.episodeNumber));
  const markRange = (seasonNumber: number, upTo: number) => {
    for (let e = 1; e <= upTo; e++) watchedSet.add(episodeKey(seasonNumber, e));
  };

  let exact = true;
  for (const log of options.logs ?? []) {
    if (log.season !== null) {
      const season = regular.find((s) => s.seasonNumber === log.season);
      if (season) markRange(season.seasonNumber, airedIn(season));
      continue;
    }
    const coversAll = !lastAired?.airDate || log.watchedOn >= lastAired.airDate;
    for (const s of regular) {
      const aired = airedIn(s);
      if (coversAll) {
        markRange(s.seasonNumber, aired);
      } else if (lastAired && s.seasonNumber < lastAired.seasonNumber) {
        // A season that had premiered by the log date is taken as finished by then.
        if (!s.airDate || s.airDate <= log.watchedOn) markRange(s.seasonNumber, aired);
      } else if (lastAired && s.seasonNumber === lastAired.seasonNumber) {
        if (s.airDate && s.airDate > log.watchedOn) continue;
        if (options.currentSeasonEpisodes) {
          for (const e of options.currentSeasonEpisodes)
            if (
              e.episodeNumber >= 1 &&
              e.episodeNumber <= aired &&
              e.airDate &&
              e.airDate <= log.watchedOn
            )
              watchedSet.add(episodeKey(s.seasonNumber, e.episodeNumber));
        } else {
          exact = false;
        }
      }
    }
  }

  const perSeason: SeasonProgress[] = regular.map((s) => {
    const aired = airedIn(s);
    let watched = 0;
    let watchedAired = 0;
    for (let e = 1; e <= s.episodeCount; e++) {
      if (!watchedSet.has(episodeKey(s.seasonNumber, e))) continue;
      watched++;
      if (e <= aired) watchedAired++;
    }
    return { seasonNumber: s.seasonNumber, watched, watchedAired, aired, total: s.episodeCount };
  });

  const total = perSeason.reduce((n, s) => n + s.total, 0);
  const watched = perSeason.reduce((n, s) => n + s.watched, 0);
  const aired = perSeason.reduce((n, s) => n + s.aired, 0);
  const watchedAired = perSeason.reduce((n, s) => n + s.watchedAired, 0);
  const behind = aired - watchedAired;
  const remaining = total - aired;

  let lastWatched: EpisodePointer | null = null;
  for (const s of regular) {
    for (let e = s.episodeCount; e >= 1; e--) {
      if (watchedSet.has(episodeKey(s.seasonNumber, e))) {
        const candidate = { seasonNumber: s.seasonNumber, episodeNumber: e };
        if (!lastWatched || compare(candidate, lastWatched) > 0) lastWatched = candidate;
        break;
      }
    }
  }

  let nextUp: EpisodePointer | null = null;
  outer: for (const s of regular) {
    const upTo = airedIn(s);
    for (let e = 1; e <= upTo; e++) {
      const candidate = { seasonNumber: s.seasonNumber, episodeNumber: e };
      if (lastWatched && compare(candidate, lastWatched) <= 0) continue;
      if (!watchedSet.has(episodeKey(s.seasonNumber, e))) {
        nextUp = candidate;
        break outer;
      }
    }
  }

  const anything = watched > 0 || (options.logs?.length ?? 0) > 0;
  let status: SeriesStatus;
  if (!anything) status = 'unwatched';
  else if (behind > 0) status = 'behind';
  else if (remaining > 0 || options.ongoing || total === 0) status = 'up_to_date';
  else status = 'watched';

  return {
    watched,
    total,
    aired,
    watchedAired,
    behind,
    remaining,
    status,
    complete: status === 'watched',
    exact,
    perSeason,
    nextUp,
    lastWatched,
  };
}

/**
 * True when a whole-series log is dated inside the last aired season, so `computeProgress` needs
 * that season's episode air dates to be exact.
 */
export function needsCurrentSeasonEpisodes(
  seasons: Season[],
  logs: SeriesLog[],
  lastAired: AiredEpisodeRef | null | undefined,
): boolean {
  if (!lastAired?.airDate || lastAired.seasonNumber <= 0) return false;
  const season = seasons.find((s) => s.seasonNumber === lastAired.seasonNumber);
  if (!season) return false;
  return logs.some(
    (log) =>
      log.season === null &&
      log.watchedOn < (lastAired.airDate as string) &&
      (!season.airDate || season.airDate <= log.watchedOn),
  );
}

export function formatEpisode(p: EpisodePointer): string {
  return `S${p.seasonNumber} E${p.episodeNumber}`;
}
