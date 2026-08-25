# Ask Gov Agent — Integration Design

> Phase 1 analysis + integration strategy for wiring the existing **Ask_Agent** Python
> service (`service/`) into the oneCitizen app as a first-class, enterprise AG-UI feature.
> **We do not rebuild the agent — we integrate it.**

---

## 1. Phase 1 — Ask_Agent Analysis

### 1.1 What it is
A **standalone FastAPI + LangGraph microservice** (`service/app`) that streams a Claude/OpenAI-backed
"AskGov" agent to the browser using the **AG-UI protocol over SSE**. It runs on **port 4100** and is
designed to run *alongside* the Express API (4000) and Vite app (5173) without touching them.

### 1.2 Folder structure
```
service/
  app/
    main.py            FastAPI: POST /agent (SSE), GET /health, GET /knowledge-base, GET /
    config.py          env-driven Settings (dataclass; dotenv)
    security.py        JWT verify (shared HS256 secret) → citizen id (sub)
    agui/
      events.py        AG-UI event builders + SSE encoder (self-contained wire format)
      types.py         RunAgentInput / Message / PageState (pydantic)
    agent/
      graph.py         LangGraph StateGraph — ReAct agent↔tools loop
      llm.py           ChatOpenAI factory (gpt-4o-mini)
      prompts.py       system prompt + guardrails ("machines flag, humans decide")
      runner.py        RunAgentInput → AG-UI SSE frames (LLM astream_events + fallback)
      deterministic.py no-LLM fallback emitting the identical event grammar
      field_review.py  field_changed trigger → deterministic validation (no LLM)
      validators.py    record-match + cross-field consistency rules
      run_context.py   per-run ContextVar (resolved citizen + page) for tools
      agui_emit.py     re-export of event builders + `frame = encode`
    tools/
      prefill.py       suggest_prefill — propose form values from records (+ overrides write-back)
      records.py       FIELD REGISTRY + mapping/normalization/confidence/source (the mapping layer)
      knowledge_base.py grounded KB snippets
      web_search.py    Tavily or curated mock
      validate_application.py  form error/mismatch checks
    data/
      mock_users.py    mock citizen profiles + passport history (keyed by JWT sub)
      knowledge_base.py Agencies/services/content (+ ingested content json)
  requirements.txt   fastapi, uvicorn, pydantic, PyJWT, httpx, langgraph, langchain-*, bs4, pypdf
  .env.example       HOST/PORT/CORS, JWT_SECRET (must match backend), OPENAI_API_KEY, TAVILY_API_KEY
```

### 1.3 Startup & environment
- Run: `uvicorn app.main:app --host 0.0.0.0 --port 4100 --reload` (venv already present at `service/.venv`).
- **Runs with or without an LLM.** `OPENAI_API_KEY` set → LangGraph agent on `LLM_MODEL` (default `gpt-4o-mini`);
  unset → deterministic fallback emitting the *same* AG-UI stream. `GET /health` reports `mode`.
- Key env: `JWT_SECRET` **must equal** the Express backend's secret (HS256) so the agent verifies the
  citizen's existing portal token. `AUTH_REQUIRED=false` in dev falls back to a demo citizen.

### 1.4 API surface
| Method | Path | Purpose |
|---|---|---|
| POST | `/agent` | AG-UI `RunAgentInput` → `text/event-stream` (the run) |
| GET | `/health` | status + `mode` + model |
| GET | `/knowledge-base` | KB catalogue + ingested-doc summary |
| GET | `/` | service descriptor |

### 1.5 Request contract (`RunAgentInput`)
```jsonc
{ "threadId", "runId",
  "messages":[{id,role,content,...}],
  "state":{ currentPage, route, serviceId, serviceName, formFields[], formValues{}, proposedPrefill },
  "forwardedProps":{ "trigger":"page_context|user_message|field_changed|prefill_applied|prefill_dismissed" } }
```
`state` is the **AG-UI shared state** — the frontend streams the *current page + live form values* into
the graph on every run. That is the backbone of the bidirectional form sync.

