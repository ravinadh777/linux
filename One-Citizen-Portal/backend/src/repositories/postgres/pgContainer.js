// Postgres container — the driver-specific counterpart of the JSON container. Returns the
// SAME shape { driver, registry, repository, withTransaction } so context.js and every
// service are 100% driver-agnostic (Architecture §7 — swap the driver, not the callers).
import { PgRegistry } from './PgRegistry.js';
import { PostgresRepository } from './PostgresRepository.js';
import { COLUMN_MAP } from './schema.js';

/** Collection name (+ optional subdir) → clean, stable table name (subdir is filesystem-only). */
function tableNameFor(name, opts) {
  if (opts.file) return opts.file.replace(/\.json$/, '').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  return name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

/**
 * @param {Object} cfg
 * @param {import('pg').PoolConfig} cfg.dbConfig
 */
export function createPostgresContainer({ dbConfig }) {
  const registry = new PgRegistry(dbConfig);
  const repositories = new Map();

  function repository(name, opts = {}) {
    if (repositories.has(name)) return repositories.get(name);
    const table = tableNameFor(name, opts);
    const repo = new PostgresRepository({
      registry,
      table,
      prefix: opts.prefix || name,
      appendOnly: opts.appendOnly || false,
      softDelete: opts.softDelete || false,
      columns: COLUMN_MAP[table] || [], // promoted columns for rich tables; [] = generic doc table
    });
    repositories.set(name, repo);
    return repo;
  }

  return {
    driver: 'postgres',
    registry,
    repository,
    withTransaction: (fn) => registry.withTransaction(fn),
  };
}
