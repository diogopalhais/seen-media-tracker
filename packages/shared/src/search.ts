import { z } from 'zod';
import { LibraryMembershipSchema, MediaTypeFilterSchema, MediaTypeSchema } from './media.js';

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
    popularity: z.number(),
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
