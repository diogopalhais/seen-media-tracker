import { z } from 'zod';

export const RATING_MIN = 1;
export const RATING_MAX = 10;

/** Whole-number rating from 1 to 10. */
export const RatingSchema = z
  .number()
  .int('Rating must be a whole number')
  .min(RATING_MIN, `Rating must be between ${RATING_MIN} and ${RATING_MAX}`)
  .max(RATING_MAX, `Rating must be between ${RATING_MIN} and ${RATING_MAX}`);
export type Rating = z.infer<typeof RatingSchema>;

export const NullableRatingSchema = RatingSchema.nullable();

export function isValidRating(value: unknown): value is Rating {
  return RatingSchema.safeParse(value).success;
}

/** Renders a rating for display, e.g. `8/10`. */
export function formatRating(rating: number | null | undefined): string {
  return rating == null ? '—' : `${rating}/${RATING_MAX}`;
}
