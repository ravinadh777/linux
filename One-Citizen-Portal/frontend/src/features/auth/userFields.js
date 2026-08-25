// ─────────────────────────────────────────────────────────────────────────────
// SINGLE source of truth for the citizen's self-service profile (everything besides
// email and password). RegisterPage and ProfilePage both render from this list, and
// backend/src/platform/identity/identity.service.js persists exactly these keys — so
// registration, GET /me and profile edits stay in lockstep.
//
// ── HOW THIS LIST WAS CHOSEN ─────────────────────────────────────────────────
// It is the union of every REUSABLE field across the 13 service form definitions in
// features/apply/forms/*. The whole point of asking at registration is that AskGov
// can then prefill any application from the stored profile instead of asking the
// same question a fourth time.
//
// Fields specific to one APPLICATION rather than to the PERSON are deliberately
// excluded — `copies`, `purpose`, `collectionOffice`, `deliveryMethod`,
// `processingType`, `reason`. Storing those on the profile would mean prefilling a
// previous, unrelated request's answer into a new form, which is worse than leaving
// it blank.
//
// ── REQUIRED vs OPTIONAL ─────────────────────────────────────────────────────
// `required: true` marks the fields that the application forms treat as mandatory
// across the board — identity, contact and address. Without them, every application
// starts blank and the prefill promise is empty, so they are enforced at
// registration. Everything else is genuinely optional and lives in skippable steps:
// a 50-field wall in front of a public service is how you get abandonment, not data.
// ─────────────────────────────────────────────────────────────────────────────
import { REGIONS } from '../apply/forms/regions.js';

export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
export const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Rev'];
export const EMPLOYMENT_STATUS = ['Employed', 'Self-employed', 'Unemployed', 'Retired', 'Student', 'Unable to work'];
export const PAYOUT_CHANNELS = ['Bank transfer', 'Post office', 'Mobile money', 'Cheque'];
export const EYE_COLOURS = ['Brown', 'Black', 'Hazel', 'Blue', 'Green', 'Grey'];
export const COMPLEXIONS = ['Fair', 'Light', 'Medium', 'Dark', 'Very dark'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const CITIZENSHIP_BY = ['Birth', 'Descent', 'Registration', 'Naturalisation'];
export const YES_NO = ['Yes', 'No'];

// ── Validators ───────────────────────────────────────────────────────────────
// Each returns an error string or '' — plain functions so the same rule runs in the
// registration wizard and on the profile page with no duplication.
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/** Guyana mobile numbers are 7 digits, usually written with the +592 country code. */
const validPhone = (v) => {
  if (isBlank(v)) return '';
  const digits = String(v).replace(/\D/g, '');
  if (digits.length < 7) return 'A phone number needs at least 7 digits.';
  if (digits.length > 15) return 'That is too long for a phone number.';
  return '';
};

const validDob = (v) => {
  if (isBlank(v)) return '';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Enter a valid date.';
  if (d.getTime() > Date.now()) return 'A date of birth cannot be in the future.';
  const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age > 120) return 'Check the year — that date is over 120 years ago.';
  // No lower bound: a parent may register on behalf of a child, and inventing a
  // minimum age here would lock out exactly the guardianship cases that need it.
  return '';
};

const validNumber = (label, { min = 0, max = 1e9 } = {}) => (v) => {
  if (isBlank(v)) return '';
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < min) return `${label} cannot be less than ${min}.`;
  if (n > max) return `${label} looks too large — please check it.`;
  return '';
};

