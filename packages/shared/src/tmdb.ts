import type { MediaType } from './media.js';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const TMDB_SITE_BASE = 'https://www.themoviedb.org';

export type PosterSize = 'w185' | 'w342' | 'w500';
export type BackdropSize = 'w780' | 'w1280';

export function tmdbPosterUrl(
  path: string | null | undefined,
  size: PosterSize = 'w342',
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
}

export function tmdbBackdropUrl(
  path: string | null | undefined,
  size: BackdropSize = 'w780',
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
}

export type StillSize = 'w300' | 'w780';

export function tmdbStillUrl(
  path: string | null | undefined,
  size: StillSize = 'w300',
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
}

export function tmdbTitleUrl(mediaType: MediaType, tmdbId: number): string {
  return `${TMDB_SITE_BASE}/${mediaType}/${tmdbId}`;
}

/** TMDB attribution text required by its API terms of use. */
export const TMDB_ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';
