// Tests for RBAC + scope middleware and authz helpers (story S0.4).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { createContainer } from '../config/container.js';
import { SYSTEM_CTX } from '../config/repositories.js';
import { createAuthMiddleware } from './auth.js';
import { scope } from './scope.js';
import { requireRole, requireScope, requireAssurance } from './rbac.js';
import { errorHandler } from './error.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { assertDistinctActors, buildScopeCtx } from '../lib/authz.js';
import { signAccessToken } from '../platform/identity/tokens.js';
import { verifyToken } from '../platform/identity/tokens.js';

let dataDir;
let notes;
let lanes;
let app;

const token = (claims) => signAccessToken({ assuranceLevel: 2, roles: ['citizen'], scopes: [], ...claims });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-rbac-'));
  await fs.mkdir(path.join(dataDir, 'store'), { recursive: true });
  const container = createContainer({ driver: 'json', dataDir });
  notes = container.repository('notes', { prefix: 'nte' });
  lanes = container.repository('lanes', { prefix: 'lan' });

  // Seed two citizens' notes and two agency-lane records.
  await notes.create({ ownerId: 'u1', text: 'mine' }, SYSTEM_CTX);
  await notes.create({ ownerId: 'u2', text: 'theirs' }, SYSTEM_CTX);
  await lanes.create({ agency: 'GRO', text: 'gro-case' }, SYSTEM_CTX);
  await lanes.create({ agency: 'CIPO', text: 'cipo-case' }, SYSTEM_CTX);

  app = express();
  app.use(express.json());
  const { authenticate, requireAuth } = createAuthMiddleware({ verifyAccess: async (t) => verifyToken(t) });
  app.use(authenticate);
  app.use(scope);

  app.get('/notes/:id', requireAuth, asyncHandler(async (req, res) => {
    const ctx = req.scope({ ownerField: 'ownerId' });
    const n = await notes.findById(req.params.id, ctx);
    if (!n) throw new NotFoundError();
    res.json(n);
  }));
  app.get('/notes', requireAuth, asyncHandler(async (req, res) => {
    res.json(await notes.find({}, req.scope({ ownerField: 'ownerId' })));
  }));
  app.get('/lanes', requireAuth, asyncHandler(async (req, res) => {
    res.json(await lanes.find({}, req.scope({ laneField: 'agency' })));
  }));
  app.get('/admin/notes', requireRole('sysadmin'), asyncHandler(async (req, res) => {
    res.json(await notes.find({}, req.scope({ ownerField: 'ownerId' })));
  }));
  app.get('/scoped', requireScope('notes:read'), (_req, res) => res.json({ ok: true }));
  app.get('/l2', requireAssurance(2), (_req, res) => res.json({ ok: true }));

  app.use(errorHandler);
});

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('scope filtering (citizen)', () => {
  it('citizen reads only their own records', async () => {
    const list = await request(app).get('/notes').set(bearer(token({ sub: 'u1' })));
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].text).toBe('mine');
  });

  it('cross-citizen id returns 404, not a 403 leak', async () => {
    const all = await request(app).get('/notes').set(bearer(token({ sub: 'u2', roles: ['sysadmin'] }))); // admin to discover u2 id
    const u2Id = all.body.items.find((n) => n.text === 'theirs').id;
    const res = await request(app).get(`/notes/${u2Id}`).set(bearer(token({ sub: 'u1' })));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('delegated (acting-for) reads the citizen\'s records', async () => {
    const list = await request(app).get('/notes').set(bearer(token({ sub: 'agent1', actingFor: 'u1', roles: ['citizen', 'agent'] })));
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].text).toBe('mine');
  });
});

describe('officer lane scoping', () => {
  it('an agency officer sees only their lane', async () => {
    const res = await request(app).get('/lanes').set(bearer(token({ sub: 'off1', roles: ['officer.adjudicator'], agency: 'GRO' })));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].agency).toBe('GRO');
  });

  it('oversight/sysadmin see all lanes (unrestricted)', async () => {
    const res = await request(app).get('/lanes').set(bearer(token({ sub: 'ov1', roles: ['oversight'] })));
    expect(res.body.items).toHaveLength(2);
  });
});

describe('requireRole / requireScope / requireAssurance', () => {
  it('requireRole blocks a citizen from an admin route (403)', async () => {
    const res = await request(app).get('/admin/notes').set(bearer(token({ sub: 'u1', roles: ['citizen'] })));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
  it('requireRole admits a sysadmin', async () => {
    const res = await request(app).get('/admin/notes').set(bearer(token({ sub: 'a1', roles: ['sysadmin'] })));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });
  it('requireScope blocks tokens missing the scope (403)', async () => {
    const res = await request(app).get('/scoped').set(bearer(token({ sub: 'c1', scopes: [] })));
    expect(res.status).toBe(403);
  });
  it('requireScope admits tokens with the scope', async () => {
    const res = await request(app).get('/scoped').set(bearer(token({ sub: 'c1', scopes: ['notes:read'] })));
    expect(res.status).toBe(200);
  });
  it('requireAssurance blocks L1 with STEP_UP_REQUIRED', async () => {
    const res = await request(app).get('/l2').set(bearer(token({ sub: 'c1', assuranceLevel: 1 })));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('STEP_UP_REQUIRED');
  });
  it('requireAssurance admits L2', async () => {
    const res = await request(app).get('/l2').set(bearer(token({ sub: 'c1', assuranceLevel: 2 })));
    expect(res.status).toBe(200);
  });
});

describe('segregation of duty', () => {
  it('throws FORBIDDEN when the two actors are the same', () => {
    expect(() => assertDistinctActors('off1', 'off1')).toThrow(/different officers/);
  });
  it('passes when actors differ', () => {
    expect(() => assertDistinctActors('off1', 'off2')).not.toThrow();
  });
});

describe('buildScopeCtx defaults', () => {
  it('denies by default when there is no subject', () => {
    const ctx = buildScopeCtx({ roles: ['citizen'] }, { ownerField: 'ownerId' });
    expect(ctx.scope.where.ownerId).toBeNull();
  });
});
