# Deploying Udigity on the Hostinger VPS (behind the server's existing proxy)

Step-by-step runbook for `https://hrsystem.udigity.com` (Owner decision S-28). The server is a Hostinger VPS that **already runs
other sites behind its own web server / proxy on ports 80 and 443**, so this stack does not publish 80/443 and never requests
certificates. Run it only with the Owner's go-ahead. Reference detail lives in `devops/README.md`; the checklist with owners per
step is `docs/review/2026-11-04/DEPLOYMENT-CHECKLIST.md`. Replace `<owner e-mail>` / `<operator e-mail>` with real addresses.

```
visitor --HTTPS--> existing proxy on the host (nginx | Apache | OpenLiteSpeed | Caddy)   [certificate, 80->443 redirect]
                      --HTTP, Host + X-Forwarded-For--> 127.0.0.1:8080 = bundled nginx container [rate limits, headers, 404 on health]
                           --> frontend (Next) / backend (API) --> db (PostgreSQL 17)       [worker: outbound SMTP only]
```

Stack: `nginx` (published only on `127.0.0.1:8080`) -> `frontend` and `backend` -> `db`; `worker` runs `node dist/worker.js` from
the backend image. `db`, `backend` and `frontend` sit on an internal network with no internet route. The `worker` is on the
internal network plus an outbound-only `egress` network (it needs the external SMTP server) and publishes no port. Docker
networks use pinned subnets 172.29.10/20/30.0/24 (the bundled nginx is 172.29.10.10 on `internal`).

Three database roles: `udigity_owner` (superuser/owner) runs migrations through the one-shot `migrate` job;
the API and worker run as `udigity_api`, a limited login role (member of the group role `udigity_app` from migration
012: DML on all tables, `SELECT` + `INSERT` only on `audit_events`, no `UPDATE`/`DELETE`, owns nothing). The owner
credentials live in `migrate.env`, which only the `migrate` job loads. The `backup` service connects as
`udigity_backup` (read-only + replication, password in `backup.env`; section 11).

Sizing: the stack's memory caps add up to about 2.6 GB (`mem_limit` in `docker-compose.prod.yml`: db 768m, backend 512m,
frontend 512m, worker 384m, backup 256m, nginx 128m; migrate 384m only while it runs) and CPU caps never exceed the host. Plan on
a VPS with at least 4 GB RAM and 40 GB disk, minus what the other sites use: check `free -h` and `df -h` first (checklist section 1).

---

## 1. DNS

Create an `A` record `hrsystem` in the `udigity.com` zone pointing at the VPS public IPv4 (and `AAAA` only if IPv6 works end to
end). Wait until `dig +short hrsystem.udigity.com` returns the VPS address before issuing the certificate.

## 2. Host: what NOT to change

The server already has SSH, a firewall and a web server for the other sites. Do not touch them. This stack needs **no new open
port**: keep whatever the firewall allows today (22, 80, 443). Docker publishes ports through iptables directly, so ufw alone
would not guard them; that is safe here because the only published port is `127.0.0.1:8080` and the database has none. Never add
`ports:` to `db`, and never set `HTTP_BIND=0.0.0.0`. The host needs no `age` or `certbot` for this stack (the backup container
carries `age`; the existing proxy owns the certificate). A non-root deploy user in the `docker` group is enough.

Before you start, inspect (read-only) and write the answers into the checklist:

```sh
ss -ltnp | grep -E ':(80|443|8080) '                       # who owns 80/443; is 8080 free? if not, set HTTP_PORT in .env
docker ps; docker network ls                               # other projects on this Docker host
docker network inspect $(docker network ls -q) --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'   # 172.29.10-30.0/24 must be unused
free -h; df -h
```

## 3. Docker Engine and the Compose plugin

If Docker and Compose v2 are already installed (`docker compose version`), skip the install. Otherwise follow the official apt
repository instructions at https://docs.docker.com/engine/install/ubuntu/ (packages
`docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`), then:

```sh
usermod -aG docker deploy        # log out and back in as deploy
docker compose version
```

## 4. Get the code

```sh
sudo mkdir -p /opt/udigity && sudo chown deploy:deploy /opt/udigity
git clone <repository-url> /opt/udigity && cd /opt/udigity     # or unpack a release tarball
git rev-parse --short HEAD                                      # becomes the image tag (deploy.sh records it)
```

