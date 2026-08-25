# SPEC — oneCitizen Government Digital Services Platform (Guyana)

**Document type:** Software Requirements Specification (Business Analyst consolidation, BMAD Phase 01)
**Version:** 1.0 (Draft for approval)
**Date:** 13 July 2026
**Jurisdiction:** Co-operative Republic of Guyana
**Programme context:** One Guyana national digitalisation agenda
**Author role:** Lead Enterprise Architect / BMAD Orchestrator — Business Analyst phase
**Status:** ⏳ Awaiting stakeholder approval before Phase 02 (PRD)

---

## 0. About this document

This SPEC consolidates the source requirement documents present in the workspace into a single authoritative reference for downstream phases (PRD, Architecture, Stories, Implementation). It is the **source of truth** for scope. No code is written in this phase.

### 0.1 Source documents consolidated

| Ref | Source file | Owning body |
|---|---|---|
| Module A | `spec-A-cipo-passports.md` | Ministry of Home Affairs — Central Immigration & Passport Office (CI&PO) |
| Module B | `spec-B-gro-civil-registration.md` | Ministry of Home Affairs — General Register Office (GRO) |
| Module C | `spec-C-gra-revenue-services.md` | Guyana Revenue Authority (GRA) |
| Module D | `spec-D-mof-grants-payouts.md` | Ministry of Finance (MoF) |
| Module E | `spec-E-mhsss-social-benefits.md` | Ministry of Human Services & Social Security (MHSSS) |
| Module F | `spec-F-cross-government-appointments.md` | All Ministries (programme owner: NDMA / OPM) |
| Module G | `guyana-single-window-housing-portal-spec.md` | Ministry of Housing & Water — "One Home Guyana" single-window portal |
| Platform (P) | *Reconstructed* — see §0.2 | NDMA / e-Gov (shared platform layer, FR-P1–FR-P11) |

### 0.2 ⚠️ Critical reconstruction note — Shared Platform Layer

Every module spec (A–G) declares a dependency on the **"oneCitizen Shared Platform Layer spec (FR-P1–FR-P11, incl. OneIdentity per FR-P1)"**, but **that spec file is not present in the workspace**. Because all seven modules reference its capabilities extensively and consistently, this SPEC **reconstructs the FR-P platform layer (§6.1)** from those cross-references. The reconstruction is an ANALYST INFERENCE, flagged in Assumptions (§13, A-1). It must be validated by stakeholders and, if an authoritative FR-P source exists, reconciled against it before Phase 02.

FR-P references observed across modules, and their reconstructed meaning:

| Ref | Reconstructed capability | Evidence (modules citing it) |
|---|---|---|
| FR-P1 | **OneIdentity** SSO — single citizen identity; Level 1 (phone+OTP, account-less), Level 2 (step-up assurance); no per-module login | A,B,C,D,E,F,G |
| FR-P1.3 | Delegated access (agents, brokers, caregivers) | A,C,D,E,G |
| FR-P1.4 | Assisted intake at regional/agency offices | B,D,E,F |
| FR-P2 | Document vault + reusable attestations | A,B |
| FR-P2.2 | Vault reuse / reusable attested data | A,B |
| FR-P2.3 | Original-document sighting flag | A |
| FR-P3.1 | Payments — card / MMG / bank / counter reference; QR receipt; per-line settlement split | A,B,C,D,G |
| FR-P3.2 | Disbursement engine with human release control | D,E |
| FR-P4 | Notifications — SMS / email / in-portal / WhatsApp; channel consent; unified timeline | A,C,F,G |
| FR-P5 | Shared appointments engine (biometrics, sightings, collections, tests, home visits) | A,B,C,E,F |
| FR-P6 | Decisions with mandatory coded reasons + appeal guidance; programme-level analytics rollups | A,B,C,D,E,F |
| FR-P7 | *Not explicitly cited in any module* — **GAP** (see §12 O-3); presumed audit/security/logging layer | (none) |
| FR-P8 | API platform + eventing/webhooks; scope-filtered; OAuth2 CC + OIDC delegated | A,B,C,D,E,F,G |
| FR-P9 | Service catalogue (tiles grouped by ministry) | A,B,C,D,E,F,G |
| FR-P10 | **AGUI** conversational assistant — guide/pre-fill under delegated context; explicit citizen confirm | A,B,C,D,E,F |
| FR-P11 | Citizen dashboard: **FR-P11.1** reminders/obligations panel (pay-now deep links); **FR-P11.3** eligibility/suggestion engine (explainable, dismissible, never auto-enrol) | C,D,E,F,G |

---

## 1. Vision & Goals

**Vision:** A single national digital front door — **oneCitizen** — through which every Guyanese citizen (and authorised diaspora) transacts with government: one identity, one document vault, one payment rail, one appointments engine, one notifications channel, and a catalogue of ministry services delivered as consistent digital workflows.

**Guiding principles (invariants across all modules):**
1. **Submit once, reuse everywhere** — verified records become reusable attestations, never re-collected documents.
2. **Machines flag, humans decide** — automation screens, pre-fills and prepares; every statutory decision, money movement, clearance and suspension is an accountable officer action with a coded reason.
3. **Never lock out the offline citizen** — assisted counters, offline-capable field apps, walk-in reserve quotas, and account-less phone+OTP access are core scope, not stretch.
4. **One identity (OneIdentity), no module logins** — modules present no login of their own.
5. **API-first / headless** — every on-screen capability is an authorised, versioned API; the UI has no privileged back-door.
6. **Verifiable & auditable** — QR-verifiable digital records; append-only audit of every state change, access and decision.

---

## 2. Personas

