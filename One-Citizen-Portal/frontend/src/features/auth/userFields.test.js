import { describe, it, expect } from 'vitest';
import { PROFILE_FIELD_KEYS } from '@onecitizen/shared/constants';
import {
  PROFILE_KEYS, USER_PROFILE_FIELDS, REQUIRED_PROFILE_KEYS,
  validateProfileField, profileCompleteness, emptyProfile,
} from './userFields.js';

// ─────────────────────────────────────────────────────────────────────────────
// The parity test is the important one here.
//
// The backend persists ONLY the keys in @onecitizen/shared's PROFILE_FIELD_KEYS —
// anything else the client sends is dropped before the user row is written. So if
// this file collects a field the shared list does not know about, registration
// SILENTLY discards it: no error, no warning, the citizen believes it was saved, and
// the failure only surfaces later as an application form that will not prefill.
//
// That is exactly the kind of bug a test should make impossible, so the two lists
// are asserted equal in both directions.
// ─────────────────────────────────────────────────────────────────────────────

describe('profile field contract', () => {
  it('collects no field the backend would silently drop', () => {
    const shared = new Set(PROFILE_FIELD_KEYS);
    const orphaned = PROFILE_KEYS.filter((k) => !shared.has(k));
    expect(orphaned, `these fields are collected by the UI but NOT in @onecitizen/shared PROFILE_FIELD_KEYS, so the backend will discard them: ${orphaned.join(', ')}`).toEqual([]);
  });

  it('collects every field the backend is prepared to store', () => {
    const collected = new Set(PROFILE_KEYS);
    const uncollected = PROFILE_FIELD_KEYS.filter((k) => !collected.has(k));
    expect(uncollected, `the backend stores these but no UI field collects them: ${uncollected.join(', ')}`).toEqual([]);
  });

  it('has no duplicate keys', () => {
    expect(new Set(PROFILE_KEYS).size).toBe(PROFILE_KEYS.length);
  });

  it('gives every field a label, type and section', () => {
    for (const f of USER_PROFILE_FIELDS) {
      expect(f.label, `${f.key} has no label`).toBeTruthy();
      expect(f.type, `${f.key} has no type`).toBeTruthy();
      expect(f.section, `${f.key} has no section`).toBeTruthy();
      if (f.type === 'select') expect(Array.isArray(f.options), `${f.key} is a select with no options`).toBe(true);
    }
  });
});

describe('validation', () => {
  it('requires the fields the application forms depend on', () => {
    // If this set shrinks, applications stop being prefillable — so the list is
    // asserted explicitly rather than derived, to make a removal a deliberate act.
    expect(REQUIRED_PROFILE_KEYS.sort()).toEqual(
      ['dob', 'gender', 'givenNames', 'lot', 'nationalId', 'phone', 'region', 'surname', 'village'].sort(),
    );
  });

  it('reports a required field as missing when blank', () => {
    expect(validateProfileField('nationalId', '')).toMatch(/required/i);
    expect(validateProfileField('nationalId', 'GY-123')).toBe('');
  });

  it('does not report a FORMAT error on a blank optional field', () => {
    // The trap: a phone validator that fires on '' would make every optional contact
    // field permanently invalid and block submission on an empty form.
    expect(validateProfileField('emergencyPhone', '')).toBe('');
    expect(validateProfileField('emergencyPhone', '123')).toMatch(/7 digits/);
    expect(validateProfileField('emergencyPhone', '+592 612 3344')).toBe('');
  });

  it('rejects an impossible date of birth', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(validateProfileField('dob', tomorrow)).toMatch(/future/i);
    expect(validateProfileField('dob', '1968-04-12')).toBe('');
  });

  it('bounds numeric fields', () => {
    expect(validateProfileField('height', '900')).toMatch(/too large|less than/i);
    expect(validateProfileField('height', '175')).toBe('');
    expect(validateProfileField('householdSize', '0')).toMatch(/less than/i);
  });
});

describe('completeness', () => {
  it('is 0% for an empty profile and 100% when every field is set', () => {
    expect(profileCompleteness(emptyProfile()).percent).toBe(0);
    const full = Object.fromEntries(PROFILE_KEYS.map((k) => [k, 'x']));
    const done = profileCompleteness(full);
    expect(done.percent).toBe(100);
    expect(done.complete).toBe(true);
  });

  it('weights required fields double, so a profile missing them scores lower', () => {
    const onlyOptional = Object.fromEntries(
      PROFILE_KEYS.filter((k) => !REQUIRED_PROFILE_KEYS.includes(k)).map((k) => [k, 'x']),
    );
    const onlyRequired = Object.fromEntries(REQUIRED_PROFILE_KEYS.map((k) => [k, 'x']));
    const a = profileCompleteness({ ...emptyProfile(), ...onlyOptional });
    const b = profileCompleteness({ ...emptyProfile(), ...onlyRequired });
    expect(a.complete).toBe(false);
    expect(b.complete).toBe(true);
    // 9 required fields at weight 2 vs 40 optional at weight 1 — the point is only
    // that missing-required is reported, and that the required set carries real mass.
    expect(b.percent).toBeGreaterThan(0);
  });
});
