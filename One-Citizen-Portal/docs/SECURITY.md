# Security Architecture — oneCitizen Platform

**Document type:** Security Architecture (BMAD Phase 08)
**Version:** 1.0 · **Date:** 13 July 2026 · **Author role:** Security Architect
**Anchors:** SPEC §5.1 (OWASP ASVS L2, MFA, TLS, audit, Data Protection Act 2023), Architecture §5–§6
**Scope:** applies to the reference build (JSON persistence, mock integrations) with the production hardening path noted where they differ.

---

## 1. Threat Model (summary)

| Asset | Threats | Primary controls |
|---|---|---|
| Citizen PII & documents | Unauthorised access, cross-citizen leakage | OneIdentity + scope filter (§4), field-level minimisation, encryption |
| Money movement (D/E/C) | Fraudulent/duplicate/automated payout | Human release chain, segregation of duty, dedup, idempotency, audit |
| Statutory decisions | Tampering, non-repudiation gaps | Coded-reason decisions, append-only audit, artefact signing |
| Certificates/extracts | Forgery | QR verification, hash integrity, PKI/HSM signing (prod) |
| APIs | Abuse, scope escalation, injection | OAuth2 scopes, rate limits, input validation, mutual TLS (prod) |
| Uploads | Malware, spoofed types, oversized payloads | AV scan, magic-byte sniff, size caps, quarantine |

---

## 2. OWASP Alignment (ASVS L2 / Top 10)

| Risk | Control in this platform |
|---|---|
| **A01 Broken Access Control** | RBAC role keys + **mandatory scope `ctx` in every repository call** (authz cannot be forgotten); server-side enforcement only; deny-by-default; segregation of duty (approve ≠ release); IDOR-proof (scope filter blocks cross-citizen IDs). |
| **A02 Cryptographic Failures** | TLS 1.2+ everywhere; secrets from env/secret-manager; document SHA-256 hashing; artefact signing (PKI/HSM prod); passwords hashed (argon2/bcrypt). |
| **A03 Injection** | Zod validation on all inputs; parameterised queries in the DB adapter; no string-built queries; output encoding in React (no `dangerouslySetInnerHTML`). |
| **A04 Insecure Design** | Human-decision invariants, idempotency on money endpoints, outbox events post-commit, threat model in this doc. |
| **A05 Security Misconfiguration** | helmet security headers, strict CORS allowlist, CSP (§7), disabled verbose errors in prod, `.env` not in repo, least-privilege roles. |
| **A06 Vulnerable Components** | Dependency scanning (npm audit / SCA) in CI; pinned versions; renovate policy. |
| **A07 Auth Failures** | MFA for officers, OTP throttling, refresh-token rotation + revocation, step-up for L2, generic auth errors (no user enumeration). |
| **A08 Integrity Failures** | Append-only audit with before/after hashes; signed webhooks; artefact hashing; CI artifact integrity. |
| **A09 Logging/Monitoring Failures** | Structured logs + append-only audit + integration logs; requestId correlation; alerting on breach/anomaly (prod). |
| **A10 SSRF** | Webhook/integration URLs allow-listed + validated; no user-controlled server-side fetch of arbitrary URLs. |

---

## 3. Authentication (JWT / OneIdentity)

- **Tokens:** JWT bearer issued by OneIdentity (mock service in build; RS256 + JWKS rotation in prod). Claims: `sub, roles[], assuranceLevel(1|2), delegations[], consumerId?, scopes[], iat, exp, jti`.
- **Assurance levels:** L1 = phone+OTP (account-less: booking/tracking scopes only); L2 = step-up (ID/biometric) required for sensitive actions (`POST /passports/applications`, `/documents`, `/payments`, `/revenue/tin`, `/onehome/applications`, …). Missing → `403 STEP_UP_REQUIRED`.
- **MFA:** mandatory for all officer roles (SPEC §5.1); enforced as an MFA claim required before officer scopes activate.
- **Sessions:** stateless (no server session) → horizontal scale; short-lived access tokens (≈15 min), rotating refresh tokens; `jti` denylist for logout/revoke (file → Redis at scale).
- **Delegation (FR-P1.3):** agent/caregiver tokens carry `delegations[]`; services assert the acting-for subject, log **both** identities; citizen-revocable (E-BR6).
- **System consumers:** OAuth2 client-credentials → scoped tokens; per-consumer secrets, rate limits, and NDMA onboarding gate.

---

## 4. Authorization (RBAC + scope)

- **Roles:** the 15 role keys in PRD §4.1; deny-by-default; a route declares `requireRole([...])`, `requireScope('…')`, `requireAssurance(2)`.
- **Scope filtering (core control):** the `scope` middleware builds an immutable `ctx` from the token (subject, roles, consumer, granted lanes) that is a **required argument to every repository query** — the JSON adapter applies the same predicate SQL `WHERE` would, so:
  - citizen sees only own records; agency officer sees only its lane; consumer sees only granted scopes; public verify returns name only.
