import { z } from 'zod';
import { DateStringSchema } from './dates.js';
import { RatingSchema } from './rating.js';

const base = {
  title: z.string().max(500),
  year: z.number().int().nullable(),
  tmdbId: z.number().int().positive(),
};

/** Normalised Trakt records, produced in the browser from the export and consumed by the import endpoint. */
export const TraktImportRecordSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('movie_play'), ...base, watchedOn: DateStringSchema }),
  z.object({
    kind: z.literal('episode_play'),
    ...base,
    seasonNumber: z.number().int().min(0),
    episodeNumber: z.number().int().min(0),
    watchedOn: DateStringSchema,
  }),
  z.object({
    kind: z.literal('movie_rating'),
    ...base,
    rating: RatingSchema,
    ratedOn: DateStringSchema,
  }),
  z.object({
    kind: z.literal('show_rating'),
    ...base,
    rating: RatingSchema,
    ratedOn: DateStringSchema,
  }),
  z.object({
    kind: z.literal('season_rating'),
    ...base,
    seasonNumber: z.number().int().min(0),
    rating: RatingSchema,
    ratedOn: DateStringSchema,
  }),
]);
export type TraktImportRecord = z.infer<typeof TraktImportRecordSchema>;

export const TRAKT_IMPORT_BATCH_MAX = 200;

export const TraktImportRequestSchema = z.object({
  records: z.array(TraktImportRecordSchema).min(1).max(TRAKT_IMPORT_BATCH_MAX),
});
export type TraktImportRequest = z.infer<typeof TraktImportRequestSchema>;

export const TraktImportResultSchema = z.object({
  created: z.object({
    items: z.number().int().min(0),
    entries: z.number().int().min(0),
    episodeWatches: z.number().int().min(0),
    ratings: z.number().int().min(0),
  }),
  duplicates: z.number().int().min(0),
  failures: z.array(z.object({ title: z.string(), reason: z.string() })),
});
export type TraktImportResult = z.infer<typeof TraktImportResultSchema>;

export function emptyImportResult(): TraktImportResult {
  return {
    created: { items: 0, entries: 0, episodeWatches: 0, ratings: 0 },
    duplicates: 0,
    failures: [],
  };
}

export function mergeImportResults(a: TraktImportResult, b: TraktImportResult): TraktImportResult {
  return {
    created: {
      items: a.created.items + b.created.items,
      entries: a.created.entries + b.created.entries,
      episodeWatches: a.created.episodeWatches + b.created.episodeWatches,
      ratings: a.created.ratings + b.created.ratings,
    },
    duplicates: a.duplicates + b.duplicates,
    failures: [...a.failures, ...b.failures],
  };
}
