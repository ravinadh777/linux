import axios from 'axios';
import { getTintToken, invalidateTintToken, TintAuthError } from './tintAuth.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOHA Tint Waiver — Applicant API v1 client.
//
// A SEPARATE axios instance from `lib/api.js` on purpose. The two APIs have nothing
// in common: different origin, different identity system (Firebase ID token vs the
// portal's own HS256 JWT), different error envelope. Sharing one instance would mean
// the One Citizen request interceptor attaching the wrong bearer to MOHA calls, and
// the One Citizen 401 handler expiring the citizen's PORTAL session because a
// third-party token lapsed. They stay apart.
//
// Every endpoint gets a named wrapper below, so no screen ever assembles a URL or
// remembers which verb submits versus saves.
//
// ── Base URL is env-driven, never hardcoded ──────────────────────────────────
//   VITE_TINT_API_BASE_URL  explicit override, wins if set
//   VITE_TINT_ENV           'staging' | 'production' → the two published origins
// Defaults to staging, because the failure mode of accidentally pointing at staging
// is a missing record, and of accidentally pointing at production is a real
// government application filed against a real citizen.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGINS = {
  staging: 'https://us-central1-guyanese-tint-staging.cloudfunctions.net/api',
  production: 'https://us-central1-guyanese-tint-waiver.cloudfunctions.net/api',
};

export const TINT_ENV = (import.meta.env?.VITE_TINT_ENV || 'staging').trim();
export const TINT_BASE_URL = (import.meta.env?.VITE_TINT_API_BASE_URL || ORIGINS[TINT_ENV] || ORIGINS.staging).replace(/\/$/, '');
/** True when pointed at the live production API — screens use this to warn. */
export const TINT_IS_PRODUCTION = TINT_BASE_URL === ORIGINS.production;

export const tintHttp = axios.create({
  baseURL: TINT_BASE_URL,
  // Generous: the sign+upload round trip and the PDF stream are both slower than a
  // normal JSON call, and a government network is not a fast one.
  timeout: 45000,
});

/** Endpoints that must NOT carry a bearer. `/v1/health` is explicitly unauthenticated. */
const PUBLIC_PATHS = [/\/v1\/health$/];

tintHttp.interceptors.request.use(async (config) => {
  if (PUBLIC_PATHS.some((re) => re.test(config.url || ''))) return config;
  const token = await getTintToken();
  config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
  return config;
});

tintHttp.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config || {};
    // A Firebase ID token lives ~1h, so a long form session WILL cross the boundary.
    // Drop the cached token, re-acquire once and replay. `__tintRetry` makes this
    // strictly one attempt so a genuinely rejected credential cannot loop.
    if (err.response?.status === 401 && !config.__tintRetry && !PUBLIC_PATHS.some((re) => re.test(config.url || ''))) {
      config.__tintRetry = true;
      invalidateTintToken();
      try {
        const token = await getTintToken({ force: true });
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
        return tintHttp.request(config);
      } catch (authErr) {
        return Promise.reject(authErr);
      }
    }
    return Promise.reject(err);
  },
);

/**
 * Human message from a MOHA error. Its envelope is `{ error: { code, message } }`,
 * which is NOT the shape lib/api.js's apiError expects — hence a separate reader.
 */
export function tintError(err) {
  if (err instanceof TintAuthError) return err.message;
  const e = err?.response?.data?.error;
  if (e?.message) return e.message;
  if (typeof err?.response?.data === 'string' && err.response.data.length < 300) return err.response.data;
  if (err?.code === 'ECONNABORTED') return 'The Tint Waiver service did not respond in time. Please try again.';
  return err?.message || 'The Tint Waiver service is unavailable right now.';
}

/** Machine code from a MOHA error, for branching (e.g. `missing_token`). */
export const tintErrorCode = (err) => err?.response?.data?.error?.code || null;

// ═════════════════════════════════════════════════════════════════════════════
// Endpoints
// ═════════════════════════════════════════════════════════════════════════════

/** GET /v1/health — unauthenticated liveness. */
export const health = () => tintHttp.get('/v1/health').then((r) => r.data);

/**
 * GET /v1/me — the applicant profile. First call auto-provisions the user doc and
 * merges any prior tint account with the same email. This is the ONLY source for
 * prefilling the personal fields; nothing is invented locally.
 */
export const getMe = () => tintHttp.get('/v1/me').then((r) => r.data);

/**
 * POST /v1/vehicles/check-eligibility — server-side duplicate check.
 * @param {string} registrationNumber
 * @returns {Promise<{canApply: boolean, reason?: string}>}
 */
export const checkVehicleEligibility = (registrationNumber) =>
  tintHttp.post('/v1/vehicles/check-eligibility', { registrationNumber }).then((r) => r.data);

