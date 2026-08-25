// Marriage certificate — General Register Office (GRO).
const form = {
  sections: [
    { title: 'Marriage details', fields: [
      { name: 'party1', label: 'First party — full name', type: 'text', required: true },
      { name: 'party1Maiden', label: 'First party — maiden name (if any)', type: 'text', required: false },
      { name: 'party2', label: 'Second party — full name', type: 'text', required: true },
      { name: 'dateOfMarriage', label: 'Date of marriage', type: 'date', required: true },
      { name: 'placeOfMarriage', label: 'Place of marriage', type: 'text', required: true },
      { name: 'marriageOfficer', label: 'Marriage officer / church (if known)', type: 'text', required: false },
      { name: 'registrationDistrict', label: 'Registration district (if known)', type: 'text', required: false },
    ] },
    { title: 'Requester', fields: [
      { name: 'relationship', label: 'Your relationship', type: 'select', required: true, options: ['Party to the marriage', 'Child', 'Legal representative'] },
      { name: 'requesterName', label: 'Your full name', type: 'text', required: true },
      { name: 'phone', label: 'Contact number', type: 'tel', required: true },
    ] },
    { title: 'Your request', fields: [
      { name: 'purpose', label: 'Purpose of request', type: 'select', required: true, options: ['Passport', 'Immigration', 'Bank', 'Name change', 'Other'] },
      { name: 'copies', label: 'Number of certified copies', type: 'number', required: true },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'Your National ID', type: 'file', docType: 'national_id', required: true },
    ] },
  ],
};

export default form;
