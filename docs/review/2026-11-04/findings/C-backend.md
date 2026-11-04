# Agent C — backend and API correctness (discovery only, no source edited)

Tested commit: `cab5ec9` + uncommitted frontend work (backend unchanged). Evidence: in-process supertest scripts on a throwaway DB
`udigity_test_rev_c` (demo-seeded), plus static reading of `backend/src`. The DB was dropped at the end.
**Environment note:** `udigity-test-db` was re-initialised (data wiped) mid-review and later crashed (tmpfs full). Checks marked
"Not tested (test DB container lost its 512 MB tmpfs data; not re-run)" were not run. Scratch scripts: `C:\Users\Hani\AppData\Local\Temp\claude\a25399f2550b68da\b1ed2321-d7ef-454b-bbf7-54f33e576861\scratchpad\agent-c\p*.ts`.

Severity counts: Critical 0 · High 0 · Medium 9 (C-01…C-09) · Low 12 (C-10…C-21). The existing test suite is broad; most policy rules are tested.

## Findings

### C-01 Medium · Non-blocker · Confirmed — Invalid calendar dates, NUL bytes and huge numbers return 500 (and raise ops-alert emails)
Location: regex-only `YYYY-MM-DD` fields (`deals/schemas.ts:46,95,129,157,158`, `admin/schemas.ts:70-72`, `projects/schemas.ts:35`, `businesses/schemas.ts:38`, `work/schemas.ts:53,67`) and free text on many routes.
Repro (supertest, Owner / Data Entry session):
- `GET /api/deals?from=2026-02-31` → 500 `INTERNAL_ERROR` ("date/time field value out of range"); `GET /api/audit-events?from=2026-02-31` → 500.
- `POST /api/deals/:id/payment {date:'0000-01-01'}` → 500; `POST /api/businesses` with social `lastPost:'2026-02-31'` → 500; `POST /api/work-items dueDate:'2026-02-31'` → 500.
- A `\u0000` character in business name / notes / handle (`POST /api/businesses`), employee fullName, category name, `GET /api/search?q=a%00b`, `GET /api/businesses?q=`, `GET /api/deals?q=`, remote-exception reason → 500.
- `POST /api/targets targetValue: 9.9e15` → 500 (no upper bound).
Expected 400 VALIDATION_ERROR. Actual 500 plus an `api.error:<route>` ops alert. Fix: shared `isoDate` refine (real calendar + sane range), reject NUL in a shared string helper (or map pg 22021/22007/22003/22008 to 400 in `errorHandler`), cap numbers. Regression: table-driven 400 test.

### C-02 Medium · Confirmed — Offset paging loses and repeats rows (no tie-breaker)
Location: `work/repo.ts` targets (`ORDER BY start_date DESC, created_at DESC`) and work items (`due_date ASC NULLS LAST, created_at DESC`); `deals/service.ts:340,544` and `projects/service.ts:281` also lack `id` (code-evident; small data did not reproduce). Inbox, monitor, attendance, businesses, employees, corrections, calling lists, audit have a tie-breaker.
Repro: insert 300 targets / 300 work items in one statement (identical created_at); walk `GET /api/targets?pageSize=13` and `/api/work-items?pageSize=7`. Targets: total 308 → 290 distinct seen, 18 duplicated, 18 missing. Work items: total 304 → 270 distinct, 5 duplicated, 34 missing.
Fix: append `, id` to every OFFSET ORDER BY (make `orderByClause` take a mandatory tie-breaker). Regression: paging walk with equal timestamps.

### C-03 Medium · Confirmed — Parallel "Auto-fill queues" exceed the D8 cap of 40
Location: `assignment/service.ts autofill` (room computed from a snapshot, no lock; `Idempotency-Key` optional).
Repro: 3 concurrent `POST /api/calling-assignments/autofill` with different keys, 2 agents, cap 40 → 67+67+10 assigned; queues 86 and 85. Expected ≤ 40 each. Fix: transaction-level advisory lock at the start of autofill. (Overlap Agent D.)

### C-04 Medium · Confirmed — CSV export writes dates wrapped in literal quote characters
Location: `reports/service.ts escapeCsvField` (`typeof val === 'object' ? JSON.stringify(val)`; pg returns `Date`).
Repro: `POST /api/reports/export {report:'rep-4'}` → cell `"""2026-11-04T08:58:14.492Z"""` (the parsed value contains the quotes). Affects every timestamp in rep-1…rep-4 including the "Payroll Ready" timesheet. JSON export is fine. Fix: format `Date` with `toISOString()` before escaping. Regression: CSV parse of a Date cell equals the ISO string.

