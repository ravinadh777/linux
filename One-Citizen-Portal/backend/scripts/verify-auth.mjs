// One-off end-to-end check of the auth flow against the CONFIGURED database (.env → Postgres).
// Boots the real app context (runs migration + config seed), then drives register → login →
// /me over HTTP via supertest. Prints a PASS/FAIL summary and exits.
import request from 'supertest';
import { buildContext } from '../src/context.js';
import { createApp } from '../src/app.js';

const email = `verify_${Date.now()}@example.gy`;
const password = 'VerifyMe123!';

async function run() {
  const ctx = await buildContext();
  const app = createApp(ctx);
  const out = [];
  const check = (name, ok, extra = '') => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); return ok; };

  const regPayload = {
    name: 'Verify User', email, password,
    phone: '+592 600 0001', dob: '1990-05-04', gender: 'Other', nationalId: '1990-1234',
    occupation: 'Engineer', maritalStatus: 'Single', addressLine: '12 Sheriff St',
    village: 'Campbellville', region: 'Region 4 (Demerara-Mahaica)',
    nextOfKin: 'Pat Doe', nextOfKinRelationship: 'Sibling', nextOfKinPhone: '+592 600 0002',
  };
  const reg = await request(app).post('/api/v1/auth/register').send(regPayload);
  check('register → 201', reg.status === 201, `status=${reg.status}`);
  check('register returns user_id (usr_)', /^usr_/.test(reg.body?.user?.id || ''), reg.body?.user?.id);
  check('register returns JWT', Boolean(reg.body?.accessToken));
  check('password hash never exposed', reg.body?.user?.passwordHash === undefined);
  check('register persists FULL profile set',
    reg.body?.user?.profile?.nationalId === '1990-1234' &&
    reg.body?.user?.profile?.region === 'Region 4 (Demerara-Mahaica)' &&
    reg.body?.user?.profile?.nextOfKin === 'Pat Doe',
    JSON.stringify(reg.body?.user?.profile));

  const dup = await request(app).post('/api/v1/auth/register').send({ name: 'Dup', email, password });
  check('duplicate email rejected (409)', dup.status === 409, `status=${dup.status}`);

  const login = await request(app).post('/api/v1/auth/login').send({ email: email.toUpperCase(), password });
  check('login (case-insensitive email) → 200', login.status === 200, `status=${login.status}`);

  const bad = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong' });
  check('wrong password → 401', bad.status === 401, `status=${bad.status}`);

  const missing = await request(app).post('/api/v1/auth/login').send({ email: `nobody_${Date.now()}@example.gy`, password });
  check('unknown account → 404 (register funnel)', missing.status === 404, `status=${missing.status}`);

  const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${login.body.accessToken}`);
  check('protected /me → 200', me.status === 200, `status=${me.status}`);
  check('/me returns the same user_id', me.body?.id === reg.body?.user?.id, me.body?.id);

  const noauth = await request(app).get('/api/v1/me');
  check('/me without token → 401', noauth.status === 401, `status=${noauth.status}`);

  const bearer = { Authorization: `Bearer ${login.body.accessToken}` };
  const upd = await request(app).patch('/api/v1/me').set(bearer).send({ name: 'Verify Renamed', phone: '+592 600 1234', gender: 'Other' });
  check('updateUser (PATCH /me) → 200', upd.status === 200, `status=${upd.status}`);
  check('updateUser persists name (top-level)', upd.body?.name === 'Verify Renamed', upd.body?.name);
  check('updateUser persists profile fields', upd.body?.profile?.phone === '+592 600 1234' && upd.body?.profile?.gender === 'Other');
  const reread = await request(app).get('/api/v1/me').set(bearer);
  check('getUser reflects the update', reread.body?.name === 'Verify Renamed' && reread.body?.profile?.phone === '+592 600 1234');

  console.log('\n' + out.join('\n'));
  const failed = out.filter((l) => l.startsWith('FAIL'));
  console.log(`\n${failed.length ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED'} (${out.length - failed.length}/${out.length})\n`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => { console.error('verify-auth crashed:', err); process.exit(1); });
