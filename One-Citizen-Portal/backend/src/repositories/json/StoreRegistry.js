// Manages JsonStore instances and cross-collection transactions (unit of work).
// withTransaction gives multi-collection atomicity by snapshotting enlisted stores and
// deferring their writes until commit; on error, snapshots are restored (rollback).
import { JsonStore } from './JsonStore.js';

export class StoreRegistry {
  constructor() {
    this.stores = new Map();     // filePath -> JsonStore
    this.inTx = false;
    this._snapshots = null;      // filePath -> serialized snapshot (during tx)
    this._afterCommit = null;    // hooks run after a successful commit (outbox dispatch)
    this._afterRollback = null;  // hooks run after a rollback
  }

  /** Register a callback to run after the current tx commits (or immediately if none). */
  afterCommit(fn) {
    if (this.inTx) this._afterCommit.push(fn);
    else return fn();
    return undefined;
  }

  /** Register a callback to run after the current tx rolls back (no-op outside a tx). */
  afterRollback(fn) {
    if (this.inTx) this._afterRollback.push(fn);
  }

  _endTx() {
    this.inTx = false;
    this._snapshots = null;
    this._afterCommit = null;
    this._afterRollback = null;
  }

  getStore(filePath, opts) {
    let store = this.stores.get(filePath);
    if (!store) {
      store = new JsonStore(filePath, opts);
      this.stores.set(filePath, store);
    }
    return store;
  }

  /** Called by a repository just before mutating a store, while a tx is active. */
  enlist(store) {
    if (!this.inTx) return;
    if (!this._snapshots.has(store.filePath)) {
      this._snapshots.set(store.filePath, store.snapshot());
      store.deferPersist = true;
    }
  }

  /**
   * Run `fn` as a unit of work. Nested calls join the outer transaction.
   * @template T @param {() => Promise<T>} fn @returns {Promise<T>}
   */
  async withTransaction(fn) {
    if (this.inTx) return fn(); // nested — join outer tx

    this.inTx = true;
    this._snapshots = new Map();
    const commitHooks = (this._afterCommit = []);
    const rollbackHooks = (this._afterRollback = []);
    try {
      const result = await fn();
      // commit: flush every enlisted store, then clear deferral
      for (const filePath of this._snapshots.keys()) {
        const store = this.stores.get(filePath);
        store.deferPersist = false;
        if (store.dirty) await store.persist();
      }
      this._endTx();
      // run post-commit hooks (outbox dispatch) — tx is over, so hook writes persist normally
      for (const hook of commitHooks) await hook();
      return result;
    } catch (err) {
      // rollback: restore snapshots, drop deferred writes and any pending dispatch
      for (const [filePath, snap] of this._snapshots) {
        const store = this.stores.get(filePath);
        store.restore(snap);
        store.deferPersist = false;
      }
      this._endTx();
      for (const hook of rollbackHooks) {
        try {
          await hook();
        } catch {
          /* rollback hooks are best-effort */
        }
      }
      throw err;
    }
  }
}
