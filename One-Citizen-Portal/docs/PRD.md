# PRD — oneCitizen Government Digital Services Platform (Guyana)

**Document type:** Product Requirements Document (BMAD Phase 02)
**Version:** 1.0 (Draft for approval)
**Date:** 13 July 2026
**Derived from:** `docs/SPEC.md` v1.0 (approved)
**Author role:** Product Manager
**Status:** ⏳ Awaiting approval before Phase 03 (Architecture)

> Traceability: every item here references SPEC identifiers (FR-P*, A-FR*, …, BR-*, AC). The SPEC remains the source of truth for scope; this PRD defines *what we build and why it wins*.

---

## 1. Vision

**oneCitizen is Guyana's single digital front door to government.** One identity, one document vault, one payment rail, one appointments engine, one notifications channel — and a catalogue of ministry services delivered as consistent, verifiable, human-accountable digital workflows. A citizen proves who they are once, submits a document once, and every ministry that needs it draws on the same verified record. Machines do the fetching, matching and preparing; officers make every decision that carries legal or financial weight.

**Product promise:** *"Handle it once, from anywhere, and know exactly where it stands."*

---

## 2. Goals & Non-Goals

### 2.1 Product goals
| # | Goal | SPEC anchor |
|---|---|---|
| PG-1 | Single sign-on across all services; no per-module login | FR-P1, BR-G1 |
| PG-2 | Submit-once — verified records become reusable attestations | FR-P2, BR-G3 |
| PG-3 | One payment/disbursement rail with human release control | FR-P3, BR-G2 |
| PG-4 | Full transparency — unified case timeline + SLA clocks | FR-P4, A-FR3, G-FR6 |
| PG-5 | Never lock out the offline citizen (assisted/outreach/walk-in/account-less) | BR-G5, F-BR1 |
| PG-6 | Machines flag, humans decide — every decision coded & auditable | BR-G2, FR-P6 |
| PG-7 | API-first/headless — every capability is a versioned, scope-filtered API | FR-P8, G-FR11 |
| PG-8 | Proactive citizen — reminders, obligations, explainable entitlement suggestions | FR-P11 |

### 2.2 Non-goals (this build)
- Not replacing existing agency core systems (GRA e-services, ASYCUDA, passport production) — we **integrate/extend** with mock adapters (SPEC A-7).
- Not a real payment processor — payment/disbursement rails are simulated via repository adapters.
- Not performing land titling, court records, adoptions, or NIS contributory benefits (SPEC out-of-scope items stand).

---

## 3. Modules (product scope)

All seven SPEC modules + platform layer are in scope for the reference implementation (SPEC approved as-is). Delivery is phased (§11).

| Module | Product one-liner | Primary success signal |
|---|---|---|
| **Platform (P)** | Identity, vault, payments, notifications, appointments, catalogue, AGUI, dashboard | SSO reuse; attestation reuse rate |
| **A — Passports** | Apply/renew/replace with parallel civil + vetting checks, one biometric visit | Cycle time; first-time-right rate |
| **B — Civil Registration** | Type-aware request; same-day signed extract; attestations for all of government | Same-day issuance %; attestation consumption |
| **C — GRA Revenue** | TIN-anchored ledger; guided filing; licences; duty via ASYCUDA | Pre-fill completion; 5-min ASYCUDA post-back |
| **D — Cash Grants** | Config-driven programme engine; national-scale enrol + disburse with human release | Dedup catch rate; batch reconciliation accuracy |
| **E — Social Benefits** | One application; human assessment lanes; digital life-certificate lifecycle | 65+ no-doc pension %; suspension due-process compliance |
| **F — Appointments** | Book across ministries; walk-in reserve; QR check-in; demand analytics | No-show rate; walk-in admission; booking coverage |
| **G — One Home** | Single-window construction permit + coordinated utility connections | End-to-end cycle vs 30-day SLA; joint-inspection rate |

---

## 4. Personas & Permissions (RBAC)

