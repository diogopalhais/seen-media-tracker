import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';
import type { Logger } from '../logger.js';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

/**
 * Locates the committed SQL migrations whether we run from source (src/db), from the esbuild bundle
 * (dist/index.js), from the package directory, or from the repository root (root-level vitest).
 */
function locateMigrations(): string {
  if (process.env.MIGRATIONS_DIR) return resolve(process.env.MIGRATIONS_DIR);
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../drizzle'),
    resolve(here, '../drizzle'),
    resolve(process.cwd(), 'drizzle'),
    resolve(process.cwd(), 'apps/api/drizzle'),
  ];
  return candidates.find((c) => existsSync(c)) ?? resolve(here, '../../drizzle');
}

export const MIGRATIONS_FOLDER = locateMigrations();

/** Arbitrary constant key so every API instance contends for the same lock while migrating. */
const MIGRATION_LOCK_KEY = 724_590_113;

export interface PostgresDb {
  db: Db;
  sql: Sql;
  close: () => Promise<void>;
}

export function createPostgresDb(databaseUrl: string): PostgresDb {
  const sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  });
  const db = drizzlePostgres(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export interface WaitOptions {
  attempts?: number;
  delayMs?: number;
  logger?: Logger;
}

/** Bounded retry until Postgres answers a trivial query; Compose ordering does not cover every restart. */
export async function waitForDatabase(sql: Sql, opts: WaitOptions = {}): Promise<void> {
  const attempts = opts.attempts ?? 30;
  const delayMs = opts.delayMs ?? 1000;
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await sql`select 1`;
      return;
    } catch (err) {
      lastError = err;
      opts.logger?.warn({ attempt: i, attempts, err }, 'database not ready yet');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Database did not become ready after ${attempts} attempts`, { cause: lastError });
}

/** Runs pending migrations on a dedicated single connection under an advisory lock. */
export async function runMigrations(databaseUrl: string, logger?: Logger): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    try {
      await migratePostgres(drizzlePostgres(sql, { schema }), {
        migrationsFolder: MIGRATIONS_FOLDER,
      });
      logger?.info('database migrations applied');
    } finally {
      await sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
