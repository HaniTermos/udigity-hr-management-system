# Threat model: Udigity Management System

| Field | Value |
|---|---|
| Owner | Security Lead (`docs/security/`) |
| Date | 2026-10-23 |
| Status | CONTRACT for the full build. Agents implement the mitigations; changes go through a REQUEST on `docs/implementation/coordination.md` |
| Scope | Express API (`backend/src/**`), worker, Next.js UI, PostgreSQL, reverse proxy, backups, email, the single VPS |
| Grounded in | `backend/src/**` as of Increment 1 (§9 of `docs/implementation/status-2026-10-23.md`), `architecture-a.md` §2, §4.5, §5, §6, ADR-001..019, `architecture-b.md` §5–§9, `phase2/shared-baseline.md` §4, §6 C, §10, `phase2/batch2/batch2-spec.md` Table RT and VT-1..VT-6, `policy-defaults.md` |
| Not read | Any `.env*` file |
| Companion docs | `authz-matrix.md` (who may do what), `checklist.md` (per-increment Definition of Done) |

Policy labels: values marked **(demo default)** come from `policy-defaults.md`. They are "Demonstration alternative — not approved". Only "Accepted keeps reservation" is approved. Owner 2FA, Owner-only export and audit, and the per-user 15-day rule are Confirmed baseline rules.

---

## 1. System summary

- About 6 users with one role each: `owner`, `data_entry`, `call_center`, `developer`. The users are trusted employees, but each one has a limited scope.
- Docker Compose runs on one VPS. Only the reverse proxy (nginx) is public. Next.js renders the UI only (ADR-002). Express is the only component that makes decisions. A worker shares the Express codebase. PostgreSQL is reachable only on the private network.
- The session is opaque and server-side. The cookie holds a random token, and the database stores only its HMAC (`sessions.token_hash`). The Owner must pass TOTP 2FA. Every request re-reads the account status.
- No attachments in v1 (ADR-012, DEC-018). Exports are synchronous, streamed and never stored (ADR-010). Email is a log stub today. Real delivery will use nodemailer through the outbox and job J-02.

## 2. Assets

| ID | Asset | Why it matters | Confidentiality / Integrity / Availability |
|---|---|---|---|
| A1 | Credentials: bcrypt hashes, TOTP secrets (plaintext today), future recovery codes | Account takeover, including the Owner | C: critical |
| A2 | Session tokens, CSRF nonces, reset tokens (`security_tokens`) | Live impersonation | C: critical |
| A3 | `SESSION_SECRET`, DB role passwords, SMTP key, backup keys, storage credentials | Forging token hashes, reading the DB, reading or deleting backups | C: critical |
| A4 | Business records: names, phones, socials, notes | The company's commercial asset. It leaks through hidden-record failures and exports | C: high, I: high |
| A5 | Call logs, outcomes, follow-ups, reservations | Sales pipeline. Do-not-call integrity has legal and reputational impact | I: high |
| A6 | Deals: stage, signature, payment, amounts | Revenue reporting. Closure is Owner-verified (DEC-006, demo default) | I: critical |
| A7 | Attendance: check-in/out times, IP/location evidence, corrections | Employee personal data and the basis for pay and discipline | C: high, I: high |
| A8 | Employee directory and profiles (email, phone, photo) | Personal data | C: high |
| A9 | Audit trail (`audit_events`) | Proves who did what. It must be append-only (G3) | I: critical |
| A10 | Settings: office IP list, schedule, targets, policy flags | A changed setting silently changes the rules | I: high |
| A11 | Backups (encrypted dumps off the VPS) | Full copy of A1–A10 | C: critical, A: critical |
| A12 | Availability of the single VPS | The company runs on it every day | A: high |

## 3. Trust boundaries

