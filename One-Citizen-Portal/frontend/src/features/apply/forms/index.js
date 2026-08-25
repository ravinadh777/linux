// ── Service form registry ────────────────────────────────────────────────────
// The frontend owns every application's field definition (one file per service).
// ApplyPage maps from here — it does NOT fetch the form schema from the API.
// The backend stays a clean record store: it accepts whatever form data is submitted
// and persists it, so adding/changing fields is a frontend-only change.
import { REGIONS } from './regions.js';
import passportNew from './passport-new.js';
import passportRenew from './passport-renew.js';
import birthCert from './birth-cert.js';
import deathCert from './death-cert.js';
import marriageCert from './marriage-cert.js';
import tinRegister from './tin-register.js';
import driverLicence from './driver-licence.js';
import mvLicence from './mv-licence.js';
import oldAgePension from './old-age-pension.js';
import publicAssistance from './public-assistance.js';
import cashGrant from './cash-grant.js';
import bookAppointment from './book-appointment.js';
import constructionPermit from './construction-permit.js';
import tintWaiverIndividual from './tint-waiver-individual.js';
import tintWaiverOrganization from './tint-waiver-organization.js';

export const serviceForms = {
  'passport-new': passportNew,
  'passport-renew': passportRenew,
  'birth-cert': birthCert,
  'death-cert': deathCert,
  'marriage-cert': marriageCert,
  'tin-register': tinRegister,
  'driver-licence': driverLicence,
  'mv-licence': mvLicence,
  'old-age-pension': oldAgePension,
  'public-assistance': publicAssistance,
  'cash-grant': cashGrant,
  'book-appointment': bookAppointment,
  'construction-permit': constructionPermit,
  // MOHA → Tint Waiver Unit. Two services, so the citizen picks Individual or
  // Organization from the agency's service list rather than from a bespoke chooser.
  'tint-waiver-individual': tintWaiverIndividual,
  'tint-waiver-organization': tintWaiverOrganization,
};

// Generic fallback for any service without a bespoke form file.
export const DEFAULT_FORM = {
  sections: [
    { title: 'Applicant details', fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'nationalId', label: 'National ID number', type: 'text', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
    ] },
    { title: 'Address', fields: [
      { name: 'lot', label: 'Lot / house number', type: 'text', required: true },
      { name: 'village', label: 'Village / ward', type: 'text', required: true },
      { name: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
    ] },
    { title: 'Request', fields: [
      { name: 'notes', label: 'Additional details', type: 'textarea', required: false },
    ] },
    { title: 'Required documents', fields: [
      { name: 'docId', label: 'National ID card', type: 'file', docType: 'national_id', required: true },
    ] },
  ],
};

/** Returns the form definition for a service id (falls back to a generic form). */
export function getServiceForm(id) {
  return serviceForms[id] || DEFAULT_FORM;
}
