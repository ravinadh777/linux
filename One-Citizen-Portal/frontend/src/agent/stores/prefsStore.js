// Agent preferences + transient fill-highlight state (Phase 6/10).
// `autoFill` (persisted) gives the agent FULL CONTROL to populate form fields directly
// as it extracts them — the AG-UI experience. `filled` is a short-lived set of field
// names the agent just wrote, so the form can flash a highlight; entries self-expire.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const HIGHLIGHT_MS = 2600;

export const usePrefsStore = create(
  persist(
    (set, get) => ({
      autoFill: true, // agent fills fields automatically (can be toggled off)
      filled: {}, // fieldName -> true (transient; not persisted meaningfully)

      setAutoFill: (v) => set({ autoFill: !!v }),

      /** Mark fields as just-filled so the form highlights them, then auto-clear. */
      markFilled: (names = []) => {
        if (!names.length) return;
        set((s) => ({ filled: { ...s.filled, ...Object.fromEntries(names.map((n) => [n, true])) } }));
        setTimeout(() => {
          const next = { ...get().filled };
          let changed = false;
          for (const n of names) if (n in next) { delete next[n]; changed = true; }
          if (changed) set({ filled: next });
        }, HIGHLIGHT_MS);
      },

      clearFilled: () => set({ filled: {} }),
    }),
    {
      name: 'oc-agent-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ autoFill: s.autoFill }), // persist only the preference
    },
  ),
);

/** Selector: the set of field names currently highlighted as agent-filled. */
export const useFilledFields = () => usePrefsStore((s) => s.filled);
export const useAutoFill = () => usePrefsStore((s) => s.autoFill);