| ID | Boundary | Crossing data | Controls in place / required |
|---|---|---|---|
| TB1 | Internet → nginx (443/80) | All HTTP | TLS, HSTS, request size limits, header normalization (`X-Forwarded-For` overwritten, not appended) |
| TB2 | nginx → Next.js / Express (private network) | Requests with the forwarded client IP | `TRUST_PROXY=true` with exactly 1 hop. Express trusts only `X-Forwarded-For` set by nginx |
| TB3 | Next.js server → Express | Forwarded cookie | Next holds no DB credentials and makes no decisions. `INTERNAL_API_URL` is private |
| TB4 | Express/worker → PostgreSQL | SQL | Parameterized SQL only. Separate roles: `app` (no UPDATE/DELETE on audit), `migration` (DDL), `backup` (read) |
| TB5 | Worker → SMTP provider | Email content | TLS to the provider. Content is built at send time after the access re-check (C6) |
| TB6 | Backup runner → object storage | Encrypted dumps | Public-key encryption on the VPS. The private key stays off the VPS (ADR-013 A-2) |
| TB7 | Operator → VPS (SSH) | Shell, secrets | Key-only SSH, source-IP allowlist, root-only secret files |
| TB8 | Role boundary inside the app | Every API call | Shared access engine (`check` / `scopeFilter`, ADR-017). See `authz-matrix.md` |
| TB9 | CI / npm registry → build | Dependencies | Lockfile, `npm ci`, audit gate (§5.14) |

## 4. Attacker profiles and capabilities

| ID | Attacker | Capabilities | Main goals |
|---|---|---|---|
| T1 | Anonymous internet user | Reaches nginx. Can script requests, guess passwords and replay links | Account takeover, user enumeration, DoS |
| T2 | Insider with a valid non-Owner account (Data Entry, Call Center, Developer) | Valid session and CSRF token. Can craft any API request, edit IDs in URLs and bodies, and read their own network traffic | Read hidden or other people's records, take colleagues' leads, fake attendance, export the business list, cover their tracks |
| T3 | Former employee | Knows old URLs and IDs. May still hold a cookie or reset email, and knows the office network | Keep access after deactivation |
| T4 | Malicious web page visited by a logged-in user | Cross-site requests, top-level navigation, `<img>`/form posts | CSRF, clickjacking |
| T5 | Attacker holding the Owner password only (phished or reused) | Logs in to the pending-2FA state | Bypass or enroll 2FA, reach admin functions |
| T6 | Attacker with VPS or DB access (stolen SSH key, leaked backup, misconfigured port) | Reads or changes tables, reads env/secret files | Bulk theft, audit tampering |
| T7 | Supply-chain attacker | Publishes a malicious npm version or typosquat | Code execution in the build or at runtime |
| T8 | Data planted in a field by T2 or an external party (business name, note, email address) | Stored strings that are later rendered in UI, email or export | XSS, email header/HTML injection, CSV formula injection |

## 5. Abuse paths and mitigations

Status: **Done** = in code with unit tests (Increment 1). **Partial** = some controls exist. **Required** = not built yet. The increment that adds the feature must deliver it.

### 5.1 Authentication, 2FA and sessions

