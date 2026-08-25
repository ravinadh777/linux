// Database configuration builder (config layer). Translates env into a node-postgres
// pool config. DATABASE_URL takes precedence (12-factor / managed-Postgres friendly);
// otherwise the discrete PG* parts are used. Nothing here imports `pg` — the driver is
// loaded lazily only when the postgres persistence driver is actually selected.
import { env } from './env.js';

/** @returns {import('pg').PoolConfig} */
export function buildDatabaseConfig() {
  const common = {
    max: env.PG_POOL_MAX,
    idleTimeoutMillis: env.PG_POOL_IDLE_MS,
    connectionTimeoutMillis: env.PG_CONNECT_TIMEOUT_MS,
    ssl: env.PGSSL ? { rejectUnauthorized: false } : false,
  };
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL, ...common };
  }
  return {
    host: env.PGHOST,
    port: env.PGPORT,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    ...common,
  };
}

/** A redacted descriptor for logs (never logs the password). */
export function describeDatabase() {
  if (env.DATABASE_URL) {
    try {
      const u = new URL(env.DATABASE_URL);
      return `${u.protocol}//${u.username}@${u.host}${u.pathname}`;
    } catch {
      return 'postgres (DATABASE_URL)';
    }
  }
  return `postgres://${env.PGUSER}@${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}`;
}
