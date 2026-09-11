import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../errors.js';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/** Requests that carry a body must declare application/json. Bodiless POSTs (e.g. logout) pass. */
export const requireJsonBody = (): MiddlewareHandler => async (c, next) => {
  if (METHODS_WITH_BODY.has(c.req.method)) {
    const length = c.req.header('content-length');
    const hasBody =
      (length !== undefined && length !== '0') || c.req.header('transfer-encoding') !== undefined;
    if (hasBody) {
      const type = c.req.header('content-type') ?? '';
      if (!/^application\/json\b/i.test(type)) {
        throw ApiError.validation(
          [{ path: 'headers.content-type', message: 'Content-Type must be application/json' }],
          'Unsupported request body type',
        );
      }
    }
  }
  await next();
};
