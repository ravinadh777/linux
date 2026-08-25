// Tests for audit service + reference data + Swagger (story S0.6, completing Epic E0).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { buildContext } from '../../context.js';
import { createApp } from '../../app.js';
import { SYSTEM_CTX } from '../../config/repositories.js';
import { signAccessToken } from '../identity/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoSeed = path.resolve(__dirname, '../../../../data/seed');

let dataDir;
let ctx;
let app;

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const sysToken = () => signAccessToken({ sub: 'admin1', roles: ['sysadmin'], assuranceLevel: 2, scopes: [] });
const citizenToken = () => signAccessToken({ sub: 'u1', roles: ['citizen'], assuranceLevel: 2, scopes: [] });

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-e0-'));
  await fs.cp(repoSeed, path.join(dataDir, 'seed'), { recursive: true });
  ctx = await buildContext({ dataDir });
  app = createApp(ctx);
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('audit service', () => {
  it('records actor/action/entity with before/after hashes', async () => {
    await ctx.services.audit.record({
      actor: 'off1', action: 'lane.decided', entity: 'application', entityId: 'A-1',
      before: { status: 'in_review' }, after: { status: 'approved' },
    });
    const { items } = await ctx.repos.audit.find({ action: 'lane.decided' }, SYSTEM_CTX);
    expect(items).toHaveLength(1);
    expect(items[0].beforeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(items[0].afterHash).toMatch(/^[a-f0-9]{64}$/);
    expect(items[0].afterHash).not.toBe(items[0].beforeHash);
  });

  it('query is restricted to oversight roles and self-audits the read', async () => {
    await ctx.services.audit.record({ actor: 'x', action: 'thing.done', entity: 'thing', entityId: 't1' });

    const forbidden = await request(app).get('/api/v1/audit?entity=thing').set(bearer(citizenToken()));
    expect(forbidden.status).toBe(403);

    const ok = await request(app).get('/api/v1/audit?entity=thing').set(bearer(sysToken()));
    expect(ok.status).toBe(200);
    expect(ok.body.items.length).toBeGreaterThanOrEqual(1);

    // the read itself was audited
    const reads = (await ctx.repos.audit.find({ action: 'audit.read' }, SYSTEM_CTX)).items;
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(reads[0].actor).toBe('admin1');
  });
});

describe('reference data (cached, public)', () => {
  it('serves the 10 regions with a cache header', async () => {
    const res = await request(app).get('/api/v1/reference/regions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    expect(res.headers['cache-control']).toMatch(/max-age=3600/);
  });

  it('serves reason codes filtered by context', async () => {
    const res = await request(app).get('/api/v1/reference/reason-codes?context=refusal');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('code');
  });

  it('serves local authorities, fee schedules and document types', async () => {
    for (const p of ['local-authorities', 'fee-schedules', 'document-types']) {
      const res = await request(app).get(`/api/v1/reference/${p}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    }
  });
});

describe('health + OpenAPI', () => {
  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('serves the OpenAPI 3 spec at /api/docs.json', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths['/auth/login']).toBeDefined();
    expect(res.body.paths['/audit']).toBeDefined();
  });

  it('serves Swagger UI at /api/docs', async () => {
    const res = await request(app).get('/api/docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger/i);
  });
});
