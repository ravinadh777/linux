// Run observer (Phase 8 — event-driven). Accumulates a single run's AG-UI frames into
// durable turn state (assistant text, tool calls, prefill, suggestions, mode). Pure and
// framework-free so it is trivially unit-testable and reusable by both the streaming
// path and the one-shot /extract path.
import { AguiEvent, CustomPayload } from '../constants/events.js';

export class RunAccumulator {
  constructor() {
    this.messageId = null;
    this._text = [];
    this.toolCalls = [];
    this._toolById = new Map();
    this.prefill = null;
    this.proposedPrefill = null;
    this.suggestions = [];
    this.validation = null;
    this.mode = null;
    this.error = null;
  }

  consume(evt) {
    if (!evt || typeof evt !== 'object') return;
    switch (evt.type) {
      case AguiEvent.TEXT_MESSAGE_START:
        this.messageId = evt.messageId || this.messageId;
        break;
      case AguiEvent.TEXT_MESSAGE_CONTENT:
        if (typeof evt.delta === 'string') this._text.push(evt.delta);
        break;
      case AguiEvent.TOOL_CALL_START: {
        const tc = { id: evt.toolCallId, name: evt.toolCallName, args: '', result: null };
        this._toolById.set(evt.toolCallId, tc);
        this.toolCalls.push(tc);
        break;
      }
      case AguiEvent.TOOL_CALL_ARGS: {
        const tc = this._toolById.get(evt.toolCallId);
        if (tc && typeof evt.delta === 'string') tc.args += evt.delta;
        break;
      }
      case AguiEvent.TOOL_CALL_RESULT: {
        const tc = this._toolById.get(evt.toolCallId);
        if (tc) tc.result = evt.content;
        break;
      }
      case AguiEvent.STATE_SNAPSHOT:
        if (evt.snapshot?.proposedPrefill) this.proposedPrefill = evt.snapshot.proposedPrefill;
        break;
      case AguiEvent.STATE_DELTA:
        for (const op of evt.delta || []) {
          if (op.path === '/proposedPrefill' && op.value) this.proposedPrefill = op.value;
        }
        break;
      case AguiEvent.CUSTOM:
        if (evt.name === CustomPayload.PREFILL) this.prefill = evt.value;
        else if (evt.name === CustomPayload.SUGGESTIONS && Array.isArray(evt.value)) this.suggestions = evt.value;
        else if (evt.name === CustomPayload.VALIDATION) this.validation = evt.value;
        break;
      case AguiEvent.RUN_FINISHED:
        this.mode = evt.result?.mode || this.mode;
        break;
      case AguiEvent.RUN_ERROR:
        this.error = evt.message || 'run error';
        break;
      default:
        break;
    }
  }

  text() {
    return this._text.join('');
  }
}