| # | Abuse path | Mitigation (required behaviour) | Status |
|---|---|---|---|
| AU-1 | Online password guessing or credential stuffing (T1) | Per-IP limit (`express-rate-limit`, 20 per 15 min, demo default). Per-account lockout: 5 failures in 15 min locks for 15 min (demo default). bcrypt cost ≥ 10 (12 preferred) | Done |
| AU-2 | User enumeration by response or timing | The same 401 for unknown, wrong password, locked and deactivated accounts. Dummy bcrypt compare on the unknown path. Reset request always returns 202 | Done |
| AU-3 | TOTP brute force (10^6 codes) | Factor lockout per account. Reaching the threshold ends the pending session (`factor_threshold`). Per-IP limit. Pending window 10 min | Done |
| AU-4 | TOTP replay inside the 30 s window | `last_used_step`: a step is accepted only once. Window ±1 step at most | Done |
| AU-5 | Session fixation | Session rotation on 2FA success. Login always issues a new token and never accepts a client-supplied one | Done |
| AU-6 | Stolen cookie reused for a long time | Idle 2 h and absolute 12 h (demo default). HttpOnly, Secure, `__Host-` prefix in production. Token only in the cookie: no JSON body, no Bearer | Done |
| AU-7 | DB read reveals live sessions (T6) | Only the HMAC of the token is stored. 002 marks sessions holding pre-002 plaintext tokens as ended | Done (after 002 runs) |
| AU-8 | **First-enrollment takeover (T5):** an Owner without an enrolled factor logs in with the password only, reaches `pending_2fa_enrollment` and enrolls the attacker's authenticator | Owner enrollment must need a second proof besides the password: a one-time **enrollment token** issued by the operator CLI or seed (hashed in `security_tokens`, 24 h, single use), or enrollment allowed only from an office IP. Once a factor is enrolled, re-enrollment needs a valid TOTP or recovery code. Audit `two_factor.enrolled` with the IP | **Required (Increment 2, before any real Owner data)** |
| AU-9 | Owner loses the phone, then a social-engineering reset | 10 single-use recovery codes, hashed with bcrypt and shown once. The operator recovery procedure verifies identity out of band and is audited. A password reset never removes 2FA | Required |
| AU-10 | Reset-link theft or reuse | 32-byte random token, HMAC stored, single use, 60 min, row lock. Completing a reset ends all sessions and clears the lockout. The link is built from `PUBLIC_APP_URL`, **never from the Host header**. `Referrer-Policy: no-referrer` on `/reset-password` | Done (link base, policy header: Required) |
| AU-11 | Deactivated user keeps working (T3) | Account status is re-read on every request. Deactivation ends all sessions. Reset tokens of inactive accounts are refused. The worker re-checks status at send time | Done (worker: Required) |
| AU-12 | Pending Owner session reaches business data | R-11 flag `OWNER_PENDING_2FA_SCOPE` (demo default R11-a: only the auth routes). Admin routes are always denied while pending. Exact route matching | Done |
| AU-13 | TOTP secret readable at rest (T6) | Encrypt `two_factor_factors.secret` with AES-256-GCM. The key comes from env (`TOTP_ENC_KEY`), not from the DB. Rotation via a key id column | **Required** |
| AU-14 | Rate-limit state lost or split | The memory store works only while one API process runs. If the API scales to more than one process, move to the PostgreSQL store (ADR-004). The per-account lockout is already in the DB | Accepted for one process |

### 5.2 CSRF, clickjacking and cross-origin