### 1.6 Streaming / event grammar (per run)
```
RUN_STARTED
  STATE_SNAPSHOT                       # shared state (page, citizen, proposedPrefill)
  [ TOOL_CALL_START → TOOL_CALL_ARGS* → TOOL_CALL_END → TOOL_CALL_RESULT ]*
  [ CUSTOM(name="Prefill",  value={serviceId,fields[],values{},remaining[],documents[]}) ]
  [ CUSTOM(name="Validation", value={issues[],ok}) ]
  [ CUSTOM(name="Suggestions", value=[...chips]) ]
  [ STATE_DELTA ]                      # JSON-Patch, e.g. add /proposedPrefill
  TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT* → TEXT_MESSAGE_END
RUN_FINISHED (result.mode) | RUN_ERROR
```
Event types enumerated in `agui/events.py::EventType`. The runner translates LangChain
`astream_events(v2)` (`on_chat_model_stream`, tool-call chunks, `on_tool_end`) into these frames, and on
any LLM error **degrades to the deterministic path mid-run**.

### 1.7 Models, prompt, tools, memory, lifecycle
- **Model:** OpenAI `gpt-4o-mini` (configurable) via `langchain-openai`, bound to tools.
- **Prompt:** `prompts.build_system_prompt(page,user)` — guardrails + signed-in citizen + live page context;
  proactively offers auto-fill on an empty service form, switches to review/complete when values exist.
- **Tools:** `suggest_prefill`, `knowledge_base`, `web_search`, `validate_application`.
- **Memory / sessions:** *stateless per request* — conversation is replayed from `messages`, page/session
  from `state`, identity from JWT (`sub`) into a `RunContext` ContextVar. `threadId`/`runId` identify the
  conversation/turn. **No server-side history store exists yet** (a gap we own on integration).
- **Lifecycle:** `resolve_subject` → `RunContext` set → RUN_STARTED → STATE_SNAPSHOT → (field_review |
  LLM graph | deterministic) → RUN_FINISHED → context reset; client-disconnect aborts the stream.

### 1.8 The form-mapping layer already exists (Phases 6 & 7)
`tools/records.py` **is** the Field Registry + Mapping/Normalization/Confidence engine the brief asks for:
`_SPECS` (aliases → record path, `label`, `source`, `confidence`), `canonical_name` (label/name → field),
`record_value` (→ `{name,label,value,source,confidence,overridden}`), `build_prefill` (fields/values +
`remaining` + `documents`), `set_profile_field` (citizen edit write-back). Each proposed entity carries
**field, value, confidence, source, overridden** — we add **timestamp + validation state** at the edge.

---

## 2. Integration Strategy (no duplication, reuse the engine)

**Topology (three tiers, one browser origin):**
```
React (5173)  ──/api/v1/agent/*──►  Express gateway (4000)  ──/agent (SSE)──►  FastAPI agent (4100)
   AG-UI client                     proxy + session/history + JWT edge         LangGraph engine (reused)
```
The Express backend gains a thin **agent gateway module** (DI, DTOs, validation, rate-limit, SSE
pass-through, session + history store). It **reshapes nothing about the AG-UI frames** — it streams them
through unchanged so the frontend speaks pure AG-UI. Enterprise REST endpoints wrap
session/history/status/extract around that stream. The Python engine is reused **as-is**.

### 2.1 Backend module (`backend/src/modules/agent/…`)
`controller · service · gateway · dto · events · middleware · types · validators · utils · routes`, wired
through the existing DI composition root (`context.js`). Endpoints:
`POST /agent/chat` (SSE proxy) · `POST /agent/session` · `POST /agent/reset` · `GET /agent/history` ·
`GET /agent/status` · `POST /agent/form-sync` · `POST /agent/extract`. History persisted via the repo
pattern (JSON store) keyed by `{userId, threadId}`; JWT minted by the backend is forwarded to Python.

### 2.2 Frontend (`frontend/src/agent/…`)
`AgentProvider` + `AgentContext`, `agentService` (fetch-based SSE reader with cancel/reconnect),
`useAgentStream`, `useAgentEvents`, `messageStore`, `sessionStore`. The existing **`AskGovPanel`** is
upgraded to consume the stream (typing/thinking/tool/error/reconnect states); the existing **`formApi`**
registered by `ApplyPage` becomes the AG-UI form bridge:
- Agent `CUSTOM(Prefill)` / `STATE_DELTA` → `formApi.setValues` (field-by-field, real time).
- Citizen edits → debounced `field_changed` run carrying `formValues` (already supported by the engine).
Bidirectional sync, no page rewrite.

### 2.3 What we ADD (gaps the engine leaves to the host)
Server-side **conversation history** + **session registry** (Phase 4), the **enterprise REST envelope**
(Phase 2), **rate-limiting + output sanitation at the edge** (Phase 11), **timestamp + validation-state**
on extracted entities (Phase 7), and the **React AG-UI client + stores/hooks** (Phase 5) with
memoization/context-splitting (Phase 10).

