import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  episodeWatches,
  mediaItems,
  playSessions,
  steamGames,
  watchEntries,
} from '../src/db/schema.js';
import { SteamClient, type SteamOwnedGame } from '../src/services/steam.js';
import { createTestContext, json, STEAM_ID_FOR_TESTS, type TestContext } from './helpers.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await createTestContext();
  token = await ctx.login();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.db.delete(playSessions);
  await ctx.db.db.delete(steamGames);
  await ctx.db.db.delete(episodeWatches);
  await ctx.db.db.delete(watchEntries);
  await ctx.db.db.delete(mediaItems);
  ctx.steam.games = [];
  ctx.steam.unavailable = false;
  ctx.provider.calls = [];
  ctx.clock.current = new Date('2026-09-23T12:00:00.000Z');
});

const HADES_APP = 1145360;
const ELDEN_APP = 1245620;
const UNKNOWN_APP = 999999;

const game = (
  appId: number,
  name: string,
  total: number,
  recent: number,
  lastPlayed: string | null,
): SteamOwnedGame => ({
  appId,
  name,
  iconHash: 'abc',
  minutesTotal: total,
  minutesRecent: recent,
  lastPlayedAt: lastPlayed ? new Date(lastPlayed) : null,
});

const sync = () => ctx.request('/api/v1/steam/sync', { method: 'POST', token });
const status = () => ctx.request('/api/v1/steam/status', { token });
const list = (qs = '') => ctx.request(`/api/v1/library${qs}`, { token });

