"""Deterministic fallback agent.

Runs when no OPENAI_API_KEY is configured. It reproduces the *same* AG-UI event
stream an LLM-backed run would produce — tool calls, the prefill proposal (as data),
shared-state deltas and streamed assistant text — so the whole end-to-end experience
is demonstrable without an LLM key. Works for every service, not just passports.
Intent is matched with the same lightweight rules the portal's existing AskGov uses.
"""
from __future__ import annotations

import asyncio
import json
import re
import uuid
from collections.abc import AsyncIterator
from typing import Any

from ..tools.records import build_prefill
from . import agui_emit as emit
from .run_context import RunContext

# Explicit "fill the form" verbs. NB: "renew(al)" is deliberately excluded — a
# question like "what documents do I need for renewal?" must route to docs, not
# to the prefill proposal.
_WANTS_STATUS = re.compile(r"\b(status|track|progress|where.*application|my application|approved|rejected|under review)\b", re.I)
_WANTS_FILL = re.compile(r"\b(fill|auto[- ]?fill|prefill|pre-fill|populate|complete|draft)\b", re.I)
_WANTS_DOCS = re.compile(r"\b(document|documents|need|require|eligib|checklist|bring)\b", re.I)
_WANTS_WEB = re.compile(r"\b(fee|fees|cost|price|how long|processing|time|hours|office|where)\b", re.I)
_MENTIONS_APPLY = re.compile(r"\b(renew|renewal|passport|apply|application|register|licence|license|pension|grant|certificate|permit)\b", re.I)


async def run_deterministic(text: str, trigger: str, ctx: RunContext) -> AsyncIterator[str]:
    page = ctx.page or {}
    on_service = bool(page.get("serviceId"))
    text = (text or "").strip()

    # System triggers (no user text) take precedence: acknowledge the apply/dismiss
    # of the prefill rather than re-offering it.
    if trigger == "prefill_applied":
        flow = _applied_flow(ctx)
    elif trigger == "prefill_dismissed":
        flow = _dismissed_flow(ctx)
    # Route in priority order: explicit fill verb > docs > fees/web > on-service
    # auto-offer (empty message or nav) > generic help.
    elif _WANTS_STATUS.search(text):
        flow = _status_flow(ctx)
    elif _WANTS_FILL.search(text):
        flow = _prefill_flow(ctx)
    elif _WANTS_DOCS.search(text):
        flow = _knowledge_flow(ctx, text)
    elif _WANTS_WEB.search(text):
        flow = _web_flow(ctx, text)
    elif on_service and (not text or trigger == "page_context" or _MENTIONS_APPLY.search(text)):
        flow = _prefill_flow(ctx)
    elif _MENTIONS_APPLY.search(text):
        flow = _prefill_flow(ctx)
    else:
        flow = _help_flow(ctx)

    async for f in flow:
        yield f


# ── flows ────────────────────────────────────────────────────────────────────
def _service_label(ctx: RunContext) -> str:
    page = ctx.page or {}
    return page.get("serviceName") or page.get("serviceId") or "this"


async def _prefill_flow(ctx: RunContext) -> AsyncIterator[str]:
    page = ctx.page or {}
    prefill = build_prefill(ctx.user, form_fields=page.get("formFields"), service_id=page.get("serviceId"))
    if not prefill["values"]:
        # Nothing on file matches this form — fall back to a general offer of help.
        async for f in _help_flow(ctx):
            yield f
        return

    service = _service_label(ctx)
    n = len(prefill["values"])
    async for f in _tool("suggest_prefill", {},
                         summary=f"Drafted {n} field(s) for {ctx.user['name']} on the {service} "
                                 "form from their held records. Listed to review, change or apply."):
        yield f
    # the prefill proposal (data) + shared-state update — no generative card
    yield emit.frame(emit.custom("Prefill", prefill))
    yield emit.frame(emit.state_delta(
        [{"op": "add", "path": "/proposedPrefill", "value": prefill["values"]}]))

    lines = "\n".join(f"- **{f['label']}**: {f['value']} _({f['source']})_" for f in prefill["fields"])
    body = f"Here's what I can fill on your {service} form from your records:\n\n{lines}"
    todo = _remaining_lines(prefill)
    if todo:
        body += "\n\n" + todo
    body += ("\n\nTell me if anything should change, or tap **Apply to form** to fill in what I "
             "drafted. I never submit for you — you review and submit yourself.")
    async for f in _text(body):
        yield f
    yield emit.frame(emit.custom("Suggestions",
        ["What documents do I need?", "How much is the fee?", "Change a detail"]))


def _remaining_lines(prefill: dict[str, Any]) -> str:
    """The 'still to complete' + 'upload' lines from a prefill payload (required only)."""
    req = [r["label"] for r in prefill.get("remaining", []) if r.get("required")]
    docs = [d["label"] for d in prefill.get("documents", [])]
    out = []
    if req:
        out.append(f"You'll still need to fill in yourself: {', '.join(req)}.")
    if docs:
        out.append(f"And upload: {', '.join(docs)}.")
    return "\n".join(out)


