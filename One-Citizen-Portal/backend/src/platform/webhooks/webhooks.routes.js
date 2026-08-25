// Webhook subscription routes (docs/API.md §16). sysadmin-managed in the reference build.
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireRole } from '../../middleware/rbac.js';

export function createWebhooksRouter({ webhookService, requireAuth }) {
  const r = Router();

  r.post('/webhooks/subscriptions', requireAuth, requireRole('sysadmin'), asyncHandler(async (req, res) => {
    const { consumerId, events, url, secret } = req.body || {};
    res.status(201).json(await webhookService.subscribe({ auth: req.auth, consumerId, events, url, secret }));
  }));

  r.get('/webhooks/subscriptions', requireAuth, requireRole('sysadmin'), asyncHandler(async (_req, res) => {
    res.json({ items: await webhookService.list() });
  }));

  r.delete('/webhooks/subscriptions/:id', requireAuth, requireRole('sysadmin'), asyncHandler(async (req, res) => {
    res.json(await webhookService.remove({ id: req.params.id }));
  }));

  return r;
}