describe('Steam sync', () => {
  it('reports status before anything has synced', async () => {
    const body = await json(await status());
    expect(body).toMatchObject({
      enabled: true,
      steamId: STEAM_ID_FOR_TESTS,
      personaName: 'diogo',
      gamesPlayed: 0,
      gamesLinked: 0,
      lastSyncAt: null,
    });
  });

  it('records every played game with its total on the first run, linking titles through IGDB', async () => {
    ctx.steam.games = [
      game(HADES_APP, 'Hades', 3000, 120, '2026-09-20T20:00:00.000Z'),
      game(ELDEN_APP, 'ELDEN RING', 9000, 0, '2026-01-05T20:00:00.000Z'),
      game(UNKNOWN_APP, 'Some Mod', 45, 45, '2026-09-22T20:00:00.000Z'),
      game(12345, 'Never played', 0, 0, null),
    ];
    const body = await json(await sync());
    expect(body).toEqual({ games: 4, sessions: 2, linked: 2, unmatched: 1 });

    const library = await json(await list('?type=game'));
    expect(library.items.map((i: any) => i.title)).toEqual(['Hades', 'Elden Ring']);
    expect(library.items[0]).toMatchObject({ minutesPlayed: 3000, lastWatchedOn: '2026-09-20' });
    expect(library.items[1]).toMatchObject({ minutesPlayed: 9000, lastWatchedOn: '2026-01-05' });

    const detail = await json(
      await ctx.request(`/api/v1/library/${library.items[0].id}`, { token }),
    );
    expect(detail.plays).toEqual([
      expect.objectContaining({ source: 'steam', playedOn: '2026-09-20', minutes: 3000 }),
    ]);
    expect(detail.steam).toEqual({
      appId: HADES_APP,
      minutesTotal: 3000,
      minutesRecent: 120,
      lastPlayedAt: '2026-09-20T20:00:00.000Z',
      storeUrl: `https://store.steampowered.com/app/${HADES_APP}`,
    });
    expect(await json(await status())).toMatchObject({
      gamesPlayed: 3,
      gamesLinked: 2,
      historyImported: true,
    });
    // The unknown app was looked up once and will not be looked up every hour.
    expect(ctx.provider.calls.filter((c) => c.startsWith('gamesBySteamAppIds'))).toHaveLength(3);
    ctx.provider.calls = [];
    await sync();
    expect(ctx.provider.calls.filter((c) => c.startsWith('gamesBySteamAppIds'))).toHaveLength(0);
  });

  it('turns growth between syncs into a session dated today, merging same-day sessions', async () => {
    ctx.steam.games = [game(HADES_APP, 'Hades', 3000, 120, '2026-09-20T20:00:00.000Z')];
    await sync();
    ctx.steam.games = [game(HADES_APP, 'Hades', 3090, 210, '2026-09-23T11:00:00.000Z')];
    expect(await json(await sync())).toMatchObject({ sessions: 1, linked: 0 });
    ctx.steam.games = [game(HADES_APP, 'Hades', 3100, 220, '2026-09-23T11:50:00.000Z')];
    await sync();
    // No growth: nothing recorded.
    expect(await json(await sync())).toMatchObject({ sessions: 0 });

    const item = (await json(await list())).items[0];
    const detail = await json(await ctx.request(`/api/v1/library/${item.id}`, { token }));
    expect(detail.plays.map((p: any) => [p.playedOn, p.minutes])).toEqual([
      ['2026-09-23', 100],
      ['2026-09-20', 3000],
    ]);
    expect(item.minutesPlayed).toBe(3100);
  });

  it('imports history for games IGDB learns about later, once', async () => {
    ctx.steam.games = [
      game(HADES_APP, 'Hades', 3000, 120, '2026-09-20T20:00:00.000Z'),
      game(UNKNOWN_APP, 'Late Arrival', 600, 0, '2026-03-01T20:00:00.000Z'),
    ];
    await sync();
    expect(await json(await status())).toMatchObject({ gamesPlayed: 2, gamesLinked: 1 });

    // IGDB now knows the app: the import asks again and records the whole total.
    const original = ctx.provider.gamesBySteamAppIds.bind(ctx.provider);
    ctx.provider.gamesBySteamAppIds = async (ids) =>
      new Map(ids.map((id) => [id, id === UNKNOWN_APP ? 119133 : 113112]));
    try {
      const first = await json(
        await ctx.request('/api/v1/steam/import', { method: 'POST', token }),
      );
      expect(first).toMatchObject({ sessions: 1, linked: 1 });
      const again = await json(
        await ctx.request('/api/v1/steam/import', { method: 'POST', token }),
      );
      expect(again.sessions).toBe(0);
    } finally {
      ctx.provider.gamesBySteamAppIds = original;
    }

    const library = await json(await list('?type=game&sort=title'));
    expect(library.items.map((i: any) => [i.title, i.minutesPlayed, i.lastWatchedOn])).toEqual([
      ['Elden Ring', 600, '2026-03-01'],
      ['Hades', 3000, '2026-09-20'],
    ]);
    expect(await json(await status())).toMatchObject({ gamesLinked: 2, historyImported: true });

    // Play time shows in the public feed like any other activity.
    const feed = await json(await ctx.request('/api/v1/public/recent?type=game'));
    expect(feed.items.map((i: any) => i.title)).toEqual(['Hades', 'Elden Ring']);
  });

  it('files history with no last-played date under the day Steam started counting', async () => {
    ctx.steam.games = [game(HADES_APP, 'Hades', 111, 0, null)];
    await sync();
    const item = (await json(await list())).items[0];
    expect(item.lastWatchedOn).toBe('2009-01-01');
    const detail = await json(await ctx.request(`/api/v1/library/${item.id}`, { token }));
    expect(detail.steam.lastPlayedAt).toBeNull();
  });

  it('keeps a title in the library while it only has play sessions', async () => {
    ctx.steam.games = [game(HADES_APP, 'Hades', 3000, 120, '2026-09-20T20:00:00.000Z')];
    await sync();
    const item = (await json(await list())).items[0];
    const res = await ctx.request('/api/v1/watches', {
      method: 'POST',
      token,
      json: { mediaType: 'game', tmdbId: 113112, watchedOn: '2026-09-21', rating: 9 },
    });
    const { entry } = await json(res);
    await ctx.request(`/api/v1/watches/${entry.id}`, { method: 'DELETE', token });
    expect((await ctx.request(`/api/v1/library/${item.id}`, { token })).status).toBe(200);
  });

  it('maps a Steam outage to 502 and leaves the snapshot alone', async () => {
    ctx.steam.unavailable = true;
    expect((await sync()).status).toBe(502);
    const body = await json(await status());
    expect(body.personaName).toBeNull();
    expect(body.enabled).toBe(true);
  });

  it('answers as disabled without a Steam account', async () => {
    const off = await createTestContext({ steam: false });
    try {
      const t = await off.login();
      expect(await json(await off.request('/api/v1/steam/status', { token: t }))).toMatchObject({
        enabled: false,
      });
      expect((await off.request('/api/v1/steam/sync', { method: 'POST', token: t })).status).toBe(
        503,
      );
      const session = await json(await off.request('/api/v1/auth/session', { token: t }));
      expect(session.features.steam).toBe(false);
    } finally {
      await off.close();
    }
  });
});

