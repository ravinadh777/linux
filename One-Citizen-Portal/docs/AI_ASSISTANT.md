# AI Assistant (AGUI) — Solution Design

**Document type:** AI Solution Architecture (BMAD Phase 07)
**Version:** 1.0 · **Date:** 13 July 2026 · **Author role:** AI Solution Architect
**Implements:** FR-P10 (platform), and the AGUI hooks in A-FR10, B-FR9, C-FR10, D-FR8, E-FR8, F-FR9
**Frontend home:** persistent panel in `AppShell` (frontend/ARCHITECTURE.md §11) · **Backend:** `platform/assistant`

---

## 1. Purpose & Guardrails

**AGUI** is a conversational assistant that helps citizens (and officers, in a limited mode) *find, understand, prepare and track* government services — present on **every page**. It is an **accelerator over the same APIs a human uses**, never a privileged actor.

**Non-negotiable guardrails (from SPEC/PRD):**
1. **Explicit citizen confirm before any submit/pay/enrol** (FR-P10) — the assistant proposes; the citizen commits in the primary UI.
2. **Machines flag, humans decide** — the assistant never adjudicates, clears a flag, releases money, or suspends a benefit (BR-G2).
3. **Scope-bound** — it operates only under the citizen's delegated OneIdentity context; it can see and do exactly what that citizen can, nothing more (BR-G4).
4. **Explainable & dismissible** — every suggestion/recommendation states its basis and can be dismissed (FR-P11.3).
5. **No autonomous side effects** — all state-changing tool calls route through confirmation.
6. **Auditable** — every assistant-initiated API call is logged with the acting citizen identity + `assistant` flag.

---

## 2. Capabilities (required)

| # | Capability | What it does | Guardrail |
|---|---|---|---|
| C1 | **Intent detection** | Classify the user's goal → a service/action (e.g. "renew my passport" → Module A renewal) | Ambiguous → clarifying question, never a guess-submit |
| C2 | **Navigate pages** | Route the app to the right page/step; deep-link into a service or a case | Read-only navigation; no data change |
| C3 | **Fill forms** | Pre-fill RHF fields from vault/attestations + conversation; map answers to schema | Writes to the form only; citizen edits + submits |
| C4 | **OCR-ready upload flow** | Guide document upload; on `document.uploaded`, request OCR extraction to pre-fill fields | Extracted values are **suggestions**, flagged for review; originals authoritative |
| C5 | **Validate** | Run the same Zod schema + surface business-rule prerequisites *before* submission | Mirrors server validation; no bypass |
| C6 | **Submit** | Assemble the request and present a review summary → **citizen confirms** → calls the API | Hard stop on explicit confirm (FR-P10) |
| C7 | **Track applications** | Summarise case status, lanes, SLA clocks, next actions across modules | Read via `/dashboard/cases`, scope-filtered |
| C8 | **Summaries** | Plain-English summary of a case, a decision, an RFC, a fee quote | Read-only; cites source fields |
| C9 | **Recommendations** | Surface likely entitlements (FR-P11.3) and next best actions (renewals due, missing docs) | Explainable, dismissible, never auto-enrol |

Officer mode (limited): summarise a case + surface applicable **reason-code options** from the vocabulary — it never selects the decision.

---

## 3. Architecture

```
Citizen ↔ AGUI Panel (frontend/assistant)
            │  POST /assistant/message  { message, context, conversationId }
            ▼
   platform/assistant  (Orchestrator)
   ┌───────────────────────────────────────────────────────────────┐
   │ 1. Context assembler  → route/module/page/caseId/formSnapshot   │
   │ 2. Intent + planner   → LLM (tool-calling) with system policy    │
   │ 3. Tool registry      → whitelisted calls to internal APIs       │
   │      • read tools (no confirm): catalogue, cases, quotes, docs   │
   │      • write tools (CONFIRM-GATED): submit, pay, enrol, book     │
   │ 4. Confirmation gate  → write tools return a "proposal" object   │
   │ 5. Auditor            → logs every tool call (actor + assistant) │
   └───────────────────────────────────────────────────────────────┘
            │ proposals / summaries / navigation intents
            ▼
   AGUI Panel renders: text + action chips + "Review & confirm" card
```

