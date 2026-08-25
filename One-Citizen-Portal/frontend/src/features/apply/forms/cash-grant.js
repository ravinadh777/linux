import { REGIONS } from './regions.js';

// Cash grant enrolment — Ministry of Finance (MoF).
const form = {
  sections: [
    { title: 'Applicant', fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Female', 'Male'] },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
    ] },
    { title: 'Household', fields: [
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'householdSize', label: 'People in household', type: 'number', required: false },
      { name: 'children', label: 'Number of school-age children', type: 'number', required: false },
    ] },
    { title: 'Payment', fields: [
      { name: 'payoutChannel', label: 'Payout channel', type: 'select', required: true, options: ['Bank account', 'Mobile Money (MMG)', 'Post office collection'] },
      { name: 'bankName', label: 'Bank / provider', type: 'text', required: false },
      { name: 'accountReference', label: 'Account / wallet number', type: 'text', required: false },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
      { name: 'docBank', label: 'Bank statement / wallet proof', type: 'file', docType: 'bank_statement', required: false },
    ] },
  ],
};

export default form;
