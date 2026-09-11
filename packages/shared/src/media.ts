import { z } from 'zod';

export const MediaTypeSchema = z.enum(['movie', 'tv']);
export type MediaType = z.infer<typeof MediaTypeSchema>;

/** Media type filter accepted by list and search endpoints. */
export const MediaTypeFilterSchema = z.enum(['all', 'movie', 'tv']);
export type MediaTypeFilter = z.infer<typeof MediaTypeFilterSchema>;

export const GenreSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export type Genre = z.infer<typeof GenreSchema>;

/** TMDB community rating: average out of 10 (null when nobody has voted) and the number of votes. */
export const TmdbRatingSchema = z.object({
  average: z.number().min(0).max(10).nullable(),
  count: z.number().int().min(0),
});
export type TmdbRating = z.infer<typeof TmdbRatingSchema>;

export function toTmdbRating(
  average: number | null | undefined,
  count: number | null | undefined,
): TmdbRating {
  const votes = count ?? 0;
  return {
    average: votes > 0 && average != null ? Math.round(average * 10) / 10 : null,
    count: votes,
  };
}

export const SeasonSchema = z.object({
  seasonNumber: z.number().int().min(0),
  name: z.string(),
  episodeCount: z.number().int().min(0),
  airDate: z.string().nullable(),
  /** TMDB season 0 holds specials; flagged so the UI can label it. */
  isSpecials: z.boolean(),
});
export type Season = z.infer<typeof SeasonSchema>;

export const IsoTimestampSchema = z.iso.datetime({ offset: false });

/** Snapshot of a title's metadata as stored in the library. */
export const MediaItemSchema = z.object({
  id: z.string(),
  mediaType: MediaTypeSchema,
  tmdbId: z.number().int().positive(),
  title: z.string(),
  originalTitle: z.string(),
  releaseYear: z.number().int().nullable(),
  releaseDate: z.string().nullable(),
  posterUrl: z.url().nullable(),
  backdropUrl: z.url().nullable(),
  overview: z.string(),
  genres: z.array(GenreSchema),
  runtimeMinutes: z.number().int().nullable(),
  numberOfSeasons: z.number().int().nullable(),
  tmdbRating: TmdbRatingSchema,
  tmdbUrl: z.url(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type MediaItem = z.infer<typeof MediaItemSchema>;

/** Library membership fields attached to search results and title details. */
export const LibraryMembershipSchema = z.object({
  inLibrary: z.boolean(),
  libraryItemId: z.string().nullable(),
});
export type LibraryMembership = z.infer<typeof LibraryMembershipSchema>;

/** Full details of a title fetched from the metadata provider, for preview before logging. */
export const TitleDetailsSchema = z
  .object({
    mediaType: MediaTypeSchema,
    tmdbId: z.number().int().positive(),
    title: z.string(),
    originalTitle: z.string(),
    releaseYear: z.number().int().nullable(),
    releaseDate: z.string().nullable(),
    overview: z.string(),
    posterUrl: z.url().nullable(),
    backdropUrl: z.url().nullable(),
    genres: z.array(GenreSchema),
    runtimeMinutes: z.number().int().nullable(),
    numberOfSeasons: z.number().int().nullable(),
    /** Present for TV series only, ascending by season number. */
    seasons: z.array(SeasonSchema).nullable(),
    tmdbRating: TmdbRatingSchema,
    tmdbUrl: z.url(),
    /** Displayed rating when the title is already in the library. */
    rating: z.number().int().nullable(),
  })
  .extend(LibraryMembershipSchema.shape);
export type TitleDetails = z.infer<typeof TitleDetailsSchema>;
