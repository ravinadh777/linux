# Stories — oneCitizen Platform

**Document type:** Story Backlog (BMAD Phase 09)
**Version:** 1.0 · **Date:** 13 July 2026 · **Author role:** Scrum Master
**Companion:** `docs/EPICS.md`
**Convention:** every story has **AC** (acceptance criteria), **DoD** (definition of done), **Deps** (dependencies), **Test** (test notes). Story IDs are stable; implement **one approved story at a time** (Phases 11–12).

---

## Global Definition of Done (applies to every story, in addition to per-story DoD)

- Code follows the layered architecture (controllers never touch persistence; access only via repositories); ESLint boundary rule passes.
- Request/response validated with Zod (shared schemas where cross-cutting); errors use the standard error contract.
- Scope filtering enforced via repository `ctx`; RBAC/assurance guards applied where required.
- Audit event emitted for state changes; structured logs with `requestId`; no PII in app logs.
- Unit + integration/API tests written and green; a11y checks pass on any new UI (WCAG 2.1 AA); works in light + dark; responsive at sm/md/lg.
- OpenAPI/Swagger updated; `docs/API.md` reflects any change; relevant docs updated.
- Endpoint reachable via API **and** UI with identical result (API-first parity).
- Reviewed against the SPEC anchor(s) cited; no regression in the regression checklist.

Story-point scale: S(≤1d) · M(2–3d) · L(4–5d) · XL(split before starting).

---

# EPIC E0 — Platform Foundation

### S0.1 — Repository Pattern + JSON persistence + DI container  `[M]`
**As** a developer **I want** aggregate repositories over JSON via a DI container **so that** business logic is persistence-agnostic and DB-swappable.
**AC:** (1) `Repository<T>` interface with findById/find/create/update(optimistic version)/delete/withTransaction; (2) `JsonRepository` with per-file mutex + atomic temp-write+rename; (3) container binds `PERSISTENCE_DRIVER=json`; (4) `find` supports cursor pagination + mandatory `ctx` scope filter; (5) seed loads from `data/seed` on first boot.
**DoD:** global DoD + contract tests pass against JSON adapter; append-only behaviour verified for audit/events files.
**Deps:** none. **Test:** concurrent writes don't corrupt file; version conflict → CONFLICT; scope filter excludes out-of-ctx records.

### S0.2 — Middleware chain (requestId, error handler, logging)  `[S]`
**As** an operator **I want** a consistent middleware pipeline **so that** every request is correlated, validated, and errors are uniform.
**AC:** requestId generated + echoed; central error middleware maps `AppError`→contract, hides stack in prod; pino structured logs (requestId, actor, route, status, latency); async errors caught.
**DoD:** global DoD. **Deps:** S0.1. **Test:** thrown ValidationError→400 body matches contract; unhandled rejection→500 without leak.

### S0.3 — JWT/OneIdentity auth service (mock) + step-up + delegation  `[L]`
**AC:** login/OTP/refresh/logout/client-credentials endpoints (API §4); JWT claims roles/assuranceLevel/delegations/scopes; L1 account-less token; step-up to L2; delegation grant/revoke; officer MFA claim required for officer scopes.
**DoD:** global DoD + SECURITY §3 controls. **Deps:** S0.1–2. **Test:** L1 token blocked on 🔒L2 route→STEP_UP_REQUIRED; expired token→401; delegated token logs both identities; bad OTP throttled.

### S0.4 — RBAC + scope middleware  `[M]`
**AC:** requireRole/requireScope/requireAssurance; scope `ctx` built from token and passed to repositories; citizen sees only own records; consumer limited to scopes; segregation-of-duty helper (approver≠releaser).
**DoD:** global DoD. **Deps:** S0.3. **Test:** cross-citizen ID returns 404 (not 403 leak); agency officer can't read another lane; approver releasing own batch→FORBIDDEN.

### S0.5 — Event bus + outbox + webhook dispatcher  `[M]`
**AC:** typed pub/sub; events emitted post-commit via outbox; webhook subscriptions CRUD; signed payloads + retry/backoff; deliveries logged with consumer identity.
**DoD:** global DoD. **Deps:** S0.1–2. **Test:** event not dispatched if transaction rolls back; failed delivery retried; `death.registered` handler suspends (never terminates).

