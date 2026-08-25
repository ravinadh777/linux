// ─────────────────────────────────────────────────────────────────────────────
// Tint Waiver — INDIVIDUAL.  MOHA → Tint Waiver Unit.
//
// An ordinary entry in this registry, rendered by the shared ApplyPage exactly like
// every other service: same vertical stepper, same required-field/document gate,
// same draft autosave, same Review & submit step, same tracking record afterwards.
// Nothing about this service is bespoke except the fields below.
//
// Sections A–E follow the MOHA screens. Three field capabilities the shared renderer
// gained for this form (and which every other service can now use):
//   `max`        — character counter + hard cap, matching the 0/100, 0/200, 0/15,
//                  0/17, 0/12, 0/10 counters the screens show
//   `showWhen`   — conditional fields (employer block, medical condition)
//   `optionsKey` — option list resolved from reference data rather than hardcoded
//
// ── FIELD NAMES ARE THE MOHA API CONTRACT ────────────────────────────────────
// Names marked ✓ are verbatim from the MOHA Postman payload and are certain.
// The rest are derived camelCase of the on-screen label — the Postman body is a
// minimal example (12 keys) and the screens show ~3× that, so there is no published
// schema for them. Two label→key traps worth noting, both handled: "Colour" is
// `vehicleColour` (not `colour`), and "Chassis No./VIN" is `chassisNumber`.
// ─────────────────────────────────────────────────────────────────────────────