| # | Persona | Description | Primary modules |
|---|---|---|---|
| 1 | **Citizen** | Any resident transacting with government; may be low-bandwidth, hinterland, elderly or digitally excluded | All |
| 2 | **Diaspora citizen** | Applies remotely (passport + overseas phone); needs local agent for in-person steps | A, G |
| 3 | **Authorised agent** | Architect/draughtsman/contractor (G), customs broker (C), professional representative — delegated access (FR-P1.3) | C, G |
| 4 | **Caregiver** | Acts for a beneficiary who cannot self-serve; delegated & revocable (FR-P1.3) | E |
| 5 | **Reviewing/counter officer** | Verifies identity, sights originals, captures biometrics, runs intake checks | A, B, C |
| 6 | **Adjudicator / approving officer** | Statutory approve / refer / refuse / award / suspend decisions | A, B, C, D, E |
| 7 | **Supervisor / Director / Registrar General** | Countersigns high-stakes decisions (refusals, corrections of substance, suspensions) | A, B, E |
| 8 | **Inspector / field officer** | Site, plumbing, wiring, septic, fire, home-visit inspections — offline-capable | E, G |
| 9 | **Examiner** | Driving written/practical tests (LRO) | C |
| 10 | **Verification officer** | Investigates and clears/rejects screening flags (dedup, deceased, anomaly) | C, D |
| 11 | **Authorising officer** | Approves payment batches | D |
| 12 | **Finance operations officer** | Releases every disbursement/refund batch; manages retry queue | C, D, E |
| 13 | **Medical board / assessor** | Disability determinations — never automated | E |
| 14 | **Vetting officer** | Clears/escalates security/watchlist flags | A |
| 15 | **Source-institution user** | Hospital, medical practitioner, marriage officer — confirms source records | B |
| 16 | **Ministry service-desk owner** | Publishes services, slot templates, quotas, blackout dates | F |
| 17 | **Front-desk / queue marshal** | Kiosk check-in oversight, priority-lane management | F |
| 18 | **Single-Window Coordinator** | Cross-agency case manager owning SLA escalations | G |
| 19 | **Programme team (MoF)** | Defines/versions cash-grant programme rules | D |
| 20 | **Ministry / programme oversight** | KPI dashboards, breach analytics (MoHW, NDMA) | D, F, G |
| 21 | **System administrator / NDMA operator** | Provisions roles, manages platform, consumer onboarding | Platform |

---

## 3. Ministries, Agencies & Bodies

| Code | Body | Role |
|---|---|---|
| NDMA / e-Gov | National Data Management Authority | Platform owner: hosting, OneIdentity, interoperability, consumer onboarding |
| OPM | Office of the Prime Minister | Co-programme owner (appointments, Module F) |
| MoHA | Ministry of Home Affairs | Parent of CI&PO (A) and GRO (B) |
| CI&PO | Central Immigration & Passport Office | Passports (Module A) |
| GRO | General Register Office | Civil registration (Module B) — data foundation of the platform |
| GRA | Guyana Revenue Authority | Revenue services (Module C); TIN authority |
| MoF | Ministry of Finance | Cash grants & payouts (Module D) |
| MHSSS | Ministry of Human Services & Social Security | Social benefits (Module E) |
| MoHW | Ministry of Housing & Water | One Home Guyana housing portal (Module G) |
| CH&PA / LA | Central Housing & Planning Authority / Municipalities & NDCs | Building permits (G) |
| GWI / GPL | Guyana Water Inc. / Guyana Power & Light | Utility connections (G) |
| GEI / EPA / GFS / NDIA | Electrical inspector / Environmental / Fire / Drainage | Conditional review lanes (G) |
| External rails | Banks, MMG, Post Office, GTT/Digicel SMS, insurers, ASYCUDA World, passport production | Payment, disbursement, notification, integration |

---

## 4. Services Catalogue (by module)

| Module | Service line | Key outcome |
|---|---|---|
| **A** CI&PO | New adult passport; renewal; lost/stolen replacement; minor passport (consent); diaspora (mission biometrics) | Issued passport |
| **B** GRO | New registration (late birth, death, marriage return); corrections (clerical / of substance); certified reissue (self / third-party / apostille-ready) | Digitally signed extract + printed certificate; reusable attestation |
| **C** GRA | TIN registration; income tax filing; motor-vehicle licence renewal; driver's licence (provisional/new/renewal + tests); import/duty payments (ASYCUDA) | Ledger entry, licence, assessment, clearance |
| **D** MoF | Cash grants; tax-relief programmes; budget-funded payouts (config-driven programme engine) | Disbursed payout |
| **E** MHSSS | Old-age pension; public assistance; disability benefit; single-parent support | Award + recurring payment lifecycle |
| **F** All | Cross-government appointment booking, check-in, queue, analytics | Booked/attended appointment |
| **G** MoHW | Single-window construction permit + coordinated utility connections | Construction Permission Certificate + Connection Orders |

Platform services (F cross-cutting): Catalogue (FR-P9), AGUI assistant (FR-P10), Reminders/eligibility dashboard (FR-P11), Vault (FR-P2), Payments/Disbursements (FR-P3), Notifications (FR-P4), Appointments (FR-P5).

---

## 5. Non-Functional Requirements

