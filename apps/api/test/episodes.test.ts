import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { episodeWatches, mediaItems, watchEntries } from '../src/db/schema.js';
import { createTestContext, json, logWatch, type TestContext } from './helpers.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await createTestContext();
  token = await ctx.login();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.db.delete(episodeWatches);
  await ctx.db.db.delete(watchEntries);
  await ctx.db.db.delete(mediaItems);
});

const ep = (s: number, e: number) => ({ seasonNumber: s, episodeNumber: e });
const set = (body: Record<string, unknown>) =>
  ctx.request('/api/v1/watches/episodes', { method: 'PUT', token, json: body });
const mark = (episodes: unknown[], watched = true, extra: Record<string, unknown> = {}) =>
  set({ tmdbId: 95396, episodes, watched, ...extra });

describe('PUT /api/v1/watches/episodes', () => {
  it('requires authentication', async () => {
    expect(
      (
        await ctx.request('/api/v1/watches/episodes', {
          method: 'PUT',
          json: { tmdbId: 1, episodes: [ep(1, 1)], watched: true },
        })
      ).status,
    ).toBe(401);
  });

  it('marks a single episode and creates the library item with a snapshot', async () => {
    const res = await mark([ep(2, 5)]);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.item).toMatchObject({ mediaType: 'tv', tmdbId: 95396, title: 'Severance' });
    expect(body.episodeWatches).toEqual([
      { seasonNumber: 2, episodeNumber: 5, watchedOn: '2026-09-10' },
    ]);
    const list = await json(await ctx.request('/api/v1/library', { token }));
    expect(list.items[0]).toMatchObject({
      title: 'Severance',
      watchCount: 0,
      episodesWatched: 1,
      lastWatchedOn: '2026-09-10',
      rating: null,
    });
  });

  it('is idempotent for bulk marks and keeps original dates', async () => {
    await mark([ep(1, 1), ep(1, 2), ep(1, 3)], true, { watchedOn: '2026-08-01' });
    const again = await json(
      await mark([ep(1, 1), ep(1, 2), ep(1, 3), ep(1, 4)], true, { watchedOn: '2026-09-01' }),
    );
    expect(again.episodeWatches).toHaveLength(4);
    expect(again.episodeWatches[0].watchedOn).toBe('2026-08-01');
    expect(again.episodeWatches[3].watchedOn).toBe('2026-09-01');
  });

  it('unmarks episodes and removes the series when nothing remains', async () => {
    await mark([ep(1, 1), ep(1, 2)]);
    const partial = await json(await mark([ep(1, 2)], false));
    expect(partial.episodeWatches).toEqual([expect.objectContaining({ episodeNumber: 1 })]);
    const none = await json(await mark([ep(1, 1), ep(1, 9)], false));
    expect(none.episodeWatches).toEqual([]);
    expect((await ctx.request(`/api/v1/library/${none.item.id}`, { token })).status).toBe(404);
  });

  it('keeps the series when a season log remains and vice versa', async () => {
    const logged = await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: 95396,
      watchedOn: '2026-09-01',
      season: 1,
    });
    await mark([ep(1, 1)]);
    await mark([ep(1, 1)], false);
    expect((await ctx.request(`/api/v1/library/${logged.body.item.id}`, { token })).status).toBe(
      200,
    );
    await mark([ep(1, 1)]);
    expect(
      (await ctx.request(`/api/v1/watches/${logged.body.entry.id}`, { method: 'DELETE', token }))
        .status,
    ).toBe(204);
    const detail = await json(
      await ctx.request(`/api/v1/library/${logged.body.item.id}`, { token }),
    );
    expect(detail.watchCount).toBe(0);
    expect(detail.episodeWatches).toHaveLength(1);
  });

  it('validates the request', async () => {
    expect((await mark([])).status).toBe(400);
    expect((await mark([ep(1, -1)])).status).toBe(400);
    expect((await mark([ep(1, 1)], true, { watchedOn: '2999-01-01' })).status).toBe(400);
    expect((await set({ tmdbId: 438631, episodes: [ep(1, 1)], watched: true })).status).toBe(404); // a movie id is not a series
    expect((await set({ tmdbId: 123456789, episodes: [ep(1, 1)], watched: true })).status).toBe(
      404,
    );
    expect((await set({ tmdbId: 123456789, episodes: [ep(1, 1)], watched: false })).status).toBe(
      404,
    );
  });

  it('rejects episode tracking for a movie already in the library', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-09-01' });
    const res = await set({ tmdbId: 550, episodes: [ep(1, 1)], watched: true });
    // 550 is a movie: the provider lookup for a TV series fails, so it is not found as a series.
    expect([400, 404]).toContain(res.status);
  });
});

describe('episode watches in listing, detail and public feed', () => {
  it('orders the library by most recent activity across both tables', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 438631, watchedOn: '2026-09-05' });
    await mark([ep(1, 1)], true, { watchedOn: '2026-09-06' });
    const list = await json(await ctx.request('/api/v1/library', { token }));
    expect(list.items.map((i: any) => i.title)).toEqual(['Severance', 'Dune']);
    const detail = await json(await ctx.request(`/api/v1/library/${list.items[0].id}`, { token }));
    expect(detail.episodeWatches).toEqual([
      { seasonNumber: 1, episodeNumber: 1, watchedOn: '2026-09-06' },
    ]);
  });

  it('exposes the latest episode in the public feed', async () => {
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: 95396,
      watchedOn: '2026-08-20',
      season: 1,
      rating: 9,
    });
    await mark([ep(2, 5), ep(2, 6)], true, { watchedOn: '2026-09-07' });
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-09-01' });
    const feed = await json(await ctx.request('/api/v1/public/recent', { ip: '198.51.100.9' }));
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toMatchObject({
      title: 'Severance',
      watchedOn: '2026-09-07',
      season: 2,
      episode: 6,
      rating: 9,
    });
    expect(feed.items[1]).toMatchObject({ title: 'Fight Club', episode: null, season: null });
  });
});
