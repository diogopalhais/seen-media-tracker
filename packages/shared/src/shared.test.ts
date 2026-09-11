import { describe, expect, it } from 'vitest';
import {
  DateStringSchema,
  formatRating,
  isValidDateString,
  LogWatchRequestSchema,
  latestTodayOnEarth,
  NullableRatingSchema,
  PastOrTodayDateSchema,
  RatingSchema,
  tmdbBackdropUrl,
  tmdbPosterUrl,
  tmdbTitleUrl,
  todayLocalDateString,
} from './index.js';

describe('RatingSchema', () => {
  it.each([1, 5, 10])('accepts %d', (v) => {
    expect(RatingSchema.safeParse(v).success).toBe(true);
  });
  it.each([0, 11, 7.5, -1, Number.NaN])('rejects %s', (v) => {
    expect(RatingSchema.safeParse(v).success).toBe(false);
  });
  it('rejects strings and null on the non-nullable schema', () => {
    expect(RatingSchema.safeParse('8').success).toBe(false);
    expect(RatingSchema.safeParse(null).success).toBe(false);
  });
  it('accepts null on the nullable schema', () => {
    expect(NullableRatingSchema.safeParse(null).success).toBe(true);
  });
  it('formats as N/10', () => {
    expect(formatRating(8)).toBe('8/10');
    expect(formatRating(null)).toBe('—');
  });
});

describe('dates', () => {
  it('validates real calendar dates', () => {
    expect(isValidDateString('2026-09-10')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2023-02-29')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-9-1')).toBe(false);
    expect(isValidDateString('10/09/2026')).toBe(false);
    expect(DateStringSchema.safeParse('2026-04-31').success).toBe(false);
  });
  it('rejects dates after today anywhere on Earth', () => {
    const today = latestTodayOnEarth();
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(PastOrTodayDateSchema.safeParse(today).success).toBe(true);
    expect(PastOrTodayDateSchema.safeParse('2000-01-01').success).toBe(true);
    expect(PastOrTodayDateSchema.safeParse(future).success).toBe(false);
  });
  it('computes UTC+14 today', () => {
    expect(latestTodayOnEarth(new Date('2026-09-10T11:00:00Z'))).toBe('2026-09-11');
    expect(latestTodayOnEarth(new Date('2026-09-10T09:59:00Z'))).toBe('2026-09-10');
  });
  it('formats local today', () => {
    expect(todayLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('LogWatchRequestSchema', () => {
  const base = { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-09-10' } as const;
  it('accepts a movie watch with rating', () => {
    expect(LogWatchRequestSchema.safeParse({ ...base, rating: 9 }).success).toBe(true);
  });
  it('rejects a season on a movie with the season path', () => {
    const r = LogWatchRequestSchema.safeParse({ ...base, season: 1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['season']);
  });
  it('accepts a season on a tv show', () => {
    expect(LogWatchRequestSchema.safeParse({ ...base, mediaType: 'tv', season: 2 }).success).toBe(
      true,
    );
  });
  it('rejects non-integer rating with the rating path', () => {
    const r = LogWatchRequestSchema.safeParse({ ...base, rating: 7.5 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['rating']);
  });
  it('strips unknown fields', () => {
    const r = LogWatchRequestSchema.safeParse({ ...base, bogus: true });
    expect(r.success).toBe(true);
    if (r.success) expect('bogus' in r.data).toBe(false);
  });
});

describe('tmdb urls', () => {
  it('builds poster and backdrop urls', () => {
    expect(tmdbPosterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(tmdbPosterUrl('abc.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/abc.jpg');
    expect(tmdbBackdropUrl('/b.jpg')).toBe('https://image.tmdb.org/t/p/w780/b.jpg');
    expect(tmdbPosterUrl(null)).toBeNull();
    expect(tmdbBackdropUrl(undefined)).toBeNull();
  });
  it('builds title urls', () => {
    expect(tmdbTitleUrl('movie', 550)).toBe('https://www.themoviedb.org/movie/550');
    expect(tmdbTitleUrl('tv', 1396)).toBe('https://www.themoviedb.org/tv/1396');
  });
});
