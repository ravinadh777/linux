import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';

export function createAssistantRouter({ assistantService, requireAuth }) {
  const r = Router();
  r.post('/assistant/message', requireAuth, asyncHandler(async (req, res) => {
    const { message, context } = req.body || {};
    res.json(await assistantService.message({ auth: req.auth, message, context, requestId: req.id }));
  }));
  return r;
}
