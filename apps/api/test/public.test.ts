import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PUBLIC_RATE_LIMIT } from '../src/app.js';
import { mediaItems, watchEntries } from '../src/db/schema.js';
import { createTestContext, json, logWatch, type TestContext } from './helpers.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await createTestContext();
  token = await ctx.login();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.db.delete(watchEntries);
  await ctx.db.db.delete(mediaItems);
});

const recent = (qs = '', init: Parameters<TestContext['request']>[1] = {}) =>
  ctx.request(`/api/v1/public/recent${qs ? `?${qs}` : ''}`, { ip: '198.51.100.1', ...init });

describe('GET /api/v1/public/recent', () => {
  it('needs no authentication and returns an empty list for an empty library', async () => {
    const res = await recent();
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items).toEqual([]);
    expect(body.generatedAt).toBe(ctx.clock.now().toISOString());
  });

  it('returns one item per title, most recent first, with only public fields', async () => {
    await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 550,
      watchedOn: '2026-08-01',
      rating: 7,
      note: 'private thoughts',
    });
    await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 550,
      watchedOn: '2026-08-20',
      rating: 8,
    });
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-09-05' });
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: 95396,
      watchedOn: '2026-09-01',
      rating: 10,
      season: 2,
    });
    const body = await json(await recent());
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toEqual({
      mediaType: 'movie',
      title: 'Fight Club',
      year: 1999,
      posterUrl: 'https://image.tmdb.org/t/p/w342/fc.jpg',
      rating: 8,
      watchedOn: '2026-09-05',
      season: null,
      episode: null,
      tmdbUrl: 'https://www.themoviedb.org/movie/550',
    });
    expect(body.items[1]).toMatchObject({
      title: 'Severance',
      season: 2,
      rating: 10,
      watchedOn: '2026-09-01',
    });
    const text = JSON.stringify(body);
    expect(text).not.toContain('private thoughts');
    expect(text).not.toContain('"id"');
    expect(text).not.toContain('note');
  });

  it('filters by media type so movies and shows can be listed separately', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-09-05' });
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 438631, watchedOn: '2026-09-02' });
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: 95396,
      watchedOn: '2026-09-04',
      season: 2,
    });
    const movies = await json(await recent('type=movie'));
    expect(movies.items.map((i: { title: string }) => i.title)).toEqual(['Fight Club', 'Dune']);
    expect(movies.items.every((i: { mediaType: string }) => i.mediaType === 'movie')).toBe(true);
    const shows = await json(await recent('type=tv&limit=1'));
    expect(shows.items).toHaveLength(1);
    expect(shows.items[0]).toMatchObject({ mediaType: 'tv', title: 'Severance', season: 2 });
    expect((await json(await recent())).items).toHaveLength(3);
    expect((await recent('type=book')).status).toBe(400);
  });

  it('honours the limit and rejects out-of-range values', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-08-01' });
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 841, watchedOn: '2026-08-02' });
    expect((await json(await recent('limit=1'))).items).toHaveLength(1);
    for (const bad of ['0', '51', '-3', '2.5', 'ten']) {
      const res = await recent(`limit=${bad}`);
      expect(res.status, `limit=${bad}`).toBe(400);
      expect((await json(res)).error.code).toBe('validation_error');
    }
  });

  it('is readable cross-origin and refuses write methods', async () => {
    const res = await recent('', { headers: { Origin: 'https://my-site.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const preflight = await recent('', {
      method: 'OPTIONS',
      headers: { Origin: 'https://my-site.example', 'Access-Control-Request-Method': 'GET' },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    const post = await recent('', { method: 'POST', json: {} });
    expect(post.status).toBe(405);
    expect((await json(post)).error.code).toBe('method_not_allowed');
    expect(post.headers.get('allow')).toContain('GET');
  });

  it('serves cache headers, 304 on matching ETag, and a new ETag after changes', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-08-01' });
    const first = await recent();
    expect(first.headers.get('cache-control')).toBe(
      'public, max-age=300, stale-while-revalidate=600',
    );
    const etag = first.headers.get('etag');
    expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/);

    const conditional = await recent('', { headers: { 'If-None-Match': etag as string } });
    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe('');

    const weak = await recent('', { headers: { 'If-None-Match': `W/${etag}` } });
    expect(weak.status).toBe(304);

    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 841, watchedOn: '2026-08-02' });
    const changed = await recent('', { headers: { 'If-None-Match': etag as string } });
    expect(changed.status).toBe(200);
    expect(changed.headers.get('etag')).not.toBe(etag);
  });

  it('rate limits per IP at 60 requests per minute', async () => {
    const ip = '203.0.113.99';
    for (let i = 0; i < PUBLIC_RATE_LIMIT; i++) {
      const res = await recent('', { ip });
      expect(res.status).toBe(200);
    }
    const over = await recent('', { ip });
    expect(over.status).toBe(429);
    expect((await json(over)).error.code).toBe('rate_limited');
    expect(Number(over.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(over.headers.get('ratelimit-limit')).toBe('60');
    const other = await recent('', { ip: '203.0.113.100' });
    expect(other.status).toBe(200);
    expect(other.headers.get('ratelimit-remaining')).toBe('59');
  });
});
