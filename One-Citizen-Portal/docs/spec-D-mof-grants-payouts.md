# Requirements Specification — Module D: Cash Grants & Citizen Payouts

**Ministry / Agency:** Ministry of Finance (MoF)
**Document type:** Business & Functional Requirements Specification (BMAD format)
**Version:** 0.1 (Draft for stakeholder review) · **Date:** 13 July 2026
**Service lines in scope (as requested):** Cash grants (e.g., the GY$100,000 grant model) · Tax relief programmes · Budget-funded citizen payouts
**Depends on:** oneCitizen Shared Platform Layer spec (FR-P1–FR-P11, incl. OneIdentity per FR-P1; esp. FR-P3.2 disbursements); Module B (GRO) attestations & death flags; Module C (GRA) TIN/compliance attestations for relief programmes.

---

## 1. Background

Recent payout exercises relied on physical registration events with hours-long queues, paper bank-detail forms prone to transcription errors and failed payments, manual list checks that let duplicates through across sites, approvals by circulated spreadsheet, and cheque distribution events that created yet more queues and uncollected instruments — with no formal appeal path.

**Goal:** a reusable **programme engine** where each budget measure — one-off universal grant, targeted relief, recurring payout — is **configuration, not a new build**: rules defined once, enrolment across web/assisted/offline-outreach channels under one dedup net, and disbursement at national scale with human authorisation and release on every batch.

## 2. Scope

**In (Phase 1 of this module):** programme definition console; self-application, registry-driven pre-enrolment, and offline outreach enrolment; eligibility/dedup/deceased screening; payee validation (bank / MMG / post-office); flag review; batch approval; finance-released disbursement; reconciliation; appeals; public aggregate dashboard.
**Out:** tax relief applied as GRA assessment adjustments executes in Module C on Module D programme rules; in-kind (non-cash) benefit logistics; means-tested social programmes (Module E's domain — the payee registry is shared).

## 3. Actors

| Actor | Role |
|---|---|
| Citizen | Enrols/confirms, chooses payout channel, receives, appeals |
| MoF programme team | Defines and versions programme rules |
| Verification officer | Investigates and clears/rejects flags |
| Authorising officer | Approves each payment batch |
| MoF finance operations | Releases every batch; manages retry queue |
| Outreach officers | Offline hinterland enrolment (FR-P1.4) |
| Banks / MMG / Post Office | Disbursement rails and status callbacks |

## 4. Functional Requirements

- **D-FR1 Programme definition console.** Eligibility criteria (age, residency, registry sources), evidence list, amount and schedule, channels, start/end, appeal window — versioned and auditable; a new budget measure launches by configuration.
- **D-FR2 Enrolment modes per programme.** (a) Self-application; (b) **registry-driven pre-enrolment** — eligible citizens pre-identified from GRO/National ID data and asked only to confirm and pick a payout channel; (c) **assisted outreach registration** on offline-capable devices for hinterland exercises, deduplicated at sync time.
- **D-FR3 Automated screening.** Identity match (FR-P1), age via GRO attestation, deceased-flag screening (Module B feed), and **duplicate detection across every channel and every programme** in the shared payee registry.
- **D-FR4 Payee validation.** Bank account / MMG wallet verification; post-office or cash-distribution assignment for unbanked citizens; payee data corrections without re-enrolment.
- **D-FR5 Human control chain.** Flags route to verification officers (**system flags, officer clears**); cleared cases batch to an **authorising officer** for approval; batches are prepared and scheduled by the system and **released by MoF finance operations** (FR-P3.2) with per-payee status callbacks, reconciliation to batch totals and a managed failed-payment retry queue. **Money never moves on automation alone.**
- **D-FR6 Appeals & transparency.** Appeal within the programme window reopens the case to a different officer with evidence attached; public dashboard shows aggregate counts and totals by region — no personal data.
- **D-FR7 APIs & events (FR-P8).** Programme, enrolment, status and payment-status services; webhooks including `enrolment.received`, `case.flagged`, `batch.released`, `payment.settled`; consumes `death.registered` from Module B and TIN/compliance attestations from Module C.
- **D-FR8 oneCitizen integration (new).** Publishes tile entries per live programme to the FR-P9 catalogue under **Ministry of Finance**; authentication exclusively via **OneIdentity** (FR-P1); **publishes machine-readable programme eligibility rules (public criteria only)** so the FR-P11.3 suggestion engine can propose likely entitlements against the citizen's own record — suggestions are explainable, dismissible and never auto-enrol (D-BR1 unchanged); the AGUI assistant may guide enrolment with the citizen's explicit confirm (FR-P10).

## 5. Business Rules

- **D-BR1** One payout per eligible citizen per programme — enforced across all channels including offline outreach at sync time.
- **D-BR2** No disbursement to a payee failing deceased-screening until an officer investigates and clears.
- **D-BR3** Programme rule changes never retro-apply to adjudicated cases without an officer-approved re-adjudication run, itself versioned and logged.
- **D-BR4** Every rejection and every flag disposition carries a coded reason (FR-P6).
- **D-BR5** Unclaimed/failed payments follow a defined escheat/expiry policy per programme — configurable, never silent.

## 6. Acceptance Criteria (Given/When/Then)

1. *Given* a duplicate attempt (same National ID via web and an outreach device), *when* the offline batch syncs, *then* the duplicate is blocked and both records linked for officer review.
2. *Given* a pre-enrolled citizen, *when* they confirm and select MMG, *then* wallet validation completes and the case reaches screening with no further evidence requested.
3. *Given* an approved batch, *when* the finance officer releases it, *then* payment instructions issue with per-payee callbacks and the reconciliation report balances to the batch total.
4. *Given* an approved batch not yet released, *when* any process attempts payment, *then* no instruction leaves the platform.
5. *Given* a payee flagged deceased by Module B, *when* the batch is assembled, *then* the payee is excluded pending officer investigation.
6. *Given* a rejected applicant appealing within the window, *when* the appeal is lodged, *then* the case reopens to a different officer with the appeal evidence attached.

## 7. Non-Functional Requirements (module-specific)

Grant events can require enrolling and paying the national adult population within weeks: **burst capacity of 50,000 registrations/day and 100,000 disbursement instructions/day**, with queue-based degradation (slower, never failed/lost); outreach devices operate fully offline for multi-day exercises; reconciliation reporting daily during live programmes.

## 8. Integrations & Dependencies

| System | Purpose | Fallback |
|---|---|---|
| GRO / Module B | Age attestation; death flags | Document check + officer review |
| National ID registry | Pre-enrolment source | Self-application only |
| Banks / MMG | Payee validation, disbursement, callbacks | Post-office/cash distribution channel |
| Module C (GRA) | TIN/compliance for relief programmes | Declaration + officer check |
| FR-P3.2 | Disbursement engine & release control | N/A — mandatory dependency |

## 9. Assumptions & Risks

Assumes bank/MMG validation and callback APIs are contractable; assumes the shared payee registry is live before the first programme. Risks: burst load on a live national programme → D-NFR capacity testing is a go-live gate; political timeline pressure compressing verification → the human control chain (D-FR5) is non-negotiable and stated as such to stakeholders; exclusion of unbanked/offline citizens → outreach and post-office channels are mandatory scope, not stretch.