describe('SteamClient', () => {
  it('maps GetOwnedGames and GetPlayerSummaries', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('GetOwnedGames'))
        return Response.json({
          response: {
            game_count: 2,
            games: [
              {
                appid: 1145360,
                name: 'Hades',
                img_icon_url: 'h',
                playtime_forever: 3000,
                playtime_2weeks: 120,
                rtime_last_played: 1758398400,
              },
              { appid: 10, playtime_forever: 0 },
            ],
          },
        });
      return Response.json({
        response: {
          players: [
            {
              steamid: STEAM_ID_FOR_TESTS,
              personaname: 'diogo',
              gameid: '1145360',
              gameextrainfo: 'Hades',
            },
          ],
        },
      });
    };
    const client = new SteamClient({ apiKey: 'k', fetchImpl });
    const games = await client.ownedGames(STEAM_ID_FOR_TESTS);
    expect(games).toEqual([
      {
        appId: 1145360,
        name: 'Hades',
        iconHash: 'h',
        minutesTotal: 3000,
        minutesRecent: 120,
        lastPlayedAt: new Date(1758398400 * 1000),
      },
      {
        appId: 10,
        name: 'App 10',
        iconHash: null,
        minutesTotal: 0,
        minutesRecent: 0,
        lastPlayedAt: null,
      },
    ]);
    expect(await client.playerSummary(STEAM_ID_FOR_TESTS)).toEqual({
      personaName: 'diogo',
      nowPlaying: { appId: 1145360, name: 'Hades' },
    });
    expect(calls[0]).toContain('key=k');
    expect(calls[0]).toContain('include_appinfo=1');
    expect(calls[0]).toContain(`steamid=${STEAM_ID_FOR_TESTS}`);
  });

  it('treats a last-played date before Steam tracked play time as unknown', async () => {
    const client = new SteamClient({
      apiKey: 'k',
      fetchImpl: async () =>
        Response.json({
          response: {
            games: [
              { appid: 30, name: 'Day of Defeat', playtime_forever: 111, rtime_last_played: 86400 },
            ],
          },
        }),
    });
    const [game] = await client.ownedGames(STEAM_ID_FOR_TESTS);
    expect(game?.lastPlayedAt).toBeNull();
  });

  it('treats a private profile as an empty library and bad keys as unavailable', async () => {
    const empty = new SteamClient({
      apiKey: 'k',
      fetchImpl: async () => Response.json({ response: {} }),
    });
    expect(await empty.ownedGames(STEAM_ID_FOR_TESTS)).toEqual([]);
    const bad = new SteamClient({
      apiKey: 'k',
      fetchImpl: async () => new Response('', { status: 403 }),
    });
    await expect(bad.ownedGames(STEAM_ID_FOR_TESTS)).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
