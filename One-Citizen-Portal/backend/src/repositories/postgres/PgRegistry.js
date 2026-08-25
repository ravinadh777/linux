// Transaction registry for the Postgres driver — the API-compatible counterpart of the
// JSON StoreRegistry. It provides the SAME surface the app already depends on:
//   • query(text, params)      — routes to the active tx client, else the pool
//   • withTransaction(fn)      — real BEGIN/COMMIT/ROLLBACK; nested calls join the outer tx
//   • afterCommit(fn)          — run after the tx commits (outbox dispatch); immediate if none
//   • afterRollback(fn)        — run after the tx rolls back
// The active transaction's client is carried implicitly via AsyncLocalStorage, so
// repositories never need a client passed to them (identical ergonomics to the JSON driver).
import { AsyncLocalStorage } from 'node:async_hooks';
import { getPool } from './PgPool.js';

export class PgRegistry {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.als = new AsyncLocalStorage();
  }

  _pool() {
    return getPool(this.dbConfig);
  }

  /** Run a query on the active tx client if inside a transaction, else on the pool. */
  async query(text, params) {
    const store = this.als.getStore();
    if (store) return store.client.query(text, params);
    const pool = await this._pool();
    return pool.query(text, params);
  }

  afterCommit(fn) {
    const store = this.als.getStore();
    if (store) {
      store.commitHooks.push(fn);
      return undefined;
    }
    return fn();
  }

  afterRollback(fn) {
    const store = this.als.getStore();
    if (store) store.rollbackHooks.push(fn);
  }

  /** Unit of work. Nested calls join the outer transaction. */
  async withTransaction(fn) {
    if (this.als.getStore()) return fn(); // nested — join outer tx

    const pool = await this._pool();
    const client = await pool.connect();
    const store = { client, commitHooks: [], rollbackHooks: [] };
    return this.als.run(store, async () => {
      try {
        await client.query('BEGIN');
        const result = await fn();
        await client.query('COMMIT');
        for (const hook of store.commitHooks) await hook();
        return result;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
        for (const hook of store.rollbackHooks) {
          try { await hook(); } catch { /* rollback hooks are best-effort */ }
        }
        throw err;
      } finally {
        client.release();
      }
    });
  }
}
