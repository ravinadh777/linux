import { REGIONS } from './regions.js';

// Construction permit + coordinated utilities — One Home Guyana (MoHW).
const form = {
  sections: [
    { title: 'Applicant', fields: [
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr'] },
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'tin', label: 'TIN', type: 'text', required: false },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
    ] },
    { title: 'Premise', fields: [
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
      { name: 'ndc', label: 'NDC / Municipality', type: 'text', required: true },
      { name: 'block', label: 'Block', type: 'text', required: true },
      { name: 'lot', label: 'Lot number', type: 'text', required: true },
      { name: 'streetAddress', label: 'Street address', type: 'text', required: true },
      { name: 'nearWaterway', label: 'Is the lot within 50m of a river / canal / waterway?', type: 'select', required: true, options: ['No', 'Yes'], help: 'Waterway sites trigger an environmental (EPA) review lane.' },
    ] },
    { title: 'Land tenure', fields: [
      { name: 'tenureType', label: 'Land tenure', type: 'select', required: true, options: ['Transport', 'Certificate of Title', 'State/Government Lease', 'CH&PA Agreement of Sale'] },
      { name: 'titleNumber', label: 'Title / transport / lease number', type: 'text', required: true },
      { name: 'landArea', label: 'Land area (sq ft)', type: 'number', required: false },
    ] },
    { title: 'Building details', fields: [
      { name: 'dwellingType', label: 'Dwelling type', type: 'select', required: true, options: ['Single-family', 'Duplex', 'Multi-family', 'Commercial', 'Mixed use'] },
      { name: 'storeys', label: 'Number of storeys', type: 'number', required: true },
      { name: 'bedrooms', label: 'Number of bedrooms', type: 'number', required: false },
      { name: 'floorArea', label: 'Floor area (sq ft)', type: 'number', required: true },
      { name: 'estimatedCost', label: 'Estimated cost (GYD)', type: 'number', required: true },
      { name: 'startDate', label: 'Planned start date', type: 'date', required: false },
      { name: 'completionDate', label: 'Expected completion date', type: 'date', required: false },
      { name: 'utilities', label: 'Utilities required', type: 'multiselect', required: true, options: ['Water (GWI)', 'Electricity (GPL)', 'Gas', 'Sewerage'] },
    ] },
    { title: 'Professionals', description: 'Optional — if a professional prepared your plans.', fields: [
      { name: 'architectName', label: 'Architect / draughtsperson', type: 'text', required: false },
      { name: 'engineerName', label: 'Structural engineer', type: 'text', required: false },
      { name: 'contractorName', label: 'Contractor', type: 'text', required: false },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docTitle', label: 'Land tenure evidence (Transport / Title)', type: 'file', docType: 'title', required: true },
      { name: 'docPlan', label: 'Building plan / drawings', type: 'file', docType: 'building_plan', required: true },
      { name: 'docSurvey', label: 'Land survey plan', type: 'file', docType: 'land_survey_plan', required: false },
      { name: 'docStructural', label: 'Structural report (multi-storey)', type: 'file', docType: 'structural_report', required: false },
      { name: 'docId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
    ] },
  ],
};

export default form;
