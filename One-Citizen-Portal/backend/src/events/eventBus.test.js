// Tests for the event bus + outbox + webhook dispatcher (story S0.5).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { buildContext } from '../context.js';
import { createApp } from '../app.js';
import { createEventBus } from './eventBus.js';
import { createWebhookDispatcher } from './webhookDispatcher.js';
import { SYSTEM_CTX } from '../config/repositories.js';
import { EVENTS } from '@onecitizen/shared/constants';
import { signAccessToken } from '../platform/identity/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoSeed = path.resolve(__dirname, '../../../data/seed');

let dataDir;
let ctx;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-evt-'));
  await fs.cp(repoSeed, path.join(dataDir, 'seed'), { recursive: true });
  ctx = await buildContext({ dataDir });
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

/** Build a test bus with a controllable transport + tiny backoff. */
function makeBus(transport) {
  const dispatcher = createWebhookDispatcher({ repos: ctx.repos, transport, maxAttempts: 4, backoffBaseMs: 1 });
  return createEventBus({ registry: ctx.container.registry, repos: ctx.repos, dispatcher });
}

describe('in-process pub/sub + outbox persistence', () => {
  it('persists the event and invokes subscribers', async () => {
    const bus = makeBus(async () => ({ status: 200 }));
    const seen = [];
    bus.subscribe(EVENTS.RECORD_REGISTERED, (rec) => seen.push(rec));
    await bus.emit({ type: EVENTS.RECORD_REGISTERED, payload: { recordId: 'r1' } });
    expect(seen).toHaveLength(1);
    expect(seen[0].payload.recordId).toBe('r1');
    const persisted = (await ctx.repos.events.find({ type: EVENTS.RECORD_REGISTERED }, SYSTEM_CTX)).items;
    expect(persisted).toHaveLength(1);
  });
});

describe('outbox semantics (post-commit dispatch)', () => {
  it('dispatches only after the transaction commits', async () => {
    const bus = makeBus(async () => ({ status: 200 }));
    const seen = [];
    bus.subscribe(EVENTS.CERTIFICATE_ISSUED, (rec) => seen.push(rec.id));
    await ctx.container.withTransaction(async () => {
      await bus.emit({ type: EVENTS.CERTIFICATE_ISSUED, payload: { certNo: 'C1' } });
      expect(seen).toHaveLength(0); // not dispatched mid-transaction
    });
    expect(seen).toHaveLength(1); // dispatched after commit
  });

  it('does NOT dispatch or persist when the transaction rolls back', async () => {
    const bus = makeBus(async () => ({ status: 200 }));
    const seen = [];
    bus.subscribe(EVENTS.BATCH_RELEASED, (rec) => seen.push(rec.id));
    await ctx.container
      .withTransaction(async () => {
        await bus.emit({ type: EVENTS.BATCH_RELEASED, payload: { batchId: 'b1' } });
        throw new Error('boom');
      })
      .catch(() => {});
    expect(seen).toHaveLength(0);
    const persisted = (await ctx.repos.events.find({ type: EVENTS.BATCH_RELEASED }, SYSTEM_CTX)).items;
    expect(persisted).toHaveLength(0); // outbox row rolled back with the tx
  });
});

