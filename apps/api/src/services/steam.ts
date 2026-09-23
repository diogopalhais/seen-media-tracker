import type { SteamStatus, SteamSyncResult } from '@seen/shared';
import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { type SteamGameRow, steamGames } from '../db/schema.js';
import type { Logger } from '../logger.js';
import type { LibraryRepository } from './library.js';
import type { MetadataProvider } from './metadata/provider.js';
import { ProviderError } from './metadata/provider.js';

const STEAM_API_BASE = 'https://api.steampowered.com';
export const STEAM_SYNC_INTERVAL_MS = 60 * 60 * 1000;
/**
 * Steam has recorded play time since early 2009. Games last played before that report a meaningless
 * `rtime_last_played` (often a few seconds after 1970), so anything earlier counts as unknown, and
 * history with no date is filed under this day rather than today.
 */
export const STEAM_PLAYTIME_EPOCH = '2009-01-01';
export const STEAM_SYNC_INITIAL_DELAY_MS = 90 * 1000;

/** One game as Steam reports it for the owner. */
export interface SteamOwnedGame {
  appId: number;
  name: string;
  iconHash: string | null;
  /** Total minutes on record. */
  minutesTotal: number;
  /** Minutes in the last two weeks. */
  minutesRecent: number;
  lastPlayedAt: Date | null;
}

export interface SteamPlayerSummary {
  personaName: string;
  nowPlaying: { appId: number; name: string } | null;
}

/** What the sync needs from Steam; `SteamClient` talks to the real Web API, tests supply a fake. */
export interface SteamSource {
  ownedGames(steamId: string): Promise<SteamOwnedGame[]>;
  playerSummary(steamId: string): Promise<SteamPlayerSummary | null>;
}

const ownedGamesSchema = z.object({
  response: z.object({
    game_count: z.number().optional(),
    games: z
      .array(
        z.object({
          appid: z.number(),
          name: z.string().optional(),
          img_icon_url: z.string().optional(),
          playtime_forever: z.number(),
          playtime_2weeks: z.number().optional(),
          rtime_last_played: z.number().optional(),
        }),
      )
      .optional(),
  }),
});

const playerSummariesSchema = z.object({
  response: z.object({
    players: z.array(
      z.object({
        steamid: z.string(),
        personaname: z.string(),
        gameid: z.string().optional(),
        gameextrainfo: z.string().optional(),
      }),
    ),
  }),
});