### 4.1 Roles (delivery-build JWT roles)
| Role key | Persona (SPEC §2) | Core capabilities |
|---|---|---|
| `citizen` | Citizen / diaspora | Discover, apply, pay, book, track, appeal, manage vault & consent |
| `agent` | Authorised agent / broker / caregiver (delegated) | Act on behalf of a linked citizen; scoped, logged, revocable |
| `officer.intake` | Counter/reviewing officer | Identity verify, sight originals, intake checks, biometric capture |
| `officer.adjudicator` | Adjudicator / registrar / approving officer | Approve/refer/refuse/award with coded reasons |
| `officer.supervisor` | Supervisor / Registrar General / Director | Countersign refusals, corrections of substance, suspensions |
| `officer.inspector` | Inspector / examiner / case officer / medical board | Field/home visits, tests, assessments (offline-capable) |
| `officer.verification` | Verification officer | Clear/reject dedup, deceased, anomaly flags |
| `officer.authorising` | Authorising officer (D) | Approve payment batches |
| `officer.finance` | Finance operations (C/D/E) | Release disbursement/refund batches; manage retry queue |
| `officer.servicedesk` | Ministry service-desk owner (F) | Manage directory, slot templates, quotas |
| `officer.marshal` | Front-desk / queue marshal (F) | Kiosk check-in, priority lanes |
| `coordinator` | Single-Window Coordinator (G) | Cross-lane view, RFC composer, escalations |
| `programme.admin` | MoF programme team (D) | Define/version programme rules |
| `oversight` | Ministry/programme oversight | Dashboards, KPIs, analytics (read) |
| `sysadmin` | NDMA operator | Provision roles, API-consumer onboarding, platform config |

### 4.2 Permission principles
- **MFA mandatory** for every officer role (SPEC §5.1).
- **Scope filtering** enforced server-side: an agency role sees only its lane; `citizen` sees only own records; public verification endpoints return name only (BR-G4).
- **Delegation** (`agent`) is signed, logged distinctly, and citizen-revocable (FR-P1.3, E-BR6).
- **Segregation of duty**: the officer who *approves* a batch (`officer.authorising`) is never the one who *releases* it (`officer.finance`); appeals reopen to a *different* officer (D-FR6).

---

## 5. User Journeys

### 5.1 Citizen — first-time service (canonical)
1. Land on **Dashboard** → sees reminders + suggested entitlements.
2. Open **Catalogue** or ask **AGUI** → pick a service.
3. **OneIdentity** authenticates; step-up to Level 2 if the service requires it.
4. Dynamic **intake** pre-fills from vault/attestations; upload only what's missing.
5. **Validate** → completeness + business-rule checks surface issues inline.
6. **Pay once** (itemised quote → MMG/card/counter) → QR receipt.
7. Watch **parallel lanes** advance on one timeline with live SLA clocks.
8. Respond once to a **consolidated deficiency (RFC)** if raised.
9. Receive **decision + verifiable artefact** (extract/licence/certificate/payout) via chosen notification channel.

### 5.2 Renewal (submit-once payoff) — Module A
Renewal auto-detected → unexpired biometrics + GRO-verified birth record → **no civil documents requested**, GRO verification completes via API with no applicant action (A-FR1, AC1).

### 5.3 Pre-enrolled grant — Module D
Citizen pre-identified from registry → prompted only to **confirm + pick payout channel** → MMG validated → case reaches screening with no further evidence (D-FR2, AC2). Money moves only after verification-officer clear → authorising-officer approval → **finance-officer release**.

### 5.4 Old-age pension — Module E
65-year-old with clean GRO match applies → **no age documents** → reaches approving officer within SLA (E-FR1, AC1). Recurring payments renew via **digital life-certificate** at any counter — no pension book.

### 5.5 Account-less appointment — Module F
Citizen with only a phone number books via **OTP (Level 1)** → booking, reminders and QR check-in all function without an account (F-FR3, AC4). On a full calendar, walk-in still admitted via reserve quota.

### 5.6 One Home single window — Module G
One unified application → routing engine opens **one child case per required agency** on one timeline → one consolidated payment → **joint inspection** → all lanes approve → **QR-verifiable Construction Permission Certificate** within 1 working day + auto-dispatched **Connection Orders** (G-FR2–G-FR8).

### 5.7 Officer journey (adjudication)
Work queue → open case with full context (ledger/attestations/lane history) → decide approve/refer/refuse with **mandatory coded reason** → supervisor countersign where required → citizen notified with appeal guidance.

