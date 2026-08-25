# Integration Report (BMAD Phase 13)

**Version:** 1.0 · **Date:** 14 July 2026
**Scope:** Frontend ↔ backend integration of the vertical slice — Login → Dashboard → Ministries → Agencies → Services → Tracking, with the AG-UI assistant.

## Runnable status — ✅ PASS

`npm run dev` starts both servers concurrently:
- **Backend** (Express) on `http://localhost:4000` — `/health` → `{ status: "ok" }`.
- **Frontend** (Vite/React PWA) on `http://localhost:5173` — serves the SPA; `/api` proxied to the backend.

## Verified integration points

| Area | Result |
|---|---|
| Authentication | Login via proxy returns L2 session; JWT attached by Axios interceptor; 401 clears session and redirects to `/login` |
| Navigation flow | Login → Dashboard → Ministries → `/ministries/:code` (agencies) → `/agencies/:code` (services) → `/services/:id` (detail + apply) → `/tracking` → `/tracking/:id` |
| AG-UI assistant | Persistent panel on every authenticated page; `POST /assistant/message` returns reply + navigation actions; deterministic intent detection; every turn audited |
| Mock APIs | catalogue, applications (create/list/get), dashboard (reminders/suggestions/cases), assistant — all JSON-repository backed |
| JSON repositories | `applications`, `documents`, identity/eventing stores — Repository Pattern over `data/store` |
| Apply → track | `POST /applications` (L2-gated) creates a case with lanes + timeline; Tracking detail renders the stepper + timeline |
| Theme / dark mode | MUI theme from tokens; toggle persisted; `data-theme` on root |
| Build & lint | `vite build` ✅ · frontend eslint ✅ · backend eslint ✅ |
| Tests | Backend: **82 passing** (7 suites) |

## Endpoints backing the flow (all under `/api/v1`)

`POST /auth/login`, `GET /me`, `GET /catalogue/ministries`, `GET /catalogue/ministries/:code/agencies`,
`GET /catalogue/agencies/:code/services`, `GET /catalogue/services/:id`,
`POST /applications`, `GET /applications`, `GET /applications/:id`,
`GET /dashboard/reminders|suggestions|cases`, `POST /assistant/message`.
Platform foundation (E0) also live: OTP, refresh, client-credentials, step-up, delegation, vault, webhooks, audit, reference-data, `/api/docs`.

## How to run

```bash
npm install
npm run dev          # backend :4000 + frontend :5173
# open http://localhost:5173  → sign in with 1990-1234 / Password123!
```

## Known limitations (reference build)

- Persistence is JSON mock (`data/store`); integrations (payments, SMS, AV, OCR, production systems) are mock adapters.
- Applications are a generic mock case surface; module-specific workflows (A–G) replace them in later stories.
- AG-UI assistant uses deterministic intent detection (LLM adapter is a production swap).
- Frontend bundle is a single chunk (code-splitting is a Phase-15 performance task).
