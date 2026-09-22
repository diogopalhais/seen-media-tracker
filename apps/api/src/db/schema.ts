import type { Genre, Season } from '@seen/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
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
    // Season list (episode counts and premieres) so progress can be derived without the provider.
    seasons: jsonb('seasons').$type<Season[]>(),
    tmdbVoteAverage: real('tmdb_vote_average'),
    tmdbVoteCount: integer('tmdb_vote_count'),
    // Broadcast state used for release alerts; refreshed lazily for running series.
    status: text('status'),
    lastEpisodeSeason: integer('last_episode_season'),
    lastEpisodeNumber: integer('last_episode_number'),
    lastEpisodeName: text('last_episode_name'),
    lastEpisodeAirDate: date('last_episode_air_date', { mode: 'string' }),
    nextEpisodeSeason: integer('next_episode_season'),
    nextEpisodeNumber: integer('next_episode_number'),
    nextEpisodeName: text('next_episode_name'),
    nextEpisodeAirDate: date('next_episode_air_date', { mode: 'string' }),
    metadataRefreshedAt: timestamp('metadata_refreshed_at', { withTimezone: true, mode: 'date' }),
    // Last episode the notifier announced (or knew about when the item was created).
    notifiedEpisodeSeason: integer('notified_episode_season'),
    notifiedEpisodeNumber: integer('notified_episode_number'),
    // Set when the owner stopped following the series: no release alerts, no notifications.
    mutedAt: timestamp('muted_at', { withTimezone: true, mode: 'date' }),
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

export const episodeWatches = pgTable(
  'episode_watches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    watchedOn: date('watched_on', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('episode_watches_item_episode_uidx').on(
      t.mediaItemId,
      t.seasonNumber,
      t.episodeNumber,
    ),
    index('episode_watches_watched_idx').on(t.watchedOn.desc(), t.createdAt.desc()),
    check('episode_watches_numbers_check', sql`${t.seasonNumber} >= 0 and ${t.episodeNumber} >= 0`),
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

/** Web Push subscriptions of the owner's devices. One row per endpoint. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('push_subscriptions_endpoint_uidx').on(t.endpoint)],
);

export type MediaItemRow = typeof mediaItems.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type WatchEntryRow = typeof watchEntries.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type EpisodeWatchRow = typeof episodeWatches.$inferSelect;
