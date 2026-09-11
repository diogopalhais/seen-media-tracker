import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;

export const requestId = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const supplied = c.req.header('x-request-id');
  const id = supplied && SAFE_ID.test(supplied) ? supplied : randomUUID();
  c.set('requestId', id);
  c.header('X-Request-Id', id);
  await next();
};
