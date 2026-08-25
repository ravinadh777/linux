// Correlation id: reuse an inbound X-Request-Id or mint one; echo it on the response.
// Propagated into logs, error responses, events and webhook deliveries (Architecture §6.3).
import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : `req_${randomUUID()}`;
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
