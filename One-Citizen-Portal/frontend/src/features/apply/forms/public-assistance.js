import { REGIONS } from './regions.js';

// Public assistance — Ministry of Human Services & Social Security (MHSSS).
const form = {
  sections: [
    { title: 'Applicant', fields: [
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Miss', 'Ms'] },
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Female', 'Male'] },
      { name: 'maritalStatus', label: 'Marital status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'] },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
    ] },
    { title: 'Household & circumstances', fields: [
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
      { name: 'householdSize', label: 'People in household', type: 'number', required: true },
      { name: 'dependents', label: 'Number of dependents', type: 'number', required: false },
      { name: 'employmentStatus', label: 'Employment status', type: 'select', required: true, options: ['Unemployed', 'Employed', 'Self-employed', 'Unable to work (illness/disability)', 'Retired'] },
      { name: 'monthlyIncome', label: 'Approx. monthly household income (GYD)', type: 'number', required: true },
      { name: 'reasonForAssistance', label: 'Reason for assistance', type: 'select', required: true, options: ['Low income', 'Illness / disability', 'Elderly care', 'Single parent', 'Loss of breadwinner', 'Other'] },
      { name: 'circumstances', label: 'Describe your circumstances', type: 'textarea', required: true },
    ] },
    { title: 'Payment', fields: [
      { name: 'payoutChannel', label: 'Payout channel', type: 'select', required: true, options: ['Bank account', 'Mobile Money (MMG)', 'Post office collection'] },
      { name: 'accountReference', label: 'Account / wallet number', type: 'text', required: false },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
      { name: 'docIncome', label: 'Proof of income / hardship', type: 'file', docType: 'supporting_document', required: false },
      { name: 'docSupport', label: 'Medical / other supporting evidence', type: 'file', docType: 'medical_report', required: false },
    ] },
  ],
};

export default form;
