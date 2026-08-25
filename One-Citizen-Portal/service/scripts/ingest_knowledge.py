"""Ingest the raw knowledge base into a searchable JSON store.

Walks a directory of downloaded government pages (.html) and documents (.pdf),
extracts readable text, and writes `app/data/kb_content.json`. That file becomes
the `content` section of the agent's knowledge base — the `knowledge_base` tool
searches it and returns bounded snippets, so the agent is grounded in real Guyana
government guidance (passport fees, processing times, requirements, etc.).

Usage:
    python scripts/ingest_knowledge.py [RAW_DIR]

RAW_DIR defaults to KB_RAW_DIR env or
C:/Users/NarasimhaVarmaManthe/Downloads/AgentService/knowledge_base/raw
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader

DEFAULT_RAW = r"C:/Users/NarasimhaVarmaManthe/Downloads/AgentService/knowledge_base/raw"
OUT_FILE = Path(__file__).resolve().parents[1] / "app" / "data" / "kb_content.json"

MAX_CHARS = 18000  # cap stored text per document (keeps the store + tool output bounded)

AGENCY_NAMES = {
    "cipo": "Central Immigration & Passport Office (CIPO)",
    "gra": "Guyana Revenue Authority (GRA)",
    "gro": "General Register Office (GRO)",
    "mhsss": "Ministry of Human Services & Social Security (MHSSS)",
    "chpa": "Central Housing & Planning Authority (CH&PA)",
    "housing": "Housing (CH&PA / One Home Guyana)",
    "gpl": "Guyana Power & Light (GPL)",
    "gwi": "Guyana Water Inc. (GWI)",
    "gei": "Government Electrical Inspectorate (GEI)",
    "nis": "National Insurance Scheme (NIS)",
    "appointments": "GovConnect Appointments",
    "portal": "oneCitizen / GovConnect Portal",
    "specs": "Service specifications",
}

# Only strip clearly non-content chrome. NB: do NOT prefer <main>/<article>
# (they are often empty on these WordPress pages) and do NOT drop by CSS class
# (the content wrapper's class frequently matches "banner"/"share").
_DROP_TAGS = ["script", "style", "noscript", "nav", "header", "footer", "aside",
              "form", "svg", "button", "iframe", "link", "meta"]
_WS = re.compile(r"[ \t ]+")
_BLANKS = re.compile(r"\n{3,}")


def _clean(text: str) -> str:
    text = _WS.sub(" ", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    text = _BLANKS.sub("\n\n", text)
    return text.strip()[:MAX_CHARS]


def _from_html(path: Path) -> tuple[str, str]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    title = (soup.title.get_text(strip=True) if soup.title else "") or _title_from_name(path)
    for tag in soup(_DROP_TAGS):
        tag.decompose()
    body = soup.body or soup
    return title, _clean(body.get_text("\n"))


def _from_pdf(path: Path) -> tuple[str, str]:
    try:
        reader = PdfReader(str(path))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
            if sum(len(p) for p in parts) > MAX_CHARS:
                break
        return _title_from_name(path), _clean("\n".join(parts))
    except Exception as exc:  # corrupt / image-only PDF
        return _title_from_name(path), f"(Could not extract text: {exc})"


def _title_from_name(path: Path) -> str:
    return path.stem.replace("-", " ").replace("_", " ").strip().title()


def main() -> None:
    raw = Path(sys.argv[1] if len(sys.argv) > 1 else os.getenv("KB_RAW_DIR", DEFAULT_RAW))
    if not raw.is_dir():
        print(f"RAW_DIR not found: {raw}", file=sys.stderr)
        sys.exit(1)

    docs = []
    for path in sorted(raw.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm", ".pdf"}:
            continue
        rel = path.relative_to(raw)
        parts = rel.parts
        agency = parts[0] if parts else ""
        category = parts[1] if len(parts) > 2 else ""
        try:
            title, text = _from_html(path) if path.suffix.lower() != ".pdf" else _from_pdf(path)
        except Exception as exc:
            print(f"  ! skip {rel}: {exc}", file=sys.stderr)
            continue
        if len(text) < 40:
            continue
        docs.append({
            "id": str(rel).replace("\\", "/"),
            "agency": agency,
            "agencyName": AGENCY_NAMES.get(agency, agency.upper() or "Other"),
            "category": category,
            "title": title,
            "source": str(rel).replace("\\", "/"),
            "text": text,
        })
        print(f"  + {agency}/{category or '-'}: {title[:70]} ({len(text)} chars)")

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rawDir": str(raw),
        "count": len(docs),
        "documents": docs,
    }
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    by_agency: dict[str, int] = {}
    for d in docs:
        by_agency[d["agency"]] = by_agency.get(d["agency"], 0) + 1
    print(f"\nWrote {len(docs)} documents to {OUT_FILE}")
    print("By agency:", json.dumps(by_agency))


if __name__ == "__main__":
    main()
