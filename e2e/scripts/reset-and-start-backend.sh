#!/usr/bin/env bash
# Recreates the dedicated E2E database (udigity_test_e2e) in the Docker test container, migrates, seeds,
# and starts the backend on :5000 with NODE_ENV=test. Dummy values are on the command line only (no .env file).
# Usage (Git Bash, repo root):  bash e2e/scripts/reset-and-start-backend.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DBURL="postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test_e2e"

# stop a previous backend on :5000 (Windows)
PID=$(powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue).OwningProcess" | tr -d '\r' || true)
if [ -n "${PID:-}" ]; then powershell -NoProfile -Command "Stop-Process -Id $PID -Force"; sleep 2; fi

docker exec udigity-test-db dropdb -U udigity_test --if-exists --force udigity_test_e2e
docker exec udigity-test-db createdb -U udigity_test udigity_test_e2e

cd "$ROOT/backend"
export NODE_ENV=test TEST_DATABASE_URL="$DBURL"
npx tsx src/db/migrate.ts
npx tsx src/db/e2e-seed.ts

# AUTH_RATE_LIMIT_MAX is raised only so the suite's many sign-ins are not throttled (default 20 / 15 min).
SESSION_SECRET=e2e-dummy-session-secret-0123456789abcdef APP_ORIGIN=http://localhost:3000 PORT=5000 AUTH_RATE_LIMIT_MAX=5000 \
  nohup npx tsx src/index.ts > "${TMPDIR:-/tmp}/e2e-backend.log" 2>&1 &
for i in $(seq 1 40); do curl -sf http://localhost:5000/healthz >/dev/null && { echo "backend up"; exit 0; }; sleep 1; done
echo "backend did not start" >&2; exit 1
