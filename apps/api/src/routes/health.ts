import type { HealthResponse } from '@seen/shared';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client.js';
import type { AppEnv } from '../types.js';
import { APP_VERSION } from '../version.js';

export function healthRoutes(db: Db, startedAt: number): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  router.get('/', async (c) => {
    c.header('Cache-Control', 'no-store');
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
    try {
      await db.execute(sql`select 1`);
      const body: HealthResponse = { status: 'ok', version: APP_VERSION, uptimeSeconds };
      return c.json(body, 200);
    } catch (err) {
      c.get('logger')?.error({ err }, 'health check failed');
      const body: HealthResponse = { status: 'degraded', version: APP_VERSION, uptimeSeconds };
      return c.json(body, 503);
    }
  });
  return router;
}
