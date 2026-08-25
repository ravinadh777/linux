// Execution status store — the single source of truth the AskGov panel renders (progress,
// current field, completed/remaining counts, waiting-for, natural-language narration, status).
// The engine writes; the UI reads via narrow selectors (no re-render churn during typing).
import { create } from 'zustand';

export const ExecStatus = Object.freeze({
  IDLE: 'idle',
  REVIEWING: 'reviewing',
  SECTION: 'section',
  TYPING: 'typing',
  THINKING: 'thinking',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
});

const INITIAL = {
  active: false,
  status: ExecStatus.IDLE,
  // Control owner: 'agent' auto-fills; the FIRST genuine user interaction flips it to 'user'
  // and it STAYS 'user' (agent never grabs back) until the user EXPLICITLY asks it to fill
  // again (Auto-fill button / chat), or a fresh form resets it. See handToAgent()/takeOver().
  owner: 'agent',
  serviceName: null,
  sectionIndex: 0,
  sectionCount: 0,
  sectionTitle: null,
  currentField: null,
  currentLabel: null,
  completedCount: 0,
  remainingCount: 0,
  waitingFor: [],       // [{ name, label }]
  narration: null,
};

export const useExecutionStore = create((set, get) => ({
  ...INITIAL,
  update: (patch) => set(patch),
  // Full teardown (form unmount / clear) — owner returns to the default 'agent'.
  reset: () => set({ ...INITIAL }),
  // User took control — permanent for this form until an explicit handToAgent().
  takeOver: () => { if (get().owner !== 'user') set({ owner: 'user' }); },
  // Explicit "agent, fill this" request — the ONLY way back to agent within a form.
  handToAgent: () => set({ owner: 'agent' }),
}));

// Narrow selectors (keep components subscribed to only what they render).
export const useExecActive = () => useExecutionStore((s) => s.active);
export const useExecActiveField = () => useExecutionStore((s) => (s.active ? s.currentField : null));
export const useExecOwner = () => useExecutionStore((s) => s.owner);
