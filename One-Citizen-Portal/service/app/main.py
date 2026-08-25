"""AskGov Agent Service — FastAPI app.

A standalone microservice for the oneCitizen portal. It does NOT touch the existing
Express backend or React frontend. The browser (or any AG-UI client) POSTs a
`RunAgentInput` to `/agent` and receives an AG-UI event stream over SSE.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import __version__
from .agent.runner import llm_mode, run_agent
from .agui.types import RunAgentInput
from .config import settings
from .data.knowledge_base import KNOWLEDGE_BASE
from .security import AuthError, _extract_bearer, resolve_subject

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("askgov")

app = FastAPI(title="oneCitizen — AskGov Agent Service", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",  # disable proxy buffering so events flush immediately
}


@app.get("/")
def root() -> dict:
    return {
        "service": "askgov-agent",
        "version": __version__,
        "mode": llm_mode(),
        "protocol": "AG-UI over SSE",
        "endpoints": {"run": "POST /agent", "health": "GET /health", "kb": "GET /knowledge-base"},
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__, "mode": llm_mode(),
            "llm_model": settings.llm_model if settings.llm_enabled else None}


@app.get("/knowledge-base")
def knowledge_base_dump() -> dict:
    """Inspect the KB: catalogue + ingested-guidance summary (no full document text)."""
    content = KNOWLEDGE_BASE.get("content", {})
    docs = content.get("documents", [])
    by_agency: dict[str, int] = {}
    for d in docs:
        by_agency[d.get("agency", "?")] = by_agency.get(d.get("agency", "?"), 0) + 1
    return {
        "Agencies": KNOWLEDGE_BASE["Agencies"],
        "services": KNOWLEDGE_BASE["services"],
        "content": {
            "count": content.get("count", len(docs)),
            "generatedAt": content.get("generatedAt"),
            "byAgency": by_agency,
            "documents": [
                {"title": d.get("title"), "agency": d.get("agency"),
                 "category": d.get("category"), "source": d.get("source"),
                 "chars": len(d.get("text", ""))}
                for d in docs
            ],
        },
    }


@app.post("/agent")
async def agent(
    payload: RunAgentInput,
    request: Request,
    authorization: str | None = Header(default=None),
) -> StreamingResponse:
    try:
        subject = resolve_subject(authorization)
    except AuthError as exc:
        return JSONResponse(status_code=401, content={"error": {"code": "UNAUTHORIZED", "message": str(exc)}})

    log.info(
        "run thread=%s run=%s trigger=%s route=%s subject=%s mode=%s",
        payload.threadId, payload.runId, payload.trigger(),
        payload.state.get("route"), subject, llm_mode(),
    )

    token = _extract_bearer(authorization)  # forwarded to the platform API for live reads

    async def event_stream():
        async for frame in run_agent(payload, subject, token):
            if await request.is_disconnected():
                break
            yield frame

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)