### 5.1 Platform-wide
- **Availability:** 99.5% monthly; announced maintenance windows.
- **Performance:** page loads ≤ 3 s on 3G-class connections; low-bandwidth usable; field/inspector apps offline-first.
- **Capacity:** Module G baseline 20,000 applications/yr, 300 concurrent, 5× headroom. **Module D burst (national grant): 50,000 registrations/day and 100,000 disbursement instructions/day** with queue-based degradation (slower, never lost) — a go-live gate.
- **Hosting/residency:** NDMA data centre or approved sovereign cloud; data residency in Guyana; DR RPO ≤ 1 h, RTO ≤ 8 h.
- **Security:** OWASP ASVS L2; MFA mandatory for all officer roles; TLS 1.2+ in transit, encryption at rest; document hash integrity; mutual TLS on the government interoperability layer; annual penetration test.
- **Accessibility:** WCAG 2.1 AA; plain-English guidance; **assisted-channel parity** (every online flow works via counter/outreach).
- **Auditability:** append-only audit log of every state change, document access and decision (who/what/when), retained ≥ 7 years; certificate/extract signing via national PKI or HSM-backed keys.
- **Devices:** modern browsers + Android-dominant reality; **PWA — no app-store dependency** for citizens.
- **API governance:** semantic versioning, min 12-month deprecation window, sandbox with synthetic data, OpenAPI 3 developer portal, per-consumer rate limits/quotas, NDMA approval gate for new consumers.
- **Data protection (Data Protection Act 2023):** purpose limitation; scope-filtered access (agency sees only its lane; oneCitizen sees only the authenticated citizen); public verification endpoints expose no personal data beyond a name; citizen right of access to own record.

### 5.2 Delivery-build constraints (from Project Constitution — Phase 04+)
> These govern the reference implementation, not the real-world production target above.
- **Frontend:** React (JavaScript), Vite, Tailwind CSS, Material UI, React Router, React Hook Form, Zod, Zustand, TanStack Query, Axios, Framer Motion.
- **Backend:** Node.js, Express.js, JWT auth, Swagger/OpenAPI, **Repository Pattern**, **JSON-based mock persistence under `backend/data`** (no database). **Controllers must never access JSON directly** — only via repositories.
- Production-ready architecture, responsive/accessible UI, security, logging, validation, testing.

---

## 6. Functional Requirements

### 6.1 Shared Platform Layer (FR-P) — *reconstructed, see §0.2*

- **FR-P1 OneIdentity SSO.** Single citizen identity across all modules; **Level 1** = phone + OTP (account-less booking/tracking); **Level 2** = step-up assurance (ID + biometric/GRO attestation) required for sensitive transactions. Modules present **no login of their own**. In-session step-up when a flow needs a higher level.
  - **FR-P1.3 Delegated access:** agents, brokers and caregivers act *as* the citizen under a signed authorisation; actions logged distinctly; revocable by the citizen.
  - **FR-P1.4 Assisted intake:** any regional/agency office can capture a transaction on a citizen's behalf with identical workflow.
- **FR-P2 Document vault & attestations.** Per-citizen typed, versioned, virus-scanned vault. **FR-P2.2** verified records become reusable attested data across modules with consent (an attestation, never a copied document). **FR-P2.3** documents needing original sighting are flagged for inspection without blocking parallel review.
- **FR-P3 Payments & disbursements.**
  - **FR-P3.1 Collection:** one itemised quote may span services; channels = card gateway, Mobile Money Guyana (MMG), bank transfer (reference code), over-the-counter cashier; QR/PDF receipt; **per-line settlement split** to each agency with daily reconciliation.
  - **FR-P3.2 Disbursement:** batch engine with **human release control** — money never moves on automation alone; per-payee status callbacks, reconciliation to batch totals, managed failed-payment retry queue.
- **FR-P4 Notifications.** Event-driven via SMS (primary — GTT/Digicel), email, in-portal; WhatsApp stretch. Per-channel consent honoured platform-wide. One unified timeline per citizen/case.
- **FR-P5 Appointments engine.** Shared slot/capacity engine powering biometrics (A), original sighting & collection (B), driving tests (C), home visits/board sittings (E) and the citizen-facing booking product (F). Offline-capable field/officer apps.
- **FR-P6 Decisions & analytics.** Every decision (approve/refer/refuse/award/suspend/reject) carries ≥1 **coded reason** from a controlled vocabulary + appeal guidance. Programme-level analytics rollups.
- **FR-P7 Audit, security & logging.** *(GAP — inferred.)* Append-only audit of state changes, access and decisions; PKI/HSM signing; role/MFA enforcement. **To be confirmed against authoritative FR-P source.**
- **FR-P8 API platform & events.** Every capability is a versioned REST/JSON API (headless). Webhooks per module (see per-module FRs). AuthN/Z: OAuth 2.0 client-credentials (system-to-system) + OIDC delegated user context issued by OneIdentity; scope-filtered responses; per-consumer rate limits. Developer portal, sandbox, deprecation policy per §5.1.
- **FR-P9 Service catalogue.** Each module publishes tile entries (name, description, prerequisites, required assurance level, deep link) grouped by ministry.
- **FR-P10 AGUI assistant.** Conversational assistant that finds services, guides and pre-fills forms under delegated OneIdentity context, always requiring the citizen's **explicit confirm before submission**.
- **FR-P11 Citizen dashboard.**
  - **FR-P11.1 Reminders/obligations panel:** surfaces outstanding dues and upcoming renewals with consent, offering **pay-now deep links** (display + pay only; disputes route to the owning agency).
  - **FR-P11.3 Eligibility/suggestion engine:** consumes modules' machine-readable public eligibility rules to propose likely entitlements against the citizen's own record — **explainable, dismissible, never auto-enrol/auto-apply**.

