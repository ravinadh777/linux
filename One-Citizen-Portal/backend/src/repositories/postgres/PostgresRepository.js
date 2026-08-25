// PostgreSQL adapter implementing the Repository contract (Architecture §6.4, §7).
// Storage model: one table per collection. The complete record lives in `data` (JSONB) so
// the domain's flexible document shapes work identically across drivers; in addition,
// configured fields are PROJECTED into real, typed, indexed columns (see schema.js
// COLUMN_MAP) — giving relations, workflow/audit columns and fast indexed queries that both
// the citizen app and the back-office app share. Scope filtering, optimistic concurrency,
// soft-delete, append-only and cursor pagination all match JsonRepository exactly (they
// reuse the shared base helpers), so business logic is 100% driver-agnostic.
import {
  Repository, assertCtx, isVisible, matchesQuery, paginate,
} from '../base/Repository.js';
import { ConflictError } from '../../lib/errors.js';
import { newId } from '../../lib/id.js';

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const nowIso = () => new Date().toISOString();
const q = (col) => `"${col.replace(/"/g, '')}"`;

/** Resolve a promoted column's value from a record. */
function colValue(spec, record) {
  const raw = spec.get ? spec.get(record) : record[spec.field];
  if (raw === undefined) return null;
  if (spec.type === 'jsonb') return raw === null ? null : JSON.stringify(raw);
  return raw;
}
const cast = (spec) => (spec.type === 'jsonb' ? '::jsonb' : '');

export class PostgresRepository extends Repository {
  /**
   * @param {Object} cfg
   * @param {import('./PgRegistry.js').PgRegistry} cfg.registry
   * @param {string} cfg.table
   * @param {string} cfg.prefix
   * @param {boolean} [cfg.appendOnly]
   * @param {boolean} [cfg.softDelete]
   * @param {Array<{col:string, field?:string, get?:Function, type?:string}>} [cfg.columns]
   */
  constructor({ registry, table, prefix, appendOnly = false, softDelete = false, columns = [] }) {
    super();
    this.registry = registry;
    this.table = table;
    this.prefix = prefix;
    this.appendOnly = appendOnly;
    this.softDelete = softDelete;
    this.columns = columns;
    this.promoted = columns.length > 0;
    // field → column, for indexed WHERE push-down on read.
    this._fieldCol = new Map(columns.filter((c) => c.field).map((c) => [c.field, c.col]));
    this._ensured = null;
  }

  _q(text, params) {
    return this.registry.query(text, params);
  }

  _t() {
    return q(this.table);
  }

  /**
   * Ensure the table exists. Promoted tables are owned by the migration (schema.js), so we
   * skip DDL for them; generic (unmapped) collections lazily create a document table so new
   * collections work without a migration entry.
   */
  async _ready() {
    if (this.promoted) return undefined;
    if (!this._ensured) {
      this._ensured = (async () => {
        const t = this._t();
        await this._q(
          `CREATE TABLE IF NOT EXISTS ${t} (
             id TEXT PRIMARY KEY, data JSONB NOT NULL, version INTEGER,
             created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
           )`,
        );
        await this._q(`CREATE INDEX IF NOT EXISTS "ix_${this.table}_created" ON ${t} (created_at, id)`);
      })().catch((err) => { this._ensured = null; throw err; });
    }
    return this._ensured;
  }

