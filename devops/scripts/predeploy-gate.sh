#!/usr/bin/env bash
# Pre-deploy supply-chain and quality gate (review 2026-11-04, gap 4 / V15.2). Runs the same checks as the GitHub CI "verify"
# job, locally or on the server, because CI may be unavailable (account billing) and a deploy must never depend on it.
# It REFUSES to continue (exit 1) when a blocking step fails; deploy.sh calls it before the build and again for the images.
#
#   devops/scripts/predeploy-gate.sh            code gate: install (no scripts), typecheck, lint, tests (DB tests on a throwaway
#                                               PostgreSQL container), npm audit (prod deps, high+critical), gitleaks (history + tree),
#                                               shell/compose/nginx syntax
#   devops/scripts/predeploy-gate.sh images     image gate: Trivy scan (HIGH/CRITICAL, fixable) of udigity-backend/-frontend/-backup:$UDIGITY_TAG
#                                               (build them first; deploy.sh does). If the Trivy image cannot be pulled this WARNS and passes.
#   devops/scripts/predeploy-gate.sh all        both
#
# Needs: bash, node 22 + npm, docker (throwaway postgres, gitleaks, trivy, nginx -t). Environment knobs (all optional):
#   TEST_DATABASE_URL     use this database for the DB tests instead of starting a throwaway container (must be disposable!)
#   GATE_SKIP_INSTALL=1   reuse node_modules (a fast re-run); the default is a clean `npm ci --ignore-scripts`
#   UDIGITY_TAG           image tag for the image gate (default: git short sha)
# Never prints secret values. Everything it starts is removed on exit.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
MODE="${1:-code}"
case "$MODE" in code|images|all) ;; *) echo "usage: predeploy-gate.sh [code|images|all]" >&2; exit 2 ;; esac

GITLEAKS_IMAGE="zricethezav/gitleaks:v8.21.2@sha256:0e99e8821643ea5b235718642b93bb32486af9c8162c8b8731f7cbdc951a7f46"   # same pin as ci.yml
TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:0.58.1}"          # pin; refresh with the monthly image refresh (DEPLOY.md)
PG_IMAGE="postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b"   # same pin as ci.yml
NGINX_IMAGE="nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10"

FAILS=0; WARNS=0; RESULTS=()
pass() { RESULTS+=("PASS  $1"); echo "  PASS  $1"; }
fail() { RESULTS+=("FAIL  $1"); echo "  FAIL  $1"; FAILS=$((FAILS + 1)); }
warn() { RESULTS+=("WARN  $1"); echo "  WARN  $1"; WARNS=$((WARNS + 1)); }
step() { echo; echo "== $* =="; }
run() { # label cmd...   (output is shown; a non-zero exit is a failure)
  local label="$1"; shift
  if "$@"; then pass "$label"; else fail "$label"; fi
}
have() { command -v "$1" >/dev/null 2>&1; }
docker_ok() { have docker && docker info >/dev/null 2>&1; }
winpath() { if have cygpath; then cygpath -w "$1"; else printf '%s' "$1"; fi; }   # Git Bash: native path for docker -v

PG_NAME=""; TMPD="$(mktemp -d)"
cleanup() { [ -z "$PG_NAME" ] || docker rm -f "$PG_NAME" >/dev/null 2>&1; rm -rf "$TMPD"; }
trap cleanup EXIT

