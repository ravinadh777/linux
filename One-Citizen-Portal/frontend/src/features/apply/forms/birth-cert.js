// Certified birth certificate copy — General Register Office (GRO).
const form = {
  sections: [
    { title: 'Record details', description: 'Details of the person whose birth certificate you need.', fields: [
      { name: 'personName', label: 'Full name on the record', type: 'text', required: true },
      { name: 'sex', label: 'Sex', type: 'select', required: false, options: ['Female', 'Male'] },
      { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
      { name: 'placeOfBirth', label: 'Place of birth (hospital / village)', type: 'text', required: true },
      { name: 'registrationDivision', label: 'Registration division (if known)', type: 'text', required: false },
      { name: 'mothersName', label: "Mother's name", type: 'text', required: true },
      { name: 'mothersMaidenName', label: "Mother's maiden name", type: 'text', required: false },
      { name: 'fathersName', label: "Father's name", type: 'text', required: false },
      { name: 'entryNumber', label: 'Register entry number (if known)', type: 'text', required: false },
    ] },
    { title: 'Requester', fields: [
      { name: 'relationship', label: 'Your relationship to the person', type: 'select', required: true, options: ['Self', 'Parent', 'Child', 'Sibling', 'Legal representative'] },
      { name: 'requesterName', label: 'Your full name', type: 'text', required: true },
      { name: 'requesterId', label: 'Your National ID number', type: 'text', required: true },
      { name: 'phone', label: 'Contact number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
    ] },
    { title: 'Your request', fields: [
      { name: 'purpose', label: 'Purpose of request', type: 'select', required: true, options: ['Passport', 'School enrolment', 'Employment', 'Pension', 'Travel', 'Court / legal', 'Other'] },
      { name: 'copies', label: 'Number of certified copies', type: 'number', required: true, placeholder: '1' },
      { name: 'deliveryMethod', label: 'How would you like it?', type: 'select', required: true, options: ['Collect at office', 'Postal delivery'] },
      { name: 'collectionOffice', label: 'Office', type: 'select', required: true, options: ['GRO Georgetown', 'GRO New Amsterdam', 'GRO Anna Regina', 'GRO Linden'] },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'Your National ID', type: 'file', docType: 'national_id', required: true },
      { name: 'docSupport', label: 'Supporting document (if third-party)', type: 'file', docType: 'supporting_document', required: false },
    ] },
  ],
};

export default form;
