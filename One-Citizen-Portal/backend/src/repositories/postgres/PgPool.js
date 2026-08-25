// Lazy PostgreSQL connection pool. `pg` is imported ONLY here and ONLY on first use,
// so selecting the JSON driver (or running tests) never requires the pg package to be
// installed. The pool is a process singleton keyed by nothing — one app, one pool.
import { logger } from '../../lib/logger.js';
import { describeDatabase } from '../../config/database.js';

const log = logger.child ? logger.child({ mod: 'pg.pool' }) : logger;

let _poolPromise = null;

/**
 * Get (or lazily create) the shared pg Pool.
 * @param {import('pg').PoolConfig} config
 * @returns {Promise<import('pg').Pool>}
 */
export function getPool(config) {
  if (!_poolPromise) {
    _poolPromise = (async () => {
      const pg = await import('pg'); // lazy — throws a clear error only if pg is missing
      const Pool = pg.default?.Pool || pg.Pool;
      const pool = new Pool(config);
      pool.on('error', (err) => log.error({ err: err.message }, 'idle pg client error'));
      log.info({ db: describeDatabase() }, 'postgres pool created');
      return pool;
    })();
  }
  return _poolPromise;
}

/** Close the pool (graceful shutdown / tests). */
export async function closePool() {
  if (!_poolPromise) return;
  const pool = await _poolPromise;
  _poolPromise = null;
  await pool.end();
}
