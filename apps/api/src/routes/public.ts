import { createHash } from 'node:crypto';
import { PublicRecentQuerySchema, type PublicRecentResponse } from '@seen/shared';
import { Hono } from 'hono';
import { ApiError } from '../errors.js';
import type { LibraryRepository } from '../services/library.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';

export interface PublicDeps {
  library: LibraryRepository;
  now: () => Date;
}

export const PUBLIC_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600';

function etagFor(payload: string): string {
  return `"${createHash('sha256').update(payload).digest('base64url')}"`;
}

function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header
    .split(',')
    .map((t) => t.trim().replace(/^W\//, ''))
    .some((t) => t === '*' || t === etag);
}

export function publicRoutes(deps: PublicDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/recent', validate('query', PublicRecentQuerySchema), async (c) => {
    const { limit } = c.req.valid('query');
    const items = await deps.library.publicRecent(limit);
    // generatedAt is deliberately excluded from the ETag so unchanged data validates as unchanged.
    const etag = etagFor(JSON.stringify(items));
    c.header('Cache-Control', PUBLIC_CACHE_CONTROL);
    c.header('ETag', etag);
    c.header('Vary', 'Accept-Encoding');
    if (etagMatches(c.req.header('if-none-match'), etag)) return c.body(null, 304);
    const body: PublicRecentResponse = { items, generatedAt: deps.now().toISOString() };
    return c.json(body, 200);
  });

  router.on(['POST', 'PUT', 'PATCH', 'DELETE'], '/recent', () => {
    throw new ApiError('method_not_allowed', 'Only GET and HEAD are allowed', undefined, {
      Allow: 'GET, HEAD, OPTIONS',
    });
  });

  return router;
}
