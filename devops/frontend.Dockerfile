# Udigity frontend (Next.js 16). Build context: repository root.
#   docker build -f devops/frontend.Dockerfile -t udigity-frontend .
#
# Uses Next "standalone" output when next.config sets `output: 'standalone'`
# (REQUEST posted on docs/implementation/coordination.md). Until then the image falls back to
# `next start` with production node_modules (larger image, same behaviour).

ARG NODE_IMAGE=node:22-alpine

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
ARG NEXT_PUBLIC_PASSWORD_MIN_LENGTH=12
ENV INTERNAL_API_URL=${INTERNAL_API_URL} \
    NEXT_PUBLIC_PASSWORD_MIN_LENGTH=${NEXT_PUBLIC_PASSWORD_MIN_LENGTH} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY frontend frontend
RUN npm run build -w frontend
# Assemble /out: standalone if available, otherwise a pruned `next start` layout.
RUN set -eu; mkdir -p /out; \
  if [ -d frontend/.next/standalone ]; then \
    cp -a frontend/.next/standalone/. /out/; \
    SERVER_DIR="$(dirname "$(cd /out && find . -name server.js -path '*frontend/server.js' -not -path '*/node_modules/*' | head -n1)")"; \
    [ "$SERVER_DIR" != "." ] || SERVER_DIR=./frontend; \
    mkdir -p "/out/$SERVER_DIR/.next"; \
    cp -a frontend/.next/static "/out/$SERVER_DIR/.next/static"; \
    [ ! -d frontend/public ] || cp -a frontend/public "/out/$SERVER_DIR/public"; \
    printf '#!/bin/sh\ncd /app/%s && exec node server.js\n' "$SERVER_DIR" > /out/start.sh; \
  else \
    npm prune --omit=dev -w frontend --include-workspace-root=false --no-audit --no-fund || true; \
    cp -a node_modules package.json /out/; \
    mkdir -p /out/frontend; \
    cp -a frontend/.next frontend/package.json frontend/next.config.mjs /out/frontend/; \
    [ ! -d frontend/public ] || cp -a frontend/public /out/frontend/public; \
    [ ! -d frontend/node_modules ] || cp -a frontend/node_modules /out/frontend/node_modules; \
    rm -rf /out/frontend/.next/cache; \
    printf '#!/bin/sh\ncd /app/frontend && exec node ../node_modules/next/dist/bin/next start -p "${PORT:-3000}" -H 0.0.0.0\n' > /out/start.sh; \
  fi; \
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
