# H — Independent integration and release QA (2026-11-04)

Agent H (Opus). I implemented none of the fixes. Tested commit **`1644e29`** on branch
`review/2026-11-04-fixes` (working tree clean apart from the new test files listed below). Environment:
throwaway database `udigity_test_h` on the test container (127.0.0.1:55432), freshly created, migrated and
seeded by the suite's global setup; the real Express app driven in process with supertest; worker functions
(`relayOutboxOnce`, `runDueJobs`, `dispatchDueDeliveries`, `retentionPurge`, `sendOpsAlerts`) called directly.
No browser, no fixed-port server, no build, port 55433 never touched. The database and the review login role
were dropped at the end.

## 1. Totals

| Run | Files | Tests | Result | Duration |
|---|---|---|---|---|
| Full backend suite on the fresh DB, before my files existed | 41 passed (41) | **1176 passed (1176)**, 0 failed, 0 skipped | green | 287.3 s |
| My three new files alone (`src/tests/review-h/`) | 3 passed (3) | **26 passed (26)** | green | ~75 s |
| Full backend suite again on the **same, already used** DB (my files included) | 5 failed, 39 passed (44) | **9 failed, 1192 passed (1201)** | red (timeouts only, see §1.1) | ~15 min |
| Full backend suite on a **re-created fresh** DB, my files included | **44 passed (44)** | **1202 passed (1202)**, 0 skipped | green | 258.5 s |

### 1.1 Second full run

All 9 failures of the reused-DB run are **timeouts** (5 s, 30 s, 60 s, 120 s), not assertion failures:
`attendance.api.test.ts` (J-04 missing checkout, D1 shift end, D1 days off, D6), `be2.api.test.ts` (categories
list, D12; with `API busy` lock-timeout logs), `delivery.api.test.ts` (D16 direct close),
`notifications.api.test.ts` (FX-MAIL SMTP 250), `fxbe.api.test.ts` (notification consumers). They drain or
relay the whole outbox/job/reminder backlog left by the previous run (including clock-pinned future jobs), which
no longer fits their time limits. On a re-created DB the same code and the same files are all green (row 3).
So the suite is **only reliable on a fresh database** (H-07); the release verdict uses the fresh runs.

`describe.skip`, `it.skip`, `.todo`, `.only`, `it.fails`: **none** in backend or frontend tests (searched). Every
DB suite is `describe.skipIf(!hasTestDb)`; CI sets `TEST_DATABASE_URL` (`.github/workflows/ci.yml:87`), so they
are not silently skipped there (CI itself is not running: account billing, README).

## 2. New regression tests (added, not modifying any existing file)

| File | What it pins |
|---|---|
| `backend/src/tests/review-h/h-fixes.api.test.ts` (14 tests) | F-01/E-01 against an **Owner** with production-like proxy trust (`'loopback'`, not `true`): 5 failures from IP A → 429 for that pair only, correct password + TOTP from IP B works, `locked_until` stays NULL, failures audited with the attacker IP; email case variants share one bucket; rotating inside one IPv6 /64 gives no fresh bucket; 40 successful logins of 8 staff from one NAT address. F-05 across 6 rotating IPs (3 tokens, identical answers). E-02 by create **and by edit**, three scopes each, 13 Owner-only rows; a 2FA-verified custom-role holder refused 5 Owner routes. E-08 via list/detail/call-notes. C-01/C-07 table (12 GETs, 18 writes incl. `from[]=`, `page[x]=`, 1e300, NUL, impossible/future dates), no state change, **no `api.error:*` ops alert raised**. S-27 through the API (create and edit both blocked, the original business may take the number back). C-02/C-06/R-02 paging walk as **Developer** (deals, projects) and **Call Center** (businesses) with identical timestamps, page 999 = 200 + real total. C-03 with two agents and three parallel runs (the original repro) + no double assignment. D-03/C-08 for e-mail deliveries (three concurrent dispatchers send once; a throwing transport ends `failed`, attempts ≤ 4). B-02 contract exactly as `frontend/src/lib/api/attendance.ts` calls it. C-19 boundary (59 min → new break allowed, 60 min → 409). |
| `backend/src/tests/review-h/h-restricted-role.api.test.ts` (5 tests) | **D-01/D-02 under a real LOGIN role** created like `devops/postgres/init/10-app-role.sh` (NOSUPERUSER member of `udigity_app`, grants re-applied by `udigity_apply_app_grants()`), the app pointed at it: business create / edit (phone removed) / duplicate / archive / restore; assign → reservation → accepted attempt → developer → payment + signature → closure request → Owner verify → project provisioned → developers → task → status; attendance settings → check-in → break → check-out → correction → approve; custom-role edit (role_permissions DELETE); password reset e-mail; relay + dispatch; **retention purge with every window passed** and session cleanup; logout. Then the same connection: 21 statements (DELETE on businesses/deals/employees/credentials/call_attempts/attendance_sessions/attendance_corrections/projects/tasks/custom_roles/phone registry, UPDATE on 5 history tables + audit + registry, TRUNCATE audit/sessions, DISABLE TRIGGER, CREATE TABLE) → all `42501`. |
| `backend/src/tests/review-h/h-journeys.api.test.ts` (7 tests) | Owner bootstrap (`runBootstrap`, second run supersedes the first token) → MFA enrollment → invite → e-mailed link → set password (no session, single use) → sign-in; audit actor chain. Data Entry create/edit/visible duplicate/hidden duplicate → review request → Owner notification, no access granted → correction request by the agent → start review → resolve with the business change. Call Center queue → reservation (other agent refused) → callback follow-up → **D9 callback window** (access past the 15-day window, gone at callback + 49 h) → accepted → D15 (agent and other developers blind) → handoff (notification, deal/notes/business readable) → reassignment (former developer loses deal, notes, list entry **and the inbox item**; new developer notified). Developer facts → closure request (Owner notified) → verify → project/task lifecycle with stale-version 409 → **closed-deal access ends 16 days after completion**; directory denied. Attendance: outside office 422 (no session), Owner remote exception → `remote` session; grace boundary 09:10:00.000 on time / 09:10:00.001 late; holiday = non-working day; failed checkout outside office → `closed_provisional` + Owner review item; missing checkout flagged by `attendance.exception_check` → self checkout 409 `CORRECTION_REQUIRED`, check-in blocked, correction approved → unblocked, original check-in kept; E-03 consequence for an Owner (see H-01). |

