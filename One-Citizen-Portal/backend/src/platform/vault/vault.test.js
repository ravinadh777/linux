// Tests for the document vault (story S1.1).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { buildContext } from '../../context.js';
import { createApp } from '../../app.js';
import { signAccessToken } from '../identity/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoSeed = path.resolve(__dirname, '../../../../data/seed');

let dataDir;
let app;

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const tokenL2 = (sub) => signAccessToken({ sub, roles: ['citizen'], assuranceLevel: 2, scopes: [] });
const tokenL1 = (sub) => signAccessToken({ sub, roles: ['citizen'], assuranceLevel: 1, scopes: [] });

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);
const EICAR_PDF = Buffer.from('%PDF-1.4\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-vault-'));
  await fs.cp(repoSeed, path.join(dataDir, 'seed'), { recursive: true });
  app = createApp(await buildContext({ dataDir }));
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('upload', () => {
  it('accepts a valid PDF: hashes, scans clean, version 1', async () => {
    const res = await request(app)
      .post('/api/v1/documents')
      .set(bearer(tokenL2('u1')))
      .field('type', 'statutory_declaration')
      .attach('file', PDF, { filename: 'decl.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.revision).toBe(1);
    expect(res.body.scanStatus).toBe('clean');
    expect(res.body.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.format).toBe('pdf');
  });

  it('rejects a spoofed extension (PNG content declared as a PDF-only type)', async () => {
    const res = await request(app)
      .post('/api/v1/documents')
      .set(bearer(tokenL2('u1')))
      .field('type', 'statutory_declaration') // formats: ['pdf']
      .attach('file', PNG, { filename: 'evil.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown document type', async () => {
    const res = await request(app)
      .post('/api/v1/documents')
      .set(bearer(tokenL2('u1')))
      .field('type', 'not_a_type')
      .attach('file', PDF, { filename: 'x.pdf' });
    expect(res.status).toBe(400);
  });

  it('requires Level-2 assurance', async () => {
    const res = await request(app)
      .post('/api/v1/documents')
      .set(bearer(tokenL1('u1')))
      .field('type', 'statutory_declaration')
      .attach('file', PDF, { filename: 'x.pdf' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('STEP_UP_REQUIRED');
  });
});

describe('virus scanning / quarantine', () => {
  it('marks an infected upload and refuses to serve it', async () => {
    const up = await request(app)
      .post('/api/v1/documents')
      .set(bearer(tokenL2('u1')))
      .field('type', 'building_plan')
      .attach('file', EICAR_PDF, { filename: 'plan.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);
    expect(up.body.scanStatus).toBe('infected');

    const content = await request(app).get(`/api/v1/documents/${up.body.id}/content`).set(bearer(tokenL2('u1')));
    expect(content.status).toBe(422); // quarantined — not served
  });
});

describe('versioning', () => {
  it('reupload creates a new version under the same lineage (no parallel copy)', async () => {
    const v1 = await request(app).post('/api/v1/documents').set(bearer(tokenL2('u1')))
      .field('type', 'statutory_declaration').attach('file', PDF, { filename: 'v1.pdf' });
    const v2 = await request(app).post(`/api/v1/documents/${v1.body.id}/reupload`).set(bearer(tokenL2('u1')))
      .field('type', 'statutory_declaration').attach('file', PDF, { filename: 'v2.pdf' });
    expect(v2.body.revision).toBe(2);
    expect(v2.body.lineageId).toBe(v1.body.lineageId);

    const versions = await request(app).get(`/api/v1/documents/${v1.body.id}/versions`).set(bearer(tokenL2('u1')));
    expect(versions.body.items).toHaveLength(2);
    expect(versions.body.items.map((d) => d.revision)).toEqual([1, 2]);
  });
});

describe('retrieval + scope', () => {
  it('serves clean content with the right content-type', async () => {
    const up = await request(app).post('/api/v1/documents').set(bearer(tokenL2('u1')))
      .field('type', 'statutory_declaration').attach('file', PDF, { filename: 'd.pdf' });
    const res = await request(app).get(`/api/v1/documents/${up.body.id}/content`).set(bearer(tokenL2('u1')));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('another citizen cannot read the document (404)', async () => {
    const up = await request(app).post('/api/v1/documents').set(bearer(tokenL2('u1')))
      .field('type', 'statutory_declaration').attach('file', PDF, { filename: 'd.pdf' });
    const res = await request(app).get(`/api/v1/documents/${up.body.id}`).set(bearer(tokenL2('u2')));
    expect(res.status).toBe(404);
  });
});
