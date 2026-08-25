# oneCitizen API — Express + Repository Pattern
#
# IMPORTANT: build from the REPO ROOT, not from backend/, because the image needs the
# sibling shared/ package (backend depends on it via file:../shared):
#
#   docker build -f backend/Dockerfile -t onecitizen/backend .
#
# infra/docker/docker-compose.yml already sets the context correctly.

# ── deps ─────────────────────────────────────────────────────────────────────
# Isolated so dependency installation is cached independently of source changes.
FROM node:20-alpine AS deps
WORKDIR /app

# shared/ must land first: backend's file:../shared is resolved during npm ci.
COPY shared/package.json ./shared/
COPY backend/package.json backend/package-lock.json ./backend/

WORKDIR /app/backend
RUN npm ci --omit=dev && npm cache clean --force

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    # Container default: the data dir is a mounted volume, not the repo checkout.
    DATA_DIR=/var/lib/onecitizen

# dumb-init reaps zombies and forwards SIGTERM, so the graceful shutdown in
# server.js actually runs when the orchestrator stops the container.
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY shared ./shared
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts

# Seed fixtures are baked in so a cold start can populate an empty volume/DB.
COPY data/seed ./data/seed

# Run unprivileged. The node image ships a `node` user (uid 1000).
RUN mkdir -p "$DATA_DIR" && chown -R node:node /app "$DATA_DIR"
USER node

WORKDIR /app/backend
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
