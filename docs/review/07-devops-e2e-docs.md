# Review 07: devops, CI, e2e, docs (Reviewer 7, 2026-10-28)

Read-only review. Nothing was edited except this file. No `.env*` file was opened. The `udigity-test-db` container was not stopped; I dropped and recreated only the throwaway database `udigity_test_e2e`.

## Findings

| ID | Sev | File:line | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| R7-01 | P1 | `e2e/global-setup.ts:16`, `e2e/fixtures/personas.ts:17`, `backend/src/db/e2e-seed.ts` | The seed creates the Owner as `udigity@gmail.com` ("Udigity Admin"). e2e expects `rana.haddad@udigity.demo` ("Rana Haddad"). The login gets a 401 and the **whole suite aborts in global-setup** (all 70 tests). | The e2e suite cannot run out of the box. Persona names in the assertions will also mismatch. | Make the e2e seed or personas agree: add an env override (`E2E_OWNER_EMAIL`), or have e2e-seed rename the Owner. |
| R7-02 | P1 | `docker-compose.prod.yml` (`networks.internal: internal: true`) | The worker is on an `internal: true` network only, so it has **no outbound route**. Real SMTP (DEPLOY section 10) cannot work, nor can any off-host call. Only nginx is on `public`. | Email go-live will fail silently, with outbox retries piling up. | Put the worker on a second, non-internal egress network, or document that SMTP needs one. |
| R7-03 | P1 | `docs/implementation/production-readiness-and-handover-report.md` (whole file) | **The report is unchanged since the 2026-10-26 verification and is still inaccurate.** See the table below. | Anyone using it to deploy would set wrong env keys, apply a CSP that breaks the app, and run scripts that don't exist. | Replace it with an accurate one, or add a "SUPERSEDED, see verification-2026-10-26.md + devops/DEPLOY.md" banner at the top. |
| R7-04 | P1 | `.github/workflows/ci.yml` | CI runs typecheck, lint, tests, build, audit, gitleaks and Docker builds. It does **not** run: Playwright e2e, `check-env.sh`, `prod-smoke.sh`, or a restore-drill check. The `e2e/` workspace is not installed (it is not a root workspace). | The suite that found R7-01, R7-05, R7-06 and R7-08 never runs. The backend lint step currently fails (baseline: eslint config does not load), so the `verify` job is red. | Add an e2e job (postgres service, seed, backend and `next start`, Playwright). Run `check-env.sh` against the example files. Fix the lint config. |
| R7-05 | P2 | `e2e/tests/journeys/owner.spec.ts:78` | The settings journey looks for the literal key `attendance.shiftStart`. The current Settings page does not render it. It fails. | Stale selector. | Use the visible label text. |
| R7-06 | P2 | `e2e/tests/journeys/owner.spec.ts:54` | `getByText('Karim Saleh').first()` resolves to a hidden `<option>` in a filter select, not the row. | A flaky or false failure. | Scope to the table: `getByRole('row', ...)`. |
| R7-07 | P2 | `e2e/tests/smoke/login.spec.ts:28` | The test expects the inline error "Password is required". It is not shown. | Either the UI or the test is stale. | Reconcile with the login screen spec. |
| R7-08 | P2 | App shell (seen by `a11y-theme.spec.ts`) | The axe rule `label-content-name-mismatch` (serious) fires on **every page**, for example `/deals`, `/projects`. The nodes are `.group` and `.p-1`, probably the sidebar links or the user menu. | A real WCAG 2.5.3 defect in the shared shell, and it fails about 34 a11y tests. | Make the `aria-label` contain the visible text, or remove it. |
| R7-09 | P2 | `shared.spec.ts:18` | After "Check in" the test expects the text `Checked in`. It does not appear. In the full run the check-in journey also failed. | A stale label, or the check-in flow changed. | Update the selector. |
| R7-10 | P2 | `devops/nginx/conf.d/udigity.conf:13` | `server_name app.example.com` is hard-coded. TLS cert paths are fixed. `check-env.sh` does not check that the nginx file was edited. | A deploy without the edit serves under the wrong name, and certbot will not match it. | Template it (envsubst), or have `check-env.sh` fail on `example.com` in the nginx conf. |
| R7-11 | P2 | `devops/env/backend.env.example` vs `backend/src/config/index.ts:237,266,268` | Keys the code reads but the example does not list: `SESSION_MAX_AGE_HOURS` (alias), `PASSWORD_BCRYPT_ROUNDS`, `RECOVERY_CODE_BCRYPT_ROUNDS`, `COMPANY_TIMEZONE`, `OFFICE_IP_ALLOWLIST`, `ATTENDANCE_OFFICE_MODE`, `EMAIL_FROM` (the aliases are described in a comment). `check-env.sh` would warn "unknown key" if someone sets the bcrypt keys. | Minor. The two `BCRYPT_ROUNDS` keys are real, tunable settings. | Add them (commented) to the example and to `check_unknown`. |
| R7-12 | P2 | `docker-compose.prod.yml` (`backup` env) | `pg-backup.sh` calls `docker compose -f $COMPOSE_FILE exec`. A custom `UDIGITY_ENV_DIR` is not passed, so compose fails on a missing env_file in cron. | A backup cron failure if the env dir is not the default. | Export `UDIGITY_ENV_DIR` in `backup.env`. |
| R7-13 | P3 | `e2e/_probe2.mjs:6,8` | A leftover debug script with the public seed password `Password123!` hard-coded and a hard-coded port 3000. `e2e/` is untracked (`??`). | No real secret, since this is the public dev seed password. It is clutter and a bad pattern. | Delete it. |
| R7-14 | P3 | `e2e/global-setup.ts:22`, `playwright.config.ts` | They point to `docs/implementation/qa/e2e-run.md`, **which does not exist**. | The documented run recipe is missing. The baseline task also refers to it. | Create it. The working recipe is in the "e2e run" section below. |
| R7-15 | P3 | `e2e/scripts/reset-and-start-backend.sh` | It hard-codes port 5000, but `docker-compose.yml` (dev) already binds `127.0.0.1:5000` (`udigity-backend`). It also uses PowerShell to kill the owner of port 5000, which could kill the dev container proxy. | Conflicts with the dev stack. | Take the port from an env var. |
| R7-16 | P3 | `global-setup.ts:40` | The owner step waits 5 s for `/` after 2FA verify. Under `next dev` this failed once (first-compile latency). A TOTP step can only be used once, so re-runs inside 30 s fail with a replay error. | Flaky, with a confusing error. | Raise the timeout and wait 30 s before a retry. |
| R7-17 | P3 | `devops/backend.Dockerfile` | `COPY --from=prod-deps /app/backend/node_modules* ./backend/node_modules/` relies on glob semantics that fail if the dir is absent on some builders. The Docker build was **not run** here. | A possible build break. CI's `docker` job would catch it. | Verify in CI. |
| R7-18 | P3 | `.dockerignore` | `docker-compose*.yml` and `devops/backup` are excluded (fine). `skills-lock.json` is irrelevant to the images. | None. | None. |
| R7-19 | P3 | `skills-lock.json` | It lists AI-agent skills (hashes only), unrelated to the app. No secrets. | Housekeeping. | Keep or ignore. |