They pass on `1644e29`, are lint- and type-clean, and need only `TEST_DATABASE_URL`. The restricted-role file
creates the cluster-wide login `udigity_api_h_review` with a random password (never printed) and drops what it
owns in `afterAll`; on a shared cluster drop the role afterwards (`DROP ROLE udigity_api_h_review`) or run it
on a disposable container (CI is).

## 3. Item-by-item verification on `1644e29`

| Item | Verdict | Evidence (independent unless stated) |
|---|---|---|
| F-01 / E-01 — attacker from one IP cannot lock the Owner; correct password from another IP works | **Verified** | `h-fixes` E-01 tests (Owner with enrolled TOTP, `trust proxy 'loopback'`). `credentials.locked_until` NULL afterwards; 5 `login.failed` rows with the attacker IP. Per-account delay measured: after 10 failures from 10 addresses the next correct login still succeeds (≈1 s delay). Caveat: H-02 (a success does not reset the pair bucket). |
| F-01 — office-NAT successful logins never limited | **Verified (pair bucket and route)**, per-IP ceiling only by unit test | 40 successes of 8 staff from one address → all 200. The per-IP ceiling (100/15 min) cannot be hit through the real route in tests because `vitest.config.ts` sets `AUTH_RATE_LIMIT_MAX=1000`; `skipSuccessfulRequests` on that bucket is covered only by the stand-in handler in `identity.unit.test.ts`. nginx zones: not tested (no server). |
| F-05 — reset flooding | **Verified** | 6 requests from 6 addresses, upper-cased email → exactly 3 tokens, byte-identical 202 bodies. Each issued request still supersedes the previous live link (3/h), as designed. |
| E-02 / E-08 — custom role cannot hold Owner-only rows; D15 for custom roles | **Verified** | 13 Owner-only actions × 3 scopes refused on create (400) and on PATCH (400, stored grants unchanged); a holder with a verified second factor gets `FORBIDDEN_ROLE` on 5 Owner routes. `deal.read: global` holder: deal absent from list, detail and call notes 403/404, no note text leaked. |
| E-07 — attendee options | **Verified** | `h-fixes` E-07: for Call Center and Developer, no Data Entry / other agent / other developer id; items only self or Owners; only `id, fullName, role`; no email or phone. |
| D-01 / D-02 — restricted login; DELETE/UPDATE refused; app paths work | **Verified** | `h-restricted-role` (see §2). Static check: every `DELETE FROM` in non-test code targets a table in `delete_tables`; no `ON CONFLICT DO UPDATE` or `FOR UPDATE` on an append-only table. |
| S-27 — removed phone still blocks a different business | **Verified** | Through the API: create blocked (409 `DUPLICATE_BLOCKED`), edit of another business blocked, duplicate-check `blocked: true`, original may re-add. Also under the restricted login. |
| C-01 — impossible dates / NUL → 400 | **Verified** | 30 cases, all 400, no `api.error:*` ops alert, deal unchanged. Includes C-07 (future payment/signature dates 400). |
| C-02 / C-06 / R-02 — paging for scoped roles | **Verified** | Developer deals (9) and projects (3), Call Center businesses (≥9), identical `created_at`, pageSize 2: no repeats, no gaps, stable total, page 999 = 200 + real total. |
| C-03 — parallel auto-fill ≤ 40 | **Verified**, see H-03 | Two agents, three parallel runs: both queues ≤ 40, no business assigned twice. Two of the three runs answered **503 `BUSY_TRY_AGAIN`** (lock wait > `lock_timeout` 5 s). |
| C-08 / D-07 / D-03 — poison job, lease, alerts, e-mail | **Verified** (D-07 by re-run only) | Two poison jobs of one kind → `dead` 2, **one** `ops_alerts` row (`occurrences` 2), two concurrent `sendOpsAlerts` → 1 send (one mail per recipient). E-mail: three concurrent `dispatchDueDeliveries` → one message; a throwing transport → row `failed` after ≤ 4 attempts. D-07 (completion guarded by lease) checked only by `reviewFixBeb.api.test.ts` + code read (`markJobDone(..., leaseUntil)`). |
| C-19 — break allowance | **Verified** | 59 min used → next break 201; exactly 60 min → 409 `BREAK_ALLOWANCE_USED`. Note `breakAllowanceMinutes: 0` means *unlimited* (`allowanceSeconds > 0` guard), not "no breaks" — worth stating in Settings copy. |
| E-03 — self-decision guards | **Verified**, see H-01 | Owner on own session: approve correction, adjust, resolve-review → 403 `SELF_DECISION`; another Owner can approve. |
| B-02 — remote-exception routes used by the new screen | **Verified** | grant (201, DTO has `id, version, status, startDate, endDate, reason, employeeName`), list with `employeeId/status/page/pageSize`, revoke with reason, stale approve 409, reject without reason 400, approve with `reason` omitted 200, non-Owner `FORBIDDEN_ROLE` on all three, Owner self-grant 403, audit row. UI requires a revoke reason; server does not (UI stricter: fine). |

