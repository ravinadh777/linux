<!--
  This was the repository's root README.md, which described only the AskGov agent service
  and duplicated much of service/README.md. It moved here during the deployment
  restructure so the root README could describe the platform as a whole.

  It is the LONGER and more detailed of the two agent documents — kept in full as the
  in-depth reference. service/README.md remains the shorter operational readme you land on
  when working inside that service.
-->

# AskGov Agent — LangGraph + AG-UI microservice for oneCitizen

An **agent microservice** for the oneCitizen portal that adds an OpenAI-backed
AskGov assistant for the **passport renewal** journey, streamed to the browser over
the **AG-UI protocol (SSE)** and grounded in ingested Guyana government guidance.

It is a standalone **FastAPI + LangGraph** service that runs alongside the existing
oneCitizen Express API and React app and **touches neither** — its own port, its own
process, its own venv.

## Summary

- **What it does** — the agent watches the page the citizen is on (via AG-UI shared
  state) and, on the passport-renewal form, proposes an **auto-fill** built from the
  citizen's existing records (National ID, previous passport, address on file). The
  citizen reviews the values and taps **Apply** to populate the form. *Machines flag,
  humans decide — the agent never submits on the citizen's behalf.*
- **Everything is streamed as AG-UI events over SSE** — run lifecycle, tool calls,
  generative prefill, shared-state deltas, and assistant text tokens.
- **Runs with or without an LLM** — with `OPENAI_API_KEY` set it drives a LangGraph
  ReAct agent on `gpt-4o-mini` (configurable). Without a key it falls back to a
  **deterministic** agent that emits the *identical* event grammar, so it works out
  of the box. `GET /health` reports `mode: "openai" | "deterministic"`.
- **Scope-bound identity** — verifies the citizen's portal JWT (shared HS256 secret)
  so it acts only under that citizen's identity.
- Reference / mock build — no real PII, all integrations mocked.

## Architecture

```
 Browser (oneCitizen React app)                    service/ (FastAPI)              
 ┌──────────────────────────────┐  POST /agent     ┌──────────────────────────────────┐
 │ AskGov panel + AG-UI client  │  (RunAgentInput  │  verify JWT (shared HS256 secret) │
 │  • current page in state ────┼────────────────▶ │  resolve citizen + page context   │
 │  • JWT from oc-auth          │   over SSE       │                                   │
 │                              │◀──────────────── │  LangGraph agent (gpt-4o-mini)    │
 │  renders:                    │   AG-UI events   │   ├─ web_search        ─┐         │
 │   • streamed assistant text  │                  │   ├─ knowledge_base     │ streamed│
 │   • TOOL_CALL_* status       │                  │   ├─ suggest_prefill  ──┤   as    │
 │   • Prefill values + Apply   │                  │   └─ validate_application│TOOL_CALL│
 │   • STATE_DELTA(proposed)    │                  │  (deterministic fallback if no    │
 └──────────────────────────────┘                  │   OPENAI_API_KEY)                 │
   Review & Apply → formApi.setValues()            └──────────────────────────────────┘
```

### Request flow

1. The frontend `POST`s a `RunAgentInput` to `/agent` with the running conversation
   and a `state` object carrying the **current page** (route, service, form fields).
2. `security.py` verifies the `Authorization: Bearer <jwt>` and resolves the citizen.
   In dev (`AUTH_REQUIRED=false`) an unauthenticated call falls back to a demo citizen.
3. `runner.py` sets a per-run context (resolved citizen + page) and picks a path by
   the `forwardedProps.trigger`:
   - `field_changed` → a cheap deterministic record diff (`field_review.py`), no LLM.
   - otherwise → the LangGraph agent (`graph.py`) if an LLM is configured, else the
     deterministic fallback (`deterministic.py`).
4. The agent runs a ReAct loop (`agent ⇄ tools`). LangChain `astream_events` are
   translated into AG-UI events (`agui/events.py`) and flushed to the browser as SSE
   frames.

