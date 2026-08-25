// Motor vehicle licence renewal — Guyana Revenue Authority (GRA).
const form = {
  sections: [
    { title: 'Registered owner', fields: [
      { name: 'fullName', label: "Owner's full name", type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'tin', label: 'TIN', type: 'text', required: true },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
    ] },
    { title: 'Vehicle', fields: [
      { name: 'regNumber', label: 'Registration number', type: 'text', required: true, placeholder: 'PXX 1234' },
      { name: 'make', label: 'Make', type: 'text', required: true },
      { name: 'model', label: 'Model', type: 'text', required: true },
      { name: 'year', label: 'Year of manufacture', type: 'number', required: true },
      { name: 'colour', label: 'Colour', type: 'text', required: true },
      { name: 'engineNumber', label: 'Engine number', type: 'text', required: false },
      { name: 'chassisNumber', label: 'Chassis / VIN number', type: 'text', required: false },
      { name: 'vehicleClass', label: 'Vehicle class', type: 'select', required: true, options: ['Private car', 'Hire car', 'Minibus', 'Lorry', 'Motor cycle', 'Special vehicle'] },
      { name: 'fuelType', label: 'Fuel type', type: 'select', required: false, options: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] },
    ] },
    { title: 'Insurance & fitness', fields: [
      { name: 'insurer', label: 'Insurer', type: 'text', required: true },
      { name: 'policyNo', label: 'Policy number', type: 'text', required: true },
      { name: 'insuranceExpiry', label: 'Insurance expiry date', type: 'date', required: true },
      { name: 'fitnessCertNo', label: 'Fitness certificate number', type: 'text', required: false },
      { name: 'fitnessExpiry', label: 'Fitness expiry date', type: 'date', required: false },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docReg', label: 'Vehicle registration', type: 'file', docType: 'vehicle_registration', required: true },
      { name: 'docInsurance', label: 'Certificate of insurance', type: 'file', docType: 'insurance_certificate', required: true },
      { name: 'docFitness', label: 'Certificate of fitness', type: 'file', docType: 'fitness_certificate', required: false },
    ] },
  ],
};

export default form;