- **Tool-calling pattern:** the LLM may only call registered tools that map 1:1 to `/api/v1` endpoints under the citizen's token. **Write tools do not execute** — they return a structured *proposal* the panel renders for confirmation; only the citizen's confirm click fires the real mutation from the primary UI.
- **Model boundary:** the LLM sees only scope-filtered, minimised context (no raw PII beyond what the citizen already sees on screen). Prompts + tool outputs are logged as references, not full sensitive payloads.
- **Deterministic fallback:** if the model is unavailable, the panel degrades to a **guided command menu** (search catalogue, open case, upload doc) — the citizen is never blocked (inclusion principle).

---

## 4. Request/Response Contract

### POST /assistant/message  🔒 (delegated citizen context)
- **Request:**
```json
{ "conversationId":"conv_…", "message":"renew my passport",
  "context":{ "module":"A", "page":"dashboard", "caseId":null, "formSnapshot":null } }
```
- **Response 200:**
```json
{ "conversationId":"conv_…",
  "reply":"You can renew now — your biometrics are current, so no documents are needed.",
  "actions":[
    { "type":"navigate", "to":"/services/passports/renew" },
    { "type":"prefill", "form":"passportRenewal", "values":{ "priorPassportNo":"R1234567" } },
    { "type":"proposal", "intent":"submit", "endpoint":"POST /passports/applications",
      "summary":"Submit passport renewal", "requiresConfirm":true } ],
  "citations":[{ "field":"biometrics", "source":"vault/attestation" }] }
```
- **Errors:** `VALIDATION_ERROR`, `FORBIDDEN` (out of scope), `INTEGRATION_UNAVAILABLE` (model down → fallback menu flag).

---

## 5. OCR-Ready Upload Flow (C4 detail)

```
citizen uploads file → POST /documents → event document.uploaded
   → assistant requests OCR extraction (adapter: mock in build / OCR service in prod)
   → returns { fields:{ name, dob, docNumber }, confidence }
   → panel shows "We read these details — check them" (editable, flagged unverified)
   → citizen accepts → values populate the form (still requires submit confirm)
```
- Extraction never overwrites verified attestation data; low-confidence fields flagged for manual entry. Original document remains the authoritative artefact (originals sighting per FR-P2.3 unaffected).

---

## 6. Safety, Privacy & Audit

- **Confirmation ledger:** each write proposal → citizen confirm is recorded (proposal id, endpoint, confirmed-at) in the audit log alongside the resulting mutation.
- **Prompt-injection defence:** document/OCR text and case content are treated as *data, not instructions*; the tool registry is closed (allow-list) so injected text cannot invoke unlisted actions.
- **PII minimisation:** context assembler passes only fields already visible to the citizen; redaction before any model call; no cross-citizen data ever in context (scope filter).
- **Consent:** recommendations use only public eligibility rules + the citizen's own consented data (FR-P11.3); suggestions dismissible and non-recurring once dismissed.
- **Rate limiting & abuse:** per-citizen assistant rate limits; write proposals expire.
- **Auditability:** `assistant.message`, `assistant.proposal`, `assistant.tool_call` events with acting identity (FR-P7).

---

## 7. Build vs Production

| Aspect | Reference build | Production |
|---|---|---|
| Model | Pluggable adapter; deterministic intent/rules stub acceptable for demo | Claude (latest) via secured gateway |
| OCR | Mock extractor returning fixture fields | OCR/document-AI service |
| Tools | Same registry against JSON-backed APIs | Same registry against real APIs |
| Fallback | Guided command menu | Guided command menu |

The assistant adds no capability that isn't already an authorised API — so it inherits the platform's security and audit posture wholesale.

---

*End of AI Assistant design.*