// { key, label, type, options?, section, sm, required?, help?, placeholder?,
//   autoComplete?, inputMode?, maxLength?, validate? }
// `sm` is the 2-col grid span (out of 12).
export const USER_PROFILE_FIELDS = [
  // ── Identity (REQUIRED) ─────────────────────────────────────────────────────
  { key: 'title', label: 'Title', type: 'select', options: TITLES, section: 'Identity', sm: 3 },
  {
    key: 'dob',
    label: 'Date of birth',
    type: 'date',
    section: 'Identity',
    sm: 4,
    required: true,
    autoComplete: 'bday',
    help: 'As shown on your birth certificate.',
    validate: validDob,
  },
  { key: 'gender', label: 'Sex', type: 'select', options: GENDERS, section: 'Identity', sm: 5, required: true },
  {
    key: 'nationalId',
    label: 'National ID number',
    type: 'text',
    section: 'Identity',
    sm: 4,
    required: true,
    placeholder: 'e.g. GY-123-4567',
    help: 'Found on the front of your national ID card.',
    maxLength: 32,
  },
  {
    key: 'tin',
    label: 'TIN',
    type: 'text',
    section: 'Identity',
    sm: 4,
    placeholder: 'Taxpayer Identification Number',
    help: 'Leave blank if you do not have one yet.',
    maxLength: 32,
  },
  {
    key: 'surname',
    label: 'Surname',
    type: 'text',
    section: 'Identity',
    sm: 4,
    required: true,
    autoComplete: 'family-name',
    // Deriving this from the full name by splitting on whitespace gets compound
    // surnames wrong, and the identity forms (passport, certificates) all ask for
    // the parts separately — so it is captured properly once.
    help: 'Your family name, exactly as it appears on your ID.',
  },
  {
    key: 'givenNames', label: 'Given names', type: 'text', section: 'Identity', sm: 4,
    required: true, autoComplete: 'given-name',
  },
  { key: 'otherNames', label: 'Other names (if any)', type: 'text', section: 'Identity', sm: 4 },
  { key: 'maritalStatus', label: 'Marital status', type: 'select', options: MARITAL, section: 'Identity', sm: 4 },
  { key: 'occupation', label: 'Occupation', type: 'text', section: 'Identity', sm: 4 },
  { key: 'placeOfBirth', label: 'Place of birth', type: 'text', section: 'Identity', sm: 4 },
  { key: 'countryOfBirth', label: 'Country of birth', type: 'text', section: 'Identity', sm: 4 },

  // ── Contact & address (REQUIRED) ────────────────────────────────────────────
  {
    key: 'phone',
    label: 'Mobile number',
    type: 'tel',
    section: 'Contact & address',
    sm: 6,
    required: true,
    autoComplete: 'tel',
    inputMode: 'tel',
    placeholder: '+592 000 0000',
    help: 'We use this to tell you when an application moves forward.',
    validate: validPhone,
  },
  { key: 'lot', label: 'Lot / house number', type: 'text', section: 'Contact & address', sm: 3, required: true, autoComplete: 'address-line1' },
  { key: 'street', label: 'Street / scheme', type: 'text', section: 'Contact & address', sm: 3, autoComplete: 'address-line2' },
  { key: 'village', label: 'Village / ward', type: 'text', section: 'Contact & address', sm: 6, required: true, autoComplete: 'address-level2' },
  { key: 'region', label: 'Region', type: 'select', options: REGIONS, section: 'Contact & address', sm: 6, required: true },
  {
    key: 'mailingAddress', label: 'Mailing address (if different)', type: 'textarea',
    section: 'Contact & address', sm: 12,
    help: 'Only needed if post should go somewhere other than the address above.',
  },

  // ── Family & parentage (OPTIONAL) ───────────────────────────────────────────
  // Required by the birth certificate, passport and citizenship application forms.
  { key: 'mothersName', label: "Mother's full name", type: 'text', section: 'Family & parentage', sm: 6 },
  { key: 'mothersMaidenName', label: "Mother's maiden name", type: 'text', section: 'Family & parentage', sm: 6 },
  { key: 'mothersBirthplace', label: "Mother's place of birth", type: 'text', section: 'Family & parentage', sm: 6 },
  { key: 'fathersName', label: "Father's full name", type: 'text', section: 'Family & parentage', sm: 6 },
  { key: 'fathersBirthplace', label: "Father's place of birth", type: 'text', section: 'Family & parentage', sm: 6 },
  { key: 'presentNationality', label: 'Present nationality', type: 'text', section: 'Family & parentage', sm: 4 },
  { key: 'nationalityAtBirth', label: 'Nationality at birth', type: 'text', section: 'Family & parentage', sm: 4 },
  { key: 'citizenshipBy', label: 'Citizenship by', type: 'select', options: CITIZENSHIP_BY, section: 'Family & parentage', sm: 4 },

  // ── Employment & income (OPTIONAL) ──────────────────────────────────────────
  // Drives the means-tested programmes: old-age pension, public assistance, cash grant.
  { key: 'employmentStatus', label: 'Employment status', type: 'select', options: EMPLOYMENT_STATUS, section: 'Employment & income', sm: 6 },
  { key: 'employerName', label: 'Employer name', type: 'text', section: 'Employment & income', sm: 6 },
  { key: 'employerAddress', label: 'Employer address', type: 'text', section: 'Employment & income', sm: 12 },
  {
    key: 'monthlySalary', label: 'Monthly income (GYD)', type: 'number',
    section: 'Employment & income', sm: 4, inputMode: 'numeric',
    validate: validNumber('Monthly income'),
  },
  { key: 'sourceOfIncome', label: 'Main source of income', type: 'text', section: 'Employment & income', sm: 4 },
  {
    key: 'householdSize', label: 'People in your household', type: 'number',
    section: 'Employment & income', sm: 2, inputMode: 'numeric',
    validate: validNumber('Household size', { min: 1, max: 50 }),
  },
  {
    key: 'dependents', label: 'Dependants', type: 'number',
    section: 'Employment & income', sm: 2, inputMode: 'numeric',
    validate: validNumber('Dependants', { min: 0, max: 50 }),
  },

  // ── How you are paid (OPTIONAL) ─────────────────────────────────────────────
  // Every benefit form asks this. Recognition data ONLY — no full account number and
  // nothing that could be used to move money; that belongs with a payment processor.
  { key: 'payoutChannel', label: 'Preferred payment method', type: 'select', options: PAYOUT_CHANNELS, section: 'How you are paid', sm: 4 },
  { key: 'bankName', label: 'Bank name', type: 'text', section: 'How you are paid', sm: 4 },
  { key: 'bankBranch', label: 'Branch', type: 'text', section: 'How you are paid', sm: 4 },
  {
    key: 'accountReference', label: 'Account reference', type: 'text', section: 'How you are paid', sm: 6,
    help: 'A name or last few digits you will recognise. Never enter your full account number.',
    maxLength: 24,
  },

  // ── Next of kin & emergency contact (OPTIONAL) ──────────────────────────────
  { key: 'nextOfKin', label: 'Next of kin', type: 'text', section: 'Next of kin & emergency', sm: 4 },
  { key: 'nextOfKinRelationship', label: 'Relationship', type: 'text', section: 'Next of kin & emergency', sm: 4 },
  { key: 'nextOfKinPhone', label: 'Next of kin phone', type: 'tel', section: 'Next of kin & emergency', sm: 4, inputMode: 'tel', validate: validPhone },
  // A DISTINCT person from next of kin on the driver's licence and passport forms,
  // so these are separate fields rather than reusing the ones above.
  { key: 'emergencyName', label: 'Emergency contact', type: 'text', section: 'Next of kin & emergency', sm: 4 },
  { key: 'emergencyRelationship', label: 'Relationship', type: 'text', section: 'Next of kin & emergency', sm: 4 },
  { key: 'emergencyPhone', label: 'Emergency phone', type: 'tel', section: 'Next of kin & emergency', sm: 4, inputMode: 'tel', validate: validPhone },
  { key: 'emergencyAddress', label: 'Emergency contact address', type: 'text', section: 'Next of kin & emergency', sm: 12 },

  // ── Physical description (OPTIONAL) ─────────────────────────────────────────
  // Asked by the driver's licence and passport application forms.
  {
    key: 'height', label: 'Height (cm)', type: 'number', section: 'Physical description', sm: 3,
    inputMode: 'numeric', validate: validNumber('Height', { min: 40, max: 260 }),
  },
  { key: 'eyeColour', label: 'Eye colour', type: 'select', options: EYE_COLOURS, section: 'Physical description', sm: 3 },
  { key: 'complexion', label: 'Complexion', type: 'select', options: COMPLEXIONS, section: 'Physical description', sm: 3 },
  { key: 'bloodGroup', label: 'Blood group', type: 'select', options: BLOOD_GROUPS, section: 'Physical description', sm: 3 },
  { key: 'organDonor', label: 'Organ donor', type: 'select', options: YES_NO, section: 'Physical description', sm: 3 },
];

