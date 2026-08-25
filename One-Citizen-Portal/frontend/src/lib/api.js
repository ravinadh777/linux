import axios from 'axios';
import { useAuthStore } from '../stores/authStore.js';
import { toast } from '../stores/toastStore.js';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1',
});


export const MuleSoftApi = axios.create({
  baseURL: import.meta.env.VITE_MULESOFT_API_BASE_URL,
});
// A bare client for the refresh call itself. It MUST NOT go through the
// interceptors below, or a failing refresh would trigger another refresh and
// recurse until the stack blows.
const authClient = axios.create({ baseURL: api.defaults.baseURL });

// ─────────────────────────────────────────────────────────────────────────────
// Session continuity.
//
// The access token lives 15 minutes. Before this, a 401 meant: clear the session
// and `window.location.href = '/login'` — a full document navigation that unmounted
// React and destroyed everything the citizen had typed. On a 40-field pension
// application that is the difference between a filed claim and an abandoned one.
//
// The refresh token was already being stored, and POST /auth/refresh already
// existed server-side with single-use rotation. Nothing called it. This module now
// does, in two layers:
//
//   1. PROACTIVE (see useSessionKeepAlive) — refresh at ~75% of the token's life so
//      the token is replaced before anything can 401. In normal use the citizen
//      never sees an interruption at all.
//   2. REACTIVE (here) — if a request does come back 401, refresh once and REPLAY
//      the original request. The caller's promise resolves normally, so a component
//      cannot tell the refresh happened.
//
// Only when refresh itself fails (refresh token expired after 7 days, or revoked)
// is the session genuinely over. Even then we do NOT hard-navigate: we record where
// the citizen was and let the router move them, so React state and the URL survive.
// ─────────────────────────────────────────────────────────────────────────────

/** Single-flight guard: N concurrent 401s trigger ONE refresh, not N. */
let refreshInFlight = null;

/** Set by the app so a lapsed session can navigate through the router, not the browser. */
let sessionLostHandler = null;

/**
 * Register the router-aware handler for "the session is over".
 * Called once from App; keeps this module free of react-router imports.
 * @param {(returnTo: string) => void} fn
 */
export function setSessionLostHandler(fn) { sessionLostHandler = fn; }

const currentPath = () => `${window.location.pathname}${window.location.search}`;

/**
 * Exchange the stored refresh token for a new session.
 * Concurrent callers share one in-flight request.
 * @returns {Promise<string|null>} the new access token, or null if refresh failed
 */
export async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;

  const { refreshToken } = useAuthStore.getState();
  // A MuleSoft session legitimately has no refresh token — the gateway does not issue
  // one. Returning null lets the keep-alive warn through SessionExpiryDialog and the
  // session end cleanly, rather than pretending a renewal is possible. Until the
  // gateway returns a refresh token, a MuleSoft session cannot be extended.
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const { data } = await authClient.post('/auth/refresh', { refreshToken });
      // The server rotates the refresh token (single-use), so the store must take
      // the whole new session — keeping the old refresh token would break the very
      // next refresh.
      useAuthStore.getState().setSession(data);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Cleared in `finally` so a later refresh is not permanently blocked by one
      // failure — the proactive timer is allowed to try again.
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// `clear()` intentionally wipes `returnTo`, because a deliberate sign-out should not
// resurrect a form. An EXPIRY must keep it — so expiry clears the credentials and
// sets the return path in ONE state write rather than calling clear() and then
// putting `returnTo` back (which would briefly publish a state with no return path
// and could lose the race against a subscriber reading it).
export function expireSession() {
  const store = useAuthStore.getState();
  if (store.sessionExpired) return;
  const returnTo = currentPath() === '/login' ? null : currentPath();
  useAuthStore.setState({
    accessToken: null, tokenType: 'Bearer', refreshToken: null, user: null, roles: [],
    assuranceLevel: 0, expiresAt: null,
    sessionExpired: true, returnTo,
  });
  toast.error('Your session expired. Sign in again and we will take you back to what you were doing.');
  if (sessionLostHandler) sessionLostHandler(returnTo);
  else if (window.location.pathname !== '/login') window.location.href = '/login'; // last resort
}

api.interceptors.request.use((config) => {
  const { accessToken, tokenType } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `${tokenType || 'Bearer'} ${accessToken}`;
  return config;
});

// ── MuleSoft: attach the session credential ──────────────────────────────────
// Sign-in stores the token; without this nothing would ever send it, so every
// authenticated MuleSoft call after /login would 401 with a session sitting right
// there. `/login` and `/register` are excluded because they are pre-auth — sending a
// stale bearer to the endpoint whose job is to issue a fresh one is at best noise.
//
// No response interceptor here on purpose: the MuleSoft token has no refresh
// counterpart (see refreshSession), so there is nothing a 401 handler could do to
// recover. Failing loudly beats a retry loop that cannot succeed.
const MULESOFT_PUBLIC_PATHS = /\/(login|register)$/;

MuleSoftApi.interceptors.request.use((config) => {
  if (MULESOFT_PUBLIC_PATHS.test(config.url || '')) return config;
  const { accessToken, tokenType } = useAuthStore.getState();
  if (accessToken) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `${tokenType || 'Bearer'} ${accessToken}`,
    };
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config || {};
    // Auth endpoints handle their own errors inline (wrong password, not-found →
    // register, …); don't hijack them with a session-expiry path.
    const isAuthCall = /\/auth\/(login|register|refresh)/.test(config.url || '');

    if (err.response?.status === 401 && !isAuthCall && !config.__isRetry) {
      const token = await refreshSession();
      if (token) {
        // Replay the original request with the new credential. `__isRetry` makes
        // this strictly one attempt, so a token that is somehow still rejected
        // cannot produce an infinite refresh/retry loop.
        config.__isRetry = true;
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
        return api.request(config);
      }
      expireSession();
    }
    return Promise.reject(err);
  },
);

/** Extract a human message from an API error. */
export function apiError(err) {
  return err?.response?.data?.error?.message || err?.message || 'Something went wrong';
}
