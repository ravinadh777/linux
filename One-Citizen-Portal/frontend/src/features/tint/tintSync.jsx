import { useQuery } from '@tanstack/react-query';
import {
  health, createApplication, updateDraft, submitApplication, deleteApplication,
  checkVehicleEligibility, uploadDocument, getMe,
  listAllApplications, getApplication, getApprovalLetter, downloadBlob,
  tintError, TINT_BASE_URL, TINT_ENV, TINT_IS_PRODUCTION,
} from './api/tintClient.js';
import { tintAuthStatus } from './api/tintAuth.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOHA Tint Waiver — DIRECT integration.
//
// The browser calls the MOHA Applicant API itself (see api/tintClient.js): no portal
// backend service, no proxy route. Base URL and bearer come from Vite env
// (VITE_TINT_ENV / VITE_TINT_API_BASE_URL / VITE_TINT_DEV_TOKEN).
//
// ── MOHA IS THE SYSTEM OF RECORD ──────────────────────────────────────────────
// For the two Tint services NO portal API is used for application data. Drafts,
// documents, submission, listing, status and the approval letter all live in MOHA:
//
//   draft      POST/PUT /v1/applications   (status 'Draft')   — not application_drafts
//   documents  POST /v1/uploads/sign + PUT — not the portal vault
//   submit     PUT /v1/applications/:id    (status 'Submitted')
//   list       GET /v1/applications        — not /api/v1/applications
//   prefill    GET /v1/me                  — not the portal profile
//   letter     GET /v1/applications/:id/approval-letter.pdf
//
// The portal still supplies the shell — catalogue entry, routing, the shared ApplyPage
// stepper and its validation gate — because that is UI, not data.
//
// ── CONSEQUENCE OF THE TOKEN NOT WORKING ──────────────────────────────────────
// Because MOHA is now the only store, a 401 means the citizen's work is NOT saved
// anywhere. There is deliberately no portal fallback. So every failure is surfaced
// LOUDLY and immediately rather than swallowed: an unsaved draft that reports success
// is far worse than one that reports failure, and the citizen must know to stop rather
// than keep typing into a form that cannot persist.
// ─────────────────────────────────────────────────────────────────────────────

export const TINT_SERVICE_IDS = ['tint-waiver-individual', 'tint-waiver-organization'];
export const isTintService = (serviceId) => TINT_SERVICE_IDS.includes(serviceId);

/** Portal service id → the MOHA `applicationType` discriminator. */
const TYPE_FOR = {
  'tint-waiver-individual': 'Individual',
  'tint-waiver-organization': 'Organization',
};

// ── Payload mapping ──────────────────────────────────────────────────────────
// Only keys MOHA reads are forwarded. Sending unknown keys to a government API is how
// you get silently-stored junk that nobody can explain later.

const INDIVIDUAL_KEYS = [
  'firstName', 'lastName', 'middleName', 'addressLine1', 'addressLine2',
  'employmentStatus', 'profession', 'employerName', 'employerAddressLine1',
  'employerAddressLine2', 'employerTelNo',
  'exemptionCategory', 'medicalCondition',
  'registeredOwner', 'vehicleType', 'chassisNumber', 'registrationNumber',
  'vehicleColour', 'vehicleMake', 'vehicleModel', 'vehicleYear',
  'driversLicenceNumber', 'driversLicenceExpiry',
  'motorVehicleLicenceNumber', 'motorVehicleLicenceExpiry',
  'fitnessCertificateNumber', 'fitnessCertificateExpiry',
  'declarationName', 'declarationAccepted',
];

const ORGANIZATION_KEYS = [
  'organizationName', 'organizationAddressLine1', 'organizationAddressLine2',
  'contactPersonName', 'contactPersonPosition', 'contactTelNo', 'contactEmail',
  'exemptionCategory', 'medicalCondition',
  'declarationName', 'declarationAccepted',
];

/** The eight keys per row of the org `vehicles[]` array — verbatim from the payload. */
const ORG_VEHICLE_KEYS = [
  'registrationNumber', 'vehicleType', 'vehicleColour', 'vehicleMake',
  'vehicleModel', 'vehicleYear', 'chassisNumber', 'registeredOwner',
];

/**
 * Build the MOHA `formData` from the portal's form values.
 *
 * `applicationType` is always present — MOHA branches on it. Empty values are dropped
 * rather than sent as '': a blank string is noise, and some APIs reject '' outright on
 * a date field.
 *
 * @param {string} serviceId
 * @param {object} formValues  the portal form values
 * @param {object[]} [documents]  [{ field, label, type, documentId, filename, storagePath? }]
 */
