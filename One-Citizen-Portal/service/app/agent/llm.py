"""OpenAI LLM factory (langchain-openai).

Defaults to `gpt-4o-mini`. Returns None when no OPENAI_API_KEY is set, in which
case the service uses the deterministic fallback agent so it still runs and emits
the identical AG-UI event stream.
"""
from __future__ import annotations

import logging

from ..config import settings

log = logging.getLogger("askgov.llm")


def create_llm():
    if not settings.llm_enabled:
        log.info("OPENAI_API_KEY not set — using deterministic fallback agent.")
        return None
    try:
        from langchain_openai import ChatOpenAI
    except ImportError:  # pragma: no cover
        log.warning("langchain-openai not installed — using deterministic fallback.")
        return None

    log.info("LLM enabled: OpenAI %s (max_tokens=%s)", settings.llm_model, settings.llm_max_tokens)
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        temperature=0,
        max_tokens=settings.llm_max_tokens,
        streaming=True,
    )
