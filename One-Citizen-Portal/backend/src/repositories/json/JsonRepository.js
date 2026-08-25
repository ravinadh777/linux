// JSON adapter implementing the Repository contract (Architecture §6.4, §7).
// Scope filtering, optimistic concurrency, cursor pagination, soft-delete and
// transactions are all expressed here so a PostgresRepository can replace it 1:1.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  Repository,
  assertCtx,
  isVisible,
  matchesQuery,
  paginate,
} from '../base/Repository.js';
import { ConflictError } from '../../lib/errors.js';
import { newId } from '../../lib/id.js';
import { Mutex } from '../../lib/mutex.js';

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const nowIso = () => new Date().toISOString();

export class JsonRepository extends Repository {
  /**
   * @param {Object} cfg
   * @param {import('./StoreRegistry.js').StoreRegistry} cfg.registry
   * @param {string} cfg.filePath
   * @param {string} cfg.prefix        - id prefix (e.g. 'doc')
   * @param {boolean} [cfg.appendOnly] - audit/events: create-only, no update/delete
   * @param {boolean} [cfg.softDelete] - delete sets deletedAt instead of removing
   */
  constructor({ registry, filePath, prefix, appendOnly = false, softDelete = false }) {
    super();
    this.registry = registry;
    this.filePath = filePath;
    this.prefix = prefix;
    this.appendOnly = appendOnly;
    this.softDelete = softDelete;
    this.store = registry.getStore(filePath, { appendOnly });
    this.mutex = new Mutex();
  }

  async _ready() {
    await this.store.load();
  }

  async findById(id, ctx) {
    assertCtx(ctx);
    await this._ready();
    const found = this.store.data.find((r) => r.id === id && !r.deletedAt);
    if (!found || !isVisible(found, ctx)) return null;
    return clone(found);
  }

  async find(query, ctx, opts = {}) {
    assertCtx(ctx);
    await this._ready();
    const visible = this.store.data.filter(
      (r) => !r.deletedAt && isVisible(r, ctx) && matchesQuery(r, query),
    );
    const { items, nextCursor } = paginate(visible, opts);
    return { items: items.map(clone), nextCursor };
  }

  async create(entity, ctx) {
    assertCtx(ctx);
    await this._ready();
    return this.mutex.runExclusive(async () => {
      this.registry.enlist(this.store);
      const ts = nowIso();
      const record = {
        ...entity,
        id: entity.id || newId(this.prefix),
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      };
      this.store.data.push(record);
      await this.store.persist();
      return clone(record);
    });
  }

  async update(id, patch, expectedVersion, ctx) {
    assertCtx(ctx);
    if (this.appendOnly) throw new Error(`Repository '${this.prefix}' is append-only; update is not allowed.`);
    if (expectedVersion === undefined || expectedVersion === null) {
      throw new Error('update requires expectedVersion for optimistic concurrency.');
    }
    await this._ready();
    return this.mutex.runExclusive(async () => {
      this.registry.enlist(this.store);
      const idx = this.store.data.findIndex((r) => r.id === id && !r.deletedAt);
      const current = idx >= 0 ? this.store.data[idx] : null;
      // Not visible in scope → behave as not found (never leak existence).
      this._requireVisible(current, ctx);
      if (current.version !== expectedVersion) {
        throw new ConflictError(
          `Version conflict on ${this.prefix} ${id}`,
          [{ field: 'version', expected: expectedVersion, actual: current.version }],
        );
      }
      const updated = {
        ...current,
        ...patch,
        id: current.id, // immutable system fields
        createdAt: current.createdAt,
        version: current.version + 1,
        updatedAt: nowIso(),
      };
      this.store.data[idx] = updated;
      await this.store.persist();
      return clone(updated);
    });
  }

  async delete(id, ctx) {
    assertCtx(ctx);
    if (this.appendOnly) throw new Error(`Repository '${this.prefix}' is append-only; delete is not allowed.`);
    await this._ready();
    return this.mutex.runExclusive(async () => {
      this.registry.enlist(this.store);
      const idx = this.store.data.findIndex((r) => r.id === id && !r.deletedAt);
      const current = idx >= 0 ? this.store.data[idx] : null;
      this._requireVisible(current, ctx);
      if (this.softDelete) {
        this.store.data[idx] = { ...current, deletedAt: nowIso(), version: current.version + 1 };
      } else {
        this.store.data.splice(idx, 1);
      }
      await this.store.persist();
      return { id, deleted: true, soft: this.softDelete };
    });
  }

  /** Append-only helper (audit/events) — same as create but semantically explicit. */
  async append(entity) {
    if (!this.appendOnly) throw new Error(`Repository '${this.prefix}' is not append-only.`);
    await this._ready();
    return this.mutex.runExclusive(async () => {
      this.registry.enlist(this.store);
      const record = { ...entity, id: entity.id || newId(this.prefix), createdAt: nowIso() };
      this.store.data.push(record);
      await this.store.persist();
      return clone(record);
    });
  }

  withTransaction(fn) {
    return this.registry.withTransaction(fn);
  }
}

/** Utility used by the seed loader / reset (not part of the Repository contract). */
export async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
export const _pathJoin = path.join;
