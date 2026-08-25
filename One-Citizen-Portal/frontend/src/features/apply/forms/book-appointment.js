import { REGIONS } from './regions.js';

// Cross-government appointment booking (all ministry offices).
const form = {
  sections: [
    { title: 'Your details', fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
    ] },
    { title: 'Office & service', fields: [
      { name: 'office', label: 'Ministry / office', type: 'select', required: true, options: ['CIPO — Passport Office, Georgetown', 'CIPO — Berbice', 'CIPO — Essequibo', 'GRO — General Register Office, Georgetown', 'GRA — Licence Revenue Office, Georgetown', 'MHSSS — Regional Office', 'Deeds & Commercial Registry', 'NIS Office'] },
      { name: 'purpose', label: 'Purpose of visit', type: 'select', required: true, options: ['New application', 'Collection / pick-up', 'Submit documents', 'Biometrics / photo', 'General enquiry', 'Other'] },
      { name: 'details', label: 'Brief description', type: 'textarea', required: false, placeholder: 'Anything the officer should know before your visit' },
    ] },
    { title: 'Preferred schedule', fields: [
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
      { name: 'preferredDate', label: 'Preferred date', type: 'date', required: true },
      { name: 'preferredTime', label: 'Preferred time', type: 'select', required: true, options: ['Morning (08:00–10:00)', 'Late morning (10:00–12:00)', 'Early afternoon (13:00–14:30)', 'Afternoon (14:30–16:00)'] },
      { name: 'alternateDate', label: 'Alternate date (optional)', type: 'date', required: false },
      { name: 'numberOfPeople', label: 'Number of people attending', type: 'number', required: true, placeholder: '1' },
      { name: 'priorityLane', label: 'Priority assistance', type: 'select', required: false, options: ['None', 'Elderly (65+)', 'Person with disability', 'Pregnant', 'With infant'] },
    ] },
  ],
};

export default form;
