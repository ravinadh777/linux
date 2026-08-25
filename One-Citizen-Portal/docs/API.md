# API Reference — oneCitizen Platform

**Document type:** API Specification (BMAD Phase 06)
**Version:** 1.0 · **Date:** 13 July 2026 · **Author role:** API Architect
**Base URL:** `/api/v1` · **Format:** JSON · **Auth:** Bearer JWT (OneIdentity) unless marked *public*
**Contract source:** OpenAPI 3 generated from routes + Zod (served at `/api/docs`)

> This document defines every REST endpoint: method, URL, request, response, validation, errors, and a mock response. Repeated conventions are stated once in §1–§3 and referenced thereafter to keep per-endpoint entries precise.

---

## 1. Conventions

- **Versioning:** path-based `/api/v1`; SemVer; ≥12-month deprecation window; both versions in sandbox (FR-P8).
- **Auth header:** `Authorization: Bearer <jwt>`. Tokens carry `roles[]`, `assuranceLevel` (1|2), `delegations[]`, `scopes[]`, `consumerId?`.
- **Assurance:** endpoints marked 🔒L2 require `assuranceLevel ≥ 2` → else `403 STEP_UP_REQUIRED`.
- **Scope filtering:** every list/read is automatically filtered to the caller's scope (citizen→own; agency→own lane; consumer→granted scopes). Public verification endpoints return name only.
- **Correlation:** send/receive `X-Request-Id`; echoed in every error.
- **Idempotency:** money-moving `POST`s require `Idempotency-Key` header.
- **Pagination:** list endpoints accept `?limit=<=100&cursor=<opaque>`; return `{ items:[…], nextCursor }`.
- **Timestamps:** ISO-8601 UTC.

## 2. Standard Response Envelopes

**Success (single):** the resource object. **Success (list):** `{ items, nextCursor }`.
**Error (all endpoints):**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…",
  "details": [{ "field": "tin", "issue": "duplicate" }],
  "requestId": "req_…", "timestamp": "2026-07-13T10:00:00Z" } }