All commands below run from `/opt/udigity`.

## 5. Outer proxy and certificate (the server's existing web server)

The bundled nginx answers only the Host `hrsystem.udigity.com` (`devops/nginx/conf.d/udigity.conf`; other Host headers get no
answer) and speaks plain HTTP on `127.0.0.1:8080`. Add **one vhost** for `hrsystem.udigity.com` to the proxy that already runs on
the server, with the certificate tool that proxy already uses. Find out which proxy it is first
(`ss -ltnp | grep -E ':(80|443) '`, `systemctl list-units | grep -Ei 'nginx|apache|httpd|lsws|caddy'`), then copy the matching
template and adapt the paths:

| Existing proxy | Template | Certificate |
|---|---|---|
| nginx on the host | `devops/proxy/nginx-outer.conf.example` | `certbot --nginx -d hrsystem.udigity.com` (or `certonly --webroot -w /var/www/certbot`) |
| Apache | `devops/proxy/apache-outer.conf.example` | `certbot --apache -d hrsystem.udigity.com` |
| OpenLiteSpeed / CyberPanel | `devops/proxy/openlitespeed-outer.conf.example` (field names UNVERIFIED) | the panel's "Issue SSL" (Let's Encrypt, auto-renew) |
| Caddy | `devops/proxy/Caddyfile.example` | automatic |
| Traefik / Coolify / other | same idea: Host unchanged, `X-Forwarded-For` = visitor address, upstream `127.0.0.1:8080` | its own |

Rules for any proxy: forward the `Host` header unchanged; send the visitor address in `X-Forwarded-For` (the bundled nginx believes
that header only when the TCP peer is 127.0.0.1 or in 172.16.0.0/12, which covers the Docker bridge gateway 172.29.20.1 a host proxy
arrives from, and reads it from the right, so a forged header is ignored); add no security headers (the app and the bundled nginx
send them); redirect http to https; never stop or restart the proxy that serves the other sites (`nginx -t && systemctl reload nginx`
only). Never use `certbot --standalone`, and never copy certificates into this repository: the stack holds none. If the host proxy
runs in Docker, or a CDN (Cloudflare) sits in front of it, read the notes at the end of the template.

Test the chain once the stack is up (section 8):

```sh
curl -sI -H 'Host: hrsystem.udigity.com' http://127.0.0.1:8080/login    # 200, bundled nginx directly (from the server)
curl -sI https://hrsystem.udigity.com/login                             # 200, HSTS present
curl -sI http://hrsystem.udigity.com/login                              # 301 to https
```

## 6. Compose settings (`/opt/udigity/.env`)

```sh
cp devops/env/compose.env.example .env && chmod 600 .env     # deploy.sh writes UDIGITY_TAG for you
```

`.env` holds the image tag (so a reboot or a plain `docker compose up -d` can never run an unknown image; compose refuses to start
without it), the loopback port, the pinned subnets and the frontend build-time values (`NEXT_PUBLIC_*`, baked into the browser
bundle: setting them in `frontend.env` has no effect). `TRUSTED_PROXY_CIDRS` (next section) must match the pinned nginx address.

## 7. Create and validate the env files

```sh
cd devops/env
for f in backend frontend postgres migrate backup; do cp $f.env.example $f.env; done
chmod 600 *.env
```

Fill in the values (never commit these files, never paste them into chat or tickets):