export const PROFILE_KEYS = USER_PROFILE_FIELDS.map((f) => f.key);

/** Ordered, de-duplicated list of section names for grouped rendering. */
export const PROFILE_SECTIONS = [...new Set(USER_PROFILE_FIELDS.map((f) => f.section))];

/** Fields the application forms treat as mandatory — enforced at registration. */
export const REQUIRED_PROFILE_KEYS = USER_PROFILE_FIELDS.filter((f) => f.required).map((f) => f.key);

/** Look a field definition up by key. */
export const fieldByKey = Object.fromEntries(USER_PROFILE_FIELDS.map((f) => [f.key, f]));

/** Empty values for every profile key (form initial state). */
export const emptyProfile = () => Object.fromEntries(PROFILE_KEYS.map((k) => [k, '']));

/**
 * Validate one profile field. Returns an error string, or '' when valid.
 * Required-ness is checked first, then the field's own rule — so a blank optional
 * field with a format validator never reports a format error.
 */
export function validateProfileField(key, value) {
  const f = fieldByKey[key];
  if (!f) return '';
  if (f.required && isBlank(value)) return `${f.label} is required.`;
  return f.validate ? f.validate(value) : '';
}

/** Validate a set of keys. Returns { key: message } for the failures only. */
export function validateProfileFields(keys, form) {
  const errors = {};
  for (const k of keys) {
    const msg = validateProfileField(k, form[k]);
    if (msg) errors[k] = msg;
  }
  return errors;
}

/**
 * How complete the stored profile is, as a percentage plus the outstanding fields.
 * Drives the "Profile 68% complete" nudge — the honest alternative to forcing all
 * ~45 fields up front. Weighted so required fields count double: a profile missing a
 * required field is materially less useful than one missing a physical description.
 */
export function profileCompleteness(form = {}) {
  let score = 0;
  let total = 0;
  const missingRequired = [];
  for (const f of USER_PROFILE_FIELDS) {
    const weight = f.required ? 2 : 1;
    total += weight;
    if (!isBlank(form[f.key])) score += weight;
    else if (f.required) missingRequired.push(f);
  }
  return {
    percent: total ? Math.round((score / total) * 100) : 0,
    missingRequired,
    complete: missingRequired.length === 0,
  };
}

/** Build a form object from a /me user record (name is top-level; rest in profile). */
export const userToForm = (user) => {
  const p = user?.profile || {};
  return {
    name: user?.name ?? p.name ?? '',
    ...Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k] ?? ''])),
  };
};
