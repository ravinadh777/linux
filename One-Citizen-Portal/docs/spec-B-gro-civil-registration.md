# Requirements Specification — Module B: Birth, Death & Marriage Certificates

**Ministry / Agency:** Ministry of Home Affairs — General Register Office (GRO)
**Document type:** Business & Functional Requirements Specification (BMAD format)
**Version:** 0.1 (Draft for stakeholder review) · **Date:** 13 July 2026
**Capabilities in scope (as requested):** New registration · Changes/corrections · Certified reissue
**Depends on:** oneCitizen Shared Platform Layer spec (FR-P1–FR-P11, incl. OneIdentity per FR-P1)
**Consumed by:** Modules A (passports), C (GRA), D (grants), E (benefits) via attestation APIs — this module is the data foundation of the platform.

---

## 1. Background

Citizens travel to the GPO in Georgetown or a regional office, face a different counter and form per request type, pay search and copy fees in separate queues, and wait weeks for manual ledger searches on older records. Corrections require affidavits and repeat visits; certificates are produced centrally and collected in person, with no way to verify authenticity afterwards.

**Goal:** one type-aware request flow (new / correction / reissue) with automated index matching and parallel source-institution confirmation; registrar determinations remaining human; same-day digitally signed extracts with QR verification; and every verified record published as a reusable attestation for the rest of government.

## 2. Scope

**In (Phase 1):**
- **New registration:** late birth registration; death registration; marriage returns from marriage officers.
- **Changes/corrections:** clerical corrections; name additions; corrections of substance requiring statutory declaration and Registrar General/Deputy approval.
- **Certified reissue:** certified copies; apostille-ready extracts; third-party requests with entitlement rules.
**Out (Phase 1):** adoptions, legitimation, divorce records (court-sourced); bulk genealogical search.

## 3. Actors

| Actor | Role |
|---|---|
| Applicant / entitled third party | Requests, pays, receives (entitlement: self, parent/child, legal representative) |
| Registrar | Statutory approval of registrations, clerical corrections and copies |
| Registrar General / Deputy | Sign-off on corrections of substance |
| Registry staff | Manual search fallback on legacy ledgers |
| Source institutions | Hospitals, medical practitioners, marriage officers — confirm source records |
| Regional GRO / district offices | Assisted intake (FR-P1.4) |

## 4. Functional Requirements

- **B-FR1 One request flow.** Type selector (new / correction / reissue) driving a dynamic evidence checklist per type (e.g., hospital notification or statutory declaration for late birth registration; medical certificate of cause of death; marriage officer's return); entitlement check up front for third-party requests.
- **B-FR2 Registry search & match.** Automated fuzzy search of the digitised index (name, date, place, entry number) with duplicate detection; unmatched requests route to a manual search queue with the search fee itemised in the same single payment (FR-P3.1).
- **B-FR3 Source-record confirmation — parallel lane.** Where a source institution exists, confirmation runs in parallel with the index search: institutions confirm particulars or flag discrepancies through their own portal accounts (or the assisted channel), tracked against a sub-SLA.
- **B-FR4 Registrar decision — human, always.** Registrars approve registrations, clerical corrections and copies; corrections of substance auto-escalate to the Registrar General/Deputy with the statutory declaration attached; refusals carry coded reasons and appeal guidance (FR-P6).
- **B-FR5 Dual-format issuance.** On approval: a digitally signed PDF extract with QR issued immediately, plus a security-printed certificate queued for production; public `GET /verify/{qrToken}` endpoint confirms validity and entry particulars only.
- **B-FR6 Attestation publishing.** Every verified record becomes reusable attested data (FR-P2.2) consumable by Modules A, C, D, E with citizen consent — an attestation, never a document copy.
- **B-FR7 Regional access.** Requests capturable at any regional GRO/district office in assisted mode; production centralised with tracked dispatch or booked collection (FR-P5).
- **B-FR8 APIs & events (FR-P8).** Request, status, attestation and verification services; webhooks including `record.registered`, `record.corrected`, `record.issued`, and `death.registered` (consumed by Modules D/E payee screening).
- **B-FR9 oneCitizen integration.** Publishes its tile entry to the FR-P9 catalogue under **Ministry of Home Affairs**; authentication exclusively via **OneIdentity** (FR-P1) — no module login; the AGUI assistant may guide and pre-fill requests under delegated OneIdentity context, with the citizen's explicit confirm before submission (FR-P10); age attestations additionally serve the FR-P11.3 eligibility engine for the citizen's own record.

## 5. Business Rules

- **B-BR1 Corrections annotate, never overwrite.** The original entry is preserved; corrections are annotations carrying the authorising officer, instrument and date.
- **B-BR2 Entitlement for third parties.** Reissue by a third party requires demonstrated entitlement; rules configurable per record type.
- **B-BR3 Death flags are flags.** A death registration flags dependent payee records via Module D/E APIs — benefit or payout stoppage is always a human decision in the consuming module.
- **B-BR4** A no-trace result is a formal outcome with a coded reason, not a silent dead end; the search fee disposition follows policy configuration.
- **B-BR5** Digital extracts and printed certificates carry the same legal standing per the Electronic Communications and Transactions framework — to be confirmed with the Attorney General's Chambers.

## 6. Acceptance Criteria (Given/When/Then)

1. *Given* a certified-copy request that auto-matches a unique index entry, *when* the registrar approves, *then* the digital extract issues same-day and the printed copy dispatches with tracking.
2. *Given* a correction of substance submitted without a statutory declaration, *when* the applicant attempts submission, *then* the platform blocks it and lists the exact missing instrument.
3. *Given* an approved correction, *when* the record is viewed, *then* the original entry remains intact with the annotation, officer, instrument and date visible.
4. *Given* a request needing hospital confirmation, *when* submitted, *then* the index search and the hospital confirmation proceed in parallel, each with its own SLA clock.
5. *Given* an issued digital extract, *when* its QR is scanned publicly, *then* the page confirms validity and entry particulars only — no further personal data.
6. *Given* a death registration matching an active pension payee, *when* the event fires, *then* Module E receives the flag and no payment stops until a Module E officer confirms.

## 7. Integrations & Dependencies

| System | Purpose | Fallback |
|---|---|---|
| Digitised GRO index | Automated matching | Manual ledger search queue |
| Source institutions | Confirmations | Assisted-channel capture |
| FR-P3 payments | One itemised payment | OTC cashier |
| FR-P5 appointments | Collection booking, original sighting | Walk-in |
| Modules A/C/D/E | Attestation consumers | N/A (producer side) |

## 8. Assumptions & Risks

**Critical assumption:** index digitisation is sufficiently advanced for automated matching; if coverage is partial, a digitisation workstream precedes automation and B-FR2 falls back to manual queues by era/region. Risks: legacy record quality (spelling variants, damaged ledgers) → fuzzy matching thresholds tuned with registry staff and a data-cleansing programme; marriage-officer digital adoption → assisted capture as interim.
