// Agent module configuration (Phase 9 — configuration layer).
// All values are env-driven with safe defaults so the gateway degrades cleanly when
// the Ask_Agent Python service is not running. Kept in one place so the wiring in
// context.js stays declarative.
import { env } from '../../../config/env.js';

export const agentConfig = Object.freeze({
  /** Base URL of the Ask_Agent FastAPI service (service/app/main.py). */
  serviceUrl: (env.AGENT_SERVICE_URL || 'http://127.0.0.1:4100').replace(/\/+$/, ''),
  /** Feature flag — when false the REST surface returns 503 without calling upstream. */
  enabled: env.AGENT_ENABLED !== false,
  /** Upstream request timeout for non-streaming calls (ms). Streaming has no cap. */
  timeoutMs: Number(env.AGENT_TIMEOUT_MS ?? 30000),
  /** Per-user sliding-window rate limit for chat/extract runs. */
  rateLimit: Object.freeze({
    windowMs: Number(env.AGENT_RATE_WINDOW_MS ?? 60000),
    max: Number(env.AGENT_RATE_MAX ?? 30),
  }),
  /** Cap on messages replayed to the model per run (protects the context window). */
  historyReplayLimit: Number(env.AGENT_HISTORY_REPLAY ?? 20),
});
