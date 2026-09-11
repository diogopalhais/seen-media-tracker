import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { type Db, MIGRATIONS_FOLDER, schema } from './client.js';

export interface PgliteDb {
  db: Db;
  close: () => Promise<void>;
}

/** In-process Postgres for tests: fresh, migrated with the committed SQL, no container needed. */
export async function createPgliteDb(): Promise<PgliteDb> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => client.close() };
}