```

## 3. Standard Error Codes → HTTP

`VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `STEP_UP_REQUIRED` 403 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT`/`DUPLICATE` 409 · `BUSINESS_RULE_VIOLATION` 422 (carries `reasonCode`) · `RATE_LIMITED` 429 · `INTEGRATION_UNAVAILABLE` 502/503 · `INTERNAL` 500.
Every endpoint below may return `401` (missing/expired token), `429` (rate limit), `500`. Only endpoint-specific codes are re-listed per entry.

---

## 4. Platform — Identity & Auth (FR-P1)

### POST /auth/login  *(public)*
- **Request:** `{ "identifier": "national-id|email", "password": "…" }`
- **Response 200:** `{ "accessToken", "refreshToken", "assuranceLevel": 1, "roles":["citizen"], "expiresIn": 900 }`
- **Validation:** identifier + password required; identifier format.
- **Errors:** `VALIDATION_ERROR` 400; `UNAUTHENTICATED` 401 (bad creds); officer accounts w/o MFA → `STEP_UP_REQUIRED`.
- **Mock:** `{ "accessToken":"eyJ…","refreshToken":"rft_…","assuranceLevel":1,"roles":["citizen"],"expiresIn":900 }`

### POST /auth/otp/request  *(public)* / POST /auth/otp/verify  *(public)*
- **Request (request):** `{ "phone": "+5926…" }` → **200** `{ "otpId", "expiresIn":300 }`
- **Request (verify):** `{ "otpId", "code":"123456" }` → **200** `{ "accessToken", "assuranceLevel":1, "roles":["citizen"], "accountLess":true }`
- **Validation:** phone E.164; code 6 digits. **Errors:** `VALIDATION_ERROR`, `UNAUTHENTICATED` (wrong/expired code).
- **Mock:** `{ "accessToken":"eyJ…","assuranceLevel":1,"accountLess":true }`

### POST /auth/step-up  🔒 *(auth L1)*
- **Request:** `{ "method":"biometric|otp|id", "proof":"…" }` → **200** `{ "accessToken","assuranceLevel":2 }`
- **Errors:** `UNAUTHENTICATED` (proof fails).

### POST /auth/refresh · POST /auth/logout
- refresh: `{ "refreshToken" }` → new access token; logout: revokes refresh. **Errors:** `UNAUTHENTICATED`.

### POST /auth/token  *(OAuth2 client-credentials, system consumers)*
- **Request:** `{ "grant_type":"client_credentials","client_id","client_secret","scope":"applications:read …" }`
- **Response 200:** `{ "access_token","token_type":"Bearer","expires_in":3600,"scope":"…" }`
- **Errors:** `UNAUTHENTICATED` (bad client), `FORBIDDEN` (scope not granted).

### GET /me · POST /delegations · DELETE /delegations/{id}
- `GET /me` → profile + roles + active delegations. `POST /delegations` (grant agent/caregiver) body `{ "delegateId","relationship","scope":[…] }` → **201**. `DELETE` revokes (E-BR6). **Errors:** `FORBIDDEN`, `NOT_FOUND`.

---

## 5. Platform — Vault & Attestations (FR-P2)

### POST /documents  🔒L2 *(multipart)*
- **Request:** file + `{ "type":"birth_certificate|title|…","context":"module:ref" }`
- **Validation:** MIME magic-byte ∈ allowed; ≤25MB; type ∈ doc-type vocab. AV scan async.
- **Response 201:** `{ "id","type","version":1,"hash","scanStatus":"pending","originalVerifiedFlag":false }`
- **Errors:** `VALIDATION_ERROR` (bad type/size), `BUSINESS_RULE_VIOLATION` (infected on rescan).
- **Mock:** `{ "id":"doc_01H…","type":"birth_certificate","version":1,"hash":"a1b2…","scanStatus":"clean" }`

### GET /documents/{id} · GET /documents/{id}/versions · POST /documents/{id}/reupload
- Retrieve (scope-filtered), list versions, re-upload → **new version** (never parallel copy, FR-P2). **Errors:** `NOT_FOUND`, `FORBIDDEN`.

### GET /attestations?subject=me&type= · POST /attestations/{id}/consent
- List reusable attestations for the citizen; grant/deny consent for a consuming module (FR-P2.2). **Response:** `{ items:[{ "id","type","issuer":"GRO","verified":true,"consentedModules":["A"] }] }`.

---

## 6. Platform — Payments & Disbursements (FR-P3)

### GET /quotes/{quoteId}  ·  POST /quotes  *(internal, module-created)*
- Quote: `{ "id","lines":[{ "agency":"GWI","description","amount" }],"total","currency":"GYD","status":"unpaid" }`.

### POST /payments  🔒L2  *(Idempotency-Key required)*
- **Request:** `{ "quoteId","channel":"card|mmg|bank|counter", "instrument":{…} }`
- **Validation:** quote exists & unpaid; channel ∈ enum; per-line total reconciles.
- **Response 201:** `{ "paymentId","status":"settled|pending","receipt":{ "id","qr","pdfUrl" },"settlementSplit":[{ "agency","amount" }] }`
- **Errors:** `NOT_FOUND` (quote), `CONFLICT` (already paid), `BUSINESS_RULE_VIOLATION`, `INTEGRATION_UNAVAILABLE` (gateway → OTC fallback).
- **Mock:** `{ "paymentId":"pay_…","status":"settled","receipt":{"id":"rcpt_…","qr":"data:…"},"settlementSplit":[{"agency":"LA","amount":15000},{"agency":"GWI","amount":8000}] }`

### GET /payments/{id} · POST /payments/{id}/callback *(rails → platform)* · POST /payments/counter *(cashier marks OTC paid, role officer.finance)*

### Disbursements (FR-P3.2) — human release
- **POST /disbursement-batches** (system prepares) → `{ "batchId","payeeCount","total","status":"prepared" }`
- **POST /disbursement-batches/{id}/approve** *(officer.authorising)* → status `approved`.
- **POST /disbursement-batches/{id}/release** *(officer.finance, distinct identity)* → status `released`; emits `batch.released`. **Errors:** `FORBIDDEN` (same identity as approver → segregation of duty), `BUSINESS_RULE_VIOLATION` (not approved).
- **GET /disbursement-batches/{id}** → reconciliation `{ total, released, failed, retryQueue }`.
- **Rule:** no payment instruction leaves the platform without a `release` event (D-FR5/AC4).

---

## 7. Platform — Notifications (FR-P4), Appointments (FR-P5), Catalogue (FR-P9), Decisions (FR-P6), Dashboard (FR-P11), Audit (FR-P7)

### Notifications
- **GET /notifications** (in-portal inbox) · **PATCH /notifications/consent** `{ "sms":true,"email":false,"whatsapp":false }` (per-channel, honoured platform-wide, F-BR3) · **POST /notifications/test** *(sysadmin)*.

### Appointments (FR-P5 — powers A/B/C/E/F)
**Implemented (calendar slot booking):**
- **GET /appointments/offices** → `{ items:[{ code, name }] }` *(public)* — participating offices (authoritative for slot inventory).
- **GET /appointments/slots?office=&date=** 🔒 → `{ office, date, closed, slots:[{ id, time24, label (12-hr), period, available }], summary:{ total, available } }`. Availability reflects real bookings across **all** citizens (a slot taken by anyone is unavailable to everyone); weekends return `closed:true`.
- **POST /appointments** 🔒 `{ "office","date","slotId","fullName","phone","purpose","notes" }` → **201** `{ id, reference, officeName, date, timeLabel, status:"booked" }`. Booking is **atomic** — a per-(office,date) lock re-checks availability under the lock and returns **`CONFLICT` 409** if the slot was taken first, so no two people can hold the same slot. **Errors:** `CONFLICT`, `VALIDATION_ERROR`, `NOT_FOUND` (unknown office).
- **GET /appointments** 🔒 → caller's bookings. **GET /appointments/{id}** 🔒 → one booking.

**Planned (broader engine — not yet implemented):**
- **GET /appointments/services** → directory (prerequisites, docs-to-bring, duration, offices) *(public browse)*.
- **POST /appointments** `{ "serviceId","slotId","channelConsent" }` (account-less L1 allowed) → `{ "appointmentId","qr","checklist":[…] }`.
- **PATCH /appointments/{id}** (reschedule → frees slot immediately) · **DELETE /appointments/{id}** (cancel).
- **POST /appointments/{id}/check-in** *(kiosk/marshal)* → `{ "queuePosition" }`. **GET /appointments/{id}/queue** → live position.
- **POST /appointments/{id}/complete** *(officer)* → feeds analytics. **GET /appointments/analytics?ministry=** *(officer.servicedesk/oversight)*.
- Webhooks: `appointment.booked|rescheduled|checked_in|completed`.
- **Mock (create):** `{ "appointmentId":"apt_…","qr":"data:…","checklist":["National ID","TIN letter"] }`

### Catalogue (FR-P9)
- **GET /catalogue** → `{ ministries:[{ code, name, services:[{ id, name, description, prerequisites, requiredAssurance, deepLink }] }] }` *(public)*.
- **GET /catalogue/agencies** → `{ items:[{ code, name, ministryCode, ministryName, serviceCount }] }` — flat list of every agency; the citizen catalogue entry point (agency-first; the ministries browse level was removed from the UX flow).
- **GET /catalogue/agencies/{code}/services** → `{ ministry, agency, services:[…] }`.
- **GET /catalogue/services/{id}** → service **metadata** (name, description, agency, prerequisites, requiredAssurance, deepLink). The API does **not** return form fields — form definitions are owned by the client (`frontend/src/features/apply/forms/*.js`, one file per service) and rendered as a **vertical stepper** (per-step validation → review → submit). Adding or changing fields is a frontend-only change.

### Applications / Tracking (record store)
A clean, resource-oriented CRUD surface over the Repository Pattern. Persistence is JSON files today (`data/store/applications.json`) and swaps to a database later by binding a different repository driver — **no API-contract or frontend changes**.
- **POST /applications** 🔒L2 `{ "serviceId","form":{…},"documents":[{ field, documentId, type }] }` → **201** created record `{ id, reference, status, lanes, timeline, form, documents, createdAt }`. Validates the **record envelope** (`serviceId` resolvable; `form` is an object; each document references `{ field, documentId }`); field-level rules are enforced client-side by the form owner. **Errors:** `VALIDATION_ERROR` 400, `NOT_FOUND` (unknown `serviceId`), `STEP_UP_REQUIRED` (L1 token).
- **GET /applications** → caller's records (scope-filtered). **GET /applications/{id}** → full record with lanes + timeline + documents + stored `form`.

### Decisions / reason codes (FR-P6)
- **GET /reason-codes?context=refusal|rejection|suspension** → controlled vocabulary. Used to validate all decision endpoints.

### Dashboard (FR-P11)
- **GET /dashboard/reminders** → obligations/renewals w/ `payNowDeepLink` (FR-P11.1; consent-gated; C-FR11 feeds this).
- **GET /dashboard/suggestions** → eligibility suggestions `{ items:[{ programme, explanation, dismissible:true, deepLink }] }` (FR-P11.3; never auto-enrol).
- **POST /dashboard/suggestions/{id}/dismiss**.
- **GET /dashboard/cases** → active cases `{ items:[{ id, reference, appNumber, service, category, ministry, status, submittedAt, nextStep }] }` (unified across modules; `nextStep` derived from the first open lane).
- **GET /dashboard/deadlines** → upcoming payment obligations `{ urgent:{ title, message, amount, daysLeft, payDeepLink }, items:[{ id, title, icon, dueDate, daysLeft, amount, payDeepLink }] }` (FR-P11.1).
- **GET /dashboard/notifications** → in-portal feed `{ items:[{ id, title, message, timeAgo, unread }] }` (FR-P4).
- **GET /dashboard/pension** → old-age pension summary `{ monthlyAmount, nextPayment, yearsOfService, status }` (module E feed).

### Audit (FR-P7)
- **GET /audit?entity=&caseId=** *(sysadmin/oversight/auditor)* → append-only events `{ actor, action, entity, timestamp, beforeHash, afterHash }`.

---

## 8. Public Verification (all modules) *(public, rate-limited, name-only)*

### GET /verify/{qrToken}
- **Response 200:** `{ "artefactType":"certificate|extract|licence|passport","number","status":"valid|expired|revoked","holderName","issuedBy":[…] }` — **no other personal data** (FR-P8.7, B-FR5, G-FR8.3).
- **Errors:** `NOT_FOUND` (bad token), `RATE_LIMITED`.
- **Mock:** `{ "artefactType":"certificate","number":"CPC-04-2026-00123","status":"valid","holderName":"J. Persaud","issuedBy":["CH&PA","GWI","GPL"] }`

---

## 9. Module A — Passports

| Method | URL | Purpose |
|---|---|---|
| POST | `/passports/applications` 🔒L2 | Create/submit (type auto-detected) |
| GET | `/passports/applications/{id}` | Status + parallel lanes (civil, vetting) on one timeline |
| POST | `/passports/applications/{id}/documents` | Attach/reference vault docs |
| GET | `/passports/applications/{id}/fees` · POST `/payments` | Fee then pay (FR-P3.1) |
| POST | `/passports/applications/{id}/appointment` | Book biometric slot (FR-P5) |
| POST | `/passports/applications/{id}/vetting/{flagId}/clear` *(officer.verification)* | Clear flag (logged) |
| POST | `/passports/applications/{id}/adjudicate` *(officer.adjudicator)* | approve/refer/refuse + reasonCode |
| POST | `/passports/applications/{id}/countersign` *(officer.supervisor)* | Refusals/lost-stolen |
| POST | `/passports/applications/{id}/handover` *(officer.intake)* | Re-verify identity → release |

- **POST create — Request:** `{ "type":"new|renewal|replacement","priorPassportNo?","minor?":{consent…},"policeReportRef?" }`
- **Validation:** renewal requires prior record; replacement requires `policeReportRef` (A-BR2); minor requires consent or exception.
- **Response 201:** `{ "id","type","lanes":[{"name":"civil","sla"},{"name":"vetting","sla"}],"status":"submitted" }`
- **Errors:** `BUSINESS_RULE_VIOLATION` (no GRO match at issue → blocks A-BR1; uncleared flag blocks adjudication A-BR4), `VALIDATION_ERROR`.
- **Adjudicate — Errors:** `BUSINESS_RULE_VIOLATION` (uncleared vetting flag), `FORBIDDEN` (refusal without supervisor countersign).
- **Webhooks:** `passport.application.submitted|adjudicated|issued`.
- **Mock (get):** `{ "id":"A-2026-0001","type":"renewal","status":"in_review","lanes":[{"name":"civil","status":"verified","sla":"2026-07-20"},{"name":"vetting","status":"in_progress","sla":"2026-07-22"}] }`

---

## 10. Module B — Civil Registration

| Method | URL | Purpose |
|---|---|---|
| POST | `/civil/requests` | New / correction / reissue (type-aware) |
| GET | `/civil/requests/{id}` | Status incl. index + source-confirmation lanes |
| POST | `/civil/requests/{id}/source-confirm` *(source-institution)* | Confirm/flag particulars |
| POST | `/civil/requests/{id}/decide` *(registrar)* | Approve/refuse + reasonCode |
| POST | `/civil/requests/{id}/escalate` *(auto→Registrar General)* | Corrections of substance |
| GET | `/civil/records/{id}` | Record w/ annotations (originals preserved, B-BR1) |
| GET | `/attestations?type=birth&subject=` | Reusable attestation (FR-P2.2) |

- **POST — Request:** `{ "requestType":"new|correction|reissue","recordType":"birth|death|marriage","evidence":[docIds],"thirdParty?":{entitlement} }`
- **Validation:** dynamic evidence checklist per type; correction-of-substance **blocked without statutory declaration** (B-AC2); third-party entitlement check (B-BR2).
- **Response 201:** `{ "id","lanes":["index_search","source_confirm"],"status":"submitted" }`; unmatched → adds `manual_search` lane with itemised search fee.
- **Issuance:** on approve → `{ "extract":{ "pdfUrl","qr" },"printQueued":true }` (same-day digital, B-FR5).
- **Errors:** `BUSINESS_RULE_VIOLATION` (missing declaration; no-trace coded outcome B-BR4).
- **Webhooks:** `record.registered|corrected|issued|death.registered` (D/E consume).
- **Mock:** `{ "id":"B-2026-1123","status":"issued","extract":{"pdfUrl":"/files/…","qr":"data:…"},"printQueued":true }`

---

## 11. Module C — GRA Revenue

| Method | URL | Purpose |
|---|---|---|
| POST | `/revenue/tin` 🔒L2 | Register TIN (blocking dedup C-BR1) |
| GET | `/revenue/ledger` | One taxpayer ledger (C-FR7) |
| POST | `/revenue/returns` | File income tax return (pre-filled PAYE) |
| GET | `/revenue/returns/{id}/assessment` | Provisional/final assessment |
| POST | `/revenue/returns/{id}/assess` *(officer)* | Officer assessment + reasonCode |
| POST | `/revenue/refunds/{id}/release` *(officer.finance)* | Release refund (never auto, C-BR6) |
| POST | `/revenue/vehicle-licences/renew` | MV renewal (insurance+fitness gate C-BR2) |
| POST | `/revenue/driver-licences` | Provisional/new/renewal |
| POST | `/revenue/driver-licences/{id}/test` | Book test (FR-P5); examiner records result |
| POST | `/revenue/driver-licences/{id}/approve` *(officer.lro)* | Approve (never automated C-BR3) |
| POST | `/revenue/duty` | ASYCUDA declaration → duty+VAT quote |
| POST | `/revenue/duty/{id}/pay` | Pay → post back to ASYCUDA ≤5min (C-BR4) |
| GET | `/revenue/obligations` | Consent-gated feed → FR-P11.1 (C-FR11) |

- **TIN — Validation:** identity (FR-P1)+GRO attestation; duplicate → `409 DUPLICATE` (blocking).
- **MV renew — Errors:** `BUSINESS_RULE_VIOLATION` naming the failing check (lapsed insurance/fitness, C-AC4).
- **Duty pay — Response:** `{ "paymentId","asycudaPostback":"pending→confirmed","releaseStatus" }`; `INTEGRATION_UNAVAILABLE` → file-exchange fallback.
- **Webhooks:** `return.filed|assessment.finalised|licence.issued|duty.paid`.
- **Mock (MV renew fail):** `{ "error":{"code":"BUSINESS_RULE_VIOLATION","message":"Insurance lapsed","details":[{"field":"insurance","issue":"expired 2026-06-01"}]}}`

---

## 12. Module D — Cash Grants & Payouts

| Method | URL | Purpose |
|---|---|---|
| POST | `/grants/programmes` *(programme.admin)* | Define/version programme (config) |
| GET | `/grants/programmes` | Live programmes (public criteria for FR-P11.3) |
| POST | `/grants/programmes/{id}/enrol` | Self / pre-enrol confirm / outreach |
| POST | `/grants/programmes/{id}/enrol/offline-sync` *(outreach)* | Batch sync w/ dedup |
| GET | `/grants/cases/{id}` | Enrolment/screening status |
| POST | `/grants/cases/{id}/flags/{flagId}/clear` *(officer.verification)* | Clear flag |
| POST | `/grants/batches/{id}/approve` *(officer.authorising)* | Approve batch |
| POST | `/grants/batches/{id}/release` *(officer.finance)* | Release (see §6) |
| POST | `/grants/cases/{id}/appeal` | Appeal in window → different officer (D-FR6) |
| GET | `/grants/dashboard` *(public)* | Aggregate totals by region, no PII |

- **Enrol — Validation:** identity match, age via GRO, **deceased screening**, **dedup across all channels/programmes** (D-BR1). Duplicate → `409` + both records linked for officer review (D-AC1).
- **Errors:** `BUSINESS_RULE_VIOLATION` (deceased flag → excluded pending investigation D-BR2; one-payout-per-programme).
- **Webhooks:** `enrolment.received|case.flagged|batch.released|payment.settled`; consumes `death.registered`, GRA TIN/compliance.
- **Mock (dedup):** `{ "error":{"code":"DUPLICATE","message":"Existing enrolment for this National ID","details":[{"field":"nationalId","issue":"already enrolled via web"}]}}`

---

## 13. Module E — Social Benefits

| Method | URL | Purpose |
|---|---|---|
| POST | `/benefits/applications` | pension/public-assistance/disability/single-parent |
| GET | `/benefits/applications/{id}` | Parallel assessment lanes status |
| POST | `/benefits/applications/{id}/home-visit` | Schedule (FR-P5); offline app sync |
| POST | `/benefits/applications/{id}/medical-board` | Book board sitting (disability) |
| POST | `/benefits/applications/{id}/recommend` *(officer.inspector/case)* | Recommendation |
| POST | `/benefits/applications/{id}/decide` *(officer.adjudicator)* | Award/refuse + reasonCode + appeal |
| GET | `/benefits/awards/{id}/ledger` | Payment calendar + history |
| POST | `/benefits/awards/{id}/life-certificate` | Digital proof-of-life (biometric/OTP) |
| POST | `/benefits/awards/{id}/suspend` *(officer.adjudicator)* | Suspend (coded reason + appeal, E-BR2) |
| POST | `/benefits/awards/{id}/change-of-circumstance` | Self-report → officer review |

- **Apply — Validation:** clean 65+ GRO match ⇒ **no age docs** (E-FR1/AC1).
- **Suspend — Errors:** `BUSINESS_RULE_VIOLATION` if missing coded reason or appeal notice (E-AC6, blocks suspension). Death flag → suspend pending review, **never auto-terminate** (E-FR5).
- **Webhooks:** `benefit.awarded|suspended|renewal.completed`; consumes `death.registered`.
- **Mock (pension apply):** `{ "id":"E-2026-4410","programme":"old_age_pension","ageVerified":true,"documentsRequested":[],"status":"awaiting_approval" }`

---

## 14. Module F — Cross-Government Appointments

Productises the Platform Appointments API (§7). Additional citizen-facing:

| Method | URL | Purpose |
|---|---|---|
| GET | `/appointments/services?q=&ministry=&office=` *(public)* | Directory search before booking |
| GET | `/appointments/mine` | One cross-ministry view (citizen only, F-BR2) |
| POST | `/appointments/services` *(officer.servicedesk)* | Publish service |
| PUT | `/appointments/services/{id}/slots` *(officer.servicedesk)* | Slot templates + **walk-in reserve floor** (F-BR1) |
| GET | `/appointments/analytics?ministry=&office=` *(oversight)* | Heatmaps, no-show, service times |

- **Validation:** walk-in reserve ≥ mandatory floor (rejected below floor); account-less booking allowed (L1).
- **Errors:** `CONFLICT` (slot taken), `VALIDATION_ERROR` (below quota floor).
- **Mock (mine):** `{ "items":[{ "appointmentId":"apt_1","ministry":"CI&PO","service":"Biometrics","when":"2026-07-18T09:00Z","qr":"data:…" }] }`

---

## 15. Module G — One Home (Housing single window)

| Method | URL | Purpose |
|---|---|---|
| POST | `/onehome/applications` 🔒L2 | Unified intake → MAN + child cases |
| GET | `/onehome/applications/{man}` | Full status: per-lane state + SLA clocks |
| POST | `/onehome/applications/{man}/documents` | Vault (PDF/JPG/PNG/DWG/DXF) |
| GET | `/onehome/applications/{man}/fees` | Consolidated itemised quote |
| POST | `/payments` | One payment → settlement split |
| POST | `/onehome/applications/{man}/inspections/slots` | Book/confirm joint window |
| POST | `/onehome/applications/{man}/inspections/{id}/result` *(officer.inspector)* | Checklist/photos/e-sign (offline sync) |
| POST | `/onehome/applications/{man}/lanes/{agency}/decide` *(officer.adjudicator)* | Approve/conditions/reject + reasonCode |
| POST | `/onehome/applications/{man}/rfc` *(coordinator)* | Consolidated deficiency (one RFC) |
| POST | `/onehome/applications/{man}/rfc/{id}/respond` | Applicant responds once |
| GET | `/certificates/{certNo}` 🔒 | Authenticated full certificate |
| POST | `/connection-orders/{id}/status` *(GWI/GPL/gas)* | Post scheduled/actual dates |

- **Create — Request:** `{ "premise":{region,la,block,lot,gps},"tenure":[{type,ref,docId}],"building":{…},"utilities":["water","electricity","gas"] }`
- **Validation:** ≥1 valid tenure (G-BR1); one active MAN per lot (G-BR6, else `409`); routing rules open exactly the required lanes; EPA lane auto-opens on waterway buffer (G-AC6).
- **Response 201:** `{ "man":"OHG-04-2026-000123","lanes":[{"agency":"LA","sla"},{"agency":"GWI"},{"agency":"GPL"}],"status":"submitted" }`
- **Decide — Errors:** `BUSINESS_RULE_VIOLATION` (electricity order blocked without GEI wiring cert, G-BR3; sewer where no sewered_area_flag, G-BR4).
- **Certificate:** issued ≤1 working day after all lanes approve → `{ "certNo","qr","validTo","conditions":[…] }`; auto-dispatch Connection Orders (G-FR8).
- **Webhooks:** `application.submitted|rfc.issued|payment.settled|lane.decided|inspection.completed|certificate.issued|certificate.revoked`.
- **Mock (get):** `{ "man":"OHG-04-2026-000123","status":"in_review","lanes":[{"agency":"LA","stage":"plan_review","sla":"2026-08-10","breached":false},{"agency":"GWI","stage":"inspection","sla":"2026-08-05"},{"agency":"GPL","stage":"intake","sla":"2026-08-12"}] }`

---

## 16. System & Reference

| Method | URL | Purpose |
|---|---|---|
| GET | `/health` *(public)* | Liveness `{ "status":"ok","version" }` |
| GET | `/reference/regions` · `/reference/local-authorities` · `/reference/fee-schedules` · `/reference/document-types` | Reference data (cached) |
| GET | `/api/docs` *(public in sandbox)* | Swagger UI / OpenAPI 3 |
| POST | `/webhooks/subscriptions` *(consumer/sysadmin)* | Subscribe to events (FR-P8) |
| GET | `/webhooks/subscriptions` · DELETE `/webhooks/subscriptions/{id}` | Manage |
| POST | `/assistant/message` 🔒 | AskGov agent turn (see docs/AI_ASSISTANT.md) |
| GET | `/me` 🔒 | Current citizen, incl. `profile` object used to auto-fill forms |
| PATCH | `/me/profile` 🔒 | Citizen self-service edit of contact/address/next-of-kin. Only a safelist (title, phone, email, occupation, maritalStatus, lot, street, village, region, nextOfKin*) is writable — verified fields (name, DOB, National ID) are rejected. Persists to the identities store; audited. |

- **AskGov — Request:** `{ "message", "context":{ page, mode:"form", serviceId, serviceName, fields:[…], values:{…} } }` → `{ "reply", "actions":[…], "suggestions":[…] }`. Actions the UI applies: `prefill {values}`, `setField {name,value}`, `clear`, `navigate {to,label}`. The reasoning is a **swappable engine** (`assistantEngine.js`, deterministic + profile-backed today); dropping in a real model means replacing that engine only — the endpoint contract, actions, and UI are unchanged. The agent **never submits** — every action is a proposal the citizen confirms.
- **Profile auto-fill:** any form pre-populates matching fields from `GET /me`'s `profile` on open (client-side map in `frontend/src/lib/profileForm.js`); the same mapping powers the agent's `prefill`.
- **Webhook subscription — Request:** `{ "consumerId","events":["certificate.issued"],"url","secret" }` → **201**. Deliveries signed + retried + logged.

---

*End of API Reference. Endpoint set is the Phase-1 published catalogue; generated OpenAPI at `/api/docs` is authoritative for exact schemas.*
