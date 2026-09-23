import { z } from 'zod';
import {
  AiredEpisodeSchema,
  MediaItemSchema,
  MediaTypeFilterSchema,
  MediaTypeSchema,
  TmdbRatingSchema,
} from './media.js';
import { RatingSchema } from './rating.js';
import { PlaySessionSchema, SteamLinkSchema } from './steam.js';
import { EpisodeWatchSchema, WatchEntrySchema } from './watch.js';

export const EpisodePointerSchema = z.object({
  seasonNumber: z.number().int().min(0),
  episodeNumber: z.number().int().min(0),
});

export const SeriesStatusSchema = z.enum(['unwatched', 'behind', 'up_to_date', 'watched']);

/**
 * Where the owner stands with a series, computed by the API from the stored season list, the
 * episode ticks and the logs. `behind` is only meaningful when `exact` is true.
 */
export const LibraryProgressSchema = z.object({
  status: SeriesStatusSchema,
  aired: z.number().int().min(0),
  total: z.number().int().min(0),
  behind: z.number().int().min(0),
  exact: z.boolean(),
  nextUp: EpisodePointerSchema.nullable(),
});
export type LibraryProgress = z.infer<typeof LibraryProgressSchema>;

export const LibrarySortSchema = z.enum(['recent', 'title', 'rating']);
export type LibrarySort = z.infer<typeof LibrarySortSchema>;

export const LIBRARY_PAGE_DEFAULT = 30;
export const LIBRARY_PAGE_MAX = 100;

export const LibraryListQuerySchema = z.object({
  type: MediaTypeFilterSchema.default('all'),
  sort: LibrarySortSchema.default('recent'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(LIBRARY_PAGE_MAX).default(LIBRARY_PAGE_DEFAULT),
});
export type LibraryListQuery = z.infer<typeof LibraryListQuerySchema>;
export type LibraryListQueryInput = z.input<typeof LibraryListQuerySchema>;

export const RELEASE_NEW_WINDOW_DAYS = 30;
export const RELEASE_UPCOMING_WINDOW_DAYS = 14;
export const RELEASES_LIMIT = 20;

/**
 * Why a series deserves attention: an episode aired recently that the owner has not watched, or one
 * is about to air. Computed by the API from the snapshot and the watch tables.
 */
export const ReleaseAlertSchema = z.object({
  kind: z.enum(['new_episode', 'upcoming']),
  episode: AiredEpisodeSchema,
});
export type ReleaseAlert = z.infer<typeof ReleaseAlertSchema>;

export const LibraryItemSummarySchema = z.object({
  id: z.string(),
  mediaType: MediaTypeSchema,
  tmdbId: z.number().int(),
  title: z.string(),
  releaseYear: z.number().int().nullable(),
  posterUrl: z.url().nullable(),
  rating: RatingSchema.nullable(),
  tmdbRating: TmdbRatingSchema,
  lastWatchedOn: z.string(),
  /** Number of season/series logs; 0 when the title is tracked only by episodes. */
  watchCount: z.number().int().min(0),
  episodesWatched: z.number().int().min(0),
  /** Games: minutes recorded from connected accounts; 0 otherwise. */
  minutesPlayed: z.number().int().min(0),
  lastSeason: z.number().int().nullable(),
  /** Null for movies, for muted series and for series with nothing new or upcoming. */
  release: ReleaseAlertSchema.nullable(),
  /** Series only; null for movies and when the snapshot has no season list yet. */
  progress: LibraryProgressSchema.nullable(),
  /** True when the owner stopped following the series: no alerts, no notifications. */
  muted: z.boolean(),
});
export type LibraryItemSummary = z.infer<typeof LibraryItemSummarySchema>;

export const LibraryListResponseSchema = z.object({
  items: z.array(LibraryItemSummarySchema),
  nextCursor: z.string().nullable(),
});
export type LibraryListResponse = z.infer<typeof LibraryListResponseSchema>;

/** Series with a release alert: new episodes first (newest aired first), then upcoming (soonest first). */
export const LibraryReleasesResponseSchema = z.object({
  items: z.array(LibraryItemSummarySchema),
});
export type LibraryReleasesResponse = z.infer<typeof LibraryReleasesResponseSchema>;

export const LibraryItemDetailSchema = z.object({
  item: MediaItemSchema,
  rating: RatingSchema.nullable(),
  watchCount: z.number().int().min(0),
  entries: z.array(WatchEntrySchema),
  /** Season-episode ordered. */
  episodeWatches: z.array(EpisodeWatchSchema),
  /** Games: play time recorded from connected accounts, newest first. */
  plays: z.array(PlaySessionSchema),
  /** Games: the owner's Steam record for this title, when linked. */
  steam: SteamLinkSchema.nullable(),
  muted: z.boolean(),
});
export type LibraryItemDetail = z.infer<typeof LibraryItemDetailSchema>;

/** Owner settings on a library item. */
export const UpdateLibraryItemRequestSchema = z.object({
  muted: z.boolean(),
});
export type UpdateLibraryItemRequest = z.infer<typeof UpdateLibraryItemRequestSchema>;
