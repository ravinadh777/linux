# Persistence & Database

oneCitizen ships with a **driver-swappable persistence layer**. The same domain code runs on
either driver — switching is a **pure environment change, no code or path edits**.

| Driver | When | How |
|---|---|---|
| `json` (default) | local dev, demos, tests | file store under `DATA_DIR` — zero setup |
| `postgres` | staging / production | PostgreSQL via `DATABASE_URL` or `PG*` env |

## Architecture (why the swap is safe)

Services depend only on the **Repository contract** (`repositories/base/Repository.js`) obtained from
the DI **container**. Each driver implements that contract and the container returns the same shape
`{ driver, registry, repository, withTransaction }`:

```
context.js ─ createContainer({driver}) ─┬─ json/     JsonRepository   (file store)
                                        └─ postgres/ PostgresRepository (JSONB tables)
services (identity, applications, agent, …)  ──▶ same contract, unchanged
```

Both drivers implement identical semantics: **per-owner scope filtering, optimistic concurrency
(`version`), soft-delete, cursor pagination, append-only collections, and transactions**
(`withTransaction` + `afterCommit` outbox hooks). `pg` is imported **lazily** — the JSON driver and
the test suite never load it.

### Postgres storage model (hybrid: relational columns + JSONB body)
The full record lives in a `data JSONB` column, AND the fields that matter for relations,
workflow and reporting are **projected into real, typed, indexed columns** (see
`repositories/postgres/schema.js` → `COLUMN_MAP`). You get relational rigor (FKs, indexes,
SQL for the back-office) without losing the flexible document body — and services never change.

Rich tables:
- **`identities`** — citizens *and* officers (`user_type` discriminates). Unique **`eid`**
  (the citizen key everything joins on), unique `identifier`, `roles`, `agency_code`.
- **`applications`** — `citizen_eid → identities(eid)`, `assigned_officer → identities(eid)`,
  `service_id`, `agency_code`, `status`, `form_data JSONB`, and the full audit set:
  `created_by`, `submitted_at`, `reviewed_by/at`, `approved_by/at`, `rejected_by/at`,
  `rejection_reason`. Indexed on citizen, status, agency, `(agency,status)`, officer, service, created.
- **`application_events`** — immutable audit trail `→ applications(id) ON DELETE CASCADE`
  (`action`, `from_status`, `to_status`, `actor_eid`, `actor_role`, `note`).
- **`appointments`**, **`documents`** — owner FK to `identities(eid)` + workflow/audit columns.
- Supporting collections (`clients`, `otps`, `refresh_tokens`, `delegations`, `audit`, `events`,
  `webhook_*`, `agent_threads`) use the generic `id/data/version/timestamps` shape.

The whole schema is created transactionally on boot (`DB_AUTO_MIGRATE`) and is idempotent.

### Citizen ↔ back-office workflow (one DB, two apps)
The **citizen app** submits (`POST /applications` → status `submitted`, `application_events` gets a
`submitted` row). The **future back-office app** reuses the same service + tables via the officer
endpoints — agency-scoped queue and transitions:
`GET /applications/queue?status=` · `POST /applications/:id/{assign,review,approve,reject}` ·
`GET /applications/:id/history`. Each transition stamps the matching `*_by`/`*_at` columns and appends
an `application_events` row. Officers are scoped to their agency via the JWT `agency` claim; oversight/
sysadmin are unrestricted. Everything keys off the citizen's unique **`eid`**.

## Switch to Postgres in 3 steps

1. **Create the role + database** (once, as a superuser — match the password to `backend/.env`):
   ```bash
   psql -U postgres -h 127.0.0.1 -f backend/scripts/db-setup.sql
   # or: npm --workspace backend run db:setup
   ```
2. **Point `backend/.env` at it** and flip the driver:
   ```ini
   PERSISTENCE_DRIVER=postgres
   DATABASE_URL=postgresql://onecitizen:onecitizen@localhost:5432/onecitizen
   # (or the discrete PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE values)
   ```
3. **Start the backend** (`npm run dev`). On boot it creates the tables and seeds
   `identities`/`clients` from `data/seed` (only if empty). Login works immediately.

That's it — no path or code changes. Managed Postgres (RDS/Cloud SQL/Neon): set `DATABASE_URL` and
`PGSSL=true`.

## Verifying
A live contract test (`repositories/postgres/PostgresRepository.test.js`) exercises
create/read/optimistic-update/version-conflict/scope-isolation/soft-delete/transaction-rollback
against a real DB. It **auto-skips** when no database is reachable, and turns green once `backend/.env`
points at a working Postgres — run `npm --workspace backend test`.

## Notes
- Reference/catalogue and other static config remain file-sourced (loaded the same way in both
  drivers) — only mutable domain collections live in the DB.
- `find` currently filters/paginates in the app for exact parity with the JSON driver (incl.
  predicate scopes). SQL push-down can be added later behind the same contract without touching callers.