  async findById(id, ctx) {
    assertCtx(ctx);
    await this._ready();
    const { rows } = await this._q(`SELECT data FROM ${this._t()} WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const rec = rows[0]?.data;
    if (!rec || !isVisible(rec, ctx)) return null;
    return clone(rec);
  }

  async find(query, ctx, opts = {}) {
    assertCtx(ctx);
    await this._ready();
    const conds = ['deleted_at IS NULL'];
    const params = [];
    const addEq = (col, val) => {
      params.push(val);
      conds.push(Array.isArray(val) ? `${q(col)} = ANY($${params.length})` : `${q(col)} = $${params.length}`);
    };
    // Push down promoted equality filters to indexed SQL; the JS pass below still runs so
    // non-promoted keys and predicate scopes stay exact (parity with the JSON driver).
    const pushable = (v) => v !== undefined && (typeof v !== 'object' || Array.isArray(v));
    const where = ctx.scope?.where;
    if (where) for (const [k, v] of Object.entries(where)) {
      const col = this._fieldCol.get(k);
      if (col && pushable(v)) addEq(col, v);
    }
    if (query) for (const [k, v] of Object.entries(query)) {
      const col = this._fieldCol.get(k);
      if (col && pushable(v)) addEq(col, v);
    }
    const { rows } = await this._q(`SELECT data FROM ${this._t()} WHERE ${conds.join(' AND ')}`, params);
    const visible = rows?.map((r) => r.data).filter((r) => isVisible(r, ctx) && matchesQuery(r, query));
    const { items, nextCursor } = paginate(visible, opts);
    return { items: items.map(clone), nextCursor };
  }

  async create(entity, ctx) {
    assertCtx(ctx);
    await this._ready();
    const ts = nowIso();
    const record = { ...entity, id: entity.id || newId(this.prefix), version: 1, createdAt: ts, updatedAt: ts };
    const cols = ['id', 'data', 'version', 'created_at', 'updated_at'];
    const vals = [record.id, JSON.stringify(record), record.version, ts, ts];
    const casts = ['', '::jsonb', '', '', ''];
    for (const spec of this.columns) { cols.push(spec.col); vals.push(colValue(spec, record)); casts.push(cast(spec)); }
    const placeholders = cols.map((_, i) => `$${i + 1}${casts[i]}`);
    await this._q(`INSERT INTO ${this._t()} (${cols.map(q).join(', ')}) VALUES (${placeholders.join(', ')})`, vals);
    return clone(record);
  }

  async update(id, patch, expectedVersion, ctx) {
    assertCtx(ctx);
    if (this.appendOnly) throw new Error(`Repository '${this.prefix}' is append-only; update is not allowed.`);
    if (expectedVersion === undefined || expectedVersion === null) {
      throw new Error('update requires expectedVersion for optimistic concurrency.');
    }
    await this._ready();
    const { rows } = await this._q(`SELECT data FROM ${this._t()} WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const current = rows[0]?.data || null;
    this._requireVisible(current, ctx);
    if (current.version !== expectedVersion) {
      throw new ConflictError(
        `Version conflict on ${this.prefix} ${id}`,
        [{ field: 'version', expected: expectedVersion, actual: current.version }],
      );
    }
    const updated = {
      ...current, ...patch, id: current.id, createdAt: current.createdAt,
      version: current.version + 1, updatedAt: nowIso(),
    };
    const setCols = ['data', 'version', 'updated_at'];
    const vals = [JSON.stringify(updated), updated.version, updated.updatedAt];
    const casts = ['::jsonb', '', ''];
    for (const spec of this.columns) { setCols.push(spec.col); vals.push(colValue(spec, updated)); casts.push(cast(spec)); }
    const setSql = setCols.map((c, i) => `${q(c)} = $${i + 1}${casts[i]}`).join(', ');
    vals.push(id, expectedVersion);
    const res = await this._q(
      `UPDATE ${this._t()} SET ${setSql} WHERE id = $${vals.length - 1} AND version = $${vals.length} AND deleted_at IS NULL`,
      vals,
    );
    if (res.rowCount === 0) throw new ConflictError(`Version conflict on ${this.prefix} ${id}`);
    return clone(updated);
  }

  async delete(id, ctx) {
    assertCtx(ctx);
    if (this.appendOnly) throw new Error(`Repository '${this.prefix}' is append-only; delete is not allowed.`);
    await this._ready();
    const { rows } = await this._q(`SELECT data FROM ${this._t()} WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const current = rows[0]?.data || null;
    this._requireVisible(current, ctx);
    if (this.softDelete) {
      const ts = nowIso();
      const updated = { ...current, deletedAt: ts, version: (current.version || 1) + 1 };
      await this._q(
        `UPDATE ${this._t()} SET data = $1::jsonb, version = $2, deleted_at = $3 WHERE id = $4`,
        [JSON.stringify(updated), updated.version, ts, id],
      );
    } else {
      await this._q(`DELETE FROM ${this._t()} WHERE id = $1`, [id]);
    }
    return { id, deleted: true, soft: this.softDelete };
  }

  /** Append-only helper (audit/events) — create-only, no version/updatedAt (matches JSON). */
  async append(entity) {
    if (!this.appendOnly) throw new Error(`Repository '${this.prefix}' is not append-only.`);
    await this._ready();
    const ts = nowIso();
    const record = { ...entity, id: entity.id || newId(this.prefix), createdAt: ts };
    const cols = ['id', 'data', 'created_at'];
    const vals = [record.id, JSON.stringify(record), ts];
    const casts = ['', '::jsonb', ''];
    for (const spec of this.columns) { cols.push(spec.col); vals.push(colValue(spec, record)); casts.push(cast(spec)); }
    const placeholders = cols.map((_, i) => `$${i + 1}${casts[i]}`);
    await this._q(`INSERT INTO ${this._t()} (${cols.map(q).join(', ')}) VALUES (${placeholders.join(', ')})`, vals);
    return clone(record);
  }

  withTransaction(fn) {
    return this.registry.withTransaction(fn);
  }
}
