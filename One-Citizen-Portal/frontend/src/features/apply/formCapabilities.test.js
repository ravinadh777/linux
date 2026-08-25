import { describe, it, expect } from 'vitest';
import {
  isFieldActive, visibleFields, isRepeatSection, blankRow, topLevelFields,
  isFieldComplete, sectionComplete, sectionMissing, optionsForField,
} from './formCapabilities.jsx';
import individual from './forms/tint-waiver-individual.js';
import organization from './forms/tint-waiver-organization.js';
import { serviceForms } from './forms/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// The four capabilities added to the shared form language. These are the rules the
// advance-gate, the review step and submit all share, so a bug here is a bug in every
// service at once — worth pinning down.
// ─────────────────────────────────────────────────────────────────────────────

const employment = individual.sections[1];
const vehicles = organization.sections[3];

describe('conditional fields (showWhen)', () => {
  it('hides the employer block when Self-Employed', () => {
    const shown = visibleFields(employment, { employmentStatus: 'Self-Employed' }).map((f) => f.name);
    expect(shown).toEqual(['employmentStatus', 'profession']);
  });

  it('shows the employer block when Employed', () => {
    const shown = visibleFields(employment, { employmentStatus: 'Employed' }).map((f) => f.name);
    expect(shown).toContain('employerName');
    expect(shown).toContain('employerTelNo');
  });

  it('treats a field with no showWhen as always active', () => {
    expect(isFieldActive({ name: 'x' }, {})).toBe(true);
  });

  // THE regression this guards: a hidden required field that still blocks. Before the
  // fix, choosing Self-Employed left `employerName` required, so the section could
  // never be completed and Next silently did nothing with no visible cause.
  it('does NOT require a field that is hidden', () => {
    const values = { employmentStatus: 'Self-Employed', profession: 'Carpenter' };
    expect(isFieldComplete(employment.fields.find((f) => f.name === 'employerName'), values)).toBe(true);
    expect(sectionComplete(employment, values)).toBe(true);
    expect(sectionMissing(employment, values)).toEqual([]);
  });

  it('still requires the employer block when Employed', () => {
    const values = { employmentStatus: 'Employed', profession: 'Carpenter' };
    expect(sectionComplete(employment, values)).toBe(false);
    expect(sectionMissing(employment, values)).toContain('Name of Employer');
  });

  it('hides Medical Condition unless the category is Medical', () => {
    const tint = individual.sections[2];
    expect(visibleFields(tint, { exemptionCategory: 'Security' }).map((f) => f.name)).not.toContain('medicalCondition');
    expect(visibleFields(tint, { exemptionCategory: 'Medical' }).map((f) => f.name)).toContain('medicalCondition');
    // Case-insensitive, because the option list comes from MOHA and its casing is
    // not ours to assume.
    expect(visibleFields(tint, { exemptionCategory: 'medical' }).map((f) => f.name)).toContain('medicalCondition');
  });
});

describe('repeatable sections', () => {
  it('identifies the vehicles section as repeatable and stores it under `vehicles`', () => {
    expect(isRepeatSection(vehicles)).toBe(true);
    expect(vehicles.repeat.name).toBe('vehicles');
  });

  it('carries exactly the eight keys the MOHA org payload defines', () => {
    // Drift here means values land in keys MOHA does not read — and because formData
    // is a free-form map, the API would accept it silently.
    expect(vehicles.fields.map((f) => f.name).sort()).toEqual([
      'chassisNumber', 'registeredOwner', 'registrationNumber', 'vehicleColour',
      'vehicleMake', 'vehicleModel', 'vehicleType', 'vehicleYear',
    ]);
  });

  it('excludes repeat fields from the flat RHF registration', () => {
    // Registering `registrationNumber` at the top level would make RHF validate a
    // field that does not exist there and block the form forever.
    const flat = topLevelFields(organization).map((f) => f.name);
    expect(flat).not.toContain('registrationNumber');
    expect(flat).toContain('organizationName');
  });

  it('is incomplete until every row is filled, and names the offending row', () => {
    const values = {
      vehicles: [
        { registrationNumber: 'PAB1001', vehicleType: 'Van', vehicleColour: 'White', vehicleMake: 'Toyota', vehicleModel: 'HiAce', vehicleYear: '2019', chassisNumber: 'AAA0000000000000', registeredOwner: 'Fleet Ltd' },
        { registrationNumber: 'PAB1002', vehicleType: '', vehicleColour: '', vehicleMake: '', vehicleModel: '', vehicleYear: '', chassisNumber: '', registeredOwner: 'Fleet Ltd' },
      ],
    };
    expect(sectionComplete(vehicles, values)).toBe(false);
    const missing = sectionMissing(vehicles, values);
    // Row 1 is fine; every complaint should be about row 2.
    expect(missing.every((m) => m.startsWith('Vehicle 2'))).toBe(true);
    expect(missing).toContain('Vehicle 2 — Type of Vehicle');
  });

  it('is complete when every row is filled', () => {
    const row = { registrationNumber: 'PAB1001', vehicleType: 'Van', vehicleColour: 'White', vehicleMake: 'Toyota', vehicleModel: 'HiAce', vehicleYear: '2019', chassisNumber: 'AAA0000000000000', registeredOwner: 'Fleet Ltd' };
    expect(sectionComplete(vehicles, { vehicles: [row, { ...row, registrationNumber: 'PAB1002' }] })).toBe(true);
  });

  it('requires at least one row', () => {
    expect(sectionComplete(vehicles, { vehicles: [] })).toBe(false);
  });

  it('builds a blank row with every key present', () => {
    expect(Object.keys(blankRow(vehicles)).sort()).toEqual(vehicles.fields.map((f) => f.name).sort());
  });
});

