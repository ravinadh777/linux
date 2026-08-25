// Agent application service (Phase 2 — business logic; Phase 4 — conversation/session/form state;
// Phase 7 — entity-extraction edge). SOLID: this layer owns orchestration and persistence and
// delegates ALL agent reasoning to the reused Python engine via the gateway. It never rewrites
// AG-UI frames — it forwards them and observes them to keep durable state.
import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../../lib/errors.js';
import { logger } from '../../../lib/logger.js';
import { AgentTrigger, AgentDomainEvent } from '../constants/events.js';
import { sanitizeText, sanitizeJson } from '../utils/sanitize.js';
import { SseParser } from '../utils/sse.js';
import { RunAccumulator } from './runAccumulator.js';

const log = logger.child ? logger.child({ mod: 'agent.service' }) : logger;

/** Per-citizen repository scope (BR-G4): a thread is only visible to its owner. */
const scopeOf = (auth) => ({
  actor: auth.sub,
  roles: auth.roles || [],
  scope: { where: { ownerId: auth.sub } },
});

export function createAgentService({ repos, gateway, config, events }) {
  const threads = repos.agentThreads;

  // ── session lifecycle (Phase 4) ────────────────────────────────────────────
  async function createSession({ auth, page = {}, title }) {
    const ctx = scopeOf(auth);
    const thread = await threads.create({
      ownerId: auth.sub,
      title: title ? sanitizeText(title, 200) : null,
      serviceId: page.serviceId || null,
      formState: page.formValues || {},
      proposedPrefill: null,
      messages: [],
    }, ctx);
    _emit(AgentDomainEvent.SESSION_CREATED, { threadId: thread.id, ownerId: auth.sub });
    return thread;
  }

  async function listSessions({ auth }) {
    const ctx = scopeOf(auth);
    const { items } = await threads.find({ ownerId: auth.sub }, ctx, { limit: 50 });
    return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async function getThreadOrThrow(auth, threadId) {
    const ctx = scopeOf(auth);
    const thread = await threads.findById(threadId, ctx);
    if (!thread) throw new NotFoundError('Conversation not found');
    return thread;
  }

  /** Return an existing owned thread or create one on the fly (implicit session). */
  async function ensureThread({ auth, threadId, page }) {
    if (threadId) {
      const ctx = scopeOf(auth);
      const existing = await threads.findById(threadId, ctx);
      if (existing) return existing;
    }
    return createSession({ auth, page: page || {} });
  }

  async function getHistory({ auth, threadId }) {
    const thread = await getThreadOrThrow(auth, threadId);
    return { threadId: thread.id, messages: thread.messages || [], formState: thread.formState || {} };
  }

  async function reset({ auth, threadId }) {
    const thread = await getThreadOrThrow(auth, threadId);
    const ctx = scopeOf(auth);
    return threads.update(thread.id, { messages: [], proposedPrefill: null }, thread.version, ctx);
  }

  /**
   * Persist the latest form values the citizen has in the browser (Phase 6 — the
   * "user edits a field → agent context updates" half of the bidirectional sync).
   */
  async function syncForm({ auth, threadId, formValues, page }) {
    const thread = await getThreadOrThrow(auth, threadId);
    const ctx = scopeOf(auth);
    const merged = { ...(thread.formState || {}), ...sanitizeJson(formValues || {}) };
    const patch = { formState: merged };
    if (page?.serviceId) patch.serviceId = page.serviceId;
    const updated = await _updateWithRetry(ctx, thread.id, patch);
    _emit(AgentDomainEvent.FORM_SYNCED, { threadId: thread.id, fields: Object.keys(merged).length });
    return { threadId: thread.id, formState: updated.formState };
  }

  // ── streaming run (Phase 2/3) ───────────────────────────────────────────────
  /**
   * Open an AG-UI run and yield raw SSE frame strings for the controller to write to
   * the browser, while observing frames to persist the turn. Aborting `signal`
   * (client disconnect) stops the upstream fetch; partial state is still saved.
   * @returns {AsyncGenerator<string>}
   */
  async function* streamRun({ auth, dto, token, signal }) {
    const thread = await ensureThread({ auth, threadId: dto.threadId, page: dto.page });
    const ctx = scopeOf(auth);
    const runId = `run_${randomUUID().slice(0, 12)}`;

    // Persist the user's message up front so it survives disconnects and is replayed.
    if (dto.trigger === AgentTrigger.USER_MESSAGE && dto.message?.trim()) {
      await _appendMessage(ctx, thread, {
        id: `m_${randomUUID().slice(0, 10)}`,
        role: 'user',
        content: sanitizeText(dto.message),
        createdAt: new Date().toISOString(),
      });
    }

    const fresh = await threads.findById(thread.id, ctx); // includes the message just added
    const runInput = _buildRunInput(fresh, dto, runId);
    const acc = new RunAccumulator();

    _emit(AgentDomainEvent.RUN_STARTED, { threadId: thread.id, runId, trigger: dto.trigger });
    let res;
    try {
      res = await gateway.openRun(runInput, { token, signal });
    } catch (err) {
      // Upstream unreachable — synthesise a spec-compliant error stream so the client
      // shows a graceful message instead of a broken socket.
      yield _frame({ type: 'RUN_STARTED', threadId: thread.id, runId });
      yield _frame({ type: 'RUN_ERROR', message: 'AskGov is temporarily unavailable. Please try again.', code: 'AGENT_UNAVAILABLE' });
      _emit(AgentDomainEvent.RUN_FAILED, { threadId: thread.id, runId, error: err.message });
      return;
    }

    const decoder = new TextDecoder();
    const parser = new SseParser();
    try {
      for await (const chunk of res.body) {
        const text = decoder.decode(chunk, { stream: true });
        for (const evt of parser.push(text)) acc.consume(evt);
        yield text; // forward upstream bytes unchanged
      }
    } finally {
      await _finalizeRun(ctx, thread.id, runId, acc, dto);
    }
  }

  async function _finalizeRun(ctx, threadId, runId, acc, dto) {
    try {
      const latest = await threads.findById(threadId, ctx);
      if (!latest) return;
      const patch = {};
      const text = sanitizeText(acc.text());
      if (text || acc.toolCalls.length || acc.prefill) {
        const message = {
          id: acc.messageId || `m_${randomUUID().slice(0, 10)}`,
          role: 'assistant',
          content: text,
          runId,
          createdAt: new Date().toISOString(),
        };
        if (acc.toolCalls.length) message.toolCalls = acc.toolCalls.map(sanitizeJson);
        if (acc.prefill) message.prefill = sanitizeJson(acc.prefill);
        if (acc.suggestions.length) message.suggestions = acc.suggestions.map((s) => sanitizeText(s, 200));
        patch.messages = [...(latest.messages || []), message];
      }
      if (acc.proposedPrefill) patch.proposedPrefill = sanitizeJson(acc.proposedPrefill);
      if (dto.page?.serviceId) patch.serviceId = dto.page.serviceId;
      if (dto.page?.formValues) patch.formState = { ...(latest.formState || {}), ...sanitizeJson(dto.page.formValues) };
      if (Object.keys(patch).length) await threads.update(threadId, patch, latest.version, ctx);
      _emit(AgentDomainEvent.RUN_FINISHED, { threadId, runId, mode: acc.mode });
    } catch (err) {
      log.warn({ err: err.message, threadId, runId }, 'finalizeRun failed');
    }
  }

  // ── non-streaming extraction (Phase 7) ──────────────────────────────────────
  /**
   * Run once server-side and return the extracted entities with confidence, source,
   * timestamp and validation state. Reuses the engine's `suggest_prefill` output
   * (CUSTOM "Prefill") — the field registry/mapping already lives in the Python tool.
   */
  async function extract({ auth, threadId, message, page, token }) {
    const thread = await ensureThread({ auth, threadId, page });
    const runId = `run_${randomUUID().slice(0, 12)}`;
    const runInput = _buildRunInput(
      { ...thread, messages: [...(thread.messages || []), { role: 'user', content: message }] },
      { message, page, trigger: AgentTrigger.USER_MESSAGE },
      runId,
    );
    const eventsOut = await gateway.collectRun(runInput, { token });
    const acc = new RunAccumulator();
    for (const evt of eventsOut) acc.consume(evt);

    const now = new Date().toISOString();
    const prefill = acc.prefill || {};
    const entities = (prefill.fields || []).map((f) => ({
      field: f.name,
      value: f.value,
      label: f.label,
      confidence: f.confidence || 'medium',
      source: f.source || 'agent',
      overridden: !!f.overridden,
      timestamp: now,
      validationState: 'pending', // client Validation Layer confirms on apply
    }));
    return {
      threadId: thread.id,
      text: sanitizeText(acc.text()),
      entities,
      remaining: prefill.remaining || [],
      documents: prefill.documents || [],
      mode: acc.mode,
    };
  }

  // ── status (Phase 9) ────────────────────────────────────────────────────────
  async function status() {
    if (!config.enabled) return { enabled: false, upstream: 'disabled' };
    try {
      const health = await gateway.health();
      return { enabled: true, upstream: 'ok', ...health };
    } catch (err) {
      return { enabled: true, upstream: 'unavailable', error: err.message };
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  function _buildRunInput(thread, dto, runId) {
    const history = (thread.messages || [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-config.historyReplayLimit)
      .map((m) => ({ id: m.id || `m_${randomUUID().slice(0, 8)}`, role: m.role, content: m.content }));

    const page = { ...(dto.page || {}) };
    if (page.formValues == null && thread.formState) page.formValues = thread.formState;
    const state = { ...page };
    if (thread.proposedPrefill) state.proposedPrefill = thread.proposedPrefill;

    return {
      threadId: thread.id,
      runId,
      messages: history,
      state,
      forwardedProps: { trigger: dto.trigger || AgentTrigger.USER_MESSAGE },
    };
  }

  async function _appendMessage(ctx, thread, message) {
    return _updateWithRetry(ctx, thread.id, (current) => ({
      messages: [...(current.messages || []), message],
    }));
  }

  /** Optimistic-concurrency update with a single re-read retry (multi-tab safety). */
  async function _updateWithRetry(ctx, id, patchOrFn, attempt = 0) {
    const current = await threads.findById(id, ctx);
    if (!current) throw new NotFoundError('Conversation not found');
    const patch = typeof patchOrFn === 'function' ? patchOrFn(current) : patchOrFn;
    try {
      return await threads.update(id, patch, current.version, ctx);
    } catch (err) {
      if (err.code === 'CONFLICT' && attempt < 2) return _updateWithRetry(ctx, id, patchOrFn, attempt + 1);
      throw err;
    }
  }

  function _emit(type, payload) {
    try {
      events?.emit?.(type, payload);
    } catch { /* eventing is best-effort */ }
  }

  function _frame(obj) {
    return `data: ${JSON.stringify({ ...obj, timestamp: Date.now() })}\n\n`;
  }

  return {
    createSession,
    listSessions,
    getHistory,
    getThreadOrThrow,
    reset,
    syncForm,
    streamRun,
    extract,
    status,
  };
}
