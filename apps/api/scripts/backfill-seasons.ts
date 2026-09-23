/**
 * Stores the season list on every series snapshot that predates the `seasons` column, so the
 * library can report progress ("3 left", "Up to date") without waiting for the lazy refresh.
 * Usage: pnpm --filter @seen/api backfill-seasons   (reads apps/api/.env)
 */
import { and, eq, isNull } from 'drizzle-orm';
import { loadConfig } from '../src/config.js';
import { createPostgresDb } from '../src/db/client.js';
import { mediaItems } from '../src/db/schema.js';
import { LibraryRepository } from '../src/services/library.js';
import { TmdbProvider } from '../src/services/metadata/tmdb.js';

const CONCURRENCY = 4;

async function main(): Promise<void> {
  const config = loadConfig();
  const pg = createPostgresDb(config.DATABASE_URL);
  const library = new LibraryRepository(pg.db);
  const provider = new TmdbProvider({
    token: config.TMDB_API_TOKEN,
    language: config.TMDB_LANGUAGE,
  });
  const queue = await pg.db
    .select({ tmdbId: mediaItems.tmdbId, title: mediaItems.title })
    .from(mediaItems)
    .where(and(eq(mediaItems.mediaType, 'tv'), isNull(mediaItems.seasons)));
  process.stdout.write(`Backfilling ${queue.length} series…\n`);
  let done = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          await library.upsertItem(await provider.tvDetails(row.tmdbId), new Date());
          done++;
        } catch (err) {
          failed++;
          console.error(`  failed: ${row.title} (${row.tmdbId}): ${(err as Error).message}`);
        }
      }
    }),
  );
  process.stdout.write(`Done: ${done} updated, ${failed} failed.\n`);
  await pg.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
