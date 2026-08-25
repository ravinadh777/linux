# Frontend Architecture — oneCitizen PWA

**Document type:** Frontend Architecture (BMAD Phase 04)
**Version:** 1.0 · **Date:** 13 July 2026 · **Author role:** Frontend Architect
**Derived from:** `docs/Architecture.md`, `docs/PRD.md`, `docs/SPEC.md`
**Stack (Constitution):** React (JavaScript), Vite, Tailwind CSS, Material UI, React Router, React Hook Form, Zod, Zustand, TanStack Query, Axios, Framer Motion. **PWA, no app-store dependency.**

---

## 1. Principles

- **Feature-based, not layer-based** — code is grouped by product capability (a module/service), so a team can own a feature end-to-end.
- **API is the only source of truth** — no business logic in the UI; the UI orchestrates API calls (TanStack Query) and renders.
- **Accessible & inclusive by default** — WCAG 2.1 AA, plain English, works at low bandwidth, offline-tolerant where field flows require it.
- **AGUI on every page** — the assistant panel is part of the app shell, not a per-page add-on.
- **Design-system-first** — one theme, one component library wrapper; features never hand-roll primitives.

---

## 2. Folder Structure (feature-based)

```
frontend/src/
├── app/                       # bootstrap: providers, query client, router, error boundary
│   ├── App.jsx                # <Providers><AppShell><Routes/></AppShell></Providers>
│   ├── providers.jsx          # Theme, Query, Auth, Assistant, Snackbar providers
│   └── queryClient.js
├── routes/                    # route table + guards + lazy imports (code-split per feature)
│   ├── index.jsx
│   └── guards/                # <RequireAuth>, <RequireRole>, <RequireAssurance level={2}>
├── layouts/                   # AppShell, AuthLayout, OfficerLayout, PublicLayout
├── features/                  # ← feature-based core
│   ├── auth/                  # login, OTP, step-up
│   ├── dashboard/             # citizen dashboard (reminders, suggestions, cases)
│   ├── catalogue/             # ministries → agencies → services browse
│   ├── passports/             # Module A screens + hooks + api + schemas
│   ├── civil-registration/    # Module B
│   ├── revenue/               # Module C
│   ├── grants/                # Module D
│   ├── benefits/              # Module E
│   ├── appointments/          # Module F
│   ├── one-home/              # Module G
│   ├── tracking/              # unified case timeline
│   ├── payments/              # quote → pay → receipt
│   └── officer/               # role-scoped consoles (queues, adjudication, batches)
├── components/                # shared, presentational, design-system wrappers
│   ├── ui/                    # Button, Card, Field, DataTable, StatusChip, Stepper, EmptyState…
│   ├── forms/                 # RHF+Zod field components, FormSection, FileUpload
│   ├── feedback/              # Toast, Skeleton, ErrorState, ConfirmDialog
│   └── layout/                # PageHeader, Timeline, KpiTile, SlaClock
├── assistant/                 # AGUI panel (see §11) — mounted in AppShell
├── theme/                     # MUI theme + Tailwind tokens (single design system)
├── stores/                    # Zustand: authStore, uiStore, assistantStore
├── lib/                       # axios client, interceptors, formatters, a11y helpers, pwa
└── locales/                   # i18n strings (English default; structure ready for expansion)
```

**Feature folder shape (consistent):**
```
features/<name>/
├── pages/          # route-level components
├── components/     # feature-local components
├── hooks/          # useX queries/mutations (TanStack Query)
├── api/            # axios calls (thin; typed by shared schemas)
├── schemas/        # Zod schemas (import from shared/ where cross-cutting)
└── index.js        # public surface of the feature
```

---

## 3. Layouts

| Layout | Used by | Regions |
|---|---|---|
| `PublicLayout` | landing, QR verification pages | header, content (no auth) |
| `AuthLayout` | login, OTP, step-up | centered card, minimal chrome |
| `AppShell` (citizen) | dashboard, catalogue, services, tracking, payments | top bar (identity, notifications, lang, theme toggle) · left nav · **main content** · **right AGUI panel** · footer |
| `OfficerLayout` | officer consoles | top bar · left nav (queues) · dense main (tables) · right AGUI (officer mode) |

The **AppShell** is a three-column responsive grid: `[nav | content | assistant]`. Assistant is persistent on desktop, a launchable drawer on mobile (§10, §11).

---

## 4. Shared Components (design system)

- **Primitives (`components/ui`)**: `Button`, `IconButton`, `Card`, `Field` (label+control+error+hint), `Select`, `DatePicker`, `Checkbox/Radio`, `Stepper`, `Tabs`, `DataTable` (sortable, paginated, cursor-aware), `StatusChip` (maps lane/case status → colour+icon), `Badge`, `Tooltip`, `Modal/ConfirmDialog`, `EmptyState`, `Skeleton`.
- **Composite (`components/layout`)**: `PageHeader` (title, breadcrumbs, actions), `Timeline` (unified case lanes + SLA clocks), `SlaClock` (live countdown, breach state), `KpiTile`, `FileUpload` (drag/camera capture, type/size validation, versioning, OCR-ready hook — see AI_ASSISTANT), `ReceiptCard` (QR), `VerificationResult`.
- **Forms (`components/forms`)**: RHF-bound `TextField`, `SelectField`, `FileField`, `FormSection` (conditional render), `FieldArray`. All wired to Zod resolvers.
- **Rule:** features import from `components/*`; they never import MUI directly for primitives that we've wrapped (keeps theming consistent).

---

## 5. Theme & Design System

