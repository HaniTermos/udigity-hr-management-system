# E: Security, RBAC and abuse testing (2026-11-04)

Agent E (Opus). Discovery only: no source files edited. Tested commit `cab5ec9` plus the uncommitted Owner work (frontend only, not in scope here).
Executable evidence comes from a throwaway database `udigity_test_rev_e` in `udigity-test-db`: migrations, then `seed.ts` and `seed-demo.ts`, with the real Express app driven in-process through supertest.
Environment: `NODE_ENV=test`, `APP_ORIGIN=http://localhost:3000`, `AUTH_RATE_LIMIT_MAX=5000`, bcrypt cost 4.
The harness scripts are in the Agent E scratch dir (`lib.mts`, `matrix.mts`, `objects*.mts`, `identity.mts`). No secret, password or token values appear in this file.

**Cleanup status:** at the end of the run `udigity-test-db` stopped answering (`docker exec`: "container … is not running"; TCP 55432 refused), so the throwaway DB **was not dropped**. When the container is back, run `DROP DATABASE IF EXISTS udigity_test_rev_e WITH (FORCE)`.

## Summary

| Severity | Confirmed | Suspected (code-read, not executed) |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 1 (E-01) | 2 (E-02, E-03) |
| Low | 4 (E-04, E-05, E-06, E-07) | 2 (E-08, E-09) |
| Info | 3 (E-10, E-11, E-12) | n/a |

Overall: route-level RBAC matches the authz matrix for all four system roles (0 mismatches over 74 probes). Object-level checks, the 15-day window, archive hiding, pending-2FA isolation, CSRF/Origin, session revocation, reset-token handling, CSV escaping, the open-redirect guard and email escaping all held up under execution. The real gaps are a lockout abuse path and the custom-role (S-26) policy conformance.

---

## Findings

### E-01 · Medium · Non-blocker · Confirmed: anyone can keep the Owner (or any user) locked out

- **Requirement / role:** availability of the Owner account. IMPL-LOCKOUT is a working default, not approved.
- **Location:** `backend/src/modules/identity/routes.ts` (login, `registerFailure`); `security.ts` `registerFailure`; `config/index.ts` (lockout 5 per 15 min → 15 min lock; per-IP auth limit 20 per 15 min).
- **Preconditions:** only the account's email (the Owner's email is a public company address).
- **Reproduction (executed):** send 5 × `POST /api/auth/login {email: <owner>, password: <wrong>}` → each returns 401. Then `POST /api/auth/login` with the **correct** password → 401 `INVALID_CREDENTIALS`, and `credentials.locked_until` is set.
- **Expected vs actual:** the lockout should slow guessing, not hand an anonymous attacker a denial of service. Actually, 5 requests per 15 minutes from **one IP** (well under the 20/15 min per-IP limit) keep the account locked indefinitely. The lock fires before the password check, so the real Owner cannot sign in. A password reset clears the lock, but the attacker can lock it again straight away.
- **Root cause:** a pure per-account counter with no per-source dimension and no unlock path that still lets the real user in.
- **Proposed fix:** key failures by (account, client IP or subnet) as well as by account; or use progressive delay instead of a hard lock; or let a correct password plus a valid TOTP through for an Owner who has 2FA enrolled. Needs an Owner decision on IMPL-LOCKOUT values.
- **Regression test:** 5 failures from IP A, then a correct login from IP B succeeds (or is only delayed).
- **Limitations:** the 2FA factor lock has the same shape (5 wrong TOTP codes lock the factor; executed), but it requires the password first.

### E-02 · Medium · Owner decision · Suspected (code): custom roles can hold Owner-only admin rows, contrary to S-26

