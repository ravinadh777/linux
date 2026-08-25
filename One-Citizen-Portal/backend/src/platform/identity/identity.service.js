// Authentication service. Users register with email + password, log in with the same, and
// receive a JWT. There is NO mock/seed data and NO alternate identifiers (TIN/E-ID/OTP) —
// every account is a real row in the `users` table, created via register().
import { createHash } from 'node:crypto';
import { SYSTEM_CTX } from '../../config/repositories.js';
import { env } from '../../config/env.js';
import { hashSecret, verifySecret } from '../../lib/password.js';
import { newId } from '../../lib/id.js';
import { signAccessToken, newRefreshToken, verifyToken } from './tokens.js';
import { PROFILE_FIELD_KEYS } from '@onecitizen/shared/constants';
import {
  UnauthenticatedError,
  NotFoundError,
  ValidationError,
  DuplicateError,
} from '../../lib/errors.js';

const sha256 = (v) => createHash('sha256').update(String(v)).digest('hex');
const REFRESH_TTL_MS = (env.JWT_REFRESH_TTL || 604800) * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The full set of self-service profile fields (besides name/email/role/password). This is the
// SINGLE allow-list shared by register() and updateUser(), so both persist exactly the same
// fields to the users table — nothing the client sends outside this list is ever stored.
// The self-service profile allow-list: register() and updateUser() both persist
// EXACTLY these keys, and anything the client sends outside the list is dropped
// before the user record is written.
//
// Sourced from @onecitizen/shared rather than declared here on purpose. A local copy
// that drifted from the frontend's would fail SILENTLY — registration would appear to
// succeed, the citizen would believe their details were stored, and the field would
// simply be discarded, only surfacing much later as an application that will not
// prefill. One shared list makes that class of bug impossible. See the note on
// PROFILE_FIELD_KEYS in shared/src/constants/index.js.
const PROFILE_FIELDS = PROFILE_FIELD_KEYS;

/** Pick + trim only the known profile fields from an arbitrary payload. */
function pickProfile(src = {}) {
  const out = {};
  for (const k of PROFILE_FIELDS) {
    if (src[k] !== undefined && src[k] !== null) {
      const v = typeof src[k] === 'string' ? src[k].trim() : src[k];
      if (v !== '') out[k] = v;
    }
  }
  return out;
}

