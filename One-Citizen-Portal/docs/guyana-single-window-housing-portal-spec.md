# Requirements Specification — "One Home Guyana" Single-Window Housing Utilities & Construction Permit Portal

**Document type:** Business & Functional Requirements Specification (BMAD format)
**Version:** 0.1 (Draft for stakeholder review)
**Date:** 13 July 2026
**Jurisdiction:** Co-operative Republic of Guyana
**Sponsoring context:** Aligned with the Government of Guyana's national digitalisation agenda (One Guyana digital services) and the Ministry of Housing and Water's housing drive

---

## 1. Background & Problem Statement

A citizen building or occupying a new house in Guyana today must interact separately with at least five different bodies:

| Need | Current authority | Current process |
|---|---|---|
| Building/construction permission | Central Housing & Planning Authority (CH&PA); Municipal Councils (e.g., Georgetown M&CC City Engineer's Dept.); Neighbourhood Democratic Councils (NDCs) | Paper plans submitted in person; multiple review cycles |
| Water connection & sewerage | Guyana Water Inc. (GWI) | Separate application at GWI office with proof of ownership |
| Electricity connection | Guyana Power & Light Inc. (GPL) | Separate application; wiring certificate (Government Electrical Inspector) required |
| Gas supply | Private LPG distributors today (e.g., cylinder supply); future piped natural gas under the Gas-to-Energy programme | No unified application channel |
| Environmental / drainage clearance (where applicable) | Environmental Protection Agency (EPA); NDIA for drainage reserves | Separate, often unknown to applicants |

Each agency independently requests the same core documents (proof of land tenure — Transport, Certificate of Title, or CH&PA Agreement of Sale/Lease; national ID; TIN; approved building plan), performs its own inspection visit, and issues its own approval on its own timeline. Applicants in new CH&PA housing schemes (e.g., along the East Bank and East Coast Demerara corridors, and in hinterland regions) frequently experience months of cumulative delay, repeated travel to Georgetown, and inconsistent status information.

**Goal:** Deliver a single-window web and mobile portal — working title **"One Home Guyana"** — through which an applicant submits **one application** with **one document set** and **one consolidated fee payment**, and receives:

1. A **Construction Permission Certificate** (building permit), and
2. Provisioned/scheduled **utility connections** (water, sewerage where networked, electricity, gas) tied to the same premise record,

under a **coordinated, parallel approval workflow** with a single tracking number and a defined statutory service-level clock.

---

## 2. Scope

### 2.1 In scope (Phase 1)
- New residential construction (single-family dwellings and duplexes) on titled/leased land, including CH&PA housing scheme allottees.
- Unified intake form, shared document vault, and parallel routing of one application to CH&PA/local authority, GWI, GPL, EPA (conditional), Guyana Fire Service (conditional), and gas providers.
- Single consolidated payment (permit fees + utility connection fees) via local payment rails.
- Joint or coordinated site inspections with a shared inspection calendar.
- Issuance of a digitally signed, QR-verifiable **Construction Permission Certificate** and utility **Connection Orders**.
- Public status tracking, notifications (SMS, email, WhatsApp where feasible), and an agency back-office console per participating body.
- English language UI (official language), with accessibility support.

### 2.2 Out of scope (Phase 1 — candidate for later phases)
- Commercial/industrial buildings, multi-storey (>2 storeys) or buildings requiring structural engineer certification beyond standard review.
- Land titling itself (Deeds Registry / Land Registry / GLSC transactions) — the portal *verifies* tenure, it does not *transfer* it.
- Occupancy/Completion Certificate workflow (Phase 2).
- Piped natural gas distribution onboarding (activated when the Gas-to-Energy distribution network reaches residential service; Phase 1 supports LPG supplier registration and future-proofs the data model).
- Renovation/extension permits, fence and bridge (koker/drainage crossing) permits (Phase 2).

---

## 3. Stakeholders & Participating Agencies

| Code | Body | Role in workflow |
|---|---|---|
| CHPA | Central Housing & Planning Authority | Planning permission & building plan approval outside municipal areas; scheme allotment verification |
| LA | Local Authority (10 Municipalities incl. Georgetown M&CC; 70 NDCs) | Building permit within its jurisdiction; rates & taxes standing check |
| GWI | Guyana Water Inc. | Water connection; sewerage connection (Georgetown sewered area); septic/soak-away compliance elsewhere |
| GPL | Guyana Power & Light Inc. | Electricity service connection; meter installation (DBIS grid areas) |
| GEI | Government Electrical Inspector (Ministry of Public Works) | Electrical wiring certificate prerequisite to GPL connection |
| GAS | Licensed gas suppliers (LPG now; national gas distributor later) | Gas supply setup / cylinder installation compliance |
| EPA | Environmental Protection Agency | Environmental authorisation where triggered (e.g., proximity to waterways, large septic systems) |
| GFS | Guyana Fire Service | Fire safety review (conditional — e.g., duplexes/rental units) |
| NDIA / D&I | National Drainage & Irrigation Authority / local D&I | No-objection for drainage reserves, culvert/bridge access |
| GRA | Guyana Revenue Authority | TIN verification |
| GLSC / Registries | Guyana Lands & Surveys Commission; Deeds & Commercial Registries; Land Registry | Tenure verification (Transport, Title, Lease) |
| MoHW | Ministry of Housing and Water | Programme owner / oversight, KPI dashboards |
| NDMA / e-Gov | National Data Management Authority | Hosting, government network, identity & interoperability standards |

**Primary personas**
1. **Applicant (citizen/homeowner)** — may be a CH&PA allottee, private landowner, or diaspora remigrant applying remotely.
2. **Authorised agent** — draughtsman/architect/engineer or contractor submitting on the applicant's behalf.
3. **Agency reviewing officer** — plan examiner, connections officer, environmental officer.
4. **Inspector** — field officer performing site/wiring/plumbing inspections.
5. **Single-Window Coordinator** — cross-agency case manager who owns SLA escalations.
6. **System administrator / NDMA operator.**

---

## 4. Legal & Regulatory Anchors (to be confirmed with the Attorney General's Chambers)

- Town and Country Planning Act, Cap. 20:01 — planning permission.
- Municipal and District Councils Act, Cap. 28:01 — building by-laws, local building permits.
- Housing Act, Cap. 36:20 — CH&PA powers over housing schemes.
- Guyana Water and Sewerage Act 2002 — GWI connection obligations.
- Electricity Sector Reform Act 1999 (as amended) — GPL licence and connection terms; electrical inspection regulations.
- Environmental Protection Act 1996 — environmental authorisations.
- Guyana National Building Codes (GNBS) — technical standards for plan review.
- Electronic Communications and Transactions legislation / Data Protection Act 2023 — e-signatures, digital records, personal data handling.

**BR-LEGAL-1:** The single-window approval must be structured as *coordinated concurrent approvals* under each agency's existing statutory authority, consolidated into one certificate bundle — unless/until enabling legislation designates a single approving authority.

---

## 5. To-Be Concept of Operations

1. Applicant creates a verified account (National ID or passport + TIN + phone/email OTP).
2. Applicant completes **one unified application** describing the premise (lot, plan, region/NDC, GPS point), tenure evidence, building plans, and selects required utilities (water, sewer/septic, electricity, gas type).
3. Portal runs **pre-screening**: tenure verification, rates standing, jurisdiction resolution (which LA/CHPA office), and conditional-trigger rules (EPA? GFS? NDIA?).
4. One **consolidated fee quote** is generated; applicant pays once (online or at a payment counter with a reference code).
5. Application is **routed in parallel** to all required agencies; each works its lane against a shared SLA clock visible to the applicant.
6. **Joint inspection scheduling**: the portal proposes a shared inspection window; agencies that can co-inspect (LA structural setout, GWI plumbing point, GPL service point) attend one visit where practical.
7. On all approvals: system issues a **digitally signed Construction Permission Certificate** (QR-verifiable) plus **Connection Orders** to GWI/GPL/gas provider with target connection dates.
8. Any single rejection triggers a **unified deficiency notice** — the applicant corrects once, not per agency.

---

## 6. Functional Requirements

### FR-1 Identity, Accounts & Agents
- FR-1.1 Register with National ID number or Guyanese passport number, full name, DOB, TIN (validated against GRA where interface exists; else format-validated with declaration), mobile number (OTP), email (optional but recommended).
- FR-1.2 Support **agent accounts** (architects/draughtsmen/contractors) linked to applicants via a signed digital Letter of Authorisation; agent actions are logged distinctly.
- FR-1.3 Diaspora applicants may register with passport + overseas phone; a local authorised agent is then mandatory for inspections.
- FR-1.4 Role-based access for agency users provisioned by each agency's admin; MFA mandatory for all agency roles.

### FR-2 Unified Application Intake
- FR-2.1 Single dynamic form with sections: Applicant, Premise/Lot, Tenure, Building Details, Utilities Required, Declarations. Conditional sections render based on answers (e.g., septic design only when premise is outside GWI sewered area).
- FR-2.2 **Premise identification** by: Region (1–10), NDC/Municipality, village/scheme name, block & lot number, and a map-pin (GPS) with cadastral overlay where GLSC data is available.
- FR-2.3 Tenure evidence types supported: Transport, Certificate of Title, State/Government Lease, CH&PA Agreement of Sale or Allotment Letter, Amerindian Village Council authorisation (for titled village lands, with Village Council consent workflow).
- FR-2.4 Building details: dwelling type, storeys, footprint & floor area, setbacks, construction type (timber/concrete/mixed), roof, estimated cost, drawings (site plan, floor plans, elevations, structural where required), plumbing layout, electrical layout.
- FR-2.5 Utilities selection: Water (new connection / upgrade), Sewerage (networked) OR on-site sanitation (septic/soak-away design upload), Electricity (single-phase/three-phase, load estimate), Gas (LPG installation compliance / future piped-gas pre-registration).
- FR-2.6 Save-as-draft, resume, and pre-submission completeness check with a human-readable checklist.
- FR-2.7 One submission generates one **Master Application Number (MAN)** of format `OHG-<Region>-<YYYY>-<sequence>` used across all agencies.

### FR-3 Document Vault ("Submit Once")
- FR-3.1 Central per-applicant document vault; each document typed, versioned, virus-scanned, and reusable across applications.
- FR-3.2 Accepted formats: PDF, JPG/PNG, DWG/DXF (plans); max sizes configurable (default 25 MB/file); mobile camera capture supported.
- FR-3.3 Agencies view the same document instance; re-upload requests create a new version, never a parallel copy.
- FR-3.4 Certified-copy handling: documents requiring sight of the original (e.g., Transport) can be flagged "verify original at counter/inspection," without blocking parallel review.

### FR-4 Pre-Screening & Routing Engine
- FR-4.1 Jurisdiction resolver: from lot/GPS, determine the responsible LA or CHPA office; ambiguous cases route to the Single-Window Coordinator queue.
- FR-4.2 Conditional-trigger rules engine (configurable, versioned):
  - EPA review if premise is within X metres of a waterway/conservancy, uses a septic system above capacity Y, or falls in a designated environmentally sensitive area.
  - GFS review if dwelling is a duplex/multi-unit or exceeds configured floor area.
  - NDIA/D&I no-objection if access requires a culvert/bridge over a drainage reserve.
- FR-4.3 On submission, create **one child case per required agency**, all linked to the MAN, each with its own SLA clock and checklist, all visible on one applicant timeline.
- FR-4.4 Duplicate detection on lot number + tenure document to prevent competing applications on the same lot.

### FR-5 Consolidated Fees & Payment
- FR-5.1 Fee engine computes: building permit fee (per LA/CHPA schedule, typically area- or cost-based), GWI connection fee (by service size/zone), GPL connection fee (by phase/load and service span), inspection fees, EPA/GFS fees where triggered — presented as **one itemised quote, one payment**.
- FR-5.2 Payment channels: online card gateway, Mobile Money Guyana (MMG), bank transfer with reference code, and over-the-counter at agency/post-office cashiers (cashier console marks the reference paid).
- FR-5.3 Funds **settlement split** to each agency's account per the itemisation, with reconciliation reports (daily) and an immutable receipt (PDF + QR) to the applicant.
- FR-5.4 Supplemental fees (e.g., re-inspection) are added to the same MAN and payable through the same channels.

### FR-6 Parallel Review Workflow & SLA Management
- FR-6.1 Each agency lane has configurable stages (e.g., LA: Intake Check → Technical/Plan Review → Site Inspection → Decision). Stage checklists are agency-managed.
- FR-6.2 **Statutory clock**: default end-to-end target 30 working days from complete submission to certificate issuance (configurable); per-lane sub-SLAs; clock pauses only on applicant-action states.
- FR-6.3 **Single deficiency cycle**: agency queries are pooled by the Coordinator into one consolidated Request for Correction (RFC) per review round wherever possible; applicant responds once.
- FR-6.4 Escalation: breached sub-SLAs auto-escalate to the agency head and Coordinator; MoHW dashboard shows breach counts by agency/region.
- FR-6.5 Decisions per lane: Approve / Approve with Conditions / Reject (mandatory reason codes + free text). Conditions attach to the final certificate.
- FR-6.6 **Silence-is-consent option (policy flag):** if enabled by regulation, a lane that exceeds its SLA without a decision is deemed approved with standard conditions, logged as such.

### FR-7 Inspections
- FR-7.1 Shared inspection calendar per NDC/region; portal proposes joint windows; applicant confirms; inspectors receive mobile-friendly worklists (offline-capable for hinterland connectivity gaps, syncing when online).
- FR-7.2 Inspection types: site/setout (LA/CHPA), plumbing & meter point (GWI), service point & wiring certificate verification (GEI/GPL), septic siting (EPA/LA), fire (GFS), gas installation (supplier/authority).
- FR-7.3 Inspector app: geotagged photos, checklist pass/fail, e-signature, immediate result posting to the case; failed items generate the deficiency list automatically.
- FR-7.4 Re-inspection booking with fee handling per FR-5.4.

### FR-8 Approvals, Certificate & Connection Orders
- FR-8.1 When all mandatory lanes approve, the system assembles the **Construction Permission Certificate**: certificate number, MAN, applicant, premise/lot, approved plan references (hashed), conditions, validity period (default 2 years to commence construction, configurable), issuing authorities and digital signatures/seals, and a **QR code** resolving to a public verification page.
- FR-8.2 **Connection Orders** auto-dispatch to GWI/GPL/gas provider with premise data, approved plumbing/electrical references, and target connection dates; utilities post scheduled dates back to the timeline.
- FR-8.3 Public **verification endpoint**: anyone scanning the QR sees certificate validity, premise, and status (valid/expired/revoked) — no personal data beyond the applicant's name.
- FR-8.4 Revocation/suspension workflow for authorities (with reason, notice to applicant, audit trail).

### FR-9 Notifications & Tracking
- FR-9.1 Event-driven notifications (submission, payment, RFC, inspection date, decision, certificate ready) via SMS (primary — GTT/Digicel gateways), email, and in-portal; WhatsApp Business as a Phase-1 stretch.
- FR-9.2 Public tracking by MAN + phone-number OTP for applicants without accounts (e.g., counter-assisted submissions).
- FR-9.3 Assisted channel: agency counters and CH&PA outreach events can capture applications on behalf of walk-in citizens (mediated mode), honouring the same workflow.

### FR-10 Back-Office, Reporting & Audit
- FR-10.1 Per-agency console: queues, workload assignment, checklist review, decision recording, template letters.
- FR-10.2 Coordinator console: cross-lane case view, SLA heatmap, consolidated RFC composer, escalation actions.
- FR-10.3 MoHW/NDMA dashboards: volumes by region, median cycle time per lane, first-time approval rate, fee collections, breach analytics; CSV/API export.
- FR-10.4 Immutable audit log of every state change, document access, and decision (who/what/when), retained ≥ 7 years.

### FR-11 Exposed API Platform (headless / API-first)
- FR-11.1 **API-first architecture:** every capability the portal UI uses (application intake, document vault, status, fees/payment, inspections, certificate issuance/verification, connection orders) MUST be implemented as versioned REST/JSON services consumed by the portal's own front end — the UI has no privileged back-door. This guarantees any function available on-screen is equally invokable by an authorised external system.
- FR-11.2 **Consumer classes:** (a) Government service aggregators — explicitly the planned **oneCitizen** single-citizen portal, which must be able to embed or invoke the full applicant journey (submit, upload, pay, track, retrieve certificate) without redirecting users to a separate credential; (b) agency line-of-business systems (GWI/GPL CIS, LA registries) subscribing to case events; (c) approved third parties (banks verifying certificates for mortgage disbursement, architects' practice software submitting on behalf of clients).
- FR-11.3 **Published API catalogue (Phase 1 minimum):**
  - `POST /applications` (create/submit unified application), `GET /applications/{man}` (full status incl. per-lane state & SLA clocks)
  - `POST /applications/{man}/documents`, `GET /documents/{id}` (vault, versioned)
  - `GET /applications/{man}/fees` (itemised quote), `POST /payments` + payment-status callbacks
  - `POST /applications/{man}/inspections/slots` (book/confirm joint windows)
  - `GET /certificates/{certNo}` (authenticated full record) and `GET /verify/{qrToken}` (public, rate-limited verification — same endpoint the QR resolves to)
  - `POST /connection-orders/{id}/status` (utilities post scheduled/actual connection dates)
  - Reference-data APIs: regions/LAs, fee schedules, document-type checklists, rejection reason codes.
- FR-11.4 **Eventing/webhooks:** subscribable events (`application.submitted`, `rfc.issued`, `payment.settled`, `lane.decided`, `inspection.completed`, `certificate.issued`, `certificate.revoked`) so oneCitizen and agency systems receive push notifications rather than polling.
- FR-11.5 **AuthN/AuthZ:** OAuth 2.0 client-credentials for system-to-system; delegated user context (OIDC) **issued by the in-house OneIdentity platform** so oneCitizen can act *as the citizen* — one OneIdentity session, no separate One Home login; mutual TLS on the government interoperability layer; scopes per API family; per-consumer rate limits and quotas.
- FR-11.6 **Governance:** semantic versioning with a minimum 12-month deprecation window; sandbox environment with synthetic data; a developer portal with OpenAPI 3 specifications, onboarding workflow and NDMA approval gate for new consumers; all external calls logged to the audit trail with consumer identity.
- FR-11.7 **Data protection:** API responses are scope-filtered (an agency sees only its lane; oneCitizen sees only the authenticated citizen's records); the public verification endpoint returns no personal data beyond the applicant's name, mirroring FR-8.3.

---

## 7. Data Model (key entities)


- **Applicant** (id, id_type [national_id|passport], id_number, name, dob, tin, phone, email, address, diaspora_flag)
- **Agent** (id, profession, licence_no, linked_applicants[])
- **Premise** (id, region, la_code, scheme/village, block, lot, gps_point, cadastral_ref, sewered_area_flag, grid_area_flag, environmental_zone_flags[])
- **TenureEvidence** (id, premise_id, type [transport|title|lease|chpa_agreement|amerindian_consent], reference_no, registry_verified_flag, document_id)
- **Application (MAN)** (id, applicant_id, agent_id?, premise_id, building_details{}, utilities_requested[], status, submitted_at, sla_target_date)
- **AgencyCase** (id, man_id, agency_code, stage, checklist_state{}, sla_clock, decision, conditions[], officer_id)
- **Document** (id, owner_id, type, version, hash, scan_status, original_verified_flag)
- **FeeQuote / Payment / SettlementSplit** (itemised lines per agency, channel, reference, status, receipt)
- **Inspection** (id, case_id(s)[], type, scheduled_window, inspector_id, geotag, photos[], result, deficiencies[])
- **Certificate** (id, man_id, cert_no, conditions[], valid_from, valid_to, signatures[], qr_token, status)
- **ConnectionOrder** (id, man_id, utility [water|sewer|electricity|gas], provider, target_date, actual_date, status)
- **AuditEvent** (actor, action, entity, timestamp, before/after hash)

---

## 8. Business Rules (selected)

- **BR-1** An application cannot be submitted without at least one valid tenure evidence record for the premise.
- **BR-2** Rates-and-taxes standing check with the LA: arrears do not block submission but must be flagged and may be a certificate condition (policy-configurable).
- **BR-3** Electricity connection order is not released until a valid GEI wiring certificate reference is attached.
- **BR-4** Sewer connection is offered only where `sewered_area_flag = true` (Georgetown sewered zone); otherwise on-site sanitation design is mandatory.
- **BR-5** In Amerindian titled village lands, Village Council consent is a mandatory lane per the Amerindian Act.
- **BR-6** One active MAN per lot; new applications on the same lot require withdrawal or completion of the prior one.
- **BR-7** Certificate expires if construction has not commenced within the validity period; renewal is a lightweight re-validation, not a new application.
- **BR-8** All fees are due before parallel review begins, except LAs that legally require decision-then-payment — the fee engine supports both sequencing modes per agency.
- **BR-9** Every rejection must carry at least one coded reason from a controlled vocabulary (reportable).
- **BR-10** Personal data handling per the Data Protection Act 2023: purpose limitation, agency access limited to their lane's needs, applicant right of access to their own record.

---

## 9. Integrations

Integration is two-directional: the portal **consumes** external services (table below) and **exposes** its own capabilities per FR-11 — the same interoperability layer serves both. The planned **oneCitizen** portal is a first-class consumer: it integrates via the FR-11.3 APIs and FR-11.4 events under delegated OneIdentity citizen context (FR-11.5), appears as a tile under the **Ministry of Housing and Water** in the oneCitizen catalogue (FR-P9), and its fee quotes may surface on the oneCitizen reminders panel (FR-P11.1) with consent — so the One Home journey surfaces inside oneCitizen without rework.

| System | Direction | Purpose | Fallback |
|---|---|---|---|
| GRA TIN service | Query | TIN validity | Format check + declaration |
| Deeds/Land Registry, GLSC cadastre | Query | Tenure & lot verification, map overlay | Manual registry verification queue |
| GWI billing/CIS | Two-way | Premise/account creation, connection scheduling | Emailed connection-order PDF + manual status entry |
| GPL CIS | Two-way | Service order, meter allocation | Same fallback pattern |
| Payment gateway / MMG / banks | Two-way | Collection & settlement | OTC cashier console |
| SMS gateways (GTT, Digicel) | Push | Notifications | Email/in-portal |
| National ID verification (GRO/NDMA when available) | Query | Identity assurance uplift | Document upload + counter verification |

All integrations via a government interoperability layer (REST/JSON APIs, mutual TLS), with every external call logged.

---

## 10. Non-Functional Requirements

- **Availability:** 99.5% monthly; maintenance windows announced.
- **Performance:** page loads ≤ 3 s on 3G-class connections; the mobile web app must be usable at low bandwidth; inspector app offline-first.
- **Capacity (initial):** 20,000 applications/year, 300 concurrent users, growth headroom 5×.
- **Hosting:** NDMA government data centre or approved sovereign cloud; data residency in Guyana; DR with RPO ≤ 1 hour, RTO ≤ 8 hours.
- **Security:** OWASP ASVS L2; MFA for agency users; encryption in transit (TLS 1.2+) and at rest; document store with hash integrity; annual penetration test.
- **Accessibility:** WCAG 2.1 AA; plain-English guidance; assisted-channel parity.
- **Auditability:** append-only audit log; certificate signing via national PKI or HSM-backed keys.
- **Browser/device:** modern browsers + Android-dominant mobile reality; no app-store dependency for applicants (PWA).

---

## 11. Acceptance Criteria (Given/When/Then — representative set)

1. **Single submission** — *Given* a verified applicant with tenure evidence, *when* they submit the unified form with all mandatory documents, *then* one MAN is created and child cases are opened for exactly the agencies determined by the routing rules, and the applicant sees all lanes on one timeline.
2. **One payment** — *Given* a generated fee quote covering LA, GWI and GPL items, *when* the applicant pays via MMG, *then* a single receipt is issued, each agency's lane shows "fees settled," and settlement records show the correct split.
3. **Consolidated deficiency** — *Given* two agencies raise queries within the same review round, *when* the Coordinator issues the RFC, *then* the applicant receives one combined notice and one resubmission clears both queries' checklist items.
4. **Joint inspection** — *Given* LA and GWI both require site visits, *when* the portal proposes a joint window and the applicant confirms, *then* both inspectors receive the same appointment and both results post to their respective lanes from one visit.
5. **Certificate issuance** — *Given* all mandatory lanes are approved, *when* the final approval is recorded, *then* the Construction Permission Certificate is generated within 1 working day, digitally signed, QR-verifiable on the public endpoint, and Connection Orders are dispatched to GWI and GPL automatically.
6. **Conditional EPA trigger** — *Given* a premise pinned within the configured buffer of a waterway, *when* the application is submitted, *then* an EPA lane is opened automatically and the certificate cannot issue without its decision.
7. **Wiring-certificate gate** — *Given* an approved application without a GEI wiring certificate reference, *when* GPL attempts to schedule connection, *then* the system blocks the connection order and notifies the applicant of the outstanding prerequisite.
8. **SLA breach visibility** — *Given* a lane exceeds its sub-SLA, *when* the breach occurs, *then* an escalation is logged, the agency head and Coordinator are notified, and the MoHW dashboard reflects the breach within 15 minutes.
9. **Verification** — *Given* an issued certificate, *when* anyone scans its QR code, *then* the public page shows certificate number, premise lot, validity status and issuing authorities, and nothing else about the applicant beyond name.
10. **Offline inspection** — *Given* an inspector in a low-connectivity area, *when* they complete a checklist offline, *then* results and geotagged photos sync automatically on reconnection without data loss.
11. **API parity** — *Given* an authorised system client with the correct scopes, *when* it submits an application, uploads documents, retrieves the fee quote and polls status via the published APIs, *then* the resulting MAN, lanes and timeline are identical to a portal-UI submission, and the audit log records the consumer identity on every call.
12. **oneCitizen delegated access** — *Given* a citizen authenticated in oneCitizen via OneIdentity, *when* oneCitizen invokes `GET /applications/{man}` with delegated user context, *then* only that citizen's applications are returned, and a `certificate.issued` webhook subscribed by oneCitizen is delivered within 60 seconds of issuance.
13. **API versioning safety** — *Given* a deployed v1 consumer, *when* a v2 of an API is released, *then* v1 continues to function unchanged throughout the published deprecation window and the sandbox exposes both versions.

---

## 12. Assumptions, Dependencies & Risks

**Assumptions**
- Participating agencies agree to a shared SLA framework and joint-inspection protocol (an inter-agency MOU is a prerequisite).
- Fee schedules can be codified per agency and per LA; where by-laws differ across 80+ local authorities, the fee engine is configuration-driven.
- NDMA provides hosting, SMS gateway contracts, and (eventually) national ID verification.

**Dependencies**
- Registry/GLSC data access agreements for tenure verification (Phase 1 can operate with manual verification queues).
- GWI and GPL API readiness; fallback manual integration defined above.
- Legal confirmation of e-signature validity for certificates and of any silence-is-consent rule.

**Key risks**
- *Institutional:* agencies retaining parallel paper channels undermines the single window → mitigate with a policy sunset date for paper intake in pilot regions.
- *Data quality:* cadastral gaps in hinterland regions → GPS-pin plus manual verification path.
- *Connectivity:* applicants and inspectors in Regions 1, 7, 8, 9 → assisted counters, offline-first inspector app.
- *Change management:* officer training and dual-running period per agency.

**Suggested phasing:** Pilot in one municipality (e.g., Georgetown M&CC) plus one high-volume CH&PA scheme corridor (East Bank Demerara), then national rollout by region.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| MAN | Master Application Number — the single tracking ID |
| CH&PA | Central Housing & Planning Authority |
| NDC | Neighbourhood Democratic Council (local authority) |
| GWI / GPL | Guyana Water Inc. / Guyana Power & Light Inc. |
| GEI | Government Electrical Inspector |
| RFC | Request for Correction (consolidated deficiency notice) |
| Lane | One agency's child case within the parallel workflow |
| Transport / Title | Forms of registered land ownership in Guyana |
| OTC | Over the counter (cashier payment) |
