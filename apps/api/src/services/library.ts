import {
  type AiredEpisode,
  ANNOUNCE_WINDOW_DAYS,
  type EpisodeWatch,
  type LibraryItemDetail,
  type LibraryItemSummary,
  type LibraryListQuery,
  type LibraryMembership,
  type MediaItem,
  type MediaType,
  type MediaTypeFilter,
  type PublicRecentItem,
  RELEASE_NEW_WINDOW_DAYS,
  RELEASE_UPCOMING_WINDOW_DAYS,
  RELEASES_LIMIT,
  type ReleaseAlert,
  tmdbBackdropUrl,
  tmdbPosterUrl,
  tmdbTitleUrl,
  toTmdbRating,
  type UpdateWatchRequest,
  type WatchEntry,
} from '@seen/shared';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  type EpisodeWatchRow,
  episodeWatches,
  type MediaItemRow,
  mediaItems,
  type WatchEntryRow,
  watchEntries,
} from '../db/schema.js';
import { type ProviderTitleDetails, releaseYear } from './metadata/provider.js';

export function membershipKey(mediaType: MediaType, tmdbId: number): string {
  return `${mediaType}:${tmdbId}`;
}

function episodeRef(
  season: number | null,
  episode: number | null,
  name: string | null,
  airDate: string | null,
): AiredEpisode | null {
  if (season === null || episode === null) return null;
  return { seasonNumber: season, episodeNumber: episode, name: name ?? '', airDate };
}