- **Requirement:** S-26 (Owner, 2026-10-29) says custom roles "can never hold Owner-only actions" and follow the same visibility rules.
- **Location:** `backend/src/modules/access/matrix.ts`, `grantableRow(...)`. These admin (Owner-only) rows are marked grantable: `employee.list`, `employee.read`, `employee.read_open_items`, `attendance.correction.review`, `attendance.adjust`, `attendance.retroactive_create`, `attendance.remote_exception.grant`, `attendance.failed_checkout.review`, `attendance.overview.read`.
- **Evidence (executed part):** `POST /api/access/roles` accepted a role holding `employee.list` and `attendance.overview.read` (201). Without a second factor the holder gets `403 OWNER_2FA_REQUIRED` on both (matrix table, column CUSTHR), so the gate works. The catalogue (`GET /api/access/permissions`) reports these rows as `requiresAdmin: true, grantable: true`.
- **Not executed:** the holder's 2FA enrollment and the actual execution of the grantable rows.
- **Expected vs actual:** under S-26 these rows should be refused by `grantRefusal` like the other admin rows. Instead they can be granted and run once the holder has 2FA (the matrix §3.11 design).
- **Fix:** either remove the `grantable` marker from these rows, or record an explicit Owner decision that amends S-26 (HR-style delegation). Not to be resolved by the review.
- **The older 2026-10-28 review item** "custom roles can run Owner-only admin actions without 2FA" is **fixed**: the second-factor gate is enforced (executed).

### E-03 · Medium · Non-blocker · Suspected (code): no self-decision guard on attendance adjust / retroactive create / review resolution

- **Location:** `backend/src/modules/attendance/service.ts`, `adjustSession` (~l.1393), `createRetroactive` (~l.1516), `resolveReview` (~l.1452). There is no check of `employee_id === actor`. In the same file, `approveCorrection` (l.1068), `grantRemote` (l.1577) and `decideRemote` (l.1642) do have this check.
- **Impact:** only reachable by holders of these rows: the Owner, or a custom role granted them (E-02). Such a holder can create or adjust **their own** attendance sessions (hours, late flags, missing checkouts), which defeats D4 ("employees request, Owner approves").
- **Fix:** add `selfDecision` for non-Owner actors (or for all actors) on these three commands, plus a regression test per command.
- **Not executed** (see the limitations note at the end).

### E-04 · Low · Non-blocker · Confirmed: reset token issued before a password change stays valid

- **Location:** `identity/routes.ts` `POST /password/change`. It ends the other sessions but does not supersede open `password_reset` or `credential_setup` tokens.
- **Reproduction (executed):** issue a reset token → change the password (200) → `POST /password-reset/complete` with the old token → **200**, and the password is overwritten.
- **Impact:** someone who obtained a reset link (for example by reading the mailbox before the user noticed) keeps a takeover path for up to 30 min after the user changed their password.
- **Fix:** in the change transaction, `UPDATE security_tokens SET superseded_at = now() WHERE employee_id = $1 AND purpose IN ('password_reset','credential_setup') AND used_at IS NULL AND superseded_at IS NULL`.

### E-05 · Low · Non-blocker · Confirmed: `/password/change` current-password guesses skip the account lockout

- **Reproduction (executed):** with a valid session, send 6 × `POST /api/auth/password/change` with a wrong `currentPassword` → `failed_count` stays 0 and no lock is set. Only the per-IP limit (20/15 min) applies.
- **Impact:** someone holding a stolen session (cookie) can guess the password from several IPs to turn the session into a lasting credential. Low, because a session is already required.
- **Fix:** use `verifyCurrentPassword` (which counts toward the lockout), as enroll/start and enrollment-token issuance already do.

### E-06 · Low · Non-blocker · Confirmed: account existence leaks through password-reset request timing

- **Reproduction (executed, 25 samples each, in-process):** `POST /api/auth/password-reset/request`. Median response: unknown email **21.7 ms**, known active email **50.9 ms**. Body and status are identical (202 with the same message).
- **Root cause:** the known path supersedes, inserts, encrypts and writes outbox and audit rows synchronously; the unknown path returns at once.
- **Impact:** email enumeration, limited by the per-IP limit and network jitter. Login itself is timing-balanced (a dummy bcrypt compare runs; bodies are identical for unknown, wrong and deactivated accounts, executed).
- **Fix:** do the equivalent DB work for unknown emails, or hand the request to the outbox asynchronously and answer after a constant delay.