### 6.2 Module A — Passports (CI&PO)
- **A-FR1** Unified application; new/renewal/replacement auto-detected from prior record; vault reuse lets clean renewals skip civil-doc resubmission.
- **A-FR2** Automated screening produces **flags, never clearances** (GRO match, prior-passport lookup, watchlist/vetting referral).
- **A-FR3** Parallel civil-record verification + background vetting, each on its own sub-SLA, one timeline.
- **A-FR4** Biometric appointment via FR-P5 (Georgetown, regional, overseas missions); originals sighted at same visit; 48h/2h reminders with checklist.
- **A-FR5** Adjudication approve/refer/refuse with coded reasons; supervisor countersign for refusals and lost/stolen.
- **A-FR6** Personalisation & handover: production integration, QC, notify ≤1h of QC pass, collection/courier, identity re-verified at handover, prior book cancelled before replacement personalises.
- **A-FR7** Minors: both-parent/guardian digital consent, or documented exception pathway reviewed by adjudicator.
- **A-FR8** One fee via FR-P3.1 with QR receipt before parallel checks begin.
- **A-FR9** APIs/events: `passport.application.submitted`, `passport.adjudicated`, `passport.issued`; scope-filtered.
- **A-FR10** oneCitizen tile under Ministry of Home Affairs; OneIdentity-only with L2 step-up; AGUI under delegated context.

### 6.3 Module B — Civil Registration (GRO)
- **B-FR1** One type-aware flow (new/correction/reissue) with dynamic evidence checklist; up-front entitlement check for third-party requests.
- **B-FR2** Automated fuzzy index search + duplicate detection; unmatched → manual search queue with search fee itemised in the same payment.
- **B-FR3** Parallel source-record confirmation lane (hospitals, practitioners, marriage officers) on a sub-SLA.
- **B-FR4** Registrar decision always human; corrections of substance auto-escalate to Registrar General/Deputy with statutory declaration; coded-reason refusals.
- **B-FR5** Dual-format issuance: signed PDF extract with QR immediately + security-printed certificate queued; public `verify/{qrToken}` shows particulars only.
- **B-FR6** Attestation publishing — every verified record reusable by Modules A/C/D/E with consent.
- **B-FR7** Regional assisted capture; centralised production with tracked dispatch/booked collection.
- **B-FR8** APIs/events: `record.registered`, `record.corrected`, `record.issued`, `death.registered` (consumed by D/E).
- **B-FR9** oneCitizen tile under Ministry of Home Affairs; OneIdentity-only; AGUI pre-fill with confirm; age attestations feed FR-P11.3.

### 6.4 Module C — GRA Revenue Services
- **C-FR0 Discovery-first:** inventory existing GRA e-services and ASYCUDA World integration points; this module **extends, not replaces**.
- **C-FR1** TIN as tax identity — verified via FR-P1 + GRO attestation; blocking duplicate check; anchors the single taxpayer ledger.
- **C-FR2** Guided filing pre-filled from PAYE; straightforward returns get a rule-based **provisional assessment officer-batch-reviewed** before finalisation; complex returns officer-assessed.
- **C-FR3** Risk rules flag; officers decide; refunds prepared/reconciled by system, **released by a named finance officer** — never auto-paid.
- **C-FR4** Motor-vehicle licence renewal: fitness + insurance checks; digital licence with QR + printed disc.
- **C-FR5** Driver's licence: eligibility/prior-record check; written/practical test booking (FR-P5); examiner records on site; **LRO officer approves**; in-person biometric photo; digital + card issuance.
- **C-FR6** Import/duty: pull declaration from ASYCUDA; consolidated duty+VAT quote; payment posts back to ASYCUDA **within 5 min** for release; broker delegated access.
- **C-FR7** One taxpayer ledger (filings, assessments, licences, payments, compliance); compliance-certificate requests.
- **C-FR8** One payment may span services with per-line settlement.
- **C-FR9** APIs/events: `return.filed`, `assessment.finalised`, `licence.issued`, `duty.paid`; TIN/compliance attestation consumed by Module D.
- **C-FR10** oneCitizen tiles per service line under GRA; OneIdentity-only; AGUI-guided.
- **C-FR11** Obligations feed → FR-P11.1 reminders panel (pay-now deep links; disputes route to GRA).

### 6.5 Module D — Cash Grants & Payouts (MoF)
- **D-FR1** Programme definition console — eligibility, evidence, amount, schedule, channels, dates, appeal window; versioned; **new measure launches by configuration**.
- **D-FR2** Enrolment modes: (a) self-application; (b) **registry-driven pre-enrolment** (confirm + pick channel only); (c) **assisted outreach** on offline devices, deduplicated at sync.
- **D-FR3** Automated screening: identity match, age via GRO, deceased-flag, **duplicate detection across every channel and every programme** in the shared payee registry.
- **D-FR4** Payee validation: bank/MMG verification; post-office/cash for unbanked; corrections without re-enrolment.
- **D-FR5** Human control chain: flags→verification officer; cleared cases→authorising officer batch approval; batches **released by MoF finance ops** (FR-P3.2) with callbacks, reconciliation, retry queue. **Money never moves on automation alone.**
- **D-FR6** Appeals reopen to a *different* officer; public aggregate dashboard (no personal data).
- **D-FR7** APIs/events: `enrolment.received`, `case.flagged`, `batch.released`, `payment.settled`; consumes `death.registered` (B) and TIN/compliance (C).
- **D-FR8** oneCitizen tiles per live programme under MoF; publishes machine-readable public eligibility rules to FR-P11.3 (explainable, never auto-enrol); AGUI-guided enrolment with confirm.

