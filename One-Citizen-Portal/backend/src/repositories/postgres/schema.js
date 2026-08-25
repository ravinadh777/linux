// Relational schema for the oneCitizen platform. Users register through the app; every
// user-owned record (applications, appointments, documents) is keyed on the immutable
// users.id via a user_id foreign key. There is no seeded/mock identity data — the database
// is the single source of truth and is populated entirely by real registrations at runtime.
//
// The COLUMN_MAP tells the PostgresRepository which record fields to project into columns
// on write (and which are safe to push down as indexed WHERE filters on read). Anything not
// listed still lives in `data`. Nothing here couples the JSON driver — it ignores columns.

// ── promoted-column projections (record field → SQL column) ─────────────────────
// type: 'scalar' (default) | 'jsonb' | 'ts'. `field` enables read push-down; `get`
// derives a value with no push-down (used for computed columns).
const AUDIT_COLUMNS = [
  { col: 'created_by', field: 'ownerId' },
  { col: 'submitted_at', field: 'submittedAt', type: 'ts' },
  { col: 'reviewed_by', field: 'reviewedBy' },
  { col: 'reviewed_at', field: 'reviewedAt', type: 'ts' },
  { col: 'approved_by', field: 'approvedBy' },
  { col: 'approved_at', field: 'approvedAt', type: 'ts' },
  { col: 'rejected_by', field: 'rejectedBy' },
  { col: 'rejected_at', field: 'rejectedAt', type: 'ts' },
  { col: 'rejection_reason', field: 'rejectionReason' },
  { col: 'assigned_officer', field: 'assignedOfficer' },
];

export const COLUMN_MAP = Object.freeze({
  users: [
    { col: 'email', field: 'email' },
    { col: 'name', field: 'name' },
    { col: 'role', field: 'role' },
    { col: 'password_hash', field: 'passwordHash' },
    { col: 'status', get: (r) => r.status || 'active' },
    { col: 'profile', field: 'profile', type: 'jsonb' },
  ],
  applications: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'reference', field: 'reference' },
    { col: 'service_id', field: 'serviceId' },
    { col: 'service_name', field: 'serviceName' },
    { col: 'agency_code', field: 'agencyCode' },
    { col: 'agency_name', field: 'agencyName' },
    { col: 'ministry_code', field: 'ministryCode' },
    { col: 'kind', field: 'kind' },
    { col: 'status', field: 'status' },
    { col: 'form_data', field: 'form', type: 'jsonb' },
    { col: 'documents', field: 'documents', type: 'jsonb' },
    ...AUDIT_COLUMNS,
  ],
  // In-progress application drafts — see the DDL below for why this is its own
  // table rather than an `applications` row with status='draft'.
  application_drafts: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'service_id', field: 'serviceId' },
    { col: 'active_step', field: 'activeStep' },
    { col: 'form_data', field: 'form', type: 'jsonb' },
    { col: 'documents', field: 'documents', type: 'jsonb' },
    { col: 'last_saved_at', field: 'lastSavedAt', type: 'ts' },
  ],
  appointments: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'service_id', field: 'serviceId' },
    { col: 'status', field: 'status' },
    { col: 'scheduled_at', field: 'scheduledAt', type: 'ts' },
    { col: 'agency_code', field: 'agencyCode' },
    ...AUDIT_COLUMNS,
  ],
  documents: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'application_id', field: 'applicationId' },
    { col: 'service_type', field: 'serviceType' },
    { col: 'filename', field: 'filename' },
    { col: 'content_type', get: (r) => r.contentType || r.format },
    { col: 'checksum', field: 'hash' },
    { col: 'status', get: (r) => r.status || r.scanStatus },
    { col: 'created_by', field: 'ownerId' },
  ],
  notifications: [
    { col: 'user_id', field: 'userId' },
    { col: 'application_id', field: 'applicationId' },
    { col: 'type', field: 'type' },
    { col: 'is_read', field: 'isRead' },
  ],
  application_events: [
    { col: 'application_id', field: 'applicationId' },
    { col: 'from_status', field: 'fromStatus' },
    { col: 'to_status', field: 'toStatus' },
    { col: 'action', field: 'action' },
    { col: 'actor_eid', field: 'actorEid' },
    { col: 'actor_role', field: 'actorRole' },
    { col: 'note', field: 'note' },
  ],

  // ── Citizen records (platform/records) ─────────────────────────────────────
  // Each promotes `user_id` so the owner filter is an indexed WHERE rather than a
  // JSONB scan, plus the one or two fields actually queried or sorted on. Every
  // other attribute stays in `data`.
  vehicles: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'registration', field: 'registration' },
    { col: 'licence_expiry', field: 'licenceExpiry' },
  ],
  properties: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'region', field: 'region' },
    { col: 'title_number', field: 'titleNumber' },
  ],
  employment: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'employer', field: 'employer' },
    { col: 'is_current', field: 'current' },
  ],
  family: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'full_name', field: 'fullName' },
    { col: 'relationship', field: 'relationship' },
  ],
  wallet_methods: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'kind', field: 'kind' },
    { col: 'is_default', field: 'isDefault' },
  ],
  messages: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'agency_code', field: 'agencyCode' },
    { col: 'is_read', field: 'isRead' },
    { col: 'archived', field: 'archived' },
    { col: 'sent_at', field: 'sentAt', type: 'ts' },
  ],
  businesses: [
    { col: 'user_id', field: 'ownerId' },
    { col: 'registration_number', field: 'registrationNumber' },
    { col: 'name', field: 'name' },
  ],
});

