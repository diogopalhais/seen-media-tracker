import {
  type AiredEpisode,
  computeProgress,
  isOngoingSeries,
  type LibraryItemDetail,
  needsCurrentSeasonEpisodes,
  type Season,
  type SeriesProgress,
} from '@seen/shared';
import { useSeasonQuery } from './queries.js';

export interface SeriesSource {
  tmdbId: number | undefined;
  /** TMDB seasons; null or undefined while unknown, which disables the computation. */
  seasons: Season[] | null | undefined;
  detail: LibraryItemDetail | undefined;
  status: string | null | undefined;
  lastEpisodeToAir: AiredEpisode | null | undefined;
  nextEpisodeToAir: AiredEpisode | null | undefined;
}

export interface SeriesStanding {
  progress: SeriesProgress;
  /** Next episode the provider expects, when the series is running. */
  nextToAir: AiredEpisode | null;
  /** True while the episode air dates needed for an exact count are still loading. */
  loading: boolean;
}

/**
 * The owner's standing with a series, from episode ticks, season and series logs, and the provider's
 * last aired episode. Fetches the running season's episodes only when a whole-series log falls inside
 * it, so the count of episodes seen before the log is exact.
 */
export function useSeriesStanding(src: SeriesSource): SeriesStanding | null {
  const seasons = src.seasons ?? [];
  const logs = src.detail?.entries ?? [];
  const lastAired = src.lastEpisodeToAir ?? null;
  const needsEpisodes = src.seasons != null && needsCurrentSeasonEpisodes(seasons, logs, lastAired);
  const currentSeason = useSeasonQuery(
    needsEpisodes ? src.tmdbId : undefined,
    needsEpisodes ? lastAired?.seasonNumber : undefined,
  );
  if (src.seasons == null) return null;
  const progress = computeProgress(seasons, src.detail?.episodeWatches ?? [], {
    lastAired,
    logs,
    // Unknown status reads as finished for display, so a fully watched series says "Watched".
    ongoing: src.status != null && isOngoingSeries(src.status),
    ...(needsEpisodes && currentSeason.data
      ? { currentSeasonEpisodes: currentSeason.data.episodes }
      : {}),
  });
  return {
    progress,
    nextToAir: src.nextEpisodeToAir ?? null,
    loading: needsEpisodes && currentSeason.isPending,
  };
}