### 6.6 Module E — Social Benefits (MHSSS)
- **E-FR1** One application; programme selector; age/identity auto-verified via GRO — **clean 65+ match needs no age documents**; declarations only where required.
- **E-FR2** Parallel human assessment lanes: means/household (home visits via FR-P5, offline app), **medical board** for disability (regional sittings), single-parent evidence review.
- **E-FR3** Awards stay human: case-officer recommendation → approving officer/committee with coded reasons + appeal rights; creates recurring payee records with channel choice.
- **E-FR4** Recurring lifecycle: visible payment calendars; **digital life-certificates** by biometric/OTP at any counter/outreach (replace pension books); missed-renewal grace periods before suspension; batches released by finance ops.
- **E-FR5** Flags reviewed, never executed: death-flags **suspend pending case-officer confirmation** — no auto-termination; change-of-circumstance adjusts only after officer review.
- **E-FR6** Beneficiary visibility & caregiver delegation; assisted intake at any regional office.
- **E-FR7** APIs/events: `benefit.awarded`, `benefit.suspended`, `renewal.completed`; consumes `death.registered` (B).
- **E-FR8** oneCitizen tiles per programme under MHSSS; OneIdentity incl. caregiver delegation; publishes eligibility rules to FR-P11.3 (e.g. old-age-pension prompt at 65); renewal reminders on FR-P11.1 with consent.

### 6.7 Module F — Cross-Government Appointments
- **F-FR1** Service directory: prerequisites, documents-to-bring, duration — **visible before booking** so citizens never travel uninformed.
- **F-FR2** Slot & capacity management; **walk-in reserve quotas at/above a mandatory floor**.
- **F-FR3** Booking lifecycle (book/reschedule/cancel); freed slots return to inventory immediately; **account-less booking** (phone+OTP, Level 1); one appointments view for signed-in citizens.
- **F-FR4** 48h/2h reminders with checklist; per-channel consent; no-show tracking with configurable rebooking.
- **F-FR5** QR/reference check-in kiosk; live queue position; priority lanes; walk-ins via reserve quota.
- **F-FR6** Officer console day-list; completion recording feeds analytics.
- **F-FR7** Per-ministry analytics: demand heatmaps, no-show rates, average service times.
- **F-FR8** APIs/events consumed by A/B/C/E: `appointment.booked`, `.rescheduled`, `.checked_in`, `.completed`.
- **F-FR9** oneCitizen "All Ministries — Appointments" tile; OneIdentity + account-less path; AGUI conversational booking with confirm; upcoming appointments on FR-P11 sidebar.

### 6.8 Module G — One Home Guyana Housing Portal (MoHW)
> A single-window construction-permit + utility-connection portal, and a first-class oneCitizen consumer (tile under MoHW; delegated OneIdentity; fee quotes may surface on FR-P11.1).

- **G-FR1** Identity/accounts/agents (incl. diaspora + mandatory local agent for inspections); MFA for agency users.
- **G-FR2** Unified dynamic intake with conditional sections; premise ID by region/NDC/lot + GPS/cadastral; tenure evidence types; building details; utilities selection; save-as-draft; one **Master Application Number** `OHG-<Region>-<YYYY>-<seq>`.
- **G-FR3** Document vault ("submit once"): typed, versioned, virus-scanned, DWG/DXF supported; shared instance; certified-copy sighting flag.
- **G-FR4** Pre-screening & routing engine: jurisdiction resolver; configurable conditional-trigger rules (EPA/GFS/NDIA); **one child case per required agency** each with own SLA clock; duplicate-lot detection.
- **G-FR5** Consolidated fees & payment (FR-P3.1): one itemised quote → one payment → settlement split; supplemental fees on same MAN.
- **G-FR6** Parallel review & SLA management: configurable per-lane stages; **30-working-day** default statutory clock (configurable), clock pauses only on applicant-action states; **single consolidated deficiency cycle (RFC)**; auto-escalation on breach; per-lane decisions; optional silence-is-consent policy flag.
- **G-FR7** Inspections: shared calendar, joint windows, offline-capable inspector app (geotagged photos, checklist, e-signature), auto-deficiency lists, re-inspection with fee handling.
- **G-FR8** Approvals & certificates: assemble **Construction Permission Certificate** (QR-verifiable, digitally signed, hashed plan refs, conditions, validity); auto-dispatch **Connection Orders** to GWI/GPL/gas; public verification endpoint (name only); revocation/suspension workflow.
- **G-FR9** Notifications & tracking (FR-P4): event-driven; public tracking by MAN + OTP; assisted/mediated channel.
- **G-FR10** Back-office, reporting & audit: per-agency console; Coordinator console (cross-lane view, SLA heatmap, RFC composer); MoHW/NDMA dashboards; ≥7-year immutable audit.
- **G-FR11** Exposed API platform (API-first): full published catalogue, webhooks, OAuth2/OIDC via OneIdentity, scope-filtered, sandbox + developer portal — oneCitizen is a first-class consumer.

---

## 7. Cross-Module Workflows

### 7.1 Canonical service workflow (applies to A, B, C, D, E, G)
```
Discover (catalogue/AGUI) → Authenticate (OneIdentity, step-up if needed)
→ Intake (dynamic form, vault reuse/attestations) → Validate (completeness + business rules)
→ Pay once (FR-P3.1, per-line split)   [sequence configurable per agency]
→ Parallel screening/review lanes (each own sub-SLA clock, one timeline)
     • automated screening produces FLAGS only
     • human officer decisions with coded reasons
     • appointments/inspections via FR-P5 where in-person required
→ Consolidated deficiency cycle (single RFC; applicant responds once)
→ Decision(s) recorded → Issue (signed + QR-verifiable artefact / disbursement / connection order)
→ Notify (FR-P4) → Publish reusable attestation / events (FR-P8) → Audit every step
```

### 7.2 Disbursement workflow (D, E) — human control chain
```
Enrol/Award → Screen (identity, age, deceased, dedup) → Flags → Verification officer clears
→ Authorising officer approves batch → Finance ops RELEASES batch (FR-P3.2)
→ Payment rails + per-payee callbacks → Reconcile to batch total → Retry queue for failures
   (No instruction ever leaves the platform without an officer release.)
```

