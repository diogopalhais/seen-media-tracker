import {
  type EpisodeWatchesResponse,
  isAired,
  LogWatchRequestSchema,
  latestTodayOnEarth,
  SetEpisodesWatchedRequestSchema,
  UpdateWatchRequestSchema,
  type WatchMutationResponse,
} from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { LibraryRepository } from '../services/library.js';
import { toMediaItem, toWatchEntry } from '../services/library.js';
import { detailsFor, type MetadataProvider, ProviderError } from '../services/metadata/provider.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';
import { mapProviderError } from './search.js';

export interface WatchDeps {
  provider: MetadataProvider;
  library: LibraryRepository;
  requireAuth: MiddlewareHandler<AppEnv>;
  now: () => Date;
}

const IdParam = z.object({ id: z.string().min(1) });
const isUuid = (v: string) => z.uuid().safeParse(v).success;

export function watchRoutes(deps: WatchDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/watches', deps.requireAuth, validate('json', LogWatchRequestSchema), async (c) => {
    const input = c.req.valid('json');
    const now = deps.now();

    let item = await deps.library.findItemByTmdb(input.mediaType, input.tmdbId);
    if (!item) {
      try {
        const details = await detailsFor(deps.provider, input.mediaType, input.tmdbId);
        item = await deps.library.upsertItem(details, now);
      } catch (err) {
        mapProviderError(err);
      }
    }

    const entry = await deps.library.insertEntry(
      item.id,
      {
        watchedOn: input.watchedOn,
        rating: input.rating ?? null,
        season: input.mediaType === 'tv' ? (input.season ?? null) : null,
        note: input.note ?? null,
      },
      now,
    );
    const body: WatchMutationResponse = { entry: toWatchEntry(entry), item: toMediaItem(item) };
    return c.json(body, 201);
  });

  router.put(
    '/watches/episodes',
    deps.requireAuth,
    validate('json', SetEpisodesWatchedRequestSchema),
    async (c) => {
      const input = c.req.valid('json');
      const now = deps.now();
      let item = await deps.library.findItemByTmdb('tv', input.tmdbId);
      if (!item) {
        if (!input.watched) throw ApiError.notFound('Series');
        try {
          const details = await deps.provider.tvDetails(input.tmdbId);
          item = await deps.library.upsertItem(details, now);
        } catch (err) {
          mapProviderError(err);
        }
      } else if (item.mediaType !== 'tv') {
        throw ApiError.validation([
          { path: 'tmdbId', message: 'Episodes can only be tracked for TV series' },
        ]);
      }
      if (input.watched) {
        // Only episodes that exist and have aired can be marked; verified against the (cached) season data.
        const today = latestTodayOnEarth(now);
        const bySeason = new Map<number, number[]>();
        for (const e of input.episodes) {
          bySeason.set(e.seasonNumber, [...(bySeason.get(e.seasonNumber) ?? []), e.episodeNumber]);
        }
        const problems: { path: string; message: string }[] = [];
        for (const [seasonNumber, numbers] of bySeason) {
          let season: Awaited<ReturnType<MetadataProvider['tvSeason']>> | null = null;
          try {
            season = await deps.provider.tvSeason(input.tmdbId, seasonNumber);
          } catch (err) {
            if (err instanceof ProviderError && err.kind === 'not_found') {
              problems.push({ path: 'episodes', message: `Season ${seasonNumber} does not exist` });
              continue;
            }
            mapProviderError(err);
          }
          for (const n of numbers) {
            const episode = season.episodes.find((e) => e.episodeNumber === n);
            if (!episode)
              problems.push({ path: 'episodes', message: `S${seasonNumber} E${n} does not exist` });
            else if (!isAired(episode.airDate, today)) {
              problems.push({
                path: 'episodes',
                message: `S${seasonNumber} E${n} has not aired yet`,
              });
            }
          }
        }
        if (problems.length > 0)
          throw ApiError.validation(problems, 'Some episodes cannot be marked as watched');
      }
      const stillExists = await deps.library.setEpisodesWatched(
        item.id,
        input.episodes,
        input.watched,
        input.watchedOn ?? now.toISOString().slice(0, 10),
        now,
      );
      const body: EpisodeWatchesResponse = {
        item: toMediaItem(item),
        episodeWatches: stillExists ? await deps.library.episodeWatchesFor(item.id) : [],
      };
      return c.json(body, 200);
    },
  );

  router.patch(
    '/watches/:id',
    deps.requireAuth,
    validate('param', IdParam),
    validate('json', UpdateWatchRequestSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const patch = c.req.valid('json');
      if (!isUuid(id)) throw ApiError.notFound('Watch entry');
      const existing = await deps.library.getEntry(id);
      if (!existing) throw ApiError.notFound('Watch entry');
      if (existing.item.mediaType === 'movie' && patch.season != null) {
        throw ApiError.validation([
          { path: 'season', message: 'Season can only be set for TV series' },
        ]);
      }
      const updated = await deps.library.updateEntry(id, patch, deps.now());
      if (!updated) throw ApiError.notFound('Watch entry');
      const body: WatchMutationResponse = {
        entry: toWatchEntry(updated),
        item: toMediaItem(existing.item),
      };
      return c.json(body, 200);
    },
  );

  router.delete('/watches/:id', deps.requireAuth, validate('param', IdParam), async (c) => {
    const { id } = c.req.valid('param');
    if (!isUuid(id)) throw ApiError.notFound('Watch entry');
    const deleted = await deps.library.deleteEntry(id);
    if (!deleted) throw ApiError.notFound('Watch entry');
    return c.body(null, 204);
  });

  return router;
}
