import {
  emptyImportResult,
  type MediaType,
  type TraktImportRecord,
  TraktImportRequestSchema,
  type TraktImportResult,
} from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import type { MediaItemRow } from '../db/schema.js';
import type { LibraryRepository } from '../services/library.js';
import { detailsFor, type MetadataProvider, ProviderError } from '../services/metadata/provider.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';
import { mapProviderError } from './search.js';

export interface ImportDeps {
  provider: MetadataProvider;
  library: LibraryRepository;
  requireAuth: MiddlewareHandler<AppEnv>;
  now: () => Date;
}

const mediaTypeOf = (r: TraktImportRecord): MediaType =>
  r.kind === 'movie_play' || r.kind === 'movie_rating' ? 'movie' : 'tv';

/**
 * Imports normalised Trakt records. Idempotent by natural keys: entries dedupe on (item, date, season),
 * episode watches on the unique index, and ratings only fill entries that have none.
 */
export function importRoutes(deps: ImportDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post(
    '/import/trakt',
    deps.requireAuth,
    validate('json', TraktImportRequestSchema),
    async (c) => {
      const { records } = c.req.valid('json');
      const now = deps.now();
      const result: TraktImportResult = emptyImportResult();

      // Group by title so each TMDB lookup and item upsert happens once per batch.
      const groups = new Map<
        string,
        { mediaType: MediaType; tmdbId: number; title: string; records: TraktImportRecord[] }
      >();
      for (const r of records) {
        const mediaType = mediaTypeOf(r);
        const key = `${mediaType}:${r.tmdbId}`;
        const g = groups.get(key) ?? { mediaType, tmdbId: r.tmdbId, title: r.title, records: [] };
        g.records.push(r);
        groups.set(key, g);
      }

      for (const g of groups.values()) {
        let item: MediaItemRow | null = await deps.library.findItemByTmdb(g.mediaType, g.tmdbId);
        if (!item) {
          try {
            const details = await detailsFor(deps.provider, g.mediaType, g.tmdbId);
            item = await deps.library.upsertItem(details, now);
            result.created.items++;
          } catch (err) {
            if (err instanceof ProviderError && err.kind === 'not_found') {
              result.failures.push({ title: g.title, reason: `TMDB id ${g.tmdbId} not found` });
              continue;
            }
            mapProviderError(err);
          }
        }
        // Oldest first so "latest entry" logic sees history in order.
        const ordered = g.records.slice().sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
        for (const r of ordered) {
          switch (r.kind) {
            case 'movie_play': {
              if (await deps.library.findEntryOn(item.id, r.watchedOn, null)) result.duplicates++;
              else {
                await deps.library.insertEntry(
                  item.id,
                  { watchedOn: r.watchedOn, rating: null, season: null, note: null },
                  now,
                );
                result.created.entries++;
              }
              break;
            }
            case 'episode_play': {
              const inserted = await deps.library.insertEpisodeWatchIfMissing(
                item.id,
                r.seasonNumber,
                r.episodeNumber,
                r.watchedOn,
                now,
              );
              if (inserted) result.created.episodeWatches++;
              else result.duplicates++;
              break;
            }
            case 'movie_rating':
            case 'show_rating':
            case 'season_rating': {
              const season = r.kind === 'season_rating' ? r.seasonNumber : null;
              const target = await deps.library.latestEntry(
                item.id,
                r.kind === 'movie_rating' ? 'any' : season,
              );
              if (!target) {
                await deps.library.insertEntry(
                  item.id,
                  { watchedOn: r.ratedOn, rating: r.rating, season, note: null },
                  now,
                );
                result.created.entries++;
                result.created.ratings++;
              } else if (target.rating === null) {
                await deps.library.updateEntry(target.id, { rating: r.rating }, now);
                result.created.ratings++;
              } else {
                result.duplicates++;
              }
              break;
            }
          }
        }
      }

      return c.json(result, 200);
    },
  );

  return router;
}

function dateOf(r: TraktImportRecord): string {
  return r.kind === 'movie_play' || r.kind === 'episode_play' ? r.watchedOn : r.ratedOn;
}