describe('webhook delivery: signing, retry, logging', () => {
  it('retries a transient failure then succeeds', async () => {
    let calls = 0;
    const transport = async (url, body, headers) => {
      expect(headers['X-OneCitizen-Signature']).toMatch(/^sha256=/);
      calls += 1;
      if (calls < 3) throw new Error('temporary');
      return { status: 200 };
    };
    const bus = makeBus(transport);
    await ctx.repos.webhookSubscriptions.create(
      { consumerId: 'onecitizen-aggregator', events: [EVENTS.CERTIFICATE_ISSUED], url: 'https://consumer/hook', secret: 's3cr3t', active: true },
      SYSTEM_CTX,
    );
    await bus.emit({ type: EVENTS.CERTIFICATE_ISSUED, payload: { certNo: 'C9' } });
    expect(calls).toBe(3);
    const del = (await ctx.repos.webhookDeliveries.find({ eventType: EVENTS.CERTIFICATE_ISSUED }, SYSTEM_CTX)).items[0];
    expect(del.status).toBe('delivered');
    expect(del.attempts).toBe(3);
    expect(del.consumerId).toBe('onecitizen-aggregator'); // consumer identity logged
  });

  it('logs a failure after exhausting retries', async () => {
    const transport = async () => {
      throw new Error('always down');
    };
    const bus = makeBus(transport);
    await ctx.repos.webhookSubscriptions.create(
      { consumerId: 'consumerX', events: [EVENTS.PASSPORT_ISSUED], url: 'https://x/hook', secret: 's', active: true },
      SYSTEM_CTX,
    );
    await bus.emit({ type: EVENTS.PASSPORT_ISSUED, payload: {} });
    const del = (await ctx.repos.webhookDeliveries.find({ eventType: EVENTS.PASSPORT_ISSUED }, SYSTEM_CTX)).items[0];
    expect(del.status).toBe('failed');
    expect(del.attempts).toBe(4);
  });
});

describe('death.registered → suspend, never terminate', () => {
  it('subscriber suspends a payee pending officer review (no auto-termination)', async () => {
    const payees = ctx.container.repository('payees', { prefix: 'pay' });
    const payee = await payees.create({ ownerId: 'u1', status: 'active' }, SYSTEM_CTX);

    const bus = makeBus(async () => ({ status: 200 }));
    // The pattern Modules D/E use: flag suspends pending review — decision stays human.
    bus.subscribe(EVENTS.DEATH_REGISTERED, async (rec) => {
      const p = await payees.findById(rec.payload.payeeId, SYSTEM_CTX);
      if (p) await payees.update(p.id, { status: 'suspended', suspendReason: 'SUS-DECEASED', requiresOfficerReview: true }, p.version, SYSTEM_CTX);
    });

    await bus.emit({ type: EVENTS.DEATH_REGISTERED, payload: { payeeId: payee.id } });

    const after = await payees.findById(payee.id, SYSTEM_CTX);
    expect(after.status).toBe('suspended'); // suspended...
    expect(after.status).not.toBe('terminated'); // ...never terminated
    expect(after.requiresOfficerReview).toBe(true);
  });
});

describe('webhook subscription CRUD (routes)', () => {
  const sysToken = () => signAccessToken({ sub: 'admin1', roles: ['sysadmin'], assuranceLevel: 2, scopes: [] });
  const bearer = (t) => ({ Authorization: `Bearer ${t}` });

  it('creates, lists (secret hidden), and deletes a subscription', async () => {
    const app = createApp(ctx);
    const create = await request(app)
      .post('/api/v1/webhooks/subscriptions')
      .set(bearer(sysToken()))
      .send({ consumerId: 'onecitizen-aggregator', events: [EVENTS.CERTIFICATE_ISSUED], url: 'https://c/hook', secret: 'topsecret' });
    expect(create.status).toBe(201);
    expect(create.body.secret).toBeUndefined(); // never echoed

    const list = await request(app).get('/api/v1/webhooks/subscriptions').set(bearer(sysToken()));
    expect(list.body.items.length).toBeGreaterThanOrEqual(1);
    expect(list.body.items.every((s) => s.secret === undefined)).toBe(true);

    const del = await request(app).delete(`/api/v1/webhooks/subscriptions/${create.body.id}`).set(bearer(sysToken()));
    expect(del.status).toBe(200);
    expect(del.body.removed).toBe(true);
  });

  it('rejects unknown event types (400)', async () => {
    const app = createApp(ctx);
    const res = await request(app)
      .post('/api/v1/webhooks/subscriptions')
      .set(bearer(sysToken()))
      .send({ events: ['not.a.real.event'], url: 'https://c/hook' });
    expect(res.status).toBe(400);
  });

  it('forbids non-sysadmin (403)', async () => {
    const app = createApp(ctx);
    const citizenTok = signAccessToken({ sub: 'u1', roles: ['citizen'], assuranceLevel: 2, scopes: [] });
    const res = await request(app).get('/api/v1/webhooks/subscriptions').set(bearer(citizenTok));
    expect(res.status).toBe(403);
  });
});
