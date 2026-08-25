# Requirements Specification — Module C: GRA Revenue Services

**Ministry / Agency:** Guyana Revenue Authority (GRA)
**Document type:** Business & Functional Requirements Specification (BMAD format)
**Version:** 0.1 (Draft for stakeholder review) · **Date:** 13 July 2026
**Service lines in scope (as requested):** TIN registration · Income tax filing · Motor vehicle licences · Driver's licences · Import/duty payments
**Depends on:** oneCitizen Shared Platform Layer spec (FR-P1–FR-P11, incl. OneIdentity per FR-P1); Module B (GRO) attestations; existing GRA systems — notably the current GRA e-services platform and **ASYCUDA World** (customs), which this module **integrates and extends rather than replaces**.

---

## 1. Background

Each GRA service today is its own registration, counter and queue: paper returns re-keyed by staff, assessment cycles by letter with refunds taking months, test-and-licence queues at the Licence Revenue Office with return visits just to learn results, separate cashiers per fee, and brokers physically shuttling customs paperwork. GRA already operates e-services and ASYCUDA World — **the first discovery task is an inventory of what exists, so this module extends rather than duplicates.**

**Goal:** one TIN-anchored taxpayer account and ledger through which every service line is filed, assessed, paid and issued — with assessments, driving tests, licence approvals, refund releases and customs clearance staying with GRA officers.

## 2. Scope

**In (Phase 1 unless phased below):**
- (a) **TIN registration** — individuals and businesses.
- (b) **Income tax filing** — PAYE reconciliation and self-employed returns; assessments; refunds. *(Phase 3 candidate per platform phasing.)*
- (c) **Motor vehicle licences** — registration renewal with fitness/insurance checks.
- (d) **Driver's licences** — provisional, new, renewal; written/practical test scheduling.
- (e) **Import/duty payments** — declaration-linked assessments and payments via ASYCUDA integration. *(Phase 3 candidate.)*
**Out (Phase 1):** VAT/PAYE employer filing suites, objections & appeals case management, property tax — later phases.

## 3. Actors

| Actor | Role |
|---|---|
| Taxpayer / citizen | Registers, files, applies, pays |
| Licensed customs broker / agent | Delegated access (FR-P1.3) |
| GRA tax officer | Assessments of flagged/complex returns; batch review of provisional assessments |
| LRO examiner | Written & practical driving tests |
| LRO officer | Licence approvals; in-person biometric photo |
| Customs officer | Declaration clearance in ASYCUDA |
| GRA finance officer | Refund release (FR-P3.2 pattern) |

## 4. Functional Requirements

- **C-FR1 TIN as the tax identity.** Issuance with identity verified via FR-P1 + GRO attestation; blocking duplicate check; the TIN anchors every service and the single taxpayer ledger.
- **C-FR2 Guided filing.** Income tax returns pre-filled from employer PAYE data where available; vault for supporting schedules. **Straightforward returns receive a rule-based provisional assessment that an officer batch-reviews before finalisation; flagged/complex returns are assessed by a GRA officer.**
- **C-FR3 Risk rules flag; officers decide.** Anomaly flags route to officers with full ledger context; refunds are prepared and reconciled by the system and **released by an authorised GRA finance officer** — never auto-paid.
- **C-FR4 Motor vehicle licence renewal.** Vehicle lookup; fitness certificate and insurance validity checks (insurer API or upload); fee computation; digital licence with QR plus printed disc via collection or courier.
- **C-FR5 Driver's licence.** Eligibility and prior-record check; written/practical test booking via FR-P5; examiner records results in the officer app on site; **LRO officer approves**; biometric photo captured in person; digital + card licence issuance.
- **C-FR6 Import/duty.** Declaration reference pulled from ASYCUDA; consolidated duty + VAT quote; payment via FR-P3.1 with receipt posted back to ASYCUDA within 5 minutes for release; broker delegated access throughout.
- **C-FR7 One taxpayer ledger.** Filings, assessments, licences, payments and compliance status in one view; compliance certificate requests from the ledger.
- **C-FR8 One payment.** A consolidated quote may span services (tax due + licence fee + duty) in a single payment with per-line settlement (FR-P3.1).
- **C-FR9 APIs & events (FR-P8).** Filing, assessment-status, licence, payment and ledger services; webhooks including `return.filed`, `assessment.finalised`, `licence.issued`, `duty.paid`; TIN/compliance-status attestation consumed by Module D relief programmes (scope-limited).
- **C-FR10 oneCitizen integration.** Publishes tile entries per service line to the FR-P9 catalogue under **Guyana Revenue Authority**; authentication exclusively via **OneIdentity** (FR-P1) — no module login; AGUI-guided filing and applications under delegated OneIdentity context with explicit citizen confirm (FR-P10).
- **C-FR11 Obligations feed (new — feeds FR-P11.1).** Exposes the citizen's outstanding government dues — licence renewals falling due, assessed tax outstanding, unpaid duty — via a consent-gated obligations API consumed by the oneCitizen reminders panel with pay-now deep links (FR-P3.1); the panel displays and enables payment only, and disputes route to GRA's own channels.

## 5. Business Rules

- **C-BR1** One TIN per person/entity — duplicate detection at registration is blocking.
- **C-BR2** No motor vehicle licence without valid insurance and fitness where required by vehicle class.
- **C-BR3** Practical driving tests, examiner sign-off and licence approvals are never automated.
- **C-BR4** Customs release requires both payment confirmation and customs officer clearance in ASYCUDA.
- **C-BR5** Provisional assessments are not final until officer batch review completes; the taxpayer sees the distinction on the ledger.
- **C-BR6** Refund release requires a named finance officer's action, logged with identity.

## 6. Acceptance Criteria (Given/When/Then)

1. *Given* a salaried filer with employer-submitted PAYE data, *when* they open the return, *then* income fields are pre-filled and a compliant return can be completed and submitted in one session.
2. *Given* an anomaly flag on a return, *when* the tax officer reviews, *then* the ledger context is attached and the officer's adjust/confirm decision carries a coded reason.
3. *Given* a passed practical test recorded by the examiner, *when* the LRO officer approves, *then* the digital licence issues immediately and the card queues for production.
4. *Given* a vehicle with lapsed insurance, *when* renewal is attempted, *then* the licence is blocked with the exact failing check named.
5. *Given* an ASYCUDA declaration reference, *when* duty is paid on the platform, *then* payment status posts back to ASYCUDA within 5 minutes and the broker sees release status.
6. *Given* a prepared refund batch, *when* no finance officer has released it, *then* no refund instruction leaves the platform.

## 7. Integrations & Dependencies

| System | Purpose | Fallback |
|---|---|---|
| Existing GRA e-services | Reuse/extend current capabilities | Inventory task decides per capability |
| ASYCUDA World | Declarations & payment post-back | File-based exchange interim |
| Employer PAYE submissions | Return pre-fill | Blank guided return |
| Insurers | Insurance validity | Certificate upload + officer check |
| GRO / Module B | Identity attestation for TIN | Document upload + counter verification |
| FR-P5 appointments | Test bookings | LRO counter scheduling |

## 8. Assumptions & Risks

**To confirm with GRA first:** the current e-services capability inventory and which ASYCUDA integration points (references, receipts, release status) are exposed. Risks: parallel running of legacy counters undermines adoption → sunset plan per service line; insurer API readiness varies → upload fallback from day one; examiner app connectivity at test routes → offline-first with sync.
