# infra — deployment configuration

Everything needed to run oneCitizen outside a developer laptop. Application code lives in
`backend/`, `frontend/`, `service/`; nothing in here imports application source.

```
infra/
├── docker/     compose stack (local + single-VM)
├── nginx/      SPA server + API reverse proxy, baked into the frontend image
└── k8s/        Kustomize base + dev/prod overlays
```

The three `Dockerfile`s live with the apps they build (`backend/Dockerfile`,
`frontend/Dockerfile`, `service/Dockerfile`), so an app and its build recipe stay together.

## Ports

| Service        | In-container | Compose (host)   | Notes                                    |
| -------------- | ------------ | ---------------- | ---------------------------------------- |
| `frontend`     | 8080         | 8080             | The only port you need. nginx + SPA      |
| `backend`      | 4000         | 4000 (dev only)  | Reached through the frontend's `/api`    |
| `askgov-agent` | 4100         | 4100 (dev only)  | Reached through the backend's agent proxy |
| `postgres`     | 5432         | 5432 (loopback)  | For psql/pgAdmin                         |

Request path: **browser → frontend (nginx) → backend → askgov-agent**. Only the frontend is
publicly exposed, so there is no CORS surface in production.

## Docker Compose

```bash
cp infra/docker/.env.example infra/docker/.env    # set JWT_SECRET and PGPASSWORD
npm run docker:build
npm run docker:up
# → http://localhost:8080
npm run docker:logs
npm run docker:down
```

`JWT_SECRET` and `PGPASSWORD` are required — compose refuses to start without them rather
than defaulting to something insecure. `OPENAI_API_KEY` is optional: without it the agent
runs its deterministic fallback and emits the identical AG-UI event stream.

Two modes:

- **Production-like** (`npm run docker:*`) — passes `-f` explicitly, so the override file
  is ignored. Postgres driver, `AUTH_REQUIRED=true`, only port 8080 published.
- **Development** (`cd infra/docker && docker compose up`) — compose auto-loads
  `docker-compose.override.yml`: json driver, no database needed, repo `data/`
  bind-mounted, auth relaxed, API and agent ports published for direct curl.

The Node images build from the **repo root**, because `backend` and `frontend` both depend
on the sibling `shared/` package via `file:../shared`. The compose file already sets this;
building by hand needs it too:

```bash
docker build -f backend/Dockerfile -t onecitizen/backend .    # note the trailing dot
docker build -t onecitizen/askgov-agent ./service             # self-contained
```

## Kubernetes

Never apply `base/` directly — apply an overlay:

```bash
kubectl kustomize infra/k8s/overlays/dev     # render and read it first
kubectl apply -k infra/k8s/overlays/dev
kubectl apply -k infra/k8s/overlays/prod
```

| | dev | prod |
| --- | --- | --- |
| Namespace | `onecitizen-dev` | `onecitizen-prod` |
| Replicas | 1 each | 3 each, + HPA and PDBs |
| Images | `:dev` | pinned to a release tag in GHCR |
| `AUTH_REQUIRED` | `false` | `true` |
| `DB_AUTO_MIGRATE` | `true` | `false` — run migrations as a reviewed job |
| Postgres | in-cluster or managed | managed instance |

Deploying a new version is a **tag bump** in the overlay's `images:` block, committed —
not `kubectl edit` against a live object.

### Things that will bite you

- **k8s Services are named `backend`, `frontend`, `askgov-agent`** — matching the compose
  service names, not prefixed with `onecitizen-`. The frontend image bakes in
  `infra/nginx/nginx.conf`, which proxies to the host `backend`. Renaming a Service breaks
  in-cluster routing while compose keeps working.
- **SSE needs buffering off at every hop.** The Ingress sets
  `nginx.ingress.kubernetes.io/proxy-buffering: "off"` and `nginx.conf` sets
  `proxy_buffering off` for `/api/v1/agent/`. Miss either and agent replies arrive only
  when the run completes — the assistant looks frozen. Annotations here target
  **ingress-nginx**; other controllers need their own equivalents.
- **`JWT_SECRET` is shared.** The API signs citizen tokens with it and the agent verifies
  them with it. Both read the same key from one Secret; a mismatch surfaces as every agent
  call returning 401.
- **`base/secret.yaml` is a committed template with placeholder values.** It exists so
  `kubectl kustomize` renders. Supply real values via Sealed Secrets, SOPS, or External
  Secrets before any shared environment — see the comments in that file.
- **The json persistence driver does not survive multiple replicas.** Each pod would get
  its own `emptyDir` store. Use `PERSISTENCE_DRIVER=postgres` (the default in `base/`) for
  anything beyond one pod, or attach a ReadWriteMany PVC.
- **`readOnlyRootFilesystem: true` everywhere.** New code that writes to disk needs an
  explicit `emptyDir` mount rather than a relaxed security context.

## Not included

No Terraform / cloud IaC — cluster, registry and managed Postgres provisioning is
environment-specific and was out of scope for this pass. The manifests assume those exist
and that an ingress controller and cert-manager are installed.
