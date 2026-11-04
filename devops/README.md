# Udigity DevOps runbook

Owner of this folder: DevOps (DEV-1). Files: `docker-compose.yml` (dev helper), `docker-compose.test.yml` (test DB),
`docker-compose.prod.yml` (production behind the server's existing proxy: db, backend, worker, frontend, nginx on 127.0.0.1:8080, backup), `devops/*.Dockerfile`, `devops/nginx/`, `devops/env/*.env.example`,
`devops/backup/`, `.github/workflows/ci.yml`.

Hard rules: never commit or print real `.env` / `devops/env/*.env` files; never touch the local PostgreSQL 17
Windows service (port 5432); no deploy, no push, no real email without the Owner's go-ahead.

---

## 1. Local development

```sh
npm ci                     # repo root (npm workspaces: backend, frontend)
npm run dev                # backend :5000 + frontend :3000 (Next rewrites /api -> :5000)
```

The backend reads `backend/.env` in development (you create it yourself; see `devops/env/backend.env.example`
for every key). Use `NODE_ENV=development`. **An unset NODE_ENV is treated as production** (strict mode:
`SESSION_SECRET` >= 32 chars, DB config and `APP_ORIGIN` required).

Optional dev DB container (instead of a local PostgreSQL): `docker compose --profile devdb up -d --wait`
-> `postgres://udigity_dev:udigity_dev_local_only@127.0.0.1:55433/udigity_dev`.

## 2. Test database (isolated, port 55432)

```sh
# start (idempotent) and wait for healthy
docker compose -f docker-compose.test.yml up -d --wait     # or devops/scripts/test-db-up.ps1 / test-db-up.sh

# run the whole backend suite, incl. the DB-backed API tests (globalSetup migrates + seeds)
cd backend
NODE_ENV=test TEST_DATABASE_URL=postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test npm test
```

PowerShell:

```powershell
$env:NODE_ENV='test'; $env:TEST_DATABASE_URL='postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test'
npm test --workspace=backend
Remove-Item Env:TEST_DATABASE_URL, Env:NODE_ENV
```

Migrations only: same environment, `npm run migrate` in `backend/`. With `NODE_ENV=test` the config honours **only**
`TEST_DATABASE_URL` and never loads `backend/.env`, so a test run cannot reach the dev DB.

- Container `udigity-test-db`, `postgres:17-alpine`, bound to `127.0.0.1:55432`, data on **tmpfs**.
- The password is a throwaway value that lives only in `docker-compose.test.yml` and CI.
- **Shared during the build:** it also holds `udigity_test_be1..be5` and `udigity_test_tl` for other agents. Do not
  run `down` while they are working; create your own database instead
  (`docker exec udigity-test-db createdb -U udigity_test udigity_test_<you>`).
- Reset (only when nobody else is using it): `docker compose -f docker-compose.test.yml down` (or `test-db-down.*`) then `up` again: empty DB.
- Verified 2026-10-23: migrations 001-002 applied; `npm test` 58/58 passed (5 files), incl. the 6 DB tests.

## 3. Production images

```sh
docker build -f devops/backend.Dockerfile  -t udigity-backend  .
docker build -f devops/frontend.Dockerfile -t udigity-frontend .
```

- Multi-stage, base images pinned by digest (`node:22-alpine@sha256:...`, `postgres:17-alpine@sha256:...`, `nginx:1.27-alpine@sha256:...`;
  refresh monthly with `docker buildx imagetools inspect <tag>`), runs as `node` (uid 1000), `tini` as PID 1, HEALTHCHECK built in.
- Backend: `tsc` output plus `dist/db/migrations/*.sql` (tsc does not copy SQL). Migrate with
  the compose `migrate` job (`--profile tools run --rm migrate`, credentials of the NON-superuser schema owner `udigity_owner` from
  `devops/env/migrate.env`; the bootstrap superuser `udigity_admin` is used by nothing but the init scripts and admin shells).
- Supply chain: `npm ci --ignore-scripts` in every Dockerfile (no production dependency has an install script); `tmpfs` mounts are
  `noexec,nosuid,nodev`; `db` and `nginx` run with `cap_drop: [ALL]` plus the minimum, a read-only root FS and `no-new-privileges`.
  Before each deploy `devops/scripts/predeploy-gate.sh` (typecheck, lint, tests, npm audit, gitleaks, Trivy) must pass (`DEPLOY.md` 14).
  `.github/dependabot.yml` opens weekly grouped update PRs (14-day cooldown).
- Frontend: Next **standalone** output (`output: 'standalone'`); the build fails if it is missing. `INTERNAL_API_URL` and every
  `NEXT_PUBLIC_*` value are fixed at **build** time (build args from `/opt/udigity/.env`; values in `frontend.env` do not reach the browser).
- `.dockerignore` keeps `.env*`, `docs/`, `node_modules`, build output and `.git` out of the context.

## 4. Production deploy (do NOT run without the Owner's go-ahead)

The target is the Hostinger VPS that already serves other sites, public origin `https://hrsystem.udigity.com` (S-28). The stack
publishes only `127.0.0.1:8080`; the server's existing proxy (nginx, Apache, OpenLiteSpeed, Caddy) holds the certificate, redirects
to https and forwards to it. **The full, current procedure is `devops/DEPLOY.md`** (outer-proxy vhost templates in `devops/proxy/`,
env files, `devops/scripts/deploy.sh`, rollback, monitoring) and the checklist `docs/review/2026-11-04/DEPLOYMENT-CHECKLIST.md`.
Short form:

1. Inspect the server (what owns 80/443, free RAM/disk, unused 172.29.10-30.0/24), change no existing firewall/SSH/proxy setting.
2. Code in `/opt/udigity`; `cp devops/env/compose.env.example .env`; copy the five `*.env.example` files, fill in, `chmod 600`,
   `devops/scripts/check-env.sh` must print PASSED (`TRUSTED_PROXY_CIDRS=172.29.10.10/32`, origin `https://hrsystem.udigity.com`).
3. Add the `hrsystem.udigity.com` vhost to the existing proxy and issue its certificate with that proxy's own tool (never `--standalone`).
4. `devops/scripts/deploy.sh` (backup, build, migrate, start, records `UDIGITY_TAG` in `.env`); `deploy.sh rollback` for the previous tag.
5. Smoke: `curl -I https://hrsystem.udigity.com/login`; log in as the Owner, enrol 2FA. Install the monitoring of DEPLOY.md section 13.

Stack facts: `db`, `backend`, `worker` and `frontend` sit on an `internal` network (pinned 172.29.10.0/24) with no internet route and no
published ports; only `nginx` publishes a port, on `127.0.0.1:8080`. Backend and frontend run read-only, as uid 1000, `cap_drop: ALL`,
`no-new-privileges`, with memory/CPU caps and a `stop_grace_period` per service. nginx learns the visitor address from the host proxy
(`set_real_ip_from` 127.0.0.1 and 172.16.0.0/12, `real_ip_header X-Forwarded-For`, recursive), then overwrites `X-Forwarded-For` with it;
the backend trusts exactly that one hop (`TRUSTED_PROXY_CIDRS=172.29.10.10/32`), which the office-IP check (ADR-016) relies on. Logs:
json-file, 10 MB x 5 per service; the nginx access log blanks `token=` values.

Worker: the `worker` service reuses the backend image (`node dist/worker.js`, no HTTP port). Its health check calls the
API's `/health/worker` (heartbeat freshness) over the internal network. At the edge, `/healthz`, `/readyz` and
`/health/*` return 404; check them from the host with
`docker compose -f docker-compose.prod.yml exec backend node -e "fetch('http://127.0.0.1:5000/readyz').then(r=>console.log(r.status))"`.

Edge headers: nginx sends HSTS, nosniff, X-Frame-Options, Permissions-Policy, COOP and a minimal CSP
(`frame-ancestors`, `base-uri`, `form-action`, `object-src`). The nonce-based `script-src`/`style-src` policy comes from
the app (`frontend/proxy.ts`); the edge must not add `default-src`/`script-src` because browsers enforce every CSP
header. `Referrer-Policy` has one source (nginx map): `no-referrer` on `/reset-password` and `/session-ended`,
otherwise `strict-origin-when-cross-origin`; the upstream copy is hidden.

**Rate limits (nginx, outer flood guard; the backend limiters are primary).** The whole office shares one client IP, so every number is
sized for ~60 people, not one. Credential endpoints (`/api/auth/` login, 2FA verify/recover/enrol, password reset/change): 60/min per IP,
burst 40. Everything else under `/api/auth/` (me, logout, 2fa/status, sessions): 10/s per session cookie, burst 30 (falls back to the IP
without a cookie). Other `/api/`: 8/s per session, burst 60, plus a 150/s per-IP safety net (a client can forge a cookie value to get a
fresh session bucket). Pages: 100/s per IP, burst 200; `/_next/static/` is not limited. Per-IP connection cap 200. If you rename
`SESSION_COOKIE_NAME`, change the cookie name in the `map` in `devops/nginx/nginx.conf`. The backend keeps its own per-account and
per-session limits (`AUTH_RATE_LIMIT_*`, lockout).

**Update:** `git pull && devops/scripts/deploy.sh` (it takes a backup first and records the tag). Rollback and the migration caveat:
DEPLOY.md section 12.

## 5. Backups (policy D19: nightly dump + WAL archiving, RPO 15 min / RTO 4 h objectives, 14/8/6 retention)

The `backup` service in `docker-compose.prod.yml` does it all: nightly encrypted `pg_dump` at `BACKUP_TIME` (`TZ`),
weekly encrypted base backup, WAL archived by `db` at least every 15 min and encrypted by `backup` within a minute,
failures written to `ops_alerts` (emailed by the worker). Stored in the `backups` volume on the same server
(Owner-approved exception, 2026-10-29: losing the server loses the backups too).

```sh
cp devops/env/backup.env.example devops/env/backup.env && chmod 600 devops/env/backup.env   # AGE_RECIPIENT, BACKUP_DB_PASSWORD, TZ
docker compose -f docker-compose.prod.yml exec backup backupd nightly                       # dump now
AGE_IDENTITY=~/keys/udigity-backup.agekey devops/backup/restore-drill.sh backups/daily/udigity-<stamp>.dump.age
AGE_IDENTITY=~/keys/udigity-backup.agekey devops/backup/restore-drill.sh pitr backups/base/base-<stamp>.tar.gz.age backups/wal
```

Layout, keys and alerts: `devops/backup/README.md`. Setup, drills, real restore (dump or point in time) and the drill
log: `devops/DEPLOY.md` section 11. On Git Bash for Windows run the drill with `MSYS_NO_PATHCONV=1`.

## 6. CI (`.github/workflows/ci.yml`; free-plan gating, actions pinned to commit SHAs)

Jobs: `secrets-scan` (gitleaks), `verify` (backend/frontend typecheck, lint, tests with a postgres:17 service on 55432,
backend and frontend build, worker output check, shell-script syntax check, blocking `npm audit --audit-level=high`) and
`docker` (build both images without pushing, worker entrypoint check, compose validation).

The audit gate is blocking (`npm audit --audit-level=high`). `prod-smoke.sh` (heavy jobs only) also starts the `backup` service with a
throwaway age key and checks the dump, base backup, WAL encryption and checksums, the real-client-IP handling, the token redaction and
the nginx rate-limit zones. Shell scripts get `bash -n` and `shellcheck --severity=error`.

Full production runbook: `devops/DEPLOY.md`. Env validation: `devops/scripts/check-env.sh` (see section 4, step 3).

## 7. Turning real email on (needs the Owner's go-ahead)

Default: no real email. `SMTP_HOST` is empty and `EMAIL_ALLOW_REAL_SEND=false`, so the worker writes one redacted log
line per message and nothing leaves the server. Password-reset links, for example, then exist only in the worker log.

Two switches are needed; this is deliberate. With `SMTP_HOST` set but `EMAIL_ALLOW_REAL_SEND` not exactly `true`, the
worker refuses to start.

1. Edit `devops/env/backend.env` on the server (never commit it):
   ```
   SMTP_HOST=<provider SMTP host>
   SMTP_PORT=587            # 465 with SMTP_SECURE=true
   SMTP_SECURE=false
   SMTP_USER=...
   SMTP_PASS=...
   SMTP_FROM=<sender address>           # plain address
   EMAIL_ALLOW_REAL_SEND=true
   ```
   Use an authenticated sender on a domain with SPF/DKIM/DMARC set up, or mail lands in spam.
2. `docker compose -f docker-compose.prod.yml up -d --force-recreate backend worker` (the env file is read at start).
3. `docker compose -f docker-compose.prod.yml logs --tail=50 worker` should show the smtp transport and no refusal;
   trigger a password reset for a test account you own and watch the delivery status.

To go back to no-send: empty `SMTP_HOST`, set `EMAIL_ALLOW_REAL_SEND=false`, recreate `backend worker`.

## 8. Production smoke test (local, no deploy)

```sh
devops/scripts/prod-smoke.sh          # loopback port 18080, project "udigity-smoke", own subnets 172.29.110-130.0/24, dummy secrets
```

Builds and starts `docker-compose.prod.yml` under its own compose project and talks to the bundled nginx the way the host proxy does
(plain HTTP, `Host: hrsystem.udigity.com`, `X-Forwarded-For`). Checks `/healthz`, `/readyz` and `/health/worker` (inside, and 404 at the
edge), unknown Host gets no answer, the visitor address reaches nginx (Linux only), `?token=` is redacted in the access log, logout is
not throttled, the app's nonce CSP, a single `Referrer-Policy`, HSTS/nosniff, and the backup service (dump, base backup, encrypted WAL,
checksum, growth guards). Teardown removes only that project's containers and volumes. `KEEP=1` leaves the stack running.
The compose file honours `UDIGITY_ENV_DIR`, `HTTP_PORT`, `UDIGITY_SUBNET_*` and `NGINX_INTERNAL_IP` for this.
