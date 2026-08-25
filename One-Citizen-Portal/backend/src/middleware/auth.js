// Authentication middleware. Verifies the Bearer JWT → req.auth {sub, roles, assuranceLevel,
// scopes, actingFor?, consumerId?, jti}. RBAC/scope/assurance guards are added in story S0.4.
import { UnauthenticatedError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export function createAuthMiddleware(identityService) {
  function extractToken(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim();
  }

  // Map verified JWT claims → the request principal. Controllers read the authenticated user
  // from here (never from client input): req.auth.sub / userId is the users.id, and role
  // drives authorization.
  function toPrincipal(claims) {
    const roles = claims.roles || (claims.role ? [claims.role] : []);
    return {
      sub: claims.sub,
      userId: claims.user_id || claims.sub, // canonical business identifier (alias of sub)
      email: claims.email || null,
      role: claims.role || roles[0] || null,
      roles,
      assuranceLevel: claims.assuranceLevel ?? 0,
      scopes: claims.scopes || [],
      permissions: claims.permissions || claims.scopes || [],
      agency: claims.agency, // officer lane scoping (unused by citizen sessions)
      actingFor: claims.actingFor, // delegated-subject scoping (unused by citizen sessions)
      jti: claims.jti,
      sessionId: claims.jti, // session identifier (the access-token jti)
    };
  }

  // Populates req.auth if a (valid) token is present. A present-but-invalid token → 401.
  const authenticate = asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (token) {
      req.auth = toPrincipal(await identityService.verifyAccess(token));
    }
    next();
  });

  // Requires an authenticated principal.
  const requireAuth = asyncHandler(async (req, _res, next) => {
    if (!req.auth) {
      const token = extractToken(req);
      if (!token) throw new UnauthenticatedError();
      req.auth = toPrincipal(await identityService.verifyAccess(token));
    }
    next();
  });

  return { authenticate, requireAuth };
}
