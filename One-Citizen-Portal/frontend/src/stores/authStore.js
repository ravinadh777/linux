import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// Session state.
//
// The store already held a `refreshToken` — but NOTHING in the app ever used it,
// while the access token expires after 15 minutes (JWT_ACCESS_TTL=900). The result
// was a guaranteed hard logout every quarter of an hour: api.js caught the 401,
// cleared the session and did `window.location.href = '/login'`, a full document
// navigation that tore down React and took every unsaved keystroke with it.
//
// Three additions close that hole:
//   • expiresAt      — an absolute wall-clock deadline, so the app can refresh
//                      BEFORE the token dies rather than reacting to a 401.
//   • sessionExpired — set when refresh genuinely fails (refresh token itself
//                      expired/revoked). Drives an explaining dialog instead of a
//                      silent bounce to the login page.
//   • returnTo       — where the citizen was when the session lapsed, so they land
//                      back on their in-progress form after signing in again.
//
// `returnTo` is persisted deliberately: the whole point is that it survives the
// page reload or tab close that follows a lapsed session.
// ─────────────────────────────────────────────────────────────────────────────

// ── Two providers reach setSession, and they do NOT agree ────────────────────
//
//   portal    POST /auth/login    { accessToken, refreshToken, expiresIn, user, roles }
//   MuleSoft  POST /guyana/login  { token, tokenType, expiresIn, user }   ← Keycloak
//
// MuleSoft names the credential `token`, ships NO refresh token, and carries roles
// only inside the JWT. Reading `s.accessToken` alone therefore stored `undefined` for
// a MuleSoft login — which RequireAuth reads as "not signed in", so a SUCCESSFUL
// sign-in bounced straight back to /login. Both shapes are normalised here, in the one
// place every provider already funnels through, so no screen has to know which
// identity system answered.

/** Read a JWT payload without verifying it — only the server's signature matters. */
function decodeJwt(token) {
  try {
    const [, payload] = String(token).split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** Keycloak ships plumbing roles next to real ones; these are not application roles. */
const NOISE_ROLES = /^(offline_access|uma_authorization|default-roles-)/;

/** Roles, from whichever of the three places the provider chose to put them. */
function rolesFrom(s, claims) {
  if (Array.isArray(s.roles) && s.roles.length) return s.roles;
  if (s.user?.role) return [s.user.role];
  const realm = claims?.realm_access?.roles;
  return Array.isArray(realm) ? realm.filter((r) => !NOISE_ROLES.test(r)) : [];
}

/**
 * The MuleSoft login response echoes the submitted `password` back inside `user`.
 * This store is persisted to localStorage, so keeping it would write the citizen's
 * plaintext password to disk where any script on the origin can read it. Stripped
 * here rather than at the call site, so no future caller can reintroduce it.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password, confirm, ...safe } = user;
  // The dashboard ID cards read `user.profile.*` while MuleSoft returns a flat
  // object, so the keys they need are projected across. PROJECTED, never invented —
  // fields MuleSoft does not send (licence number/class/expiry) stay absent so the
  // card renders its own placeholder instead of a confident blank.
  return {
    ...safe,
    profile: user.profile || {
      nationalId: user.nationalId,
      tin: user.tin,
      dob: user.dob,
      gender: user.gender,
      region: user.region,
    },
  };
}

/**
 * Absolute deadline for the credential.
 *
 * `expiresIn` is preferred over the JWT's own `exp` on purpose: it is RELATIVE, so it
 * survives a client clock that disagrees with the server's. An absolute `exp` read
 * against a skewed clock can look already-past and expire a brand-new session
 * instantly. When no TTL is given, the JWT's own lifetime (`exp - iat`) is used —
 * still a duration, still skew-proof.
 */
function expiresAtFrom(s, claims) {
  const ttl = Number(s.expiresIn);
  if (Number.isFinite(ttl) && ttl > 0) return Date.now() + ttl * 1000;
  if (claims?.exp && claims?.iat) return Date.now() + (claims.exp - claims.iat) * 1000;
  return Date.now() + 900 * 1000;
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      /** Scheme for the Authorization header. MuleSoft states it explicitly. */
      tokenType: 'Bearer',
      refreshToken: null,
      user: null,
      roles: [],
      assuranceLevel: 0,
      /** Epoch ms at which the access token stops being accepted. */
      expiresAt: null,
      /** True once refresh has failed — the citizen must sign in again. */
      sessionExpired: false,
      /** Path (incl. search) to return to after re-authenticating. */
      returnTo: null,

      setSession: (s) => {
        // `token` is MuleSoft's name for it, `accessToken` the portal's. Accepting
        // both is what makes a MuleSoft sign-in actually reach the dashboard.
        const accessToken = s.accessToken || s.token || null;
        const claims = decodeJwt(accessToken);
        set({
          accessToken,
          tokenType: s.tokenType || 'Bearer',
          refreshToken: s.refreshToken || null,
          user: sanitizeUser(s.user),
          roles: rolesFrom(s, claims),
          assuranceLevel: s.assuranceLevel || 2,
          expiresAt: expiresAtFrom(s, claims),
          sessionExpired: false,
        });
      },

      setUser: (user) => set({ user }),

      /** Milliseconds until the access token expires (negative once it has). */
      msUntilExpiry: () => {
        const exp = get().expiresAt;
        return exp ? exp - Date.now() : Infinity;
      },

      /** Remember where to come back to, before we send the citizen to sign in. */
      markExpired: (returnTo) => set({ sessionExpired: true, returnTo: returnTo || null }),

      /** Consume the stored return path (one-shot, so a later sign-in is not hijacked). */
      takeReturnTo: () => {
        const to = get().returnTo;
        if (to) set({ returnTo: null });
        return to;
      },

      // A deliberate sign-out clears `returnTo` too: the citizen chose to leave, so
      // dropping them back into a half-finished form on next sign-in would be wrong.
      // Their DRAFT is still safe server-side and offered from the dashboard.
      clear: () => set({
        accessToken: null, tokenType: 'Bearer', refreshToken: null, user: null, roles: [],
        assuranceLevel: 0, expiresAt: null, sessionExpired: false, returnTo: null,
      }),
    }),
    { name: 'oc-auth' },
  ),
);
