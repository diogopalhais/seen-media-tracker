import {
  type EpisodeWatch,
  type LibraryItemDetail,
  type LibraryItemSummary,
  type LibraryListQuery,
  type LibraryMembership,
  type MediaItem,
  type MediaType,
  type PublicRecentItem,
  tmdbBackdropUrl,
  tmdbPosterUrl,
  tmdbTitleUrl,
  toTmdbRating,
  type UpdateWatchRequest,
  type WatchEntry,
} from '@seen/shared';
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
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

  async list(
    query: LibraryListQuery,
  ): Promise<{ items: LibraryItemSummary[]; nextCursor: string | null }> {
    const offset = decodeCursor(query.cursor);
    const rating = displayedRating();
    const last = lastWatchedOn();
    const count = watchCount();
    const season = lastSeason();

    const episodes = episodesWatched();
    const conditions: SQL[] = [hasActivity()];
    if (query.type !== 'all') conditions.push(eq(mediaItems.mediaType, query.type));

    const order: SQL[] =
      query.sort === 'title'
        ? [asc(sql`lower(${mediaItems.title})`), asc(mediaItems.id)]
        : query.sort === 'rating'
          ? [sql`${rating} desc nulls last`, sql`${last} desc`, desc(mediaItems.id)]
          : [sql`${last} desc`, desc(mediaItems.createdAt), desc(mediaItems.id)];

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
        rating,
        lastWatchedOn: last,
        watchCount: count,
        episodesWatched: episodes,
        lastSeason: season,
      })
      .from(mediaItems)
      .where(and(...conditions))
      .orderBy(...order)
      .limit(query.limit + 1)
      .offset(offset);

    const page = rows.slice(0, query.limit);
    return {
      items: page.map((r) => ({
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
      })),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  /** One row per title, described by its most recent event (log or episode watch), newest first. */
  async publicRecent(limit: number): Promise<PublicRecentItem[]> {
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
