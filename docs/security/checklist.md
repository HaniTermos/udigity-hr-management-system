# Security checklist: per-increment Definition of Done and production hardening

| Field | Value |
|---|---|
| Owner | Security Lead (`docs/security/`) |
| Date | 2026-10-23 |
| Status | CONTRACT. An increment is not DONE on the coordination board until every applicable item in Part A is ticked in its DONE post (list the item ids, or "n/a" with the reason) |
| Related | `threat-model.md` (ids such as AU-8 and HR-4), `authz-matrix.md` |

---

## Part A: Definition of Done for every increment

### A1. Input validation
- [ ] Every body, query and param is parsed with Zod `.strict()` schemas. UUID params use `z.string().uuid()`. Unknown keys return 400.
- [ ] Server-owned fields (actor, `created_by`, `version` as an input only, timestamps, `role` outside Owner employee edit) are never read from the body.
- [ ] Strings have a max length. Emails use `.email()` and reject `\r\n`. URLs must match `^https?://` (no `javascript:`). Phone numbers are normalized server-side.
- [ ] Sort and filter columns come from an allowlist map. No SQL string building from input. Only `$n` parameters.
- [ ] Times for attendance, attempts and audit come from the server clock. The client cannot supply them.
- [ ] Every write endpoint accepts an idempotency key where the architecture lists one (SEQ-04, SEQ-06, SEQ-11, SEQ-13).
- [ ] No GET handler changes state.

### A2. Authorization
- [ ] Every new route declares an action from `authz-matrix.md` and goes through `access.check` / `access.scopeFilter`. No ad-hoc `if (role === …)` in handlers, except `requireRole(['owner'])` on Owner-only admin routes.
- [ ] Matrix tests: one allowed and one denied case per role per action (authz-matrix §4.1).
- [ ] IDOR test for every `:id` route (§4.2).
- [ ] Hidden-record tests (§4.3) for any route that touches a business or a Table RT resource. Counts and totals are checked.
- [ ] Pending-2FA test for the new routes (§4.5).
- [ ] Mass-assignment test (§4.6).
- [ ] DEMO flags: both branches tested where the flag is FLAG. Code comments and UI copy say "Demonstration alternative — not approved (docs/policy-defaults.md)".
- [ ] Response DTOs per role or outcome. No raw row passthrough.

### A3. Audit events
- [ ] Every state change listed in the architecture G2 tables writes its audit event with `recordAuditEvent(client, …)` **inside the same transaction**.
- [ ] Event names follow `<entity>.<past_tense_verb>`. New names are marked "placeholder" until approved (G2).
- [ ] Rows include actor, role, session id, request id, entity, before/after (redacted), reason where required, and source workflow.
- [ ] No passwords, tokens, TOTP secrets, recovery codes or reset links in audit payloads. Free text is limited in length.
- [ ] Denied security-relevant actions are audited: `login.failed`, `report.export_denied`, `business.duplicate_blocked` (with `match_hidden`), reservation override.

### A4. Rate limits and abuse controls
- [ ] New auth-adjacent endpoints use `createAuthRateLimiter`.
- [ ] Duplicate check, list/search, export and heartbeat use the limits in threat model §5.9.
- [ ] Page size ≤ 100. Exports have row and time caps.
- [ ] Rate-limiter keys rely on `req.ip` only with `trust proxy = 1`.

### A5. Headers and CSP
- [ ] API: `helmet()` stays enabled. `Cache-Control: no-store` on every `/api` response (add a global middleware once and keep it). `X-Content-Type-Options: nosniff`.
- [ ] UI (Next headers or nginx): CSP from threat model §5.15 with `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` on `/reset-password`), `Permissions-Policy: geolocation=(self), camera=(), microphone=()`, HSTS (at nginx).
- [ ] No `dangerouslySetInnerHTML`. External links use `rel="noopener noreferrer"`.
- [ ] No new inline scripts without a nonce.

### A6. Cookies and sessions
- [ ] Session cookie: `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`, `__Host-` prefix in production, no `Domain`.
- [ ] CSRF cookie: not HttpOnly, the same flags otherwise. Every mutation from the UI sends `X-CSRF-Token`.
- [ ] No token in a response body, `localStorage`, URL or log. No Bearer path.
- [ ] Any new privilege change (role change, password change, 2FA change) ends or rotates the affected sessions.