### S0.6 — Append-only audit service + reference-data + health + Swagger  `[M]`
**AC:** audit service records actor/action/entity/before-after hash, read-restricted + self-audited; reference-data endpoints (regions/LAs/fee-schedules/doc-types/reason-codes) cached; `/health`; OpenAPI served at `/api/docs`.
**DoD:** global DoD + retention note (≥7yr). **Deps:** S0.1–2. **Test:** audit entries immutable; reason-code vocab drives decision validation; swagger renders all routes.

---

# EPIC E1 — Shared Platform Services

### S1.1 — Vault: upload/version/hash/AV + retrieval  `[L]`
**AC:** POST /documents (multipart) with magic-byte + size + type validation; SHA-256 hash; AV scan status; versions list; reupload→new version; scope-filtered retrieval; original-verified flag.
**DoD:** global DoD + SECURITY §10. **Deps:** E0. **Test:** spoofed extension rejected; infected quarantined; reupload increments version, never duplicates.

### S1.2 — Attestations: publish + consent + consume  `[M]`
**AC:** verified records published as attestations; consent grant/deny per consuming module; consumers read attestation not document; produced by B, consumed by A/C/D/E.
**DoD:** global DoD (FR-P2.2). **Deps:** S1.1, E-B partial. **Test:** module without consent can't read; attestation reflects latest verified value.

### S1.3 — Payments: quote → pay → receipt → settlement split  `[L]`
**AC:** quote with per-agency lines; POST /payments (idempotency-key) channels card/mmg/bank/counter; QR/PDF receipt; settlement split reconciles to total; gateway-unavailable→OTC fallback; counter-paid marking by officer.finance.
**DoD:** global DoD + SECURITY (idempotency). **Deps:** E0. **Test:** double-submit same idempotency-key→one payment; split sums to total; already-paid→CONFLICT.

### S1.4 — Disbursement release chain (FR-P3.2)  `[L]`
**AC:** batch prepared→approve(authorising)→release(finance, distinct identity); per-payee callbacks; reconciliation to batch total; retry queue; no instruction leaves without release event.
**DoD:** global DoD + human-control invariant. **Deps:** S0.4, S0.5. **Test:** unreleased batch→no instruction; same identity approve+release→FORBIDDEN; failed payment enters retry queue and reconciles.

### S1.5 — Notifications + per-channel consent  `[M]`
**AC:** event-driven SMS/email/in-portal adapters (mock); consent per channel honoured platform-wide; account-less SMS delivery; reminders carry checklists.
**DoD:** global DoD (FR-P4). **Deps:** S0.5. **Test:** opt-out suppresses that channel everywhere; in-portal inbox lists events.

### S1.6 — Appointments engine (slots/booking/check-in/analytics)  `[L]`
**AC:** service directory; slot templates + walk-in reserve floor; book/reschedule(frees slot immediately)/cancel; account-less booking; QR check-in + queue position; complete→analytics; embedded booking for A/B/C/E on same inventory.
**DoD:** global DoD (FR-P5, F-BR1/BR5). **Deps:** E0. **Test:** full calendar still admits walk-in via reserve; reschedule returns slot instantly; embedded booking gets no priority.

### S1.7 — Catalogue + Dashboard (reminders + suggestions)  `[M]`
**AC:** catalogue grouped by ministry with tiles (prereqs, assurance, deepLink); dashboard reminders (pay-now deep links, consent-gated); eligibility suggestions (explainable, dismissible, never auto-enrol); cases list.
**DoD:** global DoD (FR-P9, FR-P11). **Deps:** E0, module obligation/eligibility feeds. **Test:** dismissed suggestion doesn't reappear; reminder deep-links to prefilled payment.

---

# EPIC E2 — Frontend Shell & Design System

### S2.1 — Theme, design tokens, dark mode  `[M]`
**AC:** MUI theme from shared tokens; Tailwind aligned via CSS vars; light+dark palettes contrast-audited; toggle persisted + honours prefers-color-scheme; reduced-motion respected.
**DoD:** global DoD. **Deps:** E0. **Test:** contrast ≥4.5:1 both themes; toggle persists across reload.

### S2.2 — AppShell (3-column) + responsive nav + AGUI slot  `[M]`
**AC:** top bar (identity, notifications, lang, theme), left nav, main, persistent right AGUI slot; responsive reflow (rail→drawer, assistant→sheet on mobile); skip-to-content.
**DoD:** global DoD + a11y landmarks. **Deps:** S2.1. **Test:** keyboard nav reaches all regions; assistant collapses on mobile without blocking content.

