import { hash } from '@node-rs/argon2';
import type { Hono } from 'hono';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { createPgliteDb, type PgliteDb } from '../src/db/pglite.js';
import {
  type MetadataProvider,
  ProviderError,
  type ProviderSearchPage,
  type ProviderSearchResult,
  type ProviderSeasonDetails,
  type ProviderTitleDetails,
} from '../src/services/metadata/provider.js';
import type { EpisodeNotifier } from '../src/services/notifier.js';
import type { Pusher, PushOutcome } from '../src/services/push.js';
import type { SteamOwnedGame, SteamPlayerSummary, SteamSource } from '../src/services/steam.js';
import type { AppEnv } from '../src/types.js';

export const OWNER_PASSWORD = 'correct horse battery staple';
export const ALLOWED_ORIGIN = 'https://seen.example.com';

let cachedHash: string | undefined;
export async function ownerHash(): Promise<string> {
  cachedHash ??= await hash(OWNER_PASSWORD, {
    algorithm: 2,
    memoryCost: 8192,
    timeCost: 1,
    parallelism: 1,
  });
  return cachedHash;
}

export class Clock {
  constructor(public current = new Date('2026-09-10T12:00:00.000Z')) {}
  now = (): Date => new Date(this.current.getTime());
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Titles for which the provider reports nothing beyond the basics. */
export const NO_ENRICHMENT = {
  externalUrl: null,
  status: null,
  lastEpisodeToAir: null,
  nextEpisodeToAir: null,
  cast: [],
  crew: [],
  networks: [],
  productionCompanies: [],
  platforms: [],
  developers: [],
  publishers: [],
} satisfies Partial<ProviderTitleDetails>;

/** Games in the stub catalogue. Cover and screenshot paths are IGDB image ids. */
export const GAMES: ProviderTitleDetails[] = [
  {
    ...NO_ENRICHMENT,
    mediaType: 'game',
    tmdbId: 113112,
    externalUrl: 'https://www.igdb.com/games/hades--1',
    title: 'Hades',
    originalTitle: 'Hades',
    releaseDate: '2020-09-17',
    overview: 'Defy the god of the dead.',
    posterPath: 'co2i2c',
    backdropPath: 'sc7wq1',
    genres: [{ id: 12, name: 'Role-playing (RPG)' }],
    runtimeMinutes: null,
    numberOfSeasons: null,
    seasons: null,
    voteAverage: 9.2,
    voteCount: 1500,
    status: 'Released',
    platforms: [
      { tmdbId: 6, name: 'PC', logoPath: null },
      { tmdbId: 130, name: 'Switch', logoPath: 'pl6f' },
    ],
    developers: [{ tmdbId: 1000, name: 'Supergiant Games', logoPath: null }],
    publishers: [{ tmdbId: 1000, name: 'Supergiant Games', logoPath: null }],
  },
  {
    ...NO_ENRICHMENT,
    mediaType: 'game',
    tmdbId: 119133,
    externalUrl: 'https://www.igdb.com/games/elden-ring',
    title: 'Elden Ring',
    originalTitle: 'Elden Ring',
    releaseDate: '2022-02-25',
    overview: 'Rise, Tarnished.',
    posterPath: 'co4jni',
    backdropPath: null,
    genres: [{ id: 12, name: 'Role-playing (RPG)' }],
    runtimeMinutes: null,
    numberOfSeasons: null,
    seasons: null,
    voteAverage: 9.5,
    voteCount: 4000,
    status: 'Released',
    platforms: [{ tmdbId: 6, name: 'PC', logoPath: null }],
    developers: [{ tmdbId: 2000, name: 'FromSoftware', logoPath: null }],
    publishers: [{ tmdbId: 2001, name: 'Bandai Namco', logoPath: null }],
  },
];

export const MOVIES: ProviderTitleDetails[] = [
  {
    mediaType: 'movie',
    tmdbId: 438631,
    title: 'Dune',
    originalTitle: 'Dune',
    releaseDate: '2021-09-15',
    overview: 'Paul Atreides leads nomadic tribes.',
    posterPath: '/dune2021.jpg',
    backdropPath: '/dune2021-bd.jpg',
    genres: [
      { id: 878, name: 'Science Fiction' },
      { id: 12, name: 'Adventure' },
    ],
    runtimeMinutes: 155,
    numberOfSeasons: null,
    seasons: null,
    voteAverage: 7.8,
    voteCount: 12345,
    status: 'Released',
    lastEpisodeToAir: null,
    nextEpisodeToAir: null,
    cast: [
      { tmdbId: 1190668, name: 'Timothée Chalamet', role: 'Paul Atreides', profilePath: '/tc.jpg' },
      { tmdbId: 505710, name: 'Zendaya', role: 'Chani', profilePath: null },
    ],
    crew: [
      {
        tmdbId: 137427,
        name: 'Denis Villeneuve',
        role: 'Director, Screenplay',
        profilePath: '/dv.jpg',
      },
    ],
    networks: [],
    productionCompanies: [{ tmdbId: 923, name: 'Legendary Pictures', logoPath: '/leg.png' }],
    externalUrl: null,
    platforms: [],
    developers: [],
    publishers: [],
  },
  {
    mediaType: 'movie',
    tmdbId: 841,
    title: 'Dune',
    originalTitle: 'Dune',
    releaseDate: '1984-12-14',
    overview: 'Lynch adaptation.',
    posterPath: '/dune1984.jpg',
    backdropPath: null,
    genres: [{ id: 878, name: 'Science Fiction' }],
    runtimeMinutes: 137,
    numberOfSeasons: null,
    seasons: null,
    voteAverage: 7.8,
    voteCount: 12345,
    ...NO_ENRICHMENT,
  },
  {
    mediaType: 'movie',
    tmdbId: 550,
    title: 'Fight Club',
    originalTitle: 'Fight Club',
    releaseDate: '1999-10-15',
    overview: 'Insomniac office worker.',
    posterPath: '/fc.jpg',
    backdropPath: null,
    genres: [{ id: 18, name: 'Drama' }],
    runtimeMinutes: 139,
    numberOfSeasons: null,
    seasons: null,
    voteAverage: 7.8,
    voteCount: 12345,
    ...NO_ENRICHMENT,
  },
];

export const SHOWS: ProviderTitleDetails[] = [
  {
    mediaType: 'tv',
    tmdbId: 90228,
    title: 'Dune: Prophecy',
    originalTitle: 'Dune: Prophecy',
    releaseDate: '2024-11-17',
    overview: 'Sisterhood origins.',
    posterPath: '/dunep.jpg',
    backdropPath: '/dunep-bd.jpg',
    genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
    runtimeMinutes: null,
    numberOfSeasons: 1,
    seasons: [
      { seasonNumber: 0, name: 'Specials', episodeCount: 2, airDate: null, isSpecials: true },
      {
        seasonNumber: 1,
        name: 'Season 1',
        episodeCount: 6,
        airDate: '2024-11-17',
        isSpecials: false,
      },
    ],
    voteAverage: 6.9,
    voteCount: 320,
    // Caught-up viewers see an upcoming alert: the next episode airs 8 days after the test clock.
    status: 'Returning Series',
    lastEpisodeToAir: {
      seasonNumber: 1,
      episodeNumber: 6,
      name: 'The High-Handed Enemy',
      airDate: '2024-12-22',
    },
    nextEpisodeToAir: {
      seasonNumber: 2,
      episodeNumber: 1,
      name: 'Chapter One',
      airDate: '2026-09-18',
    },
    cast: [{ tmdbId: 1, name: 'Emily Watson', role: 'Valya Harkonnen', profilePath: null }],
    crew: [{ tmdbId: 2, name: 'Diane Ademu-John', role: 'Creator', profilePath: null }],
    networks: [{ tmdbId: 49, name: 'HBO', logoPath: '/hbo.png' }],
    productionCompanies: [{ tmdbId: 923, name: 'Legendary Television', logoPath: null }],
    externalUrl: null,
    platforms: [],
    developers: [],
    publishers: [],
  },
  {
    mediaType: 'tv',
    tmdbId: 95396,
    title: 'Severance',
    originalTitle: 'Severance',
    releaseDate: '2022-02-17',
    overview: 'Work-life balance, literally.',
    posterPath: '/sev.jpg',
    backdropPath: null,
    genres: [{ id: 18, name: 'Drama' }],
    runtimeMinutes: null,
    numberOfSeasons: 2,
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        episodeCount: 9,
        airDate: '2022-02-17',
        isSpecials: false,
      },
      {
        seasonNumber: 2,
        name: 'Season 2',
        episodeCount: 10,
        airDate: '2025-01-17',
        isSpecials: false,
      },
    ],
    voteAverage: 8.4,
    voteCount: 3200,
    // S2 E9 aired 5 days before the test clock and is the newest aired episode; E10 is far off.
    status: 'Returning Series',
    lastEpisodeToAir: {
      seasonNumber: 2,
      episodeNumber: 9,
      name: 'The After Hours',
      airDate: '2026-09-05',
    },
    nextEpisodeToAir: {
      seasonNumber: 2,
      episodeNumber: 10,
      name: 'Cold Harbor',
      airDate: '2999-01-01',
    },
    cast: [
      { tmdbId: 3, name: 'Adam Scott', role: 'Mark Scout', profilePath: '/as.jpg' },
      { tmdbId: 4, name: 'Britt Lower', role: 'Helly R.', profilePath: null },
    ],
    crew: [{ tmdbId: 5, name: 'Dan Erickson', role: 'Creator', profilePath: null }],
    networks: [{ tmdbId: 2552, name: 'Apple TV+', logoPath: '/atv.png' }],
    productionCompanies: [{ tmdbId: 6, name: 'Red Hour Productions', logoPath: null }],
    externalUrl: null,
    platforms: [],
    developers: [],
    publishers: [],
  },
];