### A7. Logging without PII or secrets
- [ ] Logs use only the allowed fields in threat model §5.12. No bodies, cookies, headers with credentials, emails, phones, business names or notes.
- [ ] Error responses are generic. Details go to the log with the request id only.
- [ ] Development-only logging (for example the reset link) is guarded by `config.env === 'development'`.
- [ ] No personal data in query strings. Use POST bodies or path ids.

### A8. Dependencies (`npm audit` gate)
- [ ] `npm ci` works from the committed lockfile.
- [ ] `npm audit --omit=dev --audit-level=high` passes for `backend` and `frontend`, **or** each finding has an entry in `docs/security/exceptions.md` (package, advisory id, why it is not reachable, expiry ≤ 30 days).
- [ ] Each new dependency was approved by a REQUEST. It has no unexpected install scripts, and security-relevant packages are pinned exactly.
- [ ] `tsc --noEmit` and lint pass. The lint rules forbid `dangerouslySetInnerHTML`, `eval` and `new Function`.

### A9. Migration safety
- [ ] Forward-only, in the agent's reserved number range, one transaction per file where PostgreSQL allows.
- [ ] Non-destructive: no `DROP`, no `DELETE`/`TRUNCATE` of data, no type narrowing. Use expand-then-contract across two releases.
- [ ] New FKs to `employees` are `ON DELETE RESTRICT`. No `CASCADE` or `SET NULL` on history tables.
- [ ] New tables holding history or audit-like data get an append-only trigger where the architecture says so.
- [ ] Grants: new tables are granted to the `app` role with least privilege. `audit_events` stays INSERT/SELECT only.
- [ ] Partial unique indexes enforce the invariants (one open attendance session, one active reservation, one open deal, one open follow-up, normalized phone).
- [ ] The migration is run first on the Docker test DB (`TEST_DATABASE_URL`). **Never on the local PostgreSQL 17 service.**
- [ ] If the access-facts view changes, the VT-7 contract test runs (RISK-18).

### A10. Secrets
- [ ] No secret, password, key or real email in code, tests, fixtures, docs or commit messages. Test values are generated or come from the seed.
- [ ] New config keys go into `.env.example` with a placeholder and a "Demonstration alternative" label if they are policy values. Production refuses to start when a required secret is missing.
- [ ] `git status` shows no `.env*` file staged (see SE-1).

---

## Part B: Increment-specific gates

| Increment / feature | Extra gate |
|---|---|
| Identity (Increment 1 follow-up) | AU-8 enrollment token; AU-9 recovery codes; AU-13 TOTP secret encryption; SE-4 seed production guard; DB suite run on the test DB, including migration 002 |
| Access engine (MOD-access) | `check` and `scopeFilter` from one rule table; VT-7 contract tests; startup self-test that every route declares an action |
| Attendance | OR-1..OR-8; office IP list "Not configured" means inactive; server time only |
| Business and duplicates | HR-1..HR-5; existence-only payload snapshot test (no `id` key in the body); duplicate rate limit |
| Calling | Lease token validation; B7 check on every calling action; idempotent call save; Accepted keeps reservation (approved) |
| Deals and projects | DEC-005 and DEC-006 flags both tested; closure needs signature and payment; project provisioning idempotent |
| Notifications and email (nodemailer) | EM-1..EM-7; send-time re-check (HR-7); template escaping test with `\r\n` and `<script>` in a business name; no real external email without user approval (dev transport or log) |
| Reports and export | EX-1..EX-5; CSV injection test; step-up 2FA; caps; no file stored |
| Audit viewer | Read-only; no export; Owner only with 2FA |

---

## Part C: Production hardening for the single VPS

Not executed by any agent (no production deploy without the user). This is the release gate for DevOps.

### C1. Host and firewall
- [ ] Ubuntu LTS (or Debian stable) with `unattended-upgrades` for security updates.
- [ ] `ufw` default deny incoming. Allow 443/tcp, 80/tcp (redirect and ACME only) and 22/tcp **from the operator's IPs only**.
- [ ] SSH: key-only (`PasswordAuthentication no`), `PermitRootLogin no`, a non-root sudo user, `fail2ban` on sshd.
- [ ] Docker publishes **only** nginx ports. `db`, `api`, `web`, `worker` have no `ports:` entry. Check with `ss -tlnp` and an external scan (`nmap`) after deploy.
- [ ] Docker daemon is not exposed on TCP. Containers run as non-root (`USER node`), with `read_only: true` where possible, `no-new-privileges`, and dropped capabilities.
- [ ] Disk alerts at 80% (RISK-16). Log rotation (`max-size`, `max-file` in the Docker logging driver).

