// Session store (Phase 4 — sessions across tabs/users). Persisted to sessionStorage so
// each browser TAB owns its own conversation thread (multiple tabs = independent threads),
// while a reload in the same tab resumes the same thread. Keyed per user id so switching
// accounts never bleeds a thread across identities.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useSessionStore = create(
  persist(
    (set) => ({
      threadId: null,
      userId: null, // owner the current threadId belongs to (guards account switches)
      upstream: 'unknown', // 'ok' | 'unavailable' | 'disabled'
      setThread: (threadId, userId) => set({ threadId, userId }),
      setUpstream: (upstream) => set({ upstream }),
      clear: () => set({ threadId: null }),
    }),
    { name: 'oc-agent-session', storage: createJSONStorage(() => sessionStorage) },
  ),
);
