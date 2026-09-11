import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  ctx.provider.calls = [];
});

const movie = (extra: Record<string, unknown> = {}) => ({
  mediaType: 'movie',
  tmdbId: 438631,
  watchedOn: '2026-09-01',
  ...extra,
});
const show = (extra: Record<string, unknown> = {}) => ({
  mediaType: 'tv',
  tmdbId: 95396,
  watchedOn: '2026-09-01',
  ...extra,
});
const patch = (id: string, body: unknown) =>
  ctx.request(`/api/v1/watches/${id}`, { method: 'PATCH', token, json: body });
const del = (id: string) => ctx.request(`/api/v1/watches/${id}`, { method: 'DELETE', token });
const list = (qs = '') => ctx.request(`/api/v1/library${qs ? `?${qs}` : ''}`, { token });
const detail = (id: string) => ctx.request(`/api/v1/library/${id}`, { token });

describe('POST /api/v1/watches', () => {
  it('creates the item with a metadata snapshot on first watch', async () => {
    const { status, body } = await logWatch(ctx, token, movie({ rating: 9 }));
    expect(status).toBe(201);
    expect(body.entry).toMatchObject({
      watchedOn: '2026-09-01',
      rating: 9,
      season: null,
      note: null,
    });
    expect(body.item).toMatchObject({
      mediaType: 'movie',
      tmdbId: 438631,
      title: 'Dune',
      releaseYear: 2021,
      runtimeMinutes: 155,
      posterUrl: 'https://image.tmdb.org/t/p/w342/dune2021.jpg',
    });
    expect(body.item.genres).toHaveLength(2);
    expect(ctx.provider.calls).toContain('movieDetails:438631');
  });

  it('reuses the existing item without calling the provider again', async () => {
    const first = await logWatch(ctx, token, movie());
    ctx.provider.calls = [];
    const second = await logWatch(ctx, token, movie({ watchedOn: '2026-09-05' }));
    expect(second.status).toBe(201);
    expect(second.body.item.id).toBe(first.body.item.id);
    expect(ctx.provider.calls).toEqual([]);
    const d = await json(await detail(first.body.item.id));
    expect(d.watchCount).toBe(2);
  });

  it('records a season for tv', async () => {
    const { status, body } = await logWatch(ctx, token, show({ season: 2 }));
    expect(status).toBe(201);
    expect(body.entry.season).toBe(2);
  });

  it('rejects future dates naming watchedOn', async () => {
    const future = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
    const { status, body } = await logWatch(ctx, token, movie({ watchedOn: future }));
    expect(status).toBe(400);
    expect(body.error.details[0].path).toBe('watchedOn');
  });

  it.each([0, 11, 7.5, '8'])('rejects rating %s naming rating', async (rating) => {
    const { status, body } = await logWatch(ctx, token, movie({ rating }));
    expect(status).toBe(400);
    expect(body.error.details.some((d: any) => d.path === 'rating')).toBe(true);
  });

  it('rejects a season on a movie naming season', async () => {
    const { status, body } = await logWatch(ctx, token, movie({ season: 1 }));
    expect(status).toBe(400);
    expect(body.error.details[0].path).toBe('season');
  });

  it('rejects notes over 2000 characters', async () => {
    expect((await logWatch(ctx, token, movie({ note: 'x'.repeat(2001) }))).status).toBe(400);
    expect((await logWatch(ctx, token, movie({ note: 'x'.repeat(2000) }))).status).toBe(201);
  });

  it('returns 404 for unknown titles and stores nothing', async () => {
    const { status, body } = await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 123456789,
      watchedOn: '2026-09-01',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('not_found');
    expect(await ctx.db.db.select().from(mediaItems)).toHaveLength(0);
  });

  it('library stays readable when the provider is down', async () => {
    const { body } = await logWatch(ctx, token, movie());
    ctx.provider.unavailable = true;
    try {
      expect((await list()).status).toBe(200);
      expect((await detail(body.item.id)).status).toBe(200);
    } finally {
      ctx.provider.unavailable = false;
    }
  });
});

describe('watch history and displayed rating', () => {
  it('orders rewatches most recent first, then by creation for same-day entries', async () => {
    const a = await logWatch(ctx, token, movie({ watchedOn: '2026-08-01' }));
    const b = await logWatch(ctx, token, movie({ watchedOn: '2026-09-01' }));
    ctx.clock.advance(1000);
    const c = await logWatch(ctx, token, movie({ watchedOn: '2026-09-01' }));
    const d = await json(await detail(a.body.item.id));
    expect(d.entries.map((e: any) => e.id)).toEqual([
      c.body.entry.id,
      b.body.entry.id,
      a.body.entry.id,
    ]);
  });

  it('uses the most recent rated entry as the displayed rating', async () => {
    const first = await logWatch(ctx, token, movie({ watchedOn: '2026-08-01', rating: 7 }));
    const id = first.body.item.id;
    expect((await json(await detail(id))).rating).toBe(7);
    await logWatch(ctx, token, movie({ watchedOn: '2026-09-01' }));
    expect((await json(await detail(id))).rating).toBe(7);
    await logWatch(ctx, token, movie({ watchedOn: '2026-09-02', rating: 8 }));
    expect((await json(await detail(id))).rating).toBe(8);
  });

  it('is null when no entry has a rating', async () => {
    const { body } = await logWatch(ctx, token, movie());
    expect((await json(await detail(body.item.id))).rating).toBeNull();
  });
});