### E-07 · Low · Non-blocker · Confirmed: staff directory exposed to Call Center and Developer via attendee options

- **Reproduction (executed):** Call Center `GET /api/meetings/attendee-options` → 200 with every active employee: id, full name and role (Data Entry included). `GET /api/deals/developers` returns developer id and name to Call Center as well (this is needed for the picker).
- **Requirement:** matrix §3.2 says the "Directory is Owner only".
- **Impact:** small (names and roles of colleagues); no emails or phones.
- **Fix:** limit attendee options to the roles that can attend (assigned Developer, the Call Center agent) or to the deal's participants.

### E-08 · Low · Owner decision · Suspected (code): custom role with `deal.read` at `global` scope bypasses the D15 opportunity confinement

- **Location:** `deals/service.ts` `developerMayReadDeal` / `developerConfinement` return `true` / `TRUE` for every non-`developer` role. For a custom role, `rules.ts` with `dataScope: 'global'` sets relation `TRUE` within the 15-day creation window.
- **Impact:** an Owner-configured custom role with `deal.read: global` would see unassigned accepted opportunities and their call notes. D15 says these belong to the assigned Developer and the Owner only. `assigned_only` scope behaves correctly in code.
- **Fix:** refuse `global` for `deal.*` grants, or apply the D15 confinement to custom roles too.

### E-09 · Low · Non-blocker · Suspected: password change keeps the current session token

- **Evidence (executed):** a password change returns 200 without `Set-Cookie`, the same cookie still works and the other sessions end.
- **Impact:** if the current cookie was the stolen one, it survives the change. Common practice is to rotate the token.
- **Fix:** `rotateSession` on password change (keep `rotated_from` semantics in mind for `second_factor_verified`).

### E-10 · Info · Confirmed: office dynamic-DNS resolver (SSRF review)

`officeDns.ts` only runs `dns.resolve4/resolve6` on an Owner-saved hostname. The hostname is syntax-checked and must contain a dot; there is a 2 s timeout and a 5 min cache. No HTTP or other connection is made, the resolved IPs are never returned to any client (`testOfficeCheck` returns only `passed`/`failed`), and non-Owners never see hostnames or IPs (`versionDto(full=false)`).
- Residual risk: an Owner can make the server look up arbitrary names, including internal resolver names. It is also possible to point the hostname at an internal or proxy IP, but that does not widen the match because `req.ip` comes from `TRUSTED_PROXY_CIDRS`.
- No action needed. Optionally refuse private and loopback results.

### E-11 · Info · Confirmed: stray encrypted backup drill in the working tree

`./C:UsersHaniAppDataLocalTemp/drill/backups/daily/*.dump.gpg` (plus `.sha256`) is in the repo working directory, ignored by `.gitignore` (`/C*UsersHani*Temp/`) and not tracked. It is encrypted. Delete it locally after confirming it is only drill output.

### E-12 · Info · Confirmed: secrets and dependencies

- `npm audit --omit=dev` (repo root): **0 vulnerabilities**.
- Git history (all refs): no `.env`, `.pem` or `.key` files were ever committed. A regex sweep for private keys, AWS, Brevo, SendGrid and GitHub token patterns found nothing.
- `.gitleaks.toml` allowlist has 5 exact anchored values (Figma file keys, a test UUID, a sequential dummy hex key). All are justified and none is a credential.
- `DEV_TOTP_SECRET` (`seed.ts`) is public by design. `seed.ts`, `seed-demo.ts` and `e2e-seed.ts` all call `assertSeedAllowed` (dev/test only; an unset `NODE_ENV` counts as production).
- `NEXT_PUBLIC_DEV_SEED_PASSWORD` is only read when `NODE_ENV !== 'production'` and personas are enabled, and `check-env.sh` rejects `ENABLE_DEV_PERSONAS=true` in production.

---

## Verified as correct (executed unless marked code)

