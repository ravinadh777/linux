// Repository contract + shared helpers (Architecture §6.4).
// Every method takes an auth-scope `ctx` as a MANDATORY argument so authorization
// (BR-G4 scope filtering) cannot be forgotten at the controller layer.
import { NotFoundError } from '../../lib/errors.js';

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 50;

/**
 * @typedef {Object} AuthCtx
 * @property {string} [actor]              - subject id of the caller
 * @property {string[]} [roles]
 * @property {Object} scope                - REQUIRED scope descriptor:
 *   { unrestricted: true } | { where: {field: value|value[]} } | { predicate: (record) => boolean }
 */

/** Throw if a scope-bearing ctx is not supplied (programmer error, not a client error). */
export function assertCtx(ctx) {
  if (!ctx || typeof ctx !== 'object' || !ctx.scope) {
    throw new Error('Repository call requires an auth ctx with a `scope` (see Architecture §6.4).');
  }
}

/** Is `record` visible under the ctx scope? Deny-by-default. */
export function isVisible(record, ctx) {
  const s = ctx.scope;
  if (s.unrestricted === true) return true;
  if (typeof s.predicate === 'function') return s.predicate(record);
  if (s.where && typeof s.where === 'object') {
    return Object.entries(s.where).every(([k, v]) =>
      Array.isArray(v) ? v.includes(record[k]) : record[k] === v,
    );
  }
  return false;
}

/** Equality match of a plain query object against a record. */
export function matchesQuery(record, query) {
  if (!query) return true;
  return Object.entries(query).every(([k, v]) =>
    Array.isArray(v) ? v.includes(record[k]) : record[k] === v,
  );
}

export function encodeCursor(id) {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}
export function decodeCursor(cursor) {
  try {
    return Buffer.from(String(cursor), 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

/** Sort ascending by (createdAt, id) then apply cursor + limit. */
export function paginate(items, { limit = DEFAULT_LIMIT, cursor } = {}) {
  const capped = Math.min(Math.max(1, Number(limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const sorted = [...items].sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
  let start = 0;
  if (cursor) {
    const afterId = decodeCursor(cursor);
    const idx = sorted.findIndex((r) => r.id === afterId);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const page = sorted.slice(start, start + capped);
  const hasMore = start + capped < sorted.length;
  return { items: page, nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1].id) : null };
}

/**
 * Abstract base. Concrete adapters (JsonRepository, future PostgresRepository)
 * implement these with the same contract so business logic never changes.
 */
export class Repository {
  // eslint-disable-next-line no-unused-vars
  async findById(id, ctx) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async find(query, ctx, opts) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async create(entity, ctx) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async update(id, patch, expectedVersion, ctx) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async delete(id, ctx) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async withTransaction(fn) { throw new Error('not implemented'); }

  /** Shared: fetch-visible-or-NotFound (never leak existence outside scope). */
  _requireVisible(record, ctx) {
    if (!record || record.deletedAt || !isVisible(record, ctx)) {
      throw new NotFoundError();
    }
    return record;
  }
}
