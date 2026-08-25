// Reference-data routes (docs/API.md §16). Public + cacheable (data changes rarely).
import { Router } from 'express';

export function createReferenceRouter({ referenceService }) {
  const r = Router();
  const cache = (_req, res, next) => {
    res.set('Cache-Control', 'public, max-age=3600');
    next();
  };

  r.get('/reference/regions', cache, (_req, res) => res.json(referenceService.regions()));
  r.get('/reference/local-authorities', cache, (_req, res) => res.json(referenceService.localAuthorities()));
  r.get('/reference/fee-schedules', cache, (_req, res) => res.json(referenceService.feeSchedules()));
  r.get('/reference/document-types', cache, (_req, res) => res.json(referenceService.documentTypes()));
  r.get('/reference/reason-codes', cache, (req, res) => res.json(referenceService.reasonCodes(req.query.context)));
  // GRO civil-registration list, grouped by births / deaths / marriages.
  r.get('/reference/civil-registration', cache, (_req, res) => res.json(referenceService.civilRegistration()));
  // MOHA Tint Waiver option lists + landing copy. Public and cacheable like the rest:
  // the landing/requirements page is pre-login, so this must not require a session.
  r.get('/reference/tint', cache, (_req, res) => res.json(referenceService.tint()));

  return r;
}
