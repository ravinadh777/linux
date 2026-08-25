// Output sanitisation (Phase 11 — security). Agent/tool text is treated as untrusted
// data before it is persisted or echoed. We strip control characters and cap length;
// the React client additionally renders everything as plain text (no dangerouslySetInnerHTML).

// C0/C1 control characters except \t (\x09), \n (\x0A), \r (\x0D). Stripping these
// is the whole point of this util, so the no-control-regex lint rule is disabled here.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

/** Strip control chars + cap length. Used for any model/tool text we store or relay. */
export function sanitizeText(value, maxLen = 20000) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').slice(0, maxLen);
}

/**
 * Deep-sanitise a JSON-serialisable value (prefill payloads, snapshots).
 * Strings are cleaned; prototype-polluting keys are dropped.
 */
export function sanitizeJson(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.slice(0, 500).map((v) => sanitizeJson(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = sanitizeJson(v, depth + 1);
    }
    return out;
  }
  return value;
}