- **Segregation of duty:** `officer.authorising` (approve batch) must differ from `officer.finance` (release); appeals reopen to a *different* officer — enforced in services with identity checks (`FORBIDDEN` on violation).
- **Delegated authorization:** actions permitted only if the delegation grant covers the scope and is active.

---

## 5. Rate Limiting

- **Per-IP** limits on unauthenticated/public endpoints (`/auth/*`, `/verify/*`, `/health`), stricter on OTP + login to throttle brute force.
- **Per-consumer** quotas + burst limits on system tokens (FR-P8); `429 RATE_LIMITED` with `Retry-After`.
- **Per-citizen** limits on the assistant and write endpoints.
- Build: in-memory counters; prod: Redis (shared across replicas). Money endpoints additionally protected by **`Idempotency-Key`** to make retries safe.

---

## 6. Audit Logs

- **Append-only** store (`data/store/platform/audit.json` → DB `audit` table). Every state change, document access, decision, clearance, and batch release: `{ actor, actingFor?, role, action, entity, entityId, before/afterHash, requestId, timestamp, consumerId? }`.
- **Non-repudiation:** decisions carry coded reasons (FR-P6); releases carry finance-officer identity (D-FR5).
- **Retention ≥ 7 years** (G-FR10.4); never rewritten in place; tamper-evident via chained/entry hashes.
- **Access:** audit read restricted to `sysadmin`/`oversight`/auditor; audit reads are themselves audited.

---

## 7. CSP & Security Headers

- **CSP (report-then-enforce):** `default-src 'self'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'` (MUI runtime styles) — tightened with nonces where feasible; `img-src 'self' data:`; `connect-src 'self'` + API origin; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`.
- **Headers (helmet):** HSTS (prod), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimised, `Cross-Origin-Opener/Resource-Policy` set.

---

## 8. CORS

- **Strict allowlist** of known origins (portal, sandbox, approved consumers) — no wildcard with credentials.
- Methods/headers limited to what the API uses; preflight cached; credentials mode only for first-party origins.
- Consumer (server-to-server) traffic uses tokens, not browser CORS; **mutual TLS** on the government interoperability layer in prod.

---

## 9. Input Validation

- **Zod at the edge** for every `body/query/params` (shape, type, enum, bounds, format) → `400 VALIDATION_ERROR` with field details.
- **Business-rule validation** in services (duplicates, entitlement, gating checks) → `422 BUSINESS_RULE_VIOLATION` with `reasonCode`.
- **Reference-data checks** against seed vocabularies (regions, reason codes, doc types).
- **Canonicalisation** of identifiers (TIN, National ID, MAN) before dedup checks; no trust in client-supplied derived fields.

---

## 10. File Upload Validation

- **Type:** MIME + **magic-byte sniffing** (reject spoofed extensions); allow-list per context (PDF/JPG/PNG; +DWG/DXF for Module G).
- **Size:** default ≤ 25 MB, configurable; reject oversized before buffering fully.
- **Malware:** AV scan (mock in build / ClamAV/service in prod); status `pending|clean|infected`; **infected quarantined, never served**; served files require `clean`.
- **Integrity & versioning:** SHA-256 hash stored; re-upload creates a **new version** (never a parallel copy); `original_verified_flag` for counter sighting.
- **Storage:** no execution of uploads; served via controlled endpoint with content-disposition + nosniff; presigned URLs + object storage in prod.

---

## 11. Secrets Management

- **Never in repo.** Loaded from env (12-factor); `.env.example` documents required keys (`JWT_SECRET`/keys, gateway creds, consumer secrets, `PERSISTENCE_DRIVER`).
- **Build:** `.env` gitignored; dev secrets are non-production dummies.
- **Prod:** secrets manager/KMS; key rotation (JWT signing keys via JWKS); mutual-TLS certs managed; least-privilege service credentials; audit of secret access.
- Consumer client secrets hashed at rest; webhook signing secrets per subscription.

---

## 12. Data Protection (Act 2023)

- **Purpose limitation & minimisation:** each module/consumer receives only its lane's data; assistant context minimised.
- **Right of access:** citizen can view/export own record and audit of accesses to it.
- **Consent:** attestation sharing and reminders/suggestions are consent-gated; consent changes logged.
- **Public disclosure floor:** verification endpoints expose name + validity only.
- **Retention:** per policy; audit ≥ 7 years; documents versioned with defined lifecycle.

---

## 13. Build-vs-Production Security Delta

| Control | Build | Production |
|---|---|---|
| JWT signing | HS256, env secret | RS256 + JWKS rotation |
| Artefact signing | Mock signer (hash) | PKI/HSM-backed |
| AV scan | Mock scanner | ClamAV / scanning service |
| Rate-limit store | In-memory | Redis (cross-replica) |
| Transport | TLS (local dev may be http) | TLS 1.2+, HSTS, mutual TLS on interop layer |
| Secrets | `.env` | Secret manager / KMS |
| Pen test | Static review | Annual penetration test (SPEC §5.1) |

---

*End of Security Architecture.*
