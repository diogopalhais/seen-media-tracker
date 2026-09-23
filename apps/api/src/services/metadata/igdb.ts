import { z } from 'zod';
import {
  type GameProvider,
  type ProviderCompany,
  ProviderError,
  type ProviderSearchPage,
  type ProviderSearchResult,
  type ProviderTitleDetails,
} from './provider.js';

const IGDB_API_BASE = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
export const IGDB_PAGE_SIZE = 20;
/** Refresh the access token this long before Twitch says it expires. */
const TOKEN_SLACK_MS = 60 * 1000;

/**
 * IGDB game types worth listing: main games, remakes, remasters and expanded games. DLC, bundles,
 * mods, episodes and ports are left out so a search for a title does not drown in its add-ons.
 */
const LISTABLE_GAME_TYPES = '(0,8,9,10)';
/**
 * IGDB popularity type 3 counts members currently marking a game as "Playing". Visits (1) surface
 * whatever is being looked up, which skews to odd releases; "Playing" reflects actual play.
 */
const POPULARITY_PLAYING = 3;
/** Enough ratings that one studio's fans or a fan game cannot top the list. */
const TOP_GAMES_MIN_VOTES = 100;
const COMPANY_LIMIT = 5;

/** IGDB game status codes (the `status` field; newer payloads name it `game_status`). */
const GAME_STATUS: Record<number, string> = {
  0: 'Released',
  2: 'Alpha',
  3: 'Beta',
  4: 'Early Access',
  5: 'Offline',
  6: 'Cancelled',
  7: 'Rumored',
  8: 'Delisted',
};

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
});

const imageRef = z.object({ image_id: z.string() }).partial();
const named = z.object({ id: z.number(), name: z.string() });

const gameSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string().optional(),
  url: z.string().optional(),
  summary: z.string().optional(),
  first_release_date: z.number().optional(),
  cover: imageRef.optional(),
  total_rating: z.number().optional(),
  total_rating_count: z.number().optional(),
  rating_count: z.number().optional(),
  hypes: z.number().optional(),
});

const companyRef = z.object({
  id: z.number(),
  name: z.string(),
  logo: imageRef.optional(),
});

const gameDetailsSchema = gameSummarySchema.extend({
  storyline: z.string().optional(),
  screenshots: z.array(imageRef.extend({ id: z.number().optional() })).optional(),
  artworks: z.array(imageRef.extend({ id: z.number().optional() })).optional(),
  genres: z.array(named).optional(),
  platforms: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        abbreviation: z.string().optional(),
        platform_logo: imageRef.optional(),
      }),
    )
    .optional(),
  involved_companies: z
    .array(
      z.object({
        company: companyRef,
        developer: z.boolean().optional(),
        publisher: z.boolean().optional(),
      }),
    )
    .optional(),
  status: z.number().optional(),
  game_status: z.union([z.number(), z.object({ status: z.string() })]).optional(),
});

const popularitySchema = z.array(z.object({ game_id: z.number(), value: z.number() }));
const externalGamesSchema = z.array(z.object({ game: z.number(), uid: z.string() }));
/** IGDB external game source for Steam (the same value under the older `category` field). */
const EXTERNAL_SOURCE_STEAM = 1;
const EXTERNAL_BATCH = 100;

const SUMMARY_FIELDS =
  'name,slug,url,summary,first_release_date,cover.image_id,total_rating,total_rating_count,rating_count,hypes';
const DETAIL_FIELDS = `${SUMMARY_FIELDS},storyline,screenshots.image_id,artworks.image_id,genres.name,platforms.name,platforms.abbreviation,platforms.platform_logo.image_id,involved_companies.company.name,involved_companies.company.logo.image_id,involved_companies.developer,involved_companies.publisher,status,game_status`;

type GameSummary = z.infer<typeof gameSummarySchema>;
type GameDetails = z.infer<typeof gameDetailsSchema>;

/** Unix seconds (UTC) to `YYYY-MM-DD`. */
function isoDate(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** IGDB ratings are 0–100; the app shows one decimal out of 10. */
function ratingOutOfTen(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value) / 10;
}

