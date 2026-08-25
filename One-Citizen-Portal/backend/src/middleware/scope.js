// Attaches req.scope(opts) → builds a repository scope ctx from req.auth (lib/authz).
// Controllers call req.scope({ ownerField, laneField, ... }) to get the ctx they pass to
// repositories, so the correct scope filter travels with every data access.
import { buildScopeCtx } from '../lib/authz.js';

export function scope(req, _res, next) {
  req.scope = (opts) => buildScopeCtx(req.auth || {}, opts);
  next();
}