### C-05 Medium · Confirmed — Export row cap 1000 silently truncates "full" reports; catalogue promises columns that do not exist
`EXPORT_LIMITS.rowCap = 1000` (marked not approved). 1,133 businesses → 1000 rows, `X-Export-Truncated: true` (header only). Catalogue says "Full database", "Complete record" and mentions phones, reservation locks, agent notes and a "PDF Summary" — none exist in `queryExportRows` (csv/json only). Report ORDER BY has no tie-breaker, so the capped subset is not deterministic. Needs an Owner decision on the cap (Missing company config) and UI that shows truncation.

### C-06 Medium · Confirmed — Paging `total` is 0 past the last page (deals, projects, opportunities)
`COUNT(*) OVER()` in `deals/repo.ts:299`, `projects/repo.ts:192` returns nothing for an empty page. Repro: `GET /api/deals?pageSize=3&page=500` → `total 0` (page 1 says 10); same for `/api/projects`, `/api/calling/opportunities`. Other lists keep the true total. Fix: separate count query.

### C-07 Medium · Confirmed — Payment/signature dates accept the future
`RecordPaymentBody.date`, `RecordSignatureBody.date`, financial-correction dates are regex only. Repro: `POST /api/deals/:id/payment {date:'2999-01-01'}` → 200, deal becomes `paid` with a 2999 payment date (D16 closure evidence). Expected: reject dates after company-timezone today and before a sane floor.

### C-08 Medium · Confirmed (code) — Poison job / email delivery can loop forever
- `platform/repo.ts claimJobs` and `claimOutboxEvents` increment attempts on claim but never check `attempts < max`; a job that hard-crashes the worker (`exitOnCrash`) is re-claimed after its lease with no dead-end (dead is set only in the in-process `catch`).
- `notifications/service.ts dispatchDueDeliveries`: an exception inside the per-delivery `try` is only logged; the row stays `pending` with a 120 s lease and is re-claimed forever (no cap, never visible as failed on the Delivery monitor).
Fix: claim only rows under the cap; mark over-cap rows dead/failed with an ops alert. Runtime repro: Not tested (test DB container lost its 512 MB tmpfs data; not re-run).

### C-09 Medium · Confirmed (code) — No database timeouts; external DNS inside a transaction
No `statement_timeout`, `lock_timeout` or `idle_in_transaction_session_timeout` anywhere (only `SET LOCAL` in exports). Pool is 20 clients, 5 s connect timeout. `lockEmployeeAttendance` uses `pg_advisory_xact_lock` (waits indefinitely) and check-in/out resolve office DNS (≤2 s per host) inside the transaction, against the "no external calls in a transaction" rule (`attendance/service.ts checkIn/checkOut`, `officeDns.ts`). A stuck lock holder can pin all 20 clients. Stall demo: Not tested (test DB container lost its 512 MB tmpfs data; not re-run). Fix: role/pool timeouts (e.g. 30 s statement, 5 s lock, 60 s idle-in-tx); resolve DNS before BEGIN. (Overlap D/G.)

### C-10 Low · Confirmed — Error contract inconsistent
`errorHandler.ts`: ZodError, malformed JSON, 413, pg 23505, generic 4xx and `ORIGIN_REJECTED` / `UNAUTHENTICATED` bodies omit `requestId`. Zod errors use `flatten().fieldErrors` (nested paths collapse) while businesses uses its own `parse` with `a.0.b` paths (two shapes). 413 is code `BAD_REQUEST`; malformed URI → `{"error":"Request failed","code":"ERROR"}`; wrong method on a known path → 404 (`METHOD_NOT_ALLOWED` unused). No SQL/stack leakage seen.

### C-11 Low · Confirmed — Inconsistent unknown `sort` and invalid-id handling
Unknown `sort` is silently ignored on businesses, attendance, deals, projects, employees, audit, notifications, targets, work-items but 400 on calling lists, follow-ups, categories. `GET /api/businesses/not-a-uuid` → 404 while other modules → 400. `work-items` accepts `sort/order` and ignores them.

