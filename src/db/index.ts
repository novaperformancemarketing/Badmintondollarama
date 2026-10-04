import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

declare global {
  var __smashDb: Promise<Db> | undefined;
}

/**
 * Production (Vercel) uses Neon Postgres via DATABASE_URL.
 * Local development falls back to an embedded PGlite database in .data/,
 * migrated automatically, so the app runs with zero setup.
 */
async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    return drizzle(neon(url), { schema }) as unknown as Db;
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set. Connect a Neon database to this Vercel project.');
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  // Cache the connection, but let a failed attempt retry on the next request.
  globalThis.__smashDb ??= connect().catch((err) => {
    globalThis.__smashDb = undefined;
    throw err;
  });
  return globalThis.__smashDb;
}

export { schema };