// ── DDL ──────────────────────────────────────────────────────────────────────
// Every statement is idempotent (IF NOT EXISTS) so boot migration is safe to re-run.
const DDL = `
-- Users: created exclusively via /auth/register. id is the permanent, immutable user_id.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'citizen',
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  profile       JSONB,
  data          JSONB NOT NULL,
  version       INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT,
  updated_at    TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (lower(email));
CREATE INDEX IF NOT EXISTS ix_users_role ON users (role);

-- Applications: owned by the authenticated user (user_id), reviewed by an officer.
CREATE TABLE IF NOT EXISTS applications (
  id                TEXT PRIMARY KEY,
  reference         TEXT UNIQUE,
  user_id           TEXT REFERENCES users(id),
  service_id        TEXT,
  service_name      TEXT,
  agency_code       TEXT,
  agency_name       TEXT,
  ministry_code     TEXT,
  kind              TEXT,
  status            TEXT NOT NULL DEFAULT 'submitted',
  form_data         JSONB,
  documents         JSONB,
  assigned_officer  TEXT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT,
  submitted_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       TEXT,
  approved_at       TIMESTAMPTZ,
  approved_by       TEXT,
  rejected_at       TIMESTAMPTZ,
  rejected_by       TEXT,
  rejection_reason  TEXT,
  data              JSONB NOT NULL,
  version           INTEGER,
  updated_at        TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_applications_user ON applications (user_id);
CREATE INDEX IF NOT EXISTS ix_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS ix_applications_agency ON applications (agency_code);
CREATE INDEX IF NOT EXISTS ix_applications_service ON applications (service_id);
CREATE INDEX IF NOT EXISTS ix_applications_officer ON applications (assigned_officer);
CREATE INDEX IF NOT EXISTS ix_applications_agency_status ON applications (agency_code, status);
CREATE INDEX IF NOT EXISTS ix_applications_created ON applications (created_at DESC, id);

-- Immutable per-application audit trail (who did what, when).
CREATE TABLE IF NOT EXISTS application_events (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT,
  action         TEXT,
  actor_eid      TEXT,
  actor_role     TEXT,
  note           TEXT,
  data           JSONB NOT NULL,
  version        INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_application_events_app ON application_events (application_id, created_at);

-- ── In-progress application drafts ──────────────────────────────────────────
-- Server-side autosave, so a citizen who refreshes, is logged out by the 15-minute
-- access-token expiry, closes the tab, or switches device resumes EXACTLY where they
-- left off instead of restarting a 40-field form. Keyed to (user_id, service_id):
-- one live draft per citizen per service, so autosave is an idempotent upsert with
-- no risk of accumulating a row per keystroke.
--
-- WHY A SEPARATE TABLE rather than an applications row with status='draft':
--   1. applications.listQueue() / find({}) are the BACK-OFFICE officer surface and
--      filter by agency lane, not by status. A draft row would immediately appear in
--      an officer's queue — a half-typed form leaking to a government reviewer.
--   2. The reference column is UNIQUE on applications and is minted at submit time.
--      Drafts have no reference, so they would need a nullable-unique special case.
--   3. The lifecycles genuinely differ: a draft is mutable, autosaved many times a
--      minute, and disposable; an application is an audited, immutable-by-default
--      record with an event trail. Keeping them apart means NO existing citizen or
--      officer query changes behaviour.
--
-- The documents column holds only the vault metadata map
-- (field -> { documentId, filename }). The FILES themselves are already durably
-- persisted by the vault at upload time, so a resumed draft recovers its uploads
-- without re-uploading anything.
--
-- NB: no backticks anywhere in this comment. The whole DDL lives inside a JS
-- template literal, so a backtick here terminates the string and breaks the module.
CREATE TABLE IF NOT EXISTS application_drafts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  service_id    TEXT NOT NULL,
  active_step   INTEGER NOT NULL DEFAULT 0,
  form_data     JSONB,
  documents     JSONB,
  last_saved_at TIMESTAMPTZ,
  data          JSONB NOT NULL,
  version       INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ
);
-- One live draft per citizen per service. Partial on deleted_at so submitting (which
-- clears the draft) never blocks starting the same service again.
CREATE UNIQUE INDEX IF NOT EXISTS ux_application_drafts_owner_service
  ON application_drafts (user_id, service_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_application_drafts_user
  ON application_drafts (user_id, last_saved_at DESC);

-- Appointments (also officer-confirmable).
CREATE TABLE IF NOT EXISTS appointments (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id),
  service_id        TEXT,
  status            TEXT,
  scheduled_at      TIMESTAMPTZ,
  agency_code       TEXT,
  assigned_officer  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT,
  submitted_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       TEXT,
  approved_at       TIMESTAMPTZ,
  approved_by       TEXT,
  rejected_at       TIMESTAMPTZ,
  rejected_by       TEXT,
  rejection_reason  TEXT,
  data              JSONB NOT NULL,
  version           INTEGER,
  updated_at        TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_appointments_user ON appointments (user_id);
CREATE INDEX IF NOT EXISTS ix_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS ix_appointments_created ON appointments (created_at DESC, id);

-- Document vault. Each document is tagged with its uploader (user_id) AND, once submitted,
-- the application + service it belongs to — so it is queryable by user OR by application.
CREATE TABLE IF NOT EXISTS documents (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id),
  application_id TEXT REFERENCES applications(id),
  service_type   TEXT,
  filename       TEXT,
  content_type   TEXT,
  checksum       TEXT,
  status         TEXT,
  data           JSONB NOT NULL,
  version        INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     TEXT,
  updated_at     TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ
);
-- Additive self-heal for pre-existing databases (idempotent, non-destructive).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS application_id TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum TEXT;
CREATE INDEX IF NOT EXISTS ix_documents_user ON documents (user_id);
CREATE INDEX IF NOT EXISTS ix_documents_application ON documents (application_id);
CREATE INDEX IF NOT EXISTS ix_documents_created ON documents (created_at DESC, id);

-- Per-citizen application notifications (status changes, requests, decisions). Realtime is
-- pushed over SSE; every notification is also persisted here for the notification centre.
CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id),
  application_id TEXT,
  type           TEXT,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  data           JSONB NOT NULL,
  version        INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notifications_unread ON notifications (user_id, is_read);

-- ── Citizen records ─────────────────────────────────────────────────────────
-- Seven citizen-owned collections behind the portal's record modules. Each is keyed
-- on users.id via user_id ON DELETE CASCADE, so closing an account takes its records
-- with it. There is NO seed data: every row is created by a real citizen request, and
-- an empty account correctly returns an empty list.

CREATE TABLE IF NOT EXISTS vehicles (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id) ON DELETE CASCADE,
  registration   TEXT,
  licence_expiry TEXT,
  data           JSONB NOT NULL,
  version        INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_vehicles_user ON vehicles (user_id, created_at DESC);
-- One plate per citizen. Partial so soft-deleted rows do not block re-adding.
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicles_reg ON vehicles (user_id, lower(registration))
  WHERE deleted_at IS NULL AND registration IS NOT NULL;

CREATE TABLE IF NOT EXISTS properties (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  region       TEXT,
  title_number TEXT,
  data         JSONB NOT NULL,
  version      INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_properties_user ON properties (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employment (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  employer   TEXT,
  is_current BOOLEAN,
  data       JSONB NOT NULL,
  version    INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_employment_user ON employment (user_id, is_current DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS family (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  full_name    TEXT,
  relationship TEXT,
  data         JSONB NOT NULL,
  version      INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_family_user ON family (user_id, full_name);

-- Payment methods. Deliberately holds NO pan, cvv or full account number: only what
-- is needed to RECOGNISE a method. Anything sensitive belongs with a payment
-- processor, never in this database.
CREATE TABLE IF NOT EXISTS wallet_methods (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT,
  is_default BOOLEAN,
  data       JSONB NOT NULL,
  version    INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_wallet_user ON wallet_methods (user_id, is_default DESC);

-- Messages are sent BY agencies TO a citizen. The citizen may only mark them read or
-- archived (enforced in records.service.js), never edit or destroy the content.
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  agency_code TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  archived    BOOLEAN NOT NULL DEFAULT false,
  sent_at     TIMESTAMPTZ,
  data        JSONB NOT NULL,
  version     INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_messages_user ON messages (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS ix_messages_unread ON messages (user_id, is_read) WHERE archived = false;

CREATE TABLE IF NOT EXISTS businesses (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT REFERENCES users(id) ON DELETE CASCADE,
  registration_number TEXT,
  name                TEXT,
  data                JSONB NOT NULL,
  version             INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_businesses_user ON businesses (user_id, name);
`;

// Generic document tables (id/data/version/timestamps) for supporting collections that
// don't need promoted columns. Kept explicit so the whole schema is created up-front.
const GENERIC_TABLES = [
  'refresh_tokens', 'revoked_tokens',
  'audit', 'events', 'webhook_subscriptions', 'webhook_deliveries', 'agent_threads',
  'catalogue', 'reference', // configuration data (service catalogue + reference lists)
];

function genericDdl(table) {
  return `
CREATE TABLE IF NOT EXISTS ${table} (
  id         TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  version    INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_${table}_created ON ${table} (created_at, id);
CREATE INDEX IF NOT EXISTS ix_${table}_data ON ${table} USING GIN (data jsonb_path_ops);`;
}

export const MIGRATION_SQL = [DDL, ...GENERIC_TABLES.map(genericDdl)].join('\n');

/**
 * Create the whole schema (idempotent). Runs inside a single transaction so a partial
 * failure leaves nothing half-applied.
 * @param {{ query: Function, withTransaction: Function }} registry
 */
export async function migrate(registry) {
  await registry.withTransaction(async () => {
    await registry.query(MIGRATION_SQL);
  });
}
