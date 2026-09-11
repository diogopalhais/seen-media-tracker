import type { MiddlewareHandler } from 'hono';
import type { Logger } from '../logger.js';
import type { AppEnv } from '../types.js';

export const requestLogger =
  (base: Logger): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const log = base.child({ requestId: c.get('requestId') });
    c.set('logger', log);
    const start = performance.now();
    await next();
    const durationMs = Math.round(performance.now() - start);
    const status = c.res.status;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    log[level]({ method: c.req.method, path: c.req.path, status, durationMs }, 'request');
  };
