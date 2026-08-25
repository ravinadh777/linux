// HTTP controllers for auth. Thin: parse → call service → respond.
// (No repository or fs access here — enforced by the ESLint boundary rule.)
import { asyncHandler } from '../../lib/asyncHandler.js';

export function createIdentityController(identityService) {
  return {
    register: asyncHandler(async (req, res) => {
      // Pass the full payload; the service whitelists exactly the profile fields it persists.
      res.status(201).json(await identityService.register(req.body || {}));
    }),

    login: asyncHandler(async (req, res) => {
      const { email, password } = req.body || {};
      res.json(await identityService.login({ email, password }));
    }),

    refresh: asyncHandler(async (req, res) => {
      res.json(await identityService.refresh({ refreshToken: req.body?.refreshToken }));
    }),

    logout: asyncHandler(async (req, res) => {
      res.json(await identityService.logout({ refreshToken: req.body?.refreshToken, jti: req.auth?.jti }));
    }),

    getUser: asyncHandler(async (req, res) => {
      res.json(await identityService.getUser({ auth: req.auth }));
    }),

    updateUser: asyncHandler(async (req, res) => {
      res.json(await identityService.updateUser({ auth: req.auth, patch: req.body }));
    }),
  };
}
