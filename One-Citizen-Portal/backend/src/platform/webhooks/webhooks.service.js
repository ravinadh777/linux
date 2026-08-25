// Webhook subscription management (FR-P8). Consumers subscribe to event types with a
// delivery URL + signing secret; deliveries are signed, retried and logged (dispatcher).
import { SYSTEM_CTX } from '../../config/repositories.js';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { EVENTS } from '@onecitizen/shared/constants';

const KNOWN_EVENTS = new Set(Object.values(EVENTS));

export function createWebhookService({ repos }) {
  return {
    async subscribe({ auth, consumerId, events, url, secret }) {
      if (!url || !Array.isArray(events) || events.length === 0) {
        throw new ValidationError('url and a non-empty events[] are required');
      }
      const unknown = events.filter((e) => !KNOWN_EVENTS.has(e));
      if (unknown.length) throw new ValidationError('Unknown event type(s)', unknown.map((e) => ({ field: 'events', issue: `unknown: ${e}` })));
      const created = await repos.webhookSubscriptions.create(
        { consumerId: consumerId || auth?.consumerId || auth?.sub, events, url, secret: secret || null, active: true },
        SYSTEM_CTX,
      );
      const { secret: _s, ...safe } = created; // never echo the secret back
      return safe;
    },

    async list() {
      const { items } = await repos.webhookSubscriptions.find({}, SYSTEM_CTX, { limit: 1000 });
      return items.map(({ secret: _s, ...safe }) => safe);
    },

    async remove({ id }) {
      const existing = await repos.webhookSubscriptions.findById(id, SYSTEM_CTX);
      if (!existing) throw new NotFoundError('Subscription not found');
      await repos.webhookSubscriptions.delete(id, SYSTEM_CTX);
      return { id, removed: true };
    },
  };
}
