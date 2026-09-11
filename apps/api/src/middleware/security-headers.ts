import type { MiddlewareHandler } from 'hono';

/** 180 days, as required by the api-foundation spec. */
const HSTS_MAX_AGE = 180 * 24 * 60 * 60;

export const securityHeaders = (): MiddlewareHandler => async (c, next) => {
  await next();
  c.res.headers.set('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE}; includeSubDomains`);
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'no-referrer');
  c.res.headers.delete('Server');
  c.res.headers.delete('X-Powered-By');
};

/** Private API responses must never be cached by browsers or intermediaries. */
export const noStore = (): MiddlewareHandler => async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
};
