# Requirements Specification — Module E: Social Benefits

**Ministry / Agency:** Ministry of Human Services & Social Security (MHSSS)
**Document type:** Business & Functional Requirements Specification (BMAD format)
**Version:** 0.1 (Draft for stakeholder review) · **Date:** 13 July 2026
**Service lines in scope (as requested):** Old-age pension · Public assistance · Disability benefits · Single-parent support
**Depends on:** oneCitizen Shared Platform Layer spec (FR-P1–FR-P11, incl. OneIdentity per FR-P1; esp. FR-P3.2 disbursements and the shared payee registry); Module B (GRO) attestations & death flags.

---

## 1. Background

Applicants travel repeatedly to the ministry or regional offices with paper forms per programme, age proof is chased from GRO, home-visit diaries back up, medical board sittings are scarce and Georgetown-centric, and decisions sit on paper files with no visibility. Beneficiaries then face pension-book queues, post-office payday lines, and physical life-certificate stamps whose absence triggers suspensions without review.

**Goal:** one benefits application with human assessment lanes running in parallel, awards and every suspension remaining officer decisions with coded reasons and appeal rights, and a payment lifecycle that renews digitally instead of punishing beneficiaries with queues.

## 2. Scope

**In (Phase 1 of this module):** application and award workflow for the four programmes; recurring payment lifecycle including proof-of-life/renewal, change-of-circumstance reporting, suspension/termination with due process; caregiver delegated access; assisted and outreach channels.
**Out:** NIS contributory benefits (separate statutory body); in-kind support logistics; childcare/difficult-circumstances grants (later phases on the same engine).

## 3. Actors

| Actor | Role |
|---|---|
| Applicant / beneficiary | Applies, renews, reports changes, appeals |
| Caregiver | Acts with delegated authorisation (FR-P1.3) |
| Case officer (probation & welfare) | Means/household verification, home visits, recommendations, flag review |
| Medical board / assessors | Disability determinations — never automated |
| Approving officer / Director | Awards, refusals, suspensions — statutory decisions |
| MHSSS finance operations | Releases payment batches (FR-P3.2) |
| Post Office / banks / MMG | Payment channels |

## 4. Functional Requirements

- **E-FR1 One application.** Programme selector (pension / public assistance / disability / single-parent); age and identity auto-verified via GRO attestation — **a clean 65+ match for old-age pension requires no age documents at all**; household/income declarations only where the programme requires them.
- **E-FR2 Assessment lanes — parallel, human.** Means/household verification by case officers with home visits scheduled via FR-P5 and captured on an offline-capable visit app; **medical board assessment** for disability claims (regional sittings schedulable); single-parent evidence review. Lanes run in parallel against sub-SLAs.
- **E-FR3 Award decisions stay human.** Case-officer recommendation → approving officer/committee decision with mandatory coded reasons and notified appeal rights; awards create recurring payee records on the shared registry with the citizen's channel choice (bank / MMG / post-office collection).
- **E-FR4 Recurring lifecycle.** Payment calendars visible to the beneficiary; **digital life-certificates** completable by biometric/OTP at any counter or outreach visit — replacing pension books; missed-renewal grace periods before any suspension; payment batches prepared by the system and **released by finance operations** (FR-P3.2).
- **E-FR5 Flags are reviewed, never executed.** Death-registration flags from Module B suspend the payment **pending case-officer confirmation** — no automatic termination; change-of-circumstance self-reports adjust entitlements only after officer review.
- **E-FR6 Beneficiary visibility & delegation.** Case history, payment ledger and appeal status visible to the beneficiary; caregiver delegated access for those who cannot self-serve; assisted intake at any regional office with identical workflow.
- **E-FR7 APIs & events (FR-P8).** Application, award, ledger, renewal and payment-status services; webhooks including `benefit.awarded`, `benefit.suspended`, `renewal.completed`; consumes `death.registered` flags from Module B.
- **E-FR8 oneCitizen integration (new).** Publishes tile entries per programme to the FR-P9 catalogue under **Ministry of Human Services & Social Security**; authentication exclusively via **OneIdentity** (FR-P1) including caregiver delegation as OneIdentity relationships; **publishes machine-readable programme eligibility rules (public criteria only)** for the FR-P11.3 suggestion engine (e.g., an explainable old-age-pension prompt at 65) — suggestions never auto-apply and awards remain officer decisions (E-FR3 unchanged); renewal-due reminders (life-certificates) may surface on the FR-P11.1 panel with consent.

## 5. Business Rules

- **E-BR1** Old-age pension is age-based and universal — no means test can be introduced by configuration without a programme-rule change signed off at Permanent Secretary level.
- **E-BR2** No suspension or termination without an officer decision, a written coded reason, and notified appeal rights.
- **E-BR3** Disability determinations require medical board sign-off; the platform schedules and records, never determines.
- **E-BR4** A missed life-certificate enters a grace period with proactive reminders before any suspension task is even created.
- **E-BR5** One person may hold multiple awards only where programme rules permit; overlaps are flagged at screening for officer decision.
- **E-BR6** Caregiver actions are logged distinctly and revocable by the beneficiary at any time.

## 6. Acceptance Criteria (Given/When/Then)

1. *Given* a 65-year-old applicant with a clean GRO match, *when* they apply for old-age pension, *then* no age documents are requested and the case reaches the approving officer within the assessment SLA.
2. *Given* a disability claim, *when* the assessment lanes open, *then* the means verification and the medical-board booking proceed in parallel, each on its own SLA clock.
3. *Given* a home visit completed offline in a hinterland region, *when* the device reconnects, *then* findings and the recommendation sync without loss and the case advances.
4. *Given* a beneficiary completing a digital life-certificate at a regional counter, *when* verified, *then* the next payment proceeds with no physical book required.
5. *Given* a Module B death registration matching a payee, *when* the flag fires, *then* the payment suspends pending review, an officer task is created, and no termination occurs automatically.
6. *Given* a suspension decision, *when* issued, *then* it carries a written coded reason and the beneficiary is notified of appeal rights; absent either, the platform blocks the suspension.

## 7. Integrations & Dependencies

| System | Purpose | Fallback |
|---|---|---|
| GRO / Module B | Age attestation; death flags | Document check + officer review |
| Shared payee registry / FR-P3.2 | Recurring disbursements, release control | Mandatory dependency |
| Post Office | Collection channel & payday scheduling | Bank/MMG channels |
| FR-P5 appointments | Home visits, board sittings, counter renewals | Paper diary interim (pilot only) |
| Module D | Shared dedup across payout programmes | Officer cross-check |

## 8. Assumptions & Risks

Assumes regional counters and outreach teams are equipped for biometric/OTP life-certificates; assumes medical-board regional sittings can be scheduled (a policy/logistics commitment, not just software). Risks: beneficiary digital exclusion is the highest of any module → assisted and outreach channels are core scope with adoption targets; legacy beneficiary rolls may contain duplicates/deceased records → a one-time cleanse with officer adjudication precedes migration; hard cutover from pension books → dual-running with a published sunset per region.
