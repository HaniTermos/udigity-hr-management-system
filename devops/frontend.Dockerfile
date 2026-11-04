# Udigity frontend (Next.js 16). Build context: repository root.
#   docker build -f devops/frontend.Dockerfile -t udigity-frontend .
#
# Uses Next "standalone" output (`output: 'standalone'` in frontend/next.config.mjs). The build FAILS if the standalone
# output is missing, instead of silently shipping a much larger `next start` image (G-15).

# G-05: pinned by digest (reproducible rebuilds). Refresh monthly: docker buildx imagetools inspect node:22-alpine
ARG NODE_IMAGE=node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci -w frontend --include-workspace-root=false --no-audit --no-fund

FROM deps AS build
# Rewrites in next.config are resolved at BUILD time: this must be the backend address inside the
# compose network. NEXT_PUBLIC_* values are inlined at build time too.
ARG INTERNAL_API_URL=http://backend:5000
# Must equal the backend values (PASSWORD_MIN_LENGTH / CSRF_COOKIE_NAME in backend.env); docker-compose.prod.yml passes them.
ARG NEXT_PUBLIC_PASSWORD_MIN_LENGTH=12
ARG NEXT_PUBLIC_CSRF_COOKIE_NAME=__Host-udigity_csrf
ENV INTERNAL_API_URL=${INTERNAL_API_URL} \
    NEXT_PUBLIC_PASSWORD_MIN_LENGTH=${NEXT_PUBLIC_PASSWORD_MIN_LENGTH} \
    NEXT_PUBLIC_CSRF_COOKIE_NAME=${NEXT_PUBLIC_CSRF_COOKIE_NAME} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY frontend frontend
RUN npm run build -w frontend
# Assemble /out from the standalone output; fail loudly when it is not there (G-15).
RUN set -eu; mkdir -p /out; \
  [ -d frontend/.next/standalone ] || { echo "ERROR: frontend/.next/standalone is missing: set output: 'standalone' in frontend/next.config.mjs" >&2; exit 1; }; \
  cp -a frontend/.next/standalone/. /out/; \
  SERVER_DIR="$(dirname "$(cd /out && find . -name server.js -path '*frontend/server.js' -not -path '*/node_modules/*' | head -n1)")"; \
  [ "$SERVER_DIR" != "." ] || SERVER_DIR=./frontend; \
  [ -f "/out/$SERVER_DIR/server.js" ] || { echo "ERROR: standalone server.js not found" >&2; exit 1; }; \
  mkdir -p "/out/$SERVER_DIR/.next"; \
  cp -a frontend/.next/static "/out/$SERVER_DIR/.next/static"; \
  [ ! -d frontend/public ] || cp -a frontend/public "/out/$SERVER_DIR/public"; \
  printf '#!/bin/sh\ncd /app/%s && exec node server.js\n' "$SERVER_DIR" > /out/start.sh; \
  chmod +x /out/start.sh

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/start.sh"]
