# Epics — oneCitizen Platform

**Document type:** Epic Backlog (BMAD Phase 09)
**Version:** 1.0 · **Date:** 13 July 2026 · **Author role:** Scrum Master
**Derived from:** SPEC, PRD (§11 roadmap), Architecture, API, AI_ASSISTANT, SECURITY
**Companion:** `docs/STORIES.md` (story-level detail)

---

## 1. Epic Map (aligned to PRD roadmap P0–P4)

| Epic | Title | Roadmap phase | Depends on |
|---|---|---|---|
| **E0** | Platform Foundation (identity, RBAC, persistence, error/logging/audit, API+events scaffolding) | P0 | — |
| **E1** | Shared Platform Services (vault/attestations, payments/disbursements, notifications, appointments, catalogue, dashboard) | P0 | E0 |
| **E2** | Frontend Shell & Design System (AppShell, theme, dark mode, a11y, routing/guards, auth screens) | P0 | E0 |
| **E-AGUI** | AGUI Assistant (panel + orchestrator + confirm-gated tools) | P0→cross | E1, E2 |
| **E-B** | Module B — Civil Registration (data foundation) | P1 | E1 |
| **E-A** | Module A — Passports | P1 | E1, E-B |
| **E-F** | Module F — Cross-Government Appointments | P1 | E1 |
| **E-C** | Module C — GRA Revenue (TIN, licences; tax/duty deferred) | P2 | E1, E-B |
| **E-E** | Module E — Social Benefits | P2 | E1, E-B |
| **E-D** | Module D — Cash Grants & Payouts | P3 | E1, E-B, E-C |
| **E-G** | Module G — One Home (housing single window) | P4 | E1, all platform |
| **E-QA** | Cross-cutting Quality (tests, a11y audit, performance, production readiness) | continuous | all |

---

## 2. Epic Detail

### E0 — Platform Foundation
**Goal:** the skeleton every module stands on — DI container, Repository Pattern over JSON, middleware chain, JWT/OneIdentity (mock), RBAC + scope filter, error contract, structured logging, append-only audit, event bus + webhook dispatcher, OpenAPI/Swagger.
**Value:** guarantees the invariants (scope-filtering, human-decision, auditability) are structural, not per-feature.
**Key SPEC anchors:** FR-P1, FR-P7, FR-P8, BR-G1, BR-G2, BR-G4. **Stories:** S0.x.

### E1 — Shared Platform Services
**Goal:** the reusable FR-P services consumed by all modules: Vault+Attestations (FR-P2), Payments (FR-P3.1) + Disbursement release chain (FR-P3.2), Notifications+consent (FR-P4), Appointments engine (FR-P5), Reason-code/decision service (FR-P6), Catalogue (FR-P9), Dashboard reminders+suggestions (FR-P11).
**Value:** submit-once, one-payment, one-appointments-engine, human-release control — built once.
**Stories:** S1.x.

### E2 — Frontend Shell & Design System
**Goal:** AppShell (3-column with persistent AGUI slot), MUI+Tailwind theme with **dark mode**, WCAG 2.1 AA primitives, React Router + guards (auth/role/assurance step-up), auth/OTP/step-up screens, canonical nav Login→Dashboard→Ministries→Agencies→Services→Tracking.
**Value:** consistent, accessible, responsive enterprise UI shell for every feature.
**Stories:** S2.x.

### E-AGUI — AI Assistant
**Goal:** persistent panel + `/assistant/message` orchestrator with intent detection, navigate, fill, OCR-ready upload, validate, **confirm-gated** submit, track, summaries, recommendations; deterministic fallback menu.
**Value:** accelerates every journey without becoming a privileged actor (FR-P10 guardrails).
**Stories:** S-AGUI.x.

### E-B — Civil Registration (built first among modules)
**Goal:** type-aware request (new/correction/reissue), fuzzy index match + manual fallback, parallel source-confirmation lane, registrar human decisions, dual-format issuance with QR, **attestation publishing** consumed by A/C/D/E, `death.registered` events.
**Value:** the data foundation of the platform.
**Stories:** S-B.x.

### E-A — Passports
**Goal:** unified application (type auto-detect, vault reuse), parallel civil+vetting lanes, biometric appointment, adjudication with supervisor countersign, personalisation/handover with prior-book cancellation, minors consent.
**Stories:** S-A.x.

### E-F — Appointments (citizen-facing productisation of FR-P5)
**Goal:** service directory (prerequisites visible pre-booking), slot/capacity with **mandatory walk-in reserve**, booking lifecycle (account-less L1), reminders+checklist, QR check-in + live queue + priority lanes, officer day-list, per-ministry analytics, one cross-ministry view.
**Stories:** S-F.x.

### E-C — GRA Revenue
**Goal (Phase-1 subset):** TIN registration (blocking dedup) + taxpayer ledger, motor-vehicle licence renewal (insurance/fitness gate), driver's licence (tests + LRO approval + biometric), obligations feed to dashboard. *(Income-tax filing + import/duty deferred to P3.)*
**Stories:** S-C.x.

### E-E — Social Benefits
**Goal:** one application (65+ no-doc pension), parallel human assessment lanes (means + medical board + single-parent), award decisions, recurring lifecycle with **digital life-certificate**, death-flag suspend-pending-review, caregiver delegation.
**Stories:** S-E.x.

### E-D — Cash Grants & Payouts
**Goal:** programme definition console (config, versioned), enrolment modes (self/pre-enrol/outreach offline sync), screening + cross-channel/cross-programme dedup, payee validation, **human control chain** (verify→approve→release), appeals, public aggregate dashboard, burst-capacity design.
**Stories:** S-D.x.

### E-G — One Home
**Goal:** unified intake → MAN + routing engine (one child case per agency), consolidated fees/one payment/settlement split, parallel SLA-clocked lanes, consolidated RFC, joint inspections (offline app), certificate assembly + QR verification + Connection Orders, coordinator console + dashboards, full API-first surface.
**Stories:** S-G.x.

### E-QA — Cross-cutting Quality
**Goal:** unit/integration/API/UI/a11y tests, regression checklist, performance budget, production-readiness review.
**Stories:** S-QA.x (Phases 14–16).

---

## 3. Prioritisation & Sequencing Rationale

1. **E0 → E1 → E2** first: nothing works without the foundation, shared services, and shell.
2. **E-B before A/C/D/E**: they consume its attestations and `death.registered` flags.
3. **E-AGUI** can start once E1/E2 exist (it only calls existing APIs).
4. **E-G last**: it composes the most platform capabilities and is itself a oneCitizen consumer.
5. **E-QA** runs continuously; hardening gates each roadmap phase.

---

## 4. Definition of Ready (epic → stories)
An epic's stories are ready when: SPEC/PRD anchor identified · API endpoints defined in `docs/API.md` · data shapes in `shared/schemas` planned · dependencies resolved or stubbed · acceptance criteria testable.

---

*End of Epics. See `docs/STORIES.md` for stories.*