export function toMohaFormData(serviceId, formValues, documents = []) {
  const applicationType = TYPE_FOR[serviceId];
  if (!applicationType) throw new Error(`${serviceId} is not a Tint Waiver service.`);
  const src = formValues || {};
  const keys = applicationType === 'Organization' ? ORGANIZATION_KEYS : INDIVIDUAL_KEYS;

  const out = { applicationType };
  for (const k of keys) {
    const v = src[k];
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }

  if (applicationType === 'Organization') {
    out.vehicles = (Array.isArray(src.vehicles) ? src.vehicles : [])
      // A wholly-empty row is the repeater's initial state, not a vehicle.
      .filter((row) => row && ORG_VEHICLE_KEYS.some((k) => row[k]))
      .map((row) => Object.fromEntries(ORG_VEHICLE_KEYS.map((k) => [k, row[k] ?? ''])));
  }

  if (documents.length) {
    out.documents = documents.map((d) => ({
      field: d.field,
      label: d.label,
      type: d.type,
      // `storagePath` is what MOHA's own signed-URL upload produces. Where a document
      // came through the portal vault instead, its origin is stated explicitly rather
      // than dressed up as a MOHA path.
      ...(d.storagePath
        ? { storagePath: d.storagePath, source: 'moha-upload' }
        : { portalDocumentId: d.documentId, filename: d.filename, source: 'onecitizen-vault' }),
    }));
  }
  return out;
}

// ── Connector state ──────────────────────────────────────────────────────────

