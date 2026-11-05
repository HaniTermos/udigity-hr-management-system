# Review 01: backend core (Reviewer 1)

| Field | Value |
|---|---|
| Date | 2026-10-28 |
| Scope | `app.ts`, `index.ts`, `worker.ts`, `config/**`, `middleware/**`, `shared/**`, `db/**` (all 31 migrations 001–903, runner, seeds), modules `identity`, `employees`, `admin`, `platform`, `notifications`, `modules/index.ts`, `package.json`, `tsconfig*.json`, `vitest.config.ts`, `eslint.config.js`, `src/tests/**` |
| Mode | Read-only. No source file edited. No `.env` file opened. |
| Test DB used | `udigity_test_r1` (fresh). All 31 migrations apply cleanly in order; seed runs. |
| Slice test run | `src/tests` + identity/platform/notifications/employees/admin: **194 passed, 1 failed** (`runtimeRole.test.ts`, see F-01). |
| Lint run | From `backend/`: config **loads**; **7 errors** (`no-explicit-any`, see F-02). From the repo root: "couldn't find eslint.config" (that is the baseline's message). |

Severity: **P0** exploitable now or data loss · **P1** security control not in effect, or a core flow silently broken · **P2** contract gap or robustness bug · **P3** hygiene, drift, dead code.

---

## 1. Investigations asked for

### 1.1 `tests/runtimeRole.test.ts` fails: test problem, not a product bug

- **Root cause:** `src/tests/runtimeRole.test.ts:18` hard-codes `expect(current_database).toBe('udigity_test')`. The baseline ran against `udigity_test_review`, and I ran against `udigity_test_r1`. Both fail only on this assertion (`expected 'udigity_test_r1' to be 'udigity_test'`). The other 4 tests pass.
- **A second time bomb:** line 23 hard-codes `schema_migrations` count `= 31`. It passes today (31 `.sql` files) and breaks with the next migration.
- **What the test does not prove:** it `SET ROLE udigity_app` from the test superuser, so it checks the grants of migration 012, not the role the API really connects as. In the documented production setup the API connects as a **superuser** named `udigity_app` (see F-04), so the test gives false assurance.
- **Side effect:** test 4 **commits** a `privilege.test` row into `audit_events` (append-only, never removable) in the shared test DB.
- **Fix:** derive the expected DB name from `new URL(process.env.TEST_DATABASE_URL).pathname`. Compare the migration count with `fs.readdirSync(migrations).filter(.sql).length`. Add an assertion that the pool's `current_user` is **not** a superuser and **not** the table owner when a restricted URL is configured. Wrap test 4 in a rolled-back transaction.

### 1.2 Backend eslint "fails to load its config"

- The config is fine. `backend/eslint.config.js` loads when eslint runs from `backend/`: `npm run lint --workspace=backend` (as CI does, `.github/workflows/ci.yml:71`) or `cd backend && npx eslint .`.
- The "ESLint migration guide" message appears only when eslint is run **from the repo root** (`npx eslint backend/...`). The root has no `eslint.config.*`, and ESLint 9 looks up flat config from the cwd. So it is a baseline invocation problem.
- **The real lint result is 7 errors** (`@typescript-eslint/no-explicit-any`): `src/modules/access/dynamicService.ts:195`, and `src/tests/runtimeRole.test.ts:91,104,117,137,150,163`. CI's "Backend lint" step is therefore red.

---

## 2. Findings

| ID | Sev | file:line | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| F-01 | P2 | `src/tests/runtimeRole.test.ts:18,23,79-86` | The test hard-codes DB name `udigity_test` and migration count 31. It commits an audit row. It checks `SET ROLE` grants, not the real runtime role. | CI is red on any other test DB name, and red again on the next migration. False assurance on AT-2. | See §1.1. |
| F-02 | P2 | `src/modules/access/dynamicService.ts:195`; `src/tests/runtimeRole.test.ts:91…163` | 7 `no-explicit-any` lint errors. The "config fails to load" message is a root-cwd artefact. | The checklist A8 lint gate fails. Plan §11 forbids `any`. | Type the matrix role check (`(row.roles as readonly string[]).includes(r.id)`), and type the caught errors as `{ code?: string }`. Optionally add a root `eslint.config.js` that re-exports the workspaces' configs, or document "run from the workspace". |
| F-03 | **P1** | `src/shared/access.ts:168-171, 202-214`; `src/modules/access/dynamicService.ts:92` | `dynamicRoleChecker` widens any **non-Owner** role (system roles included) with actions from `role_permissions`. The 2FA gate for admin actions only fires when `role === 'owner'` (lines 209-214). A custom role granted `employee.update`, `settings.update`, `audit.read`, etc. runs them **without 2FA**. | Breaks "admin actions require completed Owner 2FA" (matrix §1.1 step 2b, Confirmed). With `employee.update` or `employee.create`, the holder can make any account an Owner. Privilege escalation. The 4-role matrix is a CONTRACT, so widening system roles at runtime contradicts it too. | In `requireAction` and `can`, deny `policy.admin` actions to every role except `owner` with an active session. Never consult the dynamic checker for `admin` rows. Do not let `role_permissions` widen the 4 system roles. Get a Security Lead decision on custom roles at all (see F-12). |
| F-04 | **P1** | `src/db/migrations/012_admin_restricted_app_role.sql:19-30`; `devops/env/postgres.env.example:3`; `devops/env/backend.env.example:26` | The production env makes `POSTGRES_USER=udigity_app`, the image's **superuser and table owner**. `DATABASE_URL` connects as it, and `MIGRATION_DATABASE_URL` is unset. Migration 012 sees that `udigity_app` already exists and skips the role creation. Its `REVOKE UPDATE, DELETE … ON audit_events` has no effect on an owner or superuser. | The AT-2 / DEV-R5 control (an app role that cannot modify audit or disable the trigger) is **not in effect** in the documented deployment. `udigity_app` was designed as a NOLOGIN group, and the name collision hides the failure. | Use a distinct superuser or owner (e.g. `POSTGRES_USER=udigity_owner`). Set `MIGRATION_DATABASE_URL` to it. Create `udigity_api LOGIN IN ROLE udigity_app` in an init script and use it in `DATABASE_URL`. Make 012 `RAISE EXCEPTION` (or warn loudly) when `udigity_app` is a superuser or `rolcanlogin`. Add a readiness or startup check: `SELECT rolsuper FROM pg_roles WHERE rolname = current_user` must be false in production. |
| F-05 | **P1** | `src/modules/notifications/service.ts:347, 383, 401` vs `assignment/service.ts:118,226`, `reservation/service.ts:350`, `corrections/service.ts:317` | Outbox payload contract mismatch. The consumer reads `payload.agentId`, `payload.previousHolderId` and `payload.requestedBy`. The emitters send `assigneeId`, `holderId` and `businessId` only. So **no** in-app notice is ever created for calling assignments (E-07), reservation override (BL-03 / B3-Q14) or correction outcomes (E-09 / BL-17). The relay marks these events `done`. | Three notification flows are silently dead. The API test seeds `notification_deliveries` directly, so the gap is untested. | Align the keys: the consumer reads `assigneeId` and `holderId`. For corrections, re-read `requested_by` from `data_correction_requests` by `aggregateId` (ids-only payload rule). Add one relay-level test per event: emit, relay, assert a delivery row. |
| F-06 | **P1** | `src/modules/access/dynamicService.ts:32-40, 245, 283` (via `shared/access.ts:138`) | `DynamicRoleCache.ensureLoaded()` is never called. After every API restart, custom roles have **no** permissions until somebody edits a role in that process. `setRolePermissions` updates the in-process cache **before** the command transaction commits, so a rollback leaves phantom permissions. With more than one API process, the caches diverge. | Authorization depends on process history: fail-open after a rolled-back grant, fail-closed after a restart. | Load from the DB per request (it is small) or at startup. Update the cache only after commit (post-commit hook), or invalidate and reload. Cross-slice: also report to the BE2 reviewer (02). |
| F-07 | P2 | `src/modules/employees/routes.ts:155`; `src/middleware/auth.ts:75-137` | A role change (e.g. `data_entry` → `owner`) commits first. Session revocation runs afterwards in a separate transaction (`revokeAfterCommit`, falling back to the E-02 relay about 2 s later). `authenticate` reads the **live** `e.role` and trusts `s.state = 'active'`. In that window the target's existing non-2FA session acts as an active Owner. | A short window where Owner powers are available without 2FA. If the inline revoke fails, the window lasts until the relay runs. | In `authenticate`, reject when `s.role <> e.role` (the column exists): end the session and return 401. Or call `revokeAllSessions(ctx.tx, …)` inside the role-change transaction. |
| F-08 | P2 | `src/modules/identity/routes.ts:876-888` | `POST /api/auth/password/change` checks the current password outside any transaction and **does not count failures** toward the per-account lockout. Every other re-auth path uses `verifyCurrentPassword`. Only the per-IP limiter (20 per 15 min) applies. | A stolen session can be used to guess the account password without ever locking it (IMPL-LOCKOUT). | Use `verifyCurrentPassword(client, …)` inside the transaction, return 429 when locked, and audit `password.change_failed`. |
| F-09 | P2 | `src/shared/outbox.ts:18-60` vs consumers (`notifications/service.ts:54, 251, 328`; `identity/service.ts:118`; `projects/module.ts:33`; `meetings/module.ts:22`; `corrections/service.ts:389`) | Events with **no consumer**: `two_factor.recovery_succeeded` (E-04), the attendance events `checkout_provisional`, `checkout_pending_review`, `missing_checkin_detected`, `missing_checkout_detected` (E-11/E-12), `deal.closure_rejected`, `notification.failed`, `notification.suppressed`, `reminder.failed` (E-17, D6 "delivery failure" item). Subscribed with **no handler branch**: `attendance_correction.submitted` (E-10), `project.provisioning_failed` (E-15). **Declared, never emitted:** `password_reset.completed` (E-04), `password_reset.assistance_triggered` (E-03), `call_outcome.changed` (E-16). | Security notices (E-04), Owner alerts (E-10/E-12/E-15/E-17) and the D6 loop are not delivered. The relay marks the events `done`, so nothing shows as failing. | Implement the missing branches, or mark each event "not in v1" in `OUTBOX_EVENTS` with a plan reference. Add a startup or CI check: every name in `OUTBOX_EVENTS` that has an emitter must have at least one consumer or an explicit `NO_CONSUMER` allowlist. |
| F-10 | P2 | `src/modules/notifications/service.ts:282, 311, 447-480`; `repo.ts:406-433` | Reminder planner: the lead times are hard-coded (15 min for follow-ups, 60 min for meetings). It ignores `notifications.followUpLeadMinutes`, `meetingLeadMinutes` = [1440, 60] and `lateReminder`. J-01 dispatch creates the delivery as `sent` with **no** send-time re-check: recipient active, source still open, `access.check` (C6/HR-7). "Send again" (`retryDelivery`/`retryReminder`) re-queues any row, including `sent` or `cancelled` ones, without a re-check or an audit row. | Reminders go to deactivated users or about cancelled or hidden items. The flags are documented but have no effect. | Read the flags through `getSetting`. In J-01, re-read the source state, recipient status and `access.check`, and record `suppressed` or `skipped` (then emit `reminder.suppressed`). Let send-again accept only `failed` or `suppressed` rows, and audit it. |
| F-11 | P2 | `src/modules/notifications/repo.ts:148-192`; `service.ts:177-188` | The in-app list and the unread count do **not** re-check access at read time. authz §3.9 and AR-14 require "Access re-checked when the list is read; hidden items omitted and not counted". | A notice about a business that is now hidden still shows (with `sourceId` / a deal link) and is counted. | Filter the rows with `access.checkMany` per `source_type`, and count after filtering. |
| F-12 | P2 | `src/db/migrations/014_dynamic_roles_rbac.sql:9, 28, 39-41` | "Wave 3" dynamic RBAC is not in plan.md or the authz-matrix (IC-01: four roles). The migration drops `employees_role_check`. It uses `created_by … ON DELETE SET NULL` and `role_permissions … ON DELETE CASCADE` (A9: RESTRICT only). It uses `ON UPDATE CASCADE` on `employees.role`. No `version`. | An unapproved scope change that widens the attack surface (F-03, F-06). It breaks the migration FK rules. | Get a TL / Security Lead decision. If kept, use a new forward migration with RESTRICT FKs, add `version`, and add matrix rows (`role.*`) to `authz-matrix.md`. |
| F-13 | P2 | `src/modules/platform/repo.ts:183-194`; `idempotency.ts:56-101` | An idempotency claim (`status = 0`) is reclaimed only after `expires_at` (48 h). If the process crashes between the claim and the response, every retry with the same key returns 409 `STATE_CONFLICT` for 48 h. The response is saved outside the command transaction, so it is not atomic: if the save fails after commit, a retry re-executes. | Calling attempts, business create and check-in all use `idempotent()`. A crash during deploy strands the user's retry. | Reclaim claims older than a short in-progress TTL (e.g. 2 min, via `created_at`). Ideally save the record inside the command transaction (`IdempotencyStore.save(tx, …)` exists but is unused). |
| F-14 | P2 | `src/shared/platform.ts:169-179`; registrations (`grep registerJob`) | J-06 `identity.session_cleanup` and J-12 `platform.retention_purge` are **not implemented**. `backend.env.example:113-115` says the `POLICY_RETENTION_*` sweeps "run by the worker". Unregistered too: `reports.daily_snapshot` (fine, not in v1). | The `sessions`, `idempotency_records`, `outbox_events`, `background_jobs`, `notification_deliveries`, `notification_secrets` (expired ciphertext stays) and `worker_heartbeats` tables grow without bound. Retention flags are dead config. | Implement J-12 (`daily:03:00`) using the retention flags. Delete `outbox_consumer_runs` before `outbox_events` (FK RESTRICT, `100_platform_core.sql:29`). Implement J-06, or drop it from the plan and the env doc. |
| F-15 | P2 | `docs/security/authz-matrix.md` §3.1 vs `src/modules/identity/routes.ts` | `auth.password_reset.assist` (SEQ-02, Owner-assisted reset, E-03 `assistance_triggered`) and `session.revoke` (Owner revokes another user's sessions, audited) are in the matrix (`access/matrix.ts:43-44`) but have **no route**. | Matrix contract not delivered. The Owner cannot help a locked-out employee except by CLI. | Add `POST /api/employees/:id/password-reset` (`auth.password_reset.assist`) and `POST /api/employees/:id/sessions/revoke` (`session.revoke`), each with audit and outbox. Or mark the rows "not in v1". |
| F-16 | P3 | `src/modules/employees/routes.ts:174-178` | `PATCH /:id/status` uses `employee.deactivate` for **both** directions. `employee.activate` is declared but never used. | Matrix drift. A future split of the policies would break silently. | Use `requireActionFor((req) => req.body?.isActive ? 'employee.activate' : 'employee.deactivate', [...])`. |
| F-17 | P3 | `identity/routes.ts:63, 68, 91, 93, 871`; `employees/routes.ts:40`; `notifications/routes.ts:20, 71` | Several input schemas are not `.strict()`: Login, TotpCode, ResetRequest, ResetComplete, ChangePassword, UpdateOwnProfile. Notifications read `req.query.unreadOnly` and `kind` raw, and use a non-strict `PageQuerySchema`. Zod strips unknown keys, so there is no mass-assignment today. | Checklist A1 says "unknown keys return 400". | Add `.strict()`. Parse the notification queries with `PageQuerySchema.extend({...}).strict()`. |
| F-18 | P3 | `src/modules/identity/env.ts` (whole file) vs `src/config/index.ts:76-123` | The TOTP keyring and the DEV-R4 alias loader are duplicated. `config` says the logic was "folded in", yet `twoFactor.ts` and `admin/service.ts` still use `be1Env`. | Two parsers of the same secrets can drift. Keys are parsed twice at startup. | Use `config.totp.encryption` and `config.policyAliases`, then delete `identity/env.ts`. |
| F-19 | P3 | `notifications/emailStub.ts`; `identity/repo.ts`; `platform/schemas.ts`; `platform/routes.ts:10-11`; `middleware/auth.ts:174` (`requireRole`); `platform/service.ts:301` (`idempotencyStore`) | Dead code and stubs: the deprecated email stub (no importers), the empty `repo.ts` / `schemas.ts` stubs, an unused default router, an unused `requireRole`, and an unused `idempotencyStore`. | Noise, plus a misleading "STUB" header on the identity repo. | Delete them, or wire `idempotencyStore` (F-13). |
| F-20 | P3 | `src/db/seed.ts:41`; `src/db/e2e-seed.ts:51` | The dev/test Owner seed uses a real mailbox address (`udigity@gmail.com`). | Checklist A10: no real email in code or fixtures. Reset mails in dev/test could target a real inbox once SMTP is enabled. | Use `owner@udigity.demo` (and `.invalid` in tests). Update the e2e fixtures. |
| F-21 | P3 | `src/db/migrations/021_attendance_breaks.sql:7` | `attendance_breaks.session_id … ON DELETE CASCADE` on a history table. There is no `version` or `updated_at`. | A9: no CASCADE on history. | Use a forward migration to switch to RESTRICT and add `version` and `updated_at`. |
| F-22 | P3 | `src/db/migrate.ts:107-166` | No `pg_advisory_xact_lock`. `docker-compose.yml:41` migrates on every backend start. Forward-only and lexicographic order are fine. Every applied file is recorded. | Two starting containers race. One fails with a duplicate `schema_migrations` key. | Add `SELECT pg_advisory_xact_lock(<const>)` after `BEGIN`. |
| F-23 | P3 | `src/middleware/errorHandler.ts:47-55` | The 500 path logs the raw `err.message`. pg messages can carry input values (for example `invalid input syntax for type uuid: "<input>"`). Non-500, non-Http errors return code `ERROR`, which is not in `ErrorCode`. The Zod 400 has no `requestId`. | A7: log fields allowlist. Error-contract drift. | Log `err.code` / `err.name` plus a truncated message only for non-pg errors. Map `22P02` to 400. Add `requestId` to every body. |
| F-24 | P3 | `src/modules/admin/service.ts:205, 230` | `writeCompanySettings(..., updatedBy = '')` for a system actor. `''` is not a UUID and throws. | `setCompanyValue` called from a job would 500. | Pass `null` (the column is nullable). |
| F-25 | P3 | `src/modules/notifications/service.ts:349-437` | Business in-app deliveries are inserted with state `pending` and are never dispatched (J-02 claims only `email`). The delivery monitor shows them as pending forever. Template ids `business.reservation_overridden` and `business.deal_closure` are not in `EmailTemplateId`. | The monitor is misleading (SCR-OWN-012). Type drift. | Insert in-app rows as `sent`. Extend `EmailTemplateId`, or use a separate in-app template type. |
| F-26 | P3 | `src/tests/securityVerification.test.ts:220-229, 232-237` | Tautological tests. "rejects mismatched CSRF" only asserts that two HMACs differ. "extracts client IP through trusted proxy" only asserts that `config.trustProxy` is defined. | False coverage claims for A4/A6. | Drive `authenticate` with a wrong `X-CSRF-Token` and expect 403 `CSRF_FAILED`. Use `app.set('trust proxy',1)` with an `X-Forwarded-For` request and assert `req.ip`. |
| F-27 | P3 | `backend/.env.example` (key names only) vs `devops/env/backend.env.example` | The backend example lacks `TOTP_ENC_KEY(_ID)`, `SMTP_*`, `EMAIL_TRANSPORT`, `EMAIL_ALLOW_REAL_SEND`, `POLICY_COMPANY_TIMEZONE`, `POLICY_ATTENDANCE_*`. The devops example matches the code (all 59 `POLICY_*` keys, session, lockout and SMTP keys). `SESSION_MAX_AGE_HOURS` (legacy alias, `config/index.ts:237`) is undocumented. Plan §7.2 says the default transport is `log`. The code and env doc default to `smtp` when `SMTP_HOST` is set (still gated by `EMAIL_ALLOW_REAL_SEND`). | Checklist A10: new keys in `.env.example`. Doc drift. | Sync `backend/.env.example`. Document or remove the alias. Update plan §7.2. |
| F-28 | P3 | `src/worker.ts:114-126`; `src/index.ts:1-14` | The worker runs relay, scheduler and jobs serially in one loop. A slow SMTP batch (J-02 lease 300 s) stalls the outbox relay. The API has no `pool.end()` on SIGTERM, no SIGINT handler and no `unhandledRejection` handler. | Delayed E-02 session revocation while email is slow. Unclean shutdowns. | Run the relay on its own timer. Add graceful pool close and process-level handlers. |
| F-29 | P3 | `package.json:16` (`owner:bootstrap` uses `tsx src/...`) | The production image ships only `dist/`, and `tsx` is a dev dependency. The documented operator CLI does not exist in production, though `node dist/modules/identity/bootstrap.js` works. `dist/db/seed.js` and `e2e-seed.js` ship too (guarded by `assertSeedAllowed`). | Operator confusion during the first-Owner bootstrap (SE-4 / AU-8). | Add `"owner:bootstrap:prod": "node dist/modules/identity/bootstrap.js"` and document it in DEPLOY.md. Exclude the seeds from `tsconfig.build.json`. |

**Checked and OK:** `helmet`, `Cache-Control: no-store` on `/api`, the JSON 404, `x-powered-by` off, `trust proxy` only when `TRUST_PROXY=true`, CORS limited to `APP_ORIGIN`, a 100 kb body limit. The Origin/Referer check runs on every mutation. The CSRF token (an HMAC of the session id and a nonce) is required on every authenticated mutation and compared in constant time. The session token is only stored as an HMAC. Cookies are HttpOnly, Lax, `__Host-` and Secure in production, with no token in a body. Sessions have idle, absolute and pending windows, rotate after 2FA, and re-read the account status on every request. TOTP has ±1 step and a replay guard, with lockout and session end at the threshold. AU-8 enrollment token plus re-auth, AU-9 bcrypt single-use recovery codes and AU-13 AES-GCM with an employee-id AAD and a keyring are in place. Reset tokens are hashed, single-use and expire after 60 min, and reset ends every session. Config fails closed: an unset NODE_ENV means production, and `SESSION_SECRET`, `TOTP_ENC_KEY`, DB and `APP_ORIGIN` are required. The seed is refused outside dev/test. Email is safe: `EMAIL_ALLOW_REAL_SEND` is enforced twice (the worker refuses to start, and `createTransportFromConfig` falls back to `log`). Tests use the in-memory nodemailer. TLS is required for SMTP, addresses are passed as objects, templates escape HTML and strip CR/LF, and the log line shows the domain only, with the link only in development. Outbox writes happen inside the command transaction with an ids-only payload validator. The relay uses SKIP LOCKED, a lease, per-consumer idempotency, backoff and a dead state. Scheduler slots are unique per `(kind, slot)`. Audit rows are written in the same transaction on every write path in this slice. Audit uses an append-only trigger. Every `/api` route in this slice has `requireAction` or is on the allowlist (`routeGuard.test.ts` passes). Migrations apply in order on an empty DB and use only `IF NOT EXISTS` / additive DDL (except F-12, F-21). Indexes cover every hot query in this slice.

---

## 3. Wiring map (this slice)

### 3.1 Routes

| Route | Action (guard) | Service → repo | Tables | Events emitted |
|---|---|---|---|---|
| `POST /api/auth/login` | public (allowlist) + auth rate limit | `identity/routes` inline, `sessions.createSession` | employees, credentials, two_factor_factors, sessions, audit_events | — |
| `POST /api/auth/2fa/verify` | allowlist, pending-verification only | `completeSecondFactor('verify')`, `rotateSession` | two_factor_factors, sessions, audit_events | — |
| `POST /api/auth/2fa/recover` | allowlist, pending-verification only | `completeSecondFactor('recover')`, `twoFactor.useRecoveryCode` | two_factor_recovery_codes, two_factor_factors, sessions, audit_events | `two_factor.recovery_succeeded` (**no consumer**, F-09) |
| `POST /api/auth/2fa/enroll/start` | allowlist, pending-enrollment only | `verifyCurrentPassword`, `findOpenEnrollmentToken`, `storePendingSecret` | credentials, security_tokens, two_factor_factors, audit_events | — |
| `POST /api/auth/2fa/enroll/confirm` | allowlist, pending-enrollment only | `completeSecondFactor('enroll')`, `consumeEnrollmentTokenById`, `replaceRecoveryCodes` | two_factor_factors, security_tokens, two_factor_recovery_codes, sessions, audit_events | — |
| `POST /api/auth/2fa/recovery-codes` | `employee.manage_own_recovery_codes` (admin) | `checkFactorCode`, `replaceRecoveryCodes` | two_factor_factors, two_factor_recovery_codes, audit_events | — |
| `POST /api/auth/2fa/enrollment-tokens` | `employee.issue_2fa_enrollment_token` (admin) | `verifyCurrentPassword`, `checkFactorCode`, `issueEnrollmentToken` | credentials, two_factor_factors, employees, security_tokens, audit_events | — |
| `GET /api/auth/2fa/status` | allowlist | inline | two_factor_factors, two_factor_recovery_codes | — |
| `POST /api/auth/logout` | allowlist | `endSession` | sessions, audit_events | — |
| `POST /api/auth/sessions/revoke-all` | `auth.session.revoke_all` | inline SQL | sessions, audit_events | — |
| `POST /api/auth/password/change` | `auth.password.change` + rate limit | inline (F-08) | credentials, sessions, audit_events | — |
| `GET /api/auth/me` | allowlist | `capabilitiesFor` | (session row) | — |
| `POST /api/auth/password-reset/request` | public + rate limit | inline, `notifications.queuePasswordResetEmail` | employees, credentials, security_tokens, notification_secrets, audit_events, outbox_events | `password_reset.requested` |
| `POST /api/auth/password-reset/complete` | public + rate limit | inline, `endAllSessions` | security_tokens, credentials, sessions, audit_events | — (E-04 `password_reset.completed` **not emitted**) |
| `GET /api/employees/me` | `profile.read` | `getOwnProfile` → `repo.findById` | employees | — |
| `PATCH /api/employees/me` | `profile.update` | `updateEmployee(self)` → `repo.update` | employees, audit_events | — |
| `GET /api/employees` | `employee.list` | `listEmployees` → `repo.list` + `identity.securitySummaries` + `attendance.openWorkFor` + calls/deals/projects `openItems*` | employees, sessions, two_factor_factors, attendance_sessions, follow_ups, deals, projects, tasks | — |
| `POST /api/employees` | `employee.create` | `createEmployee` → `repo.insert`, `identity.issueCredentialSetup` | custom_roles, employees, security_tokens, notification_secrets, audit_events, outbox_events | `account.created` |
| `GET /api/employees/:id` | `employee.read` | `getEmployee` | as the list | — |
| `PATCH /api/employees/:id` | `employee.update` | `updateEmployee` → `repo.update`; then `revokeAfterCommit` | employees, custom_roles, audit_events, sessions | `account.role_changed` (on role change) |
| `GET /api/employees/:id/open-items` | `employee.read_open_items` | `openItems` | follow_ups, deals, projects, tasks, attendance_sessions | — |
| `PATCH /api/employees/:id/status` | `employee.deactivate` (both directions, F-16) | `setEmployeeStatus` → `repo.setActive`; then `revokeAfterCommit` | employees, audit_events, sessions | `account.deactivated` |
| `GET /api/audit-events` | `audit.read` (admin) | `listAudit` → `repo.listAuditEvents` | audit_events, employees | — |
| `GET /api/settings` | `settings.read` (admin) | `getSettingsView` → `readCompanySettings` | company_settings | — |
| `GET /api/settings/public` | `settings.read_public` | `getPublicSettingsView` → `getSetting` | company_settings | — |
| `GET /api/settings/flags` | `settings.read` | `getFlagsView` | company_settings | — |
| `PATCH /api/settings` | `settings.update` (admin) | `updateSettings` → `writeCompanySettings` | company_settings, audit_events | — |
| `GET /api/notifications` | `notification.list` | `listMyNotifications` → `listInAppDeliveries` (no access re-check, F-11) | notification_deliveries | — |
| `GET /api/notifications/unread-count` | `notification.list` | `countUnreadInApp` | notification_deliveries | — |
| `POST /api/notifications/:id/read` | `notification.mark_read` | `markDeliveryRead` (own, else 404) | notification_deliveries | — |
| `POST /api/notifications/read-all` | `notification.mark_read` | `markAllDeliveriesRead` | notification_deliveries | — |
| `GET /api/delivery-monitor` | `reminder.monitor.read` (admin) | `listDeliveryMonitorRows` | notification_deliveries, reminders, employees | — |
| `POST /api/delivery-monitor/reminders/:id/send-again` | `reminder.send_again` (admin) | `retryDelivery` / `retryReminder` (F-10) | notification_deliveries, reminders | — |
| `GET /health/worker` | none (outside `/api`; nginx-restricted) | `workerHealth` | worker_heartbeats, outbox_events | — |
| `/api/test-support/{clock,jobs/:kind/run,worker/tick,mail}` | allowlist; mounted only when `NODE_ENV=test` | platform/notifications test helpers | jobs, outbox | — |
| *(missing)* Owner-assisted reset, revoke another user's sessions | `auth.password_reset.assist`, `session.revoke` | — | — | F-15 |

### 3.2 Outbox events (all modules)

| Event | Emitter | Consumer(s) | Status |
|---|---|---|---|
| `account.created` (E-01) | employees.createEmployee | notifications.security_email → J-02 `security.credential_setup` | OK |
| `account.deactivated` (E-02) | employees.setEmployeeStatus | identity.revoke_sessions; corrections.release_on_reviewer_deactivation | OK |
| `account.role_changed` (E-02) | employees.updateEmployee | identity.revoke_sessions | OK (F-07 window) |
| `password_reset.requested` (E-03) | identity reset/request | notifications.security_email → J-02 | OK |
| `password_reset.assistance_triggered` (E-03) | — | — | never emitted (F-15) |
| `password_reset.completed` (E-04) | — | — | never emitted (F-09) |
| `two_factor.recovery_succeeded` (E-04) | identity 2fa/recover | — | **no consumer** |
| `follow_up.*` (E-05) | calls.service | notifications.reminder_planner | OK (hard-coded lead, F-10) |
| `meeting.*` (E-06) | meetings.service | notifications.reminder_planner | OK (hard-coded lead, F-10) |
| `calling_assignment.assigned` / `.reassigned` (E-07) | assignment.service (payload `assigneeId`) | notifications.business_events reads `agentId` | **broken** (F-05) |
| `contact_reservation.overridden` (BL-03) | reservation.service (payload `holderId`) | business_events reads `previousHolderId` | **broken** (F-05) |
| `opportunity.developer_assigned` / `_reassigned` (E-08) | deals.service (payload `developerId`) | business_events | OK |
| `data_correction_request.submitted` / `resolved` / `rejected` / `closed` (E-09, BL-17) | corrections.service (payload `businessId`) | business_events reads `requestedBy` | **broken** (F-05) |
| `attendance_correction.submitted` (E-10) | attendance.service | business_events (no branch) | **no-op** |
| `attendance.checkout_provisional` / `checkout_pending_review` (E-11) | attendance.service | — | **no consumer** |
| `attendance.missing_checkin_detected` / `missing_checkout_detected` (E-12) | attendance J-04 | — | **no consumer** |
| `deal.closure_requested` (E-13) | deals.service | business_events → active Owners | OK |
| `deal.closed` (E-14) | deals.service | projects.provision; business_events → Owners | OK |
| `deal.closure_rejected` | deals.service | — | **no consumer** |
| `deal.not_proceeding` | deals.service | meetings.cancel_for_deal_not_proceeding | OK |
| `project.provisioning_failed` (E-15) | projects.service | business_events (no branch) | **no-op** |
| `call_outcome.changed` (E-16) | — | — | never emitted |
| `reminder.failed` / `reminder.suppressed` / `notification.failed` / `notification.suppressed` (E-17) | notifications.service (`notification.*` only) | — | **no consumer** (D6 loop missing) |

### 3.3 Jobs (worker)

| Job | Kind | Registered by | Schedule | Status |
|---|---|---|---|---|
| J-03 outbox relay | `platform.outbox_relay` | platform | worker loop every 2 s | OK |
| J-09 heartbeat | `platform.heartbeat` | platform | `every:60` | OK |
| J-01 reminders | `notifications.reminder_dispatch` | notifications | `every:30` | OK, no C6 re-check (F-10) |
| J-02 deliveries | `notifications.delivery_dispatch` | notifications | `every:30` | OK |
| J-04 attendance | `attendance.exception_check` | attendance | (module) | registered |
| J-05 reservation sweep | `reservation.expiry_sweep` | reservation | (module) | registered |
| J-07 provisioning retry | `projects.provision_retry` | projects | (module) | registered |
| J-06 session cleanup | `identity.session_cleanup` | — | — | **missing** (F-14) |
| J-12 retention purge | `platform.retention_purge` | — | — | **missing** (F-14) |

### 3.4 Migrations

001 → 002 → 010–014 → 020–021 → 030 → 100–103 → 200–202 → 300–350 → 400–430 → 900–903. The lexicographic order equals the FK dependency order, and a fresh build succeeds. Issues: F-04 (012 role collision), F-12 (014), F-21 (021 CASCADE), F-22 (no advisory lock), F-14 (`100` RESTRICT FK needs a purge order).

---

## 4. Files reviewed

- `backend/package.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/vitest.config.ts`, `backend/eslint.config.js`
- `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/worker.ts`
- `backend/src/config/index.ts`
- `backend/src/middleware/auth.ts`, `errorHandler.ts`, `requestGuards.ts`
- `backend/src/shared/access.ts`, `errors.ts`, `flags.ts`, `module.ts`, `outbox.ts`, `pagination.ts`, `platform.ts`, `routeGuard.ts`, `sql.ts`, `tx.ts`
- `backend/src/db/pool.ts`, `migrate.ts`, `seed.ts`, `e2e-seed.ts`
- `backend/src/db/migrations/` 001, 002, 010, 011, 012, 013, 014, 020, 021, 030, 100, 101, 102, 103, 900, 901, 902, 903 (read in full). 200–430 were read only as FK/order context, because they belong to reviewers 02 and 03.
- `backend/src/modules/index.ts`
- `backend/src/modules/identity/`: `module.ts`, `routes.ts`, `service.ts`, `schemas.ts`, `repo.ts`, `security.ts`, `sessions.ts`, `twoFactor.ts`, `secretBox.ts`, `env.ts`, `bootstrap.ts`, `be1.api.test.ts` (structure), `sec3.unit.test.ts` (structure)
- `backend/src/modules/employees/`: `module.ts`, `routes.ts`, `service.ts`, `schemas.ts`, `repo.ts`
- `backend/src/modules/admin/`: `module.ts`, `routes.ts`, `service.ts`, `schemas.ts`, `repo.ts`, `audit.ts`
- `backend/src/modules/platform/`: `module.ts`, `routes.ts`, `service.ts`, `repo.ts`, `schemas.ts`, `idempotency.ts`, `clock.ts`, `platform.api.test.ts` (structure), `platform.test.ts` (structure)
- `backend/src/modules/notifications/`: `module.ts`, `routes.ts`, `service.ts`, `repo.ts`, `schemas.ts`, `emailConfig.ts`, `emailStub.ts`, `transport.ts`, `templates.ts`, `secrets.ts`, `email.test.ts` (structure), `notifications.api.test.ts` (structure + in-app case)
- `backend/src/tests/`: `runtimeRole.test.ts`, `routeGuard.test.ts`, `globalSetup.ts`, `helpers/fakeDb.ts` (in full); `securityVerification.test.ts` (in part); `auth.api.test.ts`, `auth.test.ts`, `config.test.ts`, `identity.unit.test.ts`, `security.test.ts`, `shared.test.ts` (structure)
- Read for cross-checks only: `modules/access/dynamicService.ts`, `modules/access/matrix.ts` (head); the emit sites in `assignment`, `reservation`, `corrections`, `deals`, `meetings` and `calls` services; `devops/env/backend.env.example`, `devops/env/postgres.env.example`, `devops/backend.Dockerfile`, `devops/scripts/prod-smoke.sh` (DB user lines), `.github/workflows/ci.yml` (lint/test steps), `docs/review/00-baseline.md`, `docs/implementation/plan.md`, `docs/security/authz-matrix.md`, `docs/security/checklist.md`
