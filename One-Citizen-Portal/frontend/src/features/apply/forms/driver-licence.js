import { REGIONS } from './regions.js';

// Driver's licence — Guyana Revenue Authority (GRA), Licence Revenue Office.
const form = {
  sections: [
    { title: 'Applicant', fields: [
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr'] },
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Female', 'Male'] },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
    ] },
    { title: 'Address', fields: [
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'street', label: 'Street / scheme', type: 'text', required: true },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
    ] },
    { title: 'Licence details', fields: [
      { name: 'applicationType', label: 'Application type', type: 'select', required: true, options: ['Provisional (learner)', 'New (after test)', 'Renewal', 'Duplicate (lost/damaged)', 'Upgrade class'] },
      { name: 'vehicleClass', label: 'Vehicle class(es)', type: 'multiselect', required: true, options: ['Motor car', 'Motor cycle', 'Minibus', 'Hire car', 'Lorry (goods)', 'Tractor', 'Special vehicle'] },
      { name: 'priorLicenceNo', label: 'Prior licence number (renewal/upgrade)', type: 'text', required: false },
      { name: 'bloodGroup', label: 'Blood group', type: 'select', required: false, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] },
      { name: 'medicalCondition', label: 'Any medical condition affecting driving?', type: 'select', required: true, options: ['No', 'Yes (attach medical certificate)'] },
      { name: 'organDonor', label: 'Register as organ donor?', type: 'select', required: false, options: ['No', 'Yes'] },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
      { name: 'docEye', label: 'Eye test certificate', type: 'file', docType: 'eye_test', required: true },
      { name: 'docPhoto', label: 'Passport-size photograph', type: 'file', docType: 'passport_photo', required: true },
      { name: 'docMedical', label: 'Medical certificate (if applicable)', type: 'file', docType: 'medical_certificate', required: false },
    ] },
  ],
};

export default form;