export function createIdentityService({ repos }) {
  async function findByEmail(email) {
    const { items } = await repos.users.find({ email }, SYSTEM_CTX, { limit: 1 });
    return items[0] || null;
  }

  /** Strip the password hash — never leave the service boundary. */
  function safeUser(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async function issueSession(user) {
    const role = user.role || 'citizen';
    const roles = [role];
    const accessToken = signAccessToken({
      sub: user.id,
      user_id: user.id, // canonical business identifier (alias of sub)
      email: user.email,
      role,
      roles,
      permissions: [],
      assuranceLevel: 2, // a registered user who authenticated with a password is Level 2
    });
    const refreshToken = newRefreshToken();
    await repos.refreshTokens.create(
      {
        tokenHash: sha256(refreshToken),
        subject: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
      },
      SYSTEM_CTX,
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_TTL,
      user: safeUser(user),
      roles,
    };
  }

  return {
    /**
     * Create a new account, hash the password, mint a permanent immutable user_id and
     * auto-log the user in. Email is the unique login identifier.
     */
    async register({ name, email, password, ...rest } = {}) {
      const email0 = String(email ?? '').trim().toLowerCase();
      const name0 = name ? String(name).trim() : null;
      if (!name0) throw new ValidationError('Full name is required');
      if (!email0 || !EMAIL_RE.test(email0)) throw new ValidationError('A valid email is required');
      if (!password || String(password).length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
      }
      if (await findByEmail(email0)) throw new DuplicateError('An account with this email already exists');

      // Persist the FULL registration payload: name/email as top-level columns, and every
      // supplied profile field (whitelisted) into the profile block on the users table.
      const user = await repos.users.create(
        {
          id: newId('usr'), // permanent, immutable user_id
          email: email0,
          name: name0,
          role: 'citizen',
          passwordHash: hashSecret(password),
          status: 'active',
          profile: { name: name0, email: email0, ...pickProfile(rest) },
        },
        SYSTEM_CTX,
      );
      await repos.audit.append({ action: 'user.registered', actor: user.id, entity: 'user', entityId: user.id });
      return issueSession(user);
    },

    /** Validate email + password and issue a JWT session. */
    async login({ email, password } = {}) {
      const email0 = String(email ?? '').trim().toLowerCase();
      if (!email0 || !password) throw new ValidationError('email and password are required');
      const user = await findByEmail(email0);
      // Product decision (over strict anti-enumeration): a missing account returns 404 so the
      // UI can send the visitor straight to registration, while a wrong password returns 401.
      if (!user) throw new NotFoundError('No account found for this email');
      if (user.status === 'disabled') throw new UnauthenticatedError('This account is disabled');
      if (!verifySecret(password, user.passwordHash)) throw new UnauthenticatedError('Incorrect password');
      return issueSession(user);
    },

    /** Rotate a refresh token → new access + refresh. Reused/expired tokens fail. */
    async refresh({ refreshToken } = {}) {
      if (!refreshToken) throw new ValidationError('refreshToken is required');
      const rec = (await repos.refreshTokens.find({ tokenHash: sha256(refreshToken) }, SYSTEM_CTX, { limit: 1 })).items[0];
      if (!rec) throw new UnauthenticatedError('Invalid refresh token');
      await repos.refreshTokens.delete(rec.id, SYSTEM_CTX); // rotate: single-use
      if (new Date(rec.expiresAt).getTime() < Date.now()) {
        throw new UnauthenticatedError('Refresh token expired');
      }
      const user = await repos.users.findById(rec.subject, SYSTEM_CTX);
      if (!user) throw new UnauthenticatedError('Account no longer exists');
      return issueSession(user);
    },

    /** Revoke the refresh token and denylist the access jti. */
    async logout({ refreshToken, jti } = {}) {
      if (refreshToken) {
        const rec = (await repos.refreshTokens.find({ tokenHash: sha256(refreshToken) }, SYSTEM_CTX, { limit: 1 })).items[0];
        if (rec) await repos.refreshTokens.delete(rec.id, SYSTEM_CTX);
      }
      if (jti) await repos.revokedTokens.append({ jti });
      return { revoked: true };
    },

    /** GET the authenticated user's own record (from the JWT subject) — reads the users table. */
    async getUser({ auth } = {}) {
      if (!auth?.sub) throw new UnauthenticatedError();
      const user = await repos.users.findById(auth.sub, SYSTEM_CTX);
      if (!user) throw new NotFoundError('Account not found');
      return safeUser(user);
    },

    /**
     * UPDATE the authenticated user's own record in the users table. `name` is promoted to the
     * top-level column (and mirrored into the profile); everything else lives in the profile
     * block. Email/role/password are NOT editable here. Returns the full updated user so the
     * client can refresh its cache/state.
     */
    async updateUser({ auth, patch } = {}) {
      if (!auth?.sub) throw new UnauthenticatedError();
      const user = await repos.users.findById(auth.sub, SYSTEM_CTX);
      if (!user) throw new NotFoundError('Account not found');

      const norm = (v) => (typeof v === 'string' ? v.trim() : v);
      const profilePatch = {};
      for (const k of PROFILE_FIELDS) {
        if (patch && patch[k] !== undefined) profilePatch[k] = norm(patch[k]);
      }
      const nameProvided = patch && patch.name !== undefined;
      const name = nameProvided ? norm(patch.name) : undefined;
      if (nameProvided && !name) throw new ValidationError('Name cannot be empty');
      if (!nameProvided && !Object.keys(profilePatch).length) {
        throw new ValidationError('No editable fields supplied');
      }

      const nextProfile = { ...(user.profile || {}), ...profilePatch };
      if (nameProvided) nextProfile.name = name;
      const changes = { profile: nextProfile, ...(nameProvided ? { name } : {}) };

      const updated = await repos.users.update(auth.sub, changes, user.version, SYSTEM_CTX);
      await repos.audit.append({ action: 'user.updated', actor: auth.sub, entity: 'user', entityId: auth.sub });
      return safeUser(updated);
    },

    /** Verify a bearer token; used by the auth middleware. */
    async verifyAccess(token, { checkRevoked = true } = {}) {
      let claims;
      try {
        claims = verifyToken(token);
      } catch (err) {
        throw new UnauthenticatedError(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
      }
      if (checkRevoked && claims.jti) {
        const revoked = (await repos.revokedTokens.find({ jti: claims.jti }, SYSTEM_CTX, { limit: 1 })).items[0];
        if (revoked) throw new UnauthenticatedError('Token revoked');
      }
      return claims;
    },
  };
}
