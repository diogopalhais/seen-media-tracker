import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { ConfigError, igdbConfig, loadConfig, steamConfig, vapidConfig } from './config.js';
import { createPostgresDb, runMigrations, waitForDatabase } from './db/client.js';
import { createLogger } from './logger.js';
import { CachedMetadataProvider } from './services/metadata/cached.js';
import { CompositeProvider, GamesNotConfigured } from './services/metadata/composite.js';
import { IgdbProvider } from './services/metadata/igdb.js';
import { TmdbProvider } from './services/metadata/tmdb.js';
import { WebPushPusher } from './services/push.js';
import { SteamClient } from './services/steam.js';
import { APP_VERSION } from './version.js';

async function main(): Promise<void> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger(config.LOG_LEVEL, config.NODE_ENV === 'development');
  logger.info({ version: APP_VERSION, env: config.NODE_ENV }, 'starting seen-api');

  const pg = createPostgresDb(config.DATABASE_URL);
  await waitForDatabase(pg.sql, { logger });
  await runMigrations(config.DATABASE_URL, logger);

  const igdb = igdbConfig(config);
  const provider = new CachedMetadataProvider(
    new CompositeProvider(
      new TmdbProvider({ token: config.TMDB_API_TOKEN, language: config.TMDB_LANGUAGE }),
      igdb ? new IgdbProvider(igdb) : new GamesNotConfigured(),
    ),
  );
  const vapid = vapidConfig(config);
  const steam = steamConfig(config);
  const { app, notifier, steamSync } = createApp({
    config,
    db: pg.db,
    provider,
    features: { games: igdb !== null, steam: steam !== null },
    logger,
    push: vapid ? { pusher: new WebPushPusher(vapid), publicKey: vapid.publicKey } : null,
    steam: steam
      ? { source: new SteamClient({ apiKey: steam.apiKey }), steamId: steam.steamId }
      : null,
  });
  logger.info(
    { push: vapid !== null },
    vapid ? 'push notifications enabled' : 'push notifications disabled (no VAPID keys)',
  );
  logger.info(
    { games: igdb !== null },
    igdb ? 'games enabled (IGDB)' : 'games disabled (no IGDB credentials)',
  );
  logger.info(
    { steam: steam !== null },
    steam ? 'steam sync enabled' : 'steam sync disabled (no STEAM_API_KEY / STEAM_ID)',
  );
  const stopNotifier = notifier.start();
  const stopSteam = steamSync?.start() ?? (() => {});

  const server = serve({ fetch: app.fetch, port: config.PORT, hostname: '0.0.0.0' }, (info) => {
    logger.info({ port: info.port }, 'listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    stopNotifier();
    stopSteam();
    const forceExit = setTimeout(() => {
      logger.error('forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
    server.close(async (err) => {
      if (err) logger.error({ err }, 'error closing http server');
      try {
        await pg.close();
      } catch (closeErr) {
        logger.error({ err: closeErr }, 'error closing database pool');
      }
      clearTimeout(forceExit);
      process.exit(err ? 1 : 0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