const POPULARITY: Record<number, number> = {
  438631: 120,
  841: 30,
  550: 80,
  90228: 90,
  95396: 200,
  113112: 1500,
  119133: 4000,
};

function toResult(d: ProviderTitleDetails): ProviderSearchResult {
  return {
    tmdbId: d.tmdbId,
    mediaType: d.mediaType,
    title: d.title,
    originalTitle: d.originalTitle,
    releaseDate: d.releaseDate,
    posterPath: d.posterPath,
    overview: d.overview,
    popularity: POPULARITY[d.tmdbId] ?? 1,
    voteAverage: d.voteAverage,
    voteCount: d.voteCount,
  };
}

/** Deterministic stand-in for TMDB. Flip `unavailable` to simulate an outage. */
export class StubProvider implements MetadataProvider {
  unavailable = false;
  calls: string[] = [];

  private search(pool: ProviderTitleDetails[], query: string, page: number): ProviderSearchPage {
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    const q = query.toLowerCase();
    const results = pool.filter((d) => d.title.toLowerCase().includes(q)).map(toResult);
    return { results, page, totalPages: results.length > 0 ? 1 : 0 };
  }

  async searchMovies(query: string, page: number): Promise<ProviderSearchPage> {
    this.calls.push(`searchMovies:${query}:${page}`);
    return this.search(MOVIES, query, page);
  }

