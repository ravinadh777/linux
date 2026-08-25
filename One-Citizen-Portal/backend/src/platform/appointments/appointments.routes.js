// Appointment routes (FR-P5). Public office list; slots + booking require auth.
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';

export function createAppointmentsRouter({ appointmentsService, requireAuth }) {
  const r = Router();

  // Static/specific paths first so they aren't captured by /appointments/:id.
  r.get('/appointments/offices', asyncHandler(async (_req, res) => res.json({ items: appointmentsService.offices() })));
  r.get('/appointments/slots', requireAuth, asyncHandler(async (req, res) =>
    res.json(await appointmentsService.slots({ office: req.query.office, date: req.query.date }))));
  r.get('/appointments', requireAuth, asyncHandler(async (req, res) =>
    res.json({ items: await appointmentsService.listMine({ auth: req.auth }) })));
  r.get('/appointments/:id', requireAuth, asyncHandler(async (req, res) =>
    res.json(await appointmentsService.get({ auth: req.auth, id: req.params.id }))));
  r.post('/appointments', requireAuth, asyncHandler(async (req, res) =>
    res.status(201).json(await appointmentsService.book({ auth: req.auth, ...req.body }))));

  return r;
}
