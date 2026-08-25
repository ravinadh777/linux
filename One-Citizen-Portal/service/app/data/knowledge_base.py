"""Agent knowledge base.

Shape:

    {
      "Agencies": [...],   # government agencies (catalogue)
      "services": [...],   # bookable/appliable services (catalogue)
      "content":  {        # curated guidance ingested from knowledge_base/raw
        "documents": [ {id, agency, agencyName, category, title, source, text}, ... ],
        "count": N,
        "generatedAt": "..."
      }
    }

`content.documents` is produced by `scripts/ingest_knowledge.py` (real Guyana
government pages/PDFs) and loaded from `kb_content.json` at import. If that file is
absent, `content` is an empty stub — run the ingest script to populate it.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger("askgov.kb")

_CONTENT_FILE = Path(__file__).with_name("kb_content.json")


def _load_content() -> dict[str, Any]:
    if not _CONTENT_FILE.exists():
        log.warning("kb_content.json not found — run scripts/ingest_knowledge.py to populate content.")
        return {"documents": [], "count": 0, "generatedAt": None}
    try:
        data = json.loads(_CONTENT_FILE.read_text(encoding="utf-8"))
        docs = data.get("documents", [])
        log.info("Loaded %d knowledge documents from %s", len(docs), _CONTENT_FILE.name)
        return {"documents": docs, "count": len(docs), "generatedAt": data.get("generatedAt")}
    except (ValueError, OSError) as exc:
        log.warning("Failed to load kb_content.json: %s", exc)
        return {"documents": [], "count": 0, "generatedAt": None}


KNOWLEDGE_BASE: dict[str, Any] = {
    "Agencies": [
        {"code": "CIPO", "name": "Central Immigration & Passport Office",
         "ministry": "Ministry of Home Affairs", "deepLink": "/agencies/CIPO"},
        {"code": "GRO", "name": "General Register Office",
         "ministry": "Ministry of Home Affairs", "deepLink": "/agencies/GRO"},
        {"code": "GRA", "name": "Guyana Revenue Authority",
         "ministry": "Guyana Revenue Authority", "deepLink": "/agencies/GRA"},
        {"code": "MOF", "name": "Ministry of Finance",
         "ministry": "Ministry of Finance", "deepLink": "/agencies/MOF"},
        {"code": "MHSSS", "name": "Ministry of Human Services & Social Security",
         "ministry": "Ministry of Human Services & Social Security", "deepLink": "/agencies/MHSSS"},
        {"code": "OHG", "name": "One Home Guyana",
         "ministry": "Ministry of Housing & Water", "deepLink": "/agencies/OHG"},
    ],
    "services": [
        {"id": "passport-new", "name": "New Passport", "agency": "CIPO",
         "requiredAssurance": 2, "deepLink": "/services/passport-new",
         "prerequisites": ["National ID", "Birth certificate"]},
        {"id": "passport-renew", "name": "Passport Renewal", "agency": "CIPO",
         "requiredAssurance": 2, "deepLink": "/services/passport-renew",
         "prerequisites": ["Prior passport"]},
        {"id": "birth-cert", "name": "Birth Certificate (certified copy)", "agency": "GRO",
         "requiredAssurance": 1, "deepLink": "/services/birth-cert"},
        {"id": "marriage-cert", "name": "Marriage Certificate", "agency": "GRO",
         "requiredAssurance": 1, "deepLink": "/services/marriage-cert"},
        {"id": "tin-register", "name": "TIN Registration", "agency": "GRA",
         "requiredAssurance": 2, "deepLink": "/services/tin-register"},
        {"id": "driver-licence", "name": "Driver's Licence", "agency": "GRA",
         "requiredAssurance": 2, "deepLink": "/services/driver-licence"},
        {"id": "old-age-pension", "name": "Old-Age Pension", "agency": "MHSSS",
         "requiredAssurance": 2, "deepLink": "/services/old-age-pension"},
        {"id": "cash-grant", "name": "Cash Grant Enrolment", "agency": "MOF",
         "requiredAssurance": 2, "deepLink": "/services/cash-grant"},
        {"id": "book-appointment", "name": "Book an Appointment", "agency": "APPT",
         "requiredAssurance": 1, "deepLink": "/services/book-appointment"},
        {"id": "construction-permit", "name": "Construction Permit + Utilities",
         "agency": "OHG", "requiredAssurance": 2, "deepLink": "/services/construction-permit"},
    ],
    "content": _load_content(),
}
