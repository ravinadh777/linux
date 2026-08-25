# Architecture — oneCitizen Government Digital Services Platform

**Document type:** Solution Architecture (BMAD Phase 03)
**Version:** 1.0 (Draft for approval)
**Date:** 13 July 2026
**Derived from:** `docs/SPEC.md` v1.0, `docs/PRD.md` v1.0 (both approved)
**Author role:** Solution Architect
**Status:** ⏳ Design only — no code

> Delivery constraint (Constitution): React (JS)/Vite/Tailwind/MUI frontend; Node/Express backend; **Repository Pattern over JSON mock persistence, no database**; controllers never touch JSON directly. This document designs a *production-shaped* architecture that runs today on JSON adapters and migrates to a real datastore without touching business logic.

---

## 1. Architectural Goals & Principles

| Principle | Consequence in this architecture |
|---|---|
| **API-first / headless** (PG-7, FR-P8) | UI is just another API client; no privileged back-door; OpenAPI is the contract |
| **Machines flag, humans decide** (BR-G2) | Decision/release actions are explicit, audited service operations — never side effects |
| **Submit-once** (PG-2) | Central vault + attestation service; modules consume attestations, not copies |
| **Persistence-agnostic** | Repository Pattern isolates all data access behind interfaces; JSON today, DB tomorrow |
| **Scope-filtered by construction** (BR-G4) | Authorization context flows into every repository query as a mandatory filter |
| **Never lock out offline** (BR-G5) | Assisted/outreach/account-less are first-class API paths, not UI-only affordances |
| **Auditable by default** | Cross-cutting audit middleware records every state change/access/decision |

---

## 2. High-Level Architecture

