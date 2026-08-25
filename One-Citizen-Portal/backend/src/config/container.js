// Dependency-injection container. Binds PERSISTENCE_DRIVER → repository implementation.
// Both drivers return the SAME shape { driver, registry, repository, withTransaction } so
// services never change when the driver does (Architecture §7). Postgres wiring is lazy —
// its module (and `pg`) is only imported when the postgres driver is selected.
import path from 'node:path';
import { StoreRegistry } from '../repositories/json/StoreRegistry.js';
import { JsonRepository } from '../repositories/json/JsonRepository.js';
import { createPostgresContainer } from '../repositories/postgres/pgContainer.js';

/**
 * @param {Object} cfg
 * @param {'json'|'postgres'} [cfg.driver]
 * @param {string} [cfg.dataDir]  - data directory (json driver only)
 * @param {import('pg').PoolConfig} [cfg.dbConfig] - connection config (postgres driver only)
 */
export function createContainer({ driver = 'json', dataDir, dbConfig }) {
  if (driver === 'postgres') {
    return createPostgresContainer({ dbConfig });
  }
  if (driver !== 'json') {
    throw new Error(`Unsupported PERSISTENCE_DRIVER '${driver}'. Use 'json' or 'postgres'.`);
  }
  if (!dataDir) throw new Error('createContainer requires dataDir for the json driver.');

  const registry = new StoreRegistry();
  const storeRoot = path.resolve(dataDir, 'store');
  const repositories = new Map();

  /**
   * Get (or lazily create) a named repository.
   * @param {string} name
   * @param {Object} [opts] - { prefix?, appendOnly?, softDelete?, file?, subdir? }
   */
  function repository(name, opts = {}) {
    if (repositories.has(name)) return repositories.get(name);
    const file = opts.file || `${name}.json`;
    const filePath = opts.subdir ? path.join(storeRoot, opts.subdir, file) : path.join(storeRoot, file);
    const repo = new JsonRepository({
      registry,
      filePath,
      prefix: opts.prefix || name,
      appendOnly: opts.appendOnly || false,
      softDelete: opts.softDelete || false,
    });
    repositories.set(name, repo);
    return repo;
  }

  return {
    driver,
    registry,
    repository,
    withTransaction: (fn) => registry.withTransaction(fn),
  };
}