### Layout

```
service/
  requirements.txt        Python dependencies
  .env.example            copy to .env (JWT_SECRET must match the portal backend)
  scripts/
    ingest_knowledge.py   extract text from raw gov pages/PDFs → app/data/kb_content.json
  tests/requests/         ready-to-POST RunAgentInput fixtures (curl these)
  app/
    main.py               FastAPI app: POST /agent (SSE), GET /health, /knowledge-base, /
    config.py             env-driven settings (dataclass)
    security.py           JWT verify (shared HS256 secret) → citizen id
    agui/
      events.py           AG-UI event builders + SSE encoder
      types.py            RunAgentInput / PageState models
    agent/
      graph.py            LangGraph StateGraph (agent ↔ tools loop)
      runner.py           run → AG-UI event stream (astream_events + fallback)
      deterministic.py    deterministic fallback agent (same event grammar)
      field_review.py     passive form-change review (record diff, no LLM)
      llm.py              ChatOpenAI factory (gpt-4o-mini)
      prompts.py          system prompt + guardrails
      run_context.py      per-run ContextVar (resolved citizen + page) for tools
      validators.py       field validators
    tools/
      web_search.py       web_search (Tavily if TAVILY_API_KEY, else curated mock)
      knowledge_base.py   knowledge_base (grounded snippets from ingested content)
      prefill.py          suggest_prefill (proposes form values from citizen records)
      validate_application.py  validate_application (checks the assembled form)
    data/
      mock_users.py       mock citizen profiles + passport history
      knowledge_base.py   KB dict: Agencies / services / content
      kb_content.json     ingested guidance (regenerated by the ingest script)
```

The four tools exposed to the agent are `web_search`, `knowledge_base`,
`suggest_prefill`, and `validate_application`. Each is streamed to the UI as a
`TOOL_CALL_START / ARGS / END / RESULT` sequence.

## Running commands

```bash
# 1) create the environment and install dependencies
cd service
python -m venv .venv
# Windows (PowerShell):  .venv\Scripts\Activate.ps1
# Windows (cmd):         .venv\Scripts\activate.bat
# macOS/Linux:           source .venv/bin/activate
pip install -r requirements.txt

# 2) configure — JWT_SECRET must match the oneCitizen backend .env
cp .env.example .env        # Windows: copy .env.example .env

# 3) run the service (http://localhost:4100)
uvicorn app.main:app --host 0.0.0.0 --port 4100 --reload
```

Endpoints once running:

| Method | Path              | Purpose                                             |
|--------|-------------------|-----------------------------------------------------|
| GET    | `/`               | Service info (name, version, mode, endpoints)       |
| GET    | `/health`         | Health + `mode: "openai" \| "deterministic"`        |
| GET    | `/knowledge-base` | Inspect the KB catalogue + ingested-guidance summary |
| POST   | `/agent`          | Run the agent — returns an AG-UI **SSE** event stream |

Enable the LLM by setting `OPENAI_API_KEY` in `service/.env` (model defaults to
`LLM_MODEL=gpt-4o-mini`). Optionally set `TAVILY_API_KEY` for live web search.

Rebuild the knowledge base after changing the raw source folder:

```bash
python scripts/ingest_knowledge.py            # or: python scripts/ingest_knowledge.py <RAW_DIR>
```

## POST `/agent` — request body

`POST /agent` accepts an AG-UI `RunAgentInput` (JSON) and returns `text/event-stream`.
Send the citizen's token as `Authorization: Bearer <jwt>`; in dev
(`AUTH_REQUIRED=false`) an unauthenticated call falls back to the demo citizen so you
can `curl` it directly.