| Value | How |
|---|---|
| `SESSION_SECRET` (backend.env) | `openssl rand -hex 32` |
| `TOTP_ENC_KEY` (backend.env) | `openssl rand -hex 32`. Keep a copy outside the server and outside the DB backups; without it nobody can pass 2FA |
| `POSTGRES_PASSWORD` (postgres.env) and the password inside `MIGRATION_DATABASE_URL` (migrate.env) | owner role `udigity_owner`: `openssl rand -base64 32 \| tr -d '/+='` (same value in both) |
| `APP_DB_PASSWORD` (postgres.env) and the password inside `DATABASE_URL` (backend.env) | runtime role `udigity_api`: a **different** value, same generator (same value in both files) |
| `APP_ORIGIN`, `PUBLIC_APP_URL` | `https://hrsystem.udigity.com`, exactly (lower case, no trailing slash, no path, both equal). The API refuses to start otherwise (C-14) |
| `POLICY_COMPANY_TIMEZONE` | required (BL-16), IANA name: the **company-confirmed** value (proposed `Asia/Beirut`, pending confirmation; the example ships it empty). Without it (and no Owner-saved value) `/readyz` answers 503. The alias `COMPANY_TIMEZONE` is only a fallback. Attendance enforcement (lateness, alerts, check-in) still starts only after the Owner saves the complete attendance settings in Settings (D1) |
| `TRUSTED_PROXY_CIDRS` | required in production (D2): the proxy hop(s) whose `X-Forwarded-For` entry the API believes. **Behind the existing host proxy (this deployment): `172.29.10.10/32`**, the bundled nginx container, which compose pins to that address; it passes on the real visitor address it learned from the host proxy (nginx `set_real_ip_from`). If you change `NGINX_INTERNAL_IP` / `UDIGITY_SUBNET_INTERNAL` in `.env`, use the new address. Never `0.0.0.0/0`, `127.0.0.1`, a whole range or the host proxy here (check-env rejects wide ranges). Unset: no proxy is trusted and `/readyz` answers 503. `TRUST_PROXY` is a development/test fallback only |
| `POLICY_ATTENDANCE_OFFICE_IPS` | office public IP(s), comma-separated; a pre-fill suggestion only: the Owner saves the office IP list in Settings ("Not configured" until then) |
| `AGE_RECIPIENT` (backup.env) | public key from `age-keygen -o udigity-backup.agekey` run on the Owner's machine (section 11) |
| `BACKUP_DB_PASSWORD` (backup.env) | backup role `udigity_backup`: a third, **different** value, same generator |
| `TZ` (backup.env) | same IANA zone as `POLICY_COMPANY_TIMEZONE`; `BACKUP_TIME` (default `02:30`) is read in it |
| `ALERT_EMAIL_TO` (backend.env) | operator address for failure alerts (check-env warns when real email is on and it is empty) |

Then validate (prints key names only, never values; exits 1 on any error):

```sh
cd /opt/udigity && devops/scripts/check-env.sh
```

Fix every `ERROR` line before going on. Leave real email off for now (`SMTP_HOST` empty, `EMAIL_ALLOW_REAL_SEND=false`).
`PUBLIC_APP_URL` is the base of every invitation and password-reset link: it must be a bare `https://` origin (no path,
query or credentials) equal to `APP_ORIGIN`; the API and the worker refuse to start otherwise. Links never use request headers.

## 8. Build, migrate, start

One command does the backup (skipped on a first install), build, migration, backup-role grant and start, and records the image tag
in `/opt/udigity/.env`:

```sh
devops/scripts/deploy.sh     # check-env -> [backup] -> build -> up db -> migrate -> 20-backup-role.sh -> write tag -> up --wait
docker compose -f docker-compose.prod.yml ps            # every service should reach "healthy" (backup after its first check, up to 5 min)
```

The manual equivalent (first install), for reference:

```sh
export UDIGITY_TAG=$(git rev-parse --short=12 HEAD)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d db   # first start of an empty volume creates the udigity_api and udigity_backup roles
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml exec db sh /docker-entrypoint-initdb.d/20-backup-role.sh   # ops_alerts grant (needs the migrations)
echo "UDIGITY_TAG=$UDIGITY_TAG" >> .env
docker compose -f docker-compose.prod.yml up -d      # also starts "backup": first dump + base backup right away
```

Verify the runtime role is limited (expected: `f`, then `permission denied`):

```sh
docker compose -f docker-compose.prod.yml exec db sh -c 'PGPASSWORD="$APP_DB_PASSWORD" psql -U "$APP_DB_USER" -d "$POSTGRES_DB" -Atc "select rolsuper from pg_roles where rolname=current_user" -c "delete from audit_events where false"'
```

The API and the worker also check this themselves (UDI-6, `backend/src/shared/runtimeRole.ts`). In production they
refuse to start, and `/readyz` answers 503, when `DATABASE_URL` connects as a role that is a superuser, can create
roles or databases, bypasses RLS, owns any table, can change audit rows, or can write `schema_migrations`. The log
names each problem. Fix `DATABASE_URL` (use `APP_DB_USER`, never `POSTGRES_USER`) or re-run the init script above.

