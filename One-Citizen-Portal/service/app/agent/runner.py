"""Run orchestrator: RunAgentInput → stream of AG-UI SSE frames.

Sets up the per-run context (resolved citizen + current page), then drives either
the OpenAI-backed LangGraph agent (translating LangChain's `astream_events` into
AG-UI events) or the deterministic fallback. Both emit an identical event grammar.
"""
from __future__ import annotations

import json
import logging
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from ..agui.types import RunAgentInput
from ..integrations.backend import fetch_applications, fetch_me, user_from_me
from . import agui_emit as emit
from .deterministic import run_deterministic
from .field_review import run_field_review
from .graph import build_graph
from .llm import create_llm
from .run_context import RunContext, reset_run_context, set_run_context

log = logging.getLogger("askgov.runner")

# Built once. `_GRAPH` is None when running the deterministic fallback.
_LLM = create_llm()
_GRAPH = build_graph(_LLM) if _LLM is not None else None


def llm_mode() -> str:
    return "openai" if _GRAPH is not None else "deterministic"


# ── public entrypoint ────────────────────────────────────────────────────────
async def run_agent(inp: RunAgentInput, subject: str, token: str | None = None) -> AsyncIterator[str]:
    # Ground the run ENTIRELY in LIVE database state: the citizen's profile comes from GET /me
    # (no mock/seed data), and their applications from GET /applications for status guidance.
    user = user_from_me(await fetch_me(token), subject)
    applications = await fetch_applications(token)
    page = _page_from_state(inp.state)
    ctx = RunContext(subject=subject, user=user, page=page, token=token, applications=applications)
    token = set_run_context(ctx)
    trigger = inp.trigger()
    try:
        yield emit.frame(emit.run_started(inp.threadId, inp.runId))
        yield emit.frame(emit.state_snapshot(_snapshot(inp.state, page, user)))
        try:
            if trigger == "field_changed":
                # Passive form monitoring: a cheap, deterministic record diff — no LLM.
                async for f in run_field_review(inp.state.get("formValues") or {}, ctx):
                    yield f
            elif _GRAPH is not None:
                async for f in _run_llm(inp, ctx):
                    yield f
            else:
                async for f in run_deterministic(inp.latest_user_text(), trigger, ctx):
                    yield f
        except Exception as exc:  # LLM path failed mid-run — degrade gracefully
            log.exception("agent run failed; falling back to deterministic: %s", exc)
            if trigger != "field_changed":  # field review has no card path to fall into
                async for f in run_deterministic(inp.latest_user_text(), trigger, ctx):
                    yield f
        yield emit.frame(emit.run_finished(inp.threadId, inp.runId, {"mode": llm_mode()}))
    finally:
        reset_run_context(token)


# ── LLM path: astream_events(v2) → AG-UI ─────────────────────────────────────
async def _run_llm(inp: RunAgentInput, ctx: RunContext) -> AsyncIterator[str]:
    inputs = {
        "messages": _to_lc_messages(inp, ctx),
        "shared": {"page": ctx.page, "user": ctx.user},
    }

    assistant_id = f"msg_{uuid.uuid4().hex[:10]}"
    text_open = False
    idx_to_call: dict[int, dict[str, Any]] = {}
    open_idxs: list[int] = []
    pending_by_name: dict[str, list[str]] = defaultdict(list)

    async for ev in _GRAPH.astream_events(inputs, version="v2"):
        kind = ev["event"]

        if kind == "on_chat_model_start":
            assistant_id = f"msg_{uuid.uuid4().hex[:10]}"
            text_open = False
            idx_to_call, open_idxs = {}, []

        elif kind == "on_chat_model_stream":
            chunk = ev["data"]["chunk"]
            text = _text_of(chunk)
            if text:
                if not text_open:
                    yield emit.frame(emit.text_message_start(assistant_id))
                    text_open = True
                yield emit.frame(emit.text_message_content(assistant_id, text))
            for tcc in getattr(chunk, "tool_call_chunks", None) or []:
                idx = tcc.get("index") or 0
                if idx not in idx_to_call:
                    call_id = tcc.get("id") or f"tc_{uuid.uuid4().hex[:10]}"
                    name = tcc.get("name") or "tool"
                    idx_to_call[idx] = {"id": call_id, "name": name, "named": bool(tcc.get("name"))}
                    open_idxs.append(idx)
                    yield emit.frame(emit.tool_call_start(call_id, name, assistant_id))
                    if tcc.get("name"):
                        pending_by_name[name].append(call_id)
                entry = idx_to_call[idx]
                if tcc.get("name") and not entry["named"]:
                    entry["name"], entry["named"] = tcc["name"], True
                    pending_by_name[tcc["name"]].append(entry["id"])
                if tcc.get("args"):
                    yield emit.frame(emit.tool_call_args(entry["id"], tcc["args"]))

        elif kind == "on_chat_model_end":
            if text_open:
                yield emit.frame(emit.text_message_end(assistant_id))
                text_open = False
            for idx in open_idxs:
                yield emit.frame(emit.tool_call_end(idx_to_call[idx]["id"]))
            open_idxs = []

        elif kind == "on_tool_end":
            name = ev.get("name") or ""
            output = ev["data"].get("output")
            raw = _tool_output_raw(output)
            call_id = pending_by_name[name].pop(0) if pending_by_name.get(name) else f"tc_{uuid.uuid4().hex[:10]}"
            summary, prefill = _summary_and_prefill(raw)
            yield emit.frame(emit.tool_call_result(call_id, summary, f"toolres_{uuid.uuid4().hex[:8]}"))
            if prefill and prefill.get("values"):
                yield emit.frame(emit.custom("Prefill", prefill))
                yield emit.frame(emit.state_delta(
                    [{"op": "add", "path": "/proposedPrefill", "value": prefill["values"]}]))