| # | Abuse path | Mitigation | Status |
|---|---|---|---|
| CS-1 | Cross-site form or fetch to a mutating endpoint (T4) | Three layers: SameSite=Lax cookie; Origin/Referer allowlist on every POST/PUT/PATCH/DELETE (a missing header is rejected in production); per-session HMAC CSRF token in `X-CSRF-Token`, compared in constant time | Done |
| CS-2 | Login CSRF (attacker logs the victim into the attacker's account) | The Origin check applies to `/login` too | Done |
| CS-3 | State change through GET | **No GET handler may change state.** Checked in review. Lint rule for router `get` handlers that call write services | Required (review gate) |
| CS-4 | Clickjacking of Owner screens | `frame-ancestors 'none'` in CSP and `X-Frame-Options: DENY` on both the UI and the API | Required for UI (nginx/Next) |
| CS-5 | CORS misconfiguration widens the origin | CORS is limited to `APP_ORIGIN`, with credentials. Production behind nginx is same-origin, so the CORS middleware should be disabled when `APP_ORIGIN` equals the served origin. Never `origin: true` or `*` | Partial |

### 5.3 IDOR and cross-role access (T2)

| # | Abuse path | Mitigation | Status |
|---|---|---|---|
| ID-1 | Changing `:id` to read or change another user's resource (business, follow-up, attendance, deal, task) | Every route declares an action, and every handler calls `access.check(user, action, resource)` **after loading the resource and before using it**. Lists use `access.scopeFilter` in SQL before count, sort and paging. A route without a declared action fails a startup self-test | Required (access engine, C8) |
| ID-2 | Role-level escalation through body fields (`role`, `isActive`, `employeeId`, `createdBy`, `assigneeId`, `stage`) | Zod schemas are `.strict()`. Server-owned fields (`id`, `created_by`, `version`, actor, timestamps, `role` except in Owner employee edit) are never read from the body. The actor is always `req.user.id` | Required per endpoint |
| ID-3 | Self-service routes used against others (`/attendance/:employeeId/check-in`) | Self routes have no employee id parameter. They act on `req.user.id` only | Required |
| ID-4 | Call Center works a lead that is not assigned to them, or that another agent holds | `check` enforces "currently assigned" (B7). The reservation lease token is validated on every save (IC-15) | Required |
| ID-5 | Developer opens a deal or project they are not assigned to | DEC-005 flag: before closure only the assigned Developer (demo default). OQ-06: project updates only by assigned Developers | Required |
| ID-6 | Enumeration through sequential IDs | UUIDs everywhere (already in schema). No counters in URLs | Done |
| ID-7 | Over-fetching: API returns more fields than the role sees | Per-role response serializers (DTOs). A context-limited outcome returns only that context's field list (VT-5). Never return a raw `SELECT *` row | Required |
| ID-8 | Data Entry edits commercial status, or Call Center edits master data | VT-3 action rows. Edit attempts by Call Center or Developer return 403, with a suggestion to submit a correction request | Required |
| ID-9 | Last Owner deactivated, or self-deactivation | Not-self and last-active-Owner guards under a row lock | Done |

### 5.4 Hidden-record rule (15-day visibility)

Rule (Confirmed C1–C3, demo defaults DEC-001 Alt A, DEC-002 Alt B on all rows, DEC-003 (i)): for a non-Owner user, a business hidden by the timer, and anything that inherits from it (Table RT), **must reveal nothing**. The only exception is a **hidden duplicate match**, which reveals **existence only**.

| # | Leak path | Mitigation | Status |
|---|---|---|---|
| HR-1 | Lists, search or queue counts include hidden rows ("12 results", page totals) | `scopeFilter` is applied in SQL in the `WHERE` before `COUNT`, `ORDER BY` and `LIMIT`. Totals are computed on the filtered set | Required |
| HR-2 | Search or autocomplete matches hidden rows on name or phone and returns snippets | The search uses the same `scopeFilter`. No separate search index | Required |
| HR-3 | Direct URL returns fields or a different status code by state | Response with **no field values**: 404 `NOT_FOUND`, 403 `PERMISSION_DENIED`, 403 `HIDDEN_BY_POLICY` (OI-10). The body has a code and message only. A wrong or nonexistent UUID gives 404. Residual risk: `HIDDEN_BY_POLICY` confirms existence to a user who already knows the UUID (they once had access). This is accepted (OI-10) because UUIDs are not guessable | Required |
| HR-4 | Duplicate check reveals the hidden record | 409 body `{ code: 'DUPLICATE_EXISTS', match: 'hidden' }`: **no id, name, phone, creator, assignee, date or field that matched beyond the field the user typed**. A visible match may return a preview within the user's permissions. The Owner sees the full match | Required |
| HR-5 | Duplicate check used as an existence oracle (probing phone numbers) | Accepted risk (OI-15), with limits: per-user rate limit on duplicate checks (30 per 10 min, Security default), `business.duplicate_blocked` audited with `match_hidden: true` so the Owner can spot probing. The check needs the `business.create`/`edit` permission | Required |
| HR-6 | Related items leak the business (follow-ups, attempts, meetings, tasks, correction requests, notifications) | Each resource inherits through Table RT. Items the user **owns** are redacted rows (time and own text, no business fields). Browsed rows are omitted and not counted (OI-07, OI-09) | Required |
| HR-7 | Notification or email built when the event happens but sent after the record became hidden | Content is built **at send time** after the access and account re-check (C6). On denial the message is suppressed and the Owner sees a delivery failure (D6) | Required |
| HR-8 | Edit history or audit shows old values of a hidden record | Edit history inherits business access and the field limits (OI-11). Audit is Owner only | Required |
| HR-9 | Caching: browser or proxy keeps a page from before the record became hidden | `Cache-Control: no-store` on every `/api` response. No `ETag` on authorized JSON. SWR cache is cleared on logout | Required |
| HR-10 | Error messages, logs or analytics carry business data | Errors never echo input values. Logs hold IDs only (§5.12) | Partial |
| HR-11 | Timer computed in the client | The UI never decides visibility. The server computes day 16 in the company timezone (OI-04) | Required |
| HR-12 | Policy flags changed to widen access without a trace | Flags are server config or Owner settings. A settings change is audited `settings.updated` with before/after | Required |

The VT-7 worked evaluations become contract tests that run against **both** `check` and `scopeFilter`, so the two cannot drift (RISK-18).

### 5.5 Export exfiltration (Owner only)

| # | Abuse path | Mitigation | Status |
|---|---|---|---|
| EX-1 | Non-Owner calls the export endpoint directly | `requireRole(['owner'])` with an active session (2FA done). `report.export_denied` audited | Required |
| EX-2 | Owner session hijacked, then a bulk export | 2FA plus a short idle timeout. **Re-authentication for export:** a TOTP code within the last 10 minutes (step-up, Security default), row cap (10,000) and time cap (30 s). `report.exported` with format, filters and row count | Required |
| EX-3 | Bulk scraping through list endpoints instead of export | Page size cap of 100. Per-user rate limit on list and search endpoints (300 requests per 5 min, Security default). Anomaly logging when one user reads more than N business details per hour | Required |
| EX-4 | CSV/XLSX formula injection (T8 plants `=HYPERLINK(...)` in a business name) | Prefix cells that start with `= + - @ \t \r` with `'`. Use a maintained XLSX library. Set `Content-Disposition: attachment` and the correct content type | Required |
| EX-5 | The export file stays on disk or in a proxy cache | Streamed, never stored. `Cache-Control: no-store`. nginx `proxy_buffering off` for the export route, or at least no `proxy_cache` | Required |
| EX-6 | Audit export as a back door | No audit export in v1 (OQ-18, demo default) | Done (no route) |

### 5.6 Audit tampering

| # | Abuse path | Mitigation | Status |
|---|---|---|---|
| AT-1 | App-level UPDATE or DELETE of audit rows | No API path. Trigger `trg_audit_events_append_only` (002) blocks UPDATE and DELETE | Done (after 002) |
| AT-2 | SQL injection or a compromised app role deletes audit rows | DB grant: the `app` role has `INSERT, SELECT` only on `audit_events`. The trigger is owned by the `migration` role. `app` cannot `ALTER TABLE ... DISABLE TRIGGER` and is not the table owner | **Required (ops)** |
| AT-3 | A change is committed without its audit row | `recordAuditEvent(client, …)` inside the same transaction. Failures propagate | Done |
| AT-4 | Deleting an employee erases attribution | FKs to employees are `ON DELETE RESTRICT`. Employees are deactivated only | Done (after 002) |
| AT-5 | Secrets or personal data written into audit | Never store passwords, tokens, TOTP secrets or recovery codes. `login.failed` for unknown accounts stores the submitted email: **truncate to 254 characters and never store the password field**. Before/after payloads go through a redaction allowlist | Partial |
| AT-6 | DB superuser (T6) rewrites history | Out of scope for app controls. Optional per-row hash chain (Proposed). Nightly backups keep earlier copies, so tampering can be found by comparison | Accepted |

### 5.7 Email injection (nodemailer templates and headers)

Not built yet (`emailStub.ts`). These rules bind the email increment.

| # | Abuse path | Mitigation |
|---|---|---|
| EM-1 | Header injection: CR/LF in a recipient, subject or name taken from data (employee name, business name) | Recipients come **only** from `employees.email` of an active account, validated with Zod `.email()` when stored, and rejected if they contain `\r` or `\n`. Subjects are fixed templates with interpolated values stripped of `\r\n` and limited to 150 characters. Pass addresses to nodemailer as `{ name, address }` objects, never as concatenated strings. Never set custom headers from data |
| EM-2 | HTML injection or phishing content in the email body (business notes, names) | Templates are fixed files with an escaping engine (auto-escape on). Plain-text part first. Never put user-written free text in emails. Reminders carry time, the business name (escaped) and a link only |
| EM-3 | Open redirect or host poisoning in links | Links are built from `PUBLIC_APP_URL` (config) plus a fixed path. The `redirect` parameter in the UI is validated as a same-origin path (done in `lib/authRoutes.ts`) |
| EM-4 | Hidden-record leak in reminders | Content is built at send time after the C6 re-check (HR-7) |
| EM-5 | Reset token leaked in logs | The stub logs the link only in development. Production never logs links or tokens. The nodemailer debug/logger option is off in production |
| EM-6 | SMTP credential theft or relay abuse | SMTP key comes from env. TLS is required (`requireTLS: true`). The account can only send from the company domain. SPF, DKIM and DMARC are configured (RISK-05) |
| EM-7 | Mail bombing through password-reset requests | Per-IP limit (done) plus a per-account limit: at most 3 reset emails per hour |

### 5.8 Files and attachments

v1 has **no attachments** (ADR-012, DEC-018). Requirements:
- No `multer` or other multipart parser is installed. `express.json` limit is 100 kb. No `express.static` for user content.
- **Profile photo** (OQ-13 self-edit, architecture-a §2.1 "DB blob") is the only upload. If it is built: max 512 kB; type checked by magic bytes (PNG/JPEG/WebP only, **no SVG**); re-encode server-side or strip metadata; serve from Express with `Content-Type` set by the server, `X-Content-Type-Options: nosniff` and `Content-Disposition: inline; filename="avatar"`. It needs a separate route with its own body-size limit. If this is too much for v1, defer photos and show initials.
- Adding attachments later needs a new threat-model revision first.

### 5.9 Rate limiting and resource exhaustion

| Surface | Limit (Security default unless marked) |
|---|---|
| `/api/auth/login`, `2fa/*`, `password-reset/*` | 20 per 15 min per IP (demo default) plus per-account lockout (done) |
| Duplicate check | 30 per 10 min per user |
| List and search endpoints | 300 per 5 min per user. Page size ≤ 100 |
| Export | 10 per hour per user, plus row and time caps |
| Reservation heartbeat | 1 per 30 s per reservation (DEC-004 heartbeat every 60 s) |
| Global | nginx `limit_req` of 20 r/s per IP with a burst of 40. `client_max_body_size 1m`. Timeouts of 30 s |

Key the rate limiter on `req.ip` only when `trust proxy` is set correctly (§5.10 OR-1). Otherwise every client shares the proxy's IP.

### 5.10 Office-restriction bypass for attendance

DEC-009 demo default: IP allowlist only, with the client IP from the trusted proxy (ADR-016).

| # | Abuse path | Mitigation |
|---|---|---|
| OR-1 | Forging `X-Forwarded-For` to look like the office IP | nginx **overwrites** the header with `$remote_addr` (`proxy_set_header X-Forwarded-For $remote_addr;`), not `$proxy_add_x_forwarded_for`. Express `trust proxy` = `1` (exactly one hop), never `true`. The API port is not published, so nobody can reach it except through nginx |
| OR-2 | Check-in from home through a VPN or tunnel into the office network | Accepted residual risk of the IP mode. Audit the source IP on every attendance event. The Owner reviews `remote` labels |
| OR-3 | Spoofed browser geolocation (if the geofence mode is enabled) | Treat it as user-supplied evidence (ADR-016). Never the only factor in "IP and location" mode. Store accuracy and flag low-accuracy fixes |
| OR-4 | Client sends its own `checkInAt` timestamp | Times are server `now()` only. Request bodies have no time fields (B3-Q07 analogue) |
| OR-5 | Checking in for a colleague | Self-only route on `req.user.id` (ID-3). A shared device still needs that colleague's session |
| OR-6 | Owner edits attendance to hide lateness without a trace | Originals are never overwritten. Corrections are new rows with a reason. Audited (`attendance_correction.*`) |
| OR-7 | Office check disabled by a settings change | Only the Owner can change settings, and it is audited with before/after. "Not configured" means attendance actions are inactive, not open |
| OR-8 | Remote exception granted to oneself | Only the Owner grants exceptions (DEC-010). Not-self does not apply to the Owner, but the grant is audited |

### 5.11 Secrets handling

| # | Risk | Mitigation | Status |
|---|---|---|---|
| SE-1 | **`backend/.env` and `frontend/.env.local` are untracked but NOT ignored. There is no `.gitignore` in the repo** (checked 2026-10-23 with `git check-ignore`). One `git add .` would commit them | Add a root `.gitignore` with `.env`, `.env.*`, `!.env.example`, `node_modules/`, `dist/`, `.next/`, `*.dump`, `*.sql.gz`, `*.age`, `*.gpg`. Pre-commit secret scan (`gitleaks`) | **ISSUE posted (SEC-2)** |
| SE-2 | A weak or default `SESSION_SECRET` lets attackers forge token hashes and CSRF tokens | Production refuses to start unless it has ≥ 32 characters and is not a placeholder. An unset `NODE_ENV` means production | Done |
| SE-3 | Secrets in images, compose files or logs | Runtime secrets from root-only files (`/etc/udigity/*.env`, mode 600) or Docker secrets. Never `COPY .env` in a Dockerfile. `.dockerignore` excludes `.env*`. Logs never print config | Required (DevOps) |
| SE-4 | Seed passwords and the public TOTP test secret (`seed.ts`) reach production | `seed.ts` refuses to run when `NODE_ENV=production`. Production Owner bootstrap is a CLI that generates a random password and an enrollment token (AU-8) | **Required** |
| SE-5 | `NEXT_PUBLIC_*` variables carry secrets | Only non-secret values may use the `NEXT_PUBLIC_` prefix. The persona switcher is forced off in production builds (done) | Done |
| SE-6 | Secret rotation is impossible | Rotating `SESSION_SECRET` ends all sessions, which is acceptable. Document rotation for the DB role, SMTP and TOTP key in the runbook | Required |

### 5.12 Logging and privacy

- JSON logs to stdout. Allowed fields: request id, method, route **pattern** (not the full URL with query), status, latency, user id, role, session id prefix (8 characters).
- Never log: request bodies, cookies, `Authorization`, `X-CSRF-Token`, passwords, TOTP codes or secrets, reset links, email addresses (except in development), phone numbers, business names or notes.
- The current `errorHandler` logs `req.originalUrl`. That is acceptable while no query string carries personal data. The rule "never put personal data in query strings" stays.
- `/readyz` returns no internal error text (done).

### 5.13 Backups

| # | Risk | Mitigation |
|---|---|---|
| BK-1 | A leaked backup reveals everything | `pg_dump` output is encrypted on the VPS with a **public** key (age or GPG). The private key lives only in the off-VPS restore environment (ADR-013 A-2) |
| BK-2 | Ransomware or an attacker deletes the backups | Object storage with versioning and object lock (immutability) for the retention window (14 daily, 8 weekly, 6 monthly, demo default). The VPS credentials can write but cannot delete |
| BK-3 | Plaintext dumps left in the staging volume | The dump goes straight into the encryption pipe. The staging volume holds only ciphertext and is cleared after upload |
| BK-4 | A restore brings back revoked sessions | The restore runbook step 7 ends all sessions. The Owner repeats 2FA |
| BK-5 | Backups are never tested | Quarterly restore drill (demo default), run off the VPS |

### 5.14 Dependency supply chain

- `package-lock.json` is committed. Use `npm ci` only in CI and Docker builds. `ignore-scripts=true` in `.npmrc` for production installs, with an allowlist if a package needs a build step (bcryptjs is pure JS, so none is needed now).
- Gate: `npm audit --omit=dev --audit-level=high` must pass for both workspaces, or each finding needs a written exception in `docs/security/exceptions.md` with an expiry date. **Current state: the frontend reports 5 high-severity findings (status §10). They must be triaged before release.**
- New dependencies need a REQUEST that names the package, its weekly downloads and maintainer, and the reason. Avoid packages with install scripts. Pin exact versions for security-relevant packages (`helmet`, `express-rate-limit`, `otplib`, `bcryptjs`, `pg`, the future `nodemailer`).
- Base images are pinned by digest (`node:22-alpine@sha256:…`, `postgres:17-alpine@sha256:…`). Rebuild monthly to pick up OS patches.
- Run Renovate or Dependabot for weekly update PRs, and review the changelogs of security-relevant packages.

### 5.15 Injection and XSS (general)

- SQL: parameterized queries only (`$1…`). Identifiers such as sort columns come from an allowlist map, never from interpolated user input. **No `pg-format` with user data.**
- XSS: React escapes by default. `dangerouslySetInnerHTML` is forbidden (lint rule). URLs from data (business websites, social links) are rendered only if `^https?://` matches, with `rel="noopener noreferrer"`. `javascript:` URLs are rejected when stored (Zod refine).
- CSP for the UI (nginx or Next headers): `default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. Self-host Google Fonts or allow `fonts.gstatic.com` explicitly (status §10 notes `no-page-custom-font`).

### 5.16 Concurrency and business-logic abuse

| # | Abuse path | Mitigation |
|---|---|---|
| BL-1 | Two agents race to reserve the same lead | Partial unique index on the active reservation. Lease token check (IC-15) |
| BL-2 | Replaying a call-save or "Accepted" request creates two deals | Idempotency keys. Unique `acceptedAttemptId`. One open deal per business (DEC-017) |
| BL-3 | Marking "Rejected" to remove a colleague's lead, or reopening do-not-call | A reason is required. Only the Owner reopens (DEC-016). Audited |
| BL-4 | Padding targets with junk records | Metrics count validated creations by the actor (DEC-020). Owner review. Audit |
| BL-5 | Developer closes their own deal to inflate revenue | Owner verification (DEC-006 Alt B, demo default flag `deals.closureMode`) |
| BL-6 | Lost updates | Optimistic `version` on every mutable aggregate. 409 `VERSION_CONFLICT` |

## 6. Residual risks accepted for v1

1. The duplicate check is an existence oracle (OI-15). It is rate-limited and audited.
2. `HIDDEN_BY_POLICY` confirms existence to a user who already holds the UUID (OI-10).
3. An office-IP check can be bypassed through a VPN into the office network (OR-2).
4. A DB superuser can rewrite audit rows (AT-6). This is mitigated only by backups.
5. The in-memory rate limiter assumes one API process (AU-14).
6. A single VPS is a single point of failure (RISK-02).

## 7. Top findings in the current code (for the board)

| Priority | Finding | Owner |
|---|---|---|
| P0 | SE-1: no `.gitignore`. `backend/.env` and `frontend/.env.local` could be committed | DevOps |
| P0 | AU-8: first-enrollment takeover with the Owner password only | Backend identity |
| P1 | AU-13: TOTP secret stored in plaintext | Backend identity |
| P1 | SE-4: `seed.ts` has no production guard. A shared password and a public TOTP secret are in the code and comments | Backend / DevOps |
| P1 | AT-2: the `app` role still owns the tables. INSERT/SELECT-only grant on audit is not applied | DevOps |
| P1 | Frontend `npm audit`: 5 high-severity findings not triaged | Frontend |
| P2 | CS-4 / §5.15: no CSP or `frame-ancestors` for the UI yet | DevOps (nginx) / Frontend |
| P2 | `trust proxy` must be exactly `1` behind nginx, and nginx must overwrite XFF (OR-1). Otherwise rate limits and the office check fail | DevOps |
| P2 | AT-5: `login.failed` stores any submitted email string. Cap the length | Backend identity |
