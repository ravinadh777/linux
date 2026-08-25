import { REGIONS } from './regions.js';

// Old-age pension (65+) — Ministry of Human Services & Social Security (MHSSS).
const form = {
  sections: [
    { title: 'Applicant', fields: [
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Miss', 'Ms'] },
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true, help: 'You must be 65 or older to qualify.' },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Female', 'Male'] },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
    ] },
    { title: 'Address & next of kin', fields: [
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'street', label: 'Street / scheme', type: 'text', required: false },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
      { name: 'nextOfKin', label: 'Next of kin name', type: 'text', required: false },
      { name: 'nextOfKinRelationship', label: 'Relationship', type: 'text', required: false },
      { name: 'nextOfKinPhone', label: 'Next of kin contact', type: 'tel', required: false },
    ] },
    { title: 'Payment', fields: [
      { name: 'payoutChannel', label: 'How would you like to be paid?', type: 'select', required: true, options: ['Bank account', 'Mobile Money (MMG)', 'Post office collection'] },
      { name: 'bankName', label: 'Bank / provider', type: 'text', required: false },
      { name: 'branch', label: 'Branch', type: 'text', required: false },
      { name: 'accountReference', label: 'Account / wallet number', type: 'text', required: false, help: 'Not needed for post office collection.' },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
      { name: 'docPhoto', label: 'Passport-size photograph', type: 'file', docType: 'passport_photo', required: false },
      { name: 'docBank', label: 'Bank statement / wallet proof', type: 'file', docType: 'bank_statement', required: false },
    ] },
  ],
};

export default form;
