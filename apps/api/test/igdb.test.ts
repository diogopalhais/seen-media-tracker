import { describe, expect, it } from 'vitest';
import { IgdbProvider } from '../src/services/metadata/igdb.js';
import { ProviderError } from '../src/services/metadata/provider.js';

interface Call {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: string | undefined;
}

/** Fake Twitch + IGDB: records calls and answers from a script keyed by endpoint. */
function fakeFetch(
  answers: Record<string, (call: Call, n: number) => { status?: number; body?: unknown }>,
) {
  const calls: Call[] = [];
  const counts = new Map<string, number>();
  const impl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    const call: Call = { url, method: init?.method, headers, body: init?.body as string };
    calls.push(call);
    const key = url.includes('id.twitch.tv') ? 'token' : (url.split('/v4/')[1] ?? url);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    const handler = answers[key];
    if (!handler) return new Response('not scripted', { status: 500 });
    const { status = 200, body = [] } = handler(call, n);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { impl, calls };
}

const HADES = {
  id: 113112,
  name: 'Hades',
  slug: 'hades--1',
  url: 'https://www.igdb.com/games/hades--1',
  summary: 'Defy the god of the dead.',
  first_release_date: 1600300800, // 2020-09-17
  cover: { image_id: 'co2i2c' },
  total_rating: 92.4,
  total_rating_count: 1500,
  screenshots: [{ id: 1, image_id: 'sc7wq1' }],
  genres: [{ id: 12, name: 'Role-playing (RPG)' }],
  platforms: [
    { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
    {
      id: 130,
      name: 'Nintendo Switch',
      abbreviation: 'Switch',
      platform_logo: { image_id: 'pl6f' },
    },
  ],
  involved_companies: [
    { company: { id: 1000, name: 'Supergiant Games' }, developer: true, publisher: true },
    { company: { id: 1001, name: 'Private Division' }, developer: false, publisher: true },
  ],
  status: 0,
};

const token = (expiresIn = 5000) => ({
  body: { access_token: `tok-${expiresIn}`, expires_in: expiresIn, token_type: 'bearer' },
});

describe('IgdbProvider', () => {
  it('fetches a Twitch token once, sends it with the client id, and maps a game', async () => {
    const { impl, calls } = fakeFetch({
      token: () => token(),
      games: () => ({ body: [HADES] }),
    });
    const provider = new IgdbProvider({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl });

    const details = await provider.gameDetails(113112);
    expect(details).toMatchObject({
      mediaType: 'game',
      tmdbId: 113112,
      externalUrl: 'https://www.igdb.com/games/hades--1',
      title: 'Hades',
      releaseDate: '2020-09-17',
      posterPath: 'co2i2c',
      backdropPath: 'sc7wq1',
      voteAverage: 9.2,
      voteCount: 1500,
      status: 'Released',
      genres: [{ id: 12, name: 'Role-playing (RPG)' }],
      seasons: null,
      runtimeMinutes: null,
    });
    expect(details.platforms.map((p) => p.name)).toEqual(['PC', 'Switch']);
    expect(details.platforms[1]?.logoPath).toBe('pl6f');
    expect(details.developers.map((c) => c.name)).toEqual(['Supergiant Games']);
    expect(details.publishers.map((c) => c.name)).toEqual(['Supergiant Games', 'Private Division']);

    await provider.searchGames('hades', 1);
    const tokenCalls = calls.filter((c) => c.url.includes('id.twitch.tv'));
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0]?.method).toBe('POST');
    expect(tokenCalls[0]?.url).toContain('grant_type=client_credentials');
    const igdb = calls.filter((c) => c.url.includes('api.igdb.com'));
    expect(igdb).toHaveLength(2);
    expect(igdb[0]?.headers).toMatchObject({
      'client-id': 'cid',
      authorization: 'Bearer tok-5000',
    });
    expect(igdb[0]?.body).toContain('where id = 113112');
    expect(igdb[1]?.body).toContain('search "hades"');
    expect(igdb[1]?.body).toContain('limit 20; offset 0;');
  });

  it('escapes quotes in search text and reports another page only when the page is full', async () => {
    const { impl, calls } = fakeFetch({
      token: () => token(),
      games: (_c, n) => ({ body: n === 1 ? Array.from({ length: 20 }, () => HADES) : [HADES] }),
    });
    const provider = new IgdbProvider({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl });
    const full = await provider.searchGames('say "hi"', 1);
    expect(full.totalPages).toBe(2);
    expect(calls.at(-1)?.body).toContain('search "say \\"hi\\""');
    const last = await provider.searchGames('hades', 2);
    expect(last.totalPages).toBe(2);
    expect(last.results[0]?.mediaType).toBe('game');
  });

  it('refreshes the token once when IGDB rejects it', async () => {
    const { impl, calls } = fakeFetch({
      token: (_c, n) => token(n === 1 ? 100 : 200),
      games: (call) =>
        call.headers.authorization === 'Bearer tok-200' ? { body: [HADES] } : { status: 401 },
    });
    const provider = new IgdbProvider({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl });
    const details = await provider.gameDetails(113112);
    expect(details.title).toBe('Hades');
    expect(calls.filter((c) => c.url.includes('id.twitch.tv'))).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes('api.igdb.com'))).toHaveLength(2);
  });

  it('turns an empty details answer into not_found and other failures into unavailable', async () => {
    const { impl } = fakeFetch({
      token: () => token(),
      games: (_c, n) => (n === 1 ? { body: [] } : { status: 429 }),
    });
    const provider = new IgdbProvider({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl });
    await expect(provider.gameDetails(1)).rejects.toMatchObject({ kind: 'not_found' });
    await expect(provider.gameDetails(2)).rejects.toMatchObject({ kind: 'unavailable' });
    const dead = new IgdbProvider({
      clientId: 'cid',
      clientSecret: 'bad',
      fetchImpl: fakeFetch({ token: () => ({ status: 403, body: { message: 'invalid client' } }) })
        .impl,
    });
    await expect(dead.searchGames('x', 1)).rejects.toBeInstanceOf(ProviderError);
  });

  it('orders trending games by how many people are playing and keeps that rank as popularity', async () => {
    const { impl, calls } = fakeFetch({
      token: () => token(),
      popularity_primitives: () => ({
        body: [
          { game_id: 2, value: 900 },
          { game_id: 1, value: 300 },
        ],
      }),
      games: () => ({
        body: [
          { ...HADES, id: 1, name: 'A' },
          { ...HADES, id: 2, name: 'B' },
        ],
      }),
    });
    const provider = new IgdbProvider({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl });
    const trending = await provider.trendingGames();
    expect(trending.map((g) => [g.title, g.popularity])).toEqual([
      ['B', 900],
      ['A', 300],
    ]);
    expect(calls.find((c) => c.url.endsWith('/popularity_primitives'))?.body).toContain(
      'popularity_type = 3',
    );
    expect(calls.at(-1)?.body).toContain('where id = (2,1)');
  });
});
