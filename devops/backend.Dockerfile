# Udigity backend (Express/TS). Build context: repository root.
#   docker build -f devops/backend.Dockerfile -t udigity-backend .

# G-05: pinned by digest (reproducible rebuilds). Refresh monthly: docker buildx imagetools inspect node:22-alpine
ARG NODE_IMAGE=node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

# ---- deps: full install for the backend workspace (incl. dev deps for tsc) ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
# T-03: --ignore-scripts everywhere: no production dependency has an install script (checked against package-lock.json
# hasInstallScript: only dev tooling esbuild, fsevents, unrs-resolver do; tsc and next build need none). Re-check on dependency changes.
RUN npm ci -w backend --include-workspace-root=false --ignore-scripts --no-audit --no-fund

# ---- build: compile TypeScript; tsc does not copy .sql, so copy migrations next to dist/db ----
FROM deps AS build
COPY backend backend
RUN npm run build -w backend \
 && mkdir -p backend/dist/db/migrations \
 && cp backend/src/db/migrations/*.sql backend/dist/db/migrations/

# ---- prod-deps: runtime dependencies only ----
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci -w backend --include-workspace-root=false --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
# Workspace-local node_modules (only present when npm could not hoist a dependency).
COPY --from=prod-deps --chown=node:node /app/backend/node_modules* ./backend/node_modules/
WORKDIR /app/backend
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
# Migrations: docker compose run --rm backend node dist/db/migrate.js
CMD ["node", "dist/index.js"]
