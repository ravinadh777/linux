// AG-UI event vocabulary (Phase 8 — event-driven architecture).
// Mirrors service/app/agui/events.py::EventType exactly so both tiers speak one
// protocol. The gateway never rewrites frames; it only recognises these to persist
// conversation/form state as the stream flows past.

/** Wire-level AG-UI event types emitted by the Python engine. */
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
  MESSAGES_SNAPSHOT: 'MESSAGES_SNAPSHOT',
  CUSTOM: 'CUSTOM',
});

/** CUSTOM event names the engine uses (generative UI payloads). */
export const CustomPayload = Object.freeze({
  PREFILL: 'Prefill',
  VALIDATION: 'Validation',
  SUGGESTIONS: 'Suggestions',
});

/** Domain events the gateway emits to the app event bus (audit / analytics). */
export const AgentDomainEvent = Object.freeze({
  SESSION_CREATED: 'agent.session.created',
  RUN_STARTED: 'agent.run.started',
  RUN_FINISHED: 'agent.run.finished',
  RUN_FAILED: 'agent.run.failed',
  FORM_SYNCED: 'agent.form.synced',
});

/**
 * The trigger tells the engine why a run started (RunAgentInput.forwardedProps.trigger).
 * Must match service/app/agui/types.py::RunAgentInput.trigger().
 */
export const AgentTrigger = Object.freeze({
  USER_MESSAGE: 'user_message',
  PAGE_CONTEXT: 'page_context',
  FIELD_CHANGED: 'field_changed',
  PREFILL_APPLIED: 'prefill_applied',
  PREFILL_DISMISSED: 'prefill_dismissed',
});