### S2.3 — Routing + guards + auth/OTP/step-up screens  `[L]`
**AC:** route table, lazy per-feature; RequireAuth/RequireRole/RequireAssurance/RequireDelegation; login, OTP (account-less), in-session step-up modal; canonical flow Login→Dashboard→Agencies→Services→Tracking (agency-first; ministries browse level retired to cut clicks — old `/ministries*` routes redirect to `/agencies`).
**DoD:** global DoD. **Deps:** S0.3, S2.2. **Test:** 401 interceptor→login preserving return URL; L2 route triggers step-up then resumes; account-less can reach booking only.

### S2.4 — Shared UI + form primitives (RHF+Zod) + DataTable + Timeline  `[L]`
**AC:** Button/Field/Select/FileUpload/StatusChip/Stepper/DataTable(cursor)/Timeline/SlaClock/KpiTile/EmptyState/ConfirmDialog; RHF-bound fields with Zod resolver; live SLA clock component.
**DoD:** global DoD. **Deps:** S2.1. **Test:** form shows field errors from Zod; DataTable paginates via cursor; SlaClock shows breach state.

### S2.5 — Citizen Dashboard page  `[M]`
**AC:** reminders panel, suggestions, active cases timeline, upcoming appointments, vault/consent summary; consumes S1.7 APIs.
**DoD:** global DoD. **Deps:** S1.7, S2.4. **Test:** empty states render; pay-now navigates to payment; dismiss suggestion updates list.

---

# EPIC E-AGUI — AI Assistant

### S-AGUI.1 — Assistant panel + conversation state  `[M]`
**AC:** panel mounted in AppShell on every authenticated page; context binding (module/page/caseId/formSnapshot); conversation history in assistantStore; collapsible; a11y complementary landmark.
**DoD:** global DoD. **Deps:** S2.2. **Test:** context updates on route change; keyboard operable.

### S-AGUI.2 — Orchestrator `/assistant/message` + tool registry  `[L]`
**AC:** intent detection→plan; read tools (catalogue/cases/quotes/docs) execute under citizen token; **write tools return proposals only**; deterministic fallback menu when model unavailable; every tool call audited with acting identity.
**DoD:** global DoD + AI_ASSISTANT guardrails. **Deps:** S1.x, S-AGUI.1. **Test:** write proposal never mutates without confirm; out-of-scope tool→FORBIDDEN; model down→fallback menu.

### S-AGUI.3 — Fill/validate/OCR-ready/submit-confirm/track/summaries/recommend  `[L]`
**AC:** prefill form action; validate via shared Zod; OCR extraction on upload → editable suggestions (flagged unverified); submit proposal → citizen confirm → API call; track summarises cases; recommendations explainable/dismissible.
**DoD:** global DoD. **Deps:** S-AGUI.2. **Test:** OCR values don't overwrite verified attestations; confirmation ledger records proposal→confirm→mutation.

---

# EPIC E-B — Civil Registration (built first among modules)

### S-B.1 — Type-aware request intake (new/correction/reissue)  `[L]`
**AC:** type selector drives dynamic evidence checklist; correction-of-substance blocked without statutory declaration (names exact missing instrument); third-party entitlement check up front; one payment incl. search fee.
**DoD:** global DoD (B-FR1, B-AC2). **Deps:** E1. **Test:** missing declaration→422 naming instrument; third-party without entitlement→FORBIDDEN.

### S-B.2 — Fuzzy index match + duplicate detection + manual queue  `[M]`
**AC:** fuzzy search (name/date/place/entry); duplicates flagged; unmatched→manual search queue with itemised fee; no-trace is a coded formal outcome (B-BR4).
**DoD:** global DoD. **Deps:** S-B.1. **Test:** near-match returns candidates; no-trace produces coded outcome, not silent fail.

### S-B.3 — Parallel source-confirmation lane  `[M]`
**AC:** where source institution exists, confirmation lane runs parallel to index search, each own sub-SLA; source user confirms/flags via portal or assisted channel.
**DoD:** global DoD (B-FR3, B-AC4). **Deps:** S-B.1. **Test:** both lanes visible with independent clocks.

### S-B.4 — Registrar decision + corrections annotate (never overwrite) + escalation  `[M]`
**AC:** registrar approves/refuses with coded reason+appeal; corrections annotate preserving original entry (officer/instrument/date); corrections of substance auto-escalate to Registrar General.
**DoD:** global DoD (B-BR1, B-FR4). **Deps:** S-B.1. **Test:** approved correction shows original intact + annotation; substance correction escalates.

