import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';

export function createDashboardRouter({ dashboardService, requireAuth }) {
  const r = Router();
  // Headline counts (submitted / drafts / in-progress / approved) for the KPI strip.
  r.get('/dashboard/kpis', requireAuth, asyncHandler(async (req, res) => res.json(await dashboardService.kpis({ auth: req.auth }))));
  r.get('/dashboard/reminders', requireAuth, asyncHandler(async (req, res) => res.json(await dashboardService.reminders({ auth: req.auth }))));
  r.get('/dashboard/suggestions', requireAuth, asyncHandler(async (req, res) => res.json(await dashboardService.suggestions({ auth: req.auth }))));
  r.get('/dashboard/cases', requireAuth, asyncHandler(async (req, res) => res.json(await dashboardService.cases({ auth: req.auth }))));
  r.get('/dashboard/deadlines', requireAuth, asyncHandler(async (req, res) => res.json(await dashboardService.deadlines({ auth: req.auth }))));
  r.get('/dashboard/notifications', requireAuth, asyncHandler(async (req, res) => res.json(await dashboardService.notifications({ auth: req.auth }))));
  r.get('/dashboard/pension', requireAuth, asyncHandler(async (req, res) => res.json(await dashboardService.pension({ auth: req.auth }))));
  return r;
}
