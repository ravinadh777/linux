import { REGIONS } from './regions.js';

// Taxpayer Identification Number registration — Guyana Revenue Authority (GRA).
const form = {
  sections: [
    { title: 'Taxpayer details', fields: [
      { name: 'taxpayerType', label: 'Taxpayer type', type: 'select', required: true, options: ['Individual (employed)', 'Self-employed', 'Sole trader', 'Partner'] },
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr'] },
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Female', 'Male'] },
      { name: 'placeOfBirth', label: 'Place of birth', type: 'text', required: false },
      { name: 'mothersMaidenName', label: "Mother's maiden name", type: 'text', required: true, help: 'Used to verify your identity.' },
    ] },
    { title: 'Contact & address', fields: [
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'street', label: 'Street / scheme', type: 'text', required: true },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
      { name: 'mailingAddress', label: 'Mailing address (if different)', type: 'text', required: false },
    ] },
    { title: 'Employment / business', fields: [
      { name: 'occupation', label: 'Occupation', type: 'text', required: true },
      { name: 'employerName', label: 'Employer name', type: 'text', required: false },
      { name: 'employerAddress', label: 'Employer address', type: 'text', required: false },
      { name: 'businessName', label: 'Business / trade name (if any)', type: 'text', required: false },
      { name: 'businessActivity', label: 'Nature of business activity', type: 'text', required: false },
      { name: 'sourceOfIncome', label: 'Main source of income', type: 'select', required: true, options: ['Employment', 'Business', 'Investments', 'Pension', 'Other'] },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
      { name: 'docAddress', label: 'Proof of address', type: 'file', docType: 'proof_of_address', required: true },
      { name: 'docEmployment', label: 'Employment letter (if employed)', type: 'file', docType: 'employment_letter', required: false },
    ] },
  ],
};

export default form;
