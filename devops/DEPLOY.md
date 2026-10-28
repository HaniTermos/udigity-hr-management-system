# Deploying Udigity on a single Ubuntu VPS

Step-by-step runbook for Ubuntu 24.04 LTS. Run it only with the Owner's go-ahead. It uses only files and commands
that exist in this repository (`docker-compose.prod.yml`, `devops/**`, `backend` scripts). Reference detail lives in
`devops/README.md`. Replace `app.example.com` with the real host name throughout.

Stack: `nginx` (80/443, the only published ports) -> `frontend` and `backend` -> `db` (PostgreSQL 17); `worker` runs
`node dist/worker.js` from the backend image. `db`, `backend` and `frontend` sit on an internal network with no
internet route. The `worker` is on the internal network plus an outbound-only `egress` network (it needs the external
SMTP server); it publishes no port and is not on the public network, so nothing reaches it from outside.

Two database roles: `udigity_owner` (superuser/owner) runs migrations and backups through the one-shot `migrate` job;
the API and worker run as `udigity_api`, a limited login role (member of the group role `udigity_app` from migration
012: DML on all tables, `SELECT` + `INSERT` only on `audit_events`, no `UPDATE`/`DELETE`, owns nothing). The owner
credentials live in `migrate.env`, which only the `migrate` job loads.

Sizing: 2 vCPU, 4 GB RAM, 40 GB disk is a sensible minimum.

---

## 1. DNS

Create an `A` record for `app.example.com` pointing at the VPS public IPv4 (and `AAAA` if you use IPv6). Wait until
`dig +short app.example.com` returns the VPS address before requesting a certificate.

## 2. Host hardening and firewall

```sh
adduser deploy && usermod -aG sudo deploy         # non-root deploy user; copy your SSH key to ~deploy/.ssh
# In /etc/ssh/sshd_config set: PermitRootLogin no, PasswordAuthentication no ; then: systemctl reload ssh
apt update && apt -y upgrade && apt -y install ufw unattended-upgrades git age certbot logrotate
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable && ufw status verbose                    # only 22, 80, 443 open
```

Docker publishes ports by editing iptables directly, so ufw alone does not guard them. That is safe here because only
`nginx` publishes ports (80/443) and the database has none. Never add `ports:` to `db`.

## 3. Install Docker Engine and the Compose plugin

Follow the official apt repository instructions at https://docs.docker.com/engine/install/ubuntu/ (packages
`docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`), then:

```sh
usermod -aG docker deploy        # log out and back in as deploy
docker compose version
```

## 4. Get the code

```sh
sudo mkdir -p /opt/udigity && sudo chown deploy:deploy /opt/udigity
git clone <repository-url> /opt/udigity && cd /opt/udigity     # or unpack a release tarball
git rev-parse --short HEAD                                      # note this: it becomes the image tag (section 9)
```

All commands below run from `/opt/udigity`.

## 5. Point nginx at the host name

Edit `devops/nginx/conf.d/udigity.conf`: change `server_name app.example.com;` in the 443 server block to the real host.

## 6. TLS certificate (Let's Encrypt)

nginx cannot start without a certificate (the 443 block loads it), so request the first one while port 80 is free:

```sh
sudo certbot certonly --standalone -d app.example.com -m you@your-domain --agree-tos
sudo cp -L /etc/letsencrypt/live/app.example.com/fullchain.pem devops/nginx/certs/fullchain.pem
sudo cp -L /etc/letsencrypt/live/app.example.com/privkey.pem   devops/nginx/certs/privkey.pem
sudo chmod 640 devops/nginx/certs/*.pem
```

Automatic renewal (certbot installs a systemd timer). Because nginx will hold port 80, stop it around renewal and copy
the new files in with hooks. Create these three scripts (`chmod +x` each):

```sh
# /etc/letsencrypt/renewal-hooks/pre/udigity-stop-nginx.sh
#!/bin/sh
cd /opt/udigity && docker compose -f docker-compose.prod.yml stop nginx

# /etc/letsencrypt/renewal-hooks/deploy/udigity-copy-certs.sh
#!/bin/sh
cp -L /etc/letsencrypt/live/app.example.com/fullchain.pem /opt/udigity/devops/nginx/certs/fullchain.pem
cp -L /etc/letsencrypt/live/app.example.com/privkey.pem   /opt/udigity/devops/nginx/certs/privkey.pem

# /etc/letsencrypt/renewal-hooks/post/udigity-start-nginx.sh
#!/bin/sh
cd /opt/udigity && docker compose -f docker-compose.prod.yml up -d nginx
```

