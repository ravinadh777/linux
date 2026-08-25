// ─────────────────────────────────────────────────────────────────────────────
// Tint Waiver — token acquisition.
//
// THE PROBLEM THIS ISOLATES. The MOHA Tint API authenticates with a **Firebase ID
// token**. One Citizen authenticates with its own HS256 JWT minted by
// backend/src/platform/identity. They are two unrelated identity systems, and there
// is no Firebase SDK, web config or service-account key anywhere in this project.
//
// Rather than smear that problem across every call site, ALL token acquisition lives
// behind one function: `getTintToken()`. Swapping how a token is obtained is a
// change to this file only — `tintClient.js` and every screen stay untouched.
//
// ── The three viable providers, in order of production-readiness ───────────────
//
// 1. BACKEND BROKER (the shipping answer). One Citizen's backend holds a Firebase
//    service-account key for the tint project, mints a custom token for the signed-in
//    citizen, exchanges it via Identity Toolkit for an ID token, caches it ~55min and
//    hands it out at `GET /api/v1/tint/token`. The citizen never sees Firebase and
//    never signs in twice. Implemented by `brokerProvider` below — it is already
//    wired and becomes live the moment the backend route exists.
//
// 2. FIREBASE WEB SDK. Sign the citizen in against the tint project directly and read
//    `user.getIdToken()`. Needs a Firebase web config AND tint-project credentials per
//    citizen, i.e. a second login. Not implemented; it would slot in here identically.
//
// 3. DEV TOKEN (current). A token pasted into `VITE_TINT_DEV_TOKEN`, copied from the
//    Tint portal's browser console. Lives ~1 hour. This exists to prove the
//    integration end-to-end against the real API; it is explicitly NOT shippable, so
//    it refuses to activate outside dev and says so loudly.
//
// Provider selection is env-driven (`VITE_TINT_AUTH_MODE`) with no hardcoding, per
// the integration brief.
// ─────────────────────────────────────────────────────────────────────────────

const MODE = (import.meta.env?.VITE_TINT_AUTH_MODE || 'dev-token').trim();
const DEV_TOKEN = (import.meta.env?.VITE_TINT_DEV_TOKEN || '').trim();
const IS_DEV = !!import.meta.env?.DEV;

/** Thrown when no token can be obtained. Carries a fixable instruction, not a stack. */
export class TintAuthError extends Error {
  constructor(message, { actionable = true } = {}) {
    super(message);
    this.name = 'TintAuthError';
    this.actionable = actionable;
  }
}

// ── Cache ────────────────────────────────────────────────────────────────────
// A Firebase ID token lives ~1h. Re-fetching per request would be wasteful and, for
// the broker, would hammer Identity Toolkit. Cached until 5 minutes before expiry so
// a long request started just under the wire cannot land after the token dies.
const SKEW_MS = 5 * 60 * 1000;
let cached = null;      // { token, expiresAt }
let inFlight = null;    // single-flight guard

/** Read `exp` out of a JWT without verifying it — we only need the deadline. */
function expiryOf(token) {
  try {
    const [, payload] = String(token).split('.');
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims.exp ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

const isFresh = () => !!cached?.token && (!cached.expiresAt || cached.expiresAt - SKEW_MS > Date.now());

// ── Providers ────────────────────────────────────────────────────────────────

/**
 * Provider 1 — backend broker. Asks One Citizen's own API (which the citizen is
 * already authenticated to) to hand back a Firebase ID token for the tint project.
 * Uses the app's normal axios instance so the One Citizen bearer, its refresh-and-
 * replay interceptor and its session handling all apply for free.
 */
async function brokerProvider() {
  // Imported lazily so this module stays loadable in tests and on the PUBLIC landing
  // page, neither of which has (or needs) a One Citizen session.
  const { api } = await import('../../../lib/api.js');
  const { data } = await api.get('/tint/token');
  if (!data?.token) throw new TintAuthError('The Tint token service returned no token.');
  return { token: data.token, expiresAt: data.expiresAt || expiryOf(data.token) };
}

/**
 * Provider 3 — pasted dev token. Deliberately hostile to accidental production use:
 * refuses outright unless the bundle was built in dev mode, because a hardcoded
 * 1-hour credential shipped to citizens would be both broken and a leak.
 */
function devTokenProvider() {
  if (!IS_DEV) {
    throw new TintAuthError(
      'Tint is configured for a pasted development token, which cannot be used in a production build. '
      + 'Set VITE_TINT_AUTH_MODE=broker and provide the backend token service.',
      { actionable: false },
    );
  }
  if (!DEV_TOKEN) {
    throw new TintAuthError(
      'No Tint API token configured. Paste a Firebase ID token into VITE_TINT_DEV_TOKEN '
      + 'in frontend/.env and restart the dev server.',
    );
  }
  const expiresAt = expiryOf(DEV_TOKEN);
  if (expiresAt && expiresAt < Date.now()) {
    throw new TintAuthError(
      `The Tint development token in VITE_TINT_DEV_TOKEN expired at ${new Date(expiresAt).toLocaleTimeString()}. `
      + 'Copy a fresh one from the Tint portal and restart the dev server.',
    );
  }
  return { token: DEV_TOKEN, expiresAt };
}

const PROVIDERS = {
  broker: brokerProvider,
  'dev-token': devTokenProvider,
};

/**
 * The one way to get a Tint API token. Cached, single-flight, provider-agnostic.
 * @param {{ force?: boolean }} [opts] force → ignore the cache (used after a 401)
 * @returns {Promise<string>}
 */
export async function getTintToken({ force = false } = {}) {
  if (!force && isFresh()) return cached.token;
  if (inFlight) return inFlight;

  const provider = PROVIDERS[MODE];
  if (!provider) {
    throw new TintAuthError(
      `Unknown VITE_TINT_AUTH_MODE "${MODE}". Expected one of: ${Object.keys(PROVIDERS).join(', ')}.`,
      { actionable: false },
    );
  }

  inFlight = (async () => {
    try {
      const result = await provider();
      cached = { token: result.token, expiresAt: result.expiresAt || expiryOf(result.token) };
      return cached.token;
    } finally {
      // Cleared in `finally` so one failure does not permanently wedge every later
      // attempt — the next call is allowed to try again.
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Drop the cached token. Called on a 401 so the next attempt re-acquires. */
export function invalidateTintToken() {
  cached = null;
}

/** For diagnostics on the Tint screens — never used for control flow. */
export function tintAuthStatus() {
  return {
    mode: MODE,
    configured: MODE === 'broker' || (IS_DEV && !!DEV_TOKEN),
    hasToken: isFresh(),
    expiresAt: cached?.expiresAt || (MODE === 'dev-token' && DEV_TOKEN ? expiryOf(DEV_TOKEN) : null),
  };
}
