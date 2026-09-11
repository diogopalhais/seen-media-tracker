import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGIN_FAILURE_WINDOW_MS } from '../src/app.js';
import { sessions } from '../src/db/schema.js';
import { createTestContext, json, OWNER_PASSWORD, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());

const login = (password: unknown, ip?: string) =>
  ctx.request('/api/v1/auth/login', { method: 'POST', json: { password }, ...(ip ? { ip } : {}) });

describe('login', () => {
  it('issues a token and expiry for the correct password', async () => {
    const res = await login(OWNER_PASSWORD);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const expires = new Date(body.expiresAt).getTime() - ctx.clock.now().getTime();
    expect(expires).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('rejects an incorrect password generically', async () => {
    const res = await login('wrong password', '198.51.100.7');
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({
      error: { code: 'invalid_credentials', message: 'Incorrect password' },
    });
  });

  it('rejects malformed requests', async () => {
    expect((await ctx.request('/api/v1/auth/login', { method: 'POST', json: {} })).status).toBe(
      400,
    );
    expect((await login(12345)).status).toBe(400);
    expect((await login('')).status).toBe(400);
  });

  it('stores only a hash of the token', async () => {
    const res = await login(OWNER_PASSWORD);
    const { token } = await json(res);
    const rows = await ctx.db.db.select().from(sessions);
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.tokenHash))).toBe(true);
  });
});

describe('bearer sessions', () => {
  it('grants access with a valid token', async () => {
    const token = await ctx.login();
    const res = await ctx.request('/api/v1/auth/session', { token });
    expect(res.status).toBe(200);
    expect((await json(res)).authenticated).toBe(true);
  });

  it('rejects a missing Authorization header with WWW-Authenticate', async () => {
    const res = await ctx.request('/api/v1/library');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
    expect((await json(res)).error.code).toBe('unauthorized');
  });

  it('rejects non-Bearer schemes', async () => {
    const res = await ctx.request('/api/v1/library', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects unknown tokens', async () => {
    const res = await ctx.request('/api/v1/library', { token: 'A'.repeat(43) });
    expect(res.status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const token = await ctx.login();
    ctx.clock.advance(30 * 24 * 60 * 60 * 1000 + 1000);
    try {
      const res = await ctx.request('/api/v1/auth/session', { token });
      expect(res.status).toBe(401);
    } finally {
      ctx.clock.advance(-(30 * 24 * 60 * 60 * 1000 + 1000));
    }
  });

  it('does not reveal resource existence to unauthenticated callers', async () => {
    const res = await ctx.request('/api/v1/library/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });
});

describe('logout', () => {
  it('revokes the token immediately', async () => {
    const token = await ctx.login();
    const out = await ctx.request('/api/v1/auth/logout', { method: 'POST', token });
    expect(out.status).toBe(204);
    const after = await ctx.request('/api/v1/auth/session', { token });
    expect(after.status).toBe(401);
  });

  it('requires authentication itself', async () => {
    expect((await ctx.request('/api/v1/auth/logout', { method: 'POST' })).status).toBe(401);
  });
});

describe('login throttling', () => {
  const ip = '192.0.2.44';

  it('throttles the sixth failed attempt and recovers after the window', async () => {
    for (let i = 0; i < 5; i++) expect((await login('nope', ip)).status).toBe(401);
    const sixth = await login('nope', ip);
    expect(sixth.status).toBe(429);
    expect((await json(sixth)).error.code).toBe('rate_limited');
    expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(sixth.headers.get('ratelimit-limit')).toBe('5');
    expect(sixth.headers.get('ratelimit-remaining')).toBe('0');

    // Even the correct password is refused while throttled.
    expect((await login(OWNER_PASSWORD, ip)).status).toBe(429);

    ctx.clock.advance(LOGIN_FAILURE_WINDOW_MS + 1000);
    try {
      const again = await login(OWNER_PASSWORD, ip);
      expect(again.status).toBe(200);
    } finally {
      ctx.clock.advance(-(LOGIN_FAILURE_WINDOW_MS + 1000));
    }
  });

  it('resets the counter on success and keeps addresses separate', async () => {
    const a = '192.0.2.1';
    const b = '192.0.2.2';
    for (let i = 0; i < 4; i++) await login('nope', a);
    expect((await login(OWNER_PASSWORD, a)).status).toBe(200);
    for (let i = 0; i < 4; i++) await login('nope', a);
    expect((await login('nope', a)).status).toBe(401);
    expect((await login('nope', b)).status).toBe(401);
  });
});
