# oneCitizen AskGov Agent — FastAPI + LangGraph, streaming AG-UI events over SSE
#
# Self-contained: unlike the Node images this one needs nothing outside service/, so it
# builds with service/ as its own context:
#
#   docker build -t onecitizen/askgov-agent ./service

# ── deps ─────────────────────────────────────────────────────────────────────
# Wheels are built once here and copied into the runtime image, so the runtime needs no
# compiler toolchain and stays small.
FROM python:3.12-slim AS deps
WORKDIR /app

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install -r requirements.txt

# ── runtime ──────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=4100

# curl is only here for the healthcheck; it is the one runtime package we add.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 appuser

COPY --from=deps /opt/venv /opt/venv

WORKDIR /app
COPY app ./app
COPY scripts ./scripts

USER appuser
EXPOSE 4100

# `mode` in the payload reports openai vs deterministic — the container is healthy either way.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

# No --reload in production; concurrency is scaled by replica count, not workers, so
# in-process agent state stays consistent per container.
CMD ["sh", "-c", "exec uvicorn app.main:app --host \"$HOST\" --port \"$PORT\""]
