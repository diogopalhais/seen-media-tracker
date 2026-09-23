import { z } from 'zod';
import {
  LibraryMembershipSchema,
  MediaTypeFilterSchema,
  MediaTypeSchema,
  TmdbRatingSchema,
} from './media.js';

export const SEARCH_QUERY_MAX = 200;
export const SEARCH_PAGE_SIZE = 20;

export const SearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Search query is required')
    .max(SEARCH_QUERY_MAX, `Search query must be at most ${SEARCH_QUERY_MAX} characters`),
  type: MediaTypeFilterSchema.default('all'),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchQueryInput = z.input<typeof SearchQuerySchema>;

export const SearchResultSchema = z
  .object({
    tmdbId: z.number().int().positive(),
    mediaType: MediaTypeSchema,
    title: z.string(),
    originalTitle: z.string(),
    releaseYear: z.number().int().nullable(),
    posterUrl: z.url().nullable(),
    overview: z.string(),
    /** Provider-specific rank signal, only comparable within one provider. */
    popularity: z.number(),
    /** Community rating out of 10 with vote count (TMDB), or IGDB's blended rating rescaled to 10. */
    tmdbRating: TmdbRatingSchema,
  })
  .extend(LibraryMembershipSchema.shape);
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  page: z.number().int().min(1),
  hasMore: z.boolean(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const TitleParamsSchema = z.object({
  mediaType: MediaTypeSchema,
  tmdbId: z.coerce.number().int().positive(),
});

/**
 * Browsing lists shown when no search is active. Each list holds at most 20 titles. The game lists
 * are empty when games are not configured.
 */
export const DiscoverResponseSchema = z.object({
  trending: z.array(SearchResultSchema),
  popularMovies: z.array(SearchResultSchema),
  popularTv: z.array(SearchResultSchema),
  /** Games people on IGDB are playing right now. */
  trendingGames: z.array(SearchResultSchema),
  /** Best rated games released in the last year, by the IGDB community and critics. */
  topGames: z.array(SearchResultSchema),
});
export type DiscoverResponse = z.infer<typeof DiscoverResponseSchema>;
