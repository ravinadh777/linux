// Gateway to the Ask_Agent Python service (Phase 2 — gateway; Phase 3 — streaming).
// This is the ONLY place that knows the upstream wire details. It reuses the running
// FastAPI + LangGraph engine (service/app) as-is; it never re-implements agent logic.
// Node 20+ global fetch/undici gives us a streaming response body for SSE.
import { IntegrationUnavailableError } from '../../../lib/errors.js';
import { logger } from '../../../lib/logger.js';
import { SseParser } from '../utils/sse.js';

const log = logger.child ? logger.child({ mod: 'agent.gateway' }) : logger;

export function createAgentGateway({ config }) {
  const base = config.serviceUrl;

  async function _json(path, { method = 'GET', token, timeoutMs = config.timeoutMs } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: ctl.signal,
      });
      if (!res.ok) throw new IntegrationUnavailableError(`Agent service ${path} → ${res.status}`);
      return await res.json();
    } catch (err) {
      throw _wrap(err, path);
    } finally {
      clearTimeout(timer);
    }
  }

  function _wrap(err, path) {
    if (err instanceof IntegrationUnavailableError) return err;
    log.warn({ err: err.message, path }, 'agent upstream error');
    return new IntegrationUnavailableError('AskGov agent service is unavailable');
  }

  return {
    /** GET /health — upstream status + mode (openai|deterministic). */
    health: () => _json('/health', { timeoutMs: 5000 }),

    /** GET /knowledge-base — catalogue + ingested-doc summary. */
    knowledgeBase: () => _json('/knowledge-base'),

    /**
     * POST /agent — open the SSE run and return the raw fetch Response so the caller
     * can pipe/tee the body. `signal` lets the controller abort on client disconnect.
     * @returns {Promise<Response>}
     */
    async openRun(runInput, { token, signal } = {}) {
      let res;
      try {
        res = await fetch(`${base}/agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(runInput),
          signal,
        });
      } catch (err) {
        throw _wrap(err, '/agent');
      }
      if (!res.ok || !res.body) {
        throw new IntegrationUnavailableError(`Agent run failed → ${res?.status ?? 'no-body'}`);
      }
      return res;
    },

    /**
     * Run to completion server-side and return every decoded AG-UI event. Used by the
     * non-streaming /extract endpoint. Aborts on timeout.
     * @returns {Promise<object[]>}
     */
    async collectRun(runInput, { token } = {}) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), config.timeoutMs);
      try {
        const res = await this.openRun(runInput, { token, signal: ctl.signal });
        const parser = new SseParser();
        const decoder = new TextDecoder();
        const events = [];
        for await (const chunk of res.body) {
          for (const evt of parser.push(decoder.decode(chunk, { stream: true }))) events.push(evt);
        }
        return events;
      } catch (err) {
        throw _wrap(err, '/agent(collect)');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