describe('PATCH /api/v1/watches/:id', () => {
  it('updates a rating and reflects it on the item', async () => {
    const { body } = await logWatch(ctx, token, movie({ rating: 6 }));
    const res = await patch(body.entry.id, { rating: 9 });
    expect(res.status).toBe(200);
    expect((await json(res)).entry.rating).toBe(9);
    expect((await json(await detail(body.item.id))).rating).toBe(9);
  });

  it('clears a note and rating with null', async () => {
    const { body } = await logWatch(ctx, token, movie({ rating: 6, note: 'great' }));
    const res = await patch(body.entry.id, { note: null, rating: null });
    const updated = (await json(res)).entry;
    expect(updated.note).toBeNull();
    expect(updated.rating).toBeNull();
  });

  it('validates like logging', async () => {
    const { body } = await logWatch(ctx, token, movie());
    expect((await patch(body.entry.id, { rating: 11 })).status).toBe(400);
    expect((await patch(body.entry.id, { season: 1 })).status).toBe(400);
    expect((await patch(body.entry.id, {})).status).toBe(400);
    const tv = await logWatch(ctx, token, show());
    expect((await patch(tv.body.entry.id, { season: 1 })).status).toBe(200);
  });

  it('returns 404 for unknown entries', async () => {
    expect((await patch('00000000-0000-0000-0000-000000000000', { rating: 5 })).status).toBe(404);
    expect((await patch('not-a-uuid', { rating: 5 })).status).toBe(404);
  });
});

describe('DELETE /api/v1/watches/:id', () => {
  it('keeps the item when other entries remain', async () => {
    const a = await logWatch(ctx, token, movie({ watchedOn: '2026-08-01' }));
    const b = await logWatch(ctx, token, movie({ watchedOn: '2026-09-01' }));
    expect((await del(b.body.entry.id)).status).toBe(204);
    const d = await json(await detail(a.body.item.id));
    expect(d.watchCount).toBe(1);
  });

  it('removes the item with its last entry', async () => {
    const { body } = await logWatch(ctx, token, movie());
    expect((await del(body.entry.id)).status).toBe(204);
    expect((await detail(body.item.id)).status).toBe(404);
    expect((await json(await list())).items).toEqual([]);
  });

  it('returns 404 for unknown entries', async () => {
    expect((await del('00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });
});

describe('GET /api/v1/library', () => {
  async function seed() {
    await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 841,
      watchedOn: '2026-07-01',
      rating: 6,
    }); // Dune 1984
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 550, watchedOn: '2026-08-15' }); // Fight Club, unrated
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: 95396,
      watchedOn: '2026-08-20',
      rating: 10,
      season: 1,
    }); // Severance
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: 95396,
      watchedOn: '2026-09-03',
      rating: 9,
      season: 2,
    });
    await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 438631,
      watchedOn: '2026-09-01',
      rating: 8,
    }); // Dune 2021
  }

  it('lists most recently watched first with summary fields', async () => {
    await seed();
    const body = await json(await list());
    expect(body.items.map((i: any) => i.title)).toEqual([
      'Severance',
      'Dune',
      'Fight Club',
      'Dune',
    ]);
    expect(body.items[0]).toMatchObject({
      rating: 9,
      lastWatchedOn: '2026-09-03',
      watchCount: 2,
      lastSeason: 2,
      mediaType: 'tv',
    });
    expect(body.items[1]).toMatchObject({
      releaseYear: 2021,
      rating: 8,
      watchCount: 1,
      lastSeason: null,
    });
    expect(body.nextCursor).toBeNull();
  });

  it('filters by type', async () => {
    await seed();
    const body = await json(await list('type=tv'));
    expect(body.items).toHaveLength(1);
    expect(body.items[0].mediaType).toBe('tv');
  });

  it('sorts by rating with unrated last, and by title', async () => {
    await seed();
    const byRating = await json(await list('sort=rating'));
    expect(byRating.items.map((i: any) => i.rating)).toEqual([9, 8, 6, null]);
    const byTitle = await json(await list('sort=title'));
    expect(byTitle.items.map((i: any) => i.title)).toEqual([
      'Dune',
      'Dune',
      'Fight Club',
      'Severance',
    ]);
  });

  it('paginates with a cursor without gaps or duplicates', async () => {
    await seed();
    const page1 = await json(await list('limit=3'));
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBeTypeOf('string');
    const page2 = await json(await list(`limit=3&cursor=${encodeURIComponent(page1.nextCursor)}`));
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    const ids = [...page1.items, ...page2.items].map((i: any) => i.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('rejects invalid query values', async () => {
    expect((await list('limit=0')).status).toBe(400);
    expect((await list('limit=101')).status).toBe(400);
    expect((await list('sort=bogus')).status).toBe(400);
    expect((await list('type=book')).status).toBe(400);
  });
});

describe('GET /api/v1/library/:id', () => {
  it('returns the item with its ordered history', async () => {
    const a = await logWatch(ctx, token, show({ watchedOn: '2026-08-01', season: 1, rating: 10 }));
    await logWatch(
      ctx,
      token,
      show({ watchedOn: '2026-09-01', season: 2, rating: 9, note: 'wow' }),
    );
    const body = await json(await detail(a.body.item.id));
    expect(body.item.title).toBe('Severance');
    expect(body.rating).toBe(9);
    expect(body.watchCount).toBe(2);
    expect(body.entries.map((e: any) => e.season)).toEqual([2, 1]);
    expect(body.entries[0].note).toBe('wow');
  });

  it('returns 404 for unknown items', async () => {
    expect((await detail('00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await detail('nope')).status).toBe(404);
  });
});
