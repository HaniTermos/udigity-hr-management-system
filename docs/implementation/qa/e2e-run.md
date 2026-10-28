# Running the e2e suite (Playwright)

Owner: F-OPS. Suite: `e2e/` (Playwright 1.49, not a root workspace). Strategy: `test-strategy.md`; criteria: `acceptance.md`.

The suite runs against a **throwaway PostgreSQL database**, the backend (`NODE_ENV=test`) and the **production build** of the
frontend (`next build` + `next start`). It never reads `.env` files; everything comes from the shell. Never point it at a
real database: `e2e/scripts/db.mjs` refuses anything that is not a local `udigity_test*` database.

## One command

Prerequisites: Node 22, `npm ci` at the repo root and in `e2e/`, `npx playwright install chromium` (CI adds `--with-deps`),
and a PostgreSQL 17 you can create databases in. Locally that is the `udigity-test-db` container (port 55432, started with
`devops/scripts/test-db-up.sh` or `.ps1`). Do not stop or wipe it; the suite only drops and recreates its own database.

```sh
# repo root, Git Bash / Linux / CI
E2E_DB_URL=postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test_e2e \
  bash e2e/scripts/run-e2e.sh
```

What it does, in order:

1. `e2e/scripts/db.mjs reset`: drops and recreates the database named in `E2E_DB_URL`.
2. Migrates and runs `backend/src/db/e2e-seed.ts` (6 employees, 7 businesses, 2 deals, a project, an attendance session).
3. `e2e/scripts/db.mjs align`: renames the seed Owner (`udigity@gmail.com`) to the persona `rana.haddad@udigity.demo` /
   "Rana Haddad" (idempotent; a no-op once the seed itself creates the persona, see REQUEST to F-BE in `coordination.md`).
4. Starts the backend on `:5100` (`AUTH_RATE_LIMIT_MAX=5000` so the many sign-ins are not throttled).
5. `next build` with `INTERNAL_API_URL=http://localhost:5100`, then `next start` on `:3100`.
6. Reads the **public dev-seed** password and TOTP secret from `backend/src/db/seed.ts` (they are test values, valid only
   for the seed), exports `E2E_PASSWORD` / `E2E_OWNER_TOTP_SECRET`, and runs `playwright test --project=desktop-light`
   with `E2E_JOURNEYS=1`.
7. Stops both servers and deletes `e2e/.auth`.

Pass Playwright arguments through, e.g. `bash e2e/scripts/run-e2e.sh tests/smoke` or `-g "check in"`.

| Variable | Default | Meaning |
|---|---|---|
| `E2E_DB_URL` | none (required) | throwaway DB, local host, name `udigity_test*` |
| `E2E_BACKEND_PORT` / `E2E_FRONTEND_PORT` | 5100 / 3100 | change if a dev stack uses them (dev compose binds 5000/3000) |
| `E2E_FRONTEND_MODE` | `build` | `dev` uses `next dev` (no build, slower first compile) |
| `E2E_SKIP_BUILD=1` | off | reuse `frontend/.next` |
| `E2E_KEEP_DB=1` | off | reuse an already seeded DB |
| `E2E_PROJECT` | `desktop-light` | also `desktop-dark`, `mobile-light` |
| `E2E_LOG_DIR` | `$TMPDIR` | backend/frontend logs (`e2e-backend.log`, `e2e-frontend.log`, `e2e-frontend-build.log`) |

## Manual steps (what the script automates)

```sh
export E2E_DB_URL=postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test_e2e
node e2e/scripts/db.mjs reset
(cd backend && NODE_ENV=test TEST_DATABASE_URL=$E2E_DB_URL npx tsx src/db/migrate.ts \
            && NODE_ENV=test TEST_DATABASE_URL=$E2E_DB_URL npx tsx src/db/e2e-seed.ts)
node e2e/scripts/db.mjs align
(cd backend && NODE_ENV=test TEST_DATABASE_URL=$E2E_DB_URL PORT=5100 SESSION_SECRET=e2e-dummy-session-secret-0123456789abcdef \
   APP_ORIGIN=http://localhost:3100 AUTH_RATE_LIMIT_MAX=5000 COMPANY_TIMEZONE=Asia/Beirut POLICY_ATTENDANCE_OFFICE_IPS=127.0.0.1,::1,::ffff:127.0.0.1 node --import tsx src/index.ts) &
INTERNAL_API_URL=http://localhost:5100 npm run build --workspace=frontend
(cd frontend && INTERNAL_API_URL=http://localhost:5100 npx next start -p 3100) &
cd e2e && E2E_BASE_URL=http://localhost:3100 E2E_JOURNEYS=1 E2E_PASSWORD=<seed password> \
  E2E_OWNER_TOTP_SECRET=<DEV_TOTP_SECRET> npx playwright test --project=desktop-light
```

## Notes

- **Owner TOTP replay:** a TOTP code can be used once. Re-running the suite inside the same 30-second window can fail
  global-setup with a replay error; wait 30 s and run again.
- **Parallel agents:** use a different `E2E_DB_URL` database name and different ports per run.
- **CI:** the `e2e` job in `.github/workflows/ci.yml` runs the same script against a postgres:17 service and uploads
  `e2e/playwright-report`, `e2e/test-results` and the server logs. The `prod-smoke` job runs `devops/scripts/prod-smoke.sh`.
- **Reports:** `e2e/playwright-report` (HTML) and `e2e/test-results/junit.xml`. `npx playwright show-report` opens it.
- The mobile and dark projects are not part of the default run.

## Results log

See the section "Run log" below; add one row per recorded run.

### Run log

| Date | DB | Project | Result | Notes |
|---|---|---|---|---|
| 2026-10-28 (run 1) | `udigity_test_fx_ops` | desktop-light | 60 passed, 5 failed, 1 skipped, 4 not run (5.2 min) | Stale selectors: attendance monitor (first text match was a hidden `<option>`), settings (`attendance.shiftStart` key text), login empty-submit (message is now "Enter your password."), reports export (now a step-up code dialog). Check-in failed: see QA-BUG below. The axe `label-content-name-mismatch` failures from review 07 no longer occur. |
| 2026-10-28 (run 2, after fixing selectors and giving the e2e backend an office IP) | `udigity_test_fx_ops` | desktop-light | 68 passed, 1 failed, 1 skipped (4.1 min) | Remaining failure: sign-out test used the old "Account menu" label (header button is now named after the user). Fixed; re-run of that test: 1 passed. Net: 69 passed, 0 failed, 1 skipped (the navy check that only runs in `desktop-dark`). |

The e2e backend gets `POLICY_ATTENDANCE_OFFICE_IPS=127.0.0.1,::1,::ffff:127.0.0.1` and `COMPANY_TIMEZONE=Asia/Beirut` from `run-e2e.sh`.
Without an office IP the API (correctly) refuses check-in with `409 STATE_CONFLICT / POLICY_NOT_CONFIGURED`.

App bugs found (posted on the board as `[QA-BUG]`): check-in refused with `POLICY_NOT_CONFIGURED` is shown as "Open session from an earlier day".
Mobile and dark projects were not run.
