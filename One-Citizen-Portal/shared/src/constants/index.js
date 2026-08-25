// Shared contract constants (configuration, not feature logic).
// Consumed by both backend (RBAC, events) and frontend (guards, labels).

/** RBAC role keys — see PRD §4.1 */
export const ROLES = Object.freeze({
  CITIZEN: 'citizen',
  AGENT: 'agent',
  OFFICER_INTAKE: 'officer.intake',
  OFFICER_ADJUDICATOR: 'officer.adjudicator',
  OFFICER_SUPERVISOR: 'officer.supervisor',
  OFFICER_INSPECTOR: 'officer.inspector',
  OFFICER_VERIFICATION: 'officer.verification',
  OFFICER_AUTHORISING: 'officer.authorising',
  OFFICER_FINANCE: 'officer.finance',
  OFFICER_SERVICEDESK: 'officer.servicedesk',
  OFFICER_MARSHAL: 'officer.marshal',
  COORDINATOR: 'coordinator',
  PROGRAMME_ADMIN: 'programme.admin',
  OVERSIGHT: 'oversight',
  SYSADMIN: 'sysadmin',
});

/** Assurance levels — FR-P1 */
export const ASSURANCE = Object.freeze({ LEVEL_1: 1, LEVEL_2: 2 });

/** Module codes */
export const MODULES = Object.freeze({
  A: 'passports',
  B: 'civil-registration',
  C: 'revenue',
  D: 'grants',
  E: 'benefits',
  F: 'appointments',
  G: 'one-home',
});

/** Domain event names (FR-P8 / per-module SPEC lists) */
export const EVENTS = Object.freeze({
  // Module A
  PASSPORT_SUBMITTED: 'passport.application.submitted',
  PASSPORT_ADJUDICATED: 'passport.adjudicated',
  PASSPORT_ISSUED: 'passport.issued',
  // Module B
  RECORD_REGISTERED: 'record.registered',
  RECORD_CORRECTED: 'record.corrected',
  RECORD_ISSUED: 'record.issued',
  DEATH_REGISTERED: 'death.registered',
  // Module C
  RETURN_FILED: 'return.filed',
  ASSESSMENT_FINALISED: 'assessment.finalised',
  LICENCE_ISSUED: 'licence.issued',
  DUTY_PAID: 'duty.paid',
  // Module D
  ENROLMENT_RECEIVED: 'enrolment.received',
  CASE_FLAGGED: 'case.flagged',
  BATCH_RELEASED: 'batch.released',
  PAYMENT_SETTLED: 'payment.settled',
  // Module E
  BENEFIT_AWARDED: 'benefit.awarded',
  BENEFIT_SUSPENDED: 'benefit.suspended',
  RENEWAL_COMPLETED: 'renewal.completed',
  // Module F
  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_RESCHEDULED: 'appointment.rescheduled',
  APPOINTMENT_CHECKED_IN: 'appointment.checked_in',
  APPOINTMENT_COMPLETED: 'appointment.completed',
  // Module G
  APPLICATION_SUBMITTED: 'application.submitted',
  RFC_ISSUED: 'rfc.issued',
  LANE_DECIDED: 'lane.decided',
  INSPECTION_COMPLETED: 'inspection.completed',
  CERTIFICATE_ISSUED: 'certificate.issued',
  CERTIFICATE_REVOKED: 'certificate.revoked',
  // Cross-cutting application lifecycle (shared by the citizen portal + back-office).
  APPLICATION_ASSIGNED: 'application.assigned',
  APPLICATION_REVIEWED: 'application.reviewed',
  APPLICATION_APPROVED: 'application.approved',
  APPLICATION_REJECTED: 'application.rejected',
});

/** Application workflow statuses (citizen submits → officer works the case). */
export const APPLICATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
});

/** Standard error codes → see docs/API.md §3 and backend/lib/errors */
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  STEP_UP_REQUIRED: 'STEP_UP_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE: 'DUPLICATE',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTEGRATION_UNAVAILABLE: 'INTEGRATION_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
});

/** Payment channels — FR-P3.1 */
export const PAYMENT_CHANNELS = Object.freeze(['card', 'mmg', 'bank', 'counter']);

/** Guyana administrative regions 1–10 */
export const REGIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Citizen profile field keys — the ONE list both sides must agree on.
 *
 * WHY THIS LIVES IN `shared` RATHER THAN IN EITHER APP.
 * The backend's identity service uses this as a strict allow-list: anything the
 * client sends that is NOT in the list is silently dropped before the user record
 * is written. The frontend uses it to decide which fields to collect. If the two
 * copies drift, the failure is silent and expensive — registration appears to
 * succeed, the citizen believes their details are stored, and the field is simply
 * gone. There is no error to notice, and it only surfaces later as an application
 * form that will not prefill.
 *
 * Keeping the keys here makes drift impossible: both packages already depend on
 * @onecitizen/shared, and identity.service.js derives its allow-list from this
 * export while frontend/src/features/auth/userFields.js is asserted against it.
 *
 * The list is the union of every REUSABLE field across the portal's application
 * forms. Per-application answers (copies, purpose, collection office, delivery
 * method) are deliberately absent — those belong on the application, not the person.
 */
export const PROFILE_FIELD_KEYS = Object.freeze([
  // Personal identity
  'title', 'dob', 'gender', 'nationalId', 'tin', 'occupation', 'maritalStatus',
  'placeOfBirth', 'countryOfBirth', 'mothersMaidenName',
  // Name parts — the identity forms split the name, and deriving it from a single
  // string gets compound surnames wrong.
  'surname', 'givenNames', 'otherNames',
  // Parentage — birth certificate, passport, citizenship.
  'fathersName', 'fathersBirthplace', 'mothersName', 'mothersBirthplace',
  // Nationality / citizenship.
  'presentNationality', 'nationalityAtBirth', 'citizenshipBy',
  // Physical description — driver's licence and passport.
  'height', 'eyeColour', 'complexion', 'bloodGroup', 'organDonor',
  // Contact + address
  'phone', 'lot', 'street', 'village', 'region', 'mailingAddress',
  // Employment + income — pension, public assistance, cash grant.
  'employmentStatus', 'employerName', 'employerAddress', 'monthlySalary', 'sourceOfIncome',
  // Household — means-tested programmes.
  'householdSize', 'dependents',
  // Payout details. Recognition data ONLY: no full account number and nothing that
  // could be used to move money — that belongs with a payment processor.
  'payoutChannel', 'bankName', 'bankBranch', 'accountReference',
  // Next of kin
  'nextOfKin', 'nextOfKinRelationship', 'nextOfKinPhone',
  // Emergency contact — a DISTINCT person from next of kin on the licence and
  // passport forms, so it gets its own fields rather than being conflated.
  'emergencyName', 'emergencyRelationship', 'emergencyPhone', 'emergencyAddress',
]);