export function toMediaItem(row: MediaItemRow): MediaItem {
  return {
    id: row.id,
    mediaType: row.mediaType,
    tmdbId: row.tmdbId,
    title: row.title,
    originalTitle: row.originalTitle,
    releaseYear: row.releaseYear,
    releaseDate: row.releaseDate,
    posterUrl: tmdbPosterUrl(row.posterPath),
    backdropUrl: tmdbBackdropUrl(row.backdropPath),
    overview: row.overview,
    genres: row.genres,
    runtimeMinutes: row.runtimeMinutes,
    numberOfSeasons: row.numberOfSeasons,
    tmdbRating: toTmdbRating(row.tmdbVoteAverage, row.tmdbVoteCount),
    tmdbUrl: tmdbTitleUrl(row.mediaType, row.tmdbId),
    status: row.status,
    lastEpisodeToAir: episodeRef(
      row.lastEpisodeSeason,
      row.lastEpisodeNumber,
      row.lastEpisodeName,
      row.lastEpisodeAirDate,
    ),
    nextEpisodeToAir: episodeRef(
      row.nextEpisodeSeason,
      row.nextEpisodeNumber,
      row.nextEpisodeName,
      row.nextEpisodeAirDate,
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEpisodeWatch(row: EpisodeWatchRow): EpisodeWatch {
  return {
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    watchedOn: row.watchedOn,
  };
}

export function toWatchEntry(row: WatchEntryRow): WatchEntry {
  return {
    id: row.id,
    mediaItemId: row.mediaItemId,
    watchedOn: row.watchedOn,
    rating: row.rating,
    season: row.season,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Correlated subqueries over an item's entries. The outer column is written as `${mediaItems}."id"`
 * because Drizzle renders a bare `"id"` for single-table selects, which would bind to `watch_entries`.
 */
const itemId = sql`${mediaItems}."id"`;

/** Rating of the most recent rated entry for an item, or null. */
const displayedRating = () => sql<number | null>`(
  select w.rating from ${watchEntries} w
  where w.media_item_id = ${itemId} and w.rating is not null
  order by w.watched_on desc, w.created_at desc limit 1)`;

/** Most recent activity across season/series logs and episode watches. */
const lastWatchedOn = () => sql<string>`(
  select greatest(
    (select max(w.watched_on) from ${watchEntries} w where w.media_item_id = ${itemId}),
    (select max(ew.watched_on) from ${episodeWatches} ew where ew.media_item_id = ${itemId})
  )::text)`;

const watchCount = () => sql<number>`(
  select count(*)::int from ${watchEntries} w where w.media_item_id = ${itemId})`;

const episodesWatched = () => sql<number>`(
  select count(*)::int from ${episodeWatches} ew where ew.media_item_id = ${itemId})`;

const hasActivity = () => sql`(
  exists (select 1 from ${watchEntries} w where w.media_item_id = ${itemId})
  or exists (select 1 from ${episodeWatches} ew where ew.media_item_id = ${itemId}))`;

const lastSeason = () => sql<number | null>`(
  select w.season from ${watchEntries} w where w.media_item_id = ${itemId}
  order by w.watched_on desc, w.created_at desc limit 1)`;

/**
 * The last aired episode counts as new when it aired within the window, on or before today, and the
 * owner neither ticked it nor logged that season (or the whole series) on or after its air date.
 */
const hasNewEpisode = (today: string) => sql<boolean>`(
  ${mediaItems.lastEpisodeAirDate} is not null
  and ${mediaItems.lastEpisodeAirDate} <= ${today}::date
  and ${mediaItems.lastEpisodeAirDate} >= (${today}::date - ${RELEASE_NEW_WINDOW_DAYS}::int)
  and not exists (
    select 1 from ${episodeWatches} ew
    where ew.media_item_id = ${itemId}
      and ew.season_number = ${mediaItems.lastEpisodeSeason}
      and ew.episode_number = ${mediaItems.lastEpisodeNumber})
  and not exists (
    select 1 from ${watchEntries} w
    where w.media_item_id = ${itemId}
      and (w.season is null or w.season = ${mediaItems.lastEpisodeSeason})
      and w.watched_on >= ${mediaItems.lastEpisodeAirDate}))`;

const hasUpcomingEpisode = (today: string) => sql<boolean>`(
  ${mediaItems.nextEpisodeAirDate} is not null
  and ${mediaItems.nextEpisodeAirDate} >= ${today}::date
  and ${mediaItems.nextEpisodeAirDate} <= (${today}::date + ${RELEASE_UPCOMING_WINDOW_DAYS}::int))`;

const entryOrder = [desc(watchEntries.watchedOn), desc(watchEntries.createdAt)];

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: unknown };
    return Number.isInteger(parsed.o) && (parsed.o as number) >= 0 ? (parsed.o as number) : 0;
  } catch {
    return 0;
  }
}

/** Removes an item that has neither logs nor episode watches. Returns true when removed. */
async function removeItemIfInactive(
  tx: Pick<Db, 'select' | 'delete'>,
  itemId: string,
): Promise<boolean> {
  const [entries] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(watchEntries)
    .where(eq(watchEntries.mediaItemId, itemId));
  const [episodes] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(episodeWatches)
    .where(eq(episodeWatches.mediaItemId, itemId));
  if ((entries?.n ?? 0) === 0 && (episodes?.n ?? 0) === 0) {
    await tx.delete(mediaItems).where(eq(mediaItems.id, itemId));
    return true;
  }
  return false;
}

export class LibraryRepository {
  constructor(private readonly db: Db) {}

  async membership(
    pairs: { mediaType: MediaType; tmdbId: number }[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (pairs.length === 0) return map;
    const ids = [...new Set(pairs.map((p) => p.tmdbId))];
    const rows = await this.db
      .select({ id: mediaItems.id, mediaType: mediaItems.mediaType, tmdbId: mediaItems.tmdbId })
      .from(mediaItems)
      .where(inArray(mediaItems.tmdbId, ids));
    const wanted = new Set(pairs.map((p) => membershipKey(p.mediaType, p.tmdbId)));
    for (const r of rows) {
      const key = membershipKey(r.mediaType, r.tmdbId);
      if (wanted.has(key)) map.set(key, r.id);
    }
    return map;
  }

  async membershipFor(
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<LibraryMembership & { rating: number | null }> {
    const [row] = await this.db
      .select({ id: mediaItems.id, rating: displayedRating() })
      .from(mediaItems)
      .where(and(eq(mediaItems.mediaType, mediaType), eq(mediaItems.tmdbId, tmdbId)))
      .limit(1);
    return row
      ? { inLibrary: true, libraryItemId: row.id, rating: row.rating }
      : { inLibrary: false, libraryItemId: null, rating: null };
  }

  async findItemByTmdb(mediaType: MediaType, tmdbId: number): Promise<MediaItemRow | null> {
    const [row] = await this.db
      .select()
      .from(mediaItems)
      .where(and(eq(mediaItems.mediaType, mediaType), eq(mediaItems.tmdbId, tmdbId)))
      .limit(1);
    return row ?? null;
  }

  /** Creates the snapshot on first watch, or refreshes it when the title already exists. */
  async upsertItem(details: ProviderTitleDetails, now: Date): Promise<MediaItemRow> {
    const values = {
      mediaType: details.mediaType,
      tmdbId: details.tmdbId,
      title: details.title,
      originalTitle: details.originalTitle,
      releaseYear: releaseYear(details.releaseDate),
      releaseDate: details.releaseDate,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      overview: details.overview,
      genres: details.genres,
      runtimeMinutes: details.runtimeMinutes,
      numberOfSeasons: details.numberOfSeasons,
      tmdbVoteAverage: details.voteAverage,
      tmdbVoteCount: details.voteCount,
      status: details.status,
      lastEpisodeSeason: details.lastEpisodeToAir?.seasonNumber ?? null,
      lastEpisodeNumber: details.lastEpisodeToAir?.episodeNumber ?? null,
      lastEpisodeName: details.lastEpisodeToAir?.name ?? null,
      lastEpisodeAirDate: details.lastEpisodeToAir?.airDate ?? null,
      nextEpisodeSeason: details.nextEpisodeToAir?.seasonNumber ?? null,
      nextEpisodeNumber: details.nextEpisodeToAir?.episodeNumber ?? null,
      nextEpisodeName: details.nextEpisodeToAir?.name ?? null,
      nextEpisodeAirDate: details.nextEpisodeToAir?.airDate ?? null,
      metadataRefreshedAt: now,
      // A freshly added series' current last episode is old news to the owner: never announce it.
      notifiedEpisodeSeason: details.lastEpisodeToAir?.seasonNumber ?? null,
      notifiedEpisodeNumber: details.lastEpisodeToAir?.episodeNumber ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const [row] = await this.db
      .insert(mediaItems)
      .values(values)
      .onConflictDoUpdate({
        target: [mediaItems.mediaType, mediaItems.tmdbId],
        set: {
          title: values.title,
          originalTitle: values.originalTitle,
          releaseYear: values.releaseYear,
          releaseDate: values.releaseDate,
          posterPath: values.posterPath,
          backdropPath: values.backdropPath,
          overview: values.overview,
          genres: values.genres,
          runtimeMinutes: values.runtimeMinutes,
          numberOfSeasons: values.numberOfSeasons,
          tmdbVoteAverage: values.tmdbVoteAverage,
          tmdbVoteCount: values.tmdbVoteCount,
          status: values.status,
          lastEpisodeSeason: values.lastEpisodeSeason,
          lastEpisodeNumber: values.lastEpisodeNumber,
          lastEpisodeName: values.lastEpisodeName,
          lastEpisodeAirDate: values.lastEpisodeAirDate,
          nextEpisodeSeason: values.nextEpisodeSeason,
          nextEpisodeNumber: values.nextEpisodeNumber,
          nextEpisodeName: values.nextEpisodeName,
          nextEpisodeAirDate: values.nextEpisodeAirDate,
          metadataRefreshedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error('upsert returned no row');
    return row;
  }

  async insertEntry(
    itemId: string,
    input: { watchedOn: string; rating: number | null; season: number | null; note: string | null },
    now: Date,
  ): Promise<WatchEntryRow> {
    const [row] = await this.db
      .insert(watchEntries)
      .values({ mediaItemId: itemId, ...input, createdAt: now, updatedAt: now })
      .returning();
    if (!row) throw new Error('insert returned no row');
    return row;
  }

  /** Entry for an item on a date with a given season (null = whole series/movie), if any. */
  async findEntryOn(
    itemId: string,
    watchedOn: string,
    season: number | null,
  ): Promise<WatchEntryRow | null> {
    const [row] = await this.db
      .select()
      .from(watchEntries)
      .where(
        and(
          eq(watchEntries.mediaItemId, itemId),
          eq(watchEntries.watchedOn, watchedOn),
          season === null ? sql`${watchEntries.season} is null` : eq(watchEntries.season, season),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Most recent entry for an item, optionally restricted to a season (null = series-level entries only). */
  async latestEntry(
    itemId: string,
    season: number | null | 'any' = 'any',
  ): Promise<WatchEntryRow | null> {
    const conditions = [eq(watchEntries.mediaItemId, itemId)];
    if (season === null) conditions.push(sql`${watchEntries.season} is null`);
    else if (season !== 'any') conditions.push(eq(watchEntries.season, season));
    const [row] = await this.db
      .select()
      .from(watchEntries)
      .where(and(...conditions))
      .orderBy(...entryOrder)
      .limit(1);
    return row ?? null;
  }

  /** Inserts one episode watch unless it already exists; returns true when inserted. */
  async insertEpisodeWatchIfMissing(
    itemId: string,
    seasonNumber: number,
    episodeNumber: number,
    watchedOn: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .insert(episodeWatches)
      .values({ mediaItemId: itemId, seasonNumber, episodeNumber, watchedOn, createdAt: now })
      .onConflictDoNothing()
      .returning({ id: episodeWatches.id });
    return rows.length > 0;
  }

  async getEntry(entryId: string): Promise<{ entry: WatchEntryRow; item: MediaItemRow } | null> {
    const [row] = await this.db
      .select({ entry: watchEntries, item: mediaItems })
      .from(watchEntries)
      .innerJoin(mediaItems, eq(mediaItems.id, watchEntries.mediaItemId))
      .where(eq(watchEntries.id, entryId))
      .limit(1);
    return row ?? null;
  }

  async updateEntry(
    entryId: string,
    patch: UpdateWatchRequest,
    now: Date,
  ): Promise<WatchEntryRow | null> {
    const set: Partial<typeof watchEntries.$inferInsert> = { updatedAt: now };
    if (patch.watchedOn !== undefined) set.watchedOn = patch.watchedOn;
    if (patch.rating !== undefined) set.rating = patch.rating;
    if (patch.season !== undefined) set.season = patch.season;
    if (patch.note !== undefined) set.note = patch.note;
    const [row] = await this.db
      .update(watchEntries)
      .set(set)
      .where(eq(watchEntries.id, entryId))
      .returning();
    return row ?? null;
  }

  /** Deletes an entry and, when it was the item's last one, the item itself. Returns false if not found. */
  async deleteEntry(entryId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(watchEntries)
        .where(eq(watchEntries.id, entryId))
        .returning({ mediaItemId: watchEntries.mediaItemId });
      if (!deleted) return false;
      await removeItemIfInactive(tx, deleted.mediaItemId);
      return true;
    });
  }

  /** Lists an item's episode watches in season-episode order. */
  async episodeWatchesFor(itemId: string): Promise<EpisodeWatch[]> {
    const rows = await this.db
      .select()
      .from(episodeWatches)
      .where(eq(episodeWatches.mediaItemId, itemId))
      .orderBy(asc(episodeWatches.seasonNumber), asc(episodeWatches.episodeNumber));
    return rows.map(toEpisodeWatch);
  }

  /**
   * Idempotently marks or unmarks episodes. Marking keeps existing dates; unmarking the last
   * activity removes the item from the library. Returns whether the item still exists.
   */
  async setEpisodesWatched(
    itemId: string,
    episodes: { seasonNumber: number; episodeNumber: number }[],
    watched: boolean,
    watchedOn: string,
    now: Date,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (watched) {
        await tx
          .insert(episodeWatches)
          .values(episodes.map((e) => ({ mediaItemId: itemId, ...e, watchedOn, createdAt: now })))
          .onConflictDoNothing();
        return true;
      }
      const keys = episodes.map((e) => sql`(${e.seasonNumber}, ${e.episodeNumber})`);
      await tx
        .delete(episodeWatches)
        .where(
          and(
            eq(episodeWatches.mediaItemId, itemId),
            sql`(${episodeWatches.seasonNumber}, ${episodeWatches.episodeNumber}) in (${sql.join(keys, sql`, `)})`,
          ),
        );
      return !(await removeItemIfInactive(tx, itemId));
    });
  }

  async getItemDetail(itemId: string): Promise<LibraryItemDetail | null> {
    const [item] = await this.db
      .select({ row: mediaItems, rating: displayedRating() })
      .from(mediaItems)
      .where(eq(mediaItems.id, itemId))
      .limit(1);
    if (!item) return null;
    const entries = await this.db
      .select()
      .from(watchEntries)
      .where(eq(watchEntries.mediaItemId, itemId))
      .orderBy(...entryOrder);
    return {
      item: toMediaItem(item.row),
      rating: item.rating,
      watchCount: entries.length,
      entries: entries.map(toWatchEntry),
      episodeWatches: await this.episodeWatchesFor(itemId),
    };
  }

  /** Shared select for library summaries: snapshot columns plus the correlated activity and alert columns. */
  private async summaries(
    today: string,
    conditions: SQL[],
    order: SQL[],
    limit: number,
    offset: number,
  ): Promise<LibraryItemSummary[]> {
    const rows = await this.db
      .select({
        id: mediaItems.id,
        mediaType: mediaItems.mediaType,
        tmdbId: mediaItems.tmdbId,
        title: mediaItems.title,
        releaseYear: mediaItems.releaseYear,
        posterPath: mediaItems.posterPath,
        tmdbVoteAverage: mediaItems.tmdbVoteAverage,
        tmdbVoteCount: mediaItems.tmdbVoteCount,
        rating: displayedRating(),
        lastWatchedOn: lastWatchedOn(),
        watchCount: watchCount(),
        episodesWatched: episodesWatched(),
        lastSeason: lastSeason(),
        newEpisode: hasNewEpisode(today),
        upcoming: hasUpcomingEpisode(today),
        lastEpisodeSeason: mediaItems.lastEpisodeSeason,
        lastEpisodeNumber: mediaItems.lastEpisodeNumber,
        lastEpisodeName: mediaItems.lastEpisodeName,
        lastEpisodeAirDate: mediaItems.lastEpisodeAirDate,
        nextEpisodeSeason: mediaItems.nextEpisodeSeason,
        nextEpisodeNumber: mediaItems.nextEpisodeNumber,
        nextEpisodeName: mediaItems.nextEpisodeName,
        nextEpisodeAirDate: mediaItems.nextEpisodeAirDate,
      })
      .from(mediaItems)
      .where(and(...conditions))
      .orderBy(...order)
      .limit(limit)
      .offset(offset);

    return rows.map((r) => {
      const last = episodeRef(
        r.lastEpisodeSeason,
        r.lastEpisodeNumber,
        r.lastEpisodeName,
        r.lastEpisodeAirDate,
      );
      const next = episodeRef(
        r.nextEpisodeSeason,
        r.nextEpisodeNumber,
        r.nextEpisodeName,
        r.nextEpisodeAirDate,
      );
      let release: ReleaseAlert | null = null;
      if (r.mediaType === 'tv') {
        if (r.newEpisode && last) release = { kind: 'new_episode', episode: last };
        else if (r.upcoming && next) release = { kind: 'upcoming', episode: next };
      }
      return {
        id: r.id,
        mediaType: r.mediaType,
        tmdbId: r.tmdbId,
        title: r.title,
        releaseYear: r.releaseYear,
        posterUrl: tmdbPosterUrl(r.posterPath),
        rating: r.rating,
        tmdbRating: toTmdbRating(r.tmdbVoteAverage, r.tmdbVoteCount),
        lastWatchedOn: r.lastWatchedOn,
        watchCount: r.watchCount,
        episodesWatched: r.episodesWatched,
        lastSeason: r.lastSeason,
        release,
      };
    });
  }

  async list(
    query: LibraryListQuery,
    today: string,
  ): Promise<{ items: LibraryItemSummary[]; nextCursor: string | null }> {
    const offset = decodeCursor(query.cursor);
    const rating = displayedRating();
    const last = lastWatchedOn();

    const conditions: SQL[] = [hasActivity()];
    if (query.type !== 'all') conditions.push(eq(mediaItems.mediaType, query.type));

    const order: SQL[] =
      query.sort === 'title'
        ? [asc(sql`lower(${mediaItems.title})`), asc(mediaItems.id)]
        : query.sort === 'rating'
          ? [sql`${rating} desc nulls last`, sql`${last} desc`, desc(mediaItems.id)]
          : [sql`${last} desc`, desc(mediaItems.createdAt), desc(mediaItems.id)];

    const rows = await this.summaries(today, conditions, order, query.limit + 1, offset);
    return {
      items: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  /** Series with a release alert: new episodes (newest aired first), then upcoming (soonest first). */
  async listReleases(today: string): Promise<LibraryItemSummary[]> {
    const fresh = hasNewEpisode(today);
    const soon = hasUpcomingEpisode(today);
    return this.summaries(
      today,
      [hasActivity(), eq(mediaItems.mediaType, 'tv'), sql`(${fresh} or ${soon})`],
      [
        sql`case when ${fresh} then 0 else 1 end`,
        sql`case when ${fresh} then ${mediaItems.lastEpisodeAirDate} end desc nulls last`,
        sql`${mediaItems.nextEpisodeAirDate} asc nulls last`,
        desc(mediaItems.id),
      ],
      RELEASES_LIMIT,
      0,
    );
  }

  /**
   * Series whose last aired episode (within the announce window) differs from the last announced one.
   * `unwatched` applies the release-alert rule so the caller can mark without notifying.
   */
  async pendingAnnouncements(
    today: string,
  ): Promise<{ id: string; title: string; episode: AiredEpisode; unwatched: boolean }[]> {
    const rows = await this.db
      .select({
        id: mediaItems.id,
        title: mediaItems.title,
        season: mediaItems.lastEpisodeSeason,
        episode: mediaItems.lastEpisodeNumber,
        name: mediaItems.lastEpisodeName,
        airDate: mediaItems.lastEpisodeAirDate,
        unwatched: hasNewEpisode(today),
      })
      .from(mediaItems)
      .where(
        and(
          hasActivity(),
          eq(mediaItems.mediaType, 'tv'),
          sql`${mediaItems.lastEpisodeAirDate} is not null`,
          sql`${mediaItems.lastEpisodeAirDate} <= ${today}::date`,
          sql`${mediaItems.lastEpisodeAirDate} >= (${today}::date - ${ANNOUNCE_WINDOW_DAYS}::int)`,
          sql`(${mediaItems.notifiedEpisodeSeason} is distinct from ${mediaItems.lastEpisodeSeason}
            or ${mediaItems.notifiedEpisodeNumber} is distinct from ${mediaItems.lastEpisodeNumber})`,
        ),
      )
      .orderBy(asc(mediaItems.lastEpisodeAirDate), asc(mediaItems.id));
    return rows.flatMap((r) => {
      const episode = episodeRef(r.season, r.episode, r.name, r.airDate);
      return episode ? [{ id: r.id, title: r.title, episode, unwatched: r.unwatched }] : [];
    });
  }

  async markAnnounced(itemId: string, episode: AiredEpisode): Promise<void> {
    await this.db
      .update(mediaItems)
      .set({
        notifiedEpisodeSeason: episode.seasonNumber,
        notifiedEpisodeNumber: episode.episodeNumber,
      })
      .where(eq(mediaItems.id, itemId));
  }

  /** Running series in the library whose snapshot has not been refreshed since `before`. */
  async staleShows(before: Date, limit: number): Promise<MediaItemRow[]> {
    return this.db
      .select()
      .from(mediaItems)
      .where(
        and(
          hasActivity(),
          eq(mediaItems.mediaType, 'tv'),
          or(isNull(mediaItems.status), notInArray(mediaItems.status, ['Ended', 'Canceled'])),
          or(isNull(mediaItems.metadataRefreshedAt), lt(mediaItems.metadataRefreshedAt, before)),
        ),
      )
      .orderBy(sql`${mediaItems.metadataRefreshedAt} asc nulls first`)
      .limit(limit);
  }

  /** One row per title, described by its most recent event (log or episode watch), newest first. */
  async publicRecent(limit: number, type: MediaTypeFilter = 'all'): Promise<PublicRecentItem[]> {
    const events = sql`(
      select w.media_item_id, w.watched_on, w.created_at, w.season, null::int as episode from ${watchEntries} w
      union all
      select ew.media_item_id, ew.watched_on, ew.created_at, ew.season_number, ew.episode_number from ${episodeWatches} ew
    )`;
    const rows = await this.db.execute(sql`
      select ${mediaItems}.media_type as media_type, ${mediaItems}.tmdb_id as tmdb_id, ${mediaItems}.title as title,
        ${mediaItems}.release_year as release_year, ${mediaItems}.poster_path as poster_path,
        ${displayedRating()} as rating,
        latest.watched_on::text as watched_on, latest.season as season, latest.episode as episode
      from (
        select distinct on (ev.media_item_id) ev.media_item_id, ev.watched_on, ev.created_at, ev.season, ev.episode
        from ${events} ev
        order by ev.media_item_id, ev.watched_on desc, ev.created_at desc, ev.season desc nulls last, ev.episode desc nulls last
      ) latest
      join ${mediaItems} on ${mediaItems}.id = latest.media_item_id
      where ${type === 'all' ? sql`true` : sql`${mediaItems}.media_type = ${type}`}
      order by latest.watched_on desc, latest.created_at desc
      limit ${limit}`);
    const list = Array.isArray(rows) ? rows : ((rows as unknown as { rows: unknown[] }).rows ?? []);
    return (list as unknown as Array<Record<string, unknown>>).map((r) => ({
      mediaType: r.media_type as 'movie' | 'tv',
      title: r.title as string,
      year: (r.release_year as number | null) ?? null,
      posterUrl: tmdbPosterUrl(r.poster_path as string | null),
      rating: (r.rating as number | null) ?? null,
      watchedOn: r.watched_on as string,
      season: r.media_type === 'tv' ? ((r.season as number | null) ?? null) : null,
      episode: r.media_type === 'tv' ? ((r.episode as number | null) ?? null) : null,
      tmdbUrl: tmdbTitleUrl(r.media_type as 'movie' | 'tv', r.tmdb_id as number),
    }));
  }
}
