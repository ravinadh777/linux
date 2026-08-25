// AG-UI event vocabulary (Phase 8). Mirrors the Python engine + Node gateway so the
// three tiers speak one protocol. Client code switches on AguiEvent.* only.
export const AguiEvent = Object.freeze({
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  STEP_STARTED: 'STEP_STARTED',
  STEP_FINISHED: 'STEP_FINISHED',
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
  TOOL_CALL_END: 'TOOL_CALL_END',
  TOOL_CALL_RESULT: 'TOOL_CALL_RESULT',
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  STATE_DELTA: 'STATE_DELTA',
  CUSTOM: 'CUSTOM',
});

export const CustomPayload = Object.freeze({
  PREFILL: 'Prefill',
  VALIDATION: 'Validation',
  SUGGESTIONS: 'Suggestions',
});

export const AgentTrigger = Object.freeze({
  USER_MESSAGE: 'user_message',
  PAGE_CONTEXT: 'page_context',
  FIELD_CHANGED: 'field_changed',
  PREFILL_APPLIED: 'prefill_applied',
  PREFILL_DISMISSED: 'prefill_dismissed',
});

/** Human-friendly labels for tool calls surfaced in the UI. */
export const TOOL_LABELS = Object.freeze({
  suggest_prefill: 'Reading your records',
  knowledge_base: 'Searching guidance',
  web_search: 'Looking up public info',
  validate_application: 'Checking your form',
});
