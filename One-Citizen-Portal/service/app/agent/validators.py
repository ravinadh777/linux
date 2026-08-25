"""Rule-based validation over a live service form — for EVERY service.

Three kinds of rule, all pure functions of (citizen record, form values, service):

  1. Record match  — a typed value differs from what the government holds
                      (e.g. a region that doesn't match the address on file). Works
                      for any service via the shared field map in `tools.records`.
  2. Generic sanity — service-independent format/plausibility checks: a future date
                      of birth, a malformed email, an implausible phone number.
  3. Per-service    — rules specific to one service: passport date consistency
                      (DOB vs issue date, issue vs expiry), old-age-pension age ≥ 65.

No LLM and no I/O, so the whole pass runs in microseconds on every keystroke and is
fully deterministic. "machines flag, humans decide": we only ever surface
warnings/errors + a suggested fix. Nothing is changed or blocked automatically.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any

from ..tools.records import record_field

# Younger than this at the time the current passport was issued → ask them to
# confirm (Guyana issues minor passports, so it's a soft check, never a hard block).
_CONFIRM_AGE_AT_ISSUE = 16
_PENSION_MIN_AGE = 65

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DATE_FIELDS = {"dob", "dateOfBirth", "issueDate", "expiryDate"}


def _norm(v: Any) -> str:
    return str(v).strip().casefold()


def _parse_date(v: Any) -> date | None:
    try:
        return date.fromisoformat(str(v)[:10])
    except (ValueError, TypeError):
        return None


def _years_between(start: date, end: date) -> int:
    return end.year - start.year - ((end.month, end.day) < (start.month, start.day))


def _effective(form_values: dict[str, Any], user: dict[str, Any], *names: str) -> Any:
    """Value the citizen typed for any alias of a field, else the value on file."""
    for name in names:
        v = (form_values or {}).get(name)
        if v not in (None, "", []):
            return v
    for name in names:
        mapped = record_field(user, name)
        if mapped and mapped[1] not in (None, ""):
            return mapped[1]
    return None


def _issue(level: str, field: str, label: str, message: str, suggestion: str | None = None) -> dict[str, str]:
    out = {"level": level, "field": field, "label": label, "message": message}
    if suggestion:
        out["suggestion"] = suggestion
    return out


def _valid_phone(v: str) -> bool:
    digits = re.sub(r"[\s+()\-]", "", str(v))
    return digits.isdigit() and 7 <= len(digits) <= 15


def validate_form(
    user: dict[str, Any], form_values: dict[str, Any], service_id: str | None = None
) -> list[dict[str, str]]:
    """Return every validation issue for the current form. Empty list == all clear."""
    fv = form_values or {}
    issues: list[dict[str, str]] = []
    flagged: set[str] = set()  # fields that already have an issue — avoid double-flagging

    # ── 1) Record match — typed value diverges from the record on file ──────────
    for name, entered in fv.items():
        if entered in (None, "", []):
            continue
        mapped = record_field(user, name)
        if not mapped:
            continue
        label, record_val, source = mapped
        if record_val in (None, ""):
            continue
        if _norm(entered) != _norm(record_val):
            issues.append(_issue(
                "warning", name, label,
                f"You entered “{entered}”, but your {source} shows “{record_val}”.",
                f"Restore {label} from records",
            ))
            flagged.add(name)

    # ── 2) Generic sanity — format & plausibility, independent of service ───────
    today = date.today()
    for name in ("dob", "dateOfBirth"):
        d = _parse_date(fv.get(name))
        if d and d > today:
            issues.append(_issue(
                "error", name, "Date of birth",
                f"The date of birth ({d.isoformat()}) is in the future.",
                "Restore Date of birth from records",
            ))
            flagged.add(name)
    if fv.get("email") and "email" not in flagged and not _EMAIL_RE.match(str(fv["email"])):
        issues.append(_issue(
            "warning", "email", "Email",
            f"“{fv['email']}” doesn't look like a valid email address.",
        ))
    for name in ("phone", "emergencyPhone", "nextOfKinPhone"):
        if fv.get(name) and name not in flagged and not _valid_phone(fv[name]):
            issues.append(_issue(
                "warning", name, "Phone number",
                f"“{fv[name]}” doesn't look like a valid phone number.",
            ))

    # ── 3) Per-service rules ────────────────────────────────────────────────────
    if service_id in ("passport-renew", "passport-new"):
        issues += _passport_rules(user, fv)
    if service_id == "old-age-pension":
        issues += _pension_rules(fv)

    return issues


def _passport_rules(user: dict[str, Any], fv: dict[str, Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    dob = _parse_date(_effective(fv, user, "dob", "dateOfBirth"))
    issue_date = _parse_date(_effective(fv, user, "issueDate"))
    expiry_date = _parse_date(_effective(fv, user, "expiryDate"))
    dob_typed = any(fv.get(n) not in (None, "", []) for n in ("dob", "dateOfBirth"))

    if dob and issue_date:
        if dob >= issue_date:
            out.append(_issue(
                "error", "dob", "Date of birth",
                f"The date of birth ({dob.isoformat()}) is on or after your current passport's "
                f"issue date ({issue_date.isoformat()}) — a passport cannot be issued before the "
                "holder is born.",
                "Restore Date of birth from records",
            ))
        elif dob_typed and _years_between(dob, issue_date) < _CONFIRM_AGE_AT_ISSUE:
            out.append(_issue(
                "warning", "dob", "Date of birth",
                f"The date of birth you entered ({dob.isoformat()}) would make you "
                f"{_years_between(dob, issue_date)} when your current passport was issued "
                f"({issue_date.isoformat()}) — please confirm it matches your National ID.",
                "Restore Date of birth from records",
            ))
    if issue_date and expiry_date and issue_date >= expiry_date:
        out.append(_issue(
            "error", "expiryDate", "Passport dates",
            f"The passport issue date ({issue_date.isoformat()}) is on or after its expiry date "
            f"({expiry_date.isoformat()}).",
            "Restore passport dates from records",
        ))
    return out


def _pension_rules(fv: dict[str, Any]) -> list[dict[str, str]]:
    dob = _parse_date(fv.get("dob"))
    if not dob:
        return []
    age = _years_between(dob, date.today())
    if age < _PENSION_MIN_AGE:
        return [_issue(
            "warning", "dob", "Date of birth",
            f"Old-Age Pension requires you to be {_PENSION_MIN_AGE} or older; the date of birth "
            f"entered ({dob.isoformat()}) makes you {age}. Please confirm your date of birth.",
        )]
    return []
