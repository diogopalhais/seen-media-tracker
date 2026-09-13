import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { episodeWatches, mediaItems, watchEntries } from '../src/db/schema.js';
import { createTestContext, json, type TestContext } from './helpers.js';

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

const post = (records: unknown[]) =>
  ctx.request('/api/v1/import/trakt', { method: 'POST', token, json: { records } });
const movie = (watchedOn: string) => ({
  kind: 'movie_play',
  title: 'Fight Club',
  year: 1999,
  tmdbId: 550,
  watchedOn,
});
const ep = (s: number, e: number, watchedOn: string) => ({
  kind: 'episode_play',
  title: 'Severance',
  year: 2022,
  tmdbId: 95396,
  seasonNumber: s,
  episodeNumber: e,
  watchedOn,
});

describe('POST /api/v1/import/trakt', () => {
  it('requires authentication and validates the batch', async () => {
    expect(
      (
        await ctx.request('/api/v1/import/trakt', {
          method: 'POST',
          json: { records: [movie('2026-01-01')] },
        })
      ).status,
    ).toBe(401);
    expect((await post([])).status).toBe(400);
    expect((await post(Array.from({ length: 201 }, () => movie('2026-01-01')))).status).toBe(400);
    expect((await post([{ kind: 'bogus' }])).status).toBe(400);
  });

  it('imports movie plays as entries and is idempotent', async () => {
    const first = await json(await post([movie('2026-01-01'), movie('2026-02-01')]));
    expect(first).toMatchObject({
      created: { items: 1, entries: 2, episodeWatches: 0, ratings: 0 },
      duplicates: 0,
      failures: [],
    });
    const second = await json(await post([movie('2026-01-01'), movie('2026-02-01')]));
    expect(second).toMatchObject({ created: { items: 0, entries: 0 }, duplicates: 2 });
    const list = await json(await ctx.request('/api/v1/library', { token }));
    expect(list.items).toHaveLength(1);
    expect(list.items[0].watchCount).toBe(2);
  });

  it('imports episode plays as episode watches and creates the series without an entry', async () => {
    const res = await json(
      await post([ep(1, 1, '2026-03-01'), ep(1, 2, '2026-03-02'), ep(1, 1, '2026-03-01')]),
    );
    expect(res).toMatchObject({
      created: { items: 1, entries: 0, episodeWatches: 2 },
      duplicates: 1,
    });
    const list = await json(await ctx.request('/api/v1/library', { token }));
    expect(list.items[0]).toMatchObject({ title: 'Severance', watchCount: 0, episodesWatched: 2 });
  });

  it('applies ratings: creates an entry when none exists, fills unrated entries, never overwrites', async () => {
    const r1 = await json(
      await post([
        {
          kind: 'movie_rating',
          title: 'Fight Club',
          year: 1999,
          tmdbId: 550,
          rating: 8,
          ratedOn: '2026-04-01',
        },
      ]),
    );
    expect(r1).toMatchObject({ created: { items: 1, entries: 1, ratings: 1 } });
    // Show rating on a series with an unrated series-level entry from a play → fills it.
    await post([
      {
        kind: 'show_rating',
        title: 'Severance',
        year: 2022,
        tmdbId: 95396,
        rating: 9,
        ratedOn: '2026-04-02',
      },
    ]);
    const again = await json(
      await post([
        {
          kind: 'show_rating',
          title: 'Severance',
          year: 2022,
          tmdbId: 95396,
          rating: 5,
          ratedOn: '2026-04-03',
        },
      ]),
    );
    expect(again).toMatchObject({ created: { ratings: 0 }, duplicates: 1 });
    const season = await json(
      await post([
        {
          kind: 'season_rating',
          title: 'Severance',
          year: 2022,
          tmdbId: 95396,
          seasonNumber: 1,
          rating: 10,
          ratedOn: '2026-04-04',
        },
      ]),
    );
    expect(season).toMatchObject({ created: { entries: 1, ratings: 1 } });
    const list = await json(await ctx.request('/api/v1/library', { token }));
    const sev = list.items.find((i: any) => i.title === 'Severance');
    expect(sev.rating).toBe(10); // latest rated entry (the season one, dated later) is displayed
    const detail = await json(await ctx.request(`/api/v1/library/${sev.id}`, { token }));
    expect(detail.entries.map((e: any) => [e.season, e.rating])).toEqual([
      [1, 10],
      [null, 9],
    ]);
  });

  it('reports unknown TMDB ids as failures without aborting the batch', async () => {
    const res = await json(
      await post([
        {
          kind: 'movie_play',
          title: 'Ghost Film',
          year: 2001,
          tmdbId: 99999999,
          watchedOn: '2026-05-01',
        },
        movie('2026-05-02'),
      ]),
    );
    expect(res.failures).toEqual([{ title: 'Ghost Film', reason: 'TMDB id 99999999 not found' }]);
    expect(res.created.entries).toBe(1);
  });
});
