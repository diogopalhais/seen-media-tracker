import { z } from 'zod';
import { IsoTimestampSchema } from './media.js';

export const PlaySourceSchema = z.enum(['steam']);
export type PlaySource = z.infer<typeof PlaySourceSchema>;

/**
 * Time spent in a game on one day, as reported by a connected account. Sessions on the same day
 * from the same source merge into one row.
 */
export const PlaySessionSchema = z.object({
  id: z.string(),
  mediaItemId: z.string(),
  source: PlaySourceSchema,
  playedOn: z.string(),
  minutes: z.number().int().min(0),
  createdAt: IsoTimestampSchema,
});
export type PlaySession = z.infer<typeof PlaySessionSchema>;

/** A library game's link to the owner's Steam account. */
export const SteamLinkSchema = z.object({
  appId: z.number().int(),
  minutesTotal: z.number().int().min(0),
  /** Minutes in the last two weeks, as Steam reports them. */
  minutesRecent: z.number().int().min(0),
  lastPlayedAt: IsoTimestampSchema.nullable(),
  storeUrl: z.url(),
});
export type SteamLink = z.infer<typeof SteamLinkSchema>;

export const SteamStatusSchema = z.object({
  enabled: z.boolean(),
  steamId: z.string().nullable(),
  /** Display name and current game, fetched live; null when Steam is unreachable. */
  personaName: z.string().nullable(),
  nowPlaying: z.object({ appId: z.number().int(), name: z.string() }).nullable(),
  /** Games in the owner's Steam library that have been played at all. */
  gamesPlayed: z.number().int().min(0),
  /** Played games matched to a title in the library. */
  gamesLinked: z.number().int().min(0),
  lastSyncAt: IsoTimestampSchema.nullable(),
  /** Whether a full history import has run. */
  historyImported: z.boolean(),
});
export type SteamStatus = z.infer<typeof SteamStatusSchema>;

export const SteamSyncResultSchema = z.object({
  /** Games seen in the Steam library this run. */
  games: z.number().int().min(0),
  /** Play sessions created or extended. */
  sessions: z.number().int().min(0),
  /** Games newly matched to a library title. */
  linked: z.number().int().min(0),
  /** Played games with no match at IGDB, so no library title. */
  unmatched: z.number().int().min(0),
});
export type SteamSyncResult = z.infer<typeof SteamSyncResultSchema>;

export function steamStoreUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}`;
}

/** "42h", "1h 05m", "35m". */
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 10 || m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