**Existing database (created before the role split, or the volume already existed):** the init script only runs on an
empty data directory. Add `APP_DB_USER`/`APP_DB_PASSWORD` to `postgres.env`, then run
`docker compose -f docker-compose.prod.yml up -d --force-recreate db` and
`docker compose -f docker-compose.prod.yml exec db sh /docker-entrypoint-initdb.d/10-app-role.sh`
(idempotent; it also re-applies the grants). If the old superuser was named `udigity_app` it collides with the group
role: create a new owner role, `ALTER DATABASE ... OWNER TO` it, reassign objects (`REASSIGN OWNED BY`), then rename or
drop the old role before running the script. Take a backup first.

Do not run the dev seed (`npm run seed`) in production; it refuses to run outside development and test anyway.

## 9. Create the first Owner

Run the identity bootstrap CLI inside the backend image (it works against the production database and is never exposed
over HTTP):

```sh
docker compose -f docker-compose.prod.yml run --rm backend \
  node dist/modules/identity/bootstrap.js --email <owner e-mail> --name "Owner Full Name"
```

The terminal prints, once, a random initial password and a one-time 2FA enrollment token (valid 24 h). Hand both to the
Owner over separate channels and do not store them in shell history or chat. The Owner signs in at
`https://hrsystem.udigity.com/login`, enrols the authenticator app (the password is required again at enrollment) and
saves the recovery codes.

