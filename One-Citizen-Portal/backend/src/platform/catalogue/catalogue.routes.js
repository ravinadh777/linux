// Catalogue routes (docs/API.md §7). Public browse.
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';

export function createCatalogueRouter({ catalogueService }) {
  const r = Router();
  const cache = (_req, res, next) => {
    res.set('Cache-Control', 'public, max-age=600');
    next();
  };

  r.get('/catalogue', cache, asyncHandler(async (_req, res) => res.json({ ministries: catalogueService.full() })));
  r.get('/catalogue/search', asyncHandler(async (req, res) => res.json(catalogueService.search(req.query.q))));
  r.get('/catalogue/ministries', cache, asyncHandler(async (_req, res) => res.json({ items: catalogueService.ministries() })));
  r.get('/catalogue/agencies', cache, asyncHandler(async (_req, res) => res.json({ items: catalogueService.agenciesAll() })));
  r.get('/catalogue/ministries/:code/agencies', cache, asyncHandler(async (req, res) => res.json(catalogueService.agencies(req.params.code))));
  r.get('/catalogue/agencies/:code/services', cache, asyncHandler(async (req, res) => res.json(catalogueService.services(req.params.code))));
  r.get('/catalogue/services/:id', cache, asyncHandler(async (req, res) => res.json(catalogueService.service(req.params.id))));

  return r;
}
