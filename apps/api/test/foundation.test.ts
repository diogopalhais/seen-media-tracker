import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPgliteDb } from '../src/db/pglite.js';
import {
  ALLOWED_ORIGIN,
  createTestContext,
  json,
  OWNER_PASSWORD,
  ownerHash,
  StubProvider,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());

describe('api foundation', () => {
  it('returns the standard JSON 404 for unknown routes', async () => {
    const res = await ctx.request('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await json(res)).toEqual({ error: { code: 'not_found', message: 'Route not found' } });
  });

  it('returns 404 for registration attempts', async () => {
    const res = await ctx.request('/api/v1/auth/register', {
      method: 'POST',
      json: { password: 'x' },
    });
    expect(res.status).toBe(404);
  });

  it('echoes a supplied request id and generates one otherwise', async () => {
    const echoed = await ctx.request('/health', { headers: { 'X-Request-Id': 'abc123' } });
    expect(echoed.headers.get('x-request-id')).toBe('abc123');
    const generated = await ctx.request('/health');
    expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reports validation errors with field paths', async () => {
    const token = await ctx.login();
    const res = await ctx.request('/api/v1/watches', {
      method: 'POST',
      token,
      json: { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-09-01', rating: 7.5 },
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('validation_error');
    expect(body.error.details).toEqual([expect.objectContaining({ path: 'rating' })]);
  });

  it('rejects oversized bodies with 413', async () => {
    const big = { password: 'x'.repeat(101 * 1024) };
    const res = await ctx.request('/api/v1/auth/login', { method: 'POST', json: big });
    expect(res.status).toBe(413);
    expect((await json(res)).error.code).toBe('payload_too_large');
  });

  it('rejects non-JSON bodies with 400', async () => {
    const res = await ctx.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'password=abc',
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('validation_error');
  });

  it('allows a bodiless POST without content type (logout)', async () => {
    const token = await ctx.login();
    const res = await ctx.request('/api/v1/auth/logout', { method: 'POST', token });
    expect(res.status).toBe(204);
  });

  it('answers preflight for the allowed origin', async () => {
    const res = await ctx.request('/api/v1/library', {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get('access-control-allow-methods')).toContain('PATCH');
    expect(res.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'authorization',
    );
    expect(Number(res.headers.get('access-control-max-age'))).toBeGreaterThanOrEqual(600);
  });

  it('sends no CORS headers to unknown origins', async () => {
    const res = await ctx.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      json: { password: OWNER_PASSWORD },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sets security and no-store headers on private responses', async () => {
    const token = await ctx.login();
    const res = await ctx.request('/api/v1/auth/session', { token });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age=(\d+)/);
    const maxAge = Number(
      /max-age=(\d+)/.exec(res.headers.get('strict-transport-security') ?? '')?.[1],
    );
    expect(maxAge).toBeGreaterThanOrEqual(180 * 24 * 3600);
    expect(res.headers.get('server')).toBeNull();
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('reports healthy with version and uptime', async () => {
    const res = await ctx.request('/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await json(res);
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports degraded when the database is unavailable', async () => {
    const broken = await createPgliteDb();
    const app = createApp({
      config: {
        OWNER_PASSWORD_HASH: await ownerHash(),
        CORS_ORIGINS: [ALLOWED_ORIGIN],
        TRUST_PROXY: true,
      },
      db: broken.db,
      provider: new StubProvider(),
      logger: pino({ level: 'silent' }),
    });
    await broken.close();
    const res = await app.request('http://api.test/health');
    expect(res.status).toBe(503);
    expect((await json(res)).status).toBe('degraded');
  });

  it('maps unexpected errors to a generic 500 without internals', async () => {
    ctx.provider.unavailable = false;
    const original = ctx.provider.movieDetails.bind(ctx.provider);
    ctx.provider.movieDetails = async () => {
      throw new Error('secret stack details');
    };
    try {
      const token = await ctx.login();
      const res = await ctx.request('/api/v1/titles/movie/550', { token });
      expect(res.status).toBe(500);
      const body = await json(res);
      expect(body.error.code).toBe('internal_error');
      expect(JSON.stringify(body)).not.toContain('secret stack');
    } finally {
      ctx.provider.movieDetails = original;
    }
  });
});