```jsonc
{
  "threadId": "thread_abc",           // conversation id (required)
  "runId": "run_1",                   // this run's id (required)
  "messages": [                       // running conversation (may be empty)
    { "id": "m1", "role": "user", "content": "Auto-fill my passport renewal form." }
  ],
  "state": {                          // AG-UI shared state — the current page
    "currentPage": "Passport Renewal",
    "route": "/services/passport-renew/apply",
    "serviceId": "passport-renew",
    "serviceName": "Passport Renewal",
    "formFields": [                   // [{ name, label?, type?, options? }]
      { "name": "surname" },
      { "name": "givenNames" },
      { "name": "priorPassportNo" },
      { "name": "dob" }
    ],
    "formValues": {}                  // live values the citizen has typed/applied
  },
  "tools": [],                        // optional AG-UI tool defs (unused by default)
  "context": [],                      // optional extra context
  "forwardedProps": {
    "trigger": "user_message"         // see triggers below
  }
}
```

**`forwardedProps.trigger`** selects the behaviour:

| trigger             | Meaning                                                              |
|---------------------|----------------------------------------------------------------------|
| `user_message`      | Default. Respond to the latest user message.                        |
| `page_context`      | Proactive help fired on navigation (no user text; agent offers auto-fill). |
| `field_changed`     | Passive review of `state.formValues` — a deterministic record diff, no LLM. |
| `prefill_applied`   | Citizen applied the suggestion — confirm and give next steps.        |
| `prefill_dismissed` | Citizen dismissed the suggestion — acknowledge, offer other help.    |

### Try it

```bash
curl -N -X POST http://localhost:4100/agent -H "Content-Type: application/json" \
  -d '{"threadId":"t","runId":"r","messages":[],
       "state":{"serviceId":"passport-renew","route":"/services/passport-renew/apply"},
       "forwardedProps":{"trigger":"page_context"}}'
```

Ready-made request fixtures live in [`service/tests/requests/`](service/tests/requests/).

## Response body — AG-UI event stream (SSE)

The response is `Content-Type: text/event-stream`. Each event is one JSON object
delivered as a Server-Sent Event frame (`data: <json>\n\n`). Every event has an
uppercase `type` discriminator and a `timestamp` (ms). One run emits events in this
order:

```
RUN_STARTED
  STATE_SNAPSHOT                       # shared state: current page, citizen summary
  [ TOOL_CALL_START
    TOOL_CALL_ARGS*                    # streamed argument deltas
    TOOL_CALL_END
    TOOL_CALL_RESULT ]*               # web_search / knowledge_base / suggest_prefill / validate_application
  [ CUSTOM(name="Prefill") ]           # proposed form values + field metadata
  [ STATE_DELTA ]                      # JSON Patch, e.g. add /proposedPrefill
  TEXT_MESSAGE_START
    TEXT_MESSAGE_CONTENT*              # streamed assistant tokens
  TEXT_MESSAGE_END
RUN_FINISHED                           # (or RUN_ERROR on failure)
```

Example frames (each line is a separate SSE frame):