  async searchTv(query: string, page: number): Promise<ProviderSearchPage> {
    this.calls.push(`searchTv:${query}:${page}`);
    return this.search(SHOWS, query, page);
  }

  async searchGames(query: string, page: number): Promise<ProviderSearchPage> {
    this.calls.push(`searchGames:${query}:${page}`);
    return this.search(GAMES, query, page);
  }

  async gameDetails(id: number): Promise<ProviderTitleDetails> {
    this.calls.push(`gameDetails:${id}`);
    return this.details(GAMES, id);
  }

  async trendingGames(): Promise<ProviderSearchResult[]> {
    this.calls.push('trendingGames');
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    return GAMES.map(toResult);
  }

  async topGames(): Promise<ProviderSearchResult[]> {
    this.calls.push('topGames');
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    return GAMES.slice().reverse().map(toResult);
  }

  /** Steam app ids known to the stub: 1145360 → Hades, 1245620 → Elden Ring. */
  async gamesBySteamAppIds(appIds: number[]): Promise<Map<number, number>> {
    this.calls.push(`gamesBySteamAppIds:${appIds.join(',')}`);
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    const known: Record<number, number> = { 1145360: 113112, 1245620: 119133 };
    return new Map(
      appIds.flatMap((id) => (known[id] ? [[id, known[id]] as [number, number]] : [])),
    );
  }

  private details(pool: ProviderTitleDetails[], id: number): ProviderTitleDetails {
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    const found = pool.find((d) => d.tmdbId === id);
    if (!found) throw new ProviderError('not_found', 'stub missing');
    return structuredClone(found);
  }

  async movieDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    this.calls.push(`movieDetails:${tmdbId}`);
    return this.details(MOVIES, tmdbId);
  }

  async tvDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    this.calls.push(`tvDetails:${tmdbId}`);
    return this.details(SHOWS, tmdbId);
  }

  async trendingAll(window: 'day' | 'week'): Promise<ProviderSearchResult[]> {
    this.calls.push(`trending:${window}`);
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    return [SHOWS[1], MOVIES[0], SHOWS[0]].map((d) => toResult(d as ProviderTitleDetails));
  }

  async popularMovies(): Promise<ProviderSearchResult[]> {
    this.calls.push('popular:movie');
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    return MOVIES.map(toResult);
  }

  async popularTv(): Promise<ProviderSearchResult[]> {
    this.calls.push('popular:tv');
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    return SHOWS.map(toResult);
  }

  async tvSeason(tmdbId: number, seasonNumber: number): Promise<ProviderSeasonDetails> {
    this.calls.push(`season:${tmdbId}:${seasonNumber}`);
    if (this.unavailable) throw new ProviderError('unavailable', 'stub outage');
    const show = SHOWS.find((s) => s.tmdbId === tmdbId);
    const season = show?.seasons?.find((s) => s.seasonNumber === seasonNumber);
    if (!show || !season) throw new ProviderError('not_found', 'stub missing');
    return {
      tmdbId,
      seasonNumber,
      name: season.name,
      overview: `${show.title} ${season.name}`,
      airDate: season.airDate,
      posterPath: '/season.jpg',
      episodes: Array.from({ length: season.episodeCount }, (_, i) => ({
        episodeNumber: i + 1,
        name: `Episode ${i + 1}`,
        overview: `Overview ${i + 1}`,
        // The last episode of season 2 has not aired yet.
        airDate:
          seasonNumber === 2 && i === season.episodeCount - 1 ? '2999-01-01' : season.airDate,
        runtimeMinutes: 45,
        stillPath: i === 0 ? '/still.jpg' : null,
        voteAverage: 8 + i / 10,
        voteCount: 100 + i,
      })).reverse(),
    };
  }
}