- **Route RBAC:** 74 sensitive endpoints × {Owner, DE, CC, DV}: all match `matrix.ts` (table below). Unauthenticated → 401 everywhere. Pending-2FA Owner → `403 OWNER_2FA_REQUIRED` everywhere except `/auth/me`, `/auth/2fa/status`, logout and the 2FA steps; `/me` capabilities are empty while pending. A deactivated employee's live cookie → 401 on the next request. A custom role with no grants → 403 everywhere. Test-support routes are mounted only when `NODE_ENV=test` (code).
- **15-day window:** Data Entry sees records created ≤ 15 days ago (23-day record → `403 HIDDEN_BY_POLICY` on read, history and patch; absent from list and search; list total = visible rows). Call Center sees only current assignments within 15 days of assignment; another agent's record or calling workspace → 403; search for another agent's business → 0 results and 0 counts.
- **Developer:** the directory list shows only closed deals with an active or recently completed project. Reading another developer's opportunity, deal, call notes, project, tasks or meetings → 403. Mutations on another developer's deal or project (advance, payment, not-proceeding, project status, patch, task create/patch) → 403. Creating a project for a deal the developer is not assigned to → refused.
- **Archived business:** 404 for Call Center and Data Entry; removed from the calling queue.
- **IDOR:** another employee's attendance session or breaks → 404; correction request read or withdraw by another agent → 403; reschedule or cancel of another agent's follow-up → 403; another person's work item → 404; Data Entry `?employeeId=<other>` on attendance, targets and remote exceptions → own rows only.
- **Overposting:** business PATCH with `createdBy`, `assigneeId`, `archivedAt` or `createdAt` → 400 (strict). Employee create with `isActive`/`id` → 400. `PATCH /employees/me {role:'owner'}` → unknown keys stripped, role unchanged. Unknown or deactivated custom role on create → 400.
- **Sessions:** logout invalidates that cookie only; a role change ends sessions (old cookie → 401); revoke-all ends all sessions; reset completion ends all sessions; a successful 2FA rotates the session id; 5 wrong TOTP codes end the pending session.
- **Tokens:** 6 parallel completions of one reset token → exactly one 200. Expired, superseded, wrong-purpose (2FA enrollment) tokens and tokens of deactivated employees are refused. An invitation link is single use. Reset TTL = 30 min; invite TTL = 72 h (code). Tokens are 256-bit random and stored as HMAC; the raw value is kept only AES-GCM-encrypted for the mailer.
- **bcrypt 72-byte limit:** a 74-byte new password → 400, a 73-byte login → 400, and the bootstrap password is 27 characters. Reactivation destroys the password, MFA, recovery codes, tokens and sessions (code).
- **CSRF/Origin:**
  - Mutation without `X-CSRF-Token` → `CSRF_FAILED`; a foreign Origin, or only a foreign Referer → `ORIGIN_REJECTED`; login from a foreign origin → rejected.
  - With the production config, a missing or `null` Origin → 403.
  - A CORS preflight from a foreign origin gets no `Access-Control-Allow-Origin`.
  - Cookies are HttpOnly (session only) and SameSite=Lax; production uses Secure plus the `__Host-` prefix (code).
- **Headers:** helmet on the API (CSP, HSTS, nosniff, frame, CORP/COOP, `no-store`). The frontend proxy adds a nonce plus `strict-dynamic` CSP and `frame-ancestors 'none'`; nginx adds HSTS, nosniff, DENY, Permissions-Policy and `server_tokens off`.
- **Web code review:** `safeRedirectTarget` blocks `//`, backslash and control characters (also percent-decoded) and checks the origin. The only `dangerouslySetInnerHTML` is the constant theme script. Email templates HTML-escape every variable. CSV export neutralises leading `= + - @ \t \r`.

## Executed RBAC matrix (status codes; 2f = `OWNER_2FA_REQUIRED`)

The ids are the zero UUID: an allowed role reaches validation or lookup (400/404), a denied role gets 403 from the guard. **CUST0** = custom role with no grants. **CUSTHR** = custom role holding business.read/list/search/update/history (global), employee.list and attendance.overview.read, with no second factor. **PEND** = Owner who has passed the password step but not 2FA. **INACT** = employee deactivated mid-session.