export interface SteamClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Steam Web API (IPlayerService, ISteamUser) with the owner's key: the key owner sees their own full data. */
export class SteamClient implements SteamSource {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: SteamClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${STEAM_API_BASE}${path}`);
    url.searchParams.set('key', this.opts.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ProviderError('unavailable', 'Steam unreachable', { cause: err });
    }
    if (res.status === 401 || res.status === 403)
      throw new ProviderError('unavailable', 'Steam rejected the API key');
    if (!res.ok) throw new ProviderError('unavailable', `Steam responded ${res.status}`);
    try {
      return await res.json();
    } catch (err) {
      throw new ProviderError('unavailable', 'Steam returned invalid JSON', { cause: err });
    }
  }

  private parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ProviderError('unavailable', 'Steam returned an unexpected shape', {
        cause: parsed.error,
      });
    return parsed.data;
  }

  async ownedGames(steamId: string): Promise<SteamOwnedGame[]> {
    const data = this.parse(
      ownedGamesSchema,
      await this.get('/IPlayerService/GetOwnedGames/v1/', {
        steamid: steamId,
        include_appinfo: '1',
        include_played_free_games: '1',
        format: 'json',
      }),
    );
    // An empty response (no `games`) is what Steam returns for a private profile.
    return (data.response.games ?? []).map((g) => ({
      appId: g.appid,
      name: g.name ?? `App ${g.appid}`,
      iconHash: g.img_icon_url || null,
      minutesTotal: g.playtime_forever,
      minutesRecent: g.playtime_2weeks ?? 0,
      lastPlayedAt:
        g.rtime_last_played && g.rtime_last_played * 1000 >= Date.parse(STEAM_PLAYTIME_EPOCH)
          ? new Date(g.rtime_last_played * 1000)
          : null,
    }));
  }

  async playerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
    const data = this.parse(
      playerSummariesSchema,
      await this.get('/ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId, format: 'json' }),
    );
    const p = data.response.players.find((x) => x.steamid === steamId);
    if (!p) return null;
    const appId = p.gameid ? Number(p.gameid) : NaN;
    return {
      personaName: p.personaname,
      nowPlaying:
        Number.isInteger(appId) && p.gameextrainfo ? { appId, name: p.gameextrainfo } : null,
    };
  }
}

/** Reads and writes the `steam_games` snapshot. */
export class SteamRepository {
  constructor(private readonly db: Db) {}

  async all(): Promise<SteamGameRow[]> {
    return this.db.select().from(steamGames).orderBy(desc(steamGames.lastPlayedAt));
  }

  async byAppId(appId: number): Promise<SteamGameRow | null> {
    const [row] = await this.db.select().from(steamGames).where(eq(steamGames.appId, appId));
    return row ?? null;
  }

  async upsertSnapshot(game: SteamOwnedGame, now: Date): Promise<void> {
    await this.db
      .insert(steamGames)
      .values({
        appId: game.appId,
        name: game.name,
        iconHash: game.iconHash,
        minutesTotal: game.minutesTotal,
        minutesRecent: game.minutesRecent,
        lastPlayedAt: game.lastPlayedAt,
        syncedAt: now,
      })
      .onConflictDoUpdate({
        target: steamGames.appId,
        set: {
          name: game.name,
          iconHash: game.iconHash,
          minutesTotal: game.minutesTotal,
          minutesRecent: game.minutesRecent,
          lastPlayedAt: game.lastPlayedAt,
          syncedAt: now,
        },
      });
  }

  async link(appId: number, mediaItemId: string | null, now: Date): Promise<void> {
    await this.db
      .update(steamGames)
      .set({ mediaItemId, matchedAt: now })
      .where(eq(steamGames.appId, appId));
  }

  async addRecorded(appId: number, minutes: number): Promise<void> {
    await this.db
      .update(steamGames)
      .set({ minutesRecorded: sql`${steamGames.minutesRecorded} + ${minutes}` })
      .where(eq(steamGames.appId, appId));
  }

  async counts(): Promise<{ played: number; linked: number; lastSyncAt: Date | null }> {
    const [row] = await this.db
      .select({
        played: sql<number>`count(*) filter (where ${steamGames.minutesTotal} > 0)::int`,
        linked: sql<number>`count(*) filter (where ${steamGames.minutesTotal} > 0 and ${steamGames.mediaItemId} is not null)::int`,
        lastSyncAt: sql<Date | null>`max(${steamGames.syncedAt})`,
      })
      .from(steamGames);
    return {
      played: row?.played ?? 0,
      linked: row?.linked ?? 0,
      lastSyncAt: row?.lastSyncAt ? new Date(row.lastSyncAt) : null,
    };
  }

  /** Played games whose recorded minutes lag their Steam total: what a history import fills in. */
  async withUnrecordedTime(): Promise<SteamGameRow[]> {
    return this.db
      .select()
      .from(steamGames)
      .where(
        and(
          gt(steamGames.minutesTotal, 0),
          sql`${steamGames.minutesTotal} > ${steamGames.minutesRecorded}`,
        ),
      );
  }

  async unmatchedPlayed(): Promise<SteamGameRow[]> {
    return this.db
      .select()
      .from(steamGames)
      .where(
        and(
          gt(steamGames.minutesTotal, 0),
          isNull(steamGames.mediaItemId),
          isNull(steamGames.matchedAt),
        ),
      );
  }

  async anyLinked(): Promise<boolean> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(steamGames)
      .where(isNotNull(steamGames.mediaItemId));
    return (row?.n ?? 0) > 0;
  }
}

export interface SteamSyncDeps {
  source: SteamSource;
  steamId: string;
  repo: SteamRepository;
  library: LibraryRepository;
  provider: MetadataProvider;
  now: () => Date;
  logger: Logger;
}

/**
 * Turns the owner's Steam play time into library activity.
 *
 * Every sync snapshots the Steam library. Play time that grew since the previous snapshot becomes a
 * play session dated today on the linked title. A game seen for the first time (the very first sync,
 * or a game bought later) has its whole total recorded on its last-played day, so the library holds
 * the owner's full Steam history from the first run.
 *
 * Titles are linked through IGDB's Steam ids; a game IGDB does not know stays in the snapshot
 * without a title and is counted as unmatched. `importHistory` retries those and records any time
 * that slipped through.
 */
export class SteamSync {
  private running: Promise<SteamSyncResult> | null = null;

  constructor(private readonly deps: SteamSyncDeps) {}

  get steamId(): string {
    return this.deps.steamId;
  }

  runOnce(): Promise<SteamSyncResult> {
    if (!this.running) this.running = this.sync().finally(() => (this.running = null));
    return this.running;
  }

  /**
   * Records any play time Steam knows about that has not been recorded yet, asking IGDB again about
   * games it did not know before. Useful after IGDB adds a title.
   */
  async importHistory(): Promise<SteamSyncResult> {
    await this.runOnce();
    const now = this.deps.now();
    const result: SteamSyncResult = { games: 0, sessions: 0, linked: 0, unmatched: 0 };
    for (const row of await this.deps.repo.withUnrecordedTime()) {
      result.games++;
      const itemId = row.mediaItemId ?? (await this.linkGame(row, now, result, true));
      if (!itemId) continue;
      const minutes = row.minutesTotal - row.minutesRecorded;
      const playedOn = row.lastPlayedAt?.toISOString().slice(0, 10) ?? STEAM_PLAYTIME_EPOCH;
      await this.deps.library.addPlaySession(itemId, { source: 'steam', playedOn, minutes }, now);
      await this.deps.repo.addRecorded(row.appId, minutes);
      result.sessions++;
    }
    return result;
  }

  async status(): Promise<SteamStatus> {
    const counts = await this.deps.repo.counts();
    let summary: SteamPlayerSummary | null = null;
    try {
      summary = await this.deps.source.playerSummary(this.deps.steamId);
    } catch (err) {
      this.deps.logger.warn({ err }, 'steam: player summary failed');
    }
    const unrecorded = await this.deps.repo.withUnrecordedTime();
    return {
      enabled: true,
      steamId: this.deps.steamId,
      personaName: summary?.personaName ?? null,
      nowPlaying: summary?.nowPlaying ?? null,
      gamesPlayed: counts.played,
      gamesLinked: counts.linked,
      lastSyncAt: counts.lastSyncAt?.toISOString() ?? null,
      historyImported: counts.played > 0 && unrecorded.every((g) => g.mediaItemId === null),
    };
  }

  private async sync(): Promise<SteamSyncResult> {
    const now = this.deps.now();
    // Sessions carry the UTC day of the sync; play time has no timezone of its own.
    const today = now.toISOString().slice(0, 10);
    const result: SteamSyncResult = { games: 0, sessions: 0, linked: 0, unmatched: 0 };
    const games = await this.deps.source.ownedGames(this.deps.steamId);
    result.games = games.length;

    for (const game of games) {
      const previous = await this.deps.repo.byAppId(game.appId);
      await this.deps.repo.upsertSnapshot(game, now);
      if (game.minutesTotal === 0) continue;

      // Minutes to record now: growth since the last snapshot, or the whole total for a new game.
      const delta = previous ? game.minutesTotal - previous.minutesTotal : game.minutesTotal;
      if (delta <= 0) continue;

      const row = (await this.deps.repo.byAppId(game.appId)) as SteamGameRow;
      const itemId = row.mediaItemId ?? (await this.linkGame(row, now, result));
      if (!itemId) continue;
      const playedOn = previous
        ? today
        : (game.lastPlayedAt?.toISOString().slice(0, 10) ?? STEAM_PLAYTIME_EPOCH);
      await this.deps.library.addPlaySession(
        itemId,
        { source: 'steam', playedOn, minutes: delta },
        now,
      );
      await this.deps.repo.addRecorded(game.appId, delta);
      result.sessions++;
    }
    // Played games IGDB was asked about and did not know.
    result.unmatched = (await this.deps.repo.all()).filter(
      (g) => g.minutesTotal > 0 && g.mediaItemId === null && g.matchedAt !== null,
    ).length;
    return result;
  }

  /**
   * Finds the IGDB title for a Steam app and makes sure it exists in the library. Null when unknown;
   * an app IGDB already failed to match is not asked about again unless `retry` is set.
   */
  private async linkGame(
    row: SteamGameRow,
    now: Date,
    result: SteamSyncResult,
    retry = false,
  ): Promise<string | null> {
    if (row.matchedAt && !row.mediaItemId && !retry) return null;
    let igdbId: number | undefined;
    try {
      igdbId = (await this.deps.provider.gamesBySteamAppIds([row.appId])).get(row.appId);
      if (igdbId !== undefined) {
        const item = await this.deps.library.upsertItem(
          await this.deps.provider.gameDetails(igdbId),
          now,
        );
        await this.deps.repo.link(row.appId, item.id, now);
        result.linked++;
        return item.id;
      }
    } catch (err) {
      // IGDB unavailable: try again next run rather than marking the app as unknown.
      if (err instanceof ProviderError && err.kind === 'unavailable') {
        this.deps.logger.warn({ err, appId: row.appId }, 'steam: could not link game');
        return null;
      }
      throw err;
    }
    await this.deps.repo.link(row.appId, null, now);
    return null;
  }

  /** Starts the hourly schedule; returns a function that stops it. */
  start(
    intervalMs = STEAM_SYNC_INTERVAL_MS,
    initialDelayMs = STEAM_SYNC_INITIAL_DELAY_MS,
  ): () => void {
    const tick = () => {
      this.runOnce().catch((err: unknown) => this.deps.logger.error({ err }, 'steam sync failed'));
    };
    const first = setTimeout(tick, initialDelayMs);
    const every = setInterval(tick, intervalMs);
    first.unref?.();
    every.unref?.();
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }
}
