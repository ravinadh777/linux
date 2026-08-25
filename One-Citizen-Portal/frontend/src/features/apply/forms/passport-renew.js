// Passport renewal — Central Immigration & Passport Office (CIPO).
const form = {
  sections: [
    { title: 'Applicant', fields: [
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Rev'] },
      { name: 'surname', label: 'Surname', type: 'text', required: true },
      { name: 'givenNames', label: 'Given name(s)', type: 'text', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
    ] },
    { title: 'Current passport', fields: [
      { name: 'priorPassportNo', label: 'Current passport number', type: 'text', required: true, placeholder: 'R1234567' },
      { name: 'issueDate', label: 'Date of issue', type: 'date', required: true },
      { name: 'expiryDate', label: 'Date of expiry', type: 'date', required: true },
      { name: 'placeOfIssue', label: 'Place of issue', type: 'text', required: false },
      { name: 'bookletType', label: 'Booklet type', type: 'select', required: true, options: ['Standard (32 pages)', 'Frequent traveller (64 pages)'] },
      { name: 'reason', label: 'Reason for renewal', type: 'select', required: true, options: ['Expired', 'Expiring soon', 'Pages full', 'Damaged', 'Change of particulars'] },
    ] },
    { title: 'Address & collection', fields: [
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'street', label: 'Street / scheme', type: 'text', required: true },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'collectionOffice', label: 'Collection office', type: 'select', required: true, options: ['CIPO Georgetown (Camp Street)', 'CIPO Berbice (New Amsterdam)', 'CIPO Essequibo (Anna Regina)'] },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docPassport', label: 'Current passport (bio page)', type: 'file', docType: 'passport', required: true },
      { name: 'docNationalId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
      { name: 'docPhoto', label: 'Passport-size photograph', type: 'file', docType: 'passport_photo', required: true },
    ] },
  ],
};

export default form;
