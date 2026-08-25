"""`knowledge_base` — query the agent's knowledge base.

Searches three sections:
  - `Agencies` / `services` — the oneCitizen catalogue (structured).
  - `content.documents` — real Guyana government guidance ingested from
    knowledge_base/raw (passport fees, processing times, requirements, etc.).

Returns bounded snippets (a window around the best match per document) so the
model gets grounded facts without flooding its context.
"""
from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.tools import tool

from ..data.knowledge_base import KNOWLEDGE_BASE

_TOKEN = re.compile(r"[a-z0-9$]{3,}")
_STOP = {"the", "and", "for", "you", "your", "what", "how", "are", "can", "does",
         "with", "from", "this", "that", "need", "about", "get", "any"}
_MAX_DOCS = 4
_SNIPPET = 720


def _terms(query: str) -> list[str]:
    return [t for t in _TOKEN.findall(query.lower()) if t not in _STOP] or [query.lower().strip()]


def _all_positions(low: str, term: str, cap: int = 12) -> list[int]:
    out, i = [], low.find(term)
    while i >= 0 and len(out) < cap:
        out.append(i)
        i = low.find(term, i + len(term))
    return out


def _snippet(text: str, terms: list[str]) -> str:
    """Return the window that covers the most distinct query terms (not just the
    first hit) — so a snippet includes clustered facts like "renewal … G$6,000"."""
    low = text.lower()
    candidates = [p for t in terms for p in _all_positions(low, t)]
    if not candidates:
        return text[:_SNIPPET].strip() + ("…" if len(text) > _SNIPPET else "")

    best_start, best_score = 0, -1
    for pos in candidates:
        start = max(0, pos - 160)
        window = low[start:start + _SNIPPET]
        score = sum(1 for t in terms if t in window)
        if score > best_score:
            best_start, best_score = start, score

    end = min(len(text), best_start + _SNIPPET)
    return ("…" if best_start else "") + text[best_start:end].strip() + ("…" if end < len(text) else "")


def _search_documents(query: str, terms: list[str]) -> list[dict[str, Any]]:
    scored = []
    for doc in KNOWLEDGE_BASE.get("content", {}).get("documents", []):
        title = doc.get("title", "").lower()
        body = doc.get("text", "").lower()
        score = sum(title.count(t) * 5 + body.count(t) for t in terms)
        if score:
            scored.append((score, doc))
    scored.sort(key=lambda s: s[0], reverse=True)
    results = []
    for _, doc in scored[:_MAX_DOCS]:
        results.append({
            "title": doc.get("title"),
            "agency": doc.get("agencyName") or doc.get("agency"),
            "category": doc.get("category"),
            "source": doc.get("source"),
            "snippet": _snippet(doc.get("text", ""), terms),
        })
    return results


def _matches(obj: Any, q: str) -> bool:
    return q in json.dumps(obj, ensure_ascii=False).lower()


@tool
def knowledge_base(query: str) -> str:
    """Look up official Guyana government guidance, agencies, and services.

    Use this to answer questions about requirements, documents, fees, processing
    times, offices/collection, and which agency owns a service — grounded in the
    portal catalogue and ingested government guidance. Prefer this over web search.

    Args:
        query: What to look for, e.g. "passport renewal fee", "documents for renewal",
            "passport collection Saturday", "old age pension".
    """
    q = (query or "").strip().lower()
    terms = _terms(query)
    out: dict[str, Any] = {"query": query}

    agencies = [a for a in KNOWLEDGE_BASE["Agencies"] if not q or _matches(a, q)]
    services = [s for s in KNOWLEDGE_BASE["services"] if not q or _matches(s, q)]
    docs = _search_documents(query, terms)

    if agencies:
        out["agencies"] = agencies[:5]
    if services:
        out["services"] = services[:6]
    if docs:
        out["guidance"] = docs
    if not (agencies or services or docs):
        out["note"] = "No matches in the knowledge base."
    return json.dumps(out, ensure_ascii=False)
