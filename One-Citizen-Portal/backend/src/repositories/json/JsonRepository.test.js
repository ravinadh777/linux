// Contract tests for the JSON repository adapter (story S0.1).
// These assert the Repository CONTRACT — the same suite is intended to run against a
// future PostgresRepository (Architecture §7). No external services; temp dir per test.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createContainer } from '../../config/container.js';
import { ensureSeeded, resetStore } from '../../lib/seed.js';

let dataDir;
let container;
let repo;

const ADMIN = { actor: 'sys', roles: ['sysadmin'], scope: { unrestricted: true } };
const citizen = (id) => ({ actor: id, roles: ['citizen'], scope: { where: { ownerId: id } } });

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-repo-'));
  await fs.mkdir(path.join(dataDir, 'seed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'store'), { recursive: true });
  container = createContainer({ driver: 'json', dataDir });
  repo = container.repository('things', { prefix: 'thg' });
});

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('CRUD + envelope', () => {
  it('creates with id/version/timestamps and reads back', async () => {
    const created = await repo.create({ ownerId: 'u1', name: 'A' }, ADMIN);
    expect(created.id).toMatch(/^thg_/);
    expect(created.version).toBe(1);
    expect(created.createdAt).toBeTruthy();
    const found = await repo.findById(created.id, ADMIN);
    expect(found.name).toBe('A');
  });

  it('persists to disk atomically (survives a fresh container)', async () => {
    const created = await repo.create({ ownerId: 'u1', name: 'Persisted' }, ADMIN);
    const container2 = createContainer({ driver: 'json', dataDir });
    const repo2 = container2.repository('things', { prefix: 'thg' });
    const found = await repo2.findById(created.id, ADMIN);
    expect(found.name).toBe('Persisted');
  });
});

