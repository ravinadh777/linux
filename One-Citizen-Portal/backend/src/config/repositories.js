// Central declaration of all repositories (name → options). Adding a module means
// adding its repositories here; services receive them via the container (DI).
export function createRepositories(container) {
  return {
    // Platform / identity — a single users table, populated only by /auth/register.
    users: container.repository('users', { prefix: 'usr' }),
    refreshTokens: container.repository('refresh-tokens', { prefix: 'rft' }),
    revokedTokens: container.repository('revoked-tokens', { prefix: 'rvk', appendOnly: true, subdir: 'platform' }),
    audit: container.repository('audit', { prefix: 'aud', appendOnly: true, subdir: 'platform' }),
    // Vault
    documents: container.repository('documents', { prefix: 'doc', subdir: 'vault', softDelete: true }),
    // Per-citizen application notifications
    notifications: container.repository('notifications', { prefix: 'ntf', subdir: 'platform' }),
    // Configuration data — source of truth in the DB (seeded once from data/seed).
    catalogue: container.repository('catalogue', { prefix: 'cat' }),
    reference: container.repository('reference', { prefix: 'ref' }),
    // Applications / tracking
    applications: container.repository('applications', { prefix: 'app' }),
    // In-progress form drafts (server-side autosave + resume). Deliberately a
    // SEPARATE collection from `applications` so a half-finished form can never
    // surface in the back-office officer queue — see the DDL note in
    // repositories/postgres/schema.js. Soft-delete so submitting a draft leaves a
    // trace rather than destroying it outright.
    applicationDrafts: container.repository('application-drafts', { prefix: 'adr', softDelete: true }),
    // Per-application audit trail / status history (shared with the back-office app).
    applicationEvents: container.repository('application-events', { prefix: 'ave' }),
    // Appointments (slot booking)
    appointments: container.repository('appointments', { prefix: 'apt' }),
    // AskGov agent — conversation threads (messages embedded per thread for atomic reset).
    agentThreads: container.repository('agent-threads', { prefix: 'thr', subdir: 'agent' }),
    // Eventing / webhooks
    events: container.repository('events', { prefix: 'evt', appendOnly: true, subdir: 'platform' }),
    webhookSubscriptions: container.repository('webhook-subscriptions', { prefix: 'whs', softDelete: true, subdir: 'platform' }),
    webhookDeliveries: container.repository('webhook-deliveries', { prefix: 'whd', appendOnly: true, subdir: 'platform' }),
    // ── Citizen records (platform/records) ───────────────────────────────────
    // Seven citizen-owned collections behind the portal's record modules. All are
    // soft-delete so a citizen removing a row does not destroy history an agency
    // may need to reference. Every row carries `ownerId` and is scope-filtered to
    // its owner — there is no seeded data in any of them.
    vehicles: container.repository('vehicles', { prefix: 'veh', subdir: 'records', softDelete: true }),
    properties: container.repository('properties', { prefix: 'prp', subdir: 'records', softDelete: true }),
    employment: container.repository('employment', { prefix: 'emp', subdir: 'records', softDelete: true }),
    family: container.repository('family', { prefix: 'fam', subdir: 'records', softDelete: true }),
    walletMethods: container.repository('wallet-methods', { prefix: 'wal', subdir: 'records', softDelete: true }),
    messages: container.repository('messages', { prefix: 'msg', subdir: 'records' }),
    businesses: container.repository('businesses', { prefix: 'biz', subdir: 'records', softDelete: true }),
  };
}

/** System ctx for platform-internal store access (auth store, audit). */
export const SYSTEM_CTX = Object.freeze({
  actor: 'system',
  roles: ['sysadmin'],
  scope: { unrestricted: true },
});
