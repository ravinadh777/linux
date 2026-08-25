# Requirements Specification — Module F: Cross-Government Appointments

**Ministry / Agency:** All Ministries (programme owner: NDMA / Office of the Prime Minister; each ministry owns its own service directory and capacity)
**Document type:** Business & Functional Requirements Specification (BMAD format)
**Version:** 0.1 (Draft for stakeholder review) · **Date:** 13 July 2026
**Depends on:** oneCitizen Shared Platform Layer spec — this module is the citizen-facing product of the shared appointments engine (FR-P5) that also powers passport biometrics (Module A), GRO original-sighting and collections (Module B), driving tests (Module C) and benefit home visits (Module E).

---

## 1. Background

Government offices run on a walk-in-only culture: citizens queue from dawn to be safe, learn the document requirements only at the counter, are turned away for missing papers (worst for hinterland citizens who travelled days), stand in unordered physical lines, and ministries have no data on demand or service times. A missed date restarts the whole process.

**Goal:** one booking experience across every participating ministry — know what to bring before travelling, book a real slot, check in by QR, and give every ministry demand data — **without ever locking out the offline citizen**, via mandatory walk-in reserve quotas.

## 2. Scope

**In (Phase 1):** service directory across participating ministries; slot/capacity management; booking, rescheduling, cancellation; reminders with prerequisite checklists; QR check-in, live queue position and priority lanes; officer day-list console; per-ministry analytics; account-less booking.
**Out (Phase 1):** video/tele-appointments; paid appointment types; inter-ministry referral chaining (Phase 2).

## 3. Actors

| Actor | Role |
|---|---|
| Citizen | Finds the service, books, checks in, attends, rates |
| Ministry service desk | Publishes services, slot templates, quotas, blackout dates |
| Service officer | Works the day list, delivers, records completion |
| Front-desk / queue marshal | Check-in kiosk oversight, priority-lane management |
| Other modules (A/B/C/E) | Embedded booking consumers via FR-P8 APIs |

## 4. Functional Requirements

- **F-FR1 Service directory.** Every participating ministry publishes bookable services with location, prerequisites checklist, documents-to-bring and expected duration; searchable by service, ministry and nearest office; visible **before** booking so citizens never travel uninformed.
- **F-FR2 Slot & capacity management.** Per office/counter/officer slot templates, durations, blackout dates and **walk-in reserve quotas at or above a configurable mandatory floor**; capacity is a published management decision, not an accident of the queue.
- **F-FR3 Booking lifecycle.** Book, reschedule, cancel; a reschedule returns the freed slot to inventory immediately; account-less booking with phone + OTP (FR-P1 Level 1) so no one is forced to register to see a ministry; one appointments view across every ministry for signed-in citizens.
- **F-FR4 Reminders & preparation.** 48-hour and 2-hour reminders carrying the prerequisite checklist; channel consent honoured platform-wide (FR-P4); no-show tracking with configurable rebooking rules.
- **F-FR5 Check-in & queue.** QR/reference check-in kiosk; live queue position on the citizen's phone; priority lanes (elderly, disabled, booked vs walk-in); walk-ins admitted through the reserve quota.
- **F-FR6 Officer console.** Day list with check-in status; service-completion recording feeding SLA and demand analytics.
- **F-FR7 Analytics per ministry.** Demand heatmaps, no-show rates, average service times — informing staffing and slot templates; programme-level rollups per FR-P6.
- **F-FR8 APIs & events (FR-P8).** Directory, slots, booking, check-in and completion services consumed by Modules A/B/C/E and approved external systems; webhooks including `appointment.booked`, `appointment.rescheduled`, `appointment.checked_in`, `appointment.completed`.
- **F-FR9 oneCitizen integration.** Appears as the **All Ministries — Appointments** tile in the FR-P9 catalogue; authentication via **OneIdentity** for signed-in citizens while account-less phone+OTP booking remains (FR-P1 Level 1); the AGUI assistant may find and book slots conversationally with the citizen's explicit confirm (FR-P10); upcoming appointments may surface as FR-P11 sidebar reminders.

## 5. Business Rules

- **F-BR1** Walk-in reserve quotas are mandatory at or above the configured floor per office — digital booking must never exclude offline citizens.
- **F-BR2** A citizen's appointment data is visible only to the ministry being visited; the cross-ministry "one view" belongs to the citizen alone.
- **F-BR3** Reminder consent is per channel; opt-out is honoured platform-wide.
- **F-BR4** No-show handling is configurable per service but may never blacklist a citizen from booking outright.
- **F-BR5** Embedded bookings from other modules draw on the same inventory and quotas — no module gets hidden priority over citizens booking directly.

## 6. Acceptance Criteria (Given/When/Then)

1. *Given* a citizen booking a CI&PO biometric slot from Module A, *when* confirmed, *then* the appointment appears in their one appointments view alongside any other ministry bookings.
2. *Given* a fully booked digital calendar, *when* a walk-in arrives, *then* the walk-in reserve quota still admits them to the queue.
3. *Given* a reschedule three days out, *when* completed, *then* the freed slot returns to inventory immediately and reminders re-arm for the new time.
4. *Given* an account-less citizen with only a phone number, *when* they book via OTP, *then* the booking, reminders and QR check-in all function without an account.
5. *Given* a service's prerequisites published in the directory, *when* the citizen views the booking, *then* the documents-to-bring checklist is visible before confirmation and repeated in reminders.
6. *Given* a month of completions recorded, *when* the ministry opens analytics, *then* demand heatmaps, no-show rates and average service times are available per office and per service.

## 7. Integrations & Dependencies

| System | Purpose | Fallback |
|---|---|---|
| FR-P5 engine | This module productises it | N/A — same component |
| Modules A/B/C/E | Embedded booking consumers | Direct booking remains |
| FR-P4 notifications | Reminders | In-portal only |
| Kiosk hardware / QR | Check-in | Reference-number check-in at desk |

## 8. Assumptions & Risks

Assumes each participating ministry commits a service-desk owner to maintain its directory and slot templates — the module fails on stale capacity data, so directory freshness is a per-ministry KPI. Risks: quota floors set too low in practice → floor is centrally mandated, not ministry-discretionary; kiosk vandalism/failure at busy offices → desk fallback check-in always available; uneven ministry onboarding → publish a visible coverage roadmap so citizens know which offices are bookable.
