// Citizen-record routes: vehicles, properties, employment, family, wallet,
// messages, business. Every route requires auth and is scoped to the caller —
// see records.service.js for the ownership rule.
//
// One router for seven collections so the URL shape, status codes and error
// handling are identical across them. Each collection still gets its own real
// REST path (`/vehicles`, `/properties`, …) rather than a generic
// `/records/:collection`, because those are the URLs the frontend and the API
// docs speak.
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { COLLECTIONS } from './records.service.js';

export function createRecordsRouter({ recordsService, requireAuth }) {
  const r = Router();

  // Aggregate counts — powers the sidebar's unread badge and the dashboard tiles
  // without the client firing seven requests.
  r.get('/records/summary', requireAuth, asyncHandler(async (req, res) =>
    res.json(await recordsService.summary({ auth: req.auth }))));

  for (const collection of Object.keys(COLLECTIONS)) {
    const base = `/${collection}`;

    r.get(base, requireAuth, asyncHandler(async (req, res) =>
      res.json({ items: await recordsService.list({ auth: req.auth, collection, query: req.query }) })));

    r.get(`${base}/:id`, requireAuth, asyncHandler(async (req, res) =>
      res.json(await recordsService.get({ auth: req.auth, collection, id: req.params.id }))));

    r.post(base, requireAuth, asyncHandler(async (req, res) =>
      res.status(201).json(await recordsService.create({ auth: req.auth, collection, body: req.body }))));

    r.patch(`${base}/:id`, requireAuth, asyncHandler(async (req, res) =>
      res.json(await recordsService.update({ auth: req.auth, collection, id: req.params.id, body: req.body }))));

    r.delete(`${base}/:id`, requireAuth, asyncHandler(async (req, res) => {
      const result = await recordsService.remove({ auth: req.auth, collection, id: req.params.id });
      res.json(result);
    }));
  }

  return r;
}