## Handover report: inaccurate claims still present

These were already listed in `verification-2026-10-26.md` and are **not corrected in the report**:

- Argon2id and device fingerprinting (the code uses bcryptjs).
- Dedupe by tax ID.
- The 15-day rule ("unassigned, public pool").
- "Optimistic locks" for reservations (they are leases with a heartbeat).
- Task statuses `todo / in_progress / done`.
- Env names: `FRONTEND_URL`, `API_URL`, `TOKEN_ENCRYPTION_KEY`, `COOKIE_SECRET`, `OFFICE_CIDR_WHITELIST`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `DATABASE_SSL` and `PORT=4000`.
- `npm run migrate:prod` and `devops/scripts/verify-restore.sh` do not exist. The real ones are `npm run migrate` / `node dist/db/migrate.js` and `devops/backup/restore-drill.sh`.
- Postgres 16+ (the stack uses 17).
- The CSP `script-src 'self'` would break the nonce CSP.
- The HSTS value differs from nginx's (`max-age=31536000` without `preload`).
- "26/26 tests passing" (the baseline is 943/958 today).
- "Production Ready" and "all screens function against the real backend" are not demonstrated.
- The policy table: DEC-026, DEC-008, ADR-010 and "Approved" are wrong. Nothing but "Accepted keeps reservation" is approved.
- The service name `email-worker` (real: `worker`) and `postgres` (real: `db`).
- Handover summary: "You may now commit and begin staging deployment" while CI lint is red and the baseline has 15 failing tests.

`verification-2026-10-26.md` itself is stale in the other direction: it says 856/860 backend tests, lint with 3 errors, and 34 pages. The baseline today is 943/958, 9 frontend lint errors and 36 pages. Its V-01 (the password/change guard) was not re-checked here.

