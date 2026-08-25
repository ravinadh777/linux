// Agent module tests — service orchestration + persistence with a stubbed gateway, and
// route auth wiring. The live Python engine is NOT required (the gateway is faked), so
// these run fast and deterministically in CI.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildContext } from '../../../context.js';
import { createApp } from '../../../app.js';
import { createAgentService } from '../services/agent.service.js';
import { agentConfig } from '../config/agent.config.js';
import { signAccessToken } from '../../../platform/identity/tokens.js';

const CANNED = [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'STATE_SNAPSHOT', snapshot: { proposedPrefill: null } },
  { type: 'TOOL_CALL_START', toolCallId: 'tc1', toolCallName: 'suggest_prefill' },
  { type: 'TOOL_CALL_RESULT', toolCallId: 'tc1', content: 'ok' },
  { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Hello ' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'there' },
  {
    type: 'CUSTOM', name: 'Prefill',
    value: {
      serviceId: 'passport-renew',
      fields: [{ name: 'surname', label: 'Surname', value: 'Persaud', source: 'National ID', confidence: 'high', overridden: false }],
      values: { surname: 'Persaud' }, remaining: [], documents: [],
    },
  },
  { type: 'CUSTOM', name: 'Suggestions', value: ['What documents?', 'How much?'] },
  { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r', result: { mode: 'deterministic' } },
];

const fakeGateway = {
  health: async () => ({ status: 'ok', mode: 'deterministic' }),
  async openRun() {
    return {
      body: (async function* body() {
        for (const f of CANNED) yield Buffer.from(`data: ${JSON.stringify(f)}\n\n`);
      })(),
    };
  },
  async collectRun() { return CANNED; },
};

const auth = { sub: 'idn_citizen_1', roles: ['citizen'], assuranceLevel: 2 };

describe('agent module', () => {
  let ctx;
  let service;

  beforeAll(async () => {
    ctx = await buildContext();
    service = createAgentService({ repos: ctx.repos, gateway: fakeGateway, config: agentConfig, events: null });
  });

  it('creates a session, streams a run, and persists the turn', async () => {
    const session = await service.createSession({ auth, page: { serviceId: 'passport-renew' } });
    expect(session.id).toMatch(/^thr_/);

    const frames = [];
    for await (const f of service.streamRun({
      auth,
      dto: { threadId: session.id, message: 'auto-fill', trigger: 'user_message', page: { serviceId: 'passport-renew', formValues: {} } },
      token: null,
    })) {
      frames.push(f);
    }
    expect(frames.join('')).toContain('RUN_FINISHED');

    const { messages } = await service.getHistory({ auth, threadId: session.id });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'auto-fill' });
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello there');
    expect(messages[1].prefill.fields[0].value).toBe('Persaud');
    expect(messages[1].suggestions).toEqual(['What documents?', 'How much?']);
  });

  it('resets a conversation but keeps the thread', async () => {
    const s = await service.createSession({ auth });
    // eslint-disable-next-line no-unused-vars
    for await (const _f of service.streamRun({ auth, dto: { threadId: s.id, message: 'hi', trigger: 'user_message' }, token: null })) { /* drain */ }
    const beforeReset = await service.getHistory({ auth, threadId: s.id });
    expect(beforeReset.messages.length).toBeGreaterThan(0);
    const cleared = await service.reset({ auth, threadId: s.id });
    expect(cleared.messages).toHaveLength(0);
  });

  it('extracts entities with confidence, source, timestamp and validation state', async () => {
    const out = await service.extract({ auth, message: 'fill my details', page: { serviceId: 'passport-renew' } });
    expect(out.entities.length).toBeGreaterThan(0);
    const e = out.entities[0];
    expect(e).toMatchObject({ field: 'surname', value: 'Persaud', confidence: 'high', source: 'National ID', validationState: 'pending' });
    expect(typeof e.timestamp).toBe('string');
  });

  it('syncs form values into thread context (bidirectional)', async () => {
    const s = await service.createSession({ auth });
    const res = await service.syncForm({ auth, threadId: s.id, formValues: { surname: 'Persaud', phone: '592-700-1234' } });
    expect(res.formState).toMatchObject({ surname: 'Persaud', phone: '592-700-1234' });
  });

  it('isolates threads per citizen (scope)', async () => {
    const mine = await service.createSession({ auth });
    const other = { sub: 'idn_citizen_2', roles: ['citizen'] };
    await expect(service.getHistory({ auth: other, threadId: mine.id })).rejects.toThrow();
  });

  it('requires authentication on the REST surface', async () => {
    const app = createApp(ctx);
    await request(app).get('/api/v1/agent/status').expect(401);
    const token = signAccessToken({ sub: auth.sub, roles: auth.roles, assuranceLevel: 2, scopes: [] });
    const res = await request(app).get('/api/v1/agent/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
  });
});