/** Liveness + credential state. Powers the honest notice on the apply screen. */
export function useTintConnector(enabled = true) {
  const auth = tintAuthStatus();
  const q = useQuery({
    queryKey: ['tint', 'health', TINT_BASE_URL],
    queryFn: health,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
  return {
    baseUrl: TINT_BASE_URL,
    env: TINT_ENV,
    isProduction: TINT_IS_PRODUCTION,
    tokenConfigured: auth.configured,
    // Deliberately never asserted true from a health check — health needs no auth, so
    // a 200 says nothing about the credential. Only a successful authenticated call
    // proves the token, and that is reported per-call.
    tokenVerified: false,
    reachable: q.isSuccess,
    checking: q.isLoading,
    reason: q.error ? tintError(q.error) : null,
  };
}

// ── The hand-off ─────────────────────────────────────────────────────────────

/**
 * Submit a portal application to MOHA.
 *
 * NEVER throws. Returns a structured outcome so the caller records it and moves on —
 * the citizen's portal application is already committed by the time this runs.
 *
 * Idempotent where it matters: pass an existing `remoteId` and it PUTs rather than
 * POSTing again, so a retry cannot create a duplicate government application.
 *
 * @returns {Promise<{synced: boolean, status: 'submitted'|'pending', remoteId?, remoteReference?, remoteStatus?, reason?, code?, attemptedPayload?}>}
 */
export async function submitToMoha({ serviceId, formValues, documents = [], remoteId = null }) {
  let formData;
  try {
    formData = toMohaFormData(serviceId, formValues, documents);
  } catch (err) {
    return { synced: false, status: 'pending', reason: err.message, code: 'mapping_error' };
  }

  try {
    const result = remoteId
      ? await submitApplication(remoteId, formData)
      // A single POST with status 'Submitted' — the collection documents this as the
      // immediate-submit path, so there is no reason to create a Draft and then update
      // it just to reach the same state.
      : await createApplication({ status: 'Submitted', formData });
    return {
      synced: true,
      status: 'submitted',
      remoteId: result?.id || result?.applicationId || remoteId || null,
      remoteReference: result?.referenceNumber || result?.refNumber || result?.reference || null,
      remoteStatus: result?.status || 'Submitted',
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      synced: false,
      status: 'pending',
      reason: tintError(err),
      code: err?.response?.data?.error?.code || err?.code || 'request_failed',
      httpStatus: err?.response?.status || 0,
      attemptedAt: new Date().toISOString(),
      // Kept so a later retry re-sends exactly what was attempted and an operator can
      // see precisely what MOHA rejected without re-deriving it.
      attemptedPayload: { status: 'Submitted', formData },
    };
  }
}

/** Save a Draft to MOHA. Same never-throw contract as submitToMoha. */
export async function saveDraftToMoha({ serviceId, formValues, documents = [], remoteId = null }) {
  try {
    const formData = toMohaFormData(serviceId, formValues, documents);
    const result = remoteId
      ? await updateDraft(remoteId, formData)
      : await createApplication({ status: 'Draft', formData });
    return {
      synced: true,
      status: 'draft',
      remoteId: result?.id || result?.applicationId || remoteId || null,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { synced: false, status: 'pending', reason: tintError(err), code: err?.response?.data?.error?.code || 'request_failed' };
  }
}

// ── Draft transport (MOHA is the store, not the portal) ──────────────────────

/**
 * Drop-in transport for useApplicationDraft, backed entirely by the MOHA Applicant
 * API. For the two Tint services the portal's own `application_drafts` table is NOT
 * used at all — MOHA is the system of record for a waiver, so its draft is the draft.
 *
 * The hook's shape is `{ form, documents, activeStep }`; MOHA's is
 * `{ status, formData }`. The mapping lives here so neither side has to know about
 * the other. `activeStep` and the portal's document metadata are round-tripped inside
 * `formData` under `__ui`, which MOHA stores and returns untouched — that is what lets
 * a citizen resume on the exact section with their uploads intact.
 *
 * The remote application id is held per service id, because MOHA identifies a draft by
 * its own id while the hook is keyed on the service.
 */
const remoteIdByService = new Map();
export const getRemoteId = (serviceId) => remoteIdByService.get(serviceId) || null;
export const setRemoteId = (serviceId, id) => { if (id) remoteIdByService.set(serviceId, id); };
export const clearRemoteId = (serviceId) => remoteIdByService.delete(serviceId);

export const mohaDraftTransport = {
  /**
   * Find this citizen's existing Draft for the service. MOHA has no
   * "get my draft for service X", so the list is filtered by applicationType —
   * cursor-paginated, newest first, and only Drafts are resumable.
   */
  async load(serviceId) {
    const wanted = TYPE_FOR[serviceId];
    if (!wanted) return null;
    const items = await listAllApplications({ pageSize: 50, maxPages: 3 });
    const mine = items.find((a) => String(a.status) === 'Draft'
      && (a.formData?.applicationType === wanted || a.applicationType === wanted));
    if (!mine) return null;
    setRemoteId(serviceId, mine.id);
    // Detail carries formData; the list deliberately does not.
    const full = mine.formData ? mine : await getApplication(mine.id);
    const fd = full?.formData || {};
    const { __ui, ...form } = fd;
    return {
      form,
      documents: __ui?.documents || {},
      activeStep: __ui?.activeStep ?? 0,
      lastSavedAt: full?.updatedAt || full?.createdAt || null,
    };
  },

  /** Create the Draft on first save, update it thereafter. */
  async save(serviceId, payload) {
    const formData = {
      ...toMohaFormData(serviceId, payload.form || {}, docsToArray(payload.documents)),
      // Portal-only UI state, round-tripped so resume lands on the right section with
      // uploads intact. Namespaced so it cannot collide with a MOHA field.
      __ui: { activeStep: payload.activeStep ?? 0, documents: payload.documents || {} },
    };
    const existing = getRemoteId(serviceId);
    const saved = existing
      ? await updateDraft(existing, formData)
      : await createApplication({ status: 'Draft', formData });
    setRemoteId(serviceId, saved?.id || saved?.applicationId || existing);
    return { lastSavedAt: saved?.updatedAt || new Date().toISOString() };
  },

  /** Discard. Only legal while Draft, which is the only state this is reached in. */
  async remove(serviceId) {
    const existing = getRemoteId(serviceId);
    if (!existing) return true;
    await deleteApplication(existing);
    remoteIdByService.delete(serviceId);
    return true;
  },
};

/** docMeta map → the `documents[]` array shape toMohaFormData expects. */
function docsToArray(docMeta) {
  return Object.entries(docMeta || {}).map(([field, meta]) => ({
    field, label: meta?.label, type: meta?.type, ...meta,
  }));
}

// ── Documents ────────────────────────────────────────────────────────────────

/**
 * MOHA's `purpose` for a given form field. Sent to /v1/uploads/sign and used by MOHA
 * to file the document against the right requirement, so it is mapped explicitly
 * rather than passing the portal's own docType through.
 */
const PURPOSE_BY_FIELD = {
  docRequestLetter: 'request_letter',
  docSupporting: 'supporting_document',
  docDriversLicence: 'drivers_licence',
  docMotorVehicleLicence: 'motor_vehicle_licence',
  docRegistration: 'vehicle_registration',
  docVehicleFitness: 'fitness_certificate',
};

/**
 * Build the uploader for one document field.
 *
 * Passed to DocumentUpload as `uploader`, which REPLACES the portal vault upload
 * entirely — for a Tint waiver MOHA is the system of record and the portal keeps no
 * copy. It resolves the document meta (including `storagePath`, which is what goes
 * into `formData.documents[]`).
 *
 * It rejects rather than swallowing, because with no vault fallback a failure here
 * means the file was never stored anywhere. DocumentUpload shows the message, and
 * `apiError` reads the same `{error:{message}}` envelope MOHA uses, so the citizen
 * sees MOHA's own reason rather than a generic failure.
 *
 * KNOWN UPSTREAM DEFECT (verified 17 Aug 2026): POST /v1/uploads/sign returns
 * 500 signing_failed on MOHA staging for every purpose, including MOHA's own
 * documented example body. The route exists and our request shape matches their
 * Postman collection verbatim, so this is their signer, not our call. Until MOHA fix
 * it, document uploads cannot complete and the required-document gate will hold the
 * citizen at Section D.
 */
export function mohaUploadFor(field) {
  const purpose = PURPOSE_BY_FIELD[field?.name] || 'other';
  return async (file) => {
    const res = await uploadDocument(file, purpose);
    // `documentId` is set to the storagePath so the shared form gate (which checks for
    // a truthy document id) is satisfied by a MOHA upload alone — there is no portal
    // vault record for a Tint document.
    return {
      documentId: res.storagePath,
      storagePath: res.storagePath,
      filename: res.filename,
      fileSize: res.size,
      mohaMimeType: res.mimeType,
      mohaPurpose: purpose,
    };
  };
}

/**
 * Vehicle duplicate check. Advisory: a failure returns `canApply: null` so the form can
 * say "could not check" rather than blocking a citizen over an integration problem, or
 * worse, implying the vehicle is fine.
 */
export async function checkTintEligibility(registrationNumber) {
  const reg = String(registrationNumber || '').trim().toUpperCase();
  if (!reg) return null;
  try {
    const data = await checkVehicleEligibility(reg);
    return { registrationNumber: reg, canApply: data?.canApply ?? null, checked: true, reason: data?.reason || null };
  } catch (err) {
    return { registrationNumber: reg, canApply: null, checked: false, reason: tintError(err) };
  }
}

/**
 * Section A prefill from MOHA's own profile (`GET /v1/me`), not the portal profile —
 * MOHA is the system of record for a Tint applicant. Tolerant of shape because the
 * collection does not document the response; a missing value leaves the field EMPTY
 * for the citizen to fill rather than inventing one.
 */
export async function mohaPrefill() {
  try {
    const me = await getMe();
    const u = me?.user || me?.profile || me || {};
    const full = String(u.displayName || u.name || '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    const pick = (...keys) => keys.map((k) => u[k]).find((v) => v != null && String(v).trim() !== '') || '';
    const out = {
      firstName: pick('firstName', 'givenName') || (parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || ''),
      lastName: pick('lastName', 'surname', 'familyName') || (parts.length > 1 ? parts.at(-1) : ''),
      middleName: pick('middleName'),
      addressLine1: pick('addressLine1', 'address1', 'address'),
      addressLine2: pick('addressLine2', 'address2', 'city', 'town'),
    };
    return { ok: true, values: Object.fromEntries(Object.entries(out).filter(([, v]) => v !== '')) };
  } catch (err) {
    // Non-fatal: the citizen types their own details. Reported so the UI can say the
    // profile could not be loaded rather than silently showing a blank form.
    return { ok: false, values: {}, reason: tintError(err) };
  }
}

// ── Applications, statuses and actions ───────────────────────────────────────
//
// MOHA is the store, so this is the ONLY source of a citizen's tint applications —
// the portal keeps no row for them. Everything the tracking screens and the dashboard
// need is normalised here once, rather than each screen learning MOHA's shape.
//
// This replaces the old `__tintSync` marker, which belonged to the earlier dual-write
// design: nothing writes it any more, so anything reading it was permanently invisible.

/** React-query key for the citizen's tint applications. Exported so mutations elsewhere can invalidate it. */
export const TINT_APPLICATIONS_KEY = ['tint', 'applications'];

/** Portal-facing shape, normalised from whatever MOHA returns. */
function normalise(raw) {
  const status = String(raw?.status || 'Draft');
  const type = raw?.formData?.applicationType || raw?.applicationType || 'Individual';
  const vehicles = raw?.formData?.vehicles;
  return {
    id: raw?.id || raw?.applicationId,
    // A Draft has no reference yet — MOHA allocates one on submit. Showing a
    // placeholder that looks like a reference would be worse than showing none.
    reference: raw?.referenceNumber || raw?.refNumber || raw?.reference || null,
    applicationType: type,
    serviceId: type === 'Organization' ? 'tint-waiver-organization' : 'tint-waiver-individual',
    serviceName: `Tint Waiver (${type})`,
    status,
    isDraft: status === 'Draft',
    isApproved: /approved|issued|completed/i.test(status),
    needsRevision: /revision|returned|more info/i.test(status),
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || raw?.createdAt || null,
    submittedAt: raw?.submittedAt || (status !== 'Draft' ? raw?.updatedAt || raw?.createdAt : null),
    // Org applications get one certificate per vehicle, addressed by index.
    vehicleCount: Array.isArray(vehicles) ? vehicles.length : (raw?.vehicleCount || 0),
    formData: raw?.formData || null,
    raw,
  };
}

/** MOHA status → the portal's existing StatusChip vocabulary, so tint rows look native. */
export function tintStatusForChip(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'draft') return 'pending';
  if (/approved|issued|completed/.test(s)) return 'approved';
  if (/reject|declin/.test(s)) return 'rejected';
  if (/revision|returned|more info/.test(s)) return 'docs';
  return 'submitted';
}

/**
 * Every tint application for the signed-in citizen, plus the counts the dashboard
 * needs. Disabled when no token is configured, so a portal without the MOHA
 * credential shows an honest notice rather than erroring on every screen.
 */
export function useTintApplications({ enabled = true } = {}) {
  const configured = tintAuthStatus().configured;
  const q = useQuery({
    queryKey: TINT_APPLICATIONS_KEY,
    queryFn: async () => (await listAllApplications({ pageSize: 50, maxPages: 5 })).map(normalise),
    enabled: enabled && configured,
    retry: 0,
    staleTime: 30 * 1000,
  });

  const items = q.data || [];
  return {
    ...q,
    items,
    configured,
    // `unavailable` is distinct from "no applications". One means we could not ask;
    // the other means the citizen genuinely has none. The UI must not conflate them —
    // telling someone they have no applications when we simply could not reach the
    // service is the kind of wrong answer people act on.
    unavailable: !configured || !!q.error,
    reason: !configured
      ? 'The Tint Waiver service is not connected, so your tint applications cannot be shown.'
      : q.error ? tintError(q.error) : null,
    counts: {
      total: items.length,
      drafts: items.filter((a) => a.isDraft).length,
      submitted: items.filter((a) => !a.isDraft).length,
      pending: items.filter((a) => !a.isDraft && !a.isApproved && !a.needsRevision).length,
      needsRevision: items.filter((a) => a.needsRevision).length,
      approved: items.filter((a) => a.isApproved).length,
    },
  };
}

/** Full detail including formData — GET /v1/applications/:id. Drives the detail screen. */
export function useTintApplication(id) {
  return useQuery({
    queryKey: [...TINT_APPLICATIONS_KEY, id],
    queryFn: async () => normalise(await getApplication(id)),
    enabled: !!id && tintAuthStatus().configured,
    retry: 0,
  });
}

/**
 * Discard a Draft — DELETE /v1/applications/:id. Only legal while Draft, which is why
 * the UI only offers it on draft rows.
 */
export async function discardTintApplication(id, serviceId) {
  await deleteApplication(id);
  // Clear the cached remote id, or the next visit to that service would try to PUT an
  // application that no longer exists instead of starting a fresh Draft.
  if (serviceId) clearRemoteId(serviceId);
  return true;
}

/**
 * Download an approval letter — GET /v1/applications/:id/approval-letter.pdf.
 * Needs the bearer, so a plain <a href> would 401; the blob is fetched and saved.
 * Org applications carry one certificate per vehicle, hence `vehicleIndex`.
 */
export async function downloadApprovalLetter(id, { vehicleIndex, filename } = {}) {
  const blob = await getApprovalLetter(id, vehicleIndex);
  const suffix = Number.isInteger(vehicleIndex) ? `-vehicle-${vehicleIndex + 1}` : '';
  downloadBlob(blob, filename || `tint-waiver-${id}${suffix}.pdf`);
}
