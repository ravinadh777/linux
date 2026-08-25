// Agent context (Phase 5). Carries only STABLE references (action callbacks + refs) so
// consuming components never re-render on streaming deltas — transient state lives in the
// zustand stores and is read via narrow selectors (Phase 10 — context splitting).
import { createContext, useContext } from 'react';

export const AgentContext = createContext(null);

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within <AgentProvider>');
  return ctx;
}
