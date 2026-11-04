# Deployment checklist — Hostinger VPS behind the existing proxy, `https://hrsystem.udigity.com`

Status: updated after the 2026-11-04 fix phase (FIX-OPS). Nothing here has been executed on the server. Owner decision S-28: public
origin `https://hrsystem.udigity.com`; the VPS already runs other sites / a proxy on ports 80 and 443, so the app runs **behind**
that proxy. Server facts are NOT known: every item marked **[inspect]** must be checked first. Commands: `devops/DEPLOY.md`.
Do not deploy without the Owner's go-ahead.

Legend: **O** = Owner decision/approval, **D** = developer with SSH, **H** = Hostinger panel (Owner login).

## 0. Decisions needed from the Owner

| # | Decision | Who |
|---|---|---|
| 0.1 | ~~Public host~~ settled: `hrsystem.udigity.com` (S-28) | done |
| 0.2 | Confirm the hosting product is a **VPS with root access** (Docker cannot run on shared/web/cloud hosting) **[inspect]** | O / H |
| 0.3 | Approve adding one vhost for `hrsystem.udigity.com` to the existing proxy (no other site is touched) | O + D |
| 0.4 | Approve where off-server backup copies go (S-23 accepts same-server; any off-server destination needs approval) | O |
| 0.5 | Approve real e-mail (Gmail + App Password chosen) and the alert recipient `ALERT_EMAIL_TO` | O |
| 0.6 | Confirm company timezone and office public IP(s) (`POLICY_COMPANY_TIMEZONE`, Settings) | O |
| 0.7 | Approve the external uptime monitor account (UptimeRobot / Better Stack / healthchecks.io, free) and its recipient | O |

## 1. Inspect the server (read-only, D; nothing changes)

1. OS, CPU/RAM/disk: `lsb_release -a; nproc; free -h; df -h`. The stack caps at about 2.6 GB RAM; need that free next to the other sites **[inspect]**
2. Who owns 80/443 and is 8080 free: `ss -ltnp | grep -E ':(80|443|8080) '`. Which proxy: nginx, Apache, OpenLiteSpeed/CyberPanel, Caddy, Traefik/Coolify **[inspect]**; is it on the host or in Docker?
3. Docker + Compose v2 installed? Other compose projects? Subnets in use: `docker network inspect $(docker network ls -q) --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'`; **172.29.10/20/30.0/24 must be free** (else change them in `.env` and `TRUSTED_PROXY_CIDRS`) **[inspect]**
4. Where the vhosts live and how certificates are issued/renewed for the other sites (certbot, panel, Caddy) **[inspect]**
5. Firewall (hPanel + `ufw status`) and SSH access method: record, do not change **[inspect]**. The only addition planned is the worker egress rule (SMTP host:port only, `DOCKER-USER` chain, DEPLOY section 15): the Owner approves it, and the go-live record says whether it is in place.
6. Hostinger snapshots/automatic backups: available, schedule, price (affects the S-23 recovery story) **[inspect]**
7. Outbound SMTP to `smtp.gmail.com:465` reachable? `mail`/`sendmail`/`msmtp` present for the host monitor? **[inspect]**
8. DNS zone for `udigity.com`: Hostinger or elsewhere? Is a CDN/proxy (Cloudflare) in front? If yes, the outer proxy template's CDN note applies **[inspect]**

## 2. DNS and certificate (H / D)

1. `A` record `hrsystem` -> server IPv4 (`AAAA` only if IPv6 works end to end). (H)
2. `dig +short hrsystem.udigity.com` returns the server address. (D)
3. Issue the certificate **with the tool the existing proxy already uses**, after adding the vhost (DEPLOY.md section 5, templates in `devops/proxy/`): `certbot --nginx` / `--apache` / panel "Issue SSL" / Caddy automatic. Never `--standalone`, never stop the proxy. (D/H)
4. Check renewal (`certbot renew --dry-run` or the panel equivalent) and note the expiry date; `host-monitor.sh` watches it. (D)

## 3. Repository (done in the fix phase; D reviews)

1. Host name: `hrsystem.udigity.com` in `devops/nginx/conf.d/udigity.conf`, env examples, runbooks (G-03). Remaining placeholders are intentional templates (`<owner e-mail>`, `SMTP_FROM=no-reply@example.com`, the CI/smoke dummy hosts).
2. Behind-proxy topology: nginx on `127.0.0.1:8080`, real-IP handling, pinned subnets, exact `TRUSTED_PROXY_CIDRS=172.29.10.10/32` (G-01/02/04).
3. Limits, grace periods, digests, SHA-pinned actions, persisted image tag, `deploy.sh`, `host-monitor.sh`, backup growth guards (G-05..G-10).
4. Push the revision and get CI green once billing is fixed (account-side); otherwise run `devops/scripts/predeploy-gate.sh all` (typecheck, lint, tests, `npm audit`, gitleaks, Trivy; DEPLOY section 14) and `devops/scripts/prod-smoke.sh` on a Linux machine on the exact commit to deploy (it needs Docker; on Windows the real-IP check is skipped). `deploy.sh` runs the gate itself; a skip needs `--skip-gate "reason"` and is logged. (D, O for billing)
5. FIX2-OPS hardening in the repo (T-02..T-08, gaps 3-5, 7-9, 13-14): `cap_drop`/read-only on `db` and `nginx`, `--ignore-scripts`, `noexec` tmpfs, security headers from the edge only, `X-Powered-By` off, redacting outer-proxy access logs, non-superuser migration role `udigity_owner` (superuser is `udigity_admin`), single API replica, Dependabot. Review them with the DEPLOY.md sections 14-16.