/**
 * The two-step document upload, as one call.
 *
 * (1) POST /v1/uploads/sign → { uploadUrl, storagePath }
 * (2) PUT the RAW FILE BYTES to uploadUrl with the EXACT Content-Type that was signed
 * (3) return storagePath, which is what goes into the application's formData
 *
 * Two things here are easy to get wrong and both break the upload silently:
 *   • The PUT must go out on a BARE axios call, not `tintHttp`. The signed URL is a
 *     Google Cloud Storage URL — attaching our Firebase bearer to it makes GCS reject
 *     the request, and the baseURL would corrupt the absolute URL.
 *   • The Content-Type must match what was signed byte-for-byte. GCS computes the
 *     signature over that header, so `image/jpg` when `image/jpeg` was signed fails.
 *     So the mimeType we send to /sign is the one we reuse on the PUT — never
 *     re-derived from the File a second time.
 *
 * @param {File} file
 * @param {string} purpose e.g. 'request_letter' | 'supporting_document' | 'drivers_licence'
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{storagePath: string, filename: string, mimeType: string, size: number}>}
 */
export async function uploadDocument(file, purpose, onProgress) {
  const mimeType = file.type || 'application/octet-stream';

  const { data: signed } = await tintHttp.post('/v1/uploads/sign', {
    filename: file.name,
    mimeType,
    purpose,
  });
  if (!signed?.uploadUrl || !signed?.storagePath) {
    throw new Error('The upload service did not return a signed URL.');
  }

  await axios.put(signed.uploadUrl, file, {
    headers: { 'Content-Type': mimeType },
    timeout: 120000, // a 10MB scan over a slow link needs more than the default
    onUploadProgress: onProgress
      ? (e) => onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0)
      : undefined,
    // Explicitly no auth header and no baseURL — see the note above.
    transformRequest: [(d) => d],
  });

  return { storagePath: signed.storagePath, filename: file.name, mimeType, size: file.size };
}

/**
 * GET /v1/applications — cursor-paginated list. Excludes formData by design, so this
 * drives the table and the KPI counts but never the form.
 * @param {{limit?: number, status?: string, cursor?: string}} [params]
 */
export const listApplications = (params = {}) => {
  const query = {};
  if (params.limit) query.limit = params.limit;
  if (params.status) query.status = params.status;
  if (params.cursor) query.cursor = params.cursor;
  return tintHttp.get('/v1/applications', { params: query }).then((r) => r.data);
};

/** Walk every page so the KPI counts reflect ALL applications, not just page one. */
export async function listAllApplications({ pageSize = 100, maxPages = 20 } = {}) {
  const items = [];
  let cursor;
  for (let page = 0; page < maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const data = await listApplications({ limit: pageSize, cursor });
    items.push(...(data?.items || data?.applications || []));
    cursor = data?.nextCursor;
    if (!cursor) break;
  }
  return items;
}

/** GET /v1/applications/:id — full detail INCLUDING formData. Drives resume. */
export const getApplication = (id) =>
  tintHttp.get(`/v1/applications/${encodeURIComponent(id)}`).then((r) => r.data);

/**
 * POST /v1/applications — create. Returns the created record; `id` is captured by
 * the draft hook and reused for every later update.
 * @param {{status:'Draft'|'Submitted', formData:object}} body
 */
export const createApplication = (body) =>
  tintHttp.post('/v1/applications', body).then((r) => r.data);

/**
 * PUT /v1/applications/:id — update a Draft, or SUBMIT it.
 *
 * The verb is the same for both; only `status` differs, which is a genuinely
 * dangerous API shape to call ad hoc. So the two intents get separate named
 * functions below and nothing else calls this directly.
 */
const putApplication = (id, body) =>
  tintHttp.put(`/v1/applications/${encodeURIComponent(id)}`, body).then((r) => r.data);

/** Save progress. Stays a Draft. */
export const updateDraft = (id, formData) => putApplication(id, { status: 'Draft', formData });

/**
 * Submit. Allocates a real TINT-YYYY-NNNNNN reference, re-runs the server-side
 * vehicle duplicate check and emails the applicant. Irreversible.
 */
export const submitApplication = (id, formData) => putApplication(id, { status: 'Submitted', formData });

/** DELETE /v1/applications/:id — discard a Draft. 204. Only legal while Draft. */
export const deleteApplication = (id) =>
  tintHttp.delete(`/v1/applications/${encodeURIComponent(id)}`).then(() => ({ deleted: true }));

/**
 * GET /v1/applications/:id/approval-letter.pdf — streams the PDF, Approved only.
 * Returned as a Blob so the caller can trigger a download without a second
 * unauthenticated request (the URL needs the bearer, so a plain <a href> would 401).
 * @param {string} id
 * @param {number} [vehicleIndex] 0-indexed, for org multi-vehicle certificates
 */
export const getApprovalLetter = (id, vehicleIndex) =>
  tintHttp.get(`/v1/applications/${encodeURIComponent(id)}/approval-letter.pdf`, {
    responseType: 'blob',
    params: Number.isInteger(vehicleIndex) ? { vehicleIndex } : undefined,
  }).then((r) => r.data);

/** Save a fetched approval-letter Blob to disk. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on a tick so Safari has actually started the download first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