Recovery procedures with the same CLI (verify the person's identity out of band first):

```sh
# Owner lost the authenticator AND the recovery codes: un-enrol 2FA, end sessions, issue a new token
docker compose -f docker-compose.prod.yml run --rm backend \
  node dist/modules/identity/bootstrap.js --email <owner e-mail> --reset-2fa --reason "ticket or reason"
# Re-encrypt any TOTP secret still stored in plaintext (one-off backfill)
docker compose -f docker-compose.prod.yml run --rm backend \
  node dist/modules/identity/bootstrap.js --encrypt-existing
```

## 10. Smoke test and real email

```sh
curl -sSI https://hrsystem.udigity.com/login | head -20      # 200, HSTS and nosniff present
docker compose -f docker-compose.prod.yml logs --tail=30 worker    # "[worker] ... starting ... email transport=none"
```

While real email is off the worker prints an `ERROR: NODE_ENV=production without a real email transport` line at start-up
and sends nothing: every invitation and password-reset email is recorded as **Failed** with
`email transport not configured` on the Delivery monitor (and the Owners get a "Delivery failed" notice). No link is
written to any log. After real email is turned on, use **Send again** on those rows; a link that expired meanwhile
(reset 60 min, invitation 72 h) is skipped, so request a new reset / re-issue the invitation instead.

Log in as the Owner, enrol 2FA, open Settings and confirm the company timezone and office IP.

**Turning real email on** (only with the Owner's go-ahead; both switches are needed on purpose). Edit
`devops/env/backend.env`:

```
SMTP_HOST=<provider SMTP host>
SMTP_PORT=587                  # 465 with SMTP_SECURE=true
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=<sender address>          # plain address, domain with SPF/DKIM/DMARC
EMAIL_ALLOW_REAL_SEND=true
ALERT_EMAIL_TO=<operator e-mail>   # recommended: failure alerts (API 500s, dead jobs/events, crashes), 1 email per kind per 15 min
```

**Gmail account (the Owner's choice, 2026-10-29).** Turn on 2-Step Verification on the Google account, then create an
App Password (Google Account → Security → App passwords). Gmail only sends as the signed-in address, and allows about
500 messages a day. No DNS records are needed.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<the Gmail address>
SMTP_PASS=<the 16-character App Password; never the account password>
SMTP_FROM=<the same Gmail address>
EMAIL_ALLOW_REAL_SEND=true
```

```sh
devops/scripts/check-env.sh                                              # warns "REAL EMAIL IS ENABLED"
docker compose -f docker-compose.prod.yml up -d --force-recreate backend worker
docker compose -f docker-compose.prod.yml logs --tail=50 worker          # smtp transport, no refusal
```

With `SMTP_HOST` set and `EMAIL_ALLOW_REAL_SEND` not `true` the worker refuses to start. Trigger a password reset for a
test account you own to confirm delivery. To go back to no-send: empty `SMTP_HOST`, set `EMAIL_ALLOW_REAL_SEND=false`,
recreate `backend worker`. While email is off, no reset or invitation link is sent or logged (see above).

Delivery states on the monitor: **accepted** = the SMTP provider accepted the message (250). That is not proof that it
reached the inbox (no bounce tracking in v1), so confirm with the recipient when it matters. **captured** appears only in
development / tests (log or memory transport: nothing left the machine). **sent** is used for in-app notices.

## 11. Backups

Policy D19: nightly dump + continuous WAL archiving, encrypted, retention 14 daily / 8 weekly / 6 monthly, RPO 15 min,
RTO 4 h, restore drill before launch and quarterly. Details: `devops/backup/README.md`.

**RPO 15 min and RTO 4 h are objectives, not yet demonstrated.** They count as met only after a restore drill (both
(a) and (b) below) on the real server's backups, recorded in the drill log. What the setup is designed to deliver:
WAL is archived at least every 15 min (`archive_timeout=900`), so a point-in-time restore loses at most the last
~15 min of writes; the nightly dump alone loses up to 24 h.

**Owner-approved exception (2026-10-29): backups are stored on the same server**, in the `backups` Docker volume,
not "outside the application server" as D19 says. Risk: losing the server or its disk loses the database and every
backup together; only a provider snapshot or an off-server copy protects against that. Upgrade path: copy the volume
off-server (the files are already encrypted), e.g. a host cron
`rclone sync "$(docker volume inspect -f '{{.Mountpoint}}' udigity_backups)" remote:udigity-backups`.

1. On the **Owner's workstation** (not the VPS) generate the key pair: `age-keygen -o udigity-backup.agekey`. Keep two
   offline copies of that file (password manager plus a USB stick in a safe). Only the public key (`age1...`) goes on the
   server: `AGE_RECIPIENT` in `devops/env/backup.env`, with `BACKUP_DB_PASSWORD` and `TZ` (section 7).
2. `docker compose -f docker-compose.prod.yml up -d` starts the `backup` service (section 8). Check it:
   ```sh
   docker compose -f docker-compose.prod.yml logs --tail=30 backup       # "wrote /backups/daily/...", "wrote /backups/base/..."
   docker compose -f docker-compose.prod.yml exec backup ls -lR /backups
   docker compose -f docker-compose.prod.yml ps backup                    # healthy = a nightly dump in the last 26 h
   ```
3. Alerts: failures land in `ops_alerts` and the worker emails them to `ALERT_EMAIL_TO`. Set that address.
4. A dump by hand (e.g. before an update, section 12): `docker compose -f docker-compose.prod.yml exec backup backupd nightly`.

### Restore drill (before go-live, then quarterly, on a workstation with Docker and the private key)

Copy the encrypted backups off the server, then run both drills:

```sh
docker run --rm -v udigity_backups:/b alpine tar -C /b -cf - . > udigity-backups.tar     # on the server; scp it over
mkdir backups && tar -xf udigity-backups.tar -C backups
export AGE_IDENTITY=~/keys/udigity-backup.agekey
devops/backup/restore-drill.sh backups/daily/udigity-<stamp>.dump.age                    # (a) nightly dump
devops/backup/restore-drill.sh pitr backups/base/base-<stamp>.tar.gz.age backups/wal     # (b) base + all WAL
devops/backup/restore-drill.sh pitr backups/base/base-<stamp>.tar.gz.age backups/wal '2026-11-02 14:05:00+02'
```

Both verify checksums, restore into a throwaway `postgres:17-alpine` container (no published port), print migration,
table and row counts (for (b) also the last replayed commit time) and remove the container. Record date, files and
durations in the drill log below. On Git Bash for Windows prefix with `MSYS_NO_PATHCONV=1`.

### Real restore (disaster). Objective: service back within 4 h

Take a fresh dump of the broken state first if it can still be dumped (`backupd nightly`). The private key has to be
brought to the server for this (or decrypt on a workstation and copy over a secure channel); remove it afterwards.

**(a) From a nightly dump** (simplest; loses everything after that dump):

```sh
docker compose -f docker-compose.prod.yml stop backend worker frontend nginx backup
age -d -i ~/keys/udigity-backup.agekey < udigity-<stamp>.dump.age > /dev/shm/restore.dump     # RAM only
docker compose -f docker-compose.prod.yml exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' < /dev/shm/restore.dump
shred -u /dev/shm/restore.dump
# The restore drops privileges (--no-privileges): recreate the roles and their grants (idempotent).
docker compose -f docker-compose.prod.yml exec -T db sh /docker-entrypoint-initdb.d/10-app-role.sh
docker compose -f docker-compose.prod.yml exec -T db sh /docker-entrypoint-initdb.d/20-backup-role.sh
docker compose -f docker-compose.prod.yml up -d
```

**(b) Point in time** (base backup + WAL; loses at most ~15 min, or stops just before a bad change):

1. Run drill (b) with the wanted target time first, to confirm the files and the time.
2. `docker compose -f docker-compose.prod.yml down` (keeps the volumes). Keep the old data, do not delete it:
   `docker run --rm -v udigity_pgdata:/d alpine mv /d/pgdata /d/pgdata.broken`
3. Unpack the newest base backup taken **before** the target time and stage all WAL files after it (decrypted, in RAM):
   ```sh
   K=~/keys/udigity-backup.agekey
   age -d -i $K < base/base-<stamp>.tar.gz.age | docker run --rm -i -v udigity_pgdata:/d postgres:17-alpine \
     sh -c 'install -d -o postgres -g postgres -m 700 /d/pgdata && tar -xzf - -C /d/pgdata && chown -R postgres:postgres /d/pgdata'
   mkdir -p /dev/shm/wal && for f in wal/*.age; do age -d -i $K < "$f" > /dev/shm/wal/"$(basename "$f" .age)"; done
   docker run --rm -v /dev/shm/wal:/src:ro -v udigity_wal_archive:/wal alpine \
     sh -c 'mkdir -p /wal/restore && cp /src/* /wal/restore/ && chown -R 70:70 /wal/restore'
   ```
4. Append to `/d/pgdata/postgresql.auto.conf` (same `docker run ... -v udigity_pgdata:/d alpine vi ...`) and create
   the empty file `/d/pgdata/recovery.signal` (owner 70:70):
   ```
   restore_command = 'cp /wal/restore/%f %p'
   recovery_target_time = '2026-11-02 14:05:00+02'
   recovery_target_action = 'promote'
   ```
5. `docker compose -f docker-compose.prod.yml up -d db` and watch `logs -f db` for `recovery stopping before ...` and
   `database system is ready to accept connections`. Check the data; then delete those three lines, `/wal/restore`
   and `/dev/shm/wal`, and `docker compose -f docker-compose.prod.yml up -d`. Roles and grants come back with the
   physical copy. Recovery starts a new timeline: take a new base backup at once (`backupd base`).

## 12. Updates and rollback

```sh
cd /opt/udigity && git pull && devops/scripts/deploy.sh
```

`deploy.sh` refuses a dirty tree, runs `check-env.sh`, takes a dump first (`backupd nightly`), remembers the running tag in
`.previous-tag`, builds, migrates, re-applies the backup-role grant (`20-backup-role.sh`, lost after any restore), writes the new
`UDIGITY_TAG` into `/opt/udigity/.env` only after the migration succeeded, and waits for every service to be healthy. The tag
lives in `.env`, so `docker compose up -d` after a reboot or in a new SSH session starts the same images (compose refuses to
start at all when the tag is missing; it never falls back to `latest`).

**Rollback decision.** Migrations are forward-only. If the release you are leaving ran **no migration**, or only additive ones
(new tables, columns, indexes: read the new files in `backend/src/db/migrations/`), roll the images back:

```sh
devops/scripts/deploy.sh rollback      # checks the old images still exist, writes the previous tag to .env, up -d --wait
```

If a migration changed or removed something the old code needs, do not roll the images back: do the "Real restore" above with the
dump from step 1 (loses writes since the update), then start the previous tag. Keep the last two image tags on the host: never run
`docker image prune -a` or `docker system prune` (dangling-only `docker image prune` is fine). Never run `docker compose down -v`
or `docker volume prune`: they delete the database and the backups.

## 13. Monitoring and log rotation

Health endpoints are blocked at the edge (404) and reachable only inside the stack:

```sh
docker compose -f docker-compose.prod.yml ps                     # health column
docker compose -f docker-compose.prod.yml exec backend node -e "fetch('http://127.0.0.1:5000/readyz').then(r=>console.log(r.status))"        # 200 = API + database
docker compose -f docker-compose.prod.yml exec backend node -e "fetch('http://127.0.0.1:5000/health/worker').then(r=>console.log(r.status))"  # 200 = worker heartbeat fresh
curl -sS -o /dev/null -w '%{http_code}\n' https://hrsystem.udigity.com/login                                                                   # 200 from outside
```

Docker never restarts an `unhealthy` container, and the in-app alerts (`ops_alerts` mails) need the database, the worker and SMTP
all working, so two independent watchers are set up (no new services):

1. **External uptime probe** (free tier of UptimeRobot / Better Stack / healthchecks.io): HTTPS check on
   `https://hrsystem.udigity.com/login` every 1-5 min, expecting 200 (optionally the keyword "Sign in"), alerting `<operator e-mail>`.
   `/healthz` is hidden at the edge by design, so `/login` is the probe URL.
2. **Host cron** `devops/scripts/host-monitor.sh` every 10 minutes (`crontab -e` as the deploy user):
   `*/10 * * * * cd /opt/udigity && devops/scripts/host-monitor.sh >> /var/log/udigity-monitor.log 2>&1`
   It checks the public URL, disk use (>= 80%), containers not running or unhealthy, raw WAL backlog (> 20 files), age of the last
   nightly dump (> 26 h), certificate expiry (< 14 days) and the worker heartbeat; it mails `ALERT_EMAIL_TO` (needs `mail` or
   `sendmail` on the host, for example `msmtp` with the same Gmail App Password) at most once per 6 hours per problem, and always
   logs. Optional `devops/env/monitor.env`: `HOST`, `DISK_WARN_PCT`, `WAL_MAX`, `PING_URL` (healthchecks.io dead-man ping on success).

**Disk and WAL growth.** The `backup` service raises an alert when raw WAL waiting for encryption exceeds `WAL_BACKLOG_MAX`, when a
volume reaches `DISK_ALERT_PCT`, or when no base backup is newer than 10 days; the host monitor repeats this from outside.
Retention (14/8/6 dumps, 2 base backups, WAL since the oldest base) bounds the backups volume. **If the disk is nearly full and
PostgreSQL is about to stop** (a failing `archive_command` keeps WAL in `pg_wal`): first free space (old files in `/backups`, Docker
logs); only if that is impossible set `archive_mode=off` for the `db` command in a temporary override and recreate `db` (this loses
point-in-time recovery until you switch it back and take a base backup with `backupd base`).

Logs: every service uses Docker's json-file driver with 10 MB x 5 files per service, so they rotate by themselves. The nginx access
log blanks the `token=` query value, so single-use reset and invitation links never reach it. Read logs with
`docker compose -f docker-compose.prod.yml logs --tail=100 <backend|worker|frontend|nginx|db|backup>`. Do not log or share env values.

---

## Drill log

| Date | File | Where | Result |
|---|---|---|---|
| 2026-10-26 | `udigity-20261026T113527Z.dump.gpg` (408 KB, gpg, test DB `udigity_test`) | Windows workstation, Docker Desktop | Checksum OK; restored in 86 s into a throwaway `postgres:17-alpine`; 28 migrations (latest `903_access_facts_v4.sql`), 51 tables, 201 employees, 178 businesses; container removed. Backup itself took 4 s. age was not installed on this machine, so the gpg path was exercised; the age path was verified earlier (2026-10-23). |
| 2026-10-29 | backup container, local compose project `udigity-bkp-test` (fresh DB, 44 migrations, throwaway age key) | Windows workstation, Docker Desktop | (a) `udigity-20261029T130554Z.dump.age` (208 KB): checksum OK, restored in 30 s, 44 migrations, 58 tables. (b) PITR `base-20261029T130320Z.tar.gz.age` (4.2 MB) + 4 WAL segments: full replay in 108 s (last commit 13:07:44 UTC recovered); with `recovery_target_time` 13:07:00 it stopped before the 13:07:25 commit (91 s). WAL reached the encrypted store 2 s after `pg_switch_wal()`. Not a production drill: RPO/RTO still to be proven on the real server. |

Add one row per quarterly drill, from the production backup.