Test with `sudo certbot renew --dry-run` once the stack is up (renewal causes a few seconds of downtime).
(The webroot directory `devops/nginx/acme` is also served on port 80 at `/.well-known/acme-challenge/` if you prefer
`--webroot -w /opt/udigity/devops/nginx/acme` renewal without downtime.)

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
| `APP_ORIGIN`, `PUBLIC_APP_URL` | `https://app.example.com` (your host) |
| `POLICY_COMPANY_TIMEZONE` | required (BL-16), IANA name, e.g. `Asia/Beirut`; confirm with the Owner. Without it (and no Owner-saved value) `/readyz` answers 503. The alias `COMPANY_TIMEZONE` is only a fallback |
| `POLICY_ATTENDANCE_OFFICE_IPS` | office public IP(s), comma-separated; may stay empty ("Not configured") |
| `AGE_RECIPIENT` (backup.env) | public key from `age-keygen -o udigity-backup.agekey` run on the Owner's machine (section 11) |

Then validate (prints key names only, never values; exits 1 on any error):

```sh
cd /opt/udigity && devops/scripts/check-env.sh
```

Fix every `ERROR` line before going on. Leave real email off for now (`SMTP_HOST` empty, `EMAIL_ALLOW_REAL_SEND=false`).
`PUBLIC_APP_URL` is the base of every invitation and password-reset link: it must be a bare `https://` origin (no path,
query or credentials); the API and the worker refuse to start otherwise. Links never use request headers.

## 8. Build, migrate, start

```sh
export UDIGITY_TAG=$(git rev-parse --short HEAD)       # image tag; keep it exported for the rest of the session
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d db   # first start of an empty volume creates the udigity_api login role
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps            # every service should reach "healthy"
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
  node dist/modules/identity/bootstrap.js --email owner@your-domain --name "Owner Full Name"
```

The terminal prints, once, a random initial password and a one-time 2FA enrollment token (valid 24 h). Hand both to the
Owner over separate channels and do not store them in shell history or chat. The Owner signs in at
`https://app.example.com/login`, enrols the authenticator app (the password is required again at enrollment) and
saves the recovery codes.

