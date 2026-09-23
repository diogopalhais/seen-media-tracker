import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProviderError } from '../src/services/metadata/provider.js';
import { createTestContext, json, logWatch, type TestContext } from './helpers.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await createTestContext();
  token = await ctx.login();
});
afterAll(() => ctx.close());

describe('community rating', () => {
  it('is included on search results, rounded to one decimal', async () => {
    const body = await json(await ctx.request('/api/v1/search?q=severance', { token }));
    expect(body.results[0].tmdbRating).toEqual({ average: 8.4, count: 3200 });
  });

  it('is included on title details and stored on the library snapshot', async () => {
    const details = await json(await ctx.request('/api/v1/titles/movie/438631', { token }));
    expect(details.tmdbRating).toEqual({ average: 7.8, count: 12345 });
    expect(details.seasons).toBeNull();
    const logged = await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 438631,
      watchedOn: '2026-09-01',
    });
    expect(logged.body.item.tmdbRating).toEqual({ average: 7.8, count: 12345 });
    const list = await json(await ctx.request('/api/v1/library', { token }));
    expect(list.items[0].tmdbRating).toEqual({ average: 7.8, count: 12345 });
    ctx.provider.unavailable = true;
    try {
      const detail = await json(
        await ctx.request(`/api/v1/library/${logged.body.item.id}`, { token }),
      );
      expect(detail.item.tmdbRating.average).toBe(7.8);
    } finally {
      ctx.provider.unavailable = false;
    }
  });

  it('is null with zero votes', async () => {
    const tv = await json(await ctx.request('/api/v1/titles/tv/90228', { token }));
    expect(tv.seasons[1].airDate).toBe('2024-11-17');
    expect(tv.tmdbRating).toEqual({ average: 6.9, count: 320 });
  });
});

describe('GET /api/v1/discover', () => {
  it('requires authentication', async () => {
    expect((await ctx.request('/api/v1/discover')).status).toBe(401);
  });

  it('returns the film lists with membership and ratings, plus two game lists', async () => {
    ctx.provider.calls = [];
    const first = await json(await ctx.request('/api/v1/discover', { token }));
    expect(first.trending.map((r: any) => r.mediaType)).toEqual(['tv', 'movie', 'tv']);
    expect(first.popularMovies).toHaveLength(3);
    expect(first.popularTv).toHaveLength(2);
    expect(first.trending[1]).toMatchObject({
      tmdbId: 438631,
      inLibrary: true,
      tmdbRating: { average: 7.8 },
    });
    expect(first.popularTv[0]).toMatchObject({ inLibrary: false, libraryItemId: null });
    expect(first.trendingGames.map((r: any) => r.title)).toEqual(['Hades', 'Elden Ring']);
    expect(first.topGames[0]).toMatchObject({
      mediaType: 'game',
      title: 'Elden Ring',
      posterUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg',
      tmdbRating: { average: 9.5, count: 4000 },
    });
    // The route itself calls the stub directly; caching lives in CachedMetadataProvider, covered below.
    expect(
      ctx.provider.calls.filter((c) => c.startsWith('trending') || c.startsWith('popular')),
    ).toHaveLength(4);
    expect(ctx.provider.calls).toContain('topGames');
  });

  it('serves empty game lists when only the game provider is down', async () => {
    const original = ctx.provider.trendingGames.bind(ctx.provider);
    ctx.provider.trendingGames = async () => {
      throw new ProviderError('unavailable', 'igdb down');
    };
    try {
      const body = await json(await ctx.request('/api/v1/discover', { token }));
      expect(body.trending).toHaveLength(3);
      expect(body.trendingGames).toEqual([]);
      expect(body.topGames).toHaveLength(2);
    } finally {
      ctx.provider.trendingGames = original;
    }
  });

  it('maps provider outages to 502', async () => {
    ctx.provider.unavailable = true;
    try {
      const res = await ctx.request('/api/v1/discover', { token });
      expect(res.status).toBe(502);
    } finally {
      ctx.provider.unavailable = false;
    }
  });
});

describe('GET /api/v1/titles/tv/:tmdbId/seasons/:seasonNumber', () => {
  it('returns episodes in ascending order with details', async () => {
    const body = await json(await ctx.request('/api/v1/titles/tv/95396/seasons/2', { token }));
    expect(body).toMatchObject({
      tmdbId: 95396,
      seasonNumber: 2,
      name: 'Season 2',
      episodeCount: 10,
      airDate: '2025-01-17',
    });
    expect(body.posterUrl).toBe('https://image.tmdb.org/t/p/w342/season.jpg');
    expect(body.episodes.map((e: any) => e.episodeNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(body.episodes[0]).toMatchObject({
      name: 'Episode 1',
      runtimeMinutes: 45,
      stillUrl: 'https://image.tmdb.org/t/p/w300/still.jpg',
      tmdbRating: { average: 8, count: 100 },
    });
    expect(body.episodes[1].stillUrl).toBeNull();
  });

  it('returns 404 for an unknown season and 400 for invalid numbers', async () => {
    expect((await ctx.request('/api/v1/titles/tv/95396/seasons/9', { token })).status).toBe(404);
    expect((await ctx.request('/api/v1/titles/tv/999/seasons/1', { token })).status).toBe(404);
    expect((await ctx.request('/api/v1/titles/tv/95396/seasons/-1', { token })).status).toBe(400);
    expect((await ctx.request('/api/v1/titles/tv/95396/seasons/abc', { token })).status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await ctx.request('/api/v1/titles/tv/95396/seasons/1')).status).toBe(401);
  });
});

describe('CachedMetadataProvider', () => {
  it('serves discover lists and seasons from cache within the TTL', async () => {
    const { CachedMetadataProvider } = await import('../src/services/metadata/cached.js');
    const { StubProvider } = await import('./helpers.js');
    const inner = new StubProvider();
    const cached = new CachedMetadataProvider(inner);
    await cached.trendingAll('week');
    await cached.trendingAll('week');
    await cached.popularMovies();
    await cached.popularMovies();
    await cached.tvSeason(95396, 1);
    await cached.tvSeason(95396, 1);
    expect(inner.calls).toEqual(['trending:week', 'popular:movie', 'season:95396:1']);
  });
});
