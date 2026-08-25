"""Per-run context passed to tools out-of-band.

LangChain tools receive only the arguments the LLM produces. The passport-prefill
tool, however, needs the *resolved citizen profile* and the *current page* — which
come from the request (JWT + shared state), not from the model. We stash those in a
`ContextVar` for the duration of a single run; asyncio/contextvars propagate it into
the tool coroutine transparently (Python 3.11+).
"""
from __future__ import annotations

import contextvars
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RunContext:
    subject: str
    user: dict[str, Any]
    page: dict[str, Any] = field(default_factory=dict)
    token: str | None = None                                   # citizen JWT (for live backend reads)
    applications: list[dict[str, Any]] = field(default_factory=list)  # live applications + status


_current: contextvars.ContextVar[RunContext | None] = contextvars.ContextVar(
    "askgov_run_context", default=None
)


def set_run_context(ctx: RunContext) -> contextvars.Token:
    return _current.set(ctx)


def reset_run_context(token: contextvars.Token) -> None:
    _current.reset(token)


def get_run_context() -> RunContext | None:
    return _current.get()
