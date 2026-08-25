// Typing engine configuration (enterprise: one place, tunable at runtime, no business-logic coupling).
// The engine reads getTypingConfig() so speed/pauses can be changed globally without touching forms.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── THE ONE KNOB ─────────────────────────────────────────────────────────────
// Average delay between keystrokes, in ms. This is the single value to tune the typing pace.
// ~70ms ≈ a brisk-but-clearly-visible letter-by-letter typing. Lower = faster, higher = slower.
// A per-character random spread around this (below) keeps it human, not metronome-robotic.
export const TYPING_SPEED_MS = 70;

export const DEFAULT_TYPING_CONFIG = Object.freeze({
  enableHumanTyping: true,   // master switch — off/instant falls back to a direct set
  enableInstantFill: false,  // force the instant fallback (no keystrokes)

  // Slow, human manual-entry pace derived from TYPING_SPEED_MS with natural ± variance so each
  // keystroke gap differs slightly. Retune globally by changing TYPING_SPEED_MS above.
  charDelayMin: Math.round(TYPING_SPEED_MS * 0.6),  // ms — fastest gap between keystrokes (~84)
  charDelayMax: Math.round(TYPING_SPEED_MS * 1.6),  // ms — slowest gap (~224); variance = natural
  wordPause: TYPING_SPEED_MS,  // ms — extra pause after a space (between words)
  fieldFocusMin: 90,         // ms — settle after focusing a field, before the first keystroke
  fieldFocusMax: 200,
  fieldPause: 260,           // ms — pause after finishing a field, before the next
  thinkPause: 420,           // ms — "thinking" pause before complex fields (IDs, dates, passport)
  sectionPause: 350,         // ms — pause when a new section opens
  maxTypeLength: 48,         // values longer than this are set at once (kept snappy)
});

// Fields that warrant a short "thinking" pause before typing (recalling a number/date).
export const COMPLEX_FIELD = /passport|nationalid|tin|dob|dateof|birth|licence|license|number|reference/i;

export const useTypingConfig = create(
  persist(
    (set) => ({
      config: { ...DEFAULT_TYPING_CONFIG },
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      reset: () => set({ config: { ...DEFAULT_TYPING_CONFIG } }),
    }),
    { name: 'oc-typing-config' },
  ),
);

/** Non-hook accessor for the engine (which runs outside React render). */
export const getTypingConfig = () => useTypingConfig.getState().config;