### C2. TLS and nginx
- [ ] TLS 1.2 and 1.3 only, Mozilla "intermediate" ciphers, OCSP stapling, automatic ACME renewal with an expiry alert.
- [ ] `return 301 https://…` on port 80 (except `/.well-known/acme-challenge/`).
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains` (add `preload` only once it is stable).
- [ ] `proxy_set_header X-Forwarded-For $remote_addr;` (overwrite, OR-1). `proxy_set_header Host $host;`. `X-Forwarded-Proto https`.
- [ ] `server_tokens off`. `client_max_body_size 1m`. Timeouts (`proxy_read_timeout 30s`). `limit_req_zone` 20 r/s per IP with a burst of 40. A stricter zone on `/api/auth/`.
- [ ] Security headers for the UI from A5 (CSP, frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy).
- [ ] No `proxy_cache` for `/api`. `proxy_buffering off` on the export route.
- [ ] `/readyz` and `/health/worker` are not public: `allow` only the uptime monitor and localhost, otherwise `deny all`.
- [ ] Express runs with `TRUST_PROXY=true` (exactly 1 hop), `NODE_ENV=production`, `APP_ORIGIN=https://<host>`, `ALLOW_MISSING_ORIGIN` unset.

### C3. PostgreSQL access
- [ ] Listens only on the private Docker network. No published port. `pg_hba.conf` has `scram-sha-256` only and no `trust`.
- [ ] Separate roles: `migration` (owner of the schema and tables, DDL), `app` (DML only; `INSERT, SELECT` only on `audit_events`; cannot alter triggers), `backup` (read, `pg_read_all_data`), `readonly_ops` (optional).
- [ ] Passwords are random with ≥ 32 characters, one per role, from secret files.
- [ ] `log_connections` on. `log_statement = 'ddl'` (not `all`: avoid personal data in logs).
- [ ] Postgres 17 minor updates applied monthly.

### C4. Backups (encrypted)
- [ ] Nightly `pg_dump -Fc` streamed through `age` (or `gpg`) with the **public** key, then uploaded. No plaintext ever touches the disk.
- [ ] The off-VPS bucket has versioning and object lock. Retention is 14 daily, 8 weekly, 6 monthly (demo default). The VPS credentials are write-only (no delete or list of old versions where the provider allows it).
- [ ] An on-demand backup is taken and verified before every migration (ADR-014).
- [ ] The private key exists only in the restore environment, plus a sealed offline copy. Its presence is checked at every drill.
- [ ] Quarterly restore drill off the VPS (demo default). The result is reported to the Owner. A missed drill raises an alert.
- [ ] Restore runbook step 7: end all sessions after a restore.

### C5. Secrets in env, not in the repo
- [ ] A root `.gitignore` exists and covers `.env`, `.env.*` (except `.env.example`), dumps and key files (**SE-1, currently missing**).
- [ ] `gitleaks` (or similar) runs as a pre-commit hook and in CI. The whole history is scanned once before the repo is pushed to any remote.
- [ ] Production secrets live in root-only files on the host (mode 600) or Docker secrets, injected at runtime. They are not in images, compose labels or CI logs. `.dockerignore` excludes `.env*`.
- [ ] Required production secrets: `SESSION_SECRET` (≥ 32 random bytes), DB role passwords, `TOTP_ENC_KEY`, SMTP credentials, storage credentials, the backup **public** key. The app refuses to start without the required ones.
- [ ] The seed script refuses to run in production. The Owner is bootstrapped by CLI with a random password and an enrollment token, both shown once.
- [ ] Each secret has a rotation procedure in the runbook. Rotating `SESSION_SECRET` ends all sessions.

### C6. Monitoring and response
- [ ] External uptime check on `https://<host>/healthz`.
- [ ] Alerts for: backup failure or age > 26 h, disk > 80%, certificate expiry < 14 days, worker heartbeat stale, spikes of `login.failed` or `business.duplicate_blocked`.
- [ ] Incident steps in the runbook: revoke all sessions, rotate `SESSION_SECRET` and DB passwords, export the audit tail for review, restore if data was damaged.

### C7. Release gate (all must be true)
- [ ] Every Part A item is closed for all shipped increments.
- [ ] `npm audit` gate passes (A8).
- [ ] P0 and P1 findings in threat model §7 are closed.
- [ ] Smoke test passes on the deployed host: login, Owner 2FA, one read, a cross-site POST is rejected, the API port is not reachable from outside, response headers are present (check with `curl -I`).
