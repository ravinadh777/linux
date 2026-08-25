"""`suggest_prefill` — propose auto-fill values for ANY service form.

Given the citizen's held records (National ID, contact, address, previous passport,
GRA/TIN, civil registry), it proposes values for whatever service form the citizen
is on. The values are NOT written into the form here — the frontend lists them in
chat and offers a single "Apply to form" action the citizen taps themselves.
"machines flag, humans decide": the agent never submits.

When the citizen asks to change a value, pass it as `overrides`; the change is
written into their in-memory profile so this and later prefills reflect it, then it
is shown back marked "You updated".
"""
from __future__ import annotations

import json

from langchain_core.tools import tool

from ..agent.run_context import get_run_context
from ..integrations.backend import patch_me
from .records import build_prefill, canonical_name, set_profile_field


@tool
def suggest_prefill(overrides: dict[str, str] | None = None) -> str:
    """Propose auto-fill values for the current service form from the citizen's records.

    Use this whenever the citizen is on a service application form, or asks to
    pre-fill / auto-complete / draft / fill the form. The proposed values come only
    from the citizen's held records; you never submit the form.

    Args:
        overrides: Optional {field name: value} the citizen EXPLICITLY asked to
            change (e.g. {"phone": "+592 700 0002"}, {"region": "Region 6 ..."}).
            Each is SAVED to the citizen's profile so later prefills use it, then
            shown marked "You updated". Only include values the citizen actually
            stated — never invent or guess. Use the form's field names or their
            labels (e.g. "Mobile number", "Region").
    """
    ctx = get_run_context()
    if ctx is None:
        return json.dumps({"summary": "No citizen context available; cannot prefill."})

    page = ctx.page or {}
    service_id = page.get("serviceId")
    form_fields = page.get("formFields")

    # Apply citizen-requested changes to the in-memory profile first (session-scoped),
    # so the prefill — and every later one — reflects them.
    updated: set[str] = set()
    updated_labels: list[str] = []
    persist: dict[str, str] = {}
    for key, value in (overrides or {}).items():
        if value in (None, ""):
            continue
        name = canonical_name(key)
        label = set_profile_field(ctx.user, name, value)
        updated.add(name)
        updated_labels.append(label)
        persist[name] = value
    # Save the citizen's confirmed changes back to their profile (PATCH /me) so they persist
    # and are reused next time — best-effort; the in-memory change already applies this run.
    if persist:
        patch_me(ctx.token, persist)

    prefill = build_prefill(ctx.user, form_fields=form_fields, service_id=service_id, updated=updated)
    filled = len(prefill["values"])
    service_label = page.get("serviceName") or service_id or "this form"

    def _labels(items: list, required_only: bool = False) -> str:
        picked = [i["label"] for i in items if not required_only or i.get("required")]
        return ", ".join(picked)

    remaining_req = _labels(prefill["remaining"], required_only=True)
    documents = _labels(prefill["documents"])

    if filled == 0:
        need = f" The citizen still needs to complete: {remaining_req}." if remaining_req else ""
        docs = f" And upload: {documents}." if documents else ""
        summary = (
            f"No held records match the {service_label} fields, so there's nothing to "
            f"prefill.{need}{docs}"
        )
        return json.dumps({"summary": summary, "prefill": prefill})

    upd_note = (
        f" Saved your change to {', '.join(updated_labels)} and marked it 'You updated'."
        if updated_labels else ""
    )
    need = f" Still to complete themselves: {remaining_req}." if remaining_req else ""
    docs = f" Documents to upload: {documents}." if documents else ""
    summary = (
        f"Drafted {filled} field(s) for {ctx.user['name']} on the {service_label} form from "
        f"their held records.{upd_note}{need}{docs} Listed for the citizen to review, change or "
        "apply — not submitted."
    )
    return json.dumps({"summary": summary, "prefill": prefill})
