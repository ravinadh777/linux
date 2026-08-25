"""Read-only client for the oneCitizen platform API (the database owner).

The agent is a CLIENT of the platform, not a second database owner: it reads the
citizen's LIVE profile and applications from the backend using the citizen's own JWT,
so guidance is grounded in current DB data and respects the same authorization scope.
All calls are best-effort — on any error the agent degrades to its held/mock knowledge.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import settings

log = logging.getLogger("askgov.backend")


async def _get(path: str, token: str | None) -> Any | None:
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=settings.backend_timeout) as client:
            resp = await client.get(
                f"{settings.backend_api_url}{path}",
                headers={"Authorization": f"Bearer {token}"},
            )
        if resp.status_code == 200:
            return resp.json()
        log.warning("backend GET %s -> %s", path, resp.status_code)
    except Exception as exc:  # network / timeout / parse — never fatal to a run
        log.warning("backend GET %s failed: %s", path, exc)
    return None


async def fetch_me(token: str | None) -> dict[str, Any] | None:
    """The signed-in citizen's live identity/profile, or None."""
    data = await _get("/me", token)
    return data if isinstance(data, dict) else None


async def fetch_applications(token: str | None) -> list[dict[str, Any]]:
    """The citizen's live applications (with workflow status), or []."""
    data = await _get("/applications", token)
    if isinstance(data, dict):
        return data.get("items", []) or []
    return data or []


def user_from_me(me: dict[str, Any] | None, subject: str | None) -> dict[str, Any]:
    """Build the agent's citizen record ENTIRELY from the live `/me` response.

    There is no mock/seed fallback: the record's profile is exactly what the database holds
    for this citizen. Fields the profile doesn't yet have simply resolve to "no record", so
    the agent prompts the citizen and (via `patch_me`) saves the answer back for next time.
    """
    me = me or {}
    profile = dict(me.get("profile") or {})
    # `email`/`name` are top-level columns on /me — expose them under the field vocabulary too.
    if me.get("email") and not profile.get("email"):
        profile["email"] = me["email"]
    if me.get("name") and not profile.get("name"):
        profile["name"] = me["name"]
    return {
        "id": me.get("id") or subject,
        "name": me.get("name") or "there",
        "identifier": me.get("email") or subject,
        "assuranceLevel": 2,
        "profile": profile,
    }


def patch_me(token: str | None, changes: dict[str, Any]) -> bool:
    """Persist citizen-confirmed field changes back to their profile via PATCH /me.

    Best-effort and synchronous (called from the sync prefill tool). Any failure is swallowed —
    the in-memory change still applies for the current run; persistence just retries next time.
    """
    if not token or not changes:
        return False
    try:
        resp = httpx.patch(
            f"{settings.backend_api_url}/me",
            headers={"Authorization": f"Bearer {token}"},
            json=changes,
            timeout=settings.backend_timeout,
        )
        return resp.status_code == 200
    except Exception as exc:  # noqa: BLE001 — never fatal to a run
        log.warning("backend PATCH /me failed: %s", exc)
        return False