| Probe | O | DE | CC | DV | CUST0 | CUSTHR | Unauth | PEND | INACT |
|---|---|---|---|---|---|---|---|---|---|
| GET /api/employees | 200 | 403 | 403 | 403 | 403 | 403 2f | 401 | 403 2f | 401 |
| POST /api/employees | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| PATCH /api/employees/:id/status | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET/POST /api/access/roles | 200/400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/audit-events | 200 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET/PATCH /api/settings, GET /settings/flags | 200/400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/settings/public | 200 | 200 | 200 | 200 | 403 | 403 | 401 | 403 2f | 401 |
| calling-assignments (list/assign/reassign) | 200/400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/calling/queue, do-not-call | 200 | 403 | 200 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/calling/opportunities | 200 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| POST /api/calling/attempts, /api/reservations | 400 | 403 | 400 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| POST /api/reservations/:id/override | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/deals | 200 | 403 | 403 | 200 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/deals/developers, POST /deals/:id/developer | 200/400 | 403 | 200/400 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| POST /deals/:id/closure-verify, /finalize | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| POST /deals/:id/payment | 400 | 403 | 403 | 400 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/projects, POST /api/projects | 200/400 | 403 | 403 | 200/400 | 403 | 403 | 401 | 403 2f | 401 |
| POST /projects/:id/developers, /cancel | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/tasks | 400 | 403 | 403 | 400 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/meetings, /attendee-options | 400/200 | 403 | 400/200 | 400/200 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/businesses, GET /api/search | 200 | 200 | 200 | 200 | 403 | 200 | 401 | 403 2f | 401 |
| POST /api/businesses, duplicate-check | 400/200 | 400/200 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| PATCH /api/businesses/:id | 400 | 400 | 403 | 403 | 403 | 400 | 401 | 403 2f | 401 |
| POST /businesses/:id/archive, /restore | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| DELETE /api/businesses/:id (nobody) | 403 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/categories / POST | 200/400 | 200/403 | 200/403 | 200/403 | 403 | 403 | 401 | 403 2f | 401 |
| correction-requests list / submit / resolve | 200/400/400 | 200/403/400 | 200/400/403 | 200/400/403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/attendance/overview | 200 | 403 | 403 | 403 | 403 | 403 2f | 401 | 403 2f | 401 |
| attendance adjust / retroactive / settings PUT / test-office-check / days-off / remote grant / schedule / correction approve | 4xx-allowed | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/targets, /api/work-items | 200 | 200 | 200 | 200 | 403 | 403 | 401 | 403 2f | 401 |
| POST /api/targets, /api/work-items | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| delivery-monitor read / send-again | 200/404 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/dashboard, /api/reports, POST /reports/export | 200/200/400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| POST /auth/2fa/enrollment-tokens, /recovery-codes | 400 | 403 | 403 | 403 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/notifications, /attendance/me/today | 200 | 200 | 200 | 200 | 403 | 403 | 401 | 403 2f | 401 |
| GET /api/follow-ups | 200 | 403 | 200 | 403 | 403 | 403 | 401 | 403 2f | 401 |

Result: 0 mismatches against `AUTHZ_MATRIX` for the system roles. My first expectation for `POST /deals/:id/finalize` included DV; the code and matrix make it Owner-only, which matches DEC-006, so that was my error, not a defect.

Side note: a custom role holds nothing by default, so it cannot use check-in, notifications or `settings/public` unless those rows are granted. This is functional, not a security issue; listed for Agent C/A.

## Not tested

- Executing grantable admin rows by a custom-role holder after 2FA enrollment (E-02/E-03 stay Suspected; code evidence only).
- Recovery-code concurrency (code reviewed: rows locked `FOR UPDATE`).
- Idle and absolute expiry by clock (unit-tested in repo; not re-run).
- Production cookie flags and headers through nginx (no deployment); CSP in a real browser.
- Notification inbox re-check at read time (the demo seed had no in-app rows).
- Report export step-up end-to-end.
- Remaining 2026-10-28 review items beyond those noted above.
