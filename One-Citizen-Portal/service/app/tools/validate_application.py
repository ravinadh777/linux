"""`validate_application` — run the current service's validation rules on demand.

The automatic validation node runs on every form edit (the `field_changed`
trigger). This tool exposes the *same* rules to the LLM so the citizen can also
ask in chat — "check my form", "is anything wrong?", "validate my details" — and
so the agent can self-check after helping. It reads the live form values, the
current service and the citizen's records from the run context; it never changes
anything. Works for every service, not just passport renewal.
"""
from __future__ import annotations

import json

from langchain_core.tools import tool

from ..agent.run_context import get_run_context
from ..agent.validators import validate_form


@tool
def validate_application() -> str:
    """Validate the citizen's current service form.

    Checks the values currently in the form against the citizen's held records
    (e.g. a region or name that differs from what's on file) and for sanity /
    service-specific rules (a future date of birth, a malformed email or phone, and
    for passports a date of birth that conflicts with the passport issue date). Use
    whenever the citizen asks to check/validate the form or whether something is
    wrong, or to confirm the form after making changes.

    Returns a JSON object: {ok, issueCount, issues:[{level, label, message,
    suggestion}]}. Report each issue plainly, note whether it's an error (must fix)
    or a warning (please confirm), and offer the suggested fix. You never edit the
    form yourself.
    """
    ctx = get_run_context()
    if ctx is None:
        return json.dumps({"ok": False, "note": "No citizen context available."})
    form_values = (ctx.page or {}).get("formValues") or {}
    service_id = (ctx.page or {}).get("serviceId")
    issues = validate_form(ctx.user, form_values, service_id)
    return json.dumps(
        {"ok": not issues, "issueCount": len(issues), "issues": issues}, ensure_ascii=False
    )