### 5.8 AGUI assisted journey
Citizen describes need conversationally → assistant finds the service, pre-fills the form under delegated context → **citizen explicitly confirms before submission** (FR-P10).

---

## 6. Dashboards

### 6.1 Citizen dashboard (FR-P11)
- **Reminders & obligations panel (FR-P11.1):** dues, renewals, licence expiries with **pay-now deep links**.
- **Suggested entitlements (FR-P11.3):** explainable, dismissible prompts (e.g. pension at 65) — never auto-enrol.
- **Active cases:** unified timelines with per-lane SLA clocks.
- **Upcoming appointments** (cross-ministry, F).
- **Vault & consent** summary; **payments & receipts**.

### 6.2 Officer / back-office dashboards
- **Work queues / day-lists** (A/B/C/E/F) with assignment and check-in status.
- **Coordinator console (G):** cross-lane case view, **SLA heatmap**, consolidated RFC composer, escalation actions.
- **Programme console (D):** rule definition/versioning, enrolment funnel, flag queue, batch approval/release status.
- **Ministry service-desk (F):** directory, slot templates, quotas, blackout dates.

### 6.3 Oversight dashboards
- **MoHW/NDMA (G):** volumes by region, median cycle time per lane, first-time approval rate, fee collections, breach analytics.
- **MoF (D):** aggregate enrolments/disbursements/totals by region (no personal data) — public view + internal.
- **F analytics:** demand heatmaps, no-show rates, average service times per office/service.

---

## 7. KPIs & Success Metrics

| KPI | Target (product intent) | Source |
|---|---|---|
| SSO adoption — services used per authenticated session | ≥ 2 without re-login | PG-1 |
| Attestation reuse rate (docs not re-collected) | ≥ 60% of eligible renewals | PG-2 |
| End-to-end cycle time (G) | ≤ 30 working days | G-FR6 |
| First-time-right / first-time approval rate | ≥ 75% | G-FR6, AC |
| SLA breach detection latency (visible on dashboard) | ≤ 15 min | G-AC8 |
| Certificate/extract issuance after final approval | ≤ 1 working day (G); same-day (B) | G-AC5, B-AC1 |
| ASYCUDA duty post-back | ≤ 5 min | C-AC5 |
| QC-pass → applicant notified (A) | ≤ 1 hour | A-AC4 |
| Death-flag webhook delivery (D/E) | ≤ 60 s, suspend not terminate | P-AC3 |
| Duplicate catch rate at sync (D) | 100% blocking on same National ID | D-AC1 |
| Batch reconciliation accuracy (D) | 100% to batch total | D-AC3 |
| Walk-in admission on full calendar (F) | 100% within reserve quota | F-AC2 |
| No-show rate (F) | ≤ 15% (with reminders) | F-FR7 |
| Assisted/offline channel parity | 100% of online flows available assisted | BR-G5 |
| Accessibility | WCAG 2.1 AA on all citizen flows | §5.1 |

---

## 8. Notifications

- **Channels:** SMS (primary — GTT/Digicel), email, in-portal; WhatsApp = stretch (FR-P4). *Delivery build simulates gateways via adapters.*
- **Consent:** per-channel, honoured platform-wide; opt-out respected everywhere (F-BR3).
- **Trigger events (representative):** submission, payment settled, RFC issued, appointment booked/reminder (48h/2h), inspection scheduled, decision recorded, artefact ready, batch released, suspension notice, renewal due.
- **Account-less delivery:** SMS + OTP tracking for Level-1 citizens (F-FR3, G-FR9.2).
- **Reminders carry prerequisites:** appointment reminders include the documents-to-bring checklist (F-FR4).

---

## 9. Reports

| Report | Audience | Contents | SPEC |
|---|---|---|---|
| Case cycle-time & SLA breach | Oversight, Coordinator | Median per lane, breach counts by agency/region | G-FR10 |
| Fee collection & settlement reconciliation | Finance, oversight | Per-line splits, daily reconciliation | FR-P3.1 |
| Disbursement reconciliation | MoF finance | Batch totals vs per-payee callbacks, retry queue | D-FR5 |
| Programme aggregate dashboard (public) | Public | Counts/totals by region, no personal data | D-FR6 |
| Appointment demand analytics | Ministry service-desk | Heatmaps, no-show, service times | F-FR7 |
| Audit trail export | Sysadmin, auditors | Every state change/access/decision, ≥7-yr retention | FR-P7, G-FR10 |
| API consumer activity | NDMA | Calls per consumer, scope, rate-limit status | FR-P8 |
| Exports | All above | CSV / API | G-FR10 |

