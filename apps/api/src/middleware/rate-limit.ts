import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../errors.js';
import type { SlidingWindow } from '../services/sliding-window.js';
import type { AppEnv } from '../types.js';

export function rateLimitHeaders(window: SlidingWindow, key: string): Record<string, string> {
  return {
    'RateLimit-Limit': String(window.limit),
    'RateLimit-Remaining': String(window.remaining(key)),
    'RateLimit-Reset': String(window.retryAfterSeconds(key) || Math.ceil(window.windowMs / 1000)),
  };
}

export function rateLimitedError(window: SlidingWindow, key: string): ApiError {
  const retryAfter = window.retryAfterSeconds(key) || Math.ceil(window.windowMs / 1000);
  return new ApiError('rate_limited', 'Too many requests, slow down', undefined, {
    'Retry-After': String(retryAfter),
    ...rateLimitHeaders(window, key),
    'RateLimit-Remaining': '0',
  });
}

/** Counts every request against the window; rejects with 429 once the limit is reached. */
export const rateLimit =
  (window: SlidingWindow): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const key = c.get('clientIp') ?? 'unknown';
    if (window.hit(key)) throw rateLimitedError(window, key);
    await next();
    for (const [k, v] of Object.entries(rateLimitHeaders(window, key))) c.res.headers.set(k, v);
  };
