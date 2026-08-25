// Single, explicit mapping layer: route ANY value payload (the citizen's /me profile OR the
// ASKGov chat/agent prefill) onto a specific service form's ACTUAL field names, so every value
// lands in the right input — no vocabulary/name mismatch, no wrong-field fills. Matching is by
// field name, then human label, then a source-key alias — all case/space normalised. In dev, a
// source value that has NO matching form field is warned (so mismatches surface, not fail silently).
import { USER_PROFILE_FIELDS } from '../auth/userFields.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Canonical source key ← the naming variants used across services / the agent payload.
const NAME_ALIASES = {
  fullname: 'fullName', name: 'fullName', requestername: 'fullName', applicantname: 'fullName', personname: 'fullName', declarantname: 'fullName',
  title: 'title',
  dob: 'dob', dateofbirth: 'dob', birthdate: 'dob',
  sex: 'gender', gender: 'gender',
  nationalid: 'nationalId', idnumber: 'nationalId', requesterid: 'nationalId', nid: 'nationalId', nationalidnumber: 'nationalId',
  tin: 'tin', taxid: 'tin', tinnumber: 'tin',
  phone: 'phone', mobile: 'phone', phonenumber: 'phone', mobilenumber: 'phone', contactnumber: 'phone', contact: 'phone',
  email: 'email', emailaddress: 'email',
  occupation: 'occupation', profession: 'occupation',
  maritalstatus: 'maritalStatus',
  placeofbirth: 'placeOfBirth',
  countryofbirth: 'countryOfBirth',
  mothersmaidenname: 'mothersMaidenName', maidenname: 'mothersMaidenName',
  lot: 'lot', lotnumber: 'lot', housenumber: 'lot',
  street: 'street', streetname: 'street', scheme: 'street',
  village: 'village', ward: 'village', town: 'village', city: 'village',
  region: 'region',
  nextofkin: 'nextOfKin', nextofkinname: 'nextOfKin',
  nextofkinrelationship: 'nextOfKinRelationship', relationship: 'nextOfKinRelationship',
  nextofkinphone: 'nextOfKinPhone', kinphone: 'nextOfKinPhone',
};

// Human-label → canonical key, seeded from the registration field definitions + a few extras.
const LABEL_ALIASES = (() => {
  const m = {};
  for (const f of USER_PROFILE_FIELDS) m[norm(f.label)] = f.key;
  Object.assign(m, {
    [norm('Full name')]: 'fullName', [norm('Name')]: 'fullName',
    [norm('Date of birth')]: 'dob', [norm('Sex')]: 'gender',
    [norm('National ID')]: 'nationalId', [norm('National ID number')]: 'nationalId',
    [norm('Email')]: 'email', [norm('Mobile number')]: 'phone', [norm('Phone')]: 'phone',
  });
  return m;
})();

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const isDev = (() => { try { return !!import.meta.env?.DEV; } catch { return false; } })();

// Reduce any key (a form field name, a label, or a source key) to its canonical profile key,
// so BOTH sides of the mapping are compared in the same vocabulary (e.g. 'mobile' → 'phone').
const canonOf = (key) => NAME_ALIASES[norm(key)] || LABEL_ALIASES[norm(key)] || key;

/**
 * Map an arbitrary source object onto the form's field names.
 * @param {Record<string, any>} source  values keyed by ANY of: form name, canonical key, or alias
 * @param {Array<{name,label,type,options}>} fields  the form's field definitions
 * @param {{ warn?: boolean, sourceLabel?: string }} [opts]
 * @returns {Record<string, any>} values keyed by the form's OWN field names (files skipped)
 */
export function mapValuesToFields(source = {}, fields = [], opts = {}) {
  const warn = opts.warn ?? isDev;
  // Index the source by BOTH its canonical key and its raw normalised key, so a form field
  // resolves whether the source used the canonical name, an alias, or the exact field name.
  const index = new Map();
  for (const [k, v] of Object.entries(source)) {
    const c = norm(canonOf(k));
    if (!index.has(c)) index.set(c, { key: k, value: v });
    const nk = norm(k);
    if (!index.has(nk)) index.set(nk, { key: k, value: v });
  }

  const values = {};
  const consumed = new Set();
  for (const f of fields) {
    if (!f?.name || f.type === 'file') continue;
    // Look the field up by its canonical key, then its raw name, then its label.
    const fieldCanon = NAME_ALIASES[norm(f.name)] || LABEL_ALIASES[norm(f.label)] || f.name;
    const candidates = [norm(fieldCanon), norm(f.name), norm(f.label)];
    let hit;
    for (const c of candidates) {
      const found = index.get(c);
      if (found && !isEmpty(found.value)) { hit = found; break; }
    }
    if (!hit) continue;
    consumed.add(norm(hit.key)); // matched a field (even if the value is an invalid option)
    if (f.type === 'select' && Array.isArray(f.options) && f.options.length && !f.options.includes(hit.value)) {
      if (warn) console.warn(`[prefill] "${hit.key}"=${JSON.stringify(hit.value)} is not a valid option for field "${f.name}" — skipped.`); // eslint-disable-line no-console
      continue;
    }
    values[f.name] = hit.value;
  }

  // Dev-time surface: any non-empty source value that never mapped to a field.
  if (warn) {
    for (const [k, v] of Object.entries(source)) {
      if (!isEmpty(v) && !consumed.has(norm(k))) {
        console.warn(`[prefill] source value "${k}" has no matching field on this form — not filled.`); // eslint-disable-line no-console
      }
    }
  }
  return values;
}

// Flatten the citizen's /me record into a resolvable source. Promotes name/email, aliases
// gender, and DERIVES surname/given-names from the single stored full name so identity forms
// (which split the name) still populate from profile instead of forcing a manual gap.
function flatProfile(user) {
  const p = user?.profile || {};
  const fullName = user?.name || p.name || p.fullName || '';
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    ...p,
    fullName,
    surname: p.surname || (parts.length > 1 ? parts[parts.length - 1] : ''),
    givenNames: p.givenNames || (parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] || '')),
    email: user?.email || p.email || '',
    gender: p.gender ?? p.sex,
  };
}

/** Convenience: map the citizen's stored profile onto a form. */
export function resolveProfileValues(user, fields = []) {
  if (!user) return {};
  // The profile is our own data — don't warn on unmatched profile keys (many forms use only a
  // subset); warnings are for the chat/agent payload where a mismatch is a real bug.
  return mapValuesToFields(flatProfile(user), fields, { warn: false });
}