---

## 10. Dependencies

- **Platform layer (§6.1 SPEC):** reconstructed FR-P1–FR-P11 — validated at SPEC approval; foundation for all modules.
- **Module B is the data foundation:** A/C/D/E depend on GRO attestations & `death.registered` flags → **B built early**.
- **Shared payee registry** (D/E) must exist before first grant programme.
- **Appointments engine (FR-P5)** underpins A/B/C/E/F → part of platform foundation.
- **External integrations (mocked):** GRA e-services, ASYCUDA World, banks/MMG, SMS gateways, insurers, passport production — repository adapters with documented fallbacks (SPEC §9 per module, A-7).
- **Legal confirmations pending (SPEC O-6):** e-signature validity, silence-is-consent — do not block the build; flagged in artefacts.

---

## 11. Roadmap (delivery phasing)

> Aligns SPEC phasing notes with the BMAD build pipeline. Sequencing favours the platform foundation and Module B first (everything depends on them).

| Phase | Scope | Rationale |
|---|---|---|
| **P0 — Platform foundation** | OneIdentity (L1/L2, delegation), vault + attestations, payments/disbursements engine, notifications, appointments engine, catalogue, dashboard shell, API/eventing scaffolding, RBAC/audit | Every module depends on it |
| **P1 — Data foundation & core services** | Module B (GRO) → then A (Passports), F (Appointments) | B produces attestations A/C/D/E consume; F productises the appointments engine |
| **P2 — Revenue & benefits** | Module C (TIN, licences — deferring income-tax filing & import/duty per SPEC O-8), Module E (benefits) | High citizen volume; reuse attestations |
| **P3 — Payouts & extended revenue** | Module D (grants engine), Module C income-tax filing + import/duty | National-scale disbursement; ASYCUDA depth |
| **P4 — Single-window vertical** | Module G (One Home) | Composes many platform capabilities; consumer of oneCitizen |

*Delivery-build note:* all phases use JSON mock persistence via the Repository Pattern; real-world NFRs are documented, key ones demonstrated where feasible (SPEC O-5).

---

## 12. Acceptance Criteria (product-level)

Product acceptance = the SPEC §15 acceptance criteria pass for each module, plus these cross-cutting gates:

1. **SSO:** a citizen completes transactions in ≥2 modules within one OneIdentity session, no second login (PG-1).
2. **Submit-once:** a renewal reuses a prior attestation and requests zero already-verified documents (PG-2).
3. **Human control:** no disbursement/refund instruction leaves the platform without a finance-officer release event in the audit log (PG-6, BR-G2).
4. **Transparency:** every active case shows all lanes and live SLA clocks on one timeline (PG-4).
5. **Inclusion:** every online flow has a working assisted/offline/account-less equivalent (PG-5).
6. **API parity:** any UI transaction is reproducible via the published API with consumer identity on every audit entry (PG-7).
7. **Proactive:** the dashboard surfaces at least reminders (FR-P11.1) and explainable, dismissible entitlement suggestions (FR-P11.3) that never auto-enrol (PG-8).
8. **Auditability:** every state change, document access and decision is captured in an append-only log queryable per case (FR-P7).

---

## 13. Open Questions carried from SPEC

Unchanged from SPEC §12 and not blocking the PRD: FR-P source validation (O-1), missing Module D swimlane (O-2), FR-P7 designation (O-3), ASYCUDA integration depth (O-4), demonstrated-vs-documented NFRs (O-5), legal confirmations (O-6). Scope decisions O-7 (Module G) and O-8 (Module C phasing) are resolved in this PRD: **Module G is in scope (P4); Module C income-tax filing + import/duty deferred to P3.**

---

*End of PRD. Awaiting approval to proceed to Phase 03 — Architecture.*