### S-B.5 — Dual-format issuance (signed PDF+QR) + attestation publish + death event  `[L]`
**AC:** on approval same-day signed PDF extract with QR + printed queued; public /verify shows particulars only; attestation published (S1.2); `death.registered` emitted.
**DoD:** global DoD (B-FR5/6/8). **Deps:** S-B.4, S1.2, S0.5. **Test:** QR verify name-only; death event delivered ≤60s and suspends payee (E) not terminate.

---

# EPIC E-A — Passports

### S-A.1 — Unified application + type auto-detect + vault reuse  `[M]`
**AC:** new/renewal/replacement auto-detected from prior record; renewal with unexpired biometrics + GRO-verified birth skips civil docs; replacement requires police report ref.
**DoD:** global DoD (A-FR1, A-BR2). **Deps:** E1, E-B (attestations). **Test:** clean renewal requests zero civil docs; replacement without police ref→422.

### S-A.2 — Parallel civil + vetting lanes (flags never clearances)  `[M]`
**AC:** civil-record match via B API + vetting referral flags, parallel, each sub-SLA, one timeline; system never self-clears; cleared flag logs officer identity + resumes clock.
**DoD:** global DoD (A-FR2/3, A-BR4). **Deps:** S-A.1. **Test:** uncleared flag blocks adjudication not submission; clearance logged.

### S-A.3 — Biometric appointment + adjudication + countersign + handover  `[L]`
**AC:** biometric slot via S1.6 (incl. missions); adjudicate approve/refer/refuse + coded reason; supervisor countersign for refusals/lost-stolen; handover re-verifies identity, prior book cancelled before replacement personalises; QC-pass notify ≤1h.
**DoD:** global DoD (A-FR4/5/6). **Deps:** S-A.2, S1.6. **Test:** personalisation before prior-book cancel→blocked; failed handover re-verify→supervisor task; refusal without countersign→FORBIDDEN.

### S-A.4 — Minors consent + fees + events + oneCitizen tile  `[S]`
**AC:** both-parent/guardian consent or exception pathway; one fee before checks; events passport.*; catalogue tile under MoHA.
**DoD:** global DoD. **Deps:** S-A.1, S1.3, S1.7. **Test:** minor without consent/exception→blocked; tile appears with L2 requirement.

---

# EPIC E-F — Appointments (citizen-facing)

### S-F.1 — Service directory (prerequisites before booking)  `[M]`
**AC:** searchable by service/ministry/office; prerequisites + docs-to-bring + duration visible before booking (public browse).
**DoD:** global DoD (F-FR1). **Deps:** S1.6. **Test:** checklist visible pre-confirmation; account-less can browse.

### S-F.2 — Booking lifecycle + walk-in reserve + account-less  `[M]`
**AC:** book/reschedule/cancel; freed slot returns immediately; account-less phone+OTP booking with reminders + QR; walk-in admitted via reserve on full calendar.
**DoD:** global DoD (F-FR2/3, F-BR1). **Deps:** S1.6, S2.3. **Test:** full calendar walk-in admitted; account-less full lifecycle works.

### S-F.3 — Check-in + queue + officer day-list + analytics + one view  `[M]`
**AC:** QR/reference check-in kiosk; live queue position; priority lanes; officer day-list + completion; per-ministry analytics (heatmap/no-show/service time); citizen one cross-ministry view (own only).
**DoD:** global DoD (F-FR5/6/7, F-BR2). **Deps:** S-F.2. **Test:** completion feeds analytics; cross-ministry view shows only own bookings.

---

# EPIC E-C — GRA Revenue (Phase-1 subset)

### S-C.1 — TIN registration (blocking dedup) + taxpayer ledger  `[M]`
**AC:** TIN issued after identity+GRO attestation; duplicate→blocking 409; ledger view aggregates filings/licences/payments/compliance; compliance-certificate request.
**DoD:** global DoD (C-FR1/7, C-BR1). **Deps:** E1, E-B. **Test:** second TIN for same person→409; ledger reflects entries.

### S-C.2 — Motor-vehicle licence renewal (insurance/fitness gate)  `[M]`
**AC:** vehicle lookup; insurance+fitness checks (API or upload); fee; digital licence+QR + printed disc; lapsed check blocks naming the failure.
**DoD:** global DoD (C-FR4, C-BR2, C-AC4). **Deps:** S-C.1, S1.3. **Test:** lapsed insurance→422 naming check; success issues QR licence.

