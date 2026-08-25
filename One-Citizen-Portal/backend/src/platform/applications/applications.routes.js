// Application/tracking routes. Citizen surface (submit + read own) and the back-office
// officer surface (queue + review/approve/reject/assign) share one service + database, so
// the future back-office app mounts against the exact same endpoints/contract.
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAssurance } from '../../middleware/rbac.js';

export function createApplicationsRouter({ applicationsService, draftsService, requireAuth }) {
  const r = Router();

  // ── Citizen ──────────────────────────────────────────────────────────────────
  r.post('/applications', requireAuth, requireAssurance(2), asyncHandler(async (req, res) => {
    res.status(201).json(await applicationsService.create({ auth: req.auth, serviceId: req.body?.serviceId, form: req.body?.form, documents: req.body?.documents }));
  }));

  r.get('/applications', requireAuth, asyncHandler(async (req, res) => {
    res.json({ items: await applicationsService.listMine({ auth: req.auth }) });
  }));

  // ── In-progress drafts (autosave + resume) ────────────────────────────────────
  // Mounted BEFORE '/applications/:id' so the literal 'drafts' segment is not
  // swallowed by the id parameter — the same ordering constraint the officer queue
  // below already relies on.
  //
  // No requireAssurance(2) here, unlike POST /applications. Saving your own
  // half-finished form is not a submission and carries no legal weight; gating it
  // behind the submission assurance level would mean the citizens most at risk of
  // being timed out mid-form are the ones who cannot save. The owner scope in
  // drafts.service.js still guarantees you can only ever touch your own drafts.
  r.get('/applications/drafts', requireAuth, asyncHandler(async (req, res) => {
    res.json({ items: await draftsService.listMine({ auth: req.auth }) });
  }));

  r.get('/applications/drafts/:serviceId', requireAuth, asyncHandler(async (req, res) => {
    // `{ draft: null }` rather than 404 when there is none: "no draft yet" is the
    // normal case for a first visit, not an error the client should have to catch.
    res.json({ draft: await draftsService.get({ auth: req.auth, serviceId: req.params.serviceId }) });
  }));

  // PUT, not POST — this is an idempotent upsert of the one draft for
  // (citizen, service), which is exactly PUT's contract. The client calls it on a
  // debounce, so a retry or a duplicated in-flight save must not create a second row.
  r.put('/applications/drafts/:serviceId', requireAuth, asyncHandler(async (req, res) => {
    res.json(await draftsService.save({
      auth: req.auth,
      serviceId: req.params.serviceId,
      form: req.body?.form,
      documents: req.body?.documents,
      activeStep: req.body?.activeStep,
    }));
  }));

  r.delete('/applications/drafts/:serviceId', requireAuth, asyncHandler(async (req, res) => {
    res.json(await draftsService.remove({ auth: req.auth, serviceId: req.params.serviceId }));
  }));

  // ── Back-office officer queue (must precede '/:id' to avoid route capture) ─────
  r.get('/applications/queue', requireAuth, asyncHandler(async (req, res) => {
    res.json({ items: await applicationsService.listQueue({ auth: req.auth, status: req.query.status }) });
  }));

  r.get('/applications/:id', requireAuth, asyncHandler(async (req, res) => {
    res.json(await applicationsService.get({ auth: req.auth, id: req.params.id }));
  }));

  r.get('/applications/:id/history', requireAuth, asyncHandler(async (req, res) => {
    res.json({ items: await applicationsService.history({ auth: req.auth, id: req.params.id }) });
  }));

  // ── Back-office officer transitions ───────────────────────────────────────────
  r.post('/applications/:id/assign', requireAuth, asyncHandler(async (req, res) => {
    res.json(await applicationsService.assign({ auth: req.auth, id: req.params.id, officerEid: req.body?.officerEid }));
  }));

  r.post('/applications/:id/review', requireAuth, asyncHandler(async (req, res) => {
    res.json(await applicationsService.review({ auth: req.auth, id: req.params.id, note: req.body?.note }));
  }));

  r.post('/applications/:id/approve', requireAuth, asyncHandler(async (req, res) => {
    res.json(await applicationsService.approve({ auth: req.auth, id: req.params.id, note: req.body?.note }));
  }));

  r.post('/applications/:id/reject', requireAuth, asyncHandler(async (req, res) => {
    res.json(await applicationsService.reject({ auth: req.auth, id: req.params.id, reason: req.body?.reason }));
  }));

  return r;
}
