import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { episodeWatches, mediaItems, watchEntries } from '../src/db/schema.js';
import { createTestContext, json, logWatch, type TestContext } from './helpers.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await createTestContext({ refresh: { budgetMs: 5000 } });
  token = await ctx.login();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.db.delete(episodeWatches);
  await ctx.db.db.delete(watchEntries);
  await ctx.db.db.delete(mediaItems);
  ctx.provider.calls = [];
  ctx.provider.unavailable = false;
  ctx.clock.current = new Date('2026-09-10T12:00:00.000Z');
});

const SEVERANCE = 95396;
const PROPHECY = 90228;
const list = () => ctx.request('/api/v1/library', { token });
const releases = () => ctx.request('/api/v1/library/releases', { token });
const markEpisodes = (
  tmdbId: number,
  episodes: { seasonNumber: number; episodeNumber: number }[],
) =>
  ctx.request('/api/v1/watches/episodes', {
    method: 'PUT',
    token,
    json: { tmdbId, episodes, watched: true, watchedOn: '2026-09-01' },
  });

describe('title enrichment', () => {
  it('returns cast, crew, companies and status for a movie', async () => {
    const res = await ctx.request('/api/v1/titles/movie/438631', { token });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe('Released');
    expect(body.cast[0]).toEqual({
      tmdbId: 1190668,
      name: 'Timothée Chalamet',
      role: 'Paul Atreides',
      profileUrl: 'https://image.tmdb.org/t/p/w185/tc.jpg',
      tmdbUrl: 'https://www.themoviedb.org/person/1190668',
    });
    expect(body.cast[1].profileUrl).toBeNull();
    expect(body.crew).toEqual([
      expect.objectContaining({ name: 'Denis Villeneuve', role: 'Director, Screenplay' }),
    ]);
    expect(body.productionCompanies).toEqual([
      {
        tmdbId: 923,
        name: 'Legendary Pictures',
        logoUrl: 'https://image.tmdb.org/t/p/w185/leg.png',
      },
    ]);
    expect(body.networks).toEqual([]);
    expect(body.lastEpisodeToAir).toBeNull();
  });

  it('returns broadcast information for a series', async () => {
    const body = await json(await ctx.request(`/api/v1/titles/tv/${SEVERANCE}`, { token }));
    expect(body.status).toBe('Returning Series');
    expect(body.networks).toEqual([expect.objectContaining({ name: 'Apple TV+' })]);
    expect(body.crew).toEqual([expect.objectContaining({ name: 'Dan Erickson', role: 'Creator' })]);
    expect(body.lastEpisodeToAir).toEqual({
      seasonNumber: 2,
      episodeNumber: 9,
      name: 'The After Hours',
      airDate: '2026-09-05',
    });
    expect(body.nextEpisodeToAir.airDate).toBe('2999-01-01');
  });

  it('tolerates titles without enrichment', async () => {
    const body = await json(await ctx.request('/api/v1/titles/movie/550', { token }));
    expect(body.status).toBeNull();
    expect(body.cast).toEqual([]);
    expect(body.crew).toEqual([]);
  });

  it('stores status and episodes on the library snapshot', async () => {
    const { body } = await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-08-01',
    });
    const detail = await json(await ctx.request(`/api/v1/library/${body.item.id}`, { token }));
    expect(detail.item.status).toBe('Returning Series');
    expect(detail.item.lastEpisodeToAir.episodeNumber).toBe(9);
    expect(detail.item.nextEpisodeToAir.name).toBe('Cold Harbor');
  });
});