## What checked out

- **Dockerfiles:**
  - They are multi-stage and run as the non-root `node` user.
  - tini is the init process, and there are health checks.
  - No secrets are baked in. The only build args are non-secret `INTERNAL_API_URL` and `NEXT_PUBLIC_PASSWORD_MIN_LENGTH`.
- **Prod compose:** services `db`, `backend`, `worker`, `frontend` and `nginx`. The db has no published port. Containers are `read_only`, with `cap_drop ALL` and `no-new-privileges`. Health checks and `depends_on: service_healthy` are wired in order, and the log rotation and `pgdata` volume are present.
- **nginx:**
  - `/api` goes to the backend, and the rest goes to the frontend.
  - `/healthz`, `/readyz` and `/health/*` return 404 at the edge, and `/nginx-health` is on port 80 only.
  - X-Forwarded-For is overwritten, which prevents spoofing.
  - Security headers are present; the single Referrer-Policy is set via a map.
  - The CSP is correctly left to the Next proxy, which exists at `frontend/src/proxy.ts`.
  - Rate limits: `auth` is 10/min, `api` is 20/s.
- **Backup and restore:** the dump is piped straight into the encryption (age or gpg) with no plaintext on disk. There is sha256, a retention prune, and a throwaway-container restore drill. The scripts parse (`bash -n` is in CI).
- **Env examples and check-env.sh:** everything the code reads under `process.env` or `env.*` is documented, except R7-11. The frontend keys `INTERNAL_API_URL`, `SESSION_COOKIE_NAME`, `NEXT_PUBLIC_CSRF_COOKIE_NAME`, `NEXT_PUBLIC_PASSWORD_MIN_LENGTH` and `NEXT_PUBLIC_ENABLE_DEV_PERSONAS` are all present. `NEXT_PUBLIC_DEV_SEED_PASSWORD` is read by the frontend but is **not** in `frontend.env.example`. This is a dev-only value, so it is a low issue.
- **Secrets:** no tracked `.env`, `.pem`, `.key` or `.dump` files; the grep for AWS, GitHub, Slack, Stripe and private-key patterns is clean. `.gitignore` covers `.env*`, `node_modules`, `.next`, `dist`, `*.pem`, `*.key`, test results and dumps. `.dockerignore` excludes them as well.
- **DEPLOY.md and README.md:** every `npm run ...`, `devops/...` and `docs/...` path they cite exists. No stale commands were found.
- **Root `package.json`:** workspaces `backend` and `frontend`. The root `test` script runs only the backend tests, so the frontend tests run only via CI's separate step.

## e2e run (Playwright 1.49, `desktop-light` project only)

Setup, used instead of `reset-and-start-backend.sh` to avoid colliding with the dev containers on :3000 and :5000:

- Dropped and recreated `udigity_test_e2e` on `postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432`.
- Ran migrate (31 migrations applied) and `e2e-seed.ts`.
- Started the backend with `tsx src/index.ts` on :5100 (`NODE_ENV=test`), and `next dev -p 3100` with `INTERNAL_API_URL=http://localhost:5100`.
- Ran `E2E_BASE_URL=http://localhost:3100 E2E_PASSWORD=<seed pw> E2E_OWNER_TOTP_SECRET=<public seed secret> E2E_JOURNEYS=1 npx playwright test --project=desktop-light`.

Results:

- **As shipped:** global-setup fails (Owner login 401, R7-01). Zero tests run.
- **After I renamed the Owner's email in the throwaway DB to `rana.haddad@udigity.demo`:** **70 tests: 20 passed, 42 failed, 1 skipped, 7 did not run** (7.6 min).
  - 34 failures are axe `label-content-name-mismatch` (R7-08): the a11y tests across all roles.
  - The other 8 are:
    - the call center "Accepted keep reservation" journey
    - the data entry "create a business" journey
    - the owner attendance monitor
    - the owner reports export
    - the owner settings page
    - the shared check-in
    - the login empty-submit
    - the login forgot-password
  - Re-run in isolation (3 retries), **callcenter, dataentry and forgot-password then passed.** These are timing flakes under `next dev` (5 s `expect` timeout, first-compile latency). The attendance monitor, settings, check-in and empty-submit failures reproduced (R7-05 to R7-09).
- The servers I started were stopped, and `e2e/.auth` and the temporary logs were deleted. `e2e/test-results` is git-ignored.
- Mobile and dark projects were **not** run.
