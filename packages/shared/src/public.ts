import { z } from 'zod';
import { IsoTimestampSchema, MediaTypeFilterSchema, MediaTypeSchema } from './media.js';
import { RatingSchema } from './rating.js';

export const PUBLIC_RECENT_DEFAULT = 10;
export const PUBLIC_RECENT_MAX = 50;

export const PublicRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PUBLIC_RECENT_MAX).default(PUBLIC_RECENT_DEFAULT),
  /** `movie` or `tv` for separate "latest movies" and "latest shows" lists; `all` mixes them. */
  type: MediaTypeFilterSchema.default('all'),
});
export type PublicRecentQuery = z.infer<typeof PublicRecentQuerySchema>;

/** Public contract, v1: fields are only ever added, never renamed or removed. */
export const PublicRecentItemSchema = z.object({
  mediaType: MediaTypeSchema,
  title: z.string(),
  year: z.number().int().nullable(),
  posterUrl: z.url().nullable(),
  rating: RatingSchema.nullable(),
  watchedOn: z.string(),
  season: z.number().int().nullable(),
  /** Set when the most recent event was an episode watch (TV only). */
  episode: z.number().int().nullable(),
  tmdbUrl: z.url(),
});
export type PublicRecentItem = z.infer<typeof PublicRecentItemSchema>;

export const PublicRecentResponseSchema = z.object({
  items: z.array(PublicRecentItemSchema),
  generatedAt: IsoTimestampSchema,
});
export type PublicRecentResponse = z.infer<typeof PublicRecentResponseSchema>;
