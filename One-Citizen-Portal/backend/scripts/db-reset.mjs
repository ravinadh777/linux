// One-time DEV reset for the Postgres database.
//
// The auth refactor changed the schema (identities → users, ownership repointed to user_id).
// CREATE TABLE IF NOT EXISTS cannot retro-fit those changes onto an already-created database,
// so a dev DB that booted the old schema must be wiped once. This drops and recreates the
// `public` schema; the next app boot recreates the NEW schema via auto-migration and
// re-seeds only the service catalogue/reference config.
//
// DESTRUCTIVE: removes ALL tables and data. Intended for development only.
// Run: npm run db:reset   (from the backend workspace)
import pg from 'pg';
import { buildDatabaseConfig, describeDatabase } from '../src/config/database.js';

async function run() {
  const pool = new pg.Pool(buildDatabaseConfig());
  try {
    console.log(`[db:reset] target ${describeDatabase()}`);
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await pool.query('CREATE SCHEMA public;');
    console.log('[db:reset] public schema dropped and recreated. Boot the API to re-migrate.');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[db:reset] failed:', err.message);
  process.exitCode = 1;
});
