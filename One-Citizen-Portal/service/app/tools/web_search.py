"""`web_search` — look up current information on the public web.

Uses Tavily when TAVILY_API_KEY is set; otherwise returns curated mock results so
the tool (and its AG-UI streaming) works out of the box. Either way the call is
streamed to the UI as a TOOL_CALL_* sequence.
"""
from __future__ import annotations

import json

import httpx
from langchain_core.tools import tool

from ..config import settings

_MOCK_RESULTS = [
    {
        "title": "Guyana passport renewal — Central Immigration & Passport Office",
        "url": "https://www.moha.gov.gy/passport-renewal",
        "snippet": (
            "Renew a Guyanese passport at CIPO. Bring your previous passport, National "
            "ID and a passport-size photograph. Standard processing is about 10 working days."
        ),
    },
    {
        "title": "Passport fees and processing times",
        "url": "https://www.moha.gov.gy/passport-fees",
        "snippet": (
            "Standard (32-page) renewal and frequent-traveller (64-page) booklets are "
            "available. Expedited processing is offered for an additional fee."
        ),
    },
    {
        "title": "CIPO collection offices",
        "url": "https://www.moha.gov.gy/cipo-offices",
        "snippet": (
            "Collect at CIPO Georgetown (Camp Street), CIPO Berbice (New Amsterdam) or "
            "CIPO Essequibo (Anna Regina)."
        ),
    },
]


@tool
async def web_search(query: str) -> str:
    """Search the public web for current information (fees, opening hours, news).

    Use this only when the answer is not in the knowledge base — e.g. up-to-date
    government fees, processing times, or office hours.

    Args:
        query: The search query.
    """
    if settings.tavily_api_key:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "max_results": 5,
                        "search_depth": "basic",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            results = [
                {"title": r.get("title"), "url": r.get("url"), "snippet": r.get("content")}
                for r in data.get("results", [])
            ]
            return json.dumps({"query": query, "provider": "tavily", "results": results})
        except (httpx.HTTPError, ValueError):
            pass  # fall through to mock so the demo never breaks

    return json.dumps(
        {"query": query, "provider": "mock", "results": _MOCK_RESULTS,
         "note": "Set TAVILY_API_KEY for live web results."}
    )
