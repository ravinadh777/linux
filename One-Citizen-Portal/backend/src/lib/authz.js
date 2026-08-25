// Authorization helpers: scope-ctx construction (BR-G4) and segregation of duty.
// The scope ctx returned here is handed to repositories, which apply it as a mandatory
// filter — so an agency sees only its lane and a citizen only their own records.
import { ForbiddenError } from './errors.js';

/** The subject whose records are in view: the delegated citizen when acting-for, else self. */
export function resolveSubject(auth) {
  return auth?.actingFor || auth?.sub || null;
}

/**
 * Build a repository scope ctx from the authenticated principal.
 * @param {Object} auth - req.auth
 * @param {Object} [opts]
 * @param {string} [opts.ownerField='ownerId'] - field that owns a citizen-scoped record
 * @param {string[]} [opts.unrestrictedRoles=['sysadmin','oversight']] - roles that bypass scoping
 * @param {string} [opts.laneField] - when set, officers are scoped to auth.agency on this field
 */
export function buildScopeCtx(auth = {}, opts = {}) {
  const {
    ownerField = 'ownerId',
    unrestrictedRoles = ['sysadmin', 'oversight'],
    laneField,
  } = opts;
  const roles = auth.roles || [];
  const base = { actor: auth.sub || null, actingFor: auth.actingFor || null, roles };

  if (roles.some((r) => unrestrictedRoles.includes(r))) {
    return { ...base, scope: { unrestricted: true } };
  }
  // Officer lane scoping (agency bound via the token's `agency` claim).
  if (laneField && auth.agency) {
    return { ...base, scope: { where: { [laneField]: auth.agency } } };
  }
  // Default: owner scoping (citizen self, or delegated citizen when acting-for).
  const subject = resolveSubject(auth);
  return { ...base, scope: { where: { [ownerField]: subject } } };
}

/**
 * Segregation of duty: the two actors MUST differ (e.g. batch approver ≠ releaser, D-FR5;
 * appeal reviewer ≠ original officer, D-FR6). Throws FORBIDDEN when they are the same.
 */
export function assertDistinctActors(actorA, actorB, message = 'Segregation of duty: the two actions must be performed by different officers') {
  if (actorA && actorB && actorA === actorB) {
    throw new ForbiddenError(message);
  }
}