const form = {
  // Prefills Section A from the citizen's stored profile via the existing
  // prefillFromProfile mapping — the same mechanism AskGov uses on every other form.
  sections: [
    {
      title: 'Personal information',
      description: 'Your details, as they appear on your national ID.',
      fields: [
        { name: 'firstName', label: 'First Name', type: 'text', required: true, max: 100 },        // ✓
        { name: 'middleName', label: 'Middle Name', type: 'text', required: false, max: 100 },     // ✓
        { name: 'lastName', label: 'Last Name', type: 'text', required: true, max: 100 },          // ✓
        { name: 'addressLine1', label: 'Address Line 1', type: 'text', required: true, max: 200 }, // ✓
        { name: 'addressLine2', label: 'Address Line 2', type: 'text', required: false, max: 200 },// ✓
      ],
    },
    {
      title: 'Employment information',
      fields: [
        {
          name: 'employmentStatus', label: 'Employment status', type: 'radio', required: true,
          options: ['Employed', 'Self-Employed'],
        },
        { name: 'profession', label: 'Profession or Occupation', type: 'text', required: true, max: 100 },
        // Employer details are meaningless for the self-employed. `showWhen` hides
        // them AND drops their required flag, so a Self-Employed applicant is never
        // blocked by a field they cannot see — the worst kind of dead end.
        {
          name: 'employerName', label: 'Name of Employer', type: 'text', required: true, max: 100,
          showWhen: (v) => v.employmentStatus !== 'Self-Employed',
        },
        {
          name: 'employerAddressLine1', label: 'Address of Employer Line 1', type: 'text', required: true, max: 200,
          showWhen: (v) => v.employmentStatus !== 'Self-Employed',
        },
        {
          name: 'employerAddressLine2', label: 'Address of Employer Line 2', type: 'text', required: false, max: 200,
          showWhen: (v) => v.employmentStatus !== 'Self-Employed',
        },
        {
          name: 'employerTelNo', label: 'Employer Tel No.', type: 'tel', required: true, max: 15,
          showWhen: (v) => v.employmentStatus !== 'Self-Employed',
        },
      ],
    },
    {
      title: 'Tint waiver details',
      description: 'Why you are applying, and the documents that justify it.',
      fields: [
        {
          name: 'exemptionCategory', label: 'Exemption Category', type: 'select', required: true,
          optionsKey: 'exemptionCategories',
        },
        {
          name: 'medicalCondition', label: 'Medical Condition', type: 'select', required: true,
          optionsKey: 'medicalConditions',
          // MOHA supplied no condition list (the dropdown was empty in every
          // screenshot). `freeText` makes an unconfigured select degrade to a validated
          // text input instead of blocking — which matters here because the field is
          // REQUIRED the moment the category is Medical, so an empty list would make
          // the commonest exemption impossible to apply for.
          freeText: true,
          showWhen: (v) => String(v.exemptionCategory || '').toLowerCase() === 'medical',
        },
        {
          name: 'docRequestLetter', label: 'Request Letter', type: 'file', docType: 'tint_request_letter', required: true,
          help: 'Justification letter addressed to the Minister of Home Affairs.',
        },
        {
          name: 'docSupporting', label: 'Supporting Documents', type: 'file', docType: 'supporting_document', required: true,
          help: 'Documents that justify the reason for requesting the permit.',
        },
      ],
    },
    {
      title: 'Vehicle information',
      fields: [
        { name: 'registeredOwner', label: 'Name of Registered Owner', type: 'text', required: true, max: 100 },   // ✓
        { name: 'vehicleType', label: 'Type of Vehicle', type: 'select', required: true, optionsKey: 'vehicleTypes' }, // ✓
        { name: 'chassisNumber', label: 'Chassis No. / VIN', type: 'text', required: true, max: 17, uppercase: true }, // ✓
        { name: 'registrationNumber', label: 'Registration Number', type: 'text', required: true, max: 10, uppercase: true }, // ✓
        { name: 'vehicleColour', label: 'Colour', type: 'select', required: true, optionsKey: 'vehicleColours' },  // ✓
        { name: 'vehicleMake', label: 'Vehicle Make', type: 'select', required: true, optionsKey: 'vehicleMakes', placeholder: 'Start typing to search…' }, // ✓
        { name: 'vehicleModel', label: 'Vehicle Model', type: 'select', required: true, optionsKey: 'vehicleModels', dependsOn: 'vehicleMake', placeholder: 'Start typing to search…' }, // ✓
        { name: 'vehicleYear', label: 'Year of Manufacture', type: 'select', required: true, optionsKey: 'vehicleYears' }, // ✓
        {
          name: 'driversLicenceNumber', label: "Driver's Licence Number", type: 'text', required: true, max: 12,
          help: "12-digit number found at the back of the driver's licence, top left under the barcode.",
        },
        { name: 'driversLicenceExpiry', label: "Driver's Licence Expiry", type: 'date', required: true },
        { name: 'docDriversLicence', label: "Driver's Licence", type: 'file', docType: 'drivers_licence', required: true },
        { name: 'motorVehicleLicenceNumber', label: 'Motor Vehicle Licence Number', type: 'text', required: true, max: 10 },
        { name: 'motorVehicleLicenceExpiry', label: 'Motor Vehicle Licence Expiry', type: 'date', required: true },
        // The five below complete the vehicle section per the MOHA screen. They are the
        // "Vehicle Documents" the requirements page lists (registration, road licence,
        // certificate of fitness) with their numbers and expiry dates.
        { name: 'docMotorVehicleLicence', label: 'Motor Vehicle Licence', type: 'file', docType: 'motor_vehicle_licence', required: true },
        { name: 'docRegistration', label: 'Registration', type: 'file', docType: 'vehicle_registration', required: true },
        { name: 'fitnessCertificateNumber', label: 'Fitness Certificate Number', type: 'text', required: true, max: 20 },
        { name: 'fitnessCertificateExpiry', label: 'Fitness Certificate Expiry', type: 'date', required: true },
        { name: 'docVehicleFitness', label: 'Vehicle Fitness', type: 'file', docType: 'fitness_certificate', required: true },
      ],
    },
    {
      title: 'Declaration',
      fields: [
        { name: 'declarationName', label: 'Name of person filling this form', type: 'text', required: true, max: 100 },
        {
          name: 'declarationAccepted', type: 'checkbox', required: true,
          label: 'I hereby certify that the information provided is true and correct to the best of my knowledge.',
        },
      ],
    },
  ],
};

export default form;
