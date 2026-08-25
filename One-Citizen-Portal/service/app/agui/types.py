"""AG-UI `RunAgentInput` (request body for the /agent SSE endpoint).

The frontend sends the running conversation plus a `state` object that carries the
*current page* the citizen is on. Because the agent re-reads `state` on every run,
the frontend effectively streams the live page context into the graph — this is
the AG-UI "shared state" mechanism the task asks for.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ToolCall(BaseModel):
    id: str
    type: Literal["function"] = "function"
    function: dict[str, Any]  # {name, arguments(json string)}


class Message(BaseModel):
    id: str | None = None
    role: Literal["user", "assistant", "system", "tool", "developer"]
    content: str | None = None
    name: str | None = None
    tool_calls: list[ToolCall] | None = Field(default=None, alias="toolCalls")
    tool_call_id: str | None = Field(default=None, alias="toolCallId")

    model_config = {"populate_by_name": True}


class ToolDef(BaseModel):
    name: str
    description: str | None = None
    parameters: dict[str, Any] | None = None


class PageState(BaseModel):
    """The shared-state slice the frontend keeps in sync with the router."""

    currentPage: str | None = None       # human label, e.g. "Passport Renewal"
    route: str | None = None             # location.pathname, e.g. /services/passport-renew/apply
    serviceId: str | None = None         # e.g. "passport-renew"
    serviceName: str | None = None
    formFields: list[dict[str, Any]] | None = None  # [{name,label,type,options}]
    formValues: dict[str, Any] | None = None         # live values the citizen has typed/applied
    proposedPrefill: dict[str, Any] | None = None   # set by the agent (card values)

    model_config = {"extra": "allow"}


class RunAgentInput(BaseModel):
    threadId: str
    runId: str
    messages: list[Message] = Field(default_factory=list)
    state: dict[str, Any] = Field(default_factory=dict)
    tools: list[ToolDef] = Field(default_factory=list)
    context: list[dict[str, Any]] = Field(default_factory=list)
    forwardedProps: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}

    def latest_user_text(self) -> str:
        for msg in reversed(self.messages):
            if msg.role == "user" and msg.content:
                return msg.content
        return ""

    def trigger(self) -> str:
        """`user_message` (default) or `page_context` (proactive help on nav)."""
        t = str(self.forwardedProps.get("trigger", "")).strip()
        return t or "user_message"
