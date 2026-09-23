import type { SteamStatus, SteamSyncResult } from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { ApiError } from '../errors.js';
import type { SteamSync } from '../services/steam.js';
import type { AppEnv } from '../types.js';
import { mapProviderError } from './search.js';

export interface SteamDeps {
  /** Null when STEAM_API_KEY and STEAM_ID are not configured. */
  sync: SteamSync | null;
  requireAuth: MiddlewareHandler<AppEnv>;
}

const disabled: SteamStatus = {
  enabled: false,
  steamId: null,
  personaName: null,
  nowPlaying: null,
  gamesPlayed: 0,
  gamesLinked: 0,
  lastSyncAt: null,
  historyImported: false,
};

export function steamRoutes(deps: SteamDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  const enabled = (): SteamSync => {
    if (!deps.sync) throw new ApiError('steam_disabled', 'Steam is not configured on this server');
    return deps.sync;
  };

  router.get('/steam/status', deps.requireAuth, async (c) => {
    const body: SteamStatus = deps.sync ? await deps.sync.status() : disabled;
    return c.json(body, 200);
  });

  /** Records play time since the last sync; a game seen for the first time brings its whole total. */
  router.post('/steam/sync', deps.requireAuth, async (c) => {
    let body: SteamSyncResult;
    try {
      body = await enabled().runOnce();
    } catch (err) {
      mapProviderError(err);
    }
    return c.json(body, 200);
  });

  /** Retries games IGDB did not know and records any play time still missing. */
  router.post('/steam/import', deps.requireAuth, async (c) => {
    let body: SteamSyncResult;
    try {
      body = await enabled().importHistory();
    } catch (err) {
      mapProviderError(err);
    }
    return c.json(body, 200);
  });

  return router;
}
