// Agent routes (Phase 2 — enterprise API surface). All routes require an authenticated
// citizen; run-initiating routes are additionally rate-limited (Phase 11).
import { Router } from 'express';
import { createAgentController } from '../controllers/agent.controller.js';
import { createRateLimiter } from '../middleware/rateLimit.middleware.js';
import { agentConfig } from '../config/agent.config.js';

export function createAgentRouter({ agentService, requireAuth }) {
  const r = Router();
  const c = createAgentController({ agentService });
  const rateLimit = createRateLimiter(agentConfig.rateLimit);

  // Streaming + run-initiating (rate-limited)
  r.post('/agent/chat', requireAuth, rateLimit, c.chat);
  r.post('/agent/extract', requireAuth, rateLimit, c.extract);

  // Session + state management
  r.post('/agent/session', requireAuth, c.createSession);
  r.get('/agent/sessions', requireAuth, c.listSessions);
  r.get('/agent/history', requireAuth, c.history);
  r.post('/agent/reset', requireAuth, c.reset);
  r.post('/agent/form-sync', requireAuth, c.formSync);

  // Observability
  r.get('/agent/status', requireAuth, c.status);

  return r;
}