describe('release alerts', () => {
  it('flags a recently aired episode the owner has not watched', async () => {
    await markEpisodes(SEVERANCE, [{ seasonNumber: 2, episodeNumber: 8 }]);
    const body = await json(await list());
    expect(body.items[0].release).toEqual({
      kind: 'new_episode',
      episode: {
        seasonNumber: 2,
        episodeNumber: 9,
        name: 'The After Hours',
        airDate: '2026-09-05',
      },
    });
  });

  it('clears the alert once the episode is ticked', async () => {
    await markEpisodes(SEVERANCE, [
      { seasonNumber: 2, episodeNumber: 8 },
      { seasonNumber: 2, episodeNumber: 9 },
    ]);
    const body = await json(await list());
    expect(body.items[0].release).toBeNull();
  });

  it('treats a season log dated after the air date as watched', async () => {
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-06',
      season: 2,
    });
    expect((await json(await list())).items[0].release).toBeNull();
    // A log for another season, before the air date, does not count.
    await ctx.db.db.delete(watchEntries);
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-01',
      season: 1,
    });
    expect((await json(await list())).items[0].release?.kind).toBe('new_episode');
  });

  it('ignores episodes that aired more than 30 days ago', async () => {
    await markEpisodes(SEVERANCE, [{ seasonNumber: 2, episodeNumber: 8 }]);
    // 33 days after the air date, still inside the 30-day session.
    ctx.clock.current = new Date('2026-10-08T12:00:00.000Z');
    expect((await json(await list())).items[0].release).toBeNull();
  });

  it('reports an upcoming episode for a caught-up series', async () => {
    await logWatch(ctx, token, { mediaType: 'tv', tmdbId: PROPHECY, watchedOn: '2026-09-01' });
    const body = await json(await list());
    expect(body.items[0].release).toEqual({
      kind: 'upcoming',
      episode: { seasonNumber: 2, episodeNumber: 1, name: 'Chapter One', airDate: '2026-09-18' },
    });
  });

  it('movies never carry an alert', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 438631, watchedOn: '2026-09-01' });
    expect((await json(await list())).items[0].release).toBeNull();
  });

  it('lists releases with new episodes before upcoming ones', async () => {
    await logWatch(ctx, token, { mediaType: 'tv', tmdbId: PROPHECY, watchedOn: '2026-09-01' });
    await markEpisodes(SEVERANCE, [{ seasonNumber: 2, episodeNumber: 8 }]);
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 438631, watchedOn: '2026-09-09' });
    const body = await json(await releases());
    expect(body.items.map((i: { tmdbId: number }) => i.tmdbId)).toEqual([SEVERANCE, PROPHECY]);
    expect(body.items[0].release.kind).toBe('new_episode');
    expect(body.items[1].release.kind).toBe('upcoming');
  });

  it('returns an empty list when nothing is new', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 438631, watchedOn: '2026-09-09' });
    expect((await json(await releases())).items).toEqual([]);
  });
});

describe('series progress in summaries', () => {
  it('says how many aired episodes are left and which is next', async () => {
    // Severance: S1 has 9, S2 has 10 listed of which 9 aired. Ticked S1 fully and S2 E1-E7.
    await markEpisodes(SEVERANCE, [
      ...Array.from({ length: 9 }, (_, i) => ({ seasonNumber: 1, episodeNumber: i + 1 })),
      ...Array.from({ length: 7 }, (_, i) => ({ seasonNumber: 2, episodeNumber: i + 1 })),
    ]);
    const body = await json(await list());
    expect(body.items[0].progress).toEqual({
      status: 'behind',
      aired: 18,
      total: 19,
      behind: 2,
      exact: true,
      nextUp: { seasonNumber: 2, episodeNumber: 8 },
    });
    expect(body.items[0].muted).toBe(false);
  });

  it('is up to date once every aired episode is seen, and counts logs as watched', async () => {
    await logWatch(ctx, token, { mediaType: 'tv', tmdbId: SEVERANCE, watchedOn: '2026-09-06' });
    const body = await json(await list());
    expect(body.items[0].progress).toMatchObject({ status: 'up_to_date', behind: 0, nextUp: null });
  });

  it('is null for movies', async () => {
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 438631, watchedOn: '2026-09-01' });
    expect((await json(await list())).items[0].progress).toBeNull();
  });
});

