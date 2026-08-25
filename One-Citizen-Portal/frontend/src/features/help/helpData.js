// Static help content for the citizen support area. Guyana-specific, plain-language.
// (Phone numbers/addresses are representative for the reference build.)

export const HELPDESK = {
  hotline: '+592 227 0000',
  whatsapp: '+592 600 0000',
  email: 'support@onecitizen.gov.gy',
  hours: 'Mon–Fri, 08:00–16:30',
};

export const AGENCY_CONTACTS = [
  { code: 'CIPO', name: 'Central Immigration & Passport Office', phone: '+592 225 1744', email: 'info@cipo.gov.gy', for: 'Passports, immigration' },
  { code: 'GRO', name: 'General Register Office', phone: '+592 227 5846', email: 'info@gro.gov.gy', for: 'Birth, death & marriage certificates' },
  { code: 'GRA', name: 'Guyana Revenue Authority', phone: '+592 227 6060', email: 'gra-info@gra.gov.gy', for: 'TIN, driver & vehicle licences, tax' },
  { code: 'MHSSS', name: 'Ministry of Human Services & Social Security', phone: '+592 227 6117', email: 'info@mhsss.gov.gy', for: 'Pension, public assistance, grants' },
  { code: 'MoHW', name: 'Ministry of Housing & Water', phone: '+592 223 7521', email: 'info@mohw.gov.gy', for: 'Construction permits, utilities' },
];

export const CENTERS = [
  { name: 'oneCitizen Service Centre — Georgetown', region: 'Region 4 (Demerara-Mahaica)', address: '1 Water Street, Georgetown', hours: 'Mon–Fri 08:00–16:30', services: ['Passports', 'Certificates', 'TIN & licences', 'Payments'] },
  { name: 'CIPO Passport Office', region: 'Region 4 (Demerara-Mahaica)', address: 'Camp Street, Georgetown', hours: 'Mon–Fri 08:00–15:00', services: ['New passport', 'Passport renewal', 'Biometrics'] },
  { name: 'General Register Office', region: 'Region 4 (Demerara-Mahaica)', address: 'GPO Building, Robb Street, Georgetown', hours: 'Mon–Fri 08:00–15:30', services: ['Birth certificate', 'Death certificate', 'Marriage certificate'] },
  { name: 'GRA Licence Revenue Office', region: 'Region 4 (Demerara-Mahaica)', address: '200-201 Camp Street, Georgetown', hours: 'Mon–Fri 08:00–15:00', services: ["Driver's licence", 'Vehicle licence', 'TIN'] },
  { name: 'Regional Service Centre — New Amsterdam', region: 'Region 6 (East Berbice-Corentyne)', address: 'Main & Vryheid Streets, New Amsterdam', hours: 'Mon–Fri 08:00–16:00', services: ['Certificates', 'Pension', 'Payments'] },
  { name: 'Regional Service Centre — Anna Regina', region: 'Region 2 (Pomeroon-Supenaam)', address: 'Anna Regina, Essequibo Coast', hours: 'Mon–Fri 08:00–16:00', services: ['Passports (intake)', 'Certificates', 'Pension'] },
  { name: 'Regional Service Centre — Linden', region: 'Region 10 (Upper Demerara-Berbice)', address: 'Republic Avenue, Mackenzie, Linden', hours: 'Mon–Fri 08:00–16:00', services: ['Certificates', 'Licences', 'Payments'] },
];

export const FAQ_GROUPS = [
  {
    category: 'Passports',
    items: [
      { q: 'What do I need for a first-time passport?', a: 'Your National ID card, birth certificate, one passport-size photograph, and the application fee. Married applicants should also attach their marriage certificate. You will attend a biometrics appointment after applying.' },
      { q: 'How long does a passport take?', a: 'Standard processing is typically 10–15 working days after biometrics. Express (expedited fee) is faster. You can follow progress under Tracking.' },
      { q: 'Can I renew before my passport expires?', a: 'Yes. You can renew when your passport is expiring soon, is full, or is damaged. Select the matching reason on the renewal form.' },
    ],
  },
  {
    category: 'Certificates (Birth / Death / Marriage)',
    items: [
      { q: 'Can I request a certificate for a family member?', a: 'Yes, if you are a close relative or legal representative. You will need to state your relationship and upload your own National ID; third-party requests may need a supporting document.' },
      { q: 'How many certified copies can I request?', a: 'You choose the number of certified copies on the request form. A search fee may apply if the record needs to be located.' },
    ],
  },
  {
    category: 'Payments',
    items: [
      { q: 'How can I pay government fees?', a: 'You can pay by card, Mobile Money (MMG), bank transfer, or over the counter at a service centre. A receipt with a QR code is issued for every payment.' },
      { q: 'Is my payment secure?', a: 'Yes. Payments are processed on secure rails and reconciled per agency. You always receive a verifiable receipt, and no money moves without an accountable officer’s release for disbursements.' },
      { q: 'What if a payment fails?', a: 'If a gateway is unavailable you can pay over the counter. Failed electronic payments are not charged; retry or use an alternate channel.' },
    ],
  },
  {
    category: 'Pension & Benefits',
    items: [
      { q: 'Who qualifies for the old-age pension?', a: 'All Guyanese residents aged 65 and over qualify universally. Apply with your National ID and choose how you would like to be paid (bank, Mobile Money, or post office).' },
      { q: 'What is public assistance?', a: 'Support for low-income households and people facing hardship, illness or disability. A case officer reviews your circumstances before a decision.' },
    ],
  },
  {
    category: 'Appointments',
    items: [
      { q: 'How do I book an appointment?', a: 'Choose “Book an Appointment”, pick an office and day, then select an available time slot. Your slot is locked to you the moment you confirm.' },
      { q: 'Can I reschedule?', a: 'Yes — cancel your current slot and book another available time. The freed slot returns to the calendar immediately.' },
    ],
  },
  {
    category: 'Your account',
    items: [
      { q: 'How do I update my contact details?', a: 'Open “My Profile” to update your phone, email and address. Verified details like your name and National ID are managed by the issuing agency.' },
      { q: 'Do I have to fill every form myself?', a: 'No. Forms pre-fill from your oneCitizen profile, and AskGov can draft the rest — you always review and confirm before submitting.' },
    ],
  },
];
