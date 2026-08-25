// Audit read API (docs/API.md §7). Restricted to sysadmin/oversight.
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireRole } from '../../middleware/rbac.js';

export function createAuditRouter({ auditService, requireAuth }) {
  const r = Router();

  r.get('/audit', requireAuth, requireRole('sysadmin', 'oversight'), asyncHandler(async (req, res) => {
    const { entity, entityId, actor, action, limit, cursor } = req.query;
    const filters = {};
    if (entity) filters.entity = entity;
    if (entityId) filters.entityId = entityId;
    if (actor) filters.actor = actor;
    if (action) filters.action = action;
    res.json(await auditService.query({ filters, auth: req.auth, requestId: req.id, limit: Number(limit) || 50, cursor }));
  }));

  return r;
}
