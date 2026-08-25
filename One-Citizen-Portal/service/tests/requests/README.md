# `/agent` request bodies — reusable test cases

Sample `RunAgentInput` payloads for `POST /agent`, one per behaviour branch. Use
them from `run_all.sh`, `curl`, Postman, or the Swagger UI at
`http://localhost:4100/docs`.

AskGov now works for **every service** (not just passport renewal): on any
application form it proposes a prefill from the citizen's records, lists the values
in chat with their source, and offers a single **Apply to form** action (no
generative card). Citizen-requested changes are saved to their profile and reflected
in later prefills; validation flags mismatches and rule violations per service.

## The cases

| File | `trigger` | Exercises |
|------|-----------|-----------|
| `01_page_context_prefill.json` | `page_context` | Proactive offer on landing (passport) → `suggest_prefill` |
| `02_user_message_autofill.json` | `user_message` | "auto-fill my form" → `suggest_prefill` |
| `03_documents_question.json` | `user_message` | "what documents?" → `knowledge_base` tool |
| `04_fees_websearch.json` | `user_message` | "fee / how long?" → web/KB tools |
| `05_field_changed_mismatch.json` | `field_changed` | Bad values → `Validation` flags (no LLM) |
| `06_field_changed_clean.json` | `field_changed` | Correct values → **silent** (no message) |
| `07_prefill_applied.json` | `prefill_applied` | After tapping Apply → next-steps guidance |
| `08_prefill_dismissed.json` | `prefill_dismissed` | After dismissing → acknowledgement |
| `09_generic_help.json` | `user_message` | Off-form help on `/` |
| `10_multiturn_history.json` | `user_message` | Conversation with prior turns |
| `11_minimal_empty.json` | *(none)* | Minimal body — empty messages/state |
| `12_other_service_prefill.json` | `page_context` | Prefill on a **non-passport** service (TIN) |
| `13_change_field_updates_profile.json` | `user_message` | Change a value → saved to profile → re-listed "You updated" |
| `14_other_service_validation.json` | `field_changed` | Per-service warnings (pension age < 65, bad email, region mismatch) |

## Run them all

```bash
bash run_all.sh
```

`run_all.sh` mints a fresh HS256 token (`sub=idn_citizen_1`, secret from
`.env`: `change-me-dev-only-not-for-production`), POSTs each `*.json` to
`http://localhost:4100/agent`, and prints the ordered AG-UI event types plus any
tool / custom-event names per case. Requires the service running on port 4100.

## Run one by hand

```bash
# 1) generate a token (valid 2h)
TOKEN=$(../../.venv/Scripts/python.exe -c "import jwt,datetime; print(jwt.encode({'sub':'idn_citizen_1','exp':datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=2)},'change-me-dev-only-not-for-production',algorithm='HS256'))")

# 2) fire one body
curl -N -X POST http://localhost:4100/agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @12_other_service_prefill.json
```

## In Swagger (`/docs`)

Open the `POST /agent` operation, paste `Bearer <token>` into the `authorization`
header field, and drop any of these JSON files into the request body.

> Change the token `sub` to `idn_agent_1` to run as the other mock citizen
> (Aran Agent). With `AUTH_REQUIRED=false` (dev default) an unauthenticated call
> falls back to the demo citizen.
