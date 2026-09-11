import type { Genre } from '@seen/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const mediaTypeEnum = pgEnum('media_type', ['movie', 'tv']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
};

export const mediaItems = pgTable(
  'media_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaType: mediaTypeEnum('media_type').notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    title: text('title').notNull(),
    originalTitle: text('original_title').notNull(),
    releaseYear: integer('release_year'),
    releaseDate: date('release_date', { mode: 'string' }),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    overview: text('overview').notNull().default(''),
    genres: jsonb('genres').$type<Genre[]>().notNull().default([]),
    runtimeMinutes: integer('runtime_minutes'),
    numberOfSeasons: integer('number_of_seasons'),
    ...timestamps,
  },
  (t) => [uniqueIndex('media_items_type_tmdb_uidx').on(t.mediaType, t.tmdbId)],
);

export const watchEntries = pgTable(
  'watch_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    watchedOn: date('watched_on', { mode: 'string' }).notNull(),
    rating: smallint('rating'),
    season: integer('season'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    index('watch_entries_watched_idx').on(t.watchedOn.desc(), t.createdAt.desc()),
    index('watch_entries_item_idx').on(t.mediaItemId),
    check('watch_entries_rating_check', sql`${t.rating} is null or (${t.rating} between 1 and 10)`),
    check('watch_entries_season_check', sql`${t.season} is null or ${t.season} >= 0`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    userAgent: text('user_agent'),
  },
  (t) => [uniqueIndex('sessions_token_hash_uidx').on(t.tokenHash)],
);

export type MediaItemRow = typeof mediaItems.$inferSelect;
export type WatchEntryRow = typeof watchEntries.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