---

## 3. Phase checklist — all delivered ✅
1. ✅ Analyze & document (this file). 2. ✅ Backend gateway module + REST + DI. 3. ✅ SSE streaming
pass-through + cancel/reconnect + heartbeat. 4. ✅ Session/history/form-state (JSON repo, per-tab threads).
5. ✅ Frontend provider/hooks/service/stores. 6. ✅ AG-UI form auto-population (bidirectional). 7. ✅ Field
registry/mapping edge (reuse `records.py`, add timestamp + validationState). 8. ✅ Event-driven wiring
(typed AG-UI events end-to-end). 9. ✅ Enterprise standards (DTO/validation/DI/errors/logging/error-boundary).
10. ✅ Performance (memoised context, selector subscriptions, split stores). 11. ✅ Security
(validate/sanitize/rate-limit/JWT/per-owner scope). 12. ✅ End-to-end verified.

## 4. Files delivered (enterprise layered layout)
**Backend** `backend/src/modules/agent/` — layered by responsibility:
```
config/agent.config.js          constants/events.js           types/agent.types.js
validators/agent.validators.js  dto/agent.dto.js              gateway/agent.gateway.js
services/agent.service.js       services/runAccumulator.js    controllers/agent.controller.js
routes/agent.routes.js          middleware/rateLimit.middleware.js
utils/sse.js  utils/sanitize.js  tests/agent.test.js  index.js (DI composition root)
```
Wired via `context.js`, `app.js`, `config/env.js`, `config/repositories.js` (`agentThreads`).
**Frontend** `frontend/src/agent/` — layered + public barrel (`index.js`):
```
providers/AgentProvider.jsx     context/AgentContext.js       services/agentService.js
hooks/index.js (useAgentStream/useAgentEvents/selectors)      hooks/useFormBridge.js
stores/messageStore.js  stores/sessionStore.js  stores/prefsStore.js (auto-fill + highlight)
constants/events.js     components/AgentErrorBoundary.jsx
```
`AskGovPanel.jsx` streams + auto-fill toggle; `AppShell.jsx` wraps `AgentProvider`;
`ApplyPage.jsx` gets one-line `useAgentFormSync` + field-highlight ring.

## 4a. Full agent control — direct form filling (AG-UI)
With **Auto-fill ON** (default, toggle in the panel header) the agent writes its proposed values
**directly into the form field-by-field** (staggered ~180ms with a highlight ring) — no button.
Values come from (a) the citizen's held records and (b) **what they type in chat** — in LLM mode the
model calls `suggest_prefill` with `overrides`, so "my mobile is 592-700-9999" fills the phone field
(marked *You updated*). An **Undo** clears exactly those fields. With Auto-fill OFF it falls back to the
manual **Apply to form** card. Plain questions ("what documents do I need?") stream a grounded answer
via the `knowledge_base`/`web_search` tools. **LLM mode is enabled** (`gpt-4o-mini`) via
`service/.env` (`OPENAI_API_KEY`); unset it there to fall back to the deterministic engine.

## 5. Enterprise API (all under `/api/v1`, JWT required)
`POST /agent/chat` (SSE) · `POST /agent/extract` · `POST /agent/session` · `GET /agent/sessions` ·
`GET /agent/history?threadId` · `POST /agent/reset` · `POST /agent/form-sync` · `GET /agent/status`.

## 6. How to run
1. **Agent engine** (Python): `cd service && cp .env.example .env` (set `JWT_SECRET` = backend's;
   set `OPENAI_API_KEY` for LLM mode, or leave unset for the deterministic fallback). Then
   `npm run dev:agent` from the repo root (starts uvicorn on `127.0.0.1:4100`).
2. **Backend + frontend**: `npm run dev` (or `npm run dev:all` to also launch the agent).
3. Sign in, open **AskGov**, open a service application form → the agent proactively offers to auto-fill;
   **Apply to form** populates fields live; editing a field re-syncs the agent's context.

*Verification: backend `npm test` → 88 passing (incl. 6 agent); frontend `npm test` → 9 passing;
`npm run build` clean; live SSE flow exercised end-to-end (RUN_STARTED→…→RUN_FINISHED, Prefill card,
history persistence, extract entities, form-sync, 400 on bad input).*