/** Records every payload; endpoints listed in `gone` are reported as unsubscribed. */
export class FakePusher implements Pusher {
  sent: { endpoint: string; payload: Record<string, unknown> }[] = [];
  gone = new Set<string>();
  failing = false;

  async send(sub: { endpoint: string }, payload: string): Promise<PushOutcome> {
    if (this.gone.has(sub.endpoint)) return 'gone';
    if (this.failing) return 'failed';
    this.sent.push({
      endpoint: sub.endpoint,
      payload: JSON.parse(payload) as Record<string, unknown>,
    });
    return 'ok';
  }
}

export const VAPID_PUBLIC_KEY_FOR_TESTS = 'BTestPublicKey';

export const STEAM_ID_FOR_TESTS = '76561198000000001';

/** Stand-in for the Steam Web API: tests set `games` and `summary` before each sync. */
export class FakeSteam implements SteamSource {
  games: SteamOwnedGame[] = [];
  summary: SteamPlayerSummary | null = { personaName: 'diogo', nowPlaying: null };
  unavailable = false;
  calls = 0;

  async ownedGames(): Promise<SteamOwnedGame[]> {
    this.calls++;
    if (this.unavailable) throw new ProviderError('unavailable', 'steam down');
    return this.games.map((g) => ({ ...g }));
  }

  async playerSummary(): Promise<SteamPlayerSummary | null> {
    if (this.unavailable) throw new ProviderError('unavailable', 'steam down');
    return this.summary;
  }
}

export interface TestContext {
  app: Hono<AppEnv>;
  notifier: EpisodeNotifier;
  steam: FakeSteam;
  pusher: FakePusher;
  db: PgliteDb;
  provider: StubProvider;
  clock: Clock;
  close: () => Promise<void>;
  /** Performs a request against the app with sensible defaults. */
  request: (
    path: string,
    init?: RequestInit & { token?: string; json?: unknown; ip?: string },
  ) => Promise<Response>;
  login: () => Promise<string>;
}

export async function createTestContext(
  options: {
    refresh?: Partial<import('../src/services/refresh.js').RefreshOptions>;
    /** Pass false to run with push disabled (no VAPID keys). */
    push?: boolean;
    /** Pass false to run without a Steam account. */
    steam?: boolean;
  } = {},
): Promise<TestContext> {
  const db = await createPgliteDb();
  const provider = new StubProvider();
  const clock = new Clock();
  const pusher = new FakePusher();
  const steam = new FakeSteam();
  const { app, notifier } = createApp({
    config: {
      OWNER_PASSWORD_HASH: await ownerHash(),
      CORS_ORIGINS: [ALLOWED_ORIGIN],
      TRUST_PROXY: true,
    },
    db: db.db,
    provider,
    logger: pino({ level: 'silent' }),
    now: clock.now,
    ...(options.refresh ? { refresh: options.refresh } : {}),
    push: options.push === false ? null : { pusher, publicKey: VAPID_PUBLIC_KEY_FOR_TESTS },
    steam: options.steam === false ? null : { source: steam, steamId: STEAM_ID_FOR_TESTS },
  });

  const request: TestContext['request'] = (path, init = {}) => {
    const { token, json, ip, headers: extra, ...rest } = init;
    const headers = new Headers(extra);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (json !== undefined) headers.set('Content-Type', 'application/json');
    headers.set('X-Forwarded-For', ip ?? '203.0.113.10');
    return Promise.resolve(
      app.request(`http://api.test${path}`, {
        ...rest,
        headers,
        ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
      }),
    );
  };

  const login = async (): Promise<string> => {
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      json: { password: OWNER_PASSWORD },
    });
    if (res.status !== 200) throw new Error(`login failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { token: string };
    return body.token;
  };

  return {
    app,
    notifier,
    steam,
    pusher,
    db,
    provider,
    clock,
    request,
    login,
    close: () => db.close(),
  };
}

export const json = (res: Response): Promise<any> => res.json();

export async function logWatch(
  ctx: TestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  const res = await ctx.request('/api/v1/watches', { method: 'POST', token, json: body });
  return { status: res.status, body: res.status === 204 ? null : await json(res) };
}