### 7.3 Inter-module data flows
- **B → A/C/D/E:** civil-record attestations (birth/age/identity); `death.registered` flags to D & E (suspend/exclude pending officer review — never auto-terminate).
- **C → D:** TIN/compliance attestations for relief-programme eligibility.
- **D ↔ E:** shared payee registry + cross-programme dedup.
- **F ← A/B/C/E:** embedded appointment booking on shared inventory (no hidden priority over direct bookings).
- **All → FR-P11.3:** public eligibility rules for entitlement suggestions.
- **G → oneCitizen:** appears as MoHW tile; fee obligations may surface on FR-P11.1.

---

## 8. Business Rules (consolidated)

**Platform-wide**
- **BR-G1** No module presents its own login — authentication is OneIdentity only.
- **BR-G2** Automation flags; a human officer makes every statutory decision, clearance, money movement and suspension, each with a coded reason (FR-P6).
- **BR-G3** Verified records are published as reusable attestations, never re-collected.
- **BR-G4** Scope-filtered access: an agency sees only its lane; oneCitizen sees only the authenticated citizen; public verification exposes name only.
- **BR-G5** Offline citizens are never locked out (assisted/outreach/walk-in/account-less are mandatory scope).

**Module A** — A-BR1 no passport without positive GRO match or registrar-confirmed exception; A-BR2 lost/stolen needs police report + prior book cancelled before personalisation; A-BR3 biometrics always in person (incl. diaspora at missions); A-BR4 uncleared flag blocks adjudication, not submission; A-BR5 refusals carry coded reasons + appeal guidance.

**Module B** — B-BR1 corrections annotate, never overwrite; B-BR2 third-party reissue requires demonstrated entitlement; B-BR3 death flags are flags (stoppage is a human decision in the consuming module); B-BR4 no-trace is a formal coded outcome; B-BR5 digital extracts and printed certificates carry equal legal standing (confirm with AG).

**Module C** — C-BR1 one TIN per person/entity (blocking dedup); C-BR2 no MV licence without valid insurance & fitness; C-BR3 practical tests, examiner sign-off and licence approvals never automated; C-BR4 customs release needs payment + officer clearance in ASYCUDA; C-BR5 provisional assessments not final until officer batch review (visible on ledger); C-BR6 refund release requires a named finance officer, logged.

**Module D** — D-BR1 one payout per eligible citizen per programme (across all channels incl. offline at sync); D-BR2 no disbursement to a deceased-screening failure until officer clears; D-BR3 rule changes never retro-apply without an officer-approved, versioned re-adjudication run; D-BR4 every rejection/flag disposition coded; D-BR5 unclaimed/failed payments follow a defined, configurable escheat/expiry policy.

**Module E** — E-BR1 old-age pension is age-based & universal (no means test without PS-level rule change); E-BR2 no suspension/termination without officer decision + coded reason + notified appeal; E-BR3 disability needs medical board sign-off; E-BR4 missed life-certificate enters grace period with reminders before any suspension task; E-BR5 multiple awards only where rules permit (overlaps flagged); E-BR6 caregiver actions logged distinctly, revocable anytime.

**Module F** — F-BR1 walk-in reserve quotas mandatory at/above floor; F-BR2 appointment data visible only to the visited ministry; the cross-ministry view belongs to the citizen alone; F-BR3 per-channel reminder consent honoured platform-wide; F-BR4 no-show handling never blacklists a citizen from booking; F-BR5 embedded module bookings get no hidden priority over direct bookings.

**Module G** — G-BR1 no submission without ≥1 valid tenure record; G-BR2 rates arrears flag (may be a condition), don't block; G-BR3 electricity order gated on valid GEI wiring certificate; G-BR4 sewer only where sewered_area_flag; else on-site sanitation mandatory; G-BR5 Amerindian village lands require Village Council consent lane; G-BR6 one active MAN per lot; G-BR7 certificate expires if construction not commenced in validity period (renewal = lightweight re-validation); G-BR8 fees due before review except decision-then-payment LAs (fee engine supports both); G-BR9 every rejection carries a coded reason; G-BR10 Data Protection Act compliance.

---

## 9. Validations

- **Identity:** National ID / passport format; TIN validated against GRA where interface exists, else format-check + declaration; phone OTP; email optional.
- **Assurance gating:** Level 2 step-up enforced before sensitive transactions; account-less (Level 1) limited to booking/tracking.
- **Duplicate detection (blocking):** one TIN per entity (C); one payout per programme per citizen (D); one active MAN per lot (G); passport prior-record dedup (A); GRO index duplicate detection (B).
- **Completeness checks:** dynamic per-type evidence checklists; correction-of-substance blocked without statutory declaration (B); pre-submission human-readable checklist (G).
- **Payment integrity:** itemised quote reconciles to settlement split; batch total reconciles to per-payee callbacks; no disbursement without officer release.
- **Gating checks:** insurance + fitness before MV licence (C); GEI wiring certificate before electricity order (G); positive GRO match before passport issue (A); deceased screening before payout (D/E).
- **File validation:** accepted formats (PDF/JPG/PNG, +DWG/DXF for G); max 25 MB default; virus scan; hash integrity; versioning (re-upload = new version, never parallel copy).
- **Form validation (delivery build):** all inputs schema-validated with **Zod** on the client; server-side re-validation in Express before repository writes.

---

## 10. Navigation & Information Architecture

