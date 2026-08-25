"""Service-agnostic bridge between a citizen's held records and any service form.

Every oneCitizen service form (data/seed/service-forms.json) uses a small,
consistent vocabulary of field names — `nationalId`, `dob`, `phone`, `email`,
`lot`/`street`/`village`/`region`, `title`/`surname`/`givenNames` (or `fullName`),
`gender`, `occupation`, `tin`, `mothersMaidenName`, and the passport-specific set.
This module maps that vocabulary to the citizen's record ONCE, so the same prefill
and validation logic works for *every* service, not just passport renewal.

Three responsibilities:
  * `record_value(user, name)`  — what the government holds for a form field.
  * `build_prefill(user, …)`    — the list of values we can fill for a given form.
  * `set_profile_field(user, …)`— write a citizen-requested change back into the
                                   in-memory profile so later prefills reflect it.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any

# ── field vocabulary ─────────────────────────────────────────────────────────
# Each spec maps one or more form-field aliases to a single place in the record.
#   names      : form field names that resolve to this record value (aliases)
#   label      : human label for chat/validation messages
#   source     : where the value comes from (shown so the citizen can trust it)
#   confidence : high | medium | low  (how sure we are it's still current)
#   path       : dotted path into the user record (used for read AND write)
#   getter     : derived read (used instead of `path`); such fields write to `extra`
_Spec = dict[str, Any]


def _full_name(user: dict[str, Any]) -> str | None:
    p = user.get("profile", {})
    parts = [p.get("givenNames"), p.get("surname")]
    joined = " ".join(str(x) for x in parts if x)
    # Live profiles store a single `name` — fall back to it (and any explicit fullName).
    return joined or p.get("fullName") or user.get("name") or None


_SPECS: list[_Spec] = [
    {"names": ["title"], "label": "Title", "path": "profile.title", "source": "National ID", "confidence": "high"},
    {"names": ["surname"], "label": "Surname", "path": "profile.surname", "source": "National ID", "confidence": "high"},
    {"names": ["givenNames"], "label": "Given name(s)", "path": "profile.givenNames", "source": "National ID", "confidence": "high"},
    {"names": ["fullName", "requesterName"], "label": "Full name", "getter": _full_name, "source": "National ID", "confidence": "high"},
    {"names": ["dob", "dateOfBirth"], "label": "Date of birth", "path": "profile.dob", "source": "National ID", "confidence": "high"},
    {"names": ["sex", "gender"], "label": "Sex", "path": "profile.gender", "source": "National ID", "confidence": "high"},
    {"names": ["nationalId", "requesterId"], "label": "National ID number", "path": "profile.nationalId", "source": "National ID", "confidence": "high"},
    {"names": ["tin"], "label": "TIN", "path": "profile.tin", "source": "GRA record", "confidence": "high"},
    {"names": ["phone"], "label": "Mobile number", "path": "profile.phone", "source": "Contact record", "confidence": "medium"},
    {"names": ["email"], "label": "Email", "path": "profile.email", "source": "Contact record", "confidence": "medium"},
    {"names": ["occupation"], "label": "Occupation", "path": "profile.occupation", "source": "Your records", "confidence": "medium"},
    {"names": ["placeOfBirth"], "label": "Place of birth", "path": "profile.placeOfBirth", "source": "National ID", "confidence": "high"},
    {"names": ["countryOfBirth"], "label": "Country of birth", "path": "profile.countryOfBirth", "source": "National ID", "confidence": "medium"},
    {"names": ["maritalStatus"], "label": "Marital status", "path": "profile.maritalStatus", "source": "Civil registry", "confidence": "medium"},
    {"names": ["mothersName"], "label": "Mother's name", "path": "profile.mothersName", "source": "Birth record", "confidence": "medium"},
    {"names": ["mothersMaidenName"], "label": "Mother's maiden name", "path": "profile.mothersMaidenName", "source": "Birth record", "confidence": "medium"},
    {"names": ["fathersName"], "label": "Father's name", "path": "profile.fathersName", "source": "Birth record", "confidence": "medium"},
    {"names": ["nationalityAtBirth"], "label": "Nationality at birth", "path": "profile.nationalityAtBirth", "source": "National ID", "confidence": "medium"},
    {"names": ["presentNationality"], "label": "Present nationality", "path": "profile.presentNationality", "source": "National ID", "confidence": "medium"},
    {"names": ["lot"], "label": "Lot / house number", "path": "profile.lot", "source": "Address on file", "confidence": "medium"},
    {"names": ["street"], "label": "Street / scheme", "path": "profile.street", "source": "Address on file", "confidence": "medium"},
    {"names": ["village"], "label": "Village / ward", "path": "profile.village", "source": "Address on file", "confidence": "medium"},
    {"names": ["region"], "label": "Region", "path": "profile.region", "source": "Address on file", "confidence": "medium"},
    {"names": ["priorPassportNo"], "label": "Current passport number", "path": "passport.priorPassportNo", "source": "Previous passport", "confidence": "high"},
    {"names": ["issueDate"], "label": "Date of issue", "path": "passport.issueDate", "source": "Previous passport", "confidence": "high"},
    {"names": ["expiryDate"], "label": "Date of expiry", "path": "passport.expiryDate", "source": "Previous passport", "confidence": "high"},
    {"names": ["placeOfIssue"], "label": "Place of issue", "path": "passport.placeOfIssue", "source": "Previous passport", "confidence": "high"},
    {"names": ["bookletType"], "label": "Booklet type", "path": "passport.bookletType", "source": "Previous passport", "confidence": "medium"},
    {"names": ["collectionOffice"], "label": "Collection office", "path": "preferredCollectionOffice", "source": "Your preference", "confidence": "low"},
]

_SPEC_BY_NAME: dict[str, _Spec] = {name: spec for spec in _SPECS for name in spec["names"]}
_LABEL_BY_NAME: dict[str, str] = {name: spec["label"] for spec in _SPECS for name in spec["names"]}
_KNOWN_NAMES: set[str] = set(_SPEC_BY_NAME)
_NAME_BY_LABEL: dict[str, str] = {
    spec["label"].strip().casefold(): spec["names"][0] for spec in _SPECS
}


def _dig(record: dict[str, Any], dotted: str) -> Any:
    node: Any = record
    for part in dotted.split("."):
        if not isinstance(node, dict):
            return None
        node = node.get(part)
    return node


# ── reads ─────────────────────────────────────────────────────────────────────
def record_value(user: dict[str, Any], name: str) -> dict[str, Any] | None:
    """Resolve a form field name to what the government holds.

    Returns {name, label, value, source, confidence, overridden} or None if the
    field isn't backed by a record. A session change made via `set_profile_field`
    lands in `user['extra']` and wins, tagged so the citizen sees it's their edit.
    """
    extra = user.get("extra") or {}
    label = _LABEL_BY_NAME.get(name) or name
    if name in extra:
        return {"name": name, "label": label, "value": extra[name],
                "source": "You updated", "confidence": "review", "overridden": True}
    spec = _SPEC_BY_NAME.get(name)
    if not spec:
        return None
    getter: Callable[[dict[str, Any]], Any] | None = spec.get("getter")
    value = getter(user) if getter else _dig(user, spec["path"])
    if value in (None, ""):
        return None
    return {"name": name, "label": spec["label"], "value": value,
            "source": spec["source"], "confidence": spec["confidence"], "overridden": False}


def record_field(user: dict[str, Any], name: str) -> tuple[str, Any, str] | None:
    """(label, value-on-file, source) for a form field, or None if unmapped.

    Shared with the validation pass so "what the citizen typed" is compared against
    "what the government holds" using the exact same mapping that drives the prefill.
    """
    rec = record_value(user, name)
    if rec is None:
        return None
    return rec["label"], rec["value"], rec["source"]


def label_for(name: str, form_fields: list[dict[str, Any]] | None = None) -> str:
    if name in _LABEL_BY_NAME:
        return _LABEL_BY_NAME[name]
    for f in form_fields or []:
        if f.get("name") == name and f.get("label"):
            return f["label"]
    return name


def canonical_name(key: str) -> str:
    """Map a citizen-supplied key (field name OR human label) to a form field name."""
    if key in _KNOWN_NAMES:
        return key
    return _NAME_BY_LABEL.get(str(key).strip().casefold(), key)


# ── writes (session-scoped profile update) ─────────────────────────────────────
def set_profile_field(user: dict[str, Any], name: str, value: Any) -> str:
    """Write a citizen-requested change into the in-memory profile.

    Fields backed by a dotted path are written in place (so `record_value` reads the
    new value from its natural home); derived/unknown fields are stored in `extra`.
    Returns the human label for the field. The change lives for the process lifetime
    — later prefills across any service reflect it.
    """
    name = canonical_name(name)
    spec = _SPEC_BY_NAME.get(name)
    if spec and spec.get("path"):
        parts = spec["path"].split(".")
        node = user
        for part in parts[:-1]:
            nxt = node.get(part)
            if not isinstance(nxt, dict):
                nxt = {}
                node[part] = nxt
            node = nxt
        node[parts[-1]] = value
    else:
        user.setdefault("extra", {})[name] = value
    return _LABEL_BY_NAME.get(name, name)


# ── prefill for any service form ───────────────────────────────────────────────
def _derive_reason(user: dict[str, Any]) -> str | None:
    expiry = _dig(user, "passport.expiryDate")
    if not expiry:
        return None
    try:
        exp = date.fromisoformat(str(expiry)[:10])
    except ValueError:
        return None
    return "Expired" if exp < date.today() else "Expiring soon"


def build_prefill(
    user: dict[str, Any],
    form_fields: list[dict[str, Any]] | None = None,
    service_id: str | None = None,
    updated: set[str] | None = None,
) -> dict[str, Any]:
    """Build the prefill proposal for a service form from the citizen's records.

    Only the fields the current service form actually has are ever proposed: the
    frontend sends `form_fields` for the page the citizen is on, and we fill just
    those we hold a record for. If `form_fields` is missing we propose NOTHING — we
    never dump the citizen's whole profile onto an unknown form. `updated` marks
    fields the citizen just changed this turn so they're shown as "You updated".

    Returns {serviceId, fields:[…], values:{…}, remaining:[…], documents:[…]}:
      * fields/values — what we can fill from records.
      * remaining    — data fields on the form we could NOT fill (no record); the
                       citizen must complete these themselves.
      * documents    — file/upload fields the citizen must attach.
    Pure data, no UI. The frontend lists it in chat and offers a single "Apply to
    form" action; the agent also tells the citizen what's left to complete.
    """
    updated = updated or set()
    names = [f.get("name") for f in (form_fields or []) if f.get("name")]

    fields: list[dict[str, Any]] = []
    values: dict[str, Any] = {}
    for name in names:
        rec = record_value(user, name)
        if rec is None:
            # Reason for renewal is derived, not stored — offer it on passport forms.
            if name == "reason" and service_id in ("passport-renew", "passport-new"):
                reason = _derive_reason(user)
                if reason:
                    fields.append({"name": "reason", "label": "Reason for renewal", "value": reason,
                                   "source": "Derived from passport expiry", "confidence": "medium",
                                   "overridden": False})
                    values["reason"] = reason
            continue
        if name in updated:
            rec = {**rec, "source": "You updated", "confidence": "review", "overridden": True}
        fields.append(rec)
        values[name] = rec["value"]

    # What we could NOT fill — the citizen completes these. File fields become
    # "documents to upload"; everything else is a data field to type in.
    remaining: list[dict[str, Any]] = []
    documents: list[dict[str, Any]] = []
    for f in (form_fields or []):
        nm = f.get("name")
        if not nm or nm in values:
            continue
        entry = {"name": nm, "label": f.get("label") or label_for(nm, form_fields),
                 "required": bool(f.get("required"))}
        (documents if f.get("type") == "file" else remaining).append(entry)

    return {"serviceId": service_id, "fields": fields, "values": values,
            "remaining": remaining, "documents": documents}
