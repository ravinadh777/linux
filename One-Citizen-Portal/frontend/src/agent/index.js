// Public barrel for the agent feature module (Phase 5/9 — clean module boundary).
// Consumers import from '@/agent' instead of reaching into internal folders.
export { default as AgentProvider } from './providers/AgentProvider.jsx';
export { AgentErrorBoundary } from './components/AgentErrorBoundary.jsx';
export { useAgentFormSync } from './hooks/useFormBridge.js';
export { buildGuide, mergeSuggestions } from './guidance.js';
export { useTypingStore, useTypingActiveField } from './typing/store.js';
export { useTypingConfig, getTypingConfig } from './typing/config.js';
export { useExecutionStore, useExecActive, useExecActiveField, ExecStatus } from './execution/executionStore.js';
export * from './hooks/index.js';
export * from './constants/events.js';
