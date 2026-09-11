import {
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
  type UpdateWatchRequest,
  type WatchEntry,
} from '@seen/shared';
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { type MediaItemRow, mediaItems, type WatchEntryRow, watchEntries } from '../db/schema.js';
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
    tmdbUrl: tmdbTitleUrl(row.mediaType, row.tmdbId),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

const lastWatchedOn = () => sql<string>`(
  select max(w.watched_on)::text from ${watchEntries} w where w.media_item_id = ${itemId})`;

const watchCount = () => sql<number>`(
  select count(*)::int from ${watchEntries} w where w.media_item_id = ${itemId})`;

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
      const [remaining] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(watchEntries)
        .where(eq(watchEntries.mediaItemId, deleted.mediaItemId));
      if ((remaining?.n ?? 0) === 0) {
        await tx.delete(mediaItems).where(eq(mediaItems.id, deleted.mediaItemId));
      }
      return true;
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

    const conditions: SQL[] = [
      sql`exists (select 1 from ${watchEntries} w where w.media_item_id = ${itemId})`,
    ];
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
        rating,
        lastWatchedOn: last,
        watchCount: count,
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
        lastWatchedOn: r.lastWatchedOn,
        watchCount: r.watchCount,
        lastSeason: r.lastSeason,
      })),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  /** One row per title, described by its most recent watch, newest first. */
  async publicRecent(limit: number): Promise<PublicRecentItem[]> {
    const latest = this.db
      .selectDistinctOn([watchEntries.mediaItemId], {
        mediaItemId: watchEntries.mediaItemId,
        watchedOn: watchEntries.watchedOn,
        createdAt: watchEntries.createdAt,
        season: watchEntries.season,
      })
      .from(watchEntries)
      .orderBy(asc(watchEntries.mediaItemId), ...entryOrder)
      .as('latest');

    const rows = await this.db
      .select({
        mediaType: mediaItems.mediaType,
        tmdbId: mediaItems.tmdbId,
        title: mediaItems.title,
        releaseYear: mediaItems.releaseYear,
        posterPath: mediaItems.posterPath,
        rating: displayedRating(),
        watchedOn: latest.watchedOn,
        season: latest.season,
      })
      .from(latest)
      .innerJoin(mediaItems, eq(mediaItems.id, latest.mediaItemId))
      .orderBy(desc(latest.watchedOn), desc(latest.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      mediaType: r.mediaType,
      title: r.title,
      year: r.releaseYear,
      posterUrl: tmdbPosterUrl(r.posterPath),
      rating: r.rating,
      watchedOn: r.watchedOn,
      season: r.mediaType === 'tv' ? r.season : null,
      tmdbUrl: tmdbTitleUrl(r.mediaType, r.tmdbId),
    }));
  }
}
