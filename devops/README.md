# Udigity DevOps runbook

Owner of this folder: DevOps (DEV-1). Files: `docker-compose.yml` (dev helper), `docker-compose.test.yml` (test DB),
`docker-compose.prod.yml` (single-VPS production: db, backend, worker, frontend, nginx), `devops/*.Dockerfile`, `devops/nginx/`, `devops/env/*.env.example`,
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

- Multi-stage, `node:22-alpine`, runs as `node` (uid 1000), `tini` as PID 1, HEALTHCHECK built in.
- Backend: `tsc` output plus `dist/db/migrations/*.sql` (tsc does not copy SQL). Migrate with
  the compose `migrate` job (`--profile tools run --rm migrate`, owner credentials from `devops/env/migrate.env`).
- Frontend (fallback image verified 2026-10-23: 685 MB, uid 1000, /login 200): uses Next **standalone** output once `next.config.mjs` sets `output: 'standalone'` (REQUEST DEV-R3);
  until then the image falls back to `next start` with pruned node_modules. `INTERNAL_API_URL` and every
  `NEXT_PUBLIC_*` value are fixed at **build** time (build args).
- `.dockerignore` keeps `.env*`, `docs/`, `node_modules`, build output and `.git` out of the context.

## 4. Production deploy on a single VPS (do NOT run without the Owner's go-ahead)

Prerequisites: Ubuntu 24.04 LTS VPS, DNS A record for the app host, Docker Engine + Compose plugin, `age`, `ufw`.

1. **Harden the host:** SSH keys only, `ufw allow 22,80,443/tcp && ufw enable`, unattended-upgrades, a non-root
   deploy user in the `docker` group.
2. **Code:** `git clone` (or copy a release tarball) to `/opt/udigity`.
3. **Secrets:** `cd /opt/udigity/devops/env`, copy each `*.env.example` to `*.env`, fill in, `chmod 600 *.env`, then run `devops/scripts/check-env.sh`.
   - `SESSION_SECRET`: `openssl rand -hex 32`. DB password: `openssl rand -base64 32 | tr -d '/+='`
     (same value in `postgres.env` and `DATABASE_URL`).
   - `APP_ORIGIN` / `PUBLIC_APP_URL` = `https://<host>`; replace `app.example.com` in `devops/nginx/conf.d/udigity.conf`.
   - Company values that **NEED VALUE** (timezone, office IP): leave empty to start "Not configured".
4. **TLS:** first issue a certificate. Simplest: stop nothing yet, run
   `certbot certonly --standalone -d <host>` before nginx is up, then copy/symlink `fullchain.pem` and `privkey.pem`
   into `devops/nginx/certs/`. Renewal: `certbot renew --webroot -w /opt/udigity/devops/nginx/acme` plus a
   deploy hook `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`.
5. **Build and migrate:**
   ```sh
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d db   # creates the limited udigity_api role on an empty volume
   docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
   ```
   (Copy `devops/env/migrate.env.example` too: owner credentials, loaded only by `migrate`; the API/worker use the limited `udigity_api` role. See DEPLOY.md section 8.)
   Do not run the dev seed in production. Create the first Owner account with the procedure the backend team provides.
6. **Start:** `docker compose -f docker-compose.prod.yml up -d` and check `docker compose ... ps` (all `healthy`).
7. **Smoke test:** `curl -I https://<host>/login` (200, security headers present), log in as the Owner, enrol 2FA.
8. **Backups:** install the cron entry in section 5 and run one restore drill before go-live.

Stack facts: `db`, `backend`, `worker` and `frontend` sit on an `internal` network with no internet route and no published
ports; only `nginx` publishes 80/443. Backend and frontend run read-only, as uid 1000, `cap_drop: ALL`,
`no-new-privileges`. nginx overwrites `X-Forwarded-For` with the client address and the backend trusts one hop
(`TRUST_PROXY=true`), which the office-IP check (ADR-016) relies on. Logs: json-file, 10 MB x 5 per service.

Worker: the `worker` service reuses the backend image (`node dist/worker.js`, no HTTP port). Its health check calls the
API's `/health/worker` (heartbeat freshness) over the internal network. At the edge, `/healthz`, `/readyz` and
`/health/*` return 404; check them from the host with
`docker compose -f docker-compose.prod.yml exec backend node -e "fetch('http://127.0.0.1:5000/readyz').then(r=>console.log(r.status))"`.

