"""AG-UI protocol event helpers + SSE encoder.

This is a self-contained, spec-compliant implementation of the wire format used
by the AG-UI protocol (https://docs.ag-ui.com). Every event is a JSON object with
an uppercase `type` discriminator; it is delivered to the browser as one
Server-Sent Event (`data: <json>\n\n`). Keeping our own thin encoder (rather than
pinning the `ag-ui-protocol` package) makes the service dependency-light and the
stream easy to inspect — swap in the official SDK later without touching callers.

Event lifecycle for one run:

    RUN_STARTED
      STATE_SNAPSHOT                     # shared state (current page, profile, …)
      [ TOOL_CALL_START
        TOOL_CALL_ARGS*                  # streamed argument deltas
        TOOL_CALL_END
        TOOL_CALL_RESULT ]*              # web_search / knowledge_base / suggest_prefill
      [ CUSTOM(name="Prefill") ]         # prefill values (listed in chat + Apply action)
      [ STATE_DELTA ]                    # e.g. /proposedPrefill added
      TEXT_MESSAGE_START
        TEXT_MESSAGE_CONTENT*            # streamed assistant tokens
      TEXT_MESSAGE_END
    RUN_FINISHED   (or RUN_ERROR)
"""
from __future__ import annotations

import json
import time
from enum import Enum
from typing import Any


class EventType(str, Enum):
    RUN_STARTED = "RUN_STARTED"
    RUN_FINISHED = "RUN_FINISHED"
    RUN_ERROR = "RUN_ERROR"
    STEP_STARTED = "STEP_STARTED"
    STEP_FINISHED = "STEP_FINISHED"
    TEXT_MESSAGE_START = "TEXT_MESSAGE_START"
    TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT"
    TEXT_MESSAGE_END = "TEXT_MESSAGE_END"
    TOOL_CALL_START = "TOOL_CALL_START"
    TOOL_CALL_ARGS = "TOOL_CALL_ARGS"
    TOOL_CALL_END = "TOOL_CALL_END"
    TOOL_CALL_RESULT = "TOOL_CALL_RESULT"
    STATE_SNAPSHOT = "STATE_SNAPSHOT"
    STATE_DELTA = "STATE_DELTA"
    MESSAGES_SNAPSHOT = "MESSAGES_SNAPSHOT"
    CUSTOM = "CUSTOM"


def _base(event_type: EventType) -> dict[str, Any]:
    return {"type": event_type.value, "timestamp": int(time.time() * 1000)}


def encode(event: dict[str, Any]) -> str:
    """Serialize one event object as an SSE frame."""
    return f"data: {json.dumps(event, separators=(',', ':'), ensure_ascii=False)}\n\n"


# ── run lifecycle ────────────────────────────────────────────────────────────
def run_started(thread_id: str, run_id: str) -> dict[str, Any]:
    return {**_base(EventType.RUN_STARTED), "threadId": thread_id, "runId": run_id}


def run_finished(thread_id: str, run_id: str, result: Any = None) -> dict[str, Any]:
    ev = {**_base(EventType.RUN_FINISHED), "threadId": thread_id, "runId": run_id}
    if result is not None:
        ev["result"] = result
    return ev


def run_error(message: str, code: str | None = None) -> dict[str, Any]:
    ev = {**_base(EventType.RUN_ERROR), "message": message}
    if code:
        ev["code"] = code
    return ev


def step_started(step_name: str) -> dict[str, Any]:
    return {**_base(EventType.STEP_STARTED), "stepName": step_name}


def step_finished(step_name: str) -> dict[str, Any]:
    return {**_base(EventType.STEP_FINISHED), "stepName": step_name}


# ── assistant text ───────────────────────────────────────────────────────────
def text_message_start(message_id: str, role: str = "assistant") -> dict[str, Any]:
    return {**_base(EventType.TEXT_MESSAGE_START), "messageId": message_id, "role": role}


def text_message_content(message_id: str, delta: str) -> dict[str, Any]:
    return {**_base(EventType.TEXT_MESSAGE_CONTENT), "messageId": message_id, "delta": delta}


def text_message_end(message_id: str) -> dict[str, Any]:
    return {**_base(EventType.TEXT_MESSAGE_END), "messageId": message_id}


# ── tool calls ───────────────────────────────────────────────────────────────
def tool_call_start(
    tool_call_id: str, tool_call_name: str, parent_message_id: str | None = None
) -> dict[str, Any]:
    ev = {
        **_base(EventType.TOOL_CALL_START),
        "toolCallId": tool_call_id,
        "toolCallName": tool_call_name,
    }
    if parent_message_id:
        ev["parentMessageId"] = parent_message_id
    return ev


def tool_call_args(tool_call_id: str, delta: str) -> dict[str, Any]:
    return {**_base(EventType.TOOL_CALL_ARGS), "toolCallId": tool_call_id, "delta": delta}


def tool_call_end(tool_call_id: str) -> dict[str, Any]:
    return {**_base(EventType.TOOL_CALL_END), "toolCallId": tool_call_id}


def tool_call_result(
    tool_call_id: str, content: str, message_id: str, role: str = "tool"
) -> dict[str, Any]:
    return {
        **_base(EventType.TOOL_CALL_RESULT),
        "messageId": message_id,
        "toolCallId": tool_call_id,
        "content": content,
        "role": role,
    }


# ── shared state ─────────────────────────────────────────────────────────────
def state_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {**_base(EventType.STATE_SNAPSHOT), "snapshot": snapshot}


def state_delta(delta: list[dict[str, Any]]) -> dict[str, Any]:
    """`delta` is a JSON Patch (RFC 6902) array."""
    return {**_base(EventType.STATE_DELTA), "delta": delta}


# ── custom (generative UI) ───────────────────────────────────────────────────
def custom(name: str, value: Any) -> dict[str, Any]:
    return {**_base(EventType.CUSTOM), "name": name, "value": value}
