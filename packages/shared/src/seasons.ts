import { z } from 'zod';
import { TmdbRatingSchema } from './media.js';

export const EpisodeSchema = z.object({
  episodeNumber: z.number().int().min(0),
  name: z.string(),
  overview: z.string(),
  airDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  stillUrl: z.url().nullable(),
  tmdbRating: TmdbRatingSchema,
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const SeasonDetailsSchema = z.object({
  tmdbId: z.number().int().positive(),
  seasonNumber: z.number().int().min(0),
  name: z.string(),
  overview: z.string(),
  airDate: z.string().nullable(),
  posterUrl: z.url().nullable(),
  episodeCount: z.number().int().min(0),
  episodes: z.array(EpisodeSchema),
});
export type SeasonDetails = z.infer<typeof SeasonDetailsSchema>;

export const SeasonParamsSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  seasonNumber: z.coerce.number().int().min(0),
});
