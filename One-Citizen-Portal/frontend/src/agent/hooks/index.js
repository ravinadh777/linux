// Agent hooks (Phase 5). Thin, selector-based readers over the stores + context so
// components subscribe to exactly the slice they render (Phase 10 — minimal re-renders).
import { useEffect } from 'react';
import { useAgent } from '../context/AgentContext.js';
import { useMessageStore } from '../stores/messageStore.js';
import { useSessionStore } from '../stores/sessionStore.js';

export { useAgent } from '../context/AgentContext.js';
export { useAutoFill, useFilledFields, usePrefsStore } from '../stores/prefsStore.js';

// ── state selectors ─────────────────────────────────────────────────────────────
export const useAgentMessages = () => useMessageStore((s) => s.messages);
export const useAgentDraft = () => useMessageStore((s) => s.draft);
export const useAgentStatus = () => useMessageStore((s) => s.status);
export const useAgentError = () => useMessageStore((s) => s.error);
export const useAgentSuggestions = () => useMessageStore((s) => s.suggestions);
export const useAgentUpstream = () => useSessionStore((s) => s.upstream);

/** True while a run is in flight (connecting/thinking/streaming). */
export const useAgentBusy = () =>
  useMessageStore((s) => s.status === 'connecting' || s.status === 'thinking' || s.status === 'streaming');

/**
 * Composite streaming hook (Phase 5 — Streaming Hook). One import for a chat UI:
 * transient state from the stores + stable actions from the provider.
 */
export function useAgentStream() {
  const api = useAgent();
  const messages = useAgentMessages();
  const draft = useAgentDraft();
  const status = useAgentStatus();
  const error = useAgentError();
  const suggestions = useAgentSuggestions();
  const upstream = useAgentUpstream();
  const busy = useAgentBusy();
  return { ...api, messages, draft, status, error, suggestions, upstream, busy };
}

/**
 * Event hook (Phase 8 — Event Hook). Subscribe to the raw AG-UI event stream.
 * @param {(evt: object) => void} handler
 */
export function useAgentEvents(handler) {
  const { subscribe } = useAgent();
  useEffect(() => subscribe(handler), [subscribe, handler]);
}
