// RBAC / assurance guards. Deny-by-default; server-side only (SECURITY A01).
// Sync throws are caught by Express and routed to the central error handler.
import { ForbiddenError, StepUpRequiredError, UnauthenticatedError } from '../lib/errors.js';

/** Require the principal to hold at least one of the given roles. */
export function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.auth) throw new UnauthenticatedError();
    const roles = req.auth.roles || [];
    if (!roles.some((r) => allowed.includes(r))) throw new ForbiddenError('Role not permitted');
    next();
  };
}

/** Require ALL of the given OAuth scopes (system-consumer + delegated tokens). */
export function requireScope(...needed) {
  return (req, _res, next) => {
    if (!req.auth) throw new UnauthenticatedError();
    const have = new Set(req.auth.scopes || []);
    if (!needed.every((s) => have.has(s))) throw new ForbiddenError('Required scope not granted');
    next();
  };
}

/** Require a minimum identity-assurance level; otherwise prompt step-up. */
export function requireAssurance(level) {
  return (req, _res, next) => {
    if (!req.auth) throw new UnauthenticatedError();
    if ((req.auth.assuranceLevel || 0) < level) {
      throw new StepUpRequiredError(`Identity assurance level ${level} required`);
    }
    next();
  };
}
