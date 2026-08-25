"""JWT verification against the oneCitizen backend's shared HS256 secret.

The frontend already stores the citizen's access token (zustand `oc-auth`). The
agent service verifies it with the same JWT_SECRET so it can act *only* under the
citizen's own identity — the assistant is an accelerator over the same APIs a
human uses, never a privileged actor (docs/AI_ASSISTANT.md §1).
"""
from __future__ import annotations

import logging

import jwt

from .config import settings

log = logging.getLogger("askgov.security")


class AuthError(Exception):
    """Raised when a token is required but missing/invalid."""


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def resolve_subject(authorization: str | None) -> str:
    """Return the citizen id (JWT `sub`) for this request.

    - Valid Bearer token → its `sub`.
    - No/invalid token and AUTH_REQUIRED is false → the demo citizen id.
    - No/invalid token and AUTH_REQUIRED is true → AuthError.
    """
    token = _extract_bearer(authorization)
    if token:
        try:
            claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
            sub = claims.get("sub")
            if sub:
                return str(sub)
        except jwt.PyJWTError as exc:  # expired / bad signature / malformed
            log.warning("JWT rejected: %s", exc)
            if settings.auth_required:
                raise AuthError(str(exc)) from exc

    if settings.auth_required:
        raise AuthError("missing or invalid Authorization header")
    return settings.demo_user_id
