// Message store (Phase 4 — conversation state; Phase 10 — selector-based subscriptions).
// Holds the durable transcript plus a single in-flight "draft" assistant turn that the
// stream hook mutates token-by-token. Components subscribe with narrow selectors so a
// streaming delta only re-renders the active bubble, not the whole panel.
import { create } from 'zustand';

/** @typedef {'idle'|'connecting'|'thinking'|'streaming'|'error'} AgentStatus */

const emptyDraft = () => ({
  id: null,
  role: 'assistant',
  content: '',
  toolCalls: [],
  suggestions: [],
  prefill: null,
  validation: null,
});

export const useMessageStore = create((set, get) => ({
  messages: [], // durable turns: {id, role, content, toolCalls?, prefill?, suggestions?}
  draft: null, // in-flight assistant turn (null when idle)
  status: 'idle', // AgentStatus
  error: null,
  suggestions: [], // suggestion chips from the last assistant turn

  // ── lifecycle ──────────────────────────────────────────────────────────────
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : get().status }),

  loadHistory: (messages) =>
    set({
      messages: messages || [],
      suggestions: [...(messages || [])].reverse().find((m) => m.role === 'assistant')?.suggestions || [],
      draft: null,
      status: 'idle',
      error: null,
    }),

  resetConversation: () => set({ messages: [], draft: null, suggestions: [], error: null, status: 'idle' }),

  addUserMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message], suggestions: [], error: null })),

  // ── streaming draft ──────────────────────────────────────────────────────────
  beginDraft: (id) => set({ draft: { ...emptyDraft(), id }, status: 'thinking', error: null }),

  appendText: (delta) =>
    set((s) => (s.draft ? { draft: { ...s.draft, content: s.draft.content + delta }, status: 'streaming' } : s)),

  startTool: (id, name) =>
    set((s) => {
      const draft = s.draft || emptyDraft();
      return { draft: { ...draft, toolCalls: [...draft.toolCalls, { id, name, done: false }] }, status: 'thinking' };
    }),

  endTool: (id, result) =>
    set((s) => {
      if (!s.draft) return s;
      return {
        draft: {
          ...s.draft,
          toolCalls: s.draft.toolCalls.map((t) => (t.id === id ? { ...t, done: true, result } : t)),
        },
      };
    }),

  setPrefill: (prefill) => set((s) => ({ draft: { ...(s.draft || emptyDraft()), prefill } })),
  setValidation: (validation) => set((s) => ({ draft: { ...(s.draft || emptyDraft()), validation } })),
  setSuggestions: (suggestions) => set((s) => ({ draft: { ...(s.draft || emptyDraft()), suggestions } })),

  /** Commit the draft into the durable transcript (RUN_FINISHED). */
  commitDraft: () =>
    set((s) => {
      if (!s.draft) return { status: 'idle' };
      const hasContent = s.draft.content.trim() || s.draft.toolCalls.length || s.draft.prefill;
      return {
        messages: hasContent ? [...s.messages, s.draft] : s.messages,
        suggestions: s.draft.suggestions || [],
        draft: null,
        status: 'idle',
      };
    }),

  /** Abandon the draft (cancel / error) but keep any text already streamed. */
  abandonDraft: (asError) =>
    set((s) => {
      if (!s.draft) return { status: asError ? 'error' : 'idle' };
      const keep = s.draft.content.trim() || s.draft.toolCalls.length;
      return {
        messages: keep ? [...s.messages, { ...s.draft, interrupted: true }] : s.messages,
        draft: null,
        status: asError ? 'error' : 'idle',
      };
    }),
}));
