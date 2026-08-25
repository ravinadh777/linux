"""`my_applications` — the citizen's LIVE applications and their workflow status.

Reads the applications loaded from the platform API for this run (RunContext.applications),
so AskGov can give end-to-end guidance grounded in current database state: what has been
submitted, what stage each case is at, and the next step for the citizen.
"""
from __future__ import annotations

import json

from langchain_core.tools import tool

from ..agent.run_context import get_run_context

# Plain-language next step per workflow status (citizen-facing).
_NEXT_STEP = {
    "submitted": "Received — waiting for an officer to start the review. No action needed yet.",
    "under_review": "An officer is reviewing it now. You may be contacted if anything is missing.",
    "approved": "Approved. Follow the collection/next-step instructions for this service.",
    "rejected": "Not approved. Check the reason and re-apply with the correction.",
    "awaiting_confirmation": "Awaiting office confirmation of your appointment slot.",
}


@tool
def my_applications() -> str:
    """List the citizen's current applications with their status and the next step.

    Use this whenever the citizen asks about the status/progress of an application or case,
    what they applied for, or what to do next. The data is live from the citizen's records.
    """
    ctx = get_run_context()
    apps = (ctx.applications if ctx else []) or []
    if not apps:
        return json.dumps({"summary": "You don't have any applications on record yet. I can help you start one."})

    items = []
    lines = []
    for a in apps[:10]:
        status = a.get("status") or "submitted"
        ref = a.get("reference") or a.get("id")
        name = a.get("serviceName") or a.get("serviceId") or "Application"
        step = _NEXT_STEP.get(status, "In progress.")
        reason = a.get("rejectionReason")
        line = f"- **{name}** ({ref}): {status.replace('_', ' ')}. {step}"
        if status == "rejected" and reason:
            line += f" Reason: {reason}."
        lines.append(line)
        items.append({"reference": ref, "service": name, "status": status,
                      "submittedAt": a.get("submittedAt"), "nextStep": step})

    summary = "Here are your current applications:\n" + "\n".join(lines)
    return json.dumps({"summary": summary, "applications": items})
