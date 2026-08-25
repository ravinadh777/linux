// Agent middleware (Phase 11 — security: rate limiting + session validation).
// A dependency-light, per-citizen sliding-window limiter (keyed by JWT sub, not IP,
// so it is fair behind shared proxies). Kept separate from route wiring for testability.
import { RateLimitError } from '../../../lib/errors.js';

export function createRateLimiter({ windowMs, max }) {
  /** @type {Map<string, number[]>} sub → sorted hit timestamps within the window */
  const hits = new Map();

  return function rateLimit(req, _res, next) {
    const key = req.auth?.sub || req.ip;
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = (hits.get(key) || []).filter((t) => t > cutoff);
    if (recent.length >= max) {
      return next(new RateLimitError('Too many AskGov requests — please slow down.'));
    }
    recent.push(now);
    hits.set(key, recent);
    // Opportunistic cleanup so the map does not grow unbounded.
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        const live = v.filter((t) => t > cutoff);
        if (live.length) hits.set(k, live); else hits.delete(k);
      }
    }
    return next();
  };
}
