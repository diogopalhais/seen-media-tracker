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
  type ProviderTitleDetails,
} from '../src/services/metadata/provider.js';
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
      { seasonNumber: 0, name: 'Specials', episodeCount: 2, isSpecials: true },
      { seasonNumber: 1, name: 'Season 1', episodeCount: 6, isSpecials: false },
    ],
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
      { seasonNumber: 1, name: 'Season 1', episodeCount: 9, isSpecials: false },
      { seasonNumber: 2, name: 'Season 2', episodeCount: 10, isSpecials: false },
    ],
  },
];

const POPULARITY: Record<number, number> = { 438631: 120, 841: 30, 550: 80, 90228: 90, 95396: 200 };

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
}

export interface TestContext {
  app: Hono<AppEnv>;
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

export async function createTestContext(): Promise<TestContext> {
  const db = await createPgliteDb();
  const provider = new StubProvider();
  const clock = new Clock();
  const app = createApp({
    config: {
      OWNER_PASSWORD_HASH: await ownerHash(),
      CORS_ORIGINS: [ALLOWED_ORIGIN],
      TRUST_PROXY: true,
    },
    db: db.db,
    provider,
    logger: pino({ level: 'silent' }),
    now: clock.now,
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

  return { app, db, provider, clock, request, login, close: () => db.close() };
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
