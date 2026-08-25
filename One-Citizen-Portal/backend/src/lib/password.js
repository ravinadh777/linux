// Password + secret hashing (scrypt). Stored as `scrypt$<salt>$<hash>`.
// Used for citizen/officer passwords and system-consumer client secrets (SECURITY §11).
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

export function hashSecret(secret) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(secret), salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifySecret(secret, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const computed = scryptSync(String(secret), salt, KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}