- **Single theme source** in `theme/`: an MUI theme created from shared **design tokens** (colour, spacing, radius, typography, elevation) that are also exposed to Tailwind via `tailwind.config` (CSS variables), so MUI and utility classes never diverge.
- **Brand:** Guyana government identity — professional, high-trust, high-contrast. Neutral base + a primary (national) accent + semantic colours (success/approved, warning/attention, error/rejected, info, pending).
- **Typography:** system font stack for performance on low-bandwidth devices; clear hierarchy; minimum 16px body for readability.
- **Density modes:** comfortable (citizen), compact (officer consoles / data tables).
- **Motion:** Framer Motion for meaningful transitions only (page/route, panel open, status change), all respecting `prefers-reduced-motion`.

---

## 6. Responsive Strategy

- **Mobile-first**, Android-dominant reality; breakpoints `sm/md/lg/xl` (Tailwind + MUI aligned).
- **AppShell reflow:**
  - `≥ lg`: three columns (nav · content · assistant).
  - `md`: nav collapses to icon rail; assistant becomes a right drawer (toggle).
  - `< md`: nav → hamburger drawer; assistant → bottom-docked launcher opening a full-height sheet; content full-width.
- **Data tables** collapse to card lists on small screens.
- **Performance budget** (see PERFORMANCE.md later): ≤ 3s load on 3G-class; route-level code splitting; lazy images; skeletons over spinners.

---

## 7. Routing

- **React Router**, route table in `routes/`, **lazy per feature** (`React.lazy` + Suspense) for code-splitting.
- **Route groups:** `public/*`, `auth/*`, citizen app (`/dashboard`, `/catalogue`, `/services/:module/*`, `/cases/:id`, `/payments/*`, `/appointments/*`), officer (`/officer/*`).
- **Canonical citizen flow (PRD §5):** `Login → Dashboard → Ministries → Agencies → Services → Tracking`.
- **Deep links:** catalogue tiles carry `deepLink` (FR-P9); reminders' pay-now links route straight to a prefilled payment (FR-P11.1).

---

## 8. Guards

| Guard | Behaviour |
|---|---|
| `RequireAuth` | redirect to `/login` (preserving return URL) if no valid token |
| `RequireRole roles=[…]` | 403 page if the JWT roles don't intersect; officer routes |
| `RequireAssurance level={2}` | if token `assuranceLevel < 2`, trigger **in-session step-up** modal, resume on success |
| `RequireDelegation` | agent/caregiver acting-for context must be present and active |
| account-less (Level 1) | booking/tracking routes accept phone+OTP tokens; everything else prompts sign-in |

Guards read from `authStore`; a 401/`STEP_UP_REQUIRED` from the API also drives them (interceptor → store → guard).

---

## 9. State Management

Three cleanly separated concerns:

1. **Server state → TanStack Query.** All API data (cases, quotes, catalogue, queues). Query keys namespaced per feature; mutations invalidate precisely; optimistic updates for status changes; background refetch for live SLA clocks and queue positions.
2. **Global client state → Zustand.** `authStore` (token, roles, assurance, delegation, refresh), `uiStore` (theme, density, drawer state, locale), `assistantStore` (panel open, conversation, context binding).
3. **Local/form state → React Hook Form + Zod.** Form values, validation, wizard steps live in the form; submitted via a mutation.

Rule: no server data duplicated into Zustand; no form state lifted to global. This keeps re-renders and cache invalidation predictable.

---

## 10. Accessibility & Dark Mode

- **WCAG 2.1 AA:** semantic HTML/ARIA via MUI, full keyboard operability, visible focus, ≥4.5:1 contrast (verified in both themes), form errors announced (`aria-live`), skip-to-content, logical tab order, labelled controls, min touch target 44px.
- **Plain English** microcopy; instructions before, not after, the counter (mirrors F-FR1).
- **Assisted parity:** officer "assisted intake" screens mirror citizen flows so no capability is UI-only.
- **Dark mode:** `theme/` defines light + dark palettes from the same tokens; toggle in `uiStore`, persisted, honours `prefers-color-scheme` on first load; both palettes contrast-audited. Applied to MUI theme and Tailwind (`data-theme`/class strategy) together.
- **Reduced motion & low-bandwidth** honoured (§5, §6).

---

## 11. AGUI Assistant Panel (on every page)

- **Mounted in `AppShell`** → present on every authenticated page (desktop right column; mobile bottom-docked sheet). Detailed capabilities in `docs/AI_ASSISTANT.md` (Phase 07).
- **Context-aware:** the panel subscribes to route + current feature via `assistantStore` (`context = { module, page, caseId?, formSnapshot? }`), so it can "fill this form", "explain this status", "book a slot here".
- **Actions are proposals:** the assistant can pre-fill and navigate, but any submit/pay/enrol requires the **citizen's explicit confirm** in the primary UI (FR-P10) — the panel never auto-submits.
- **Modes:** citizen mode (guide/fill/track/summarise/recommend) and officer mode (summarise case, surface reason-code options — never decides).
- **Accessibility:** the panel is a labelled complementary landmark, fully keyboard-navigable, and collapsible so it never blocks the main task.

---

## 12. Integration with Backend

- **Axios client** (`lib/api`) with interceptors: attach JWT, inject `requestId`, refresh-on-401, map the backend error contract (Architecture §6.2) to typed UI errors + toasts.
- **Shared Zod schemas** (`shared/schemas`) validate forms client-side identically to the server, preventing drift.
- **Env:** `VITE_API_BASE_URL`, `VITE_MOCK=true` (MSW mock service worker available for isolated FE dev against `docs/API.md` mock responses).

---

*End of Frontend Architecture.*
