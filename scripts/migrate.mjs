// Applies SQL migrations in ./drizzle to the Neon database before `next build`.
// Skipped when DATABASE_URL is not set (local dev migrates PGlite on first use).
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] DATABASE_URL not set, skipping.');
  process.exit(0);
}

await migrate(drizzle(neon(url)), { migrationsFolder: './drizzle' });
console.log('[migrate] Database is up to date.');