**Citizen-facing (oneCitizen shell)**
- **Home / Dashboard** → identity summary, **Reminders & obligations panel (FR-P11.1)**, **Suggested entitlements (FR-P11.3)**, upcoming appointments, active cases timeline.
- **Service Catalogue (FR-P9)** → grouped by ministry (Home Affairs → Passports/Certificates; GRA → tax/licences/duty; MoF → grants; MHSSS → benefits; All Ministries → Appointments; MoHW → One Home).
- **AGUI Assistant (FR-P10)** → persistent conversational entry point; guides, pre-fills, always confirms.
- **My Cases** → per-case unified timeline (all lanes, SLA clocks, RFCs, decisions, artefacts).
- **My Documents (vault)** → typed/versioned; attestation-sharing consent controls.
- **Payments & Receipts** → quotes, pay-now, QR receipts, ledgers (C).
- **Appointments** → one view across ministries; book/reschedule/cancel; QR check-in.
- **Public verification pages** → QR-resolved, no auth, name-only disclosure.

**Officer / back-office consoles** (role-scoped, MFA)
- Work queues & day-lists (A/B/C/E/F); adjudication/decision recording with coded reasons; batch approval & release (D/E); Coordinator cross-lane console + SLA heatmap + RFC composer (G); programme definition console (D); ministry service-desk directory/slot management (F); dashboards & analytics (D/F/G); consumer/API onboarding (Platform).

---

## 11. Edge Cases

1. **Diaspora applicant** with overseas phone — biometrics only at designated missions (A-BR3); local agent mandatory for in-person steps (G).
2. **Deceased payee** — death flag suspends/excludes pending officer review; never auto-terminates (B-BR3, D-BR2, E-BR5→E-FR5).
3. **Duplicate across channels** — offline outreach enrolment colliding with a web enrolment; caught at sync, both records linked for officer review (D-FR3/D-BR1).
4. **No-trace registry search** — a formal coded outcome, not a silent dead end; fee disposition per policy (B-BR4).
5. **Correction of substance without statutory declaration** — submission blocked with exact missing instrument named (B-BR1/AC).
6. **Lost/stolen passport** — prior book must be electronically cancelled before new personalisation (A-BR2).
7. **Uncleared vetting/anomaly flag** — blocks adjudication but not submission (A-BR4).
8. **Lapsed insurance/fitness** at MV renewal — blocked with the exact failing check named (C-BR2/AC4).
9. **Offline inspection/home-visit in hinterland** — completed offline, syncs on reconnect without data loss (E, G).
10. **Missed life-certificate** — grace period + proactive reminders before any suspension task is even created (E-BR4).
11. **Silence-is-consent** (G) — if enabled by regulation, an SLA-breaching lane is deemed approved with standard conditions, logged as such.
12. **Ambiguous jurisdiction** (G) — routes to Single-Window Coordinator queue.
13. **Rates arrears** (G) — flagged, may become a certificate condition, does not block submission.
14. **Amerindian village land** (G) — mandatory Village Council consent lane.
15. **Fully-booked calendar** (F) — walk-in reserve quota still admits the citizen.
16. **Account-less citizen** (F) — booking, reminders, QR check-in all function on phone+OTP alone.
17. **Batch not yet released** (D) — no payment instruction leaves the platform even if all else is ready.
18. **Rule change mid-programme** (D) — never retro-applies without an officer-approved, versioned re-adjudication run.
19. **Legacy record gaps** — auto-detection/matching falls back to applicant-declared + officer confirmation (A), manual ledger search (B), manual verification queues (G).
20. **API versioning** — a deployed v1 consumer keeps working unchanged through the deprecation window while v2 ships (G-AC13).

---

## 12. Open Questions & Gaps

- **O-1** The authoritative **oneCitizen Shared Platform Layer spec (FR-P1–FR-P11)** is absent; §6.1 is reconstructed and must be validated (see A-1).
- **O-2** No **Module D swimlane** exists among the provided HTML diagrams (swimlanes A, B, C, E, F and One Home present; D missing) — confirm D workflow visualisation.
- **O-3** **FR-P7** is not cited by any module — confirm what it designates (assumed audit/security/logging in §6.1).
- **O-4** Which of Module C's ASYCUDA integration points (references, receipts, release status) are actually exposed — pending GRA discovery (C-FR0).
- **O-5** Real-world NFRs (sovereign hosting, PKI/HSM signing, 99.5% uptime, national-scale burst) vs the delivery build's JSON-mock persistence — confirm which NFRs are *demonstrated* vs *documented* in the reference implementation.
- **O-6** Legal confirmations pending with the Attorney General's Chambers: e-signature validity of digital extracts/certificates (B-BR5, G), and any silence-is-consent rule (G-FR6).
- **O-7** Scope confirmation: is **Module G (One Home Guyana)** in-scope for this build, or documented as a consumer only? (Included here because its spec is present in the workspace.)
- **O-8** Income tax filing (C-b) and Import/duty (C-e) are marked **Phase 3 candidates** — confirm Phase-1 delivery scope for Module C.

---

## 13. Assumptions

- **A-1** The FR-P platform layer (§6.1) is reconstructed from module cross-references; treated as authoritative until an official FR-P source supersedes it.
- **A-2** Participating agencies accept a shared SLA framework and joint-inspection protocol (inter-agency MOU is a prerequisite for G).
- **A-3** Fee schedules and programme rules are configuration-driven per agency/LA/programme.
- **A-4** NDMA provides hosting, SMS gateway contracts, OneIdentity and (eventually) national ID verification.
- **A-5** Bank/MMG validation and callback APIs are contractable; the shared payee registry is live before the first grant programme.
- **A-6** GRO index digitisation is sufficiently advanced for automated matching; otherwise manual queues by era/region are the fallback.
- **A-7** The reference implementation uses JSON mock persistence (`backend/data`) via the Repository Pattern; external integrations (GRA, ASYCUDA, banks, MMG, SMS, production systems) are represented by mock adapters with the documented fallback behaviours.

---

