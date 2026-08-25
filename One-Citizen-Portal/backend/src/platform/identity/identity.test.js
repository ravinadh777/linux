// Tests for the auth service + routes: register → login → JWT → protected access.
// Everything is DB-driven (JSON driver in tests) — there is no seeded/mock user.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { buildContext } from '../../context.js';
import { createApp } from '../../app.js';
import { signWithTtl, verifyToken } from './tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoSeed = path.resolve(__dirname, '../../../../data/seed');

let dataDir;
let app;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-auth-'));
  await fs.cp(repoSeed, path.join(dataDir, 'seed'), { recursive: true });
  const ctx = await buildContext({ dataDir });
  app = createApp(ctx);
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const register = (body) => request(app).post('/api/v1/auth/register').send(body);
const login = (body) => request(app).post('/api/v1/auth/login').send(body);

const NEW = { name: 'Nina Newcomer', email: 'nina@example.gy', password: 'BrandNew123!' };

describe('registration', () => {
  it('creates a user, mints an immutable user_id, and auto-logs in', async () => {
    const res = await register(NEW);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.id).toMatch(/^usr_/);
    expect(res.body.user.email).toBe('nina@example.gy');
    expect(res.body.user.passwordHash).toBeUndefined(); // never exposed

    const claims = verifyToken(res.body.accessToken);
    expect(claims.sub).toBe(res.body.user.id);
    expect(claims.user_id).toBe(res.body.user.id);
    expect(claims.email).toBe('nina@example.gy');
    expect(claims.role).toBe('citizen');
  });

  it('normalises email to lower-case and rejects duplicates', async () => {
    await register(NEW);
    const dup = await register({ ...NEW, email: 'NINA@example.gy' });
    expect(dup.status).toBe(409);
  });

  it('requires a name', async () => {
    const res = await register({ ...NEW, name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email', async () => {
    const res = await register({ ...NEW, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects a too-short password', async () => {
    const res = await register({ ...NEW, password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  beforeEach(async () => { await register(NEW); });

  it('validates the password and issues a session', async () => {
    const res = await login({ email: 'nina@example.gy', password: 'BrandNew123!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('nina@example.gy');
  });

  it('is case-insensitive on email', async () => {
    const res = await login({ email: 'Nina@Example.GY', password: 'BrandNew123!' });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password (401)', async () => {
    const res = await login({ email: 'nina@example.gy', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 404 for an unknown account (drives the register funnel)', async () => {
    const res = await login({ email: 'ghost@example.gy', password: 'whatever' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('JWT-protected access (/me)', () => {
  it('returns the authenticated user for a valid token', async () => {
    const reg = await register(NEW);
    const me = await request(app).get('/api/v1/me').set(bearer(reg.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('nina@example.gy');
    expect(me.body.id).toBe(reg.body.user.id);
  });

  it('rejects a missing token (401)', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('rejects an expired token (401)', async () => {
    const reg = await register(NEW);
    const expired = signWithTtl({ sub: reg.body.user.id, email: NEW.email, role: 'citizen' }, -1);
    const res = await request(app).get('/api/v1/me').set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });
});

describe('refresh rotation + logout revocation', () => {
  it('rotates refresh tokens and rejects reuse', async () => {
    const reg = await register(NEW);
    const r1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.refreshToken });
    expect(r1.status).toBe(200);
    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('logout denylists the access token', async () => {
    const reg = await register(NEW);
    await request(app).post('/api/v1/auth/logout').set(bearer(reg.body.accessToken)).send({ refreshToken: reg.body.refreshToken });
    const after = await request(app).get('/api/v1/me').set(bearer(reg.body.accessToken));
    expect(after.status).toBe(401);
    expect(after.body.error.message).toMatch(/revoked/i);
  });
});
