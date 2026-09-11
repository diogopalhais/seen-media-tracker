import { getConnInfo } from '@hono/node-server/conninfo';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

/** Resolves the client IP once per request; forwarded headers are only honoured behind a trusted proxy. */
export const clientIp =
  (trustProxy: boolean): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    let ip = 'unknown';
    if (trustProxy) {
      const forwarded = c.req.header('x-forwarded-for');
      const first = forwarded?.split(',')[0]?.trim();
      if (first) ip = first;
    }
    if (ip === 'unknown') {
      try {
        ip = getConnInfo(c).remote.address ?? 'unknown';
      } catch {
        // Not running on the Node adapter (e.g. app.request() in tests).
      }
    }
    c.set('clientIp', ip);
    await next();
  };