```
data: {"type":"RUN_STARTED","timestamp":1730000000000,"threadId":"t","runId":"r"}

data: {"type":"STATE_SNAPSHOT","timestamp":1730000000010,"snapshot":{"currentPage":"Passport Renewal","route":"/services/passport-renew/apply","serviceId":"passport-renew","citizen":{"name":"…","nationalId":"…"},"proposedPrefill":null}}

data: {"type":"TOOL_CALL_START","timestamp":1730000000020,"toolCallId":"tc_ab12cd34","toolCallName":"suggest_prefill","parentMessageId":"msg_1a2b3c4d5e"}

data: {"type":"TOOL_CALL_ARGS","timestamp":1730000000025,"toolCallId":"tc_ab12cd34","delta":"{\"serviceId\":\"passport-renew\"}"}

data: {"type":"TOOL_CALL_END","timestamp":1730000000030,"toolCallId":"tc_ab12cd34"}

data: {"type":"TOOL_CALL_RESULT","timestamp":1730000000040,"messageId":"toolres_9f8e7d6c","toolCallId":"tc_ab12cd34","content":"Proposed 6 fields from records.","role":"tool"}

data: {"type":"CUSTOM","timestamp":1730000000050,"name":"Prefill","value":{"serviceId":"passport-renew","fields":[{"name":"surname","label":"Surname","value":"…","source":"National ID","confidence":"high","overridden":false}],"values":{"surname":"…","givenNames":"…","priorPassportNo":"…","dob":"…"},"remaining":[{"name":"photo","label":"Passport photo","required":true}],"documents":[]}}

data: {"type":"STATE_DELTA","timestamp":1730000000055,"delta":[{"op":"add","path":"/proposedPrefill","value":{"surname":"…","givenNames":"…"}}]}

data: {"type":"TEXT_MESSAGE_START","timestamp":1730000000060,"messageId":"msg_1a2b3c4d5e","role":"assistant"}

data: {"type":"TEXT_MESSAGE_CONTENT","timestamp":1730000000065,"messageId":"msg_1a2b3c4d5e","delta":"I've drafted your passport renewal "}

data: {"type":"TEXT_MESSAGE_CONTENT","timestamp":1730000000070,"messageId":"msg_1a2b3c4d5e","delta":"from your records. Review and apply."}

data: {"type":"TEXT_MESSAGE_END","timestamp":1730000000075,"messageId":"msg_1a2b3c4d5e"}

data: {"type":"RUN_FINISHED","timestamp":1730000000080,"threadId":"t","runId":"r","result":{"mode":"openai"}}
```

### Event reference

| Event                  | Key fields                                          | Meaning                                    |
|------------------------|-----------------------------------------------------|--------------------------------------------|
| `RUN_STARTED`          | `threadId`, `runId`                                 | Run began.                                 |
| `STATE_SNAPSHOT`       | `snapshot`                                          | Full shared state (page + citizen summary).|
| `TOOL_CALL_START`      | `toolCallId`, `toolCallName`, `parentMessageId?`    | A tool invocation started.                 |
| `TOOL_CALL_ARGS`       | `toolCallId`, `delta`                               | Streamed argument fragment.                |
| `TOOL_CALL_END`        | `toolCallId`                                        | Arguments complete.                        |
| `TOOL_CALL_RESULT`     | `toolCallId`, `messageId`, `content`, `role`        | Tool output summary.                       |
| `CUSTOM`               | `name`, `value`                                     | Generative payload (e.g. `"Prefill"`).     |
| `STATE_DELTA`          | `delta` (JSON Patch / RFC 6902)                     | Incremental shared-state change.           |
| `TEXT_MESSAGE_START`   | `messageId`, `role`                                 | Assistant message opening.                 |
| `TEXT_MESSAGE_CONTENT` | `messageId`, `delta`                                | Streamed assistant token.                  |
| `TEXT_MESSAGE_END`     | `messageId`                                         | Assistant message complete.                |
| `RUN_FINISHED`         | `threadId`, `runId`, `result`                       | Run completed (`result.mode`).             |
| `RUN_ERROR`            | `message`, `code?`                                  | Run failed.                                |

## Knowledge base

`service/app/data/knowledge_base.py` holds the KB dict with keys **`Agencies`**,
**`services`**, and **`content`**. `content` is populated by
`service/scripts/ingest_knowledge.py`, which extracts text from real Guyana
government pages/PDFs into `kb_content.json`. The `knowledge_base` tool searches it
and returns grounded snippets (passport fees, processing times, required documents…).
Re-run the ingest script whenever the raw folder changes.

## Design notes

- **Aligned with the portal's AI design**: confirm-before-submit, scope-bound to the
  citizen's identity, explainable/dismissible suggestions, deterministic fallback
  when the model is unavailable.
- **AG-UI first-class**: shared state, tool-call streaming, generative UI, and state
  deltas are all events over SSE. The wire encoder in `app/agui/events.py` is a small,
  spec-compliant, dependency-light implementation — swap in the official
  `ag-ui-protocol` SDK later without changing callers.
- **Non-invasive**: separate port (`4100`), separate process, its own venv.
- Reference implementation / mock data only — no real PII, all integrations mocked.