### S-C.3 — Driver's licence (tests + LRO approval + biometric)  `[L]`
**AC:** eligibility/prior-record check; written/practical test booking (S1.6); examiner records on site (offline); LRO officer approves (never automated); in-person biometric; digital+card issuance.
**DoD:** global DoD (C-FR5, C-BR3). **Deps:** S-C.1, S1.6. **Test:** approval requires LRO officer action; offline exam result syncs.

### S-C.4 — Obligations feed → dashboard reminders  `[S]`
**AC:** consent-gated obligations API (renewals due, dues) → FR-P11.1 with pay-now deep links; disputes route to GRA.
**DoD:** global DoD (C-FR11). **Deps:** S1.7. **Test:** obligation appears on dashboard; pay-now deep-links.

---

# EPIC E-E — Social Benefits

### S-E.1 — One application (65+ no-doc pension)  `[M]`
**AC:** programme selector; age/identity auto-verified via GRO; clean 65+ match requests no age documents; declarations only where required.
**DoD:** global DoD (E-FR1, E-AC1). **Deps:** E1, E-B. **Test:** clean 65+ → zero age docs, reaches approver within SLA.

### S-E.2 — Parallel human assessment lanes (means + medical board + single-parent)  `[L]`
**AC:** case-officer means/home-visit (offline app via S1.6) + medical board booking (disability) + single-parent evidence; lanes parallel with sub-SLAs; medical determination never automated.
**DoD:** global DoD (E-FR2, E-BR3). **Deps:** S-E.1, S1.6. **Test:** disability opens means + board lanes in parallel; offline home visit syncs.

### S-E.3 — Award decision + recurring lifecycle + digital life-certificate  `[L]`
**AC:** recommendation→approving officer decision + coded reason + appeal; recurring payee record + channel; payment calendar; digital life-certificate (biometric/OTP) replaces book; grace period before suspension; batches released by finance ops.
**DoD:** global DoD (E-FR3/4). **Deps:** S-E.2, S1.4. **Test:** life-certificate at counter continues payment; missed cert enters grace not suspension.

### S-E.4 — Death-flag suspend-pending-review + caregiver delegation + change-of-circumstance  `[M]`
**AC:** `death.registered`→suspend pending case-officer confirmation (no auto-termination); suspension blocked without coded reason+appeal; caregiver delegated access logged/revocable; change-of-circumstance adjusts only after officer review.
**DoD:** global DoD (E-FR5, E-BR2/6). **Deps:** S-E.3, S0.5. **Test:** death flag suspends+creates task, no termination; suspension missing reason→blocked.

---

# EPIC E-D — Cash Grants & Payouts

### S-D.1 — Programme definition console (config, versioned)  `[M]`
**AC:** define eligibility/evidence/amount/schedule/channels/dates/appeal window; versioned+audited; new measure launches by config; publishes public eligibility rules to FR-P11.3.
**DoD:** global DoD (D-FR1/8, D-BR3). **Deps:** E1. **Test:** rule change versioned; adjudicated cases not retro-affected without re-adjudication run.

### S-D.2 — Enrolment modes + cross-channel/programme dedup + screening  `[L]`
**AC:** self / pre-enrol confirm+channel / offline outreach sync; identity+age+deceased screening; **dedup across all channels & programmes** in shared registry; duplicate blocked at sync + both records linked.
**DoD:** global DoD (D-FR2/3, D-BR1). **Deps:** S-D.1, E-B. **Test:** web+outreach same National ID→blocked at sync, linked; deceased→excluded pending.

### S-D.3 — Human control chain (verify→approve→release) + payee validation  `[L]`
**AC:** flags→verification officer clears; batch→authorising approve→finance release (distinct identity); bank/MMG validation, post-office/cash for unbanked; callbacks + reconciliation + retry queue; money never on automation alone.
**DoD:** global DoD (D-FR4/5). **Deps:** S-D.2, S1.4. **Test:** unreleased batch→no instruction; reconciliation balances; retry queue handles failures.

### S-D.4 — Appeals + public aggregate dashboard  `[M]`
**AC:** appeal in window reopens to a *different* officer with evidence; public dashboard aggregate counts/totals by region, no PII.
**DoD:** global DoD (D-FR6). **Deps:** S-D.3. **Test:** appeal routes to different officer; dashboard exposes no personal data.

---

# EPIC E-G — One Home