/** Escapes a user query for an Apicalypse string literal. */
function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function toSearchResult(g: GameSummary): ProviderSearchResult {
  return {
    tmdbId: g.id,
    mediaType: 'game',
    title: g.name,
    originalTitle: g.name,
    releaseDate: isoDate(g.first_release_date),
    posterPath: g.cover?.image_id ?? null,
    overview: g.summary ?? '',
    // Only comparable among games: how many people have rated or are hyped about it.
    popularity: (g.total_rating_count ?? g.rating_count ?? 0) + (g.hypes ?? 0),
    voteAverage: ratingOutOfTen(g.total_rating),
    voteCount: g.total_rating_count ?? 0,
  };
}

function statusLabel(g: GameDetails): string | null {
  if (typeof g.game_status === 'object') return g.game_status.status;
  const code = typeof g.game_status === 'number' ? g.game_status : g.status;
  return code === undefined ? null : (GAME_STATUS[code] ?? null);
}

function toDetails(g: GameDetails): ProviderTitleDetails {
  const companies = g.involved_companies ?? [];
  const company = (c: (typeof companies)[number]): ProviderCompany => ({
    tmdbId: c.company.id,
    name: c.company.name,
    logoPath: c.company.logo?.image_id ?? null,
  });
  const backdrop = g.screenshots?.[0]?.image_id ?? g.artworks?.[0]?.image_id ?? null;
  return {
    mediaType: 'game',
    tmdbId: g.id,
    externalUrl: g.url ?? null,
    title: g.name,
    originalTitle: g.name,
    releaseDate: isoDate(g.first_release_date),
    overview: g.summary ?? g.storyline ?? '',
    posterPath: g.cover?.image_id ?? null,
    backdropPath: backdrop,
    genres: (g.genres ?? []).map((x) => ({ id: x.id, name: x.name })),
    runtimeMinutes: null,
    numberOfSeasons: null,
    seasons: null,
    voteAverage: ratingOutOfTen(g.total_rating),
    voteCount: g.total_rating_count ?? 0,
    status: statusLabel(g),
    lastEpisodeToAir: null,
    nextEpisodeToAir: null,
    cast: [],
    crew: [],
    networks: [],
    productionCompanies: [],
    platforms: (g.platforms ?? []).map((p) => ({
      tmdbId: p.id,
      name: p.abbreviation || p.name,
      logoPath: p.platform_logo?.image_id ?? null,
    })),
    developers: companies
      .filter((c) => c.developer)
      .slice(0, COMPANY_LIMIT)
      .map(company),
    publishers: companies
      .filter((c) => c.publisher)
      .slice(0, COMPANY_LIMIT)
      .map(company),
  };
}

export interface IgdbOptions {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

/**
 * IGDB (igdb.com) behind Twitch's client-credentials OAuth. The access token is fetched on first
 * use, cached until shortly before it expires and refreshed once on a 401.
 */
export class IgdbProvider implements GameProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(private readonly opts: IgdbOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.now = opts.now ?? Date.now;
  }

