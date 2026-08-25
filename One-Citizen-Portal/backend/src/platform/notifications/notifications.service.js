// Per-citizen application notifications. Every application workflow event (submitted, under
// review, approved, rejected) is turned into a persisted notification AND pushed in real time
// over SSE to any of that citizen's connected browser tabs. Reuses the in-process eventBus
// (subscribe) and the shared SSE codec — no new transport library.
import { SYSTEM_CTX } from '../../config/repositories.js';
import { NotFoundError, UnauthenticatedError } from '../../lib/errors.js';
import { encodeFrame, encodeComment } from '../../modules/agent/utils/sse.js';
import { EVENTS } from '@onecitizen/shared/constants';

// Map a workflow event → the citizen-facing notification copy.
const TEMPLATES = {
  [EVENTS.APPLICATION_SUBMITTED]: { type: 'submitted', title: 'Application submitted', body: (a) => `We received your ${a.serviceName || 'application'} (${a.reference}).` },
  [EVENTS.APPLICATION_REVIEWED]: { type: 'under_review', title: 'Application under review', body: (a) => `Your ${a.serviceName || 'application'} (${a.reference}) is now being reviewed.` },
  [EVENTS.APPLICATION_APPROVED]: { type: 'approved', title: 'Application approved', body: (a) => `Good news — your ${a.serviceName || 'application'} (${a.reference}) was approved.` },
  [EVENTS.APPLICATION_REJECTED]: { type: 'rejected', title: 'Action needed on your application', body: (a) => `Your ${a.serviceName || 'application'} (${a.reference}) needs attention.` },
};
export const NOTIFY_EVENTS = Object.keys(TEMPLATES);

export function createNotificationsService({ repos, logger }) {
  // userId → Set<res>. In-process registry of open SSE connections.
  const clients = new Map();

  const ownerCtx = (auth) => ({ actor: auth.sub, roles: auth.roles, scope: { where: { userId: auth.sub } } });
  const toDto = (n) => ({
    notificationId: n.id,
    userId: n.userId,
    applicationId: n.applicationId || null,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: !!n.isRead,
    deepLinkTarget: n.deepLinkTarget || (n.applicationId ? `/tracking/${n.applicationId}` : null),
    createdAt: n.createdAt,
  });

  function pushToUser(userId, payload) {
    const set = clients.get(userId);
    if (!set) return;
    const frame = encodeFrame(payload);
    for (const res of set) {
      try { res.write(frame); } catch { /* client gone; cleaned up on close */ }
    }
  }

  const service = {
    /** eventBus handler: persist a notification for the application owner and push it live. */
    async notifyFromEvent(record) {
      const tpl = TEMPLATES[record.type];
      const applicationId = record.payload?.applicationId;
      if (!tpl || !applicationId) return;
      try {
        const app = await repos.applications.findById(applicationId, SYSTEM_CTX);
        const userId = app?.ownerId || record.payload?.ownerId;
        if (!userId) return;
        const created = await repos.notifications.create({
          userId,
          applicationId,
          type: tpl.type,
          title: tpl.title,
          message: tpl.body(app || { reference: applicationId }),
          isRead: false,
          deepLinkTarget: `/tracking/${applicationId}`,
        }, SYSTEM_CTX);
        pushToUser(userId, { kind: 'notification', notification: toDto(created) });
      } catch (err) {
        logger?.error?.({ err, type: record.type }, 'notification_create_failed');
      }
    },

    async list({ auth, unreadOnly = false } = {}) {
      if (!auth?.sub) throw new UnauthenticatedError();
      const query = unreadOnly ? { isRead: false } : {};
      const { items } = await repos.notifications.find(query, ownerCtx(auth), { limit: 100 });
      const dtos = items.map(toDto).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { items: dtos, unread: dtos.filter((n) => !n.isRead).length };
    },

    async markRead({ auth, id } = {}) {
      const n = await repos.notifications.findById(id, ownerCtx(auth));
      if (!n) throw new NotFoundError('Notification not found');
      if (n.isRead) return toDto(n);
      const updated = await repos.notifications.update(id, { isRead: true }, n.version, ownerCtx(auth));
      return toDto(updated);
    },

    async markAllRead({ auth } = {}) {
      const { items } = await repos.notifications.find({ isRead: false }, ownerCtx(auth), { limit: 100 });
      for (const n of items) await repos.notifications.update(n.id, { isRead: true }, n.version, ownerCtx(auth));
      return { updated: items.length };
    },

    /** Register an SSE connection for a user; returns an unsubscribe fn. */
    addClient(userId, res) {
      if (!clients.has(userId)) clients.set(userId, new Set());
      clients.get(userId).add(res);
      return () => {
        const set = clients.get(userId);
        if (set) { set.delete(res); if (!set.size) clients.delete(userId); }
      };
    },

    encodeComment,
  };

  return service;
}
