// End-to-end verification of the enterprise document handling, application/document linkage,
// and real-time notification features against the CONFIGURED database (.env → Postgres).
import request from 'supertest';
import { buildContext } from '../src/context.js';
import { createApp } from '../src/app.js';

// Minimal valid file bytes (magic numbers the vault's sniffer recognises).
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);

// Find the first real service id anywhere in the catalogue tree.
function firstServiceId(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node.services) && node.services[0]?.id) return node.services[0].id;
  for (const v of Object.values(node)) {
    const found = Array.isArray(v) ? v.map(firstServiceId).find(Boolean) : firstServiceId(v);
    if (found) return found;
  }
  return null;
}

async function run() {
  const app = createApp(await buildContext());
  const out = [];
  const ok = (name, cond, extra = '') => { out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); return cond; };

  // 1) Register (full profile) → L2 token
  const email = `feat_${Date.now()}@example.gy`;
  const reg = await request(app).post('/api/v1/auth/register').send({
    name: 'Feature User', email, password: 'Feature123!',
    nationalId: '1999-4321', tin: '900100200', phone: '+592 600 5555', region: 'Region 4 (Demerara-Mahaica)',
  });
  ok('register → 201', reg.status === 201, `status=${reg.status}`);
  const token = reg.body.accessToken;
  const bearer = { Authorization: `Bearer ${token}` };
  const me = await request(app).get('/api/v1/me').set(bearer);
  ok('/me returns union profile fields', me.body?.profile?.nationalId === '1999-4321' && me.body?.profile?.tin === '900100200');

  // 2) Upload a PDF + a PNG
  const upPdf = await request(app).post('/api/v1/documents').set(bearer)
    .field('type', 'statutory_declaration').attach('file', PDF, { filename: 'decl.pdf', contentType: 'application/pdf' });
  const upPng = await request(app).post('/api/v1/documents').set(bearer)
    .field('type', 'national_id').attach('file', PNG, { filename: 'id.png', contentType: 'image/png' });
  ok('upload PDF → 201 + DTO', upPdf.status === 201 && !!upPdf.body.documentId && upPdf.body.mimeType === 'application/pdf');
  ok('upload PNG → 201 + DTO', upPng.status === 201 && upPng.body.format === 'png');
  ok('DTO never leaks storageKey/base64', upPdf.body.storageKey === undefined && upPdf.body.base64_content === undefined && upPdf.body.data === undefined);
  ok('DTO carries checksum + fileSize', /^[a-f0-9]{64}$/.test(upPdf.body.checksum || '') && upPdf.body.fileSize > 0);
  const pdfId = upPdf.body.documentId;

  // 3) List mine (metadata only)
  const list = await request(app).get('/api/v1/documents').set(bearer);
  ok('list mine → both docs, no binary', (list.body.items || []).length === 2 && list.body.items.every((d) => d.storageKey === undefined));

  // 4) Preview (inline) + download (attachment)
  const prevPdf = await request(app).get(`/api/v1/documents/${pdfId}/preview`).set(bearer);
  ok('preview PDF → inline application/pdf', prevPdf.status === 200 && /application\/pdf/.test(prevPdf.headers['content-type']) && /inline/.test(prevPdf.headers['content-disposition']));
  const prevPng = await request(app).get(`/api/v1/documents/${upPng.body.documentId}/preview`).set(bearer);
  ok('preview PNG → inline image/png', prevPng.status === 200 && /image\/png/.test(prevPng.headers['content-type']));
  const dl = await request(app).get(`/api/v1/documents/${pdfId}/content`).set(bearer);
  ok('download → attachment with filename', dl.status === 200 && /attachment/.test(dl.headers['content-disposition']) && /decl\.pdf/.test(dl.headers['content-disposition']));

  // 5) Access control — another user cannot read it
  const other = await request(app).post('/api/v1/auth/register').send({ name: 'Other', email: `other_${Date.now()}@example.gy`, password: 'Other12345' });
  const forbidden = await request(app).get(`/api/v1/documents/${pdfId}`).set({ Authorization: `Bearer ${other.body.accessToken}` });
  ok('another user cannot read doc → 404', forbidden.status === 404, `status=${forbidden.status}`);

  // 6) Submit an application referencing the PDF → it should be linked to the application
  const cat = await request(app).get('/api/v1/catalogue');
  const serviceId = firstServiceId(cat.body) || 'passport-renew';
  const sub = await request(app).post('/api/v1/applications').set(bearer)
    .send({ serviceId, form: { note: 'e2e' }, documents: [{ field: 'doc', documentId: pdfId }] });
  ok('submit application → 201', sub.status === 201, `status=${sub.status} service=${serviceId}`);
  const appId = sub.body.id;
  const byApp = await request(app).get('/api/v1/documents').query({ applicationId: appId }).set(bearer);
  ok('document tagged with application_id', (byApp.body.items || []).some((d) => d.documentId === pdfId && d.applicationId === appId));

  // 7) Notification created for the submission, with a deep link to the tracking page
  const notifs = await request(app).get('/api/v1/notifications').set(bearer);
  const submitted = (notifs.body.items || []).find((n) => n.applicationId === appId);
  ok('notification created for submission', !!submitted && notifs.body.unread >= 1);
  ok('notification deep-links to tracking', submitted?.deepLinkTarget === `/tracking/${appId}`, submitted?.deepLinkTarget);
  const read = await request(app).patch(`/api/v1/notifications/${submitted.notificationId}/read`).set(bearer);
  ok('notification mark-read', read.body?.isRead === true);

  // 8) Soft-delete a document
  const del = await request(app).delete(`/api/v1/documents/${upPng.body.documentId}`).set(bearer);
  const afterDel = await request(app).get('/api/v1/documents').set(bearer);
  ok('soft-delete removes from list', del.body?.deleted === true && !(afterDel.body.items || []).some((d) => d.documentId === upPng.body.documentId));

  console.log('\n' + out.join('\n'));
  const failed = out.filter((l) => l.startsWith('FAIL'));
  console.log(`\n${failed.length ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED'} (${out.length - failed.length}/${out.length})\n`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => { console.error('verify-features crashed:', err); process.exit(1); });