Edge headers: nginx sends HSTS, nosniff, X-Frame-Options, Permissions-Policy, COOP and a minimal CSP
(`frame-ancestors`, `base-uri`, `form-action`, `object-src`). The nonce-based `script-src`/`style-src` policy comes from
the app (`frontend/proxy.ts`); the edge must not add `default-src`/`script-src` because browsers enforce every CSP
header. `Referrer-Policy` has one source (nginx map): `no-referrer` on `/reset-password` and `/session-ended`,
otherwise `strict-origin-when-cross-origin`; the upstream copy is hidden.

**Rate limits (nginx, outer guard).** Login, 2FA, password reset/change (`/api/auth/*`): 10/min per client IP, burst 10 (brute-force
protection, unchanged). `GET /api/auth/me` (session probe polled by every open tab) has its own zone keyed by the session
cookie, so many users behind one office NAT do not exhaust each other (10/s per session, burst 30; without a cookie it falls
back to the IP). If you rename `SESSION_COOKIE_NAME`, change the cookie name in the `map` in `devops/nginx/nginx.conf`.
Per-IP connection cap is 200 for the same reason. The backend keeps its own per-IP auth limiter (`AUTH_RATE_LIMIT_*`).

**Update:** `git pull && docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml --profile tools run --rm migrate && docker compose -f docker-compose.prod.yml up -d`.
Take a backup first. Migrations are forward-only; rollback = previous image tag + restore if a migration was involved.

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

## 6. CI (`.github/workflows/ci.yml`, not pushed)

Jobs: `secrets-scan` (gitleaks), `verify` (backend/frontend typecheck, lint, tests with a postgres:17 service on 55432,
backend and frontend build, worker output check, shell-script syntax check, blocking `npm audit --audit-level=high`) and
`docker` (build both images without pushing, worker entrypoint check, compose validation).

State on 2026-10-26: the audit gate is blocking and currently FAILS on two high advisories (body-parser < 1.20.9, fixable with
`npm audit fix`; zod < 4.6.6, needs a major bump): needs the Tech Lead. The old dev-only vitest advisory is gone, so the
`continue-on-error` audit step was removed.

Full production runbook: `devops/DEPLOY.md`. Env validation: `devops/scripts/check-env.sh` (see section 4, step 3).

## 7. Turning real email on (needs the Owner's go-ahead)

Default: no real email. `SMTP_HOST` is empty and `EMAIL_ALLOW_REAL_SEND=false`, so the worker writes one redacted log
line per message and nothing leaves the server. Password-reset links, for example, then exist only in the worker log.

Two switches are needed; this is deliberate. With `SMTP_HOST` set but `EMAIL_ALLOW_REAL_SEND` not exactly `true`, the
worker refuses to start.

1. Edit `devops/env/backend.env` on the server (never commit it):
   ```
   SMTP_HOST=smtp.your-provider.com
   SMTP_PORT=587            # 465 with SMTP_SECURE=true
   SMTP_SECURE=false
   SMTP_USER=...
   SMTP_PASS=...
   SMTP_FROM=no-reply@your-domain      # plain address
   EMAIL_ALLOW_REAL_SEND=true
   ```
   Use an authenticated sender on a domain with SPF/DKIM/DMARC set up, or mail lands in spam.
2. `docker compose -f docker-compose.prod.yml up -d --force-recreate backend worker` (the env file is read at start).
3. `docker compose -f docker-compose.prod.yml logs --tail=50 worker` should show the smtp transport and no refusal;
   trigger a password reset for a test account you own and watch the delivery status.

To go back to no-send: empty `SMTP_HOST`, set `EMAIL_ALLOW_REAL_SEND=false`, recreate `backend worker`.

## 8. Production smoke test (local, no deploy)

```sh
devops/scripts/prod-smoke.sh          # ports 18080/18443, project "udigity-smoke", temp dummy secrets + self-signed cert
```

Builds and starts `docker-compose.prod.yml` under its own compose project, then checks `/healthz`, `/readyz` and
`/health/worker` (inside, and 404 at the edge), the login page over TLS, the app's nonce CSP, a single `Referrer-Policy`
(`no-referrer` on `/reset-password`) and HSTS/nosniff. Teardown removes only that project's containers and volumes; the
`udigity-test-db` container and your real `devops/env/*.env` files are never touched. `KEEP=1` leaves the stack running.
The compose file honours `UDIGITY_ENV_DIR`, `NGINX_CERTS_DIR`, `HTTP_PORT` and `HTTPS_PORT` for this.