async def _applied_flow(ctx: RunContext) -> AsyncIterator[str]:
    page = ctx.page or {}
    name = ctx.user.get("name", "there").split()[0]
    service = _service_label(ctx)
    prefill = build_prefill(ctx.user, form_fields=page.get("formFields"), service_id=page.get("serviceId"))
    todo = _remaining_lines(prefill)
    body = f"Done, {name} — I've applied those details to your {service} form."
    if todo:
        body += "\n\n" + todo
    body += ("\n\nStep through each section, check everything reads correctly, complete the fields "
             "above, then tap **Submit** — I never submit for you.")
    async for f in _text(body):
        yield f
    yield emit.frame(emit.custom("Suggestions",
        ["What documents do I need?", "Check my form for errors"]))


async def _dismissed_flow(ctx: RunContext) -> AsyncIterator[str]:
    service = _service_label(ctx)
    async for f in _text(
        "No problem — I've cleared that suggestion and you can fill the form in yourself. "
        f"If you'd like, I can tell you which documents to upload for your {service} application, "
        "look up fees and processing time, or draft the form again from your records whenever "
        "you're ready."
    ):
        yield f
    yield emit.frame(emit.custom("Suggestions",
        ["What documents do I need?", "How much is the fee?", "Auto-fill the form from my records"]))


async def _status_flow(ctx: RunContext) -> AsyncIterator[str]:
    from ..tools.applications import my_applications
    out = my_applications.invoke({})
    async for f in _tool("my_applications", {}, summary=out):
        yield f
    try:
        summary = json.loads(out).get("summary", "")
    except (ValueError, TypeError):
        summary = out
    async for f in _text(summary):
        yield f
    yield emit.frame(emit.custom("Suggestions",
        ["What documents do I need?", "Auto-fill a new application", "How much is the fee?"]))


async def _knowledge_flow(ctx: RunContext, query: str) -> AsyncIterator[str]:
    from ..tools.knowledge_base import knowledge_base
    page = ctx.page or {}
    q = page.get("serviceName") or page.get("serviceId") or "passport"
    out = knowledge_base.invoke({"query": q})
    async for f in _tool("knowledge_base", {"query": q}, summary=out):
        yield f
    service = _service_label(ctx)
    async for f in _text(
        f"You'll find the required documents for your {service} application in the "
        "**Required documents** step of the form. Upload each one there — I can pre-fill "
        "the rest of the form from your records if you'd like."
    ):
        yield f
    yield emit.frame(emit.custom("Suggestions",
        ["Auto-fill the form from my records", "How much is the fee?"]))


async def _web_flow(ctx: RunContext, query: str) -> AsyncIterator[str]:
    from ..tools.web_search import web_search
    out = await web_search.ainvoke({"query": query})
    async for f in _tool("web_search", {"query": query}, summary=out):
        yield f
    service = _service_label(ctx)
    async for f in _text(
        f"I've looked up the latest public guidance for your {service} application above. "
        "Processing times and fees vary by service and office. Want me to pre-fill your form "
        "from your records so you can get started?"
    ):
        yield f
    yield emit.frame(emit.custom("Suggestions",
        ["Auto-fill the form from my records", "What documents do I need?"]))


async def _help_flow(ctx: RunContext) -> AsyncIterator[str]:
    name = ctx.user.get("name", "there").split()[0]
    async for f in _text(
        f"Hi {name}, I'm AskGov. I can help you with any oneCitizen service — I can auto-fill an "
        "application form from your records, tell you what documents you need, or look up fees "
        "and processing times. What would you like to do?"
    ):
        yield f
    yield emit.frame(emit.custom("Suggestions",
        ["Auto-fill this form from my records", "What documents do I need?", "How much is the fee?"]))


# ── low-level emitters (simulate streaming) ──────────────────────────────────
async def _tool(name: str, args: dict[str, Any], summary: str) -> AsyncIterator[str]:
    call_id = f"tc_{uuid.uuid4().hex[:10]}"
    yield emit.frame(emit.tool_call_start(call_id, name))
    arg_json = json.dumps(args)
    for chunk in _chunks(arg_json, 24):
        yield emit.frame(emit.tool_call_args(call_id, chunk))
        await asyncio.sleep(0)
    yield emit.frame(emit.tool_call_end(call_id))
    yield emit.frame(emit.tool_call_result(call_id, summary, f"toolres_{uuid.uuid4().hex[:8]}"))


async def _text(text: str) -> AsyncIterator[str]:
    msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    yield emit.frame(emit.text_message_start(msg_id))
    for chunk in _chunks(text, 5, by_words=True):
        yield emit.frame(emit.text_message_content(msg_id, chunk))
        await asyncio.sleep(0.01)
    yield emit.frame(emit.text_message_end(msg_id))


def _chunks(text: str, size: int, by_words: bool = False):
    if by_words:
        words = text.split(" ")
        for i in range(0, len(words), size):
            yield (" " if i else "") + " ".join(words[i : i + size])
    else:
        for i in range(0, len(text), size):
            yield text[i : i + size]