describe('scope filtering (BR-G4)', () => {
  it('hides records outside the caller scope on find', async () => {
    await repo.create({ ownerId: 'u1', name: 'mine' }, ADMIN);
    await repo.create({ ownerId: 'u2', name: 'theirs' }, ADMIN);
    const { items } = await repo.find({}, citizen('u1'));
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('mine');
  });

  it('returns null on findById outside scope (no existence leak)', async () => {
    const other = await repo.create({ ownerId: 'u2', name: 'secret' }, ADMIN);
    const found = await repo.findById(other.id, citizen('u1'));
    expect(found).toBeNull();
  });

  it('update outside scope behaves as NotFound', async () => {
    const other = await repo.create({ ownerId: 'u2', name: 'secret' }, ADMIN);
    await expect(repo.update(other.id, { name: 'x' }, other.version, citizen('u1')))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('denies by default when scope has neither where nor predicate', async () => {
    await repo.create({ ownerId: 'u1', name: 'mine' }, ADMIN);
    const { items } = await repo.find({}, { scope: {} });
    expect(items).toHaveLength(0);
  });

  it('throws if ctx/scope missing (authz cannot be forgotten)', async () => {
    await expect(repo.find({}, undefined)).rejects.toThrow(/scope/);
  });
});

describe('optimistic concurrency', () => {
  it('bumps version on update', async () => {
    const c = await repo.create({ ownerId: 'u1', name: 'A' }, ADMIN);
    const u = await repo.update(c.id, { name: 'B' }, c.version, ADMIN);
    expect(u.version).toBe(2);
    expect(u.name).toBe('B');
  });

  it('rejects stale version with CONFLICT', async () => {
    const c = await repo.create({ ownerId: 'u1', name: 'A' }, ADMIN);
    await repo.update(c.id, { name: 'B' }, c.version, ADMIN); // now v2
    await expect(repo.update(c.id, { name: 'C' }, c.version, ADMIN))
      .rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('requires expectedVersion', async () => {
    const c = await repo.create({ ownerId: 'u1', name: 'A' }, ADMIN);
    await expect(repo.update(c.id, { name: 'B' }, undefined, ADMIN)).rejects.toThrow(/expectedVersion/);
  });
});

describe('pagination (cursor)', () => {
  it('pages through results with a stable cursor', async () => {
    for (let i = 0; i < 5; i++) await repo.create({ ownerId: 'u1', n: i }, ADMIN);
    const p1 = await repo.find({}, ADMIN, { limit: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await repo.find({}, ADMIN, { limit: 2, cursor: p1.nextCursor });
    expect(p2.items).toHaveLength(2);
    const p3 = await repo.find({}, ADMIN, { limit: 2, cursor: p2.nextCursor });
    expect(p3.items).toHaveLength(1);
    expect(p3.nextCursor).toBeNull();
    const ids = [...p1.items, ...p2.items, ...p3.items].map((x) => x.id);
    expect(new Set(ids).size).toBe(5); // no overlaps
  });
});

describe('soft delete', () => {
  it('soft-deleted records disappear from reads', async () => {
    const soft = container.repository('softs', { prefix: 'sft', softDelete: true });
    const c = await soft.create({ ownerId: 'u1', name: 'A' }, ADMIN);
    await soft.delete(c.id, ADMIN);
    expect(await soft.findById(c.id, ADMIN)).toBeNull();
    const { items } = await soft.find({}, ADMIN);
    expect(items).toHaveLength(0);
  });
});

describe('append-only (audit/events)', () => {
  it('allows append but forbids update/delete', async () => {
    const audit = container.repository('audit', { prefix: 'aud', appendOnly: true });
    await audit.append({ action: 'created', entity: 'thing' });
    const { items } = await audit.find({}, ADMIN);
    expect(items).toHaveLength(1);
    await expect(audit.update('aud_x', {}, 1, ADMIN)).rejects.toThrow(/append-only/);
    await expect(audit.delete('aud_x', ADMIN)).rejects.toThrow(/append-only/);
  });
});

describe('transactions (unit of work)', () => {
  it('commits multi-collection writes', async () => {
    const other = container.repository('others', { prefix: 'oth' });
    await container.withTransaction(async () => {
      await repo.create({ ownerId: 'u1', name: 'T1' }, ADMIN);
      await other.create({ ownerId: 'u1', name: 'T2' }, ADMIN);
    });
    expect((await repo.find({}, ADMIN)).items).toHaveLength(1);
    expect((await other.find({}, ADMIN)).items).toHaveLength(1);
  });

  it('rolls back all writes on error', async () => {
    const other = container.repository('others', { prefix: 'oth' });
    await repo.create({ ownerId: 'u1', name: 'pre' }, ADMIN); // committed before tx
    await expect(
      container.withTransaction(async () => {
        await repo.create({ ownerId: 'u1', name: 'T1' }, ADMIN);
        await other.create({ ownerId: 'u1', name: 'T2' }, ADMIN);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // rolled back: only the pre-tx record remains, nothing in `others`
    expect((await repo.find({}, ADMIN)).items.map((x) => x.name)).toEqual(['pre']);
    expect((await other.find({}, ADMIN)).items).toHaveLength(0);
  });

  it('rollback restores disk state (fresh container sees pre-tx only)', async () => {
    await repo.create({ ownerId: 'u1', name: 'pre' }, ADMIN);
    await container.withTransaction(async () => {
      await repo.create({ ownerId: 'u1', name: 'doomed' }, ADMIN);
      throw new Error('boom');
    }).catch(() => {});
    const container2 = createContainer({ driver: 'json', dataDir });
    const repo2 = container2.repository('things', { prefix: 'thg' });
    const names = (await repo2.find({}, ADMIN)).items.map((x) => x.name);
    expect(names).toEqual(['pre']);
  });
});

describe('seed loader', () => {
  it('seeds store from seed on first run, without clobbering existing files', async () => {
    await fs.writeFile(path.join(dataDir, 'seed', 'ref.json'), JSON.stringify([{ id: 'r1' }]), 'utf8');
    await ensureSeeded(dataDir);
    const copied = JSON.parse(await fs.readFile(path.join(dataDir, 'store', 'ref.json'), 'utf8'));
    expect(copied[0].id).toBe('r1');
    // mutate store, re-run ensureSeeded → not overwritten
    await fs.writeFile(path.join(dataDir, 'store', 'ref.json'), JSON.stringify([{ id: 'mutated' }]), 'utf8');
    await ensureSeeded(dataDir);
    const after = JSON.parse(await fs.readFile(path.join(dataDir, 'store', 'ref.json'), 'utf8'));
    expect(after[0].id).toBe('mutated');
    // resetStore restores from seed
    await resetStore(dataDir);
    const reset = JSON.parse(await fs.readFile(path.join(dataDir, 'store', 'ref.json'), 'utf8'));
    expect(reset[0].id).toBe('r1');
  });
});

describe('concurrent writes do not corrupt the file', () => {
  it('serializes 20 concurrent creates', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => repo.create({ ownerId: 'u1', n: i }, ADMIN)),
    );
    const { items } = await repo.find({}, ADMIN, { limit: 100 });
    expect(items).toHaveLength(20);
    // file is valid JSON with 20 unique ids
    const raw = JSON.parse(await fs.readFile(path.join(dataDir, 'store', 'things.json'), 'utf8'));
    expect(new Set(raw.map((r) => r.id)).size).toBe(20);
  });
});