  private async accessToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt - TOKEN_SLACK_MS > this.now())
      return this.token.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      const url = new URL(TWITCH_TOKEN_URL);
      url.searchParams.set('client_id', this.opts.clientId);
      url.searchParams.set('client_secret', this.opts.clientSecret);
      url.searchParams.set('grant_type', 'client_credentials');
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: 'POST',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        throw new ProviderError('unavailable', 'Game provider auth unreachable', { cause: err });
      }
      if (!res.ok)
        throw new ProviderError('unavailable', `Game provider auth responded ${res.status}`);
      const parsed = tokenSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success)
        throw new ProviderError('unavailable', 'Game provider auth returned an unexpected shape');
      this.token = {
        value: parsed.data.access_token,
        expiresAt: this.now() + parsed.data.expires_in * 1000,
      };
      return this.token.value;
    })().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  /** Posts an Apicalypse query; retries once with a fresh token when the current one is rejected. */
  private async query(endpoint: string, body: string, retried = false): Promise<unknown> {
    const token = await this.accessToken(retried);
    let res: Response;
    try {
      res = await this.fetchImpl(`${IGDB_API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': this.opts.clientId,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'text/plain',
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ProviderError('unavailable', 'Game provider unreachable', { cause: err });
    }
    if (res.status === 401 && !retried) return this.query(endpoint, body, true);
    if (!res.ok) throw new ProviderError('unavailable', `Game provider responded ${res.status}`);
    try {
      return await res.json();
    } catch (err) {
      throw new ProviderError('unavailable', 'Game provider returned invalid JSON', {
        cause: err,
      });
    }
  }

  private parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ProviderError('unavailable', 'Game provider returned an unexpected shape', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  async searchGames(query: string, page: number): Promise<ProviderSearchPage> {
    const offset = (page - 1) * IGDB_PAGE_SIZE;
    const data = this.parse(
      z.array(gameSummarySchema),
      await this.query(
        'games',
        `search ${quote(query)}; fields ${SUMMARY_FIELDS}; where version_parent = null & game_type = ${LISTABLE_GAME_TYPES}; limit ${IGDB_PAGE_SIZE}; offset ${offset};`,
      ),
    );
    // IGDB does not return a total; a full page means there may be another.
    return {
      results: data.map(toSearchResult),
      page,
      totalPages: data.length === IGDB_PAGE_SIZE ? page + 1 : page,
    };
  }

  async gameDetails(igdbId: number): Promise<ProviderTitleDetails> {
    const data = this.parse(
      z.array(gameDetailsSchema),
      await this.query('games', `fields ${DETAIL_FIELDS}; where id = ${igdbId}; limit 1;`),
    );
    const game = data[0];
    if (!game) throw new ProviderError('not_found', 'Game not found at metadata provider');
    return toDetails(game);
  }

  async trendingGames(): Promise<ProviderSearchResult[]> {
    const ranking = this.parse(
      popularitySchema,
      await this.query(
        'popularity_primitives',
        `fields game_id,value; where popularity_type = ${POPULARITY_PLAYING}; sort value desc; limit ${IGDB_PAGE_SIZE};`,
      ),
    );
    if (ranking.length === 0) return [];
    const ids = ranking.map((r) => r.game_id);
    const games = this.parse(
      z.array(gameSummarySchema),
      await this.query(
        'games',
        `fields ${SUMMARY_FIELDS}; where id = (${ids.join(',')}); limit ${IGDB_PAGE_SIZE};`,
      ),
    );
    const byId = new Map(games.map((g) => [g.id, g]));
    // Keep IGDB's popularity order and let the value stand in as the rank signal.
    return ranking.flatMap((r) => {
      const g = byId.get(r.game_id);
      return g ? [{ ...toSearchResult(g), popularity: r.value }] : [];
    });
  }

  async gamesBySteamAppIds(appIds: number[]): Promise<Map<number, number>> {
    const out = new Map<number, number>();
    for (let i = 0; i < appIds.length; i += EXTERNAL_BATCH) {
      const batch = appIds.slice(i, i + EXTERNAL_BATCH);
      const uids = batch.map((id) => `"${id}"`).join(',');
      const body = (field: string) =>
        `fields game,uid; where uid = (${uids}) & ${field} = ${EXTERNAL_SOURCE_STEAM}; limit ${EXTERNAL_BATCH * 2};`;
      let data: unknown;
      try {
        data = await this.query('external_games', body('external_game_source'));
      } catch (err) {
        // Older IGDB deployments only know the deprecated `category` field.
        if (!(err instanceof ProviderError && err.message.includes('400'))) throw err;
        data = await this.query('external_games', body('category'));
      }
      for (const row of this.parse(externalGamesSchema, data)) {
        const appId = Number(row.uid);
        if (Number.isInteger(appId) && !out.has(appId)) out.set(appId, row.game);
      }
    }
    return out;
  }

  async topGames(): Promise<ProviderSearchResult[]> {
    const yearAgo = Math.floor(this.now() / 1000) - 365 * 24 * 60 * 60;
    const data = this.parse(
      z.array(gameSummarySchema),
      await this.query(
        'games',
        `fields ${SUMMARY_FIELDS}; where first_release_date >= ${yearAgo} & total_rating_count >= ${TOP_GAMES_MIN_VOTES} & game_type = 0; sort total_rating desc; limit ${IGDB_PAGE_SIZE};`,
      ),
    );
    return data.map(toSearchResult);
  }
}