describe('reference-backed option lists', () => {
  const formOptions = {
    lists: { vehicleTypes: [], vehicleColours: ['Black', 'White'], vehicleMakes: ['Toyota'] },
    configured: { vehicleTypes: false, vehicleColours: true, vehicleMakes: true },
    modelsFor: (make) => (make === 'Toyota' ? ['Corolla', 'HiAce'] : []),
  };

  it('reports an unconfigured list so the field can block honestly', () => {
    const r = optionsForField({ optionsKey: 'vehicleTypes', type: 'select' }, {}, formOptions);
    expect(r.configured).toBe(false);
    expect(r.options).toEqual([]);
  });

  it('resolves a configured list', () => {
    const r = optionsForField({ optionsKey: 'vehicleColours', type: 'select' }, {}, formOptions);
    expect(r.configured).toBe(true);
    expect(r.options).toEqual(['Black', 'White']);
  });

  it('derives models from the chosen make and flags an unmet dependency', () => {
    const none = optionsForField({ optionsKey: 'vehicleModels', dependsOn: 'vehicleMake' }, {}, formOptions);
    expect(none.dependencyUnmet).toBe(true);
    const some = optionsForField({ optionsKey: 'vehicleModels', dependsOn: 'vehicleMake' }, { vehicleMake: 'Toyota' }, formOptions);
    expect(some.dependencyUnmet).toBe(false);
    expect(some.options).toEqual(['Corolla', 'HiAce']);
  });

  it('leaves literal option arrays untouched — every pre-existing form uses them', () => {
    const r = optionsForField({ options: ['A', 'B'] }, {}, formOptions);
    expect(r.options).toEqual(['A', 'B']);
    expect(r.configured).toBe(true);
  });
});

describe('the existing services are unaffected', () => {
  it('registers both Tint services', () => {
    expect(Object.keys(serviceForms)).toEqual(expect.arrayContaining([
      'tint-waiver-individual', 'tint-waiver-organization',
    ]));
  });

  it('leaves every non-Tint form free of the new capabilities', () => {
    // The capabilities are additive: if a pre-existing form accidentally acquired a
    // `showWhen` or `repeat`, its gating would silently change.
    for (const [id, form] of Object.entries(serviceForms)) {
      if (id.startsWith('tint-waiver')) continue;
      for (const section of form.sections || []) {
        expect(isRepeatSection(section), `${id} gained a repeat section`).toBe(false);
        for (const f of section.fields || []) {
          expect(f.showWhen, `${id}.${f.name} gained a showWhen`).toBeUndefined();
        }
      }
    }
  });

  it('keeps every non-Tint section complete-able exactly as before', () => {
    // sectionComplete replaced a hand-rolled loop in ApplyPage; for a form with no
    // conditionals it must behave identically to "every required field is non-empty".
    const passport = serviceForms['passport-new'];
    const section = passport.sections[0];
    const filled = Object.fromEntries((section.fields || []).map((f) => [f.name, 'x']));
    expect(sectionComplete(section, filled)).toBe(true);
    const required = (section.fields || []).find((f) => f.required);
    if (required) {
      expect(sectionComplete(section, { ...filled, [required.name]: '' })).toBe(false);
    }
  });
});

describe('the synthetic Review step (regression)', () => {
  // The stepper addresses sections by index and the LAST index is "Review & submit",
  // which has no section object — so `sections[activeStep]` is undefined there. A
  // resumed draft can also point at a step a shortened form no longer has.
  //
  // This crashed the whole page for every service with a saved draft on the review
  // step: `sectionComplete(sections[i])` read `.fields` of undefined and the error
  // boundary swallowed the form. Guarding it is what keeps the stepper's
  // one-past-the-end index legal.
  it('treats an out-of-range section index as complete rather than throwing', () => {
    const sections = individual.sections;
    const reviewIndex = sections.length; // one past the end — the Review step
    expect(() => sectionComplete(sections[reviewIndex], {})).not.toThrow();
    expect(sectionComplete(sections[reviewIndex], {})).toBe(true);
    expect(sectionMissing(sections[reviewIndex], {})).toEqual([]);
  });

  it('is null-safe for an undefined field', () => {
    expect(() => isFieldComplete(undefined, {})).not.toThrow();
    expect(isFieldComplete(undefined, {})).toBe(true);
    expect(() => isFieldActive(undefined, {})).not.toThrow();
  });
});