Recovery procedures with the same CLI (verify the person's identity out of band first):

```sh
# Owner lost the authenticator AND the recovery codes: un-enrol 2FA, end sessions, issue a new token
docker compose -f docker-compose.prod.yml run --rm backend \
  node dist/modules/identity/bootstrap.js --email owner@your-domain --reset-2fa --reason "ticket or reason"
# Re-encrypt any TOTP secret still stored in plaintext (one-off backfill)
docker compose -f docker-compose.prod.yml run --rm backend \
  node dist/modules/identity/bootstrap.js --encrypt-existing
```

## 10. Smoke test and real email

```sh
curl -sSI https://app.example.com/login | head -20      # 200, HSTS and nosniff present
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
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587                  # 465 with SMTP_SECURE=true
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@your-domain     # plain address, domain with SPF/DKIM/DMARC
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

Policy C1: RPO 24 h, RTO 4 h, retention 14 daily / 8 weekly / 6 monthly, restore drill quarterly.

1. On the **Owner's workstation** (not the VPS) generate the key pair: `age-keygen -o udigity-backup.agekey`. Keep two
   offline copies of that file (password manager plus a USB stick in a safe). Only the public key (`age1...`) goes on the
   server: set `AGE_RECIPIENT` in `devops/env/backup.env`. For gpg instead, set `BACKUP_ENCRYPTION=gpg` and
   `GPG_RECIPIENT` (see `devops/backup/README.md`).
2. Set `BACKUP_DIR` (default `/var/backups/udigity`) and, for the off-site copy, `RCLONE_REMOTE` (an rclone remote such
   as `s3remote:udigity-backups`; install rclone and run `rclone config` as the cron user). Files are already encrypted
   before they leave the server. Re-run `devops/scripts/check-env.sh`.
3. Run one backup by hand and look at the result:
   ```sh
   sudo mkdir -p /var/backups/udigity && sudo chown deploy:deploy /var/backups/udigity
   devops/backup/pg-backup.sh && ls -l /var/backups/udigity/daily
   ```
4. Schedule it (`crontab -e` as `deploy`) and rotate its log:
   ```
   30 2 * * * /opt/udigity/devops/backup/pg-backup.sh >> /var/log/udigity-backup.log 2>&1
   ```
   ```sh
   printf '/var/log/udigity-backup.log {\n  weekly\n  rotate 8\n  compress\n  missingok\n  notifempty\n}\n' | sudo tee /etc/logrotate.d/udigity-backup
   sudo touch /var/log/udigity-backup.log && sudo chown deploy /var/log/udigity-backup.log
   ```
5. **Off-site check:** confirm `rclone ls $RCLONE_REMOTE` lists the newest `udigity-*.dump.age` the morning after the first
   cron run.

### Restore drill (before go-live, then quarterly, on a workstation with Docker)

Copy a backup and its `.sha256` from the server (or from the off-site store), then:

```sh
AGE_IDENTITY=~/keys/udigity-backup.agekey devops/backup/restore-drill.sh udigity-<stamp>.dump.age
```

It verifies the checksum, restores into a throwaway `postgres:17-alpine` container (tmpfs, no published port), prints
migration, table and row counts and removes the container. Record the date, the file and the duration in the drill
log (below). On Git Bash for Windows prefix with `MSYS_NO_PATHCONV=1`.

### Real restore (disaster)

```sh
docker compose -f docker-compose.prod.yml stop backend worker frontend nginx
age -d -i ~/keys/udigity-backup.agekey < udigity-<stamp>.dump.age > /dev/shm/restore.dump     # RAM only
docker compose -f docker-compose.prod.yml exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' < /dev/shm/restore.dump
shred -u /dev/shm/restore.dump
# The restore drops privileges (--no-privileges): recreate the limited runtime role and its grants (idempotent).
docker compose -f docker-compose.prod.yml exec -T db sh /docker-entrypoint-initdb.d/10-app-role.sh
docker compose -f docker-compose.prod.yml up -d
```

If the broken database can still be dumped, take a fresh backup of it first.

## 12. Updates and rollback

```sh
cd /opt/udigity
devops/backup/pg-backup.sh                                       # 1. backup first
PREV=${UDIGITY_TAG:-$(docker inspect --format '{{.Config.Image}}' $(docker compose -f docker-compose.prod.yml ps -q backend) | cut -d: -f2)}
echo "$PREV" > /opt/udigity/.previous-tag                         # 2. remember the running tag
git pull
devops/scripts/check-env.sh                                      # 3. new keys added by the release?
export UDIGITY_TAG=$(git rev-parse --short HEAD)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps                     # all healthy
```

Migrations are forward-only and non-destructive. **Rollback:** run the previous images (they are still on the host):

```sh
export UDIGITY_TAG=$(cat /opt/udigity/.previous-tag)
docker compose -f docker-compose.prod.yml up -d
```

That is safe when the release added only additive migrations (the normal case). If a migration must be undone, stop
the stack and do the "Real restore" above with the backup from step 1, then start the previous tag. Reclaim disk with
`docker image prune` only after the new release has been stable for a few days.

## 13. Monitoring and log rotation

Health endpoints are blocked at the edge (404) and reachable only inside the stack:

```sh
docker compose -f docker-compose.prod.yml ps                     # health column
docker compose -f docker-compose.prod.yml exec backend node -e "fetch('http://127.0.0.1:5000/readyz').then(r=>console.log(r.status))"        # 200 = API + database
docker compose -f docker-compose.prod.yml exec backend node -e "fetch('http://127.0.0.1:5000/health/worker').then(r=>console.log(r.status))"  # 200 = worker heartbeat fresh
curl -sS -o /dev/null -w '%{http_code}\n' https://app.example.com/login                                                                   # 200 from outside
```

Wire an external uptime monitor to `https://app.example.com/login` (the only public probe) and alert on the worker
check by running the `/health/worker` command above from cron and mailing/paging on a non-200. Also watch disk
(`df -h /var/lib/docker /var/backups/udigity`), the age of the newest file in `/var/backups/udigity/daily`, and the
certificate expiry (`sudo certbot certificates`).

Logs: every service uses Docker's json-file driver with 10 MB x 5 files per service (set in
`docker-compose.prod.yml`), so container logs rotate by themselves. Read them with
`docker compose -f docker-compose.prod.yml logs --tail=100 <backend|worker|frontend|nginx|db>`. The backup log is rotated by
the logrotate rule in section 11. Do not log or share env values.

---

## Drill log

| Date | File | Where | Result |
|---|---|---|---|
| 2026-10-26 | `udigity-20261026T113527Z.dump.gpg` (408 KB, gpg, test DB `udigity_test`) | Windows workstation, Docker Desktop | Checksum OK; restored in 86 s into a throwaway `postgres:17-alpine`; 28 migrations (latest `903_access_facts_v4.sql`), 51 tables, 201 employees, 178 businesses; container removed. Backup itself took 4 s. age was not installed on this machine, so the gpg path was exercised; the age path was verified earlier (2026-10-23). |

Add one row per quarterly drill, from the production backup.