### C-12 Low · Confirmed — "10 non-whitespace characters" bypassed by invisible characters
`attendance/time.ts summaryCharCount` = `replace(/\s+/g,'').length`. Ten U+200B, U+2800 or U+3164 count as 10; each emoji counts 2. NBSP/FEFF are excluded correctly. Strip `\p{White_Space}` and `\p{Cf}`, count code points.

### C-13 Low · Confirmed (code) — My Day status uses the UTC date
`work/service.ts withMyDayFields`: `new Date().toISOString().slice(0,10)` ignores company timezone and the test clock; "Due today"/"Overdue" is wrong 00:00–03:00 Beirut. Use `progressContext().today`.

### C-14 Low · Confirmed — `APP_ORIGIN` and some env values not validated in production
`loadConfig` accepts `https://x.com/`, `http://…`, a bare host, `*`, upper-case. The origin check is an exact `includes`, so a trailing slash or upper-case value makes every browser POST 403 `ORIGIN_REJECTED` (login included) while `/readyz` stays green; `http://` weakens the CSRF origin. Also accepted: `PORT=99999`, `SESSION_IDLE_MINUTES=1.5abc` (parseInt), `PUBLIC_APP_URL=https://localhost:3000`; default `SMTP_FROM` is `no-reply@udigity.invalid` even with SMTP configured. Verified by direct `loadConfig` calls. Fix: normalise to `URL.origin`, require https, fail on unusable values.

### C-15 Low · Confirmed (code) — `/readyz` is unauthenticated, unthrottled and descriptive
Outside `apiReadLimiter`; 2–4 queries per call; 503 body names the missing setting. It does not check migrations, worker heartbeat or email transport. Production readiness needs `company.timezone` saved, so a fresh deploy is "unready" until the Owner configures it (confirm orchestrator probes `/healthz`).

### C-16 Low · Confirmed — Idempotency edge cases
(a) A crash between claim and store leaves `status 0` for `retention.idempotencyHours` (48 h): same-key retry → 409 STATE_CONFLICT until expiry (Not tested: disk full). (b) 4xx responses are stored and replayed: 400, then corrected body with the same key → 409 IDEMPOTENCY_KEY_REUSED (verified). Most routes use `required:false`; creates without it: `POST /employees`, `/categories`, `/targets`, `/work-items` (targets/work-items double-submit creates duplicates).

### C-17 Low · Confirmed — Duplicate/overlapping targets allowed; fractional unbounded `targetValue`
No uniqueness on (employee, metric, period, start) (300 rows inserted); `targetValue: z.number().positive()` accepts 0.5 and overflow values (C-01).

### C-18 Low · Confirmed (code) — Audit date filter uses UTC days, not company timezone (D7)
`admin/schemas.ts:69` states "UTC day start".

### C-19 Low · Confirmed (code) — Break minutes limit is advisory
S-25 "60 minutes total": only the count (3) blocks at start; excess minutes are audited (`attendance.excessive_break_detected`, `isExcessive`) and never block. Tested as designed; confirm Owner intent.

### C-20 Low · Confirmed (code) — Archiving does not clean up dependants
`setBusinessArchived` leaves an Active reservation, open follow-ups, open assignment, open deal and scheduled meetings untouched (access checks later deny/skip them). D20 says preserve relationships, so possibly intended; no dangling-state test.

### C-21 Low · Confirmed — Mid-stream export abort is audited only as generic "error"
On disconnect the export transaction rolls back (`report.exported` and the export record vanish) although a chunk was already sent; only `report.export_failed {reason:'error'}` remains. Slots are released correctly (verified: 8 aborted parallel exports → 6 `export_failed`, 2 × `429 CONCURRENT_EXPORT_LIMIT`, next export 200, no idle-in-transaction sessions). Record rows/bytes sent in the failure audit.

## Verified OK (evidence)
- 130 KB body → 413; malformed JSON → 400; deep nesting/duplicate keys safe; passwords ≤72 **bytes** (`é`×40 → 400); body schemas `.strict()` (mass assignment `createdBy,isAdmin` → 400; only identity login/reset schemas strip); every `z.array` has `.max`.
- `pageSize` 101/0, `page` 0, bad `order` → 400 on all list routes; `page=9007199254740991` safe; sorts whitelisted.
- Idempotency: replay returns stored response (`Idempotent-Replayed: true`); different body → 409; 3 parallel same key → 1×201 + 2×409.
- Export: formula injection escaped, row cap + truncation headers, slot release on abort, step-up and rate limit.
- Email: production → `none` (never log/memory); smtp needs `EMAIL_ALLOW_REAL_SEND`; `requireTLS`; tokens redacted in log transport; links from `PUBLIC_APP_URL` only, https required in production; accepted vs captured states, no "delivered" claim; delivery is at-least-once (crash after `send` and before `finish()` re-sends after the 120 s lease).
- Worker: SKIP LOCKED, leases, backoff, dead + ops alert, restart-safe slot scheduler, SIGTERM finishes the iteration (no timeout), heartbeat 60 s / 180 s stale; one worker deployed.
- Ops alerts: 15-min dedupe, never throw; they need working SMTP like everything else.

