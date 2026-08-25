// Death certificate — General Register Office (GRO).
const form = {
  sections: [
    { title: 'Deceased details', fields: [
      { name: 'personName', label: 'Full name of the deceased', type: 'text', required: true },
      { name: 'sex', label: 'Sex', type: 'select', required: false, options: ['Female', 'Male'] },
      { name: 'dateOfDeath', label: 'Date of death', type: 'date', required: true },
      { name: 'ageAtDeath', label: 'Age at death', type: 'number', required: false },
      { name: 'placeOfDeath', label: 'Place of death', type: 'text', required: true },
      { name: 'lastAddress', label: 'Last known address', type: 'text', required: false },
      { name: 'occupation', label: 'Occupation', type: 'text', required: false },
      { name: 'causeOfDeath', label: 'Cause of death (as certified)', type: 'text', required: false },
    ] },
    { title: 'Informant / requester', fields: [
      { name: 'relationship', label: 'Your relationship', type: 'select', required: true, options: ['Next of kin', 'Spouse', 'Child', 'Parent', 'Executor', 'Legal representative'] },
      { name: 'requesterName', label: 'Your full name', type: 'text', required: true },
      { name: 'phone', label: 'Contact number', type: 'tel', required: true },
    ] },
    { title: 'Your request', fields: [
      { name: 'purpose', label: 'Purpose of request', type: 'select', required: true, options: ['Estate / probate', 'Insurance', 'Pension', 'Bank', 'Other'] },
      { name: 'copies', label: 'Number of certified copies', type: 'number', required: true },
      { name: 'deliveryMethod', label: 'How would you like it?', type: 'select', required: true, options: ['Collect at office', 'Postal delivery'] },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docMedical', label: 'Medical certificate of cause of death', type: 'file', docType: 'death_certificate_medical', required: true },
      { name: 'docId', label: 'Your National ID', type: 'file', docType: 'national_id', required: true },
    ] },
  ],
};

export default form;
