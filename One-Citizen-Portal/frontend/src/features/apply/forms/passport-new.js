import { REGIONS } from './regions.js';

// New adult passport — Central Immigration & Passport Office (CIPO).
const form = {
  sections: [
    { title: 'Application type', description: 'Tell us which passport you need.', fields: [
      { name: 'applicationType', label: 'Application type', type: 'select', required: true, options: ['First-time passport', 'Replacement (lost)', 'Replacement (stolen)', 'Replacement (damaged)', 'Change of particulars'] },
      { name: 'bookletType', label: 'Booklet type', type: 'select', required: true, options: ['Standard (32 pages)', 'Frequent traveller (64 pages)'] },
      { name: 'processingType', label: 'Processing', type: 'select', required: true, options: ['Regular', 'Express (expedited fee)'] },
    ] },
    { title: 'Personal details', description: 'Enter your details exactly as they appear on your birth certificate.', fields: [
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Rev'] },
      { name: 'surname', label: 'Surname', type: 'text', required: true },
      { name: 'givenNames', label: 'Given name(s)', type: 'text', required: true },
      { name: 'otherNames', label: 'Other / former names', type: 'text', required: false, help: 'Maiden name or any name previously used.' },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'placeOfBirth', label: 'Place of birth (town / village)', type: 'text', required: true },
      { name: 'countryOfBirth', label: 'Country of birth', type: 'text', required: true, placeholder: 'Guyana' },
      { name: 'sex', label: 'Sex', type: 'select', required: true, options: ['Female', 'Male'] },
      { name: 'height', label: 'Height (cm)', type: 'number', required: true },
      { name: 'eyeColour', label: 'Eye colour', type: 'select', required: true, options: ['Brown', 'Black', 'Hazel', 'Blue', 'Green', 'Grey'] },
      { name: 'complexion', label: 'Complexion', type: 'select', required: false, options: ['Fair', 'Medium', 'Dark'] },
      { name: 'maritalStatus', label: 'Marital status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'] },
      { name: 'occupation', label: 'Occupation', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
    ] },
    { title: 'Citizenship & parents', fields: [
      { name: 'nationalityAtBirth', label: 'Nationality at birth', type: 'text', required: true, placeholder: 'Guyanese' },
      { name: 'presentNationality', label: 'Present nationality', type: 'text', required: true, placeholder: 'Guyanese' },
      { name: 'citizenshipBy', label: 'Citizenship acquired by', type: 'select', required: true, options: ['Birth', 'Descent', 'Registration', 'Naturalisation'] },
      { name: 'fathersName', label: "Father's full name", type: 'text', required: true },
      { name: 'fathersBirthplace', label: "Father's place of birth", type: 'text', required: false },
      { name: 'mothersName', label: "Mother's full name", type: 'text', required: true },
      { name: 'mothersMaidenName', label: "Mother's maiden name", type: 'text', required: true },
      { name: 'mothersBirthplace', label: "Mother's place of birth", type: 'text', required: false },
    ] },
    { title: 'Spouse details', description: 'Complete only if you are married, divorced or widowed.', fields: [
      { name: 'spouseName', label: "Spouse's full name", type: 'text', required: false },
      { name: 'spouseDob', label: "Spouse's date of birth", type: 'date', required: false },
      { name: 'spouseNationality', label: "Spouse's nationality", type: 'text', required: false },
      { name: 'dateOfMarriage', label: 'Date of marriage', type: 'date', required: false },
      { name: 'placeOfMarriage', label: 'Place of marriage', type: 'text', required: false },
    ] },
    { title: 'Contact & address', fields: [
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'street', label: 'Street / scheme', type: 'text', required: true },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
    ] },
    { title: 'Emergency contact & collection', fields: [
      { name: 'emergencyName', label: 'Emergency contact name', type: 'text', required: true },
      { name: 'emergencyRelationship', label: 'Relationship', type: 'text', required: true },
      { name: 'emergencyPhone', label: 'Emergency contact number', type: 'tel', required: true },
      { name: 'emergencyAddress', label: 'Emergency contact address', type: 'text', required: false },
      { name: 'collectionOffice', label: 'Collection office', type: 'select', required: true, options: ['CIPO Georgetown (Camp Street)', 'CIPO Berbice (New Amsterdam)', 'CIPO Essequibo (Anna Regina)'] },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docNationalId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
      { name: 'docBirthCert', label: 'Birth certificate', type: 'file', docType: 'birth_certificate', required: true },
      { name: 'docPhoto', label: 'Passport-size photograph', type: 'file', docType: 'passport_photo', required: true },
      { name: 'docOldPassport', label: 'Previous passport (if any)', type: 'file', docType: 'passport', required: false },
      { name: 'docMarriage', label: 'Marriage certificate (if applicable)', type: 'file', docType: 'marriage_certificate', required: false },
      { name: 'docPoliceReport', label: 'Police report (lost / stolen)', type: 'file', docType: 'police_report', required: false },
    ] },
  ],
};

export default form;
