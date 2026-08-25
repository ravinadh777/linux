// Express application assembly.
// Middleware order (Architecture §2.3 / backend/ARCHITECTURE.md §6):
//   requestId → httpLogger → security(helmet) → cors → json → authenticate
//   → [routers] → notFound → errorHandler
// rbac/scope/validate/audit guards are applied per-route as their stories land.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env, corsOrigins } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { httpLogger } from './middleware/httpLogger.js';
import { notFound, errorHandler } from './middleware/error.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { scope } from './middleware/scope.js';
import { createIdentityRouter } from './platform/identity/identity.routes.js';
import { createWebhooksRouter } from './platform/webhooks/webhooks.routes.js';
import { createAuditRouter } from './platform/audit/audit.routes.js';
import { createReferenceRouter } from './platform/reference/reference.routes.js';
import { createVaultRouter } from './platform/vault/vault.routes.js';
import { createCatalogueRouter } from './platform/catalogue/catalogue.routes.js';
import { createApplicationsRouter } from './platform/applications/applications.routes.js';
import { createAppointmentsRouter } from './platform/appointments/appointments.routes.js';
import { createRecordsRouter } from './platform/records/records.routes.js';
import { createDashboardRouter } from './platform/dashboard/dashboard.routes.js';
import { createAssistantRouter } from './platform/assistant/assistant.routes.js';
import { createNotificationsRouter } from './platform/notifications/notifications.routes.js';
import { createAgentRouter } from './modules/agent/index.js';
import { mountSwagger } from './docs/swagger.js';

/**
 * @param {import('./context.js').buildContext extends (...a:any)=>Promise<infer C> ? C : any} ctx
 */
export function createApp(ctx) {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  const { authenticate, requireAuth } = createAuthMiddleware(ctx.services.identity);
  app.use(authenticate); // populate req.auth when a token is present
  app.use(scope); // attach req.scope(opts) → repository scope ctx

  // Infrastructure
  app.get('/health', (_req, res) => res.json({ status: 'ok', version: '0.1.0', env: env.NODE_ENV }));

  // API v1
  const api = express.Router();
  api.use(createIdentityRouter({ identityService: ctx.services.identity, requireAuth }));
  api.use(createWebhooksRouter({ webhookService: ctx.services.webhooks, requireAuth }));
  api.use(createAuditRouter({ auditService: ctx.services.audit, requireAuth }));
  api.use(createReferenceRouter({ referenceService: ctx.services.reference }));
  api.use(createVaultRouter({ vaultService: ctx.services.vault, requireAuth }));
  api.use(createCatalogueRouter({ catalogueService: ctx.services.catalogue }));
  api.use(createApplicationsRouter({ applicationsService: ctx.services.applications, draftsService: ctx.services.drafts, requireAuth }));
  api.use(createAppointmentsRouter({ appointmentsService: ctx.services.appointments, requireAuth }));
  // Citizen records: /vehicles /properties /employment /family /wallet /messages
  // /businesses, plus /records/summary. All owner-scoped and auth-required.
  api.use(createRecordsRouter({ recordsService: ctx.services.records, requireAuth }));
  api.use(createDashboardRouter({ dashboardService: ctx.services.dashboard, requireAuth }));
  api.use(createAssistantRouter({ assistantService: ctx.services.assistant, requireAuth }));
  api.use(createNotificationsRouter({ notificationsService: ctx.services.notifications, requireAuth }));
  api.use(createAgentRouter({ agentService: ctx.services.agent, requireAuth }));
  app.use('/api/v1', api);

  // OpenAPI / Swagger UI
  mountSwagger(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
