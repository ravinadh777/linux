// Notification routes: REST (list / mark read) + a live SSE stream. All require auth; a
// citizen only ever sees their own notifications (scoped by the JWT subject).
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';

export function createNotificationsRouter({ notificationsService, requireAuth }) {
  const r = Router();

  r.get('/notifications', requireAuth, asyncHandler(async (req, res) => {
    res.json(await notificationsService.list({ auth: req.auth, unreadOnly: req.query.unread === 'true' }));
  }));

  r.patch('/notifications/read-all', requireAuth, asyncHandler(async (req, res) => {
    res.json(await notificationsService.markAllRead({ auth: req.auth }));
  }));

  r.patch('/notifications/:id/read', requireAuth, asyncHandler(async (req, res) => {
    res.json(await notificationsService.markRead({ auth: req.auth, id: req.params.id }));
  }));

  // Live stream (Server-Sent Events). The browser opens this with the bearer token; every new
  // notification for this user is pushed as a `data:` frame. Heartbeats keep proxies open.
  r.get('/notifications/stream', requireAuth, (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write(notificationsService.encodeComment('connected'));

    const unsubscribe = notificationsService.addClient(req.auth.sub, res);
    const heartbeat = setInterval(() => {
      try { res.write(notificationsService.encodeComment('ping')); } catch { /* closed */ }
    }, 25000);

    req.on('close', () => { clearInterval(heartbeat); unsubscribe(); res.end(); });
  });

  return r;
}
