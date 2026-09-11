import { z } from 'zod';
import {
  MediaItemSchema,
  MediaTypeFilterSchema,
  MediaTypeSchema,
  TmdbRatingSchema,
} from './media.js';
import { RatingSchema } from './rating.js';
import { WatchEntrySchema } from './watch.js';

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
  watchCount: z.number().int().min(1),
  lastSeason: z.number().int().nullable(),
});
export type LibraryItemSummary = z.infer<typeof LibraryItemSummarySchema>;

export const LibraryListResponseSchema = z.object({
  items: z.array(LibraryItemSummarySchema),
  nextCursor: z.string().nullable(),
});
export type LibraryListResponse = z.infer<typeof LibraryListResponseSchema>;

export const LibraryItemDetailSchema = z.object({
  item: MediaItemSchema,
  rating: RatingSchema.nullable(),
  watchCount: z.number().int().min(0),
  entries: z.array(WatchEntrySchema),
});
export type LibraryItemDetail = z.infer<typeof LibraryItemDetailSchema>;