describe('muting a series', () => {
  const mute = (id: string, muted: boolean) =>
    ctx.request(`/api/v1/library/${id}`, { method: 'PATCH', token, json: { muted } });

  it('hides the series from alerts and the releases shelf until it is followed again', async () => {
    const { body } = await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-01',
      season: 1,
    });
    expect((await json(await list())).items[0].release?.kind).toBe('new_episode');

    const res = await mute(body.item.id, true);
    expect(res.status).toBe(200);
    const detail = await json(res);
    expect(detail.muted).toBe(true);
    const listed = (await json(await list())).items[0];
    expect(listed.muted).toBe(true);
    expect(listed.release).toBeNull();
    // Progress is still reported: the owner may come back to it.
    expect(listed.progress.status).toBe('behind');
    expect((await json(await releases())).items).toEqual([]);

    await mute(body.item.id, false);
    expect((await json(await list())).items[0]).toMatchObject({ muted: false });
    expect((await json(await list())).items[0].release?.kind).toBe('new_episode');
  });

  it('rejects muting a movie and unknown ids', async () => {
    const { body } = await logWatch(ctx, token, {
      mediaType: 'movie',
      tmdbId: 438631,
      watchedOn: '2026-09-01',
    });
    expect((await mute(body.item.id, true)).status).toBe(400);
    expect((await mute('00000000-0000-0000-0000-000000000000', true)).status).toBe(404);
    expect((await mute(body.item.id, 'yes' as unknown as boolean)).status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await ctx.request('/api/v1/library/releases')).status).toBe(401);
  });
});

describe('snapshot refresh', () => {
  it('refreshes running series older than six hours when the library is opened', async () => {
    await logWatch(ctx, token, { mediaType: 'tv', tmdbId: SEVERANCE, watchedOn: '2026-09-01' });
    ctx.provider.calls = [];
    await list();
    expect(ctx.provider.calls).not.toContain(`tvDetails:${SEVERANCE}`);
    ctx.clock.advance(7 * 60 * 60 * 1000);
    await list();
    expect(ctx.provider.calls).toContain(`tvDetails:${SEVERANCE}`);
    // Refreshed: not called again right away.
    ctx.provider.calls = [];
    await list();
    expect(ctx.provider.calls).not.toContain(`tvDetails:${SEVERANCE}`);
  });

  it('leaves ended series and movies alone', async () => {
    await logWatch(ctx, token, { mediaType: 'tv', tmdbId: SEVERANCE, watchedOn: '2026-09-01' });
    await logWatch(ctx, token, { mediaType: 'movie', tmdbId: 438631, watchedOn: '2026-09-01' });
    await ctx.db.db.update(mediaItems).set({ status: 'Ended' });
    ctx.clock.advance(48 * 60 * 60 * 1000);
    ctx.provider.calls = [];
    await list();
    expect(ctx.provider.calls).toEqual([]);
  });

  it('serves stored snapshots when the provider is down', async () => {
    await logWatch(ctx, token, { mediaType: 'tv', tmdbId: SEVERANCE, watchedOn: '2026-09-01' });
    ctx.clock.advance(7 * 60 * 60 * 1000);
    ctx.provider.unavailable = true;
    const res = await list();
    expect(res.status).toBe(200);
    expect((await json(res)).items[0].title).toBe('Severance');
  });

  it('refreshes stale rows lacking a refresh timestamp (pre-migration items)', async () => {
    await logWatch(ctx, token, { mediaType: 'tv', tmdbId: SEVERANCE, watchedOn: '2026-09-01' });
    await ctx.db.db.update(mediaItems).set({ metadataRefreshedAt: null, status: null });
    ctx.provider.calls = [];
    await releases();
    expect(ctx.provider.calls).toContain(`tvDetails:${SEVERANCE}`);
  });
});