## Policy traceability
IT = Implemented+tested, IU = Implemented untested, D = Defect, M = Missing, C = Conflicting, MC = Missing company config.

| Rule | Code | Test | Status |
|---|---|---|---|
| D1 configured gate | `attendance/service.ts checkIn` | attendance.api "D1 configured gate" | IT (MC holidays/office) |
| D1/S-21 per-employee start and days | `overridesFor`, `withOverride` | attendance.api "per-employee start 08:00" | IT |
| Grace to the second | `time.ts` | time.test, attendance.api | IT |
| Shift end = start + 9 h | `shiftEndAt` | attendance.api | IT |
| Holidays / days off | `nonWorkingReason`, days-off | attendance.api | IT |
| D2/S-22 office check, DDNS cache 5 min / stale 60 min | `officeDns.ts` | officeDns.test | IT (DNS in tx, C-09) |
| D3 remote exceptions + self-guards | `grantRemote/requestRemote/decideRemote` | attendance.api D3/D4 | IT |
| D4 corrections, no self-approval | `requestCorrection/approveCorrection` | attendance.api | IT |
| D5/S-24 provisional checkout; earlier-day needs correction | `checkOut` | attendance.api D5 | IT |
| D6 summary ≥10 non-whitespace | `assertWorkSummary` | time.test, attendance.api | IT; D (C-12) |
| S-25 breaks 60 min / 3 | `startBreak/endBreak` | breaks.api | IT; minutes advisory (C-19) |
| D7 targets (server-computed, no retro, Mon–Sun, working days) | `work/progress.ts`, `work/service.ts` | targets.api | IT; D (C-02, C-13, C-17) |
| D8 round-robin, cap 40, never move busy businesses | `assignment/service.ts` | calling.api | IT; D under concurrency (C-03) |
| DEC-004 300 s / 60 s / 15 min / 60 min + keep-working (≤2 extensions) | `reservation/service.ts` | calling.api | IT |
| D9 15-day visibility | access engine | be2.api | IT (Agent E) |
| D10 hidden-duplicate fields, Owner review request | `businesses/service.ts` | be2.api | IT |
| D11 E.164, branch rules | `duplicates/service.ts` | be2.api, duplicates.test | IT; MC country code |
| D12 categories | `businesses/service.ts` | be2.api | IT |
| D13 manual social metrics | business schemas | be2.api | IT; D (C-01 lastPost) |
| D14 reopen rejected | calls reopen (`reason` ≥3) | calling.api | IT |
| D15 developer access / call notes | `deals/callNotes.ts` | delivery.api | IT |
| D16 stages, forward-only, Owner-only verification, evidence, corrections | `deals/service.ts` | delivery.api | IT; D (C-07) |
| D17 ≤1 project/deal, idempotent, cancel reason, reopen | `projects/service.ts` | delivery.api | IT; C: status vocabulary differs from DEC-019 (mapped in code comment) |
| D18 timings and recipients | notifications `service.ts`, J-04 | d18.api, inbox.e2e.api | IT |
| D18 delivery states, bounded retries, no token logs | `transport.ts`, `dispatchDueDeliveries` | email.test, notifications.api, setPasswordLinks.api | IT; D (C-08) |
| D19 backups | not backend | — | Not reviewed (Agent G) |
| D20 archive/restore with validation | `setBusinessArchived` | be2.api | IT; dependants (C-20) |
| Exports bounded, audited, step-up | `reports/` | reports.api | IT; D (C-04, C-05, C-21) |
| Fail-closed config | `config/index.ts` | config.test | IT; D (C-14) |

Not tested (test DB container lost its 512 MB tmpfs data; not re-run): lock-stall demo (C-09), poison-claim and email-exception loop repro (C-08), idempotency stuck claim (C-16a), duplicate-target API repro (C-17).
