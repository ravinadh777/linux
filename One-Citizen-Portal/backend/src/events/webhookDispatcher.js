// Delivers events to subscribed consumers with HMAC-signed payloads, retry/backoff, and
// per-delivery logging (consumer identity + attempts). Transport is injectable so the
// reference build runs without real HTTP; production supplies an HTTP transport.
import { createHmac } from 'node:crypto';
import { SYSTEM_CTX } from '../config/repositories.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Default transport: a no-op that "succeeds" (no external calls in the reference build). */
async function noopTransport() {
  return { status: 200 };
}

export function createWebhookDispatcher({ repos, transport = noopTransport, maxAttempts = 4, backoffBaseMs = 10, logger } = {}) {
  function sign(body, secret) {
    return createHmac('sha256', secret || 'unsigned').update(body).digest('hex');
  }

  async function deliverTo(sub, record) {
    const body = JSON.stringify({ id: record.id, type: record.type, payload: record.payload, at: record.createdAt });
    const headers = {
      'Content-Type': 'application/json',
      'X-OneCitizen-Signature': `sha256=${sign(body, sub.secret)}`,
      'X-OneCitizen-Event': record.type,
      'X-Request-Id': record.requestId || '',
    };
    let attempt = 0;
    let delivered = false;
    let lastError;
    while (attempt < maxAttempts && !delivered) {
      attempt += 1;
      try {
        await transport(sub.url, body, headers);
        delivered = true;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) await sleep(backoffBaseMs * 2 ** (attempt - 1)); // exp backoff
      }
    }
    await repos.webhookDeliveries.append({
      subscriptionId: sub.id,
      consumerId: sub.consumerId,
      url: sub.url,
      eventType: record.type,
      eventId: record.id,
      attempts: attempt,
      status: delivered ? 'delivered' : 'failed',
      error: delivered ? undefined : String(lastError && lastError.message ? lastError.message : lastError),
    });
    if (!delivered) logger?.warn?.({ subscriptionId: sub.id, eventType: record.type, attempts: attempt }, 'webhook_delivery_failed');
    return { delivered, attempts: attempt };
  }

  return {
    /** Deliver an event record to every subscription that listens for its type. */
    async deliver(record) {
      const { items } = await repos.webhookSubscriptions.find({}, SYSTEM_CTX, { limit: 1000 });
      const targets = items.filter((s) => Array.isArray(s.events) && s.events.includes(record.type));
      const results = [];
      for (const sub of targets) results.push(await deliverTo(sub, record));
      return results;
    },
  };
}
