// Application context: builds the container, repositories and services (DI composition root).
// app.js and tests use this so wiring is declared in exactly one place.
import path from 'node:path';
import { env, dataDir as configuredDataDir } from './config/env.js';
import { createContainer } from './config/container.js';
import { buildDatabaseConfig, describeDatabase } from './config/database.js';
import { createRepositories } from './config/repositories.js';
import { ensureSeeded } from './lib/seed.js';
import { loadConfigFromDb } from './repositories/postgres/seed.js';
import { migrate as migratePostgres } from './repositories/postgres/schema.js';
import { logger } from './lib/logger.js';
import { loadReferenceData, loadCatalogue } from './lib/referenceData.js';
import { createFileStorage } from './lib/fileStorage.js';
import { createAvScanner } from './lib/avScanner.js';
import { createIdentityService } from './platform/identity/identity.service.js';
import { createVaultService } from './platform/vault/vault.service.js';
import { createCatalogueService } from './platform/catalogue/catalogue.service.js';
import { createApplicationsService } from './platform/applications/applications.service.js';
import { createDraftsService } from './platform/applications/drafts.service.js';
import { createAppointmentsService } from './platform/appointments/appointments.service.js';
import { createRecordsService } from './platform/records/records.service.js';
import { createDashboardService } from './platform/dashboard/dashboard.service.js';
import { createAssistantService } from './platform/assistant/assistant.service.js';
import { createNotificationsService, NOTIFY_EVENTS } from './platform/notifications/notifications.service.js';
import { createWebhookDispatcher } from './events/webhookDispatcher.js';
import { createEventBus } from './events/eventBus.js';
import { createWebhookService } from './platform/webhooks/webhooks.service.js';
import { createAuditService } from './platform/audit/audit.service.js';
import { createReferenceService } from './platform/reference/reference.service.js';
import { createAgentModule } from './modules/agent/index.js';

/**
 * @param {Object} [opts]
 * @param {string} [opts.dataDir] - data dir (defaults to the configured DATA_DIR, i.e. repo-root/data)
 * @param {'json'|'postgres'} [opts.driver]
 * @param {boolean} [opts.seed] - copy seed→store on build (default true)
 */
export async function buildContext(opts = {}) {
  const dataDir = opts.dataDir || configuredDataDir;
  const driver = opts.driver || env.PERSISTENCE_DRIVER || 'json';

  // Driver-specific one-time setup. The JSON driver copies CONFIG seed files (catalogue/
  // reference) into a store dir; the Postgres driver ensures tables. No user data is seeded
  // in either driver — accounts exist only once created via /auth/register.
  if (driver === 'json' && opts.seed !== false) await ensureSeeded(dataDir);

  const dbConfig = driver === 'postgres' ? buildDatabaseConfig() : undefined;
  const container = createContainer({ driver, dataDir, dbConfig });
  const repos = createRepositories(container);

  // Configuration data (service catalogue + reference lists). Postgres → served from the DB
  // (seeded once from files); JSON driver / tests → loaded from files.
  let referenceData;
  let catalogueData;
  if (driver === 'postgres') {
    logger.info({ db: describeDatabase() }, 'using postgres persistence driver');
    if (env.DB_AUTO_MIGRATE) await migratePostgres(container.registry); // create tables/indexes/FKs
    // No user/mock seeding — accounts come only from /auth/register. Only config is bootstrapped.
    const config = await loadConfigFromDb(container, dataDir);
    catalogueData = config.catalogueData;
    referenceData = config.referenceData;
  } else {
    referenceData = await loadReferenceData(dataDir);
    catalogueData = await loadCatalogue(dataDir);
  }

  // Eventing: dispatcher (webhooks) + outbox-backed event bus.
  const dispatcher = createWebhookDispatcher({ repos, transport: opts.webhookTransport, logger });
  const events = createEventBus({ registry: container.registry, repos, dispatcher, logger });

  const reference = createReferenceService({ data: referenceData });
  const storage = createFileStorage({ dir: path.join(dataDir, 'store', 'vault', 'files') });
  const avScanner = createAvScanner({ mode: env.AV_SCANNER });

  const catalogue = createCatalogueService({ data: catalogueData });
  const vault = createVaultService({ repos, storage, avScanner, referenceService: reference, maxMb: env.MAX_UPLOAD_MB });
  // Drafts are constructed BEFORE applications and injected into it, so that a
  // successful submit can retire the citizen's in-progress draft (see create()).
  const drafts = createDraftsService({ repos, catalogueService: catalogue });
  const applications = createApplicationsService({ repos, catalogueService: catalogue, events, vaultService: vault, draftsService: drafts });
  const appointments = createAppointmentsService({ repos, events });
  // Citizen records: vehicles, properties, employment, family, wallet, messages,
  // business. One service over seven owner-scoped collections.
  const records = createRecordsService({ repos, events });

  // AskGov agent gateway — proxies/streams to the reused Ask_Agent Python engine.
  const agentModule = createAgentModule({ repos, events });

  // Real-time application notifications: turn workflow events into persisted + pushed alerts.
  const notifications = createNotificationsService({ repos, logger });
  for (const type of NOTIFY_EVENTS) events.subscribe(type, (record) => notifications.notifyFromEvent(record));

  // Built once and shared — the dashboard also reads the citizen's profile (for
  // age/TIN-gated suggestions), and two instances over the same repos would be waste.
  const identity = createIdentityService({ repos });

  const services = {
    identity,
    webhooks: createWebhookService({ repos }),
    audit: createAuditService({ repos }),
    reference,
    vault,
    catalogue,
    applications,
    drafts,
    appointments,
    records,
    // Every dashboard feed is an owner-scoped DB read now, so the service needs the
    // four sources those reads come from: applications, drafts, the persisted
    // notification feed, the citizen's own records (vehicle renewal dates) and their
    // profile (age/TIN gating for explainable suggestions).
    dashboard: createDashboardService({
      applicationsService: applications,
      draftsService: drafts,
      notificationsService: notifications,
      recordsService: records,
      identityService: identity,
    }),
    assistant: createAssistantService({ repos }),
    notifications,
    agent: agentModule.service,
    events,
  };

  return { container, repos, services, events, dataDir, driver };
}
