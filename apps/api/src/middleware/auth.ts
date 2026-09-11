import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../errors.js';
import type { SessionService } from '../services/sessions.js';
import type { AppEnv } from '../types.js';

const BEARER = /^Bearer\s+([A-Za-z0-9_-]{16,512})$/;

/** Attach to every private route. Unknown, expired and malformed tokens are indistinguishable to the caller. */
export const requireAuth =
  (sessionsService: SessionService): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    const match = header ? BEARER.exec(header) : null;
    const token = match?.[1];
    if (!token) throw ApiError.unauthorized();
    const session = await sessionsService.resolve(token);
    if (!session) throw ApiError.unauthorized();
    c.set('session', session);
    await next();
  };
