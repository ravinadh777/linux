"""Agent tools. Each is streamed to the UI as an AG-UI TOOL_CALL_* sequence.

Tools return plain strings (what the LLM reads back). The `suggest_prefill` tool
additionally embeds a `prefill` payload (values + field metadata) in its JSON
return so the runner can emit a CUSTOM "Prefill" event; the frontend lists those
values in chat and offers an "Apply to form" action (no generative card).
"""
from __future__ import annotations

from .applications import my_applications
from .knowledge_base import knowledge_base
from .prefill import suggest_prefill
from .validate_application import validate_application
from .web_search import web_search

TOOLS = [web_search, knowledge_base, suggest_prefill, validate_application, my_applications]
TOOLS_BY_NAME = {t.name: t for t in TOOLS}

__all__ = [
    "TOOLS", "TOOLS_BY_NAME",
    "web_search", "knowledge_base", "suggest_prefill", "validate_application", "my_applications",
]
