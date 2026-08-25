# Backend Architecture — oneCitizen API

**Document type:** Backend Architecture (BMAD Phase 05)
**Version:** 1.0 · **Date:** 13 July 2026 · **Author role:** Backend Architect
**Derived from:** `docs/Architecture.md`, `docs/API.md`, `docs/SPEC.md`
**Stack (Constitution):** Node.js, Express.js, JWT, Swagger/OpenAPI, **Repository Pattern**, **JSON persistence under `data/` (seed + runtime store)**, no database. **Controllers never access JSON directly.**

---

## 1. Layered Design (strict)

```
HTTP → Router → Middleware chain → Controller → Service → Repository → Persistence Adapter
                                        │
                                        └── Platform Services (Identity, Vault, Payments,
                                            Notifications, Appointments, Audit, Events)
```

| Layer | Responsibility | May NOT do |
|---|---|---|
| **Controller** | Parse/shape HTTP, call one service method, format response | No business rules; **no repository/`fs` access** |
| **Service** | Business rules, orchestration, transactions, event emission, cross-service calls | No HTTP objects (`req`/`res`); no direct file IO |
| **Repository** | The only code touching persistence; scope-filtered queries; concurrency | No business rules; no HTTP |
| **Adapter** | JSON file IO now / DB later | No business rules |

Boundaries enforced by an ESLint import-boundary rule (`controllers/**` cannot import `repositories/**`, `lib/persistence/**`, or `fs`).

---

## 2. Folder Structure

```
backend/src/
├── app.js                     # express app assembly (middleware order, routers, error handler)
├── server.js                  # bootstrap, port, graceful shutdown
├── config/                    # env loading, constants, DI container wiring
│   ├── env.js                 # validated env (Zod) — PORT, JWT_SECRET, PERSISTENCE_DRIVER…
│   └── container.js           # binds interfaces → implementations (json | postgres)
├── middleware/
│   ├── requestId.js           # correlation id
│   ├── auth.js                # JWT verify → req.auth {sub, roles, assuranceLevel, delegations, scopes}
│   ├── rbac.js                # requireRole / requireScope / requireAssurance
│   ├── scope.js               # builds authz ctx passed to repositories
│   ├── validate.js            # Zod schema validation (body/query/params)
│   ├── rateLimit.js           # per-IP + per-consumer limits
│   ├── audit.js               # post-response audit event capture
│   └── error.js               # central error handler → error contract
├── platform/                  # shared platform services (FR-P*)
│   ├── identity/              # FR-P1: token issue/verify (mock OneIdentity), OTP, step-up, delegation
│   ├── vault/                 # FR-P2: documents + attestations
│   ├── payments/              # FR-P3.1 collection, FR-P3.2 disbursement (release control)
│   ├── notifications/         # FR-P4: SMS/email/in-portal adapters + consent
│   ├── appointments/          # FR-P5: slots, booking, check-in
│   ├── decisions/             # FR-P6: coded-reason vocabulary, decision recording
│   ├── audit/                 # FR-P7: append-only audit service
│   ├── catalogue/             # FR-P9: service tiles
│   ├── assistant/             # FR-P10: AGUI orchestration endpoints (see AI_ASSISTANT.md)
│   └── dashboard/             # FR-P11: reminders/obligations + eligibility suggestions
├── modules/                   # one folder per module A–G
│   └── <module>/
│       ├── <module>.routes.js
│       ├── <module>.controller.js
│       ├── <module>.service.js
│       └── <module>.schemas.js   # Zod (import shared where cross-cutting)
├── repositories/
│   ├── base/Repository.js        # interface + shared query helpers (pagination, scope)
│   ├── json/JsonRepository.js     # JSON adapter (mutex, atomic write, optimistic version)
│   └── <aggregate>.repo.js        # one per aggregate, bound in container
├── events/                    # event bus (pub/sub) + outbox + webhook dispatcher
├── lib/                       # logger (pino), errors (AppError classes), hashing, qr, id-gen
├── docs/                      # swagger setup + generated openapi.json
└── data/  → repo-root data/store   # JSON persistence (see Architecture §8)
```

