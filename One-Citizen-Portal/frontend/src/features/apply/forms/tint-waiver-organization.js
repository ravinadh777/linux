import individual from './tint-waiver-individual.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tint Waiver — ORGANIZATION.  MOHA → Tint Waiver Unit.
//
// Same shared ApplyPage, same stepper, same gate, same drafts as Individual — this
// file only swaps the applicant-side sections and makes the vehicle section
// repeatable.
//
// ── ASSUMPTIONS, because no screenshot covers the organisation form ───────────
// 1. The personal + employment sections are replaced by ONE organisation section.
//    The MOHA org payload carries organizationName and two address lines and no
//    person fields, so asking for firstName/lastName would produce keys the API
//    does not read.
// 2. A CONTACT block is added (person, position, telephone, email). An organisation
//    application still needs a human to correspond with, and the Individual form's
//    "Employer Tel No." shows MOHA expects a phone number somewhere. These four keys
//    are NOT in the published payload.
// 3. Tint waiver details and Declaration are reused from the Individual form by
//    reference, so the two can never drift apart. The requirement — a justification
//    letter to the Minister plus supporting documents — is not applicant-type
//    specific.
// 4. Vehicles are REPEATABLE, using exactly the eight keys from the org payload:
//    registrationNumber, vehicleType, vehicleColour, vehicleMake, vehicleModel,
//    vehicleYear, chassisNumber, registeredOwner. On submit the API derives
//    registrationNumbers[] and vehicleCount from this array for org-wide duplicate
//    checking. Per-vehicle driver's-licence fields are deliberately absent: they are
//    not in the org payload, and a fleet vehicle has no single driver.
// ─────────────────────────────────────────────────────────────────────────────

const [, , tintDetails, , declaration] = individual.sections;

const form = {
  sections: [
    {
      title: 'Organization information',
      fields: [
        { name: 'organizationName', label: 'Name of Organization', type: 'text', required: true, max: 200 },        // ✓
        { name: 'organizationAddressLine1', label: 'Address Line 1', type: 'text', required: true, max: 200 },      // ✓
        { name: 'organizationAddressLine2', label: 'Address Line 2', type: 'text', required: false, max: 200 },     // ✓
      ],
    },
    {
      title: 'Contact information',
      description: 'Who MOHA should contact about this application.',
      fields: [
        { name: 'contactPersonName', label: 'Contact Person', type: 'text', required: true, max: 100 },
        { name: 'contactPersonPosition', label: 'Position Held', type: 'text', required: true, max: 100 },
        { name: 'contactTelNo', label: 'Telephone No.', type: 'tel', required: true, max: 15 },
        { name: 'contactEmail', label: 'Email Address', type: 'email', required: false, max: 200 },
      ],
    },
    // Shared by reference — see assumption 3.
    tintDetails,
    {
      title: 'Vehicles',
      description: 'Add every vehicle this application covers.',
      // `repeat` makes the shared renderer draw an add/remove list over these fields
      // and store them as an array under `vehicles`, matching the org payload.
      repeat: {
        name: 'vehicles',
        itemLabel: 'Vehicle',
        min: 1,
        // Carried into each new row so a fleet does not retype the owner. Editable.
        inherit: { registeredOwner: 'organizationName' },
      },
      fields: [
        { name: 'registrationNumber', label: 'Registration Number', type: 'text', required: true, max: 10, uppercase: true }, // ✓
        { name: 'vehicleType', label: 'Type of Vehicle', type: 'select', required: true, optionsKey: 'vehicleTypes' },        // ✓
        { name: 'vehicleColour', label: 'Colour', type: 'select', required: true, optionsKey: 'vehicleColours' },             // ✓
        { name: 'vehicleMake', label: 'Vehicle Make', type: 'select', required: true, optionsKey: 'vehicleMakes', placeholder: 'Start typing to search…' }, // ✓
        { name: 'vehicleModel', label: 'Vehicle Model', type: 'select', required: true, optionsKey: 'vehicleModels', dependsOn: 'vehicleMake', placeholder: 'Start typing to search…' }, // ✓
        { name: 'vehicleYear', label: 'Year of Manufacture', type: 'select', required: true, optionsKey: 'vehicleYears' },    // ✓
        { name: 'chassisNumber', label: 'Chassis No. / VIN', type: 'text', required: true, max: 17, uppercase: true },        // ✓
        { name: 'registeredOwner', label: 'Name of Registered Owner', type: 'text', required: true, max: 100 },               // ✓
      ],
    },
    declaration,
  ],
};

export default form;