## 4. Host setup (D)

1. Non-root deploy user in the `docker` group; use the existing one if there is one. **Do not change** existing SSH/firewall/proxy settings. **[inspect]**
2. Nothing new is exposed: the app listens on `127.0.0.1:8080` only.
3. Code to `/opt/udigity` (read-only deploy key or release tarball) **[inspect: how the Owner wants code delivered]**.
4. `cp devops/env/compose.env.example .env && chmod 600 .env`; `deploy.sh` writes `UDIGITY_TAG` into it.

## 5. Secrets (D generates on the server, O keeps copies; never in chat/tickets)

1. `cp devops/env/*.env.example` -> `*.env`, `chmod 600`.
2. `SESSION_SECRET`, `TOTP_ENC_KEY` (`openssl rand -hex 32`); four different DB passwords (bootstrap superuser `udigity_admin`, schema owner `udigity_owner`, `udigity_api`, `udigity_backup`). Rotation procedure for the two keys: DEPLOY section 16.
3. `APP_ORIGIN=PUBLIC_APP_URL=https://hrsystem.udigity.com` (exactly: lower case, no trailing slash; the API refuses to start otherwise). `TRUSTED_PROXY_CIDRS=172.29.10.10/32`. `POLICY_COMPANY_TIMEZONE` (O).
4. Real e-mail OFF for the first start (`SMTP_HOST` empty, `EMAIL_ALLOW_REAL_SEND=false`).
5. **O** generates the age key pair on the Owner's machine (`age-keygen`), keeps two offline copies of the private key, sends only `age1...` for `AGE_RECIPIENT`.
6. Back up `TOTP_ENC_KEY` outside the server and outside the DB backups.
7. `devops/scripts/check-env.sh` must print `PASSED`.

## 6. First start (D)

1. `devops/scripts/deploy.sh` (build, db, migrate, backup-role grant, tag written to `.env`, `up --wait`); `docker compose -f docker-compose.prod.yml ps`: all `healthy` (backup after its first check, up to 5 min).
2. Add the outer-proxy vhost and certificate (section 2) if not done; reload the proxy with its own config test (`nginx -t`, `apachectl configtest`, `caddy validate`).
3. From outside: `/login` 200 over HTTPS with HSTS; `/healthz`, `/readyz`, `/health/*` 404; http redirects to https; `udigity.com` and the other sites unchanged.
4. Client address check: log in from the office and confirm the attendance office-IP result (or `docker compose logs nginx` shows the visitor's public address, not 172.29.x.x) (G-02).
5. Verify DB role limits (DEPLOY section 8); reboot test when the Owner allows: after `reboot`, `docker compose ps` shows the same tag (G-10).
6. Create the first Owner with the bootstrap CLI (DEPLOY section 9); hand password and 2FA token over separate channels. (O)

## 7. Recovery proof (D + O) — required before go-live

1. **Go-live gate.** Copy backups off the server (encrypted) to the Owner's workstation; run restore drill (a) dump and (b) PITR with the private key (exact commands and the expected output to record: DEPLOY section 11); record both in the DEPLOY drill log. RPO 15 min / RTO 4 h are objectives until this passes; go-live does not proceed without both rows.
2. Decide the off-server copy and/or Hostinger snapshot schedule (0.4, 1.6).
3. Rehearse `deploy.sh rollback` once on the first update (previous tag kept, pre-update dump taken).

## 8. Monitoring (D, O approves recipients)

1. External uptime probe on `https://hrsystem.udigity.com/login` (every 1-5 min, e-mail/phone alert). (0.7)
2. Host cron `devops/scripts/host-monitor.sh` every 10 min (disk, containers, WAL backlog, backup age, certificate, worker heartbeat; mails `ALERT_EMAIL_TO`); test it by temporarily lowering `DISK_WARN_PCT` in `devops/env/monitor.env`.
3. Set `ALERT_EMAIL_TO`; send a test alert.

## 9. Go-live (O decides)

1. Real e-mail on (O's go-ahead): Gmail values (`SMTP_FROM` = the Gmail address), `check-env.sh`, recreate `backend worker`, send a reset to a test account you own.
2. Owner saves company timezone and office IPs in Settings (attendance stays "Not configured" until then).
3. Smoke through the real URL: login, 2FA, one page of each role, logout; confirm the other sites still work.
4. Announce; keep the pre-go-live dump and previous images for at least a week.

## 10. After go-live

Weekly check of backup age and disk (the monitor automates it); quarterly restore drill; monthly image refresh (re-pin digests with `docker buildx imagetools inspect`, rebuild, deploy); certificate renewal watched; review `ops_alerts`.