---

## 3. Controllers

- Thin. Pattern: validate (via middleware) → read `req.auth` scope ctx → call service → send response using a `respond(res, status, data)` helper that wraps success payloads consistently.
- Wrapped by `asyncHandler` so promise rejections reach the error middleware.
- No conditionals encoding business rules — those live in services.
- Example responsibilities: extract `man` param, call `oneHomeService.getApplication(man, ctx)`, return 200 or let a thrown `NotFoundError` map to 404.

---

## 4. Services

- Hold **all business rules** (SPEC BR-*): e.g. `revenueService.registerTin` runs the blocking duplicate check (C-BR1); `grantsService.releaseBatch` asserts the caller is `officer.finance` and a distinct identity from the approver (D-FR5, segregation of duty).
- Orchestrate platform services + repositories within a **unit of work** (`repo.withTransaction`) for money-moving/multi-write operations.
- **Emit events after commit** via the outbox (Architecture §6.5): `return.filed`, `batch.released`, `certificate.issued`, `death.registered`, etc.
- Cross-module interaction only through other services' public methods or events — never by reaching into another module's repository.
- Return domain objects/DTOs; never `res`.

---

## 5. Repositories & JSON Persistence

- **Interface** `Repository<T>` (Architecture §6.4): `findById`, `find`, `create`, `update` (optimistic `version`), `delete` (soft where audited), `withTransaction`.
- **JsonRepository** implementation:
  - One JSON file per collection under `data/store/**` (Architecture §8); seeded from `data/seed/**` on first boot.
  - **Concurrency:** per-file async mutex serializes writers; reads are lock-free snapshots.
  - **Atomic writes:** serialize → write `*.tmp` → `fs.rename` (crash-safe); `audit`/`events` files are append-only.
  - **Optimistic locking:** `update(id, patch, expectedVersion, ctx)` → `CONFLICT` if version moved.
  - **Scope filter:** every query applies the predicate derived from `ctx` (role/subject/consumer) — the JSON equivalent of a SQL `WHERE`, so BR-G4 cannot be bypassed.
  - **Pagination:** cursor-based (`?cursor=&limit=`) returning `{ items, nextCursor }`.
- **DI container** binds `PERSISTENCE_DRIVER` (`json` default) so a `PostgresRepository` can replace it with zero service changes (Architecture §7).

---

## 6. Middleware (order matters)

```
requestId → helmet/security headers → cors → rateLimit → bodyParser
→ auth(JWT) → scope(ctx builder) → [per-route] validate(Zod) + rbac(role/scope/assurance)
→ controller → audit(post) → error handler (last)
```
- `auth`: verifies JWT signature/exp, populates `req.auth`; public/verify + login/OTP routes are allow-listed.
- `rbac`: `requireRole([...])`, `requireScope('payments:write')`, `requireAssurance(2)` → `STEP_UP_REQUIRED`.
- `scope`: constructs the immutable authz `ctx` handed to services→repositories.
- `validate`: runs the route's Zod schema against `body`/`query`/`params`; failures → `VALIDATION_ERROR` 400 with field details.
- `audit`: records the business event (actor, action, entity, before/after hash) after a successful mutating response.
- `error`: maps `AppError` subclasses → error contract; logs with `requestId`; hides internals.

---

## 7. Validation

- **Zod everywhere**, schemas sourced from `shared/schemas` for cross-cutting shapes (identity, money, document) and module-local for the rest.
- **Two-layer:** middleware validates request shape/format; services enforce **business-rule validation** (duplicates, gating checks, entitlement) that Zod cannot express, raising `BusinessRuleError` with a coded reason (FR-P6).
- Reference-data validity (region codes, reason codes, doc types) checked against the seed reference collections.

