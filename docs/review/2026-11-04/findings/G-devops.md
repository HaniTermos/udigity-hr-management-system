# Agent G — DevOps, deployment and recovery (discovery only)

Tested revision: local `cab5ec9` + uncommitted Owner files (no devops file is modified). Method: static review of
`devops/**`, `docker-compose*.yml`, `.github/workflows/ci.yml`, `.dockerignore`, `.gitattributes`, `.gitleaks.toml`, plus
`docker compose -f docker-compose.prod.yml config -q` with the example env files (PASSED, exit 0) and
`check-env-selftest.sh` (see "Commands run"). No image built, no container started or touched. The Hostinger server was
not accessible; everything about it is marked "to inspect on the server".

Severity count: Critical 0 · High 2 · Medium 9 · Low 8 (19 findings). Blockers for a shared-server deploy: G-01, G-02.

## Commands run

| Command | Result |
|---|---|
| `docker compose -f docker-compose.prod.yml config -q` (env examples copied to the scratchpad dir `agent-g\`, `UDIGITY_ENV_DIR` set) | exit 0, compose file is syntactically valid |
| `bash devops/scripts/check-env-selftest.sh` | all checks seen so far `ok` (valid set passes, examples rejected, owner-role DATABASE_URL rejected, password mismatch rejected...). Very slow on Windows Git Bash (each check spawns node/openssl); see the final line in the report message for the end result |
| `shellcheck`, `hadolint` | not installed here; manual review only (CI does only `bash -n`, see G-12) |
| grep for `hrsystem`, `localhost`, `example.com`, `your-domain` | table in G-03 |

## What is already good (kept short)

Multi-stage images, non-root (`node` uid 1000, backup `postgres`), `tini` PID 1, read-only root FS + tmpfs `/tmp`, `cap_drop: ALL`,
`no-new-privileges` on every app service; DB has no published port; `internal: true` network for db/backend/frontend; separate
egress network only for the worker (SMTP); owner credentials only in `migrate.env`, runtime role checked at start-up
(`assertRuntimeRole`) and `/readyz`; `.dockerignore` keeps `.env*`, `docs`, `.git`, `node_modules` out; `tsconfig.build.json`
excludes tests from `dist`; json-file log rotation 10 MB x 5; `.gitattributes` forces LF on `.sh`/Dockerfiles; frontend image uses
Next standalone (`output: 'standalone'` is set and `frontend/.next/standalone/frontend/server.js` exists locally, so the
"`next start` with standalone" warning comes from `npm start` in e2e/dev, not from the image: the Dockerfile runs
`node server.js` via `start.sh` when the standalone dir exists); health endpoints hidden at the edge (404);
backups: age public key only on the server, `umask 077`, atomic `.partial` rename, checksums, alerts, tested drills (local) in the DEPLOY drill log.

---

## G-01 · High · Blocker (shared Hostinger server) · Confirmed (static)

**Requirement / role:** deployment on the approved host (K-1), Owner/operator.
**Location:** `docker-compose.prod.yml` (nginx `ports: 80/443`), `devops/nginx/conf.d/udigity.conf`, `devops/DEPLOY.md` §2 and §6, `devops/README.md` §4.
**Preconditions:** the Hostinger server already runs (or reserves) a web server for `udigity.com` or other sites; hosting plan unknown.
**Problem:** the whole deployment assumes the stack owns ports 80 and 443 on a dedicated Ubuntu VPS:
`nginx` publishes `0.0.0.0:80/443`; the first certificate is requested with `certbot --standalone` (needs port 80 free) and renewal
stops the nginx container (`pre`/`post` hooks); `ufw allow 80,443`. On a server that already has a proxy (hPanel/OpenLiteSpeed, Apache,
Caddy, Traefik, CloudPanel...) `docker compose up` fails with "port is already allocated", or, worse, a stop-the-proxy hook
would take the other sites down. Also, a Hostinger *web/cloud shared* plan cannot run Docker at all: only a VPS with root can.
**Expected:** a documented, tested alternative topology for a shared server.
**Proposed fix (document in DEPLOY.md and parameterise compose; do not apply until the server is inspected):**
- Topology A (recommended if a host proxy exists): keep the bundled nginx for rate limits/headers, but publish it only on loopback:
  `ports: ["127.0.0.1:${HTTP_PORT:-8080}:80"]`, serve plain HTTP on that port (TLS ends at the host proxy), and add a vhost/server block for
  `systemmanagement.udigity.com` on the host proxy that proxies to `127.0.0.1:8080`, forwards `Host`, `X-Forwarded-For`, `X-Forwarded-Proto https`,
  and does the HTTP->HTTPS redirect, HSTS and certificate. Needs G-02 (real-IP handling) to be done at the same time.
- Topology B (host proxy owns the edge entirely): drop the nginx container; publish `frontend` and `backend` on `127.0.0.1:3000/5000` and reproduce
  in the host proxy what `udigity.conf` does: `/api/` -> backend, everything else -> frontend, 404 for `/healthz /readyz /health/*`, security headers,
  rate limits (auth 10/min/IP etc.). Much more manual work and drift risk: not recommended.
- Topology C (server is dedicated, nothing on 80/443): current design works as written.
- TLS on a shared host: use the existing panel's certificate manager (hPanel "SSL", Caddy automatic HTTPS) or `certbot --webroot`/`--nginx`/`--apache` against the existing proxy; never `--standalone`. Do not store certs in the repo directory.
**Regression test:** a smoke variant that runs `prod-smoke.sh` with `HTTP_PORT` bound to loopback and a simulated outer proxy that sets `X-Forwarded-For`.
**Limitations:** which proxy (if any) runs on the server, the Hostinger plan type, free ports: not known from here.

## G-02 · High · Blocker with an outer proxy · Confirmed (static)

**Location:** `devops/nginx/conf.d/proxy-common.inc` (`proxy_set_header X-Forwarded-For $remote_addr; X-Real-IP $remote_addr; X-Forwarded-Proto $scheme`), `devops/nginx/nginx.conf` (`limit_req_zone $binary_remote_addr`), `backend/src/app.ts` (`trust proxy` = `TRUSTED_PROXY_CIDRS`).
**Problem:** if the bundled nginx sits behind any other proxy/CDN/Cloudflare, `$remote_addr` is the outer proxy's address. Consequences:
1. `X-Forwarded-For` is overwritten with that address, so the backend sees every employee as the same IP and the **office-IP attendance check (ADR-016)** can never match the real office IP (or matches for everybody, if the proxy runs inside the office range, which it does not).
2. Every nginx rate-limit zone is keyed by `$binary_remote_addr`: all users share ONE bucket (`auth` is 10 requests/min) and `limit_conn perip 200`; a few logins lock everybody out with 429.
3. `X-Forwarded-Proto` becomes `http` (cookies are unaffected: `secure` comes from config, not the protocol).
It is spoof-safe (a client cannot inject an IP) but functionally wrong.
**Proposed fix:** in the bundled nginx `http {}` add the realip module when an outer proxy exists:
`set_real_ip_from <outer proxy IP or docker gateway CIDR>; real_ip_header X-Forwarded-For; real_ip_recursive on;` (and for Cloudflare list its ranges / use `CF-Connecting-IP`),
and set `proxy_set_header X-Forwarded-Proto` from the outer header via a `map`. Make it opt-in (an `.inc` mounted only in topology A). Add to `check-env.sh`/DEPLOY a topology table for `TRUSTED_PROXY_CIDRS` (see G-04).
**Regression test:** curl through the bundled nginx with `X-Forwarded-For: 203.0.113.9` from the trusted gateway; assert the backend log/`/api/auth/me` sees that address; assert a request from an untrusted source cannot override it.

## G-03 · Medium · Non-blocker · Confirmed — hostname / placeholder references in production-facing files (K-1)

No file contains `hrsystem` (the old name appears only in `docs/review/2026-11-04/README.md`) and none contains `systemmanagement` yet. Everything still says `app.example.com`; nothing was changed.

| File:line | Content | Needed |
|---|---|---|
| `devops/nginx/conf.d/udigity.conf:1,16` | `server_name app.example.com;` (only 443 block) | `systemmanagement.udigity.com` |
| `devops/env/backend.env.example:43-49` | `APP_ORIGIN`, `PUBLIC_APP_URL`, commented `CORS_ORIGIN` = `https://app.example.com` | `https://systemmanagement.udigity.com` (no trailing slash/path) |
| `devops/env/backend.env.example:111` | `SMTP_FROM=no-reply@example.com` | a real sender (Owner chose Gmail: must equal the Gmail address) |
| `devops/scripts/prod-smoke.sh:15` | `HOST=app.example.com` (local smoke only, harmless; dummy cert CN) | optional rename |
| `devops/scripts/prod-smoke.sh:91-92` | DNS lookup of `example.com` for egress test | keep (public test name) |
| `devops/scripts/check-env.sh:108,169,223` | rejects `example.com` in origins/sender; warns on nginx `server_name` | fine; make the nginx check an error (G-12) |
| `devops/DEPLOY.md` (19 lines), `devops/README.md:81,168` | `app.example.com`, `you@your-domain`, `owner@your-domain`, `smtp.your-provider.com`, `no-reply@your-domain`, `ops@your-domain` | replace with the real host in the runbook |
| `docker-compose.yml:47-49` | `http://localhost:3000` (dev compose) | keep (dev only) |

CORS: backend `CORS_ORIGIN` defaults to `APP_ORIGIN`, `originCheck` uses the same list, `PUBLIC_APP_URL` builds all e-mail links (not request headers). Session cookie is `__Host-` prefixed (no `Domain`), so it is bound to exactly `systemmanagement.udigity.com` and cannot be read by `udigity.com`. HSTS `includeSubDomains` on the subdomain only affects `*.systemmanagement.udigity.com` (do not add `preload`). The main site `https://udigity.com` needs no config (no cross-site calls found in compose/nginx); confirm there is no link from the main site that expects another path.

## G-04 · Medium · Non-blocker · Confirmed — `TRUSTED_PROXY_CIDRS` depends on a dynamic Docker subnet

**Location:** `devops/DEPLOY.md` §7 ("e.g. the compose network subnet from `docker network inspect`"), `docker-compose.prod.yml` (`networks: internal/public` have no `ipam`).
**Problem:** the value that makes the office-IP check work is "the nginx address", but Docker assigns the subnet automatically and it can change after `down`/network recreation or when other compose projects on the same (shared) host claim ranges. Wrong value -> `/readyz` 503 or office check against the wrong hop. The env example ships it empty.
**Proposed fix:** pin `ipam` subnets in compose (e.g. `internal: 172.29.10.0/24`) and ship a documented default; per topology: bundled nginx on the compose network = that `/24` (or `uniquelocal`, which the smoke test already uses); behind a host proxy on loopback publishing = the Docker bridge gateway of the `public` network (connections from the host arrive from the gateway, not from 127.0.0.1) plus, if the host proxy also forwards a client chain, nothing else. Add the value to `check-env.sh` warnings when it is wider than needed (`0.0.0.0/0`).
**Limitations:** actual server network not inspected.

## G-05 · Medium · Non-blocker · Confirmed — images are not reproducible / base images unpinned

`node:22-alpine`, `postgres:17-alpine` (x3 places incl. `backup.Dockerfile`, restore drill, CI), `nginx:1.27-alpine` float; `apk add tini age bash tzdata` unpinned;
`zricethezav/gitleaks:v8.21.2` tag only; GitHub Actions pinned to major tags (`@v4`, `@v3`, `@v6`) not SHAs. `npm ci` is used with the lockfile (good) but the
backend/frontend `deps` stages copy only `package-lock.json` + three package.json, so a lockfile drift fails the build (good). A rebuild on the server on a different day can produce a different Node/Postgres minor and, for Postgres, a **major** only if the tag is changed (17 is pinned). Note: the backup image shares the major with the DB (needed for `pg_basebackup`), so any future bump must change both.
**Fix:** pin digests (`node:22-alpine@sha256:...`) via build args, keep a monthly rebuild routine, pin Actions to commit SHAs (Dependabot/Renovate can maintain), add a CI image scan (Trivy/grype) and hadolint. Not release-blocking.

## G-06 · Medium · Non-blocker · Confirmed — no resource limits, no `stop_grace_period`; the server is shared

**Location:** `docker-compose.prod.yml`. No `mem_limit`/`cpus`/`pids_limit` on any service, no `stop_grace_period`.
**Impact:** on a server that also hosts `udigity.com`, a runaway Next/Node/Postgres process (or a heavy report) can starve the other site (and vice versa); the OOM killer may pick the database. The DB uses Postgres defaults (`shared_buffers` 128 MB, no tuning). Default 10 s stop grace: the API's SIGTERM handler (`backend/src/index.ts`) calls `server.close()` only (no hard timer, no `pool.end()`), the worker finishes its iteration (`shutdown()` has no timeout), and a long worker iteration or in-flight request is SIGKILLed at 10 s; Postgres uses `STOPSIGNAL SIGINT` (fast shutdown) but a kill during checkpoint means crash recovery on next start (safe, slower).
**Fix:** e.g. `db` mem_limit 1g (and `shared_buffers=256MB`), backend 512m, worker 384m, frontend 512m, nginx 128m, backup 256m with cpu shares; `stop_grace_period: 30s` for api/worker, `60s` for `db`. Size the numbers after the server's RAM is known ("to inspect on the server").

## G-07 · Medium · Non-blocker · Confirmed (design) — unbounded volumes can fill the disk and stop the database

`wal_archive` (raw WAL), `backups` (14 daily + 8 weekly + 6 monthly dumps + 2 base backups + WAL since oldest base) have no quota, and the backups live on the same disk as `pgdata` (and as the other sites, if shared). If the `backup` container is stopped/crashed/misconfigured (`check_config` fails when `AGE_RECIPIENT`/`BACKUP_DB_PASSWORD` is wrong -> `wal()` never runs) raw WAL accumulates in `wal_archive` unbounded; when the disk is full `archive_command` fails, `pg_wal` grows and PostgreSQL **PANICs and stops** (full application outage, also affecting the other site's disk). The only alert (`wal_archive_failing`) is written by the backup container itself, which is the component that is down in this scenario.
**Fix:** disk-usage check with alert (cron `df` -> mail, or the worker reading `pg_ls_waldir()`/`pg_stat_archiver`), `max_slot_wal_keep_size`/size guard, alert when `wal_archive` file count > N, document an emergency "disable archive_mode" step; keep a minimum free-disk rule (e.g. alarm at 80%).

## G-08 · Medium · Non-blocker · Confirmed — monitoring has no outside view and several blind spots

Present: container healthchecks (`ps` only; Docker does not restart unhealthy containers), `ops_alerts` rows emailed by the worker to `ALERT_EMAIL_TO` (API 500s, dead jobs/events, crashes, backup failures), `platform.heartbeat` -> `/health/worker` (worker freshness; reachable only inside the stack), nginx 404 on health endpoints (so an external monitor can only probe `/login`).
Not monitored: (1) host disk and inode space (G-07); (2) certificate expiry / renewal failure; (3) container restart loops (`restart: unless-stopped` hides crash loops; nothing counts restarts); (4) **backup age from outside** — the `backup` service health only flips the Docker status, nothing mails it, and alerts need the DB, the worker and working SMTP at once (the first real e-mail setup is Gmail/App Password: a single point of failure that also silences alerts); (5) worker down is only visible via `/health/worker` from cron on the server (manual); (6) host OS updates/reboot (containers restart; compose `up` after reboot with an unset `UDIGITY_TAG`, see G-10); (7) `ALERT_EMAIL_TO` is optional and not enforced when real e-mail is on.
**Simple options:** an external uptime probe (UptimeRobot/Better Stack, free) on `https://systemmanagement.udigity.com/login`; a heartbeat/dead-man URL (healthchecks.io) curled by a host cron after each successful nightly dump and every 5 min from the worker check; a 5-line host cron script: `df` threshold, `docker ps --filter health=unhealthy`, cert days left, `.last-success` age -> mail via the same Gmail account or a second channel; make `check-env.sh` warn when `ALERT_EMAIL_TO` is empty and SMTP is on.

## G-09 · Medium · Non-blocker (Owner-accepted) · Confirmed — recovery capability, stated honestly (K-3 / S-23)

- Backups are on the same server and disk. Loss of the server, its disk, an `rm -rf`/volume prune, ransomware or a Hostinger account problem destroys the database **and** all backups. Recovery from that event is only possible if (a) a Hostinger VPS snapshot/backup exists (to inspect: whether the plan has automatic backups; do not assume) or (b) someone copies the volume off the server. `docker volume prune` / `docker compose down -v` also delete both (the runbook says `down` keeps volumes; `-v` is the danger).
- The age private key protects confidentiality only: it is not on the server (good) but if the Owner loses it every backup is unreadable. It must have the two offline copies the runbook asks for.
- RPO 15 min / RTO 4 h are **objectives, not demonstrated**: the 2026-10-26 and 2026-10-29 drills were local test databases (DEPLOY says so). A restore drill on the real server's backups is still required before go-live (and the quarterly one).
- PITR depth is limited by `KEEP_BASE=2` weekly base backups: about 2 weeks of point-in-time recovery; daily/weekly/monthly dumps (14/8/6) allow older but coarser restores only (no PITR, up to 24 h loss). Dumps are `--no-owner --no-privileges` and do not contain roles: after restore the role scripts must be re-run (documented).
- Partial protections: nightly + WAL encrypted; sha256 files; `restore-drill.sh` works from a workstation.
**Cheapest improvement that does not break S-23:** a second copy off the server on a schedule (host cron `rclone`/`scp` of the already-encrypted `backups` volume to the Owner's workstation, Google Drive or Hostinger object storage), plus the Hostinger snapshot if available. Needs Owner approval for the destination.

## G-10 · Medium · Non-blocker · Confirmed — rollback depends on a shell variable; image tag not persisted

**Location:** `devops/DEPLOY.md` §8, §12. `UDIGITY_TAG` is `export`ed in an interactive shell; compose files default to `:latest`. After a reboot, a new SSH session or someone running `docker compose up -d` without the export, compose resolves `udigity-backend:latest` (missing) and **rebuilds from whatever the working tree contains**; the worker/migrate services have `image:` only and rely on the backend build. The rollback recipe needs `/opt/udigity/.previous-tag` and the old images still present (a `docker image prune` or a disk-pressure cleanup removes them).
Forward-only migrations: image rollback is safe only for additive migrations; the runbook states it and falls back to the pre-update dump restore (loses writes since the update). There is no check that a release's migrations are additive, and the pre-update step uses `backupd nightly` (a dump, ~seconds) — adequate.
**Fix:** write `UDIGITY_TAG=<sha>` into an untracked `/opt/udigity/.env` (compose reads it automatically) at every deploy; keep the last 2 tags (`docker tag` + no prune); add a `devops/scripts/deploy.sh` that does backup -> build -> migrate -> up -> `ps --wait` -> record tag; add a "rollback decision" line: if the new release ran any migration, use restore, not image rollback, unless the migration is marked additive.

## G-11 · Medium · Non-blocker · Confirmed (static) — CI cannot currently prove the deployment files, and some deployment paths are never exercised

- `ci.yml` triggers are correct: `push: [main]`, `pull_request: [opened, synchronize, reopened, labeled]`, `workflow_dispatch`; `permissions: contents: read` (least privilege, no `pull_request_target`, no secrets used at all, so fork PRs get nothing); heavy jobs gated by `github.event_name != 'pull_request' || contains(labels, 'full-ci')`; concurrency cancels superseded runs. Good.
- Current state: all jobs are blocked by the account billing/spending-limit issue (account-side, not code); the head on GitHub is `03d6352`, local is `cab5ec9`, so the pushed revision was never verified by CI and the local revision is not pushed. CI evidence for deployment is therefore **none** until billing is fixed; a local `prod-smoke.sh` run is the only substitute (planned in a later phase).
- Coverage gaps: `prod-smoke.sh` runs `--scale backup=0`, so the **backup container, WAL archiving, encryption and restore are never run in CI or in the smoke test**; no worker->SMTP test; no restart/persistence test; `docker compose config -q` runs only with example env files; shell scripts only get `bash -n` (no shellcheck); no image/CVE scan; `npm audit --audit-level=high` is a blocking gate (can fail on an upstream advisory without any code change: keep, but know it).
- Minor: any label added triggers a full run of `verify` (add an `if` on the label name for `labeled`); `runs-on: ubuntu-latest` is now Ubuntu 24.04: no impact found (Docker, setup-node, `postgres:17-alpine` service and `playwright install --with-deps chromium` all work there), but pin `ubuntu-24.04` to avoid surprise at the next migration; gitleaks runs with the repo's `.gitleaks.toml` (default rules + 5 reviewed allowlist values), full history (`fetch-depth: 0`), `--redact`: good.
**Fix:** add a smoke step that starts the `backup` service with a throwaway age key and asserts `.last-success`, a WAL `.age` file and one restore-drill run (the script already supports it; local project `udigity-bkp-test` did this on 2026-10-29); add shellcheck and hadolint steps; pin action SHAs.

## G-12 · Low · Non-blocker · Confirmed — `check-env.sh` gaps (it is otherwise thorough)

Covers: NODE_ENV, TRUSTED_PROXY_CIDRS (required, syntax), DATABASE_URL role/password vs postgres.env, owner vs runtime vs backup role separation, no `MIGRATION_DATABASE_URL` in backend.env, SESSION_SECRET >= 32 and not the dev value, TOTP_ENC_KEY 64 hex/base64, APP_ORIGIN/PUBLIC_APP_URL https without path and no `example.com`, POLICY_COMPANY_TIMEZONE IANA, enums/booleans/integers, SMTP safety switch (`EMAIL_ALLOW_REAL_SEND`), SMTP_FROM plain address, file mode 600, backup.env (`AGE_RECIPIENT` real, `BACKUP_TIME`, retention ints, backup role password differs), unknown keys.
Not covered: (a) nginx `server_name` still `app.example.com` is only a **warning** and is not compared with the APP_ORIGIN host (single 443 block, so a mismatch does not break TLS but the check is misleading); (b) no check that `PUBLIC_APP_URL` host == `APP_ORIGIN` host; (c) certificates present in `NGINX_CERTS_DIR` / not expired / SAN matches the host; (d) `ALERT_EMAIL_TO` not validated and not required when SMTP is on; (e) `SESSION_COOKIE_NAME`/nginx map consistency only partially; (f) `AGE_RECIPIENT` only prefix-checked (a typo that is not a valid bech32 key is caught by `age` at first backup, the container then alerts, G-07); (g) `TRUSTED_PROXY_CIDRS` not compared to the actual compose/subnet; (h) `SESSION_SECRET` entropy (e.g. 32 identical characters passes); (i) the file is slow under Git Bash on Windows (selftest takes minutes; fine on Linux/CI).
**Fix:** add (a)-(d), promote (a) to an error once the host is known.

## G-13 · Low · Non-blocker · Confirmed — access log keeps single-use reset tokens

`nginx.conf` `log_format main` logs `"$request"` (full URL). Invitation/reset links are `GET /reset-password?token=<raw>`, so every token lands in the nginx access log (10 MB x 5 files, json-file driver on the host) for as long as the log lives. Tokens are single-use with TTL (reset 30-60 min, invitation 72 h), which limits the risk, but they are credentials. Referrer-Policy is already `no-referrer` on that page (good). **Fix:** log `$uri` plus a sanitised query (map that blanks `token=`), or `access_log off` for `/reset-password`.

## G-14 · Low · Non-blocker · Confirmed — nginx edge details

(1) The only `:443` server is also the default: any `Host` header (or direct-IP request) is served the app; add a catch-all `listen 443 ssl default_server; ssl_reject_handshake on;`. (2) The `:80` default server redirects to `https://$host$request_uri` for any Host (Host-header-controlled redirect target; harmless but use the fixed host). (3) `X-Frame-Options`, HSTS (`max-age=31536000; includeSubDomains`) fine; no OCSP stapling/`ssl_ciphers` pin (TLS1.2+1.3 only, acceptable). (4) `proxy_read_timeout 60s` and `client_max_body_size 10m`: confirm no feature uploads files above 10 MB (none found in compose/env). (5) Rate limits are per client IP: correct only when G-02 is solved.

## G-15 · Low · Non-blocker · Confirmed — frontend image details

(1) The Dockerfile silently falls back to `next start` (and `npm prune ... || true`) if standalone output ever disappears; since `output: 'standalone'` is now set, fail the build instead of silently producing a 685 MB image. (2) Header comments in `frontend.Dockerfile` and `devops/README.md` §3 still say "until REQUEST DEV-R3 ... fallback": stale. (3) `NEXT_PUBLIC_*` are inlined at build time: `frontend.env` values for `NEXT_PUBLIC_CSRF_COOKIE_NAME`/`NEXT_PUBLIC_PASSWORD_MIN_LENGTH` have **no effect at run time**, and compose passes only `INTERNAL_API_URL` as a build arg; if the cookie name is ever changed in backend.env the frontend (built with the default) will break CSRF header lookup. (4) Read-only root FS: Next may try to write `.next/cache` (images/ISR); no use found, but a failing write would only surface in logs; the smoke test covers `/login`. (5) Frontend healthcheck hits `/login` (renders a page: heavier than needed but meaningful).

## G-16 · Low · Non-blocker · Confirmed — healthcheck semantics and stale docs

Compose healthchecks for the API use `/readyz` (liveness + DB + config), the image `HEALTHCHECK` uses `/healthz`. Using readiness as the container health means a short DB blip marks the API unhealthy and, via `depends_on: service_healthy` on restart/`up`, can block dependants; Docker never restarts an unhealthy container, so there is no flapping, only a red `ps`. Acceptable; document that "unhealthy" needs a human or an external probe (G-08). `devops/README.md` §4 is partly stale: step 8 says "install the cron entry in section 5" (backups are now the container service), certbot renewal is described as `--webroot` + `nginx -s reload` while DEPLOY.md uses `--standalone` + stop/start hooks (two different procedures; a cert issued with `--standalone` keeps the standalone authenticator on renewal). Keep one procedure per topology (G-01).

## G-17 · Low · Non-blocker · Confirmed — dev compose and test compose

`docker-compose.yml` (local only): frontend `ports: "3000:3000"` binds all interfaces (the others use `127.0.0.1`), `ALLOW_MISSING_ORIGIN=true` and fixed dev secrets: fine for a laptop, never use that file on a server (name clash `name: udigity` with prod: both use project name `udigity` and volumes/networks could collide if ever run on one Docker host: the prod stack would adopt or conflict with `udigity_devdata`-style names; keep them on separate machines or rename). `docker-compose.test.yml`: throwaway DB on `127.0.0.1:55432`, tmpfs, `fsync=off`: correct for tests only.

## G-18 · Low · Non-blocker · Confirmed — database role model notes

Owner role `udigity_owner` is a Postgres superuser (it is `POSTGRES_USER`); only `migrate` and the init scripts use it and it is not loaded by API/worker (verified by `assertRuntimeRole` + check-env). `20-backup-role.sh` appends a `host replication <backup user> all scram-sha-256` line to `pg_hba.conf`; `host all all all scram` is already the image default, reachable only on the internal network (OK). `20-backup-role.sh` must be re-run after the first migrate and after any restore (documented; easy to forget -> `ops_alerts` insert by the backup role would silently fail, backups still run). Add it to the deploy script (G-10).

## G-19 · Low · Non-blocker · Confirmed — log/privacy and operations notes

json-file logs live unencrypted on the host; they contain request metadata (and tokens, G-13), user agents and IPs. Logs are rotated (10 MB x 5 x 6 services), so history is short (hours to days on a busy day): not enough for an incident review days later; consider shipping to a file with 30-day retention or a free log service. `docker compose logs` is the only access path; the runbook correctly warns not to share env values.

---

## Section answers (brief)

1. **Images:** multi-stage, non-root, tini, no tests/docs/.env in the image (verified via `.dockerignore`, `tsconfig.build.json`), `npm ci` from lockfile; unpinned digests (G-05); standalone is used by the image (G-15).
2. **Compose prod:** only `nginx` publishes ports (G-01 if a proxy exists); DB never; named volumes `pgdata`, `wal_archive`, `backups`; restart `unless-stopped`; migrations run manually as owner (`--profile tools run --rm migrate`), API/worker as `udigity_api`; env files via `env_file` (not in compose, mode 600 enforced by check-env); no limits / grace (G-06); logs rotated.
3. **Proxy/TLS:** G-01, G-02, G-03, G-04.
4. **Env validation:** G-12.
5. **CI:** G-11, G-05.
6. **Backups:** schedule nightly `BACKUP_TIME`=02:30 in `TZ` (note: the example ships `TZ=UTC` while the company zone may be `Asia/Beirut`: check-env warns), base backup weekly, WAL `archive_timeout=900` + 60 s encryption loop, retention 14/8/6 + 2 base; healthcheck = dump < 26 h; recovery capability G-09; rollback G-10.
7. **Monitoring:** G-08.
