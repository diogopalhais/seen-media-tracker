import { LibraryListQuerySchema, type LibraryListResponse } from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { LibraryRepository } from '../services/library.js';
import { detailsFor, type MetadataProvider } from '../services/metadata/provider.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';

export interface LibraryDeps {
  library: LibraryRepository;
  provider: MetadataProvider;
  requireAuth: MiddlewareHandler<AppEnv>;
  now: () => Date;
}

const IdParam = z.object({ id: z.string().min(1) });

export function libraryRoutes(deps: LibraryDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/library', deps.requireAuth, validate('query', LibraryListQuerySchema), async (c) => {
    const body: LibraryListResponse = await deps.library.list(c.req.valid('query'));
    return c.json(body, 200);
  });

  router.get('/library/:id', deps.requireAuth, validate('param', IdParam), async (c) => {
    const { id } = c.req.valid('param');
    if (!z.uuid().safeParse(id).success) throw ApiError.notFound('Library item');
    let detail = await deps.library.getItemDetail(id);
    if (!detail) throw ApiError.notFound('Library item');
    // Items created before community ratings were stored: refresh the snapshot once, best effort.
    if (detail.item.tmdbRating.count === 0 && detail.item.tmdbRating.average === null) {
      const row = await deps.library.findItemByTmdb(detail.item.mediaType, detail.item.tmdbId);
      if (row && row.tmdbVoteCount === null) {
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

  return router;
}
