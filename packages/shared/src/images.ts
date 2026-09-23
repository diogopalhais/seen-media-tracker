import type { MediaType } from './media.js';
import { tmdbBackdropUrl, tmdbPosterUrl, tmdbTitleUrl } from './tmdb.js';

export const IGDB_IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';
export const IGDB_SITE_BASE = 'https://www.igdb.com';

/** IGDB image sizes used here: covers are 264×374 (t_cover_big), screenshots 889×500 (t_screenshot_big). */
export type IgdbImageSize = 't_cover_big' | 't_cover_big_2x' | 't_screenshot_big' | 't_1080p';

export function igdbImageUrl(
  imageId: string | null | undefined,
  size: IgdbImageSize,
): string | null {
  if (!imageId) return null;
  return `${IGDB_IMAGE_BASE}/${size}/${imageId}.jpg`;
}

/**
 * Poster (or game cover) URL from the stored provider path. TMDB paths start with "/", IGDB stores
 * a bare image id.
 */
export function mediaPosterUrl(
  mediaType: MediaType,
  path: string | null | undefined,
): string | null {
  return mediaType === 'game' ? igdbImageUrl(path, 't_cover_big_2x') : tmdbPosterUrl(path);
}

export function mediaBackdropUrl(
  mediaType: MediaType,
  path: string | null | undefined,
): string | null {
  return mediaType === 'game' ? igdbImageUrl(path, 't_1080p') : tmdbBackdropUrl(path);
}

/**
 * The title's page at its provider. IGDB pages are addressed by slug, so games carry the URL the
 * provider reported; without one the IGDB search page is the best available link.
 */
export function mediaTitleUrl(
  mediaType: MediaType,
  providerId: number,
  externalUrl: string | null | undefined,
): string {
  if (mediaType !== 'game') return tmdbTitleUrl(mediaType, providerId);
  return externalUrl ?? `${IGDB_SITE_BASE}/search?q=${providerId}`;
}