---

## 8. JWT / Auth

- **Mock OneIdentity service** (`platform/identity`) issues signed JWTs (HS256 in build; RS256/JWKS in prod). Claims: `sub`, `roles[]`, `assuranceLevel`, `delegations[]`, `consumerId?`, `scopes[]`, `iat`, `exp`.
- **Flows:** citizen login (password/OTP → access+refresh), officer login (+ MFA claim required for officer roles), **OAuth2 client-credentials** for system consumers (scoped tokens, per-consumer rate limits), **phone+OTP** → Level-1 account-less token.
- **Step-up:** issue an elevated token after re-auth/biometric when a route demands `assuranceLevel ≥ 2`.
- **Refresh + revocation:** refresh tokens rotate; a denylist file supports logout/revoke (moves to Redis at scale).
- Full policy in `docs/SECURITY.md`.

---

## 9. Logging

- **pino** structured JSON; child logger per request bound to `requestId`, `actor`, `route`.
- Three streams (Architecture §6.3): application, **append-only audit**, integration.
- PII redaction on application logs; audit stores references + hashes, not raw sensitive bodies.
- Log levels via env; request/response summary (status, latency) at info, errors at error with mapped code.

---

## 10. Swagger / OpenAPI

- `docs/API.md` is the human contract; **OpenAPI 3 spec generated** from route definitions + Zod schemas (`zod-to-openapi`) and served at `/api/docs` (Swagger UI) with `openapi.json` downloadable.
- Sandbox tag + example **mock responses** (matching `docs/API.md`) documented per endpoint; developer-portal onboarding notes (FR-P8 governance).
- Versioned base path `/api/v1`; deprecation metadata on endpoints.

---

## 11. File Upload

- Multer (memory/stream) → **validation pipeline**: MIME + magic-byte sniffing (not just extension), size cap (default 25 MB, configurable), allowed types per context (PDF/JPG/PNG; +DWG/DXF for Module G).
- **AV scan hook** (mock scanner in build; ClamAV/service in prod) → status `pending|clean|infected`; infected quarantined, never served.
- Stored via **vault service** (FR-P2): typed, **versioned** (re-upload = new version, never parallel copy), **SHA-256 hash** recorded for integrity, `original_verified_flag` for sighting (FR-P2.3).
- **OCR-ready:** upload flow persists the raw file + emits a `document.uploaded` event the AGUI/OCR pipeline can consume (see AI_ASSISTANT.md) to pre-extract fields — extraction is a suggestion, never authoritative.
- Storage adapter interface → local filesystem now, object storage later.

---

## 12. Events & Webhooks

- In-process typed event bus; services emit post-commit via an **outbox** (persist event → dispatch). Event names per SPEC module lists.
- **Webhook dispatcher**: consumer subscriptions (seed/config), signed payloads, retry with backoff, delivery logged with consumer identity.
- Critical rule preserved: `death.registered` handlers in D/E **suspend/exclude pending officer review** — never auto-terminate (B-BR3, D-BR2, E-FR5).

---

## 13. Error Types (`lib/errors`)

`AppError(code, httpStatus, message, details?)` base → `ValidationError` (400), `UnauthenticatedError` (401), `StepUpRequiredError`/`ForbiddenError` (403), `NotFoundError` (404), `ConflictError`/`DuplicateError` (409), `BusinessRuleError(reasonCode)` (422), `RateLimitError` (429), `IntegrationUnavailableError` (502/503, triggers fallback), fallthrough `InternalError` (500). All map to the single error contract (Architecture §6.2).

---

## 14. Testing Hooks (for Phase 14)

- Repositories have **contract tests** runnable against both JSON and (future) Postgres adapters.
- Services tested with in-memory fake repositories.
- Controllers/routes tested via supertest against the assembled app with seeded JSON.
- Deterministic seeds + a `reset` script restore `store/` from `seed/` between test runs.

---

*End of Backend Architecture.*
