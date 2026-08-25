# AskGov Agent Service

A standalone **FastAPI + LangGraph** microservice that adds a Claude-backed AskGov
agent to the oneCitizen portal and streams to the browser over the **AG-UI
protocol (SSE)**. It runs alongside the existing Express API and React app and
**touches neither**.

Focus for this build: the **passport renewal** journey. The agent watches the
page the citizen is on (via AG-UI shared state), and — from the citizen's existing
records — proposes an auto-fill for the renewal form as a **generative card** the
citizen verifies and submits. Machines flag, humans decide: the agent never submits.

## What it does

- **Shared-state page awareness** — the frontend keeps the current page in the
  AG-UI `state`; the agent reads it on every run and helps in context.
- **Generative prefill card** — on the passport renewal form it calls
  `suggest_passport_prefill`, builds a card of values from the citizen's National
  ID, previous passport and address on file, and streams it as an AG-UI
  `CUSTOM`/`GenerativeUI` event. Applying the card populates the form (via
  `formApi.setValues`) — it is never submitted for the citizen.
- **Tools, all streamed as AG-UI `TOOL_CALL_*`**:
  - `web_search` — live results with `TAVILY_API_KEY`, else curated mock results.
  - `knowledge_base` — a dict with `Agencies`, `services`, and `content`. `content`
    is populated by ingesting real Guyana government pages/PDFs (see below) and the
    tool returns bounded, grounded snippets.
  - `suggest_passport_prefill` — the generative card.
- **Scope-bound identity** — verifies the citizen's portal JWT (same HS256 secret
  as the backend) so it acts only under that citizen's identity.
- **Runs with or without an LLM** — with `OPENAI_API_KEY` it runs a LangGraph
  agent on `gpt-4o-mini` (configurable via `LLM_MODEL`); without one it runs a
  deterministic fallback that emits the identical AG-UI event stream, so it works
  out of the box.

## Run

```bash
cd service
python -m venv .venv
# Windows:  .venv\Scripts\activate       macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # JWT_SECRET must match backend/.env
uvicorn app.main:app --host 0.0.0.0 --port 4100 --reload
```

Health: `GET http://localhost:4100/health` · KB: `GET /knowledge-base` ·
Run: `POST /agent` (SSE).

To enable the LLM, set `OPENAI_API_KEY` in `.env` (defaults to
`LLM_MODEL=gpt-4o-mini`). `GET /health` reports `mode: "openai" | "deterministic"`.

### Ingest the knowledge base

`content` is built from `C:/Users/.../AgentService/knowledge_base/raw` (HTML + PDF
government pages) into `app/data/kb_content.json`:

```bash
python scripts/ingest_knowledge.py            # or: python scripts/ingest_knowledge.py <RAW_DIR>
```

Re-run it whenever the raw folder changes; the `knowledge_base` tool loads the JSON
at startup and returns grounded snippets (passport fees, processing times, required
documents, etc.).

## The `/agent` endpoint

`POST /agent` accepts an AG-UI `RunAgentInput` and returns `text/event-stream`:

```jsonc
{
  "threadId": "thread_abc",
  "runId": "run_1",
  "messages": [{ "id": "m1", "role": "user", "content": "auto-fill the form" }],
  "state": {                       // shared state — the current page
    "currentPage": "Passport Renewal",
    "route": "/services/passport-renew/apply",
    "serviceId": "passport-renew",
    "serviceName": "Passport Renewal",
    "formFields": [{ "name": "surname" }, { "name": "priorPassportNo" }]
  },
  "forwardedProps": { "trigger": "page_context" }   // or "user_message"
}
```

Pass the citizen's token as `Authorization: Bearer <jwt>`. With `AUTH_REQUIRED=false`
(dev) an unauthenticated call falls back to the demo citizen so you can `curl` it.

### Try it

```bash
curl -N -X POST http://localhost:4100/agent -H "Content-Type: application/json" \
  -d '{"threadId":"t","runId":"r","messages":[],
       "state":{"serviceId":"passport-renew","route":"/services/passport-renew/apply"},
       "forwardedProps":{"trigger":"page_context"}}'
```

You'll see: `RUN_STARTED → STATE_SNAPSHOT → TOOL_CALL_* → CUSTOM(GenerativeUI card)
→ STATE_DELTA → TEXT_MESSAGE_* → CUSTOM(Suggestions) → RUN_FINISHED`.

## Layout

```
app/
  main.py            FastAPI app: /agent (SSE), /health, /knowledge-base
  config.py          env-driven settings
  security.py        JWT verify (shared HS256 secret) → citizen id
  agui/
    events.py        AG-UI event builders + SSE encoder
    types.py         RunAgentInput / shared-state models
  agent/
    graph.py         LangGraph StateGraph (agent ↔ tools loop)
    llm.py           ChatOpenAI factory (gpt-4o-mini)
    prompts.py       system prompt + guardrails
    runner.py        run → AG-UI event stream (LLM astream_events + fallback)
    deterministic.py deterministic fallback agent (same event grammar)
    run_context.py   per-run ContextVar (resolved citizen + page) for tools
  tools/
    web_search.py    web_search tool (Tavily or mock)
    knowledge_base.py knowledge_base tool
    passport_prefill.py suggest_passport_prefill (generative card)
    card.py          builds the prefill card from a citizen record
  data/
    mock_users.py    mock citizen profiles + passport history
    knowledge_base.py Agencies / services / content(empty)
```

## Updating knowledge base `content`

Add/replace files in the raw knowledge folder and re-run
`python scripts/ingest_knowledge.py`. The `knowledge_base` tool searches the
regenerated `content` — no code change needed.

## Notes

- The AG-UI wire format here is a small, spec-compliant encoder (`app/agui/events.py`),
  kept in-repo to stay dependency-light; swap in the official `ag-ui-protocol`
  SDK later without changing callers.
- Reference implementation / mock data only — no real PII, all integrations mocked.
