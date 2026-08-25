# Requirements Specification — Module A: Passport Applications & Renewals

**Ministry / Agency:** Ministry of Home Affairs — Central Immigration & Passport Office (CI&PO)
**Document type:** Business & Functional Requirements Specification (BMAD format)
**Version:** 0.1 (Draft for stakeholder review) · **Date:** 13 July 2026
**Depends on:** oneCitizen Shared Platform Layer spec (FR-P1–FR-P11, incl. OneIdentity per FR-P1); Module B (GRO) attestation APIs
**Supersedes/consolidates:** the prior CI&PO Passport BMAD spec (new & renewal flows) is carried forward here as the platform-integration view. *Note: list items "Ministry of Home Affairs — Passport application/renewal" and "CI&PO — Passport applications & renewals" describe this same service and are consolidated in this one module.*

---

## 1. Background

Passport applicants today queue at the CI&PO office with paper forms, having first separately obtained a certified birth certificate from GRO. Checks proceed sequentially on a paper file with no applicant visibility, biometrics depend on reaching the counter before cut-off, and collection requires a return trip weeks later with no status line in between.

**Goal:** one digital application — new, renewal, or lost/stolen replacement — with civil-record verification and background vetting running in parallel, one payment, one booked biometric visit, and notified collection or delivery; adjudication, capture and handover remaining with CI&PO officers.

## 2. Scope

**In (Phase 1):** new adult passports; renewals; minor passports with both-parent/guardian consent workflow; lost/stolen replacement with police-report gate; diaspora applications with biometric capture at designated overseas missions.
**Out (Phase 1):** emergency travel documents; diplomatic/official passports.

## 3. Actors

| Actor | Role |
|---|---|
| Applicant / authorised agent | Applies, pays, attends biometrics, collects (FR-P1.3 delegated access) |
| CI&PO counter officer | Verifies identity, captures biometrics, sights originals |
| CI&PO passport officer (adjudicator) | Statutory approve / refer / refuse decision |
| CI&PO supervisor | Countersigns refusals and lost/stolen replacements |
| Vetting unit | Clears or escalates security/watchlist flags |
| GRO (Module B) | Civil-record attestation; manual match fallback |
| Issuing officer | Verifies identity at handover; cancels prior books |

## 4. Functional Requirements

- **A-FR1 Unified application.** One dynamic form; new vs renewal vs replacement auto-detected from the prior passport record. Vault reuse (FR-P2.2): renewals with an unexpired biometric record and a GRO-verified birth record skip re-submission of civil documents entirely.
- **A-FR2 Automated screening — flags, never clearances.** GRO civil-record match via the Module B attestation API; prior-passport lookup; watchlist/vetting referral flags routed to the vetting unit. The system never self-clears a flag.
- **A-FR3 Parallel checks.** Civil-record verification and background vetting run concurrently, each against its own sub-SLA, both visible on one applicant timeline (FR-P4).
- **A-FR4 Biometric appointment.** Booked via the shared appointments engine (FR-P5) at CI&PO Georgetown, regional offices, or designated overseas missions; original documents flagged for sighting (FR-P2.3) are inspected at the same visit; 48h/2h reminders with a documents checklist.
- **A-FR5 Adjudication.** A CI&PO passport officer decides approve / refer / refuse with mandatory coded reasons (FR-P6); supervisor countersign required for refusals and for lost/stolen replacements.
- **A-FR6 Personalisation & handover.** Integration with the passport production system: personalisation queue, quality-check confirmation, notification within 1 hour of QC pass; collection at the chosen office or courier delivery where offered; identity re-verified at handover (biometric match or ID + OTP); prior book electronically cancelled before a replacement personalises.
- **A-FR7 Minors & consent.** Both-parent/guardian digital consent capture, or a documented exception pathway (sole custody instrument, court order) reviewed by the adjudicator.
- **A-FR8 Fees.** One fee computation and payment via FR-P3.1 (card / MMG / counter reference) with QR receipt before parallel checks begin.
- **A-FR9 APIs & events (FR-P8).** Application, status, appointment and verification services published; webhooks including `passport.application.submitted`, `passport.adjudicated`, `passport.issued`; scope-filtered so oneCitizen sees only the authenticated citizen's cases.
- **A-FR10 oneCitizen integration.** Publishes its tile entry (name, description, prerequisites, required assurance level, deep link) to the FR-P9 catalogue under **Ministry of Home Affairs**; authentication exclusively via **OneIdentity** (FR-P1) with in-session step-up for Level 2 — the module presents no login of its own; status and citizen-confirmed submissions consumable by the AGUI assistant under delegated OneIdentity context (FR-P10).

## 5. Business Rules

- **A-BR1** No passport issues without a positive GRO civil-record match or a registrar-confirmed exception.
- **A-BR2** Lost/stolen replacement requires a police report reference; the prior book is electronically cancelled before new personalisation.
- **A-BR3** Biometrics are captured in person, always — no remote exception, including diaspora (missions serve this need).
- **A-BR4** Vetting clearances are logged with officer identity; an uncleared flag blocks adjudication, not submission.
- **A-BR5** Refusals carry coded reasons and appeal guidance to the applicant.

## 6. Acceptance Criteria (Given/When/Then)

1. *Given* a renewal applicant with a verified vault birth record and unexpired biometrics, *when* they submit, *then* no civil documents are requested and GRO verification completes via API with no applicant action.
2. *Given* screening raises a vetting flag, *when* the vetting officer clears it, *then* the clearance is logged with officer identity and the SLA clock resumes automatically.
3. *Given* civil-record verification and vetting both in progress, *when* the applicant views status, *then* both lanes and their SLA clocks appear on one timeline.
4. *Given* an approved application, *when* personalisation passes QC, *then* the applicant is notified within 1 hour with collection/delivery options.
5. *Given* a lost/stolen replacement, *when* personalisation is attempted before the prior book is cancelled, *then* the system blocks personalisation.
6. *Given* handover at a counter, *when* identity re-verification fails, *then* the passport is not released and a supervisor task is created.

## 7. Integrations & Dependencies

| System | Purpose | Fallback |
|---|---|---|
| GRO / Module B | Civil-record attestation | Manual registry match queue |
| Passport production system | Personalisation & QC | Batch file exchange interim |
| FR-P5 appointments | Biometric slots (incl. missions) | Counter walk-in reserve |
| FR-P3 payments | Fee collection | OTC cashier console |
| Police report registry (if available) | Lost/stolen reference check | Reference format check + sighting |

## 8. Assumptions & Risks

Mission-side biometric capture requires Ministry of Foreign Affairs agreement and equipment at designated posts — confirm coverage list. Production-system integration depth (API vs file exchange) to be confirmed with the supplier. Risk: legacy passport records incomplete for auto-detection of renewals → fallback to applicant-declared type with officer confirmation.
