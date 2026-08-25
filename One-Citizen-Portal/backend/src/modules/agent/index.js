// Agent module composition root (Phase 9 — dependency injection).
// Assembles the gateway + service from injected repositories/config so context.js
// wires it in one line, and app.js mounts the router. No singletons, no globals.
import { createAgentGateway } from './gateway/agent.gateway.js';
import { createAgentService } from './services/agent.service.js';
import { agentConfig } from './config/agent.config.js';

export { createAgentRouter } from './routes/agent.routes.js';
export { agentConfig } from './config/agent.config.js';

/**
 * Build the agent module's service graph.
 * @param {{ repos: object, events?: object, config?: object }} deps
 */
export function createAgentModule({ repos, events, config = agentConfig }) {
  const gateway = createAgentGateway({ config });
  const service = createAgentService({ repos, gateway, config, events });
  return { gateway, service };
}
