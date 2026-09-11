import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, json, logWatch, type TestContext } from './helpers.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await createTestContext();
  token = await ctx.login();
});
afterAll(() => ctx.close());

const search = (qs: string) => ctx.request(`/api/v1/search?${qs}`, { token });

describe('GET /api/v1/search', () => {
  it('requires authentication', async () => {
    expect((await ctx.request('/api/v1/search?q=dune')).status).toBe(401);
  });

  it('returns movies and tv merged by popularity for type=all', async () => {
    const res = await search('q=dune');
    expect(res.status).toBe(200);
    const body = await json(res);
    const types = new Set(body.results.map((r: any) => r.mediaType));
    expect(types).toEqual(new Set(['movie', 'tv']));
    expect(body.results.map((r: any) => r.tmdbId)).toEqual([438631, 90228, 841]);
    expect(body.results[0]).toMatchObject({
      title: 'Dune',
      releaseYear: 2021,
      posterUrl: 'https://image.tmdb.org/t/p/w342/dune2021.jpg',
      inLibrary: false,
      libraryItemId: null,
    });
    expect(body.page).toBe(1);
    expect(body.hasMore).toBe(false);
  });

  it('filters by media type', async () => {
    const body = await json(await search('q=dune&type=tv'));
    expect(body.results).toHaveLength(1);
    expect(body.results.every((r: any) => r.mediaType === 'tv')).toBe(true);
  });

  it('returns an empty list when nothing matches', async () => {
    const res = await search('q=zzzzzz');
    expect(res.status).toBe(200);
    expect((await json(res)).results).toEqual([]);
  });

  it('rejects empty, whitespace and over-long queries', async () => {
    expect((await search('')).status).toBe(400);
    expect((await search('q=')).status).toBe(400);
    expect((await search('q=%20%20')).status).toBe(400);
    expect((await search(`q=${'a'.repeat(201)}`)).status).toBe(400);
    expect((await search(`q=${'a'.repeat(200)}`)).status).toBe(200);
  });

  it('maps provider outages to 502 upstream_unavailable', async () => {
    ctx.provider.unavailable = true;
    try {
      const res = await search('q=dune');
      expect(res.status).toBe(502);
      const body = await json(res);
      expect(body.error.code).toBe('upstream_unavailable');
      expect(JSON.stringify(body)).not.toContain('stub');
    } finally {
      ctx.provider.unavailable = false;
    }
  });

  it('flags titles already in the library', async () => {
    const logged = await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 841,
      watchedOn: '2026-09-01',
    });
    expect(logged.status).toBe(201);
    const body = await json(await search('q=dune&type=movie'));
    const old = body.results.find((r: any) => r.tmdbId === 841);
    const recent = body.results.find((r: any) => r.tmdbId === 438631);
    expect(old).toMatchObject({ inLibrary: true, libraryItemId: logged.body.item.id });
    expect(recent).toMatchObject({ inLibrary: false, libraryItemId: null });
  });
});

describe('GET /api/v1/titles/:mediaType/:tmdbId', () => {
  it('returns movie details without seasons', async () => {
    const res = await ctx.request('/api/v1/titles/movie/438631', { token });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({
      mediaType: 'movie',
      tmdbId: 438631,
      runtimeMinutes: 155,
      numberOfSeasons: null,
      seasons: null,
      backdropUrl: 'https://image.tmdb.org/t/p/w780/dune2021-bd.jpg',
      tmdbUrl: 'https://www.themoviedb.org/movie/438631',
      inLibrary: false,
      rating: null,
    });
    expect(body.genres).toHaveLength(2);
  });

  it('returns tv details with ascending seasons and flagged specials', async () => {
    const body = await json(await ctx.request('/api/v1/titles/tv/90228', { token }));
    expect(body.numberOfSeasons).toBe(1);
    expect(body.seasons.map((s: any) => s.seasonNumber)).toEqual([0, 1]);
    expect(body.seasons[0].isSpecials).toBe(true);
    expect(body.seasons[1].isSpecials).toBe(false);
  });

  it('returns 404 for unknown ids and 400 for invalid types', async () => {
    expect((await ctx.request('/api/v1/titles/movie/999999999', { token })).status).toBe(404);
    expect((await ctx.request('/api/v1/titles/book/1', { token })).status).toBe(400);
    expect((await ctx.request('/api/v1/titles/movie/abc', { token })).status).toBe(400);
  });

  it('includes library membership and displayed rating', async () => {
    const logged = await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: 95396,
      watchedOn: '2026-09-02',
      rating: 9,
    });
    const body = await json(await ctx.request('/api/v1/titles/tv/95396', { token }));
    expect(body).toMatchObject({ inLibrary: true, libraryItemId: logged.body.item.id, rating: 9 });
  });
});
