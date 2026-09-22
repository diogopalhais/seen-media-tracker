import {
  LibraryListQuerySchema,
  type LibraryListResponse,
  type LibraryReleasesResponse,
  latestTodayOnEarth,
  UpdateLibraryItemRequestSchema,
} from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { LibraryRepository } from '../services/library.js';
import { detailsFor, type MetadataProvider } from '../services/metadata/provider.js';
import type { SnapshotRefresher } from '../services/refresh.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';

export interface LibraryDeps {
  library: LibraryRepository;
  provider: MetadataProvider;
  requireAuth: MiddlewareHandler<AppEnv>;
  now: () => Date;
  refresher: SnapshotRefresher;
}

const IdParam = z.object({ id: z.string().min(1) });

export function libraryRoutes(deps: LibraryDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/library', deps.requireAuth, validate('query', LibraryListQuerySchema), async (c) => {
    const query = c.req.valid('query');
    // Only the first page pays for the refresh; later pages of the same scroll should be quick.
    if (!query.cursor) await deps.refresher.refreshStale();
    const body: LibraryListResponse = await deps.library.list(
      query,
      latestTodayOnEarth(deps.now()),
    );
    return c.json(body, 200);
  });

  router.get('/library/releases', deps.requireAuth, async (c) => {
    await deps.refresher.refreshStale();
    const body: LibraryReleasesResponse = {
      items: await deps.library.listReleases(latestTodayOnEarth(deps.now())),
    };
    return c.json(body, 200);
  });

  router.get('/library/:id', deps.requireAuth, validate('param', IdParam), async (c) => {
    const { id } = c.req.valid('param');
    if (!z.uuid().safeParse(id).success) throw ApiError.notFound('Library item');
    let detail = await deps.library.getItemDetail(id);
    if (!detail) throw ApiError.notFound('Library item');
    // Items created before community ratings or the season list were stored: refresh the snapshot
    // once, best effort.
    const unrated = detail.item.tmdbRating.count === 0 && detail.item.tmdbRating.average === null;
    if (unrated || detail.item.mediaType === 'tv') {
      const row = await deps.library.findItemByTmdb(detail.item.mediaType, detail.item.tmdbId);
      const needsRefresh =
        row && (row.tmdbVoteCount === null || (row.mediaType === 'tv' && row.seasons === null));
      if (needsRefresh) {
        try {
          const details = await detailsFor(
            deps.provider,
            detail.item.mediaType,
            detail.item.tmdbId,
          );
          await deps.library.upsertItem(details, deps.now());
          detail = (await deps.library.getItemDetail(id)) ?? detail;
        } catch {
          // Provider unavailable: serve the stored snapshot as-is.
        }
      }
    }
    return c.json(detail, 200);
  });

  /** Owner settings on an item: stop or resume following a series. */
  router.patch(
    '/library/:id',
    deps.requireAuth,
    validate('param', IdParam),
    validate('json', UpdateLibraryItemRequestSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      if (!z.uuid().safeParse(id).success) throw ApiError.notFound('Library item');
      const existing = await deps.library.getItemDetail(id);
      if (!existing) throw ApiError.notFound('Library item');
      if (existing.item.mediaType !== 'tv')
        throw ApiError.validation(
          [{ path: 'muted', message: 'Only series can be followed or muted' }],
          'Only series can be followed or muted',
        );
      await deps.library.setMuted(id, body.muted, deps.now());
      const detail = await deps.library.getItemDetail(id);
      if (!detail) throw ApiError.notFound('Library item');
      return c.json(detail, 200);
    },
  );

  return router;
}