# ── helpers ──────────────────────────────────────────────────────────────────
def _page_from_state(state: dict[str, Any]) -> dict[str, Any]:
    keys = ("currentPage", "route", "serviceId", "serviceName", "formFields", "formValues")
    return {k: state.get(k) for k in keys if state.get(k) is not None}


def _snapshot(state: dict[str, Any], page: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    snap = dict(state)
    snap.update(page)
    snap["citizen"] = {"name": user.get("name"), "nationalId": user["profile"]["nationalId"]}
    snap.setdefault("proposedPrefill", None)
    return snap


def _to_lc_messages(inp: RunAgentInput, ctx: RunContext) -> list:
    msgs: list = []
    for m in inp.messages:
        if m.role == "user" and m.content:
            msgs.append(HumanMessage(content=m.content))
        elif m.role == "assistant" and m.content:
            msgs.append(AIMessage(content=m.content))
        elif m.role == "system" and m.content:
            msgs.append(SystemMessage(content=m.content))
        elif m.role == "tool" and m.content:
            msgs.append(ToolMessage(content=m.content, tool_call_id=m.tool_call_id or "0"))

    # Proactive/system triggers carry no user text — synthesize the citizen's intent
    # so the model has something concrete to respond to.
    last_is_user = bool(msgs) and isinstance(msgs[-1], HumanMessage)
    trig = inp.trigger()
    if not last_is_user:
        service = ctx.page.get("serviceName") or ctx.page.get("serviceId") or "this service"
        if trig == "page_context":
            page_name = ctx.page.get("currentPage") or ctx.page.get("serviceName") or "this page"
            hint = f"I just opened the {page_name} page."
            if ctx.page.get("serviceId"):
                hint += " Please offer to auto-fill this form from my records."
            msgs.append(HumanMessage(content=hint))
        elif trig == "prefill_applied":
            remaining = [r.get("label") for r in (inp.state.get("remaining") or []) if r.get("required")]
            documents = [d.get("label") for d in (inp.state.get("documents") or [])]
            rem_txt = f" I still need to complete these fields myself: {', '.join(remaining)}." if remaining else ""
            doc_txt = f" Documents to upload: {', '.join(documents)}." if documents else ""
            msgs.append(HumanMessage(content=(
                "I reviewed and applied your auto-fill suggestion — the form now holds those "
                f"values.{rem_txt}{doc_txt} Confirm briefly, then give me the next steps to finish "
                f"my {service} application: the fields I still need to complete, the documents to "
                "upload, and how to submit. Do not offer to auto-fill again. Keep it short."
            )))
        elif trig == "prefill_dismissed":
            msgs.append(HumanMessage(content=(
                "I dismissed the auto-fill suggestion — I'll fill the form in myself. "
                f"Acknowledge briefly and offer other ways you can help with my {service} "
                "application. Do not auto-fill unless I ask."
            )))
        else:
            msgs.append(HumanMessage(content="Hello"))
    return msgs


def _text_of(chunk: Any) -> str:
    content = getattr(chunk, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                out.append(block.get("text", ""))
            elif isinstance(block, str):
                out.append(block)
        return "".join(out)
    return ""


def _tool_output_raw(output: Any) -> str:
    if isinstance(output, str):
        return output
    content = getattr(output, "content", None)
    return content if isinstance(content, str) else json.dumps(output, default=str)


def _summary_and_prefill(raw: str) -> tuple[str, dict[str, Any] | None]:
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return raw, None
    if isinstance(data, dict):
        prefill = data.get("prefill") if isinstance(data.get("prefill"), dict) else None
        summary = data.get("summary") or raw
        return summary, prefill
    return raw, None
