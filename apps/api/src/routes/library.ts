import { LibraryListQuerySchema, type LibraryListResponse } from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { LibraryRepository } from '../services/library.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';

export interface LibraryDeps {
  library: LibraryRepository;
  requireAuth: MiddlewareHandler<AppEnv>;
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
    const detail = await deps.library.getItemDetail(id);
    if (!detail) throw ApiError.notFound('Library item');
    return c.json(detail, 200);
  });

  return router;
}