### 2.1 Logical view (C4 Level 2 — containers)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          CITIZENS / OFFICERS / SYSTEMS                       │
│  Web PWA (React)   Officer consoles   AGUI chat   External consumers (API)   │
└───────────────┬───────────────────────────────┬────────────────────────────┘
                │ HTTPS / JSON                   │ OAuth2 CC / OIDC
        ┌───────▼────────────────────────────────▼───────┐
        │              API GATEWAY / EDGE                  │
        │  TLS term · CORS · rate limit · CSP · routing    │
        └───────┬──────────────────────────────────────────┘
                │
        ┌───────▼───────────────────────────────────────────────────────────┐
        │                  EXPRESS APPLICATION (modular monolith)             │
        │                                                                     │
        │  Middleware chain: requestId → auth(JWT) → rbac/scope → validate    │
        │                    (Zod) → controller → error handler → audit       │
        │                                                                     │
        │  ┌── PLATFORM SERVICES (shared) ───────────────────────────────┐    │
        │  │ Identity(FR-P1) Vault+Attestation(FR-P2) Payments(FR-P3)     │    │
        │  │ Notifications(FR-P4) Appointments(FR-P5) Decisions(FR-P6)    │    │
        │  │ Audit(FR-P7) Catalogue(FR-P9) AGUI(FR-P10) Dashboard(FR-P11) │    │
        │  └──────────────────────────────────────────────────────────────┘    │
        │  ┌── MODULE SERVICES ──────────────────────────────────────────┐    │
        │  │ A Passports · B Civil-Reg · C Revenue · D Grants ·           │    │
        │  │ E Benefits · F Appointments · G One-Home                     │    │
        │  └──────────────────────────────────────────────────────────────┘    │
        │                                                                     │
        │  Controllers → Services (business rules) → Repositories (interface) │
        └───────┬─────────────────────────────────────────────┬──────────────┘
                │ Repository interface                          │ Adapter (mock)
        ┌───────▼──────────┐                          ┌─────────▼──────────────┐
        │ JSON PERSISTENCE │                          │  INTEGRATION ADAPTERS   │
        │  data/*.json│                          │ GRA·ASYCUDA·Banks·MMG·  │
        │  (file-backed)   │                          │ SMS·Insurers·Production │
        └──────────────────┘                          │  (mock, fallback-aware) │
                                                       └─────────────────────────┘
        ┌───────────────────────────────────────────────────────────────────┐
        │  EVENT BUS (in-process pub/sub → webhook dispatcher)                │
        │  death.registered · batch.released · certificate.issued · …         │
        └───────────────────────────────────────────────────────────────────┘
```

### 2.2 Style: **Modular monolith, service-per-module, extraction-ready**
- One deployable Express app, internally partitioned into **platform** and **module** service packages with **no cross-module imports except through published service interfaces + the event bus**.
- Each module owns its repositories and data files. This preserves the option to extract any module into its own microservice later (the seams are the service interfaces and events) without a rewrite — appropriate given the 1M+ user target while keeping the reference build simple to run.

### 2.3 Layered request flow (mandatory, enforced by lint/review)
```
Route → Controller → Service → Repository(interface) → Persistence Adapter
                        │
                        └─ Platform Services (Identity, Vault, Payments, Audit, Events)
```
- **Controllers**: HTTP only (parse, delegate, shape response). No business logic, **no data access**.
- **Services**: business rules, orchestration, transactions, event emission.
- **Repositories**: the *only* code that touches persistence; return domain objects.
- **Rule:** `controllers/**` may not import `repositories/**` or `fs`. Enforced by an ESLint boundary rule + code review.

---

## 3. Folder Structure (repo root)

```
oneCitizen/
├── docs/                     # SPEC, PRD, Architecture, API, AI_ASSISTANT, SECURITY, EPICS, STORIES, …
├── shared/                   # cross-cutting contracts shared by FE & BE
│   ├── constants/            # role keys, event names, reason-code vocab, module codes
│   ├── schemas/              # Zod schemas (single source of truth for validation) 
│   └── types/                # JSDoc typedefs / OpenAPI-derived shapes
├── data/                # seed + runtime JSON store (see §8)
│   ├── seed/                 # immutable seed fixtures
│   └── store/                # runtime-mutated JSON (gitignored)
├── backend/                  # Express app  (see backend/ARCHITECTURE.md)
│   └── src/{app,config,middleware,platform,modules,repositories,lib,events,docs}
├── frontend/                 # React PWA   (see frontend/ARCHITECTURE.md)
│   └── src/{app,routes,layouts,features,components,theme,lib,stores,assistant}
└── package.json              # workspaces: frontend, backend, shared
```
Backend and frontend internal structures are detailed in their own ARCHITECTURE.md files (Phases 04/05).

---

## 4. Scalability — path to 1M+ users

The reference build runs single-process on JSON; the architecture is shaped so scaling is configuration + adapter swaps, not redesign.

| Concern | Reference build | Scale target (1M+) |
|---|---|---|
| **Compute** | 1 Node process | Stateless horizontal scaling behind LB; N replicas (12-factor, no local session) |
| **Sessions** | Stateless JWT (no server session) | Unchanged — already horizontally scalable |
| **Persistence** | JSON files via repositories | Swap adapter → PostgreSQL (OLTP) + read replicas; repository interface unchanged (§7) |
| **Caching** | In-memory reference-data cache | Redis for reference data, sessions-less rate-limit counters, hot lookups |
| **Events** | In-process pub/sub | Message broker (Kafka/RabbitMQ) + outbox pattern; consumers scale independently |
| **Burst (D: 50k enrol/day, 100k disburse/day)** | Queue abstraction, synchronous fallback | Durable queue + worker pool; **queue-based degradation (slower, never lost)** per D-NFR |
| **File/vault** | Local filesystem adapter | Object storage (S3-compatible, sovereign) with presigned URLs + AV scan pipeline |
| **Search/match (B fuzzy index)** | In-memory fuzzy match | Dedicated search index (OpenSearch) with tuned analyzers |
| **Reporting** | On-demand aggregation | CQRS read models / materialized views; async ETL to a reporting store |
| **Static/PWA** | Vite dev/preview | CDN edge + immutable hashed assets |

**Scaling principles baked in now:** stateless app, idempotency keys on all money-moving endpoints, optimistic concurrency (version field) on records, pagination + cursors on all list endpoints, and a hard separation of write path from read/reporting path.

---

## 5. Security Architecture (summary — full detail in docs/SECURITY.md)

- **Edge:** TLS 1.2+, HSTS, strict CORS allowlist, CSP, per-consumer + per-IP rate limiting.
- **Identity (FR-P1):** OneIdentity issues tokens; Level 1 (phone+OTP) vs Level 2 (step-up). App validates JWT; no module login.
- **AuthZ:** RBAC role keys (PRD §4.1) + **mandatory scope filter** injected into every repository call; segregation of duty (approve ≠ release).
- **Data protection:** scope-filtered responses; public verification endpoints expose name only; PII field-level handling per Data Protection Act 2023.
- **Integrity:** document hashing, append-only audit, artefact signing (PKI/HSM in prod; mock signer in build), QR verification tokens.
- **Secrets:** env-injected, never in repo; `.env.example` documents keys.

---

## 6. Cross-Cutting Concerns

### 6.1 Authentication (see also docs/SECURITY.md §JWT)
- **Model:** stateless **JWT** bearer tokens issued by OneIdentity (mocked as an in-app auth service for the build). Claims: `sub`, `roles[]`, `assuranceLevel` (1|2), `delegations[]`, `consumerId?`, `scopes[]`, `exp`.
- **Flows:** citizen (OIDC-style login → access + refresh); officer (login + MFA claim); system consumer (OAuth2 client-credentials → scoped token); account-less (phone+OTP → Level-1 token, booking/tracking scopes only).
- **Step-up:** a route requiring `assuranceLevel ≥ 2` returns `403 STEP_UP_REQUIRED`; UI triggers in-session step-up.
- **Delegation:** `agent`/`caregiver` tokens carry `delegations[]`; services assert the acting-for subject and log both identities.

### 6.2 Error handling
- **Single error contract** (all endpoints):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "human readable",
             "details": [{ "field": "tin", "issue": "duplicate" }],
             "requestId": "req_01H…", "timestamp": "2026-07-13T…Z" } }
```
- **Taxonomy → HTTP:** `VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `STEP_UP_REQUIRED`/`FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT`/`DUPLICATE` 409 · `BUSINESS_RULE_VIOLATION` 422 · `RATE_LIMITED` 429 · `INTEGRATION_UNAVAILABLE` 502/503 (triggers documented fallback) · `INTERNAL` 500.
- **Business-rule errors carry a coded reason** from the controlled vocabulary (FR-P6) so refusals/rejections are reportable.
- **Central Express error middleware**: catches thrown `AppError` subclasses, maps to the contract, logs with `requestId`, never leaks stack traces to clients.
- **Async safety:** all controllers wrapped so rejected promises reach the error middleware.

### 6.3 Logging
- **Structured JSON logs** (pino-style) with `requestId`, `actor`, `role`, `route`, `latencyMs`, `status`.
- **Three streams:** (1) application logs (ops/debug), (2) **audit log** — append-only, business events (state change, access, decision, release) with before/after hash, ≥7-yr retention (FR-P7, G-FR10.4), (3) integration logs — every external call with consumer identity.
- **Correlation:** `requestId` generated at edge, propagated through services, events and webhook deliveries.
- **No PII in application logs** (redaction middleware); audit log stores references, not raw sensitive payloads.

### 6.4 Repository Pattern (core of the persistence strategy)
- Every aggregate has a repository **interface** (contract) + a **JsonRepository** implementation. Services depend on the interface via a container (dependency injection), never on the implementation.
```
interface Repository<T>:
  findById(id, ctx)            // ctx carries auth scope → mandatory filter
  find(query, ctx)             // pagination, cursors
  create(entity, ctx)          // returns persisted w/ id + version
  update(id, patch, version, ctx)   // optimistic concurrency
  delete(id, ctx)              // soft-delete where audit requires
  withTransaction(fn)          // unit-of-work (file-lock in build; TX in DB)
```
- **Scope enforcement:** `ctx` (auth context) is a required argument; the JSON adapter applies the same scope predicate a SQL `WHERE` would — so authorization cannot be forgotten at the controller layer.
- **Concurrency:** JSON adapter uses a per-file async mutex + `version` field for optimistic locking; the DB adapter maps this to row-level locks/`SELECT … FOR UPDATE`.
- **Unit of work:** money-moving flows (payments/batches) run through `withTransaction` so JSON writes are atomic (write-to-temp + rename) and translate to real DB transactions later.

### 6.5 Event bus & webhooks
- In-process typed pub/sub; events (SPEC per-module lists) are emitted **by services after commit** (outbox semantics: persist event record, then dispatch).
- **Webhook dispatcher** delivers to subscribed consumers (oneCitizen, agency systems) with retry + signature; deliveries logged. `death.registered → suspend (never terminate)` is a subscribed handler in D/E, not an inline call — preserving the human-decision rule.

---

## 7. Future Database Migration

**Guarantee:** business logic (services/controllers) never changes; only the repository implementation and container binding change.

| Step | Action |
|---|---|
| 1 | Introduce `PostgresRepository` implementing the same `Repository<T>` interface |
| 2 | Model schema from `shared/schemas` (Zod → SQL DDL); add `version`, timestamps, soft-delete columns |
| 3 | Swap container binding (`json` → `postgres`) behind a `PERSISTENCE_DRIVER` env flag; both coexist for cutover |
| 4 | Data migration: seed loader reads `data/` → writes rows; idempotent, checksummed |
| 5 | Map `withTransaction` to real DB transactions; map optimistic `version` to row versioning |
| 6 | Move event outbox from JSON to a DB `outbox` table + broker publisher |
| 7 | Add read replicas + CQRS read models for reporting; retire in-memory aggregation |

Because scope filtering, pagination, concurrency and transactions are already expressed at the interface, the JSON→DB swap is a bounded, testable change (contract tests run against both adapters).

---

## 8. Persistence Layout (JSON mock)

```
data/
├── seed/                      # version-controlled fixtures (immutable)
│   ├── reference/             # regions, LAs, fee schedules, reason-codes, doc-types, catalogue
│   ├── identities.json        # citizens, officers, consumers (hashed secrets)
│   └── <module>.seed.json
└── store/                     # runtime state (gitignored), seeded from seed/ on first run
    ├── platform/{vault,attestations,payments,disbursements,appointments,notifications,audit,events}.json
    └── modules/{passports,civilreg,revenue,grants,benefits,appointments,onehome}.json
```
- One file per aggregate collection; repository owns its file(s).
- Write strategy: read → mutate in memory → write temp → atomic rename (crash-safe); per-file mutex serializes writers.
- `audit.json` and `events.json` are **append-only** (never rewritten in place).

---

## 9. Deployment

### 9.1 Reference build (developer / demo)
- **Run:** `npm run dev` → Vite dev server (frontend) + `nodemon` Express (backend) with proxy; or `npm run build && npm start` → Express serves the built PWA + API on one origin.
- **Config:** 12-factor `.env` (`PORT`, `JWT_SECRET`, `PERSISTENCE_DRIVER=json`, `MOCK_INTEGRATIONS=true`, gateway toggles). `.env.example` committed.
- **Containerization:** single Dockerfile (multi-stage: build FE → serve via BE); `docker-compose` adds Redis/Postgres profiles for the scale path (off by default).

### 9.2 Production shape (documented target — SPEC §5.1)
- Sovereign hosting (NDMA DC / approved sovereign cloud), data residency in Guyana.
- Horizontally-scaled stateless app tier behind LB; managed Postgres + read replicas; Redis; object storage; message broker; secrets manager; WAF at edge.
- CI/CD: build → test (unit/integration/API/a11y) → SAST/dependency scan → deploy; blue-green with health checks; DR RPO ≤ 1h / RTO ≤ 8h.
- Observability: centralized structured logs, metrics, tracing (requestId correlation), SLA/breach dashboards (G/D/F).

### 9.3 Environments
`local` → `sandbox` (synthetic data, dual API versions for consumers) → `staging` → `production`. API deprecation window ≥ 12 months across sandbox+prod (FR-P8).

---

## 10. Architecture Decision Records (key)

| ADR | Decision | Rationale |
|---|---|---|
| ADR-1 | Modular monolith, extraction-ready | Meets 1M+ target seams without microservice ops cost in the reference build |
| ADR-2 | Repository Pattern + DI container | Constitution mandate; enables JSON→DB with zero business-logic change |
| ADR-3 | Stateless JWT (no server sessions) | Horizontal scale; matches OneIdentity token model |
| ADR-4 | Scope filter passed as mandatory repository `ctx` | Makes BR-G4 unforgettable; authz cannot be bypassed at controller |
| ADR-5 | Events emitted post-commit via outbox | Guarantees `death.registered`-style flags never fire before state persists |
| ADR-6 | Zod schemas in `shared/` as single validation source | FE and BE validate identically; drives OpenAPI |
| ADR-7 | Integration via adapter interfaces with documented fallbacks | Real systems (GRA/ASYCUDA/banks) mockable; fallback behaviour is testable |

---

*End of Architecture. Frontend/backend/API/AI/security detailed in their companion Phase 04–08 documents.*
