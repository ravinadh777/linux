// Agent network service (Phase 5 — Agent Service; Phase 3 — streaming client).
// JSON endpoints go through the shared axios instance (auth interceptor, error mapping);
// the chat run uses fetch() so we can read the SSE body as a stream. This is the single
// place the frontend talks to the Node agent gateway (/api/v1/agent/*).
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');

// ── REST (non-streaming) ────────────────────────────────────────────────────────
export const agentApi = {
  createSession: (page, title) => api.post('/agent/session', { page, title }).then((r) => r.data),
  listSessions: () => api.get('/agent/sessions').then((r) => r.data),
  getHistory: (threadId) => api.get('/agent/history', { params: { threadId } }).then((r) => r.data),
  reset: (threadId) => api.post('/agent/reset', { threadId }).then((r) => r.data),
  syncForm: (threadId, formValues, page) => api.post('/agent/form-sync', { threadId, formValues, page }).then((r) => r.data),
  extract: (threadId, message, page) => api.post('/agent/extract', { threadId, message, page }).then((r) => r.data),
  status: () => api.get('/agent/status').then((r) => r.data),
};

/**
 * Open a streaming chat run. Parses AG-UI SSE frames and invokes `onEvent(evt)` for
 * each. Resolves when the stream ends; rejects on network/HTTP error (not on RUN_ERROR,
 * which is delivered as a normal event so the UI can render it).
 *
 * @param {object} body   { threadId?, message, page?, trigger }
 * @param {object} opts    { signal, onEvent }
 */
export async function streamChat(body, { signal, onEvent } = {}) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (res.status === 401) {
    useAuthStore.getState().clear();
    throw new Error('Your session expired. Please sign in again.');
  }
  if (!res.ok || !res.body) {
    throw new Error(`AskGov is unavailable (HTTP ${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      // eslint-disable-next-line no-cond-assign
      while ((boundary = indexOfBoundary(buffer)) !== -1) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const evt = decodeFrame(frame);
        if (evt) onEvent?.(evt);
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

function indexOfBoundary(buf) {
  const lf = buf.indexOf('\n\n');
  const crlf = buf.indexOf('\r\n\r\n');
  if (lf === -1 && crlf === -1) return -1;
  if (crlf === -1 || (lf !== -1 && lf < crlf)) return { index: lf, length: 2 };
  return { index: crlf, length: 4 };
}

function decodeFrame(frame) {
  const data = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith(':')) continue; // heartbeat/comment
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (!data.length) return null;
  try {
    return JSON.parse(data.join('\n'));
  } catch {
    return null;
  }
}
