import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted UI preferences. `textScale` backs the A / A+ / A++ control on the auth
// pages, which previously rendered as three inert chips. It multiplies the theme's
// base font size, so every screen scales together rather than a handful of
// hardcoded sizes ignoring it. Persisted deliberately: a citizen who needs larger
// text needs it on every visit, not only the one where they set it.
export const useUiStore = create(
  persist(
    (set, get) => ({
      mode: 'light',
      navOpen: true,
      assistantOpen: true,
      textScale: 1, // 1 | 1.15 | 1.3
      toggleMode: () => set({ mode: get().mode === 'light' ? 'dark' : 'light' }),
      toggleNav: () => set({ navOpen: !get().navOpen }),
      setAssistantOpen: (v) => set({ assistantOpen: v }),
      // Clamped so a corrupted persisted value can never leave the app unusable.
      setTextScale: (v) => set({ textScale: Math.min(1.3, Math.max(1, Number(v) || 1)) }),
    }),
    { name: 'oc-ui' },
  ),
);
