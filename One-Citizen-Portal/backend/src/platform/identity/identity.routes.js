// Auth routes. Public: register, login, refresh. Protected (requireAuth): logout, me, profile.
import { Router } from 'express';
import { createIdentityController } from './identity.controller.js';

export function createIdentityRouter({ identityService, requireAuth }) {
  const r = Router();
  const c = createIdentityController(identityService);

  // Public
  r.post('/auth/register', c.register);
  r.post('/auth/login', c.login);
  r.post('/auth/refresh', c.refresh);

  // Protected — the authenticated user's own record (users table).
  r.post('/auth/logout', requireAuth, c.logout);
  r.get('/me', requireAuth, c.getUser);     // getUser
  r.patch('/me', requireAuth, c.updateUser); // updateUser

  return r;
}
