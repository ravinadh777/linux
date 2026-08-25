// Form bridge hook (Phase 6 — bidirectional sync, the "user edits -> agent context" half).
// Subscribes to react-hook-form's `watch` and debounces live edits into agent context via
// form-sync, so the next agent turn reasons over exactly what the citizen sees. The
// agent->form direction is handled by AgentProvider (autoApply / applyPrefill).
import { useContext, useEffect } from 'react';
import { AgentContext } from '../context/AgentContext.js';

export function useAgentFormSync(watch, { delay = 800 } = {}) {
  // Read the context directly (not the throwing `useAgent`) so a form rendered outside
  // the provider — e.g. in isolation tests — degrades to a no-op instead of crashing.
  const agent = useContext(AgentContext);
  const syncForm = agent?.syncForm;
  useEffect(() => {
    if (!syncForm || typeof watch !== 'function') return undefined;
    let timer;
    const sub = watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => syncForm(values), delay);
    });
    return () => {
      clearTimeout(timer);
      sub?.unsubscribe?.();
    };
  }, [watch, syncForm, delay]);
}
