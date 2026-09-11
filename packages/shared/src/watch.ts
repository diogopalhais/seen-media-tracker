import { z } from 'zod';
import { PastOrTodayDateSchema } from './dates.js';
import { IsoTimestampSchema, MediaItemSchema, MediaTypeSchema } from './media.js';
import { RatingSchema } from './rating.js';

export const NOTE_MAX_LENGTH = 2000;

export const SeasonNumberSchema = z.number().int().min(0);
export const NoteSchema = z
  .string()
  .max(NOTE_MAX_LENGTH, `Note must be at most ${NOTE_MAX_LENGTH} characters`);

export const WatchEntrySchema = z.object({
  id: z.string(),
  mediaItemId: z.string(),
  watchedOn: z.string(),
  rating: RatingSchema.nullable(),
  season: SeasonNumberSchema.nullable(),
  note: NoteSchema.nullable(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type WatchEntry = z.infer<typeof WatchEntrySchema>;

export const LogWatchRequestSchema = z
  .object({
    mediaType: MediaTypeSchema,
    tmdbId: z.number().int().positive(),
    watchedOn: PastOrTodayDateSchema,
    rating: RatingSchema.nullable().optional(),
    season: SeasonNumberSchema.nullable().optional(),
    note: NoteSchema.nullable().optional(),
  })
  .refine((v) => v.mediaType === 'tv' || v.season == null, {
    path: ['season'],
    message: 'Season can only be set for TV series',
  });
export type LogWatchRequest = z.infer<typeof LogWatchRequestSchema>;

/** Partial update; `null` clears rating, season or note. Season validity against the item's type is checked server-side. */
export const UpdateWatchRequestSchema = z
  .object({
    watchedOn: PastOrTodayDateSchema.optional(),
    rating: RatingSchema.nullable().optional(),
    season: SeasonNumberSchema.nullable().optional(),
    note: NoteSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdateWatchRequest = z.infer<typeof UpdateWatchRequestSchema>;

export const WatchMutationResponseSchema = z.object({
  entry: WatchEntrySchema,
  item: MediaItemSchema,
});
export type WatchMutationResponse = z.infer<typeof WatchMutationResponseSchema>;
