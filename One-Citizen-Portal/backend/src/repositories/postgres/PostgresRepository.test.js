// Live PostgreSQL contract test. It exercises the SAME contract the JSON driver is tested
// against — create/find/optimistic-update/version-conflict/soft-delete/transaction-rollback —
// but against a real database. It SKIPS automatically when no DB is reachable with the
// configured credentials, so it never breaks local/CI runs that have no Postgres, and turns
// green the moment `backend/.env` points at a working database.
import { describe, it, expect, afterAll } from 'vitest';
import { createPostgresContainer } from './pgContainer.js';
import { buildDatabaseConfig } from '../../config/database.js';
import { closePool, getPool } from './PgPool.js';

const SYSTEM = Object.freeze({ actor: 'system', roles: ['sysadmin'], scope: { unrestricted: true } });
const owned = (id) => ({ actor: id, roles: ['citizen'], scope: { where: { ownerId: id } } });

async function reachable() {
  try {
    const pool = await getPool(buildDatabaseConfig());
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

const canRun = await reachable();
if (!canRun) await closePool(); // release the probe pool when we're going to skip
const TABLE = 'pgtest_items';

describe.skipIf(!canRun)('PostgresRepository (live DB)', () => {
  const container = createPostgresContainer({ dbConfig: buildDatabaseConfig() });
  const repo = container.repository(TABLE, { prefix: 'tst', softDelete: true });

  afterAll(async () => {
    try { await container.registry.query(`DROP TABLE IF EXISTS "${TABLE}"`); } catch { /* noop */ }
    await closePool();
  });

  it('creates and reads back a record', async () => {
    const created = await repo.create({ ownerId: 'u1', name: 'Ada' }, SYSTEM);
    expect(created.id).toMatch(/^tst_/);
    expect(created.version).toBe(1);
    const got = await repo.findById(created.id, SYSTEM);
    expect(got.name).toBe('Ada');
  });

  it('enforces optimistic concurrency', async () => {
    const r = await repo.create({ ownerId: 'u1', name: 'v1' }, SYSTEM);
    const u = await repo.update(r.id, { name: 'v2' }, r.version, SYSTEM);
    expect(u.version).toBe(2);
    await expect(repo.update(r.id, { name: 'stale' }, r.version, SYSTEM)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('applies scope filtering (owner isolation)', async () => {
    const mine = await repo.create({ ownerId: 'alice', name: 'secret' }, SYSTEM);
    expect(await repo.findById(mine.id, owned('alice'))).not.toBeNull();
    expect(await repo.findById(mine.id, owned('bob'))).toBeNull();
    const list = await repo.find({}, owned('alice'));
    expect(list.items.every((x) => x.ownerId === 'alice')).toBe(true);
  });

  it('soft-deletes (row no longer visible)', async () => {
    const r = await repo.create({ ownerId: 'u1', name: 'temp' }, SYSTEM);
    await repo.delete(r.id, SYSTEM);
    expect(await repo.findById(r.id, SYSTEM)).toBeNull();
  });

  it('rolls back a transaction', async () => {
    let createdId;
    await expect(container.withTransaction(async () => {
      const r = await repo.create({ ownerId: 'u1', name: 'tx' }, SYSTEM);
      createdId = r.id;
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await repo.findById(createdId, SYSTEM)).toBeNull();
  });
});
