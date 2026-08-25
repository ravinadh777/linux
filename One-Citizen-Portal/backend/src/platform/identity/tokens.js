// JWT helpers (HS256 in the reference build; RS256 + JWKS in production — SECURITY §13).
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Sign an access token.
 * @param {Object} claims - { sub, roles, assuranceLevel, scopes, actingFor?, mfa?, consumerId? }
 */
export function signAccessToken(claims) {
  return jwt.sign({ ...claims, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    jwtid: randomUUID(),
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET); // throws TokenExpiredError / JsonWebTokenError
}

/** Opaque refresh token (stored hashed; rotated on use). */
export function newRefreshToken() {
  return `rft_${randomBytes(32).toString('base64url')}`;
}

/** Sign a short-lived access token for tests/tools with a custom ttl. */
export function signWithTtl(claims, ttlSeconds) {
  return jwt.sign({ ...claims, type: 'access' }, env.JWT_SECRET, {
    expiresIn: ttlSeconds,
    jwtid: randomUUID(),
  });
}