## 4. Journeys (§2 file `h-journeys`) — all **Verified**

Persisted state and authorization consequences checked at each step (see §2). Notification generation verified
for: calling assignment (agent), duplicate review request (Owner), developer handoff (developer), reassignment
(new developer), closure request (Owner). Access re-check: the former developer's handoff item disappears
from their inbox after reassignment (inbox is access-filtered), and the deal, call notes and list entry are
refused at once. Developer `GET /api/search` answers 200 but returned no business outside their context
(checked against the other journeys' records).

## 5. New findings

### H-01 · Low (Owner decision) · Non-blocker · Confirmed — a single-Owner company can never decide the Owner's own attendance fixes

- **Requirement / role:** D4/D5 (employees request, Owner decides), E-03 fix, Owner attendance "no exemption" (matrix 3.3 F-04).
- **Location:** `attendance/service.ts` `selfDecision` guards at l.1089 (approve correction, pre-existing), 1418 (adjust), 1479 (resolve review), 1543 (retroactive create) — the last three added by the E-03 fix; custom roles can no longer hold these rows (E-02 fix).
- **Reproduction (executed, `h-journeys` "E-03 consequence"):** Owner checks in, never checks out; `attendance.exception_check` runs; next morning check-in 409, check-out 409 `CORRECTION_REQUIRED`; correction request 201; own approve / adjust / resolve-review all 403 `SELF_DECISION`.
- **Expected vs actual:** The Owner is **not** locked out of attendance (the pending request lets them check in: 201, S-24). But with one Owner nobody can ever approve or adjust the Owner's own session: it stays pending/missing-checkout forever and feeds the timesheet export that way. Before the E-03 fix the Owner could adjust their own session as a fallback.
- **Fix options (Owner decides):** allow an Owner self-adjust with mandatory reason + distinct audit event (and show it in the audit view), or accept that Owner sessions stay unreviewed, or require a second Owner.
- **Regression test:** `h-journeys.api.test.ts` (asserts today's behaviour, including that check-in is never blocked).

### H-02 · Low · Non-blocker · Confirmed — a successful sign-in does not reset the (email, IP) failure bucket

- **Location:** `identity/limits.ts` `createLoginPairLimiter` (`skipSuccessfulRequests` only un-counts the success itself).
- **Reproduction (executed):** same email and address: 401 ×4, **200** (correct password), 401, then 429, 429 (the correct password is refused for up to 15 min).
- **Expected vs actual:** the old DB lockout reset on success; now 4 early typos + 1 later typo inside 15 minutes block that employee from the office address even though they proved the password in between. Small, but it lands on real users at the office (the case F-01 was about), not on attackers.
- **Fix:** on a successful login call `loginPairLimiter.resetKey(`login-pair:${emailKey}|${ipBucket}`)` (express-rate-limit API) or keep the key in a store the route can clear.
- **Regression test:** the sequence above; expect the last request 200.

### H-03 · Low · Non-blocker · Confirmed — overlapping auto-fills answer "system busy" after 5 s instead of a clear message

- **Location:** `assignment/service.ts:286` `pg_advisory_xact_lock('calling.autofill')` + pool `lock_timeout` 5 s (`db/pool.ts`).
- **Reproduction (executed):** three parallel `POST /api/calling-assignments/autofill {}` → one 200, two **503 `BUSY_TRY_AGAIN`** (safe: rolled back, caps hold). The fix agent's own test covers one agent only, where all runs are fast enough to pass.
- **Impact:** a double-click or two Owners clicking within the run time gets a generic "busy" error; a long run (many agents) blocks the waiter for the full 5 s.
- **Fix:** `pg_try_advisory_xact_lock` and answer 409 "Auto-fill is already running" immediately, and/or require an Idempotency-Key on the button.

### H-04 · Low (Owner confirmation) · Non-blocker · Confirmed (code + constraint) — archive refusal is new policy, and its test never reaches its last assertion

- **Location:** C-20 fix in `businesses/service.ts` `setBusinessArchived` (409 `ACTIVE_RESERVATION` / `OPEN_DEAL`); test `businesses/integrity.api.test.ts` "C-20".
- **Policy:** D20 says archive/deactivate and preserve relationships; it does not say archiving is refused while a deal is open. The finding itself called the old behaviour "possibly intended". No `decisions.md` entry records the new rule.
- **False green:** the test's final step runs only `if (stage === 'not_proceeding')` after `UPDATE deals SET stage = 'not_proceeding'` without a reason — `deals_np_has_reason` (`400_deals_core.sql:49`) rejects that update, so the branch never runs and "archive succeeds once the deal no longer blocks" is never asserted.
- **Fix:** record the Owner's answer; make the test move the deal through `POST /api/deals/:id/not-proceeding` (reason) and assert the archive unconditionally.

### H-05 · Low · Non-blocker · Confirmed — IMPL-LOCKOUT semantics changed without a decision record; config comment is stale

- `config/index.ts` still documents "5 failures per account in 15 min -> 15 min lock"; sign-in now never sets the account lock (pair bucket + progressive delay), and `LOCKOUT_DURATION_MINUTES` only applies to re-authentication and the TOTP factor. E-01 asked for an Owner decision on IMPL-LOCKOUT values; `decisions.md` gained only S-27/S-28. The change is sound security-wise (verified), but the "approved defaults" register should say what the lockout now is.

### H-06 · Low · Non-blocker · Suspected (code) — ops alert retried to every recipient when one recipient fails; exhausted alerts vanish silently

- **Location:** `notifications/opsAlerts.ts` `sendOpsAlerts`: one failed recipient leaves `sent_at` NULL, so the next run re-sends to all recipients (duplicates for the ones that succeeded) until `MAX_ATTEMPTS`; after that the row is never claimed again and nothing marks it failed.
- **Fix:** track per-recipient sends or mark the alert sent when at least one recipient accepted; mark exhausted alerts (`failed_at`) and show them on the Delivery monitor.
- Not executed (my probe used two memory recipients that both succeed).

### H-07 · Low · Non-blocker · Confirmed — the backend suite is not re-runnable on a used test database

- **Reproduction (executed):** full suite on a fresh DB → 1202/1202 green; immediately again on the same DB → 9 failures, all timeouts (§1.1).
- **Root cause:** tests drain global queues (`relayOutboxOnce` / `dispatchDueDeliveries` / `runDueJobs` loops "until empty", some under a pinned clock) and share global attendance settings, so their run time grows with every earlier run's leftovers.
- **Impact:** developers re-running locally see red without a code change; a flaky CI cache of the DB would look like a regression. CI uses a fresh service container, so CI itself is not affected.
- **Fix:** scope drains to the test's own aggregate ids, or reset queues in `globalSetup` (`TRUNCATE` of outbox/jobs/deliveries on the throwaway DB only), or document "fresh DB per run".

## 6. Test-quality audit

### 6.1 Changed or removed assertions in the fix commits (`git diff cab5ec9..1644e29 -- '*.test.ts'`)

| File | Change | Justified by |
|---|---|---|
| `access/access.test.ts`, `access/rbac.api.test.ts` | Grantable admin rows → now refused (`FORBIDDEN_ROLE`, 400, `grantable: false`); role fixture shrank from 5 to 4 grants | **S-26** ("can never hold Owner-only actions"). Stronger, not looser. |
| `identity/be1.api.test.ts` | Old cookie after password change 200 → 401; new cookie 200 | E-09 fix (rotation). Stronger. |
| `identity/be1.api.test.ts`, `tests/shared.test.ts` | Unknown `sort` 200 → 400 / throws | C-11 (contract consistency); no policy involved. Frontend sort keys checked: all whitelisted (`name`, `closedAt`, `targetDate`, `scheduledFor`). |
| `businesses/be2.api.test.ts` | `GET /api/businesses/not-a-uuid` 404 → 400 | C-11. A malformed link now shows a validation error instead of "not found" in the UI; cosmetic. |
| `tests/config.test.ts` | `PUBLIC_APP_URL` must now equal `APP_ORIGIN` | C-14 (stricter). |
| `tests/identity.unit.test.ts` | **Removed** "locks the account on the 5th failure and refuses even the right password"; replaced by "a failure never sets the lock / a stored lock does not refuse" | E-01 fix; but see **H-05** (no recorded decision). |

No assertion was loosened to make a failing fix pass; every change tracks a deliberate behaviour change.

### 6.2 Weak tests / false greens

1. **Every DB test runs as the superuser** (`udigity_test`). Grants (998), `SECURITY DEFINER` triggers and the D20 triggers were never exercised by an application path under the runtime role; `runtimeRole.test.ts` probes `SET ROLE udigity_app` statements in a rolled-back transaction only. Closed by `h-restricted-role.api.test.ts`; consider running the whole suite as a restricted login in CI.
2. **`AUTH_RATE_LIMIT_MAX=1000` for all tests** (`vitest.config.ts`): the per-IP login ceiling is never hit through the real route; only a stand-in handler covers it.
3. **`integrity.api.test.ts` C-20**: conditional last assertion never executes (H-04).
4. **`fixBeA.test.ts` C-03**: one agent only; does not reproduce the original two-agent overfill and does not check duplicates (my test does). **C-06**: Owner only (R-02 then broke scoped roles; the R-02 test in `delivery.api.test.ts` covers Developer but with whatever rows exist, possibly 0 = 0).
5. **`reviewFixBeb.api.test.ts`**: C-08 alert check is `rowCount > 0` for a kind that earlier runs may already have created (would pass without the fix's alert); it also inserts a global `attendance_settings_versions` row (all 7 working days, loopback IPs, grace 15) and never restores it, runs `UPDATE ops_alerts SET sent_at = now() WHERE sent_at IS NULL` on every pending alert and deletes `ops_alerts` rows by pattern — shared state for every later file in the same DB (`fileParallelism: false`, one DB). `attendance.api.test.ts`, `breaks.api.test.ts` and `d18.api.test.ts` also insert settings versions directly.
6. **Fixtures by direct SQL instead of the API** in the fix tests and older suites (accepted `call_attempts`, `calling_assignments`, deals via the `createAcceptedOpportunity` system command, `UPDATE attendance_sessions SET state='closed'` for the Owner): the validation and authorization of those steps are skipped. My journeys drive them through HTTP.
7. **Role matrices in `be2.api.test.ts` / `delivery.api.test.ts`**: allowed roles assert only "not `FORBIDDEN_ROLE` and not 500" — status-only by design; acceptable as a route-guard matrix, not as behaviour evidence.
8. Frontend `polling.test.ts` pins that a 429 keeps the same interval (no backoff, no `Retry-After`); with F-03 in mind a backoff on 429 would be safer (UI agent's area).
9. Excessive mocking: limited to `FakeDb` unit tests (`identity.unit.test.ts`), each mirrored by a DB test; acceptable.

## 7. Release view from H

No Critical/High defect found on `1644e29`. The ten High items of the register that are backend-verifiable
(F-01, E-01 class, R-02, B-02 contract) hold. New items H-01…H-07 are Low; H-01 and H-04 need an Owner answer,
H-05 is a documentation entry. Not covered by me: nginx/outer-proxy behaviour (G-01/G-02, F-03 at runtime),
UI (agent A), deployment.