code_gate() {
  if have node && have npm; then pass "node and npm are installed"; else fail "node and npm are installed"; return; fi
  if [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then pass "node >= 22"; else warn "node $(node -v) (CI and the images use 22)"; fi

  step "install (npm ci --ignore-scripts)"
  if [ "${GATE_SKIP_INSTALL:-0}" = 1 ]; then warn "install skipped (GATE_SKIP_INSTALL=1): node_modules not rebuilt from the lockfile"
  else run "npm ci --ignore-scripts" npm ci --ignore-scripts --no-fund --no-audit; fi

  step "typecheck and lint"
  run "backend typecheck" npm run typecheck --workspace=backend
  run "frontend typecheck" npm run typecheck --workspace=frontend
  run "backend lint" npm run lint --workspace=backend
  run "frontend lint" npm run lint --workspace=frontend

  step "tests (DB-backed API tests on a throwaway database)"
  local url="${TEST_DATABASE_URL:-}"
  if [ -z "$url" ]; then
    if docker_ok; then
      PG_NAME="udigity-gate-db-$$"
      if docker run -d --rm --name "$PG_NAME" -e POSTGRES_DB=udigity_test -e POSTGRES_USER=udigity_test -e POSTGRES_PASSWORD=udigity_test_throwaway \
           -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data:rw,size=512m "$PG_IMAGE" -c fsync=off -c synchronous_commit=off -c full_page_writes=off >/dev/null 2>&1; then
        local i; for i in $(seq 1 60); do docker exec "$PG_NAME" pg_isready -U udigity_test -d udigity_test >/dev/null 2>&1 && break; sleep 1; done
        local hp; hp="$(docker port "$PG_NAME" 5432/tcp | head -n1)"; hp="${hp##*:}"
        url="postgres://udigity_test:udigity_test_throwaway@127.0.0.1:${hp}/udigity_test"
        pass "throwaway postgres started on 127.0.0.1:${hp}"
      else fail "could not start the throwaway postgres container (image pulled? port free?)"; fi
    else fail "no TEST_DATABASE_URL and no usable docker: the DB-backed tests cannot run (refusing to skip them)"; fi
  else warn "using TEST_DATABASE_URL from the environment: it must be a disposable database"; fi
  if [ -n "$url" ]; then
    run "backend tests (incl. DB-backed)" env NODE_ENV=test TEST_DATABASE_URL="$url" npm run test --workspace=backend
  fi
  run "frontend tests" npm run test --workspace=frontend

  step "dependency audit (production dependencies, high and critical)"
  run "npm audit --omit=dev --audit-level=high" npm audit --omit=dev --audit-level=high

  step "secret scan (gitleaks, full history and working tree)"
  if docker_ok; then
    local mnt; mnt="$(winpath "$ROOT")"
    run "gitleaks (git history)" env MSYS_NO_PATHCONV=1 docker run --rm -v "$mnt:/repo:ro" "$GITLEAKS_IMAGE" git /repo --redact --no-banner
    # Working tree = tracked + untracked files that are not git-ignored (no node_modules/.next), copied to a temp dir.
    mkdir -p "$TMPD/tree" && git ls-files -z --cached --others --exclude-standard | tar --null -T - -cf - 2>/dev/null | tar -xf - -C "$TMPD/tree"
    run "gitleaks (working tree incl. untracked)" env MSYS_NO_PATHCONV=1 docker run --rm -v "$(winpath "$TMPD/tree"):/tree:ro" "$GITLEAKS_IMAGE" dir /tree --redact --no-banner --config /tree/.gitleaks.toml
  else fail "gitleaks needs docker (docker run $GITLEAKS_IMAGE git /repo)"; fi

  step "scripts, compose and nginx syntax"
  local f bad=0; for f in devops/scripts/*.sh devops/backup/*.sh devops/postgres/init/*.sh; do bash -n "$f" || bad=1; done
  if [ "$bad" = 0 ]; then pass "bash -n on devops scripts"; else fail "bash -n on devops scripts"; fi
  run "check-env self-test" bash devops/scripts/check-env-selftest.sh
  if docker_ok; then
    local envd="$TMPD/env"; mkdir -p "$envd"; for f in backend frontend postgres migrate backup; do cp "devops/env/$f.env.example" "$envd/$f.env"; done
    run "docker compose -f docker-compose.prod.yml config -q" env UDIGITY_TAG=gate UDIGITY_ENV_DIR="$envd" docker compose -f docker-compose.prod.yml config -q
    local nx; nx="$(winpath "$ROOT/devops/nginx")"
    run "nginx -t (edge config)" env MSYS_NO_PATHCONV=1 docker run --rm -v "$nx/nginx.conf:/etc/nginx/nginx.conf:ro" -v "$nx/conf.d:/etc/nginx/conf.d:ro" \
      --add-host backend:127.0.0.1 --add-host frontend:127.0.0.1 "$NGINX_IMAGE" nginx -t
  else warn "docker unavailable: compose config and nginx -t not run"; fi
}

image_gate() {
  if ! docker_ok; then fail "docker is required for the image scan"; return; fi
  local tag="${UDIGITY_TAG:-$(git rev-parse --short=12 HEAD 2>/dev/null || true)}" img missing=0
  for img in udigity-backend udigity-frontend udigity-backup; do
    docker image inspect "$img:$tag" >/dev/null 2>&1 || { echo "  image $img:$tag not found: build it first (deploy.sh does)"; missing=1; }
  done
  if [ "$missing" != 0 ]; then fail "images tagged $tag exist locally"; return; fi
  step "image scan (Trivy $TRIVY_IMAGE, HIGH/CRITICAL with a fix available)"
  if ! docker pull "$TRIVY_IMAGE" >/dev/null 2>&1 && ! docker image inspect "$TRIVY_IMAGE" >/dev/null 2>&1; then
    warn "Trivy image $TRIVY_IMAGE could not be pulled: image scan NOT run (re-run when the registry is reachable, or scan on another machine)"
    return
  fi
  local cache="udigity-trivy-cache" mnt; docker volume create "$cache" >/dev/null 2>&1
  mnt="$(winpath "$TMPD")"
  for img in udigity-backend udigity-frontend udigity-backup; do
    # docker save + --input: the scanner never gets the docker socket.
    docker save "$img:$tag" -o "$TMPD/$img.tar" || { fail "docker save $img:$tag"; continue; }
    run "trivy $img:$tag" env MSYS_NO_PATHCONV=1 docker run --rm -v "$mnt/$img.tar:/image.tar:ro" -v "$cache:/root/.cache/" "$TRIVY_IMAGE" \
      image --input /image.tar --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --no-progress
    rm -f "$TMPD/$img.tar"
  done
}

echo "predeploy-gate: mode=$MODE commit=$(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
case "$MODE" in code) code_gate ;; images) image_gate ;; all) code_gate; image_gate ;; esac

echo; echo "== summary =="; printf '  %s\n' "${RESULTS[@]}"
if [ "$FAILS" -gt 0 ]; then echo "GATE FAILED: $FAILS blocking failure(s), $WARNS warning(s). Do not deploy."; exit 1; fi
echo "GATE PASSED ($WARNS warning(s))."