## 14. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-1 | Missing FR-P source → reconstruction drifts from real platform contract | Rework across all modules | Validate §6.1 at approval gate; reconcile early |
| R-2 | Agencies retain parallel paper/legacy channels | Undermines single window & adoption | Policy sunset dates per service line/region; dual-running plan |
| R-3 | National-scale burst on a live grant (D) | Failed/lost payments, reputational | Capacity testing as go-live gate; queue-based degradation; human release chain is non-negotiable |
| R-4 | Political timeline pressure compressing verification (D) | Fraud/duplicate leakage | State human control chain as non-negotiable to stakeholders |
| R-5 | Digital exclusion (esp. E beneficiaries; hinterland Regions 1,7,8,9) | Citizens locked out | Assisted/outreach/walk-in/account-less as core scope with adoption targets |
| R-6 | Data quality — cadastral gaps (G), legacy ledgers (B), duplicate rolls (D/E) | Matching failures, wrong payments | Fuzzy matching + manual queues; one-time cleanse with officer adjudication before migration |
| R-7 | Connectivity gaps for field/inspector/examiner apps | Data loss, delays | Offline-first with sync on reconnect |
| R-8 | Integration readiness (GWI/GPL/insurers/ASYCUDA/production) varies | Blocked flows | Documented manual fallbacks from day one |
| R-9 | Legal e-signature / silence-is-consent unconfirmed | Certificates challengeable | AG confirmation before go-live |
| R-10 | Change management / officer training | Slow uptake, errors | Dual-running period + training per agency |

---

## 15. Acceptance Criteria (representative, by module)

**Platform** — (P1) A citizen authenticates once via OneIdentity and transacts across ≥2 modules with no second login. (P2) An authorised API client reproduces a UI transaction identically, with consumer identity on every audit entry. (P3) A `death.registered` webhook subscribed by Module E is delivered within 60 s and suspends (not terminates) the matching payee pending officer review.

**A (Passports)** — clean renewal requests no civil docs; cleared vetting flag resumes SLA with logged officer identity; both lanes on one timeline; QC-pass notified ≤1h; personalisation blocked before prior book cancelled; failed handover re-verification withholds passport + raises supervisor task.

**B (GRO)** — unique-match certified copy issues same-day digital + tracked print; correction-of-substance without declaration blocked with exact missing instrument; approved correction preserves original entry with visible annotation; parallel index + hospital-confirmation lanes each with own SLA; public QR shows particulars only; death registration flags active pension payee without stopping payment.

**C (GRA)** — PAYE-prefilled return completes in one session; anomaly flag attaches ledger context + coded officer decision; passed practical → LRO approval → immediate digital licence + queued card; lapsed insurance blocks renewal naming the failing check; duty payment posts back to ASYCUDA within 5 min; no refund instruction leaves the platform without finance-officer release.

**D (Grants)** — cross-channel duplicate blocked at sync with both records linked; pre-enrolled citizen confirms + MMG validated with no further evidence; released batch issues instructions with per-payee callbacks reconciling to batch total; unreleased batch → no instruction leaves; deceased-flagged payee excluded pending investigation; in-window appeal reopens to a different officer.

**E (Benefits)** — clean 65+ match requests no age documents and reaches approving officer within SLA; disability claim runs means + medical-board lanes in parallel; offline home-visit syncs without loss; digital life-certificate at a counter continues payment with no book; death flag suspends pending review with officer task, no auto-termination; suspension without coded reason + appeal notice is blocked.

**F (Appointments)** — a Module-A biometric booking appears in the citizen's one appointments view; walk-in admitted via reserve quota on a full calendar; reschedule returns the freed slot immediately and re-arms reminders; account-less OTP booking + reminders + QR check-in all work; prerequisite checklist visible before confirmation; monthly analytics (heatmaps, no-show, service times) available per office/service.

**G (One Home)** — single submission opens exactly the routing-determined lanes on one timeline; one MMG payment yields one receipt + correct settlement split; two agencies' queries become one consolidated RFC cleared by one resubmission; joint inspection posts both results from one visit; all-lanes-approved → signed QR-verifiable certificate within 1 working day + auto-dispatched Connection Orders; waterway-buffer premise auto-opens EPA lane; missing GEI wiring certificate blocks GPL connection order; SLA breach escalates + reflects on MoHW dashboard within 15 min; QR verification shows name only; offline inspection syncs without loss; API submission matches UI submission with consumer identity audited; oneCitizen delegated `GET /applications/{man}` returns only that citizen's records + `certificate.issued` webhook within 60 s; v1 consumer unaffected by v2 release.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| oneCitizen | The national single-front-door government services platform |
| OneIdentity | Shared SSO identity platform (FR-P1); Level 1 = phone+OTP, Level 2 = step-up |
| AGUI | Conversational assistant (FR-P10) that guides/pre-fills with explicit citizen confirm |
| Attestation | Reusable verified record shared across modules (never a document copy) |
| Lane | One agency/assessment child case within a parallel workflow |
| RFC | Request for Correction — consolidated deficiency notice (G) |
| MAN | Master Application Number (G) — `OHG-<Region>-<YYYY>-<seq>` |
| TIN | Taxpayer Identification Number — the tax identity anchor (C) |
| MMG | Mobile Money Guyana — payment/disbursement rail |
| ASYCUDA | Automated System for Customs Data (customs platform, C) |
| SLA clock | Per-lane statutory service-level timer, pausable on applicant-action states |
| Silence-is-consent | Optional policy: an SLA-breaching lane deemed approved with standard conditions (G) |
| Life-certificate | Digital proof-of-life renewal replacing pension books (E) |

---

*End of SPEC. Awaiting approval to proceed to Phase 02 — Product Manager (docs/PRD.md).*
