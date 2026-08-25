"""The validation node's SSE entrypoint for the `field_changed` trigger.

As the citizen edits the passport-renewal form, the frontend streams the live form
values into AG-UI shared state (debounced). Each change runs the deterministic
validation rules in `validators.py` — record matches AND cross-field consistency
(e.g. a date of birth that conflicts with the passport's own issue date) — and, if
anything is off, replies with a flagged message + suggested fixes.

No LLM is involved: the check is a pure rule pass, so it is instant, free and
deterministic. It stays SILENT when everything is valid, so editing produces no
chat noise unless a value actually conflicts.
"""
from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncIterator
from typing import Any

from . import agui_emit as emit
from .run_context import RunContext
from .validators import validate_form

_MARK = {"error": "⛔", "warning": "⚠️"}


async def _stream_text(text: str) -> AsyncIterator[str]:
    msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    yield emit.frame(emit.text_message_start(msg_id))
    words = text.split(" ")
    for i in range(0, len(words), 6):
        yield emit.frame(emit.text_message_content(msg_id, (" " if i else "") + " ".join(words[i : i + 6])))
        await asyncio.sleep(0.01)
    yield emit.frame(emit.text_message_end(msg_id))


def _compose(issues: list[dict[str, str]]) -> str:
    errors = [i for i in issues if i["level"] == "error"]
    lines = [f"- {_MARK.get(i['level'], '•')} **{i['label']}**: {i['message']}" for i in issues]
    n = len(issues)
    head = (
        "I checked the form against your records and for internal consistency. "
        + ("One thing needs" if n == 1 else f"{n} things need")
        + " a look:\n\n"
        + "\n".join(lines)
    )
    if errors:
        tail = (
            "\n\nThe items marked ⛔ can't be right as entered, so please correct them before "
            "submitting. If a ⚠️ change is genuinely intentional, keep your version — a CIPO "
            "officer verifies every application."
        )
    else:
        tail = (
            "\n\nIf you changed "
            + ("this" if n == 1 else "these")
            + " on purpose, keep your version — a CIPO officer verifies every application. "
            "Otherwise you can re-apply the values we hold on file."
        )
    return head + tail


async def run_field_review(form_values: dict[str, Any], ctx: RunContext) -> AsyncIterator[str]:
    """Emit a flag message when the form has validation issues; else stay silent."""
    issues = validate_form(ctx.user, form_values, (ctx.page or {}).get("serviceId"))
    if not issues:
        return  # all clear — no message, no suggestions

    # Structured event first (so a richer UI could highlight each field inline)…
    yield emit.frame(emit.custom("Validation", {"issues": issues, "ok": False}))
    # …then the human-readable summary.
    async for f in _stream_text(_compose(issues)):
        yield f

    # De-duplicated suggestion chips: the per-issue fixes, then a couple of standbys.
    seen: set[str] = set()
    chips: list[str] = []
    for i in issues:
        s = i.get("suggestion")
        if s and s not in seen:
            seen.add(s)
            chips.append(s)
    for extra in ("Auto-fill the form from my records", "What documents do I need?"):
        if extra not in seen:
            seen.add(extra)
            chips.append(extra)
    yield emit.frame(emit.custom("Suggestions", chips[:4]))