### S-G.1 — Unified intake + MAN + routing engine  `[L]`
**AC:** dynamic intake (premise/tenure/building/utilities) with conditional sections; ≥1 valid tenure required; one MAN `OHG-<Region>-<YYYY>-<seq>`; routing opens exactly required child cases; EPA lane auto-opens on waterway buffer; one active MAN per lot (else 409).
**DoD:** global DoD (G-FR2/4, G-BR1/6). **Deps:** E1. **Test:** waterway pin→EPA lane; duplicate lot→409; lanes match routing rules.

### S-G.2 — Consolidated fees + one payment + settlement split  `[M]`
**AC:** itemised quote spanning LA/GWI/GPL/etc.; one payment (S1.3); per-agency settlement; supplemental fees on same MAN; both fee-sequencing modes supported (G-BR8).
**DoD:** global DoD (G-FR5). **Deps:** S-G.1, S1.3. **Test:** one MMG payment→one receipt+correct split; re-inspection fee on same MAN.

### S-G.3 — Parallel SLA lanes + consolidated RFC + decisions  `[L]`
**AC:** per-lane stages + SLA clocks (30-working-day default), pause only on applicant-action; coordinator pools queries into one RFC; applicant responds once clears all; breach auto-escalates + dashboard ≤15min; per-lane decisions with coded reasons; gating (GEI cert before electricity; sewer only where sewered).
**DoD:** global DoD (G-FR6, G-BR3/4). **Deps:** S-G.1. **Test:** two queries→one RFC cleared by one resubmission; breach reflects on dashboard ≤15min; electricity without GEI cert→blocked.

### S-G.4 — Joint inspections (offline app)  `[M]`
**AC:** shared calendar proposes joint window; inspector app geotag photos + checklist + e-sign, offline-capable sync; failed items auto-generate deficiencies; re-inspection with fee.
**DoD:** global DoD (G-FR7). **Deps:** S-G.1, S1.6. **Test:** joint window posts both results from one visit; offline inspection syncs without loss.

### S-G.5 — Certificate assembly + QR verify + Connection Orders  `[L]`
**AC:** all mandatory lanes approve→signed Construction Permission Certificate ≤1 working day (hashed plan refs, conditions, validity); QR public verify (name only); auto-dispatch Connection Orders to GWI/GPL/gas; revocation workflow.
**DoD:** global DoD (G-FR8). **Deps:** S-G.3, S0.5. **Test:** certificate ≤1 day; QR name-only; connection orders dispatched + utilities post dates back.

### S-G.6 — Coordinator console + dashboards + API-first parity  `[M]`
**AC:** coordinator cross-lane view + SLA heatmap + RFC composer + escalations; MoHW/NDMA dashboards (volumes, cycle time, first-time approval, collections, breaches; CSV/API); full published API + webhooks; oneCitizen delegated access returns only that citizen's records + certificate.issued webhook ≤60s.
**DoD:** global DoD (G-FR10/11). **Deps:** S-G.5. **Test:** API submission == UI submission with consumer identity audited; delegated GET scoped; v1 consumer unaffected by v2.

---

# EPIC E-QA — Cross-cutting Quality (Phases 14–16)

### S-QA.1 — Test suites (unit/integration/API/UI/a11y)  `[L]`
**AC:** unit (services/repos contract), integration/API (supertest on seeded app), UI (component + key flows), a11y (axe) on citizen pages; regression checklist authored; bug report produced.
**DoD:** global DoD + coverage targets agreed. **Deps:** features under test. **Test:** CI runs all suites green; a11y violations = 0 critical.

### S-QA.2 — Performance budget (PERFORMANCE.md)  `[M]`
**AC:** bundle size, lazy loading, caching, compression, image optimisation, code splitting reviewed; budget ≤3s on 3G-class documented + measured.
**DoD:** global DoD. **Deps:** frontend built. **Test:** Lighthouse/bundle-analyzer meets budget.

### S-QA.3 — Production readiness review (PRODUCTION_READINESS.md)  `[M]`
**AC:** architecture/security/perf/a11y/maintainability/docs/deployment checklist verified; gaps + limitations listed.
**DoD:** global DoD. **Deps:** all. **Test:** checklist complete with evidence links.

---

## Story Sequencing (recommended build order)
`S0.1→S0.6 → S2.1→S2.4 → S1.1,S1.3,S1.5,S1.6,S1.7 → S2.5 → S-AGUI.1–3 → S-B.1–5 → S1.2 → S-A.1–4 → S-F.1–3 → S-C.1–4 → S-E.1–4 → S-D.1–4 → S-G.1–6 → S-QA.1–3`

---

*End of Stories. Implement one approved story at a time (Phases 11–12), updating docs per the global DoD.*
