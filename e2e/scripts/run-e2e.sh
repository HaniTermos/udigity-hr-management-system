#!/usr/bin/env bash
# End-to-end run: fresh throwaway DB -> migrate -> e2e seed -> personas -> backend + built frontend -> Playwright.
# Works in Git Bash (Windows), Linux and CI. Never reads .env files. Details: docs/implementation/qa/e2e-run.md
#
#   E2E_DB_URL=postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test_e2e bash e2e/scripts/run-e2e.sh [playwright args]
#
# Variables (all optional except E2E_DB_URL):
#   E2E_DB_URL          throwaway DB, local host, name udigity_test* (recreated on every run unless E2E_KEEP_DB=1)
#   E2E_BACKEND_PORT    default 5100        E2E_FRONTEND_PORT  default 3100
#   E2E_SKIP_BUILD=1    reuse frontend/.next from the last build (must have been built for the same backend port)
#   E2E_FRONTEND_MODE   build (default: next build + next start) | dev (next dev; slower first compile, no build step)
#   E2E_KEEP_DB=1       do not drop/seed the DB (reuse a seeded one)
#   E2E_PROJECT         Playwright project (default desktop-light); E2E_JOURNEYS defaults to 1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${E2E_DB_URL:?set E2E_DB_URL to a throwaway local udigity_test* database}"
export E2E_DB_URL
BP="${E2E_BACKEND_PORT:-5100}"; FP="${E2E_FRONTEND_PORT:-3100}"
LOG="${E2E_LOG_DIR:-${TMPDIR:-/tmp}}"; mkdir -p "$LOG"
PIDS=()

cleanup() {
  for p in "${PIDS[@]:-}"; do
    [ -n "$p" ] || continue
    if [ -r "/proc/$p/winpid" ]; then taskkill //F //T //PID "$(cat /proc/$p/winpid)" >/dev/null 2>&1 || true; fi
    kill "$p" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

# Public dev-seed values come from the seed source itself (never hard-coded here).
export E2E_PASSWORD="${E2E_PASSWORD:-$(grep -oE "bcrypt\.hash\('[^']+'" "$ROOT/backend/src/db/seed.ts" | head -1 | sed -E "s/.*\('//; s/'$//")}"
export E2E_OWNER_TOTP_SECRET="${E2E_OWNER_TOTP_SECRET:-$(grep -oE "DEV_TOTP_SECRET = '[A-Z0-9]+'" "$ROOT/backend/src/db/seed.ts" | sed -E "s/.*= '//; s/'$//")}"
export E2E_JOURNEYS="${E2E_JOURNEYS:-1}" E2E_BASE_URL="http://localhost:$FP"
[ -n "$E2E_PASSWORD" ] && [ -n "$E2E_OWNER_TOTP_SECRET" ] || { echo "could not read the seed password/TOTP secret from seed.ts" >&2; exit 2; }

wait_for() { # url seconds
  for _ in $(seq 1 "$2"); do curl -sf -o /dev/null "$1" && return 0; sleep 1; done
  echo "timeout waiting for $1" >&2; return 1
}

if [ "${E2E_KEEP_DB:-0}" != "1" ]; then
  node "$ROOT/e2e/scripts/db.mjs" reset
  (cd "$ROOT/backend" && NODE_ENV=test TEST_DATABASE_URL="$E2E_DB_URL" npx tsx src/db/migrate.ts && NODE_ENV=test TEST_DATABASE_URL="$E2E_DB_URL" npx tsx src/db/e2e-seed.ts)
fi
node "$ROOT/e2e/scripts/db.mjs" align

echo "== backend :$BP =="
(cd "$ROOT/backend" && exec env NODE_ENV=test TEST_DATABASE_URL="$E2E_DB_URL" PORT="$BP" \
  SESSION_SECRET=e2e-dummy-session-secret-0123456789abcdef APP_ORIGIN="http://localhost:$FP" AUTH_RATE_LIMIT_MAX=5000 \
  POLICY_ATTENDANCE_OFFICE_IPS="127.0.0.1,::1,::ffff:127.0.0.1" COMPANY_TIMEZONE=Asia/Beirut POLICY_COMPANY_TIMEZONE=Asia/Beirut \
  node --import tsx src/index.ts) > "$LOG/e2e-backend.log" 2>&1 &
PIDS+=("$!")
wait_for "http://localhost:$BP/healthz" 60

echo "== frontend :$FP (production build) =="
MODE="${E2E_FRONTEND_MODE:-build}"
if [ "$MODE" = "build" ] && [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  (cd "$ROOT" && INTERNAL_API_URL="http://localhost:$BP" NEXT_TELEMETRY_DISABLED=1 npm run build --workspace=frontend) > "$LOG/e2e-frontend-build.log" 2>&1 \
    || { tail -30 "$LOG/e2e-frontend-build.log"; exit 1; }
fi
NEXT_BIN="$(cd "$ROOT/frontend" && node -p "require.resolve('next/dist/bin/next')")"
(cd "$ROOT/frontend" && exec env NODE_ENV=production INTERNAL_API_URL="http://localhost:$BP" NEXT_TELEMETRY_DISABLED=1 \
  node "$NEXT_BIN" start -p "$FP") > "$LOG/e2e-frontend.log" 2>&1 &
PIDS+=("$!")
wait_for "http://localhost:$FP/login" 90

echo "== playwright =="
cd "$ROOT/e2e"
[ -d node_modules ] || npm ci --no-fund
rm -rf .auth
set +e
npx playwright test --project="${E2E_PROJECT:-desktop-light}" "$@"
RC=$?
rm -rf .auth
exit $RC
