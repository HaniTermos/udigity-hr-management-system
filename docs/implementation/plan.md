# Udigity Management System — Build Plan (authoritative)

| Field | Value |
|---|---|
| Owner | Tech Lead / Architect (TL) |
| Date | 2026-10-23 |
| Status | **CONTRACT** for all implementation agents. Changes only through a TL post on `coordination.md` |
| Inputs | `architecture-a.md` (modules, jobs, outbox, audit, §5A metrics), `architecture-b.md` (ERD, access flow, SEQ-01..15), `phase_2_workflows_and_state_machines.md` + `phase2/`, `screen-inventory.md`, `sitemap.md`, `phase6/handoff-ready.md`, `phase6/interaction-spec.md`, `policy-defaults.md`, `status-2026-10-23.md` |
| Scope rule | No redesign, no new requirements. Unapproved policies are flags/settings labelled **"Demonstration alternative — not approved"**. The only approved policy is U-01 "Accepted keeps the contact reservation" |

Stack: Next.js 16 / React 19 / TS / Tailwind 4 (`frontend/`), Express 4 / TS / PostgreSQL raw `pg` (`backend/`), npm workspaces. One VPS, Docker Compose (ADR-011). Tests use the Docker test DB only (`docker-compose.test.yml`, `127.0.0.1:55432`); the local PostgreSQL 17 service is never touched.

---

## 1. Module map

Architecture ids from arch-a §3.1. Dependency order (arch-a §3.2.1) is the order in `backend/src/modules/index.ts`.

| Area | Backend folder (`src/modules/…`) | Arch module | Owns (tables) | Key public ops (service.ts) | Status |
|---|---|---|---|---|---|
| Platform | `platform` | MOD-platform | outbox_events, background_jobs, idempotency_records, worker_heartbeats | OutboxWriter, JobQueue, IdempotencyStore, scheduler, J-03 relay | stub |
| Audit + company settings | `admin` | MOD-admin | audit_events (exists), company_settings | `recordAuditEvent` (exists), `getSetting(key)` | audit exists |
| Employees | `employees` | MOD-employees | employees (exists) | `getEmployeeStatus` | partial (Inc 1) |
| Identity | `identity` | MOD-identity | credentials, two_factor_factors, sessions, security_tokens (exist), recovery codes | sessions, 2FA, reset; consumer E-02 | done (Inc 1) |
| Access / visibility | `access` | MOD-access | access_facts VIEW only | AccessEngine (`check`, `checkMany`, `scopeFilter`) | contract in `shared/access.ts` |
| Duplicates | `duplicates` | MOD-duplicates | none (stateless) | `normalizePhone`, `normalizeName`, `classify` | stub |
| Reservations | `reservation` | MOD-reservation | contact_reservations | acquire/renew/release/override, `validateLease`, `activeFor` | stub |
| Deals | `deals` | MOD-deals | deals, deal_developer_assignments, closure_reviews, deal_changes (ORCH-2) | `createAcceptedOpportunity` (E5) | stub |
| Calls / follow-ups / DNC | `calls` | MOD-calls | business_calling_states, call_attempts, follow_ups, follow_up_changes, outcome_reopenings | `initCallingState`, `transferFollowUps`, `openItemsFor` | stub |
| Businesses (directory, categories, search, history, match keys) | `businesses` | MOD-business | businesses, business_phones, social_accounts, categories, business_edit_history | `updateBusiness` (the only edit command) | stub |
| Corrections | `corrections` | MOD-corrections | data_correction_requests | `openRequestBusinessIds` | stub |
| Calling assignments | `assignment` | MOD-assignment | calling_assignments | `currentAssignee`; consumer E-16 | stub |
| Targets / work lists | `work` | MOD-work | targets, work_items | — | stub |
| Attendance | `attendance` | MOD-attendance | attendance_sessions, attendance_corrections, attendance_settings_versions, remote_exceptions, company_holidays | `getCompanyTimezone` | stub |
| Meetings | `meetings` | MOD-meetings | meetings, meeting_attendees, meeting_changes | — | stub |
| Projects + tasks | `projects` | MOD-projects | projects, project_developer_assignments, project_changes, tasks | consumer E-14, job J-07 | stub |
| Notifications + email outbox | `notifications` | MOD-notifications | reminders, notification_deliveries | consumers E-01..E-17, J-01/J-02, EmailTransport | stub (`emailStub.ts` from Inc 1) |
| Reports / exports | `reports` | MOD-reports | export_records (metadata only) | dashboard metrics §5A, synchronous exports | stub |

Module file layout (every folder): `routes.ts` (Express routers), `service.ts` (rules + public ops for other modules), `repo.ts` (raw SQL on own tables only), `schemas.ts` (Zod `.strict()` request schemas, DTO types, `defineActions` VT-3 declarations), `module.ts` (ModuleDefinition: mounts + `init()`). Tests next to the code: `*.test.ts` (no DB) and `*.api.test.ts` (DB, skipped without `TEST_DATABASE_URL`).

Boundary rules (ADR-006): a module writes only its own tables; cross-module calls go through the other module's `service.ts` exports only (never its `repo.ts`); the only cross-module read is BE2's access-facts view. No cycles: follow arch-a §3.2.1 (e.g. deals never calls projects; it emits `deal.closed`).

## 2. Registry and shared files (created once by TL)

| File | Purpose |
|---|---|
| `backend/src/modules/index.ts` | Lists every `module.ts` once; `registerModules(app)` runs `init()` then mounts routers; duplicate mount path = startup error |
| `backend/src/shared/module.ts` | `ModuleDefinition` type |
| `backend/src/shared/errors.ts` | Error codes, `HttpError` + helpers (§4.3) |
| `backend/src/shared/pagination.ts`, `sql.ts` | Paging, whitelisted sorting, `SqlParams` placeholder builder (§4.4) |
| `backend/src/shared/tx.ts` | `runCommand`, `runSystemCommand`, `audit(ctx, …)` (§4.6) |
| `backend/src/shared/access.ts` | Access engine contract + `requireAction` + `defineActions` (§5) |
| `backend/src/shared/routeGuard.ts` | Route guard check (SEC R2): every `/api` route has `requireAction`, allowlist, startup + CI enforcement (§4.9) |
| `backend/src/shared/flags.ts` | Policy-flag registry (§6) |
| `backend/src/shared/outbox.ts` | Outbox events, writer/consumer + email interfaces (§7) |
| `backend/src/shared/platform.ts` | Job + idempotency interfaces (§8) |
| `backend/src/app.ts` | Wires the registry, `/api` `Cache-Control: no-store`, JSON 404 for unknown `/api` paths |
| `frontend/src/lib/api/{http,client,types,index}.ts` | Transport (Inc 1, moved from `lib/api.ts`), typed client, shared types (§9) |
| `frontend/src/lib/api/<domain>.ts` | One stub per backend domain: path builders; owners add typed functions + DTOs |

## 3. Ownership

Edit only what you own. Anything else: post a REQUEST on `coordination.md`. TL-owned files change only via TL.

### 3.1 Backend

| Agent | Modules (`backend/src/modules/`) | Also owns | Migration range |
|---|---|---|---|
| **TL** | `index.ts` | `src/shared/**`, `src/app.ts`, `src/index.ts`, `src/config/index.ts`, `src/db/pool.ts`, `src/db/migrate.ts`, `src/middleware/errorHandler.ts`, `src/tests/shared.test.ts`, `src/tests/helpers/**`, `src/tests/globalSetup.ts`, `package.json`, `tsconfig*.json`, `vitest.config.ts` | 003–009, 950–999 |
| **BE1** Identity & People | `identity`, `employees`, `admin` (audit read + company settings), `attendance`, `work` | `src/middleware/auth.ts`, `src/middleware/requestGuards.ts`, `src/db/seed.ts` (other agents send seed rows by REQUEST or a `modules/<m>/seed.ts` that BE1 calls) | 010–099 |
| **BE5** Platform, Notifications, Reports | `platform`, `notifications`, `reports` | `src/worker.ts` (new worker entry, `npm run worker` script via TL REQUEST); adds `nodemailer` dependency via TL REQUEST | 100–199 |
| **BE2** Businesses & Access | `access`, `businesses`, `duplicates`, `corrections` | — | 200–299 (tables); **900–949** (access-facts view revisions) |
| **BE3** Calling | `assignment`, `reservation`, `calls` | — | 300–399 |
| **BE4** Delivery | `deals`, `meetings`, `projects` | — | 400–499 |
| DevOps | — | `devops/**`, `docker-compose*.yml` | — |

Migration rules:
- File name `NNN_<module>_<what>.sql`, 3 digits, inside your range. The runner applies unapplied files in lexicographic order inside one transaction.
- Ranges follow FK dependency order (employees 0xx → platform 1xx → businesses 2xx → calling 3xx → delivery 4xx), so a fresh DB builds in order.
- **Forward-only and non-destructive**: no `DROP TABLE/COLUMN`, no `DELETE`/`TRUNCATE` of data, no type narrowing. Use `IF NOT EXISTS`, add nullable columns or columns with defaults, backfill with `UPDATE` only when lossless. Dropping/replacing a constraint or index you own is allowed when it is not a data loss.
- FKs to employees/businesses/deals/projects are `ON DELETE RESTRICT` (arch-b §4). Every mutable aggregate has `version INTEGER NOT NULL DEFAULT 1`, `created_at`, `updated_at` (TIMESTAMPTZ, UTC).
- The access-facts view lives in 900–949 so it is created after every table it reads. Each revision is a new file using `CREATE OR REPLACE VIEW` (a `DROP VIEW` + create is allowed: a view holds no data). Any agent changing a column the view reads posts a REQUEST to BE2 in the same increment.
- Never edit an applied migration. Every new migration runs in the Docker test DB suite before DONE.

### 3.2 Frontend

| Agent | Routes (`frontend/src/app/`) | Also owns | API files (`src/lib/api/`) |
|---|---|---|---|
| **TL** | — | `lib/api/{http,client,types,index}.ts`, `package.json`, `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs` | — |
| **FE1** Design system + shell + shared | `layout.tsx`, `globals.css`, `login/`, `reset-password/`, `my-day/**` (SHR-001..003), `my-attendance/` (new, SHR-004/005), `profile/` (SHR-006), `notifications/` (new, SHR-007) | `components/ui/**`, `components/layout/**`, `components/states/**` (new: SHR-011..015 + loading/empty/error), `lib/{auth.tsx,authRoutes.ts,theme.tsx,utils.ts,devFlags.ts}`, `lib/hooks/**` (new), `proxy.ts` | `identity.ts`, `attendance.ts`, `notifications.ts` |
| **FE2** Owner | `page.tsx` (OWN-001), `attendance/` (OWN-004/005), `employees/` (OWN-002/003), `targets/` (OWN-006), `calling-assignments/` (new, OWN-007/008), `reports/` (OWN-009), `audit/` (OWN-010), `settings/` (OWN-011), `delivery-monitor/` (new, OWN-012) | `components/owner/**` | `employees.ts`, `admin.ts`, `work.ts`, `reports.ts`, `deliveryMonitor.ts` |
| **FE3** Data Entry | `businesses/**` (DE-001..004, SHR-008), `categories/` (DE-007), `corrections/` (DE-005/006), `search/` (new, SHR-010) | `components/businesses/**` (incl. SHR-009 drawer, used by FE4/FE5) | `businesses.ts`, `corrections.ts` |
| **FE4** Call Center | `queue/**` (CC-001..003, CC-005 states; add `queue/[businessId]`), `calendar/` (CC-004/006), `opportunities/` (CC-007), `do-not-call/` (new, CC-008) | `components/calling/**` | `calling.ts` |
| **FE5** Developer | `deals/**` (DEV-001/002/008; add `deals/[id]`), `meetings/` (DEV-003/004), `projects/**` (DEV-005..007; add `projects/[id]`) | `components/delivery/**` | `deals.ts`, `meetings.ts`, `projects.ts` |

Shared UI primitives are FE1's; others compose them and REQUEST new variants. UI matches the approved Figma (`handoff-ready.md`); dark mode is **navy** (user directive 2026-10-23).

---

## 4. API conventions

### 4.1 REST paths (endpoint catalogue)

Rules: plural kebab-case nouns under `/api`; `GET` list/detail, `POST` create, `PATCH` partial update with `version`; **state transitions are commands** `POST /<resource>/:id/<verb>` (never a raw `status` PATCH). Ids are UUIDs. JSON camelCase in bodies; snake_case only in SQL. No personal data in query strings.

| Mount (module, owner) | Endpoints |
|---|---|
| `/api/auth` (identity, BE1) | existing Inc 1 routes; + `POST /2fa/recovery-codes`, `POST /2fa/recover` (OQ-12), `POST /password/change` (SHR-006); `GET /me` adds `capabilities: Action[]` (from `capabilitiesFor` = `listActions()` filtered by `can`) in Inc 2. Added (BE1-R1.4, SEC-3/AU-8): `POST /2fa/enroll/start` takes `{enrollmentToken, currentPassword}` (fresh re-auth), `POST /2fa/enroll/confirm` returns the recovery codes once, `POST /2fa/enrollment-tokens` (Owner + 2FA + password/TOTP re-auth issues a one-time token for another Owner), `GET /2fa/status`; `POST /password-reset/complete` also accepts `credential_setup` tokens (E-01). Operator CLI `npm run owner:bootstrap` (`--reset-2fa --reason`, `--encrypt-existing`) |
| `/api/employees` (BE1) | `GET /`, `GET /me`, `PATCH /me` (photo, phone; OQ-13), `POST /` (create → E-01), `GET /:id`, `PATCH /:id` (profile/role → E-02 on role change), `PATCH /:id/status` (exists), `GET /:id/open-items` (composed at the edge from each module's `openItemsFor`) |
| `/api/audit-events` (admin, BE1) | `GET /` (filters: event, actor, entity, date range; Owner + 2FA; read-only) |
| `/api/settings` (admin, BE1) | `GET /`, `PATCH /` (version; non-attendance company values + SET-kind policy values), `GET /flags` (registry rows with label + configured state) |
| `/api/attendance` (BE1) | `GET /me/today`, `POST /check-in`, `POST /check-out`, `GET /me/sessions`, `POST /corrections` (request, DEC-011), `GET /corrections`, `POST /corrections/:id/approve`, `POST /corrections/:id/reject`, `POST /sessions/:id/adjust` (Owner), `POST /sessions` (Owner retroactive, N-2), `GET /overview` (OWN-004), `GET /settings`, `PUT /settings` (new AttendanceSettingsVersion), `POST /remote-exceptions` |
| `/api/targets`, `/api/work-items` (work, BE1) | `GET/POST /api/targets`, `PATCH /api/targets/:id`; `GET /api/work-items` (mine), `POST /api/work-items` |
| `/api/businesses` (BE2) | `GET /` (directory: filters, `scopeFilter`), `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/archive`, `POST /:id/restore` (C-01), `GET /:id/history`, `POST /duplicate-check` (rate-limited, DEC-003 shaping) |
| `/api/categories` (BE2) | `GET /`, `POST /`, `PATCH /:id`, `POST /:id/deactivate` |
| `/api/search` (BE2) | `GET /?q=` (scoped business search, SHR-010) |
| `/api/correction-requests` (BE2) | `GET /`, `POST /`, `GET /:id`, `POST /:id/{start-review,resolve,reject,close-no-change,withdraw}` |
| `/api/calling-assignments` (assignment, BE3) | `GET /`, `POST /assign`, `POST /reassign-impact` (OWN-008 preview), `POST /reassign`, `POST /unassign`, `POST /autofill` (DEC-021) |
| `/api/reservations` (BE3) | `POST /` (acquire `{ businessId }` → `{ id, leaseToken, expiresAt }`), `POST /:id/renew` (heartbeat), `POST /:id/release`, `POST /:id/override` (Owner, reason) |
| `/api/calling` (calls, BE3) | `GET /queue` (derived buckets), `GET /businesses/:id/workspace` (CC-002), `POST /attempts` (attempt + outcome + follow-up/D2 + E5 deal in one tx; requires `leaseToken` and `Idempotency-Key`), `POST /attempts/inbound-rejection` (B3-Q10 inbound do-not-call outside a call: no reservation, `Idempotency-Key`, action `call.log_attempt`; rule per policy-defaults, "Demonstration alternative — not approved"; ORCH-4 b), `GET /do-not-call` (`call_attempt.list_do_not_call`), `POST /businesses/:id/reopen` (DEC-016), `POST /businesses/:id/requeue` (B3-Q12), `GET /opportunities` (CC-007, action `call_attempt.list_opportunities` per ORCH-4 c; reads deals via BE4 read op) |
| `/api/follow-ups` (calls, BE3) | `GET /` (list or `from`/`to` calendar range), `POST /`, `PATCH /:id` (reschedule/reassign), `POST /:id/complete`, `POST /:id/cancel` |
| `/api/deals` (BE4) | `GET /`, `GET /:id`, `GET /:id/history` (`deal_changes`), `POST /:id/{developer,signature,payment,remove-fact,closure-request,closure-verify,closure-reject,finalize,not-proceeding,reopen}`. `remove-fact` (ORCH-2 1: "Remove recorded fact…" in the approved Developer UI) writes a `deal_changes` row with the old value. `reopen` of Not proceeding (OQ-15 unresolved, ORCH-2 2) follows flag `deals.reopenTarget` (default `accepted_opportunity`, demonstration); old values stay in `deal_changes`. `finalize` picks its action by role with `requireActionFor` (Owner `deal.finalize`, Developer `deal.update_stage`) |
| `/api/meetings` (BE4) | `GET /` (range), `POST /`, `PATCH /:id` (reschedule), `POST /:id/{held,missed,cancel}` |
| `/api/projects`, `/api/tasks` (projects, BE4) | `GET /api/projects` (incl. Development workload), `POST /api/projects` (manual provisioning when F2 flag off), `GET/PATCH /api/projects/:id`, `POST /api/projects/:id/developers`, `POST /api/projects/:id/status` (`to`, `version`, `note`, `acknowledgeOpenTasks`; never a raw PATCH), `POST /api/projects/:id/reopen` (Owner, reason, Completed → In progress, OQ-15), `POST /api/projects/:id/provision-retry` (**`:id` is the deal id**: a Closed deal without a project; ORCH-2 4); `GET /api/tasks?projectId=`, `POST /api/tasks`, `PATCH /api/tasks/:id` |
| `/api/notifications` (BE5) | `GET /`, `GET /unread-count`, `POST /:id/read`, `POST /read-all` |
| `/api/delivery-monitor` (notifications, BE5) | `GET /`, `POST /reminders/:id/send-again` (AR-13) |
| `/api/dashboard`, `/api/reports` (reports, BE5) | `GET /api/dashboard`; `GET /api/reports`; `GET /api/reports/export?format=csv|xlsx|pdf&…filters` (streamed, Owner + 2FA, ADR-010) |
| `/health/worker` (platform, BE5) | worker heartbeat (J-09), separate from `/readyz` |

### 4.2 Request pipeline and validation

`requestId → helmet → cors(APP_ORIGIN) → cookieParser → json(100kb) → originCheck → [module router: authenticate → requireAction(action) → idempotent(op)? → handler] → errorHandler`.
- Every body/query/param is parsed with Zod in the handler: `Schema.parse(req.body)`; object schemas are `.strict()`; strings are trimmed with max lengths; ids `z.string().uuid()`. A ZodError becomes `400 VALIDATION_ERROR` with `details` = field errors.
- Handlers stay thin: parse → service → respond. Business rules live in `service.ts`; SQL only in `repo.ts`.

### 4.3 Error shape

`{ error: string, code: ErrorCode, details?: unknown, requestId?: string }` (backend `src/shared/errors.ts`, frontend `lib/api/types.ts`). Throw `HttpError`/helpers; never `res.status(500)` by hand; never put SQL, stack, secrets or hidden-record fields in `error`.

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST` |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `SESSION_INVALID` → SCR-SHR-013 |
| 403 | `CSRF_FAILED`, `FORBIDDEN_ROLE` (route/VT-3), `OWNER_2FA_REQUIRED`, `PERMISSION_DENIED` (resource) → SCR-SHR-011; `HIDDEN_BY_POLICY` → SCR-SHR-012 |
| 404 | `NOT_FOUND` |
| 409 | `VERSION_CONFLICT` (`details.currentVersion`) → SCR-SHR-014; `DUPLICATE_BLOCKED`; `CONFLICT_DUPLICATE`; `STATE_CONFLICT`; `RESERVATION_CONFLICT`; `RESERVATION_LOST`; `IDEMPOTENCY_KEY_REUSED`; `POLICY_NOT_CONFIGURED` ("Not configured / policy pending") |
| 422 | `RULE_VIOLATION` |
| 429 | `RATE_LIMITED`, `TOO_MANY_ATTEMPTS` |
| 500/501 | `INTERNAL_ERROR` (with requestId), `NOT_IMPLEMENTED` (stubs only) |

### 4.4 Pagination and sorting

`?page=1&pageSize=25&sort=<key>&order=asc|desc` → `{ items, page, pageSize, total }`. `pageSize` max 100. `sort` keys map to SQL through a per-endpoint whitelist (`orderByClause`). `total` is counted **after** `access.scopeFilter`. Calendar endpoints use `from`/`to` ISO ranges (max 62 days) instead of paging.

### 4.5 Optimistic concurrency (`version`)

Every mutable aggregate returns `version`. `PATCH`/command bodies include the `version` the client saw. Repo pattern: `UPDATE … SET …, version = version + 1, updated_at = now() WHERE id = $1 AND version = $2 RETURNING *`; zero rows → re-read: missing → 404, else `409 VERSION_CONFLICT { currentVersion }`. Repeating a command that is already in the target state is a no-op 200 (SEQ-03 pattern). The UI shows SCR-SHR-014 and never overwrites.

### 4.6 Transactions and audit-in-transaction

One user action = one transaction (`runCommand(req, ctx => …)`) containing the change, its audit row(s) (`audit(ctx, { eventName, entityType, entityId, before, after, reason })`) and its outbox event(s) (`outbox.emit(ctx.tx, …)`). Audit names are the Phase 2 G2 names; placeholders are marked in code. Accepted placeholders (BE1-R1.5): `two_factor.{enrolled,recovery_codes_generated,enrollment_token_issued,reset_by_operator}`, `credential_setup.completed`, `employee.updated`, `account.activated`. Outbox additions (ORCH-2 3): `deal.not_proceeding`, `deal.closure_rejected` in `OUTBOX_EVENTS`. No external I/O inside; post-commit steps (reservation release after a call save, AR-03) run in a second transaction and may fail safely. Row locks (`SELECT … FOR UPDATE`) and unique/partial indexes guard invariants (one Active reservation, one open attendance session, one open follow-up per business B3-Q04, one open deal per business DEC-017, global unique normalized phone). Never pass passwords, tokens, 2FA secrets or recovery codes to audit.

### 4.7 Idempotency

Header `Idempotency-Key` (UUID per user action, reused on retry). **Required** on `POST /api/calling/attempts`, reservation acquire, `POST /api/businesses`, deal commands and exports-free creates; optional elsewhere. BE5 ships `idempotent(operation)` middleware (Inc 2) over `IdempotencyStore`; same key + different body → 409 `IDEMPOTENCY_KEY_REUSED`.

### 4.8 Session and CSRF (built in Inc 1, unchanged)

HttpOnly cookie session (hashed token), idle 2 h / absolute 12 h, rotation after 2FA, Origin/Referer check on every mutation, `X-CSRF-Token` on every authenticated mutation (frontend `apiFetch` sends it automatically). No Bearer tokens, no token in JSON. Owner admin actions need a completed 2FA session (Confirmed); the rest of the pending-2FA scope is the R-11 flag.

### 4.9 Access-engine call (every endpoint)

```ts
router.get('/:id', authenticate, requireAction('business.view'), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const principal = principalFromRequest(req);
    const decision = await access.check(pool, principal, 'business.view', { type: 'business', id });
    assertAllowed(decision);                       // 404 / 403 PERMISSION_DENIED / 403 HIDDEN_BY_POLICY
    if (decision.ownerViewedHidden) await runCommand(req, (ctx) =>
      audit(ctx, { eventName: 'business_access.owner_viewed_hidden', entityType: 'business', entityId: id }));
    res.json({ business: await service.get(pool, id, decision.level), access: decision.level });
  } catch (e) { next(e); }
});
```
Lists: `WHERE <filters> AND ${access.scopeFilter(principal, 'business.list', 'business', { alias: 'b', params })}` before `COUNT`, `ORDER BY`, `LIMIT`. Writes call `check` inside the command transaction. An endpoint without `requireAction` + `check`/`scopeFilter` fails review. **Enforced (SEC review R2):** `shared/routeGuard.ts` walks every mounted router; `src/tests/routeGuard.test.ts` (CI) fails on any `/api` route without a `requireAction`/`requireActionFor` guard before its handler, and production refuses to start (`registerModules`). Exceptions live only in `ROUTE_GUARD_ALLOWLIST` (sign-in, 2FA steps, logout, `/me`, password reset, NODE_ENV=test `/api/test-support/*`); adding one needs TL approval. Role-dependent actions use `requireActionFor`, never an inline dispatcher. UI capabilities come from `listActions()`/`capabilitiesFor()` in `shared/access.ts` (matrix names, BE1-R1/CR1-01).

---

## 5. Access / visibility engine contract (single definition; implementation BE2)

Source: arch-b §6–§7, WF-ACCESS-001, SM-VISIBILITY-001 (VT-1..VT-7), DEC-001/002/003/005, OI-02/05/10. Code: `backend/src/shared/access.ts`.

**Interface** (`AccessEngine`): `check(db, principal, action, {type,id}) → AccessDecision`; `checkMany(db, principal, action, refs) → Map<id, AccessDecision>`; `scopeFilter(principal, action, type, {alias, params, idColumn}) → SQL predicate`. `AccessDecision` = `{ allowed: true, level: 'full'|'context_limited'|'owner', exceptionRow?, ownerViewedHidden? }` or `{ allowed: false, reason: 'not_found'|'permission_denied'|'hidden_by_policy' }`.

**Evaluation order** (arch-b §6 — the engine implements exactly this, nothing more):
1. Account active / 2. session valid / 2b. Owner pending 2FA → `authenticate` (BE1, done).
3–4. Role + action (VT-3) → `requireAction(action)`; actions declared per module with `defineActions({ '<resource>.<verb>': { roles, admin? } })` in its `schemas.ts`. Undeclared action = deny. Admin actions require completed Owner 2FA.
— Owner skips 5–8 (R-01) → level `owner`; `ownerViewedHidden` set when the record is hidden for others (OI-05 audit on detail opens only).
5. Base scope (VT-2; Data Entry scope flag `access.dataEntryScope` = DE-1).
6. Required relation: assignment (CC), creator, assigned Developer (DEC-005 flag `deals.developerPreClosure`), project assignment.
7. 15-day window: basis `visibility.timerBasis` (`creation` = `businesses.created_at`; `inactivity` = max(created_at, `business_calling_states.last_touchpoint_at`)); hidden from 00:00 company time on day created + 15 (OI-04).
8. DEC-002 exception rows R1–R6 (flag `visibility.dec002Rows`, grace values `visibility.callbackGraceHours`, `visibility.completedProjectDays`) → level `context_limited` + `exceptionRow`; the caller confines the record to that surface (OI-27).
9. Resource state (Rejected = do-not-call, archived, terminal) → enforced by the owning module after `check`.
10. Outcome.

**Resource resolution:** R-06 types (`business`, `call_attempt`, `follow_up`, `reservation`, `deal`, `meeting`, `project`, `task`, `notification`, `export_row`, `duplicate_preview`) resolve to their business through the access-facts view and apply the RT row; owned items on a hidden business are redacted, others omitted and not counted (OI-07). Non-business types (`employee`, `attendance_*`, `data_correction_request`, `category`, `calling_assignment`, `target`, `work_item`, `audit_event`, `setting`, `report`) use role + own-record rules.

**Access-facts view** (`access_facts`, BE2, migrations 900–949, read-only): one row per business with creator, created_at, last_touchpoint_at, current assignee, open follow-up responsible + time, deal id/stage/assigned developer(s), project status/assigned developers/completed_at, open correction request flag, archive state. `check` and `scopeFilter` are generated from one rule table so they cannot drift.

**Leakage controls:** denials carry no field values; duplicate checks ignore visibility but the response is shaped per DEC-003 (existence only); notifications re-check at send and read time; exports use `scopeFilter` even for the Owner; `Cache-Control: no-store`; no business data in logs.

**Contract tests (BE2, Inc 2):** the VT-7 worked evaluations run against `check` **and** `scopeFilter` on the Docker test DB, for each role × timer side × exception row; plus "hidden rows never counted" and "Owner hidden read audited". Every module adds one leakage test per list endpoint.

**Until BE2 registers the engine** (`registerAccessEngine` in `modules/access/module.ts`), the shared holder denies every check and `scopeFilter` returns `FALSE` (fail closed).

---

## 6. Policy-flag registry

Code: `backend/src/shared/flags.ts` (`flags[key]`, `loadPolicyFlags`, `describeFlags`). Every row's label: **"Demonstration alternative — not approved (docs/policy-defaults.md)"**. Invalid env values fail at startup. Kinds: FLAG = both branches implemented; CFG = server config; SET = Owner setting stored by BE1 (`company_settings` / attendance settings version), env value = initial default, read through `admin` `getSetting(key)`. NEEDS VALUE rows start empty and the feature answers `409 POLICY_NOT_CONFIGURED` / shows "Not configured / policy pending" until saved on SCR-OWN-011 (attendance checks stay inactive until timezone, schedule and office mode are saved). Env names (DEV-R4, BE1-R3): the `POLICY_*` names in §6.1 win; DevOps names `COMPANY_TIMEZONE`, `OFFICE_IP_ALLOWLIST`, `ATTENDANCE_OFFICE_MODE` are validated aliases read only when the `POLICY_*` value is unset (`config.policyAliases`). Email: `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`, `EMAIL_TRANSPORT`, `EMAIL_ALLOW_REAL_SEND`; 2FA at rest: `TOTP_ENC_KEY` (required in production), `TOTP_ENC_KEY_ID`, `TOTP_ENC_PREVIOUS_KEYS` (all in `config/index.ts`). DB roles (DEV-R5): migrations run as the owner role via `MIGRATION_DATABASE_URL`; the app logs in as a member of `udigity_app` (migration 012: INSERT/SELECT only on `audit_events`) via `DATABASE_URL`. UI: settings show the label next to each value; the existing PolicyTag/NoticePolicy chips carry it; production UI shows no decision IDs.

### 6.1 Registry (key · policy · kind · env · default · owner)

| Key | Policy | Kind | Env | Default | Owner |
|---|---|---|---|---|---|
| `auth.ownerPending2faScope` | R-11 | FLAG | `OWNER_PENDING_2FA_SCOPE` | `R11-a` | BE1 |
| `auth.sessionIdleMinutes` | IMPL-SESSION | CFG | `SESSION_IDLE_MINUTES` | `120` | BE1 |
| `auth.sessionAbsoluteHours` | IMPL-SESSION | CFG | `SESSION_ABSOLUTE_HOURS` | `12` | BE1 |
| `auth.sessionPending2faMinutes` | IMPL-SESSION | CFG | `SESSION_PENDING_2FA_MINUTES` | `10` | BE1 |
| `auth.lockoutMaxFailures` | IMPL-LOCKOUT | CFG | `LOCKOUT_MAX_FAILURES` | `5` | BE1 |
| `auth.lockoutWindowMinutes` | IMPL-LOCKOUT | CFG | `LOCKOUT_WINDOW_MINUTES` | `15` | BE1 |
| `auth.lockoutDurationMinutes` | IMPL-LOCKOUT | CFG | `LOCKOUT_DURATION_MINUTES` | `15` | BE1 |
| `auth.rateLimitMax` | IMPL-LOCKOUT | CFG | `AUTH_RATE_LIMIT_MAX` | `20` | BE1 |
| `auth.rateLimitWindowMinutes` | IMPL-LOCKOUT | CFG | `AUTH_RATE_LIMIT_WINDOW_MINUTES` | `15` | BE1 |
| `auth.passwordMinLength` | IMPL-PASSWORD | CFG | `PASSWORD_MIN_LENGTH` | `12` | BE1 |
| `auth.passwordResetTtlMinutes` | IMPL-PASSWORD | CFG | `PASSWORD_RESET_TTL_MINUTES` | `60` | BE1 |
| `auth.recoveryCodeCount` | OQ-12/IMPL-2FA | CFG | `POLICY_AUTH_RECOVERY_CODE_COUNT` | `10` | BE1 |
| `company.timezone` | DEC-007/VAL-TZ | SET | `POLICY_COMPANY_TIMEZONE` | **NEEDS VALUE** (empty = Not configured) | BE1 |
| `business.defaultCountryCode` | B2/VAL-CC | SET | `POLICY_BUSINESS_DEFAULT_COUNTRY_CODE` | **NEEDS VALUE** (empty = Not configured) | BE2 |
| `deals.defaultCurrency` | DEC-018/VAL-CURRENCY | SET | `POLICY_DEALS_DEFAULT_CURRENCY` | **NEEDS VALUE** (empty = Not configured) | BE4 |
| `attendance.workingDays` | DEC-007/DEC-022 | SET | `POLICY_ATTENDANCE_WORKING_DAYS` | `MON,TUE,WED,THU,FRI` | BE1 |
| `attendance.shiftStart` | DEC-007 | SET | `POLICY_ATTENDANCE_SHIFT_START` | `09:00` | BE1 |
| `attendance.shiftEnd` | DEC-007 | SET | `POLICY_ATTENDANCE_SHIFT_END` | `18:00` | BE1 |
| `attendance.graceMinutes` | DEC-008 | SET | `POLICY_ATTENDANCE_GRACE_MINUTES` | `10` | BE1 |
| `attendance.verificationMode` | DEC-009 | SET | `POLICY_ATTENDANCE_VERIFICATION_MODE` | `ip` | BE1 |
| `attendance.officeIps` | DEC-009/VAL-IP | SET | `POLICY_ATTENDANCE_OFFICE_IPS` | **NEEDS VALUE** (empty = Not configured) | BE1 |
| `attendance.holidays` | DEC-022/VAL-HOLIDAYS | SET | `POLICY_ATTENDANCE_HOLIDAYS` | **NEEDS VALUE** (empty = Not configured) | BE1 |
| `attendance.remoteSelfRequest` | DEC-010 | FLAG | `POLICY_ATTENDANCE_REMOTE_SELF_REQUEST` | `false` | BE1 |
| `attendance.employeeRequests` | DEC-011 | FLAG | `POLICY_ATTENDANCE_EMPLOYEE_REQUESTS` | `true` | BE1 |
| `attendance.summaryRequired` | DEC-012 | SET | `POLICY_ATTENDANCE_SUMMARY_REQUIRED` | `true` | BE1 |
| `attendance.summaryMinLength` | DEC-012 | SET | `POLICY_ATTENDANCE_SUMMARY_MIN_LENGTH` | `10` | BE1 |
| `attendance.failedCheckout` | DEC-026 | FLAG | `POLICY_ATTENDANCE_FAILED_CHECKOUT` | `provisional` | BE1 |
| `attendance.missingCheckoutFlagHours` | D5 | SET | `POLICY_ATTENDANCE_MISSING_CHECKOUT_FLAG_HOURS` | `6` | BE1 |
| `work.autofillPerAgentPerDay` | DEC-021 | SET | `POLICY_WORK_AUTOFILL_PER_AGENT_PER_DAY` | `40` | BE1 |
| `work.autofillScheduled` | DEC-021 | SET | `POLICY_WORK_AUTOFILL_SCHEDULED` | `false` | BE1 |
| `visibility.timerBasis` | DEC-001 | FLAG | `POLICY_VISIBILITY_TIMER_BASIS` | `creation` | BE2 |
| `visibility.dec002Rows` | DEC-002 | CFG | `POLICY_VISIBILITY_DEC002_ROWS` | `R1,R2,R3,R4,R5,R6` | BE2 |
| `visibility.callbackGraceHours` | DEC-002 row 5 | CFG | `POLICY_VISIBILITY_CALLBACK_GRACE_HOURS` | `48` | BE2 |
| `visibility.completedProjectDays` | DEC-002 row 4/OI-18 | CFG | `POLICY_VISIBILITY_COMPLETED_PROJECT_DAYS` | `15` | BE2 |
| `access.dataEntryScope` | OI-02 | FLAG | `POLICY_ACCESS_DATA_ENTRY_SCOPE` | `DE-1` | BE2 |
| `access.auditOwnerHiddenReads` | OI-05 | SET | `POLICY_ACCESS_AUDIT_OWNER_HIDDEN_READS` | `true` | BE2 |
| `duplicates.nameSimilarityThreshold` | DEC-013 | SET | `POLICY_DUPLICATES_NAME_SIMILARITY_THRESHOLD` | `0.6` | BE2 |
| `categories.dataEntryManage` | DEC-015 | FLAG | `POLICY_CATEGORIES_DATA_ENTRY_MANAGE` | `false` | BE2 |
| `social.platforms` | DEC-024 | SET | `POLICY_SOCIAL_PLATFORMS` | `facebook,instagram,tiktok,linkedin,x,youtube,other` | BE2 |
| `reservation.leaseSeconds` | DEC-004 | SET | `POLICY_RESERVATION_LEASE_SECONDS` | `300` | BE3 |
| `reservation.heartbeatSeconds` | DEC-004 | SET | `POLICY_RESERVATION_HEARTBEAT_SECONDS` | `60` | BE3 |
| `reservation.idleMinutes` | DEC-004 | SET | `POLICY_RESERVATION_IDLE_MINUTES` | `15` | BE3 |
| `reservation.idleWarningMinutes` | DEC-004 | SET | `POLICY_RESERVATION_IDLE_WARNING_MINUTES` | `13` | BE3 |
| `reservation.maxTotalMinutes` | DEC-004 | SET | `POLICY_RESERVATION_MAX_TOTAL_MINUTES` | `60` | BE3 |
| `reservation.ownerOverride` | DEC-004/B3-Q14 | SET | `POLICY_RESERVATION_OWNER_OVERRIDE` | `true` | BE3 |
| `calls.saveAfterReservationLoss` | B3-Q05 | FLAG | `POLICY_CALLS_SAVE_AFTER_RESERVATION_LOSS` | `keepAttemptOnly` | BE3 |
| `calls.acceptedNoteMinLength` | B3-Q16/OQ-01 | SET | `POLICY_CALLS_ACCEPTED_NOTE_MIN_LENGTH` | `10` | BE3 |
| `followUps.overdueMinutes` | Overdue threshold | SET | `POLICY_FOLLOWUPS_OVERDUE_MINUTES` | `60` | BE3 |
| `deals.developerPreClosure` | DEC-005 | FLAG | `POLICY_DEALS_DEVELOPER_PRE_CLOSURE` | `assigned` | BE4 |
| `deals.closureMode` | DEC-006 | FLAG | `POLICY_DEALS_CLOSURE_MODE` | `ownerVerify` | BE4 |
| `deals.reopenTarget` | OQ-15 (ORCH-2 2) | FLAG | `POLICY_DEALS_REOPEN_TARGET` | `accepted_opportunity` (or `previous_stage`) | BE4 |
| `deals.currencies` | DEC-018 | SET | `POLICY_DEALS_CURRENCIES` | **NEEDS VALUE** (empty = Not configured) | BE4 |
| `projects.autoProvision` | F2 | FLAG | `POLICY_PROJECTS_AUTO_PROVISION` | `true` | BE4 |
| `notifications.inApp` | NOTIF/AR-14 | SET | `POLICY_NOTIFICATIONS_IN_APP` | `true` | BE5 |
| `notifications.followUpLeadMinutes` | NOTIF | SET | `POLICY_NOTIFICATIONS_FOLLOWUP_LEAD_MINUTES` | `15` | BE5 |
| `notifications.followUpOverdueAlertMinutes` | NOTIF | SET | `POLICY_NOTIFICATIONS_FOLLOWUP_OVERDUE_ALERT_MINUTES` | `60` | BE5 |
| `notifications.meetingLeadMinutes` | NOTIF | SET | `POLICY_NOTIFICATIONS_MEETING_LEAD_MINUTES` | `1440,60` | BE5 |
| `notifications.missingCheckinAfterGraceMinutes` | NOTIF/F-05 | SET | `POLICY_NOTIFICATIONS_MISSING_CHECKIN_AFTER_GRACE_MINUTES` | `30` | BE5 |
| `notifications.missingCheckoutAfterShiftMinutes` | NOTIF/F-05 | SET | `POLICY_NOTIFICATIONS_MISSING_CHECKOUT_AFTER_SHIFT_MINUTES` | `60` | BE5 |
| `notifications.emailRetrySeconds` | NOTIF | SET | `POLICY_NOTIFICATIONS_EMAIL_RETRY_SECONDS` | `60,600,3600` | BE5 |
| `notifications.notifyPreviousAssignee` | OWN-008 | SET | `POLICY_NOTIFICATIONS_NOTIFY_PREVIOUS_ASSIGNEE` | `true` | BE5 |
| `notifications.lateReminder` | B3-Q08 | CFG | `POLICY_NOTIFICATIONS_LATE_REMINDER` | `sendIfEventFuture` | BE5 |
| `audit.exportEnabled` | OQ-18 | FLAG | `POLICY_AUDIT_EXPORT_ENABLED` | `false` | BE1 |
| `retention.sessionsDays` | C3 | CFG | `POLICY_RETENTION_SESSIONS_DAYS` | `90` | BE5 |
| `retention.reservationsDays` | C3 | CFG | `POLICY_RETENTION_RESERVATIONS_DAYS` | `90` | BE5 |
| `retention.notificationsDays` | C3 | CFG | `POLICY_RETENTION_NOTIFICATIONS_DAYS` | `180` | BE5 |
| `retention.jobsDays` | C3 | CFG | `POLICY_RETENTION_JOBS_DAYS` | `30` | BE5 |
| `retention.tokensDays` | C3 | CFG | `POLICY_RETENTION_TOKENS_DAYS` | `30` | BE5 |
| `retention.idempotencyHours` | C3 | CFG | `POLICY_RETENTION_IDEMPOTENCY_HOURS` | `48` | BE5 |
| `backup.retentionDaily` | C1 | CFG | `POLICY_BACKUP_RETENTION_DAILY` | `14` | DevOps |
| `backup.retentionWeekly` | C1 | CFG | `POLICY_BACKUP_RETENTION_WEEKLY` | `8` | DevOps |
| `backup.retentionMonthly` | C1 | CFG | `POLICY_BACKUP_RETENTION_MONTHLY` | `6` | DevOps |

Add a flag: TL REQUEST with the policy-defaults row id. Flags are read only through `flags`/`getSetting`, never `process.env` in modules.

### 6.2 Code-level working defaults (policy-defaults "CODE"; one rule each, owned by the module)

| Policy | Rule to implement (Demonstration alternative — not approved) | Owner |
|---|---|---|
| DEC-003 | Duplicate block on a hidden record reveals existence only (no id, no fields) | BE2 |
| DEC-013 | NM-B + SN-1: normalized name + branch blocks; similarity ≥ threshold warns; phone blocks across branches (OI-14) | BE2 |
| DEC-014 / DEC-023 | Nullable follower count / last-post date = "Unknown", never 0; `metrics_recorded_at`; latest value only | BE2 |
| C-01 / OI-26 | Archive only (+ restore); archived stay in duplicate scope; categories deactivate (CR-1) | BE2 |
| OI-21, B2 | Name + category required, "Other" category always exists; phone optional, no-phone = not callable | BE2 |
| OI-24, OI-19, N-4 | DE edits directly (no requests); SM-DATAFIX-001 as proposed; reviewer deactivated → In review returns to Submitted | BE2 / BE1 |
| DEC-016, B3-Q12 | Owner-only reopen of Rejected with reason → Pending; Owner re-queue after Not proceeding | BE3 |
| D4 | Rejected cancels open follow-ups in the same save; Accepted keeps them | BE3 |
| B3-Q01/02/03/04/07/10/13/14/15/16 | Owner-only assign; Start Contact = assignee + Owner; per-follow-up transfer (preselected); max one open follow-up; attempt time = server now; inbound DNC via attempt; every attempt records one of four outcomes; override reason; Owner unassign; outcome mandatory fields | BE3 |
| **U-01 (APPROVED)** | "Save, keep reservation" available for Accepted, Needs another call and On hold; hidden only for Rejected | BE3 / FE4 |
| DEC-017 | One open deal per business (partial unique index); one project per deal | BE4 |
| OQ-03/05/06/07/08/10/11/15, DEC-019, R-13 | Commercial facts by Owner + assigned Developer; signature/payment any order; project status list + Completed only from Delivered; open tasks warn; no Cancelled; reopen rules; meeting Missed state | BE4 |
| DEC-020 / DEC-025 | Target metric definitions and periods | BE1 / BE5 |
| F-01..F-04, N-2, A1 | Attendance correction semantics; no Owner exemption; no attendance gating of work | BE1 |
| OQ-13/14 | Self-edit photo + phone; Owner reactivation without restoring assignments | BE1 |
| B3-Q11, B-1, RW-03, OQ-16/17 | Metric definitions (arch-a §5A); export disabled on empty result; no period comparison | BE5 |
| AR-13/14 | "Send again" only; in-app inbox with read flag, re-checks access at read time | BE5 |

---

## 7. Notifications and email outbox (BE5)

Code contract: `backend/src/shared/outbox.ts`.

### 7.1 Flow (arch-a §4.2, §4.6)
1. A command writes `outbox.emit(ctx.tx, { name, aggregateType, aggregateId, payload: ids only })` in its transaction (events E-01..E-17, `OUTBOX_EVENTS`).
2. J-03 relay (worker) claims committed rows (`FOR UPDATE SKIP LOCKED`), calls each registered `OutboxConsumer` in its own transaction, records per-consumer completion (idempotent by event id + consumer name), retries with backoff, marks `dead` after max attempts (visible on SCR-OWN-012).
3. Consumers create their own rows: Reminder (planner for follow-ups/meetings: create, cancel+recreate on reschedule/reassign, cancel on complete/cancel), NotificationDelivery (in-app + email), sessions revocation (identity), project provisioning (projects), queue eligibility (assignment).
4. Dispatch (J-01 reminders, J-02 deliveries): claim → commit → re-check source version/open state, recipient account Active and `access.check` (C6) → build content only from fields the recipient may see → send outside any transaction → record Sent / Retry pending / Failed / Suppressed / Skipped (B3-Q08 flag) in a new transaction. Failures raise an Owner "delivery failure" item (D6) with a loop guard. Delivery outcomes never change follow-ups or meetings (D5).

### 7.2 Email transport (nodemailer)
- `EmailTransport` with three implementations: `log` (**default in every environment**; writes one redacted line: template id + recipient domain + idempotency key; reset/setup links appear only when `NODE_ENV=development`), `memory` (tests), `smtp` (nodemailer).
- Env (read by BE5's own config module, never logged): `EMAIL_TRANSPORT=log|smtp` (default `log`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. `smtp` additionally requires `EMAIL_ALLOW_REAL_SEND=true`; without it the worker refuses to start with `smtp`. **No real email is sent in this build without explicit user approval.**
- Retries: `notifications.emailRetrySeconds` (60 s, 10 min, 60 min) then Failed; permanent SMTP 5xx → Failed at once. Message id = provider idempotency key = delivery row id.
- Templates: code-defined, plain text + minimal HTML per `EmailTemplateId` (security.* and business.*), escaped variables, no tracking pixels. Security family (E-01/E-03/E-04): account-status check only, never to deactivated accounts, excluded from `notification.*` counts.
- `modules/notifications/emailStub.ts` (Inc 1) is replaced by the E-03 outbox path in Inc 2; until then identity keeps calling it.
- In-app inbox (AR-14): `notification_deliveries` with `channel='in_app'`, `read_at`; list and unread count re-check access at read time; hidden items are omitted and not counted.

---

## 8. Background jobs (single VPS)

Code contract: `backend/src/shared/platform.ts`. One `worker` container (same image, `node dist/worker.js`) next to `api`, `db`, `proxy`; the backup container is DevOps' (J-10), restore drills off-VPS (J-11).

| Job | Kind | Owner | Schedule | Notes |
|---|---|---|---|---|
| J-03 outbox relay | `platform.outbox_relay` | BE5 | poll every 2 s | consumers idempotent per event |
| J-01 reminder dispatch | `notifications.reminder_dispatch` | BE5 | every 30 s | late-run per `notifications.lateReminder` |
| J-02 delivery dispatch / email retries | `notifications.delivery_dispatch` | BE5 | every 30 s | retry schedule flag |
| J-04 attendance exceptions | `attendance.exception_check` | BE1 | every 5 min, company time | records "Not configured" when timezone/schedule missing; never auto-closes |
| J-05 reservation expiry sweep | `reservation.expiry_sweep` | BE3 | every 60 s | conditional update = single writer of `contact_reservation.expired`; correctness never depends on it |
| 15-day visibility | — (no job) | BE2 | — | visibility is **computed at request time** from the view (C2: no stored flag); nothing to sweep |
| Follow-up reminders | via E-05 planner + J-01 | BE5 | — | lead/overdue values from flags |
| J-06 session cleanup | `identity.session_cleanup` | BE1 | every 15 min | request-time checks remain authoritative |
| J-07 provisioning retry | `projects.provision_retry` | BE4 | backoff | F2 auto only |
| J-09 heartbeat | `platform.heartbeat` | BE5 | every 60 s | `/health/worker` |
| J-12 retention purge | `platform.retention_purge` | BE5 | daily 03:00 company time | technical rows only; never audit or business history |
| J-10 backups | backup container | DevOps | nightly | encrypted dump, retention 14/8/6 (C1 flags), public key only on VPS |

Mechanics: scheduler tick each minute inserts `(kind, slot)` with `ON CONFLICT DO NOTHING`; claim with `FOR UPDATE SKIP LOCKED` + `lease_until`; expired leases are reclaimable; `attempts`/`max_attempts` → `dead`; every handler idempotent by job key; handlers use `runSystemCommand(kind, …)` (audit actor = System). Tests call handlers directly with a fixed clock.

---

## 9. Frontend data layer

- **Client:** `import { api, ApiError, swrFetcher } from '@/lib/api'`. `api.get/post/put/patch/del` go through `apiFetch` (cookie session, CSRF header on mutations) and throw `ApiError` (`isUnauthenticated`, `isPermissionDenied`, `isHiddenByPolicy`, `isNotFound`, `isVersionConflict`, `fieldErrors`). Domain functions and DTO types live in `lib/api/<domain>.ts` (owner per §3.2), built on the `<domain>Paths` constants.
- **Auth context:** `useAuth()` from `lib/auth.tsx` (FE1) is the only source of user, role, `sessionState` and (from Inc 2) `capabilities`. Nav and buttons use capabilities; the server still decides. `proxy.ts` + `AppShell` guard routes.
- **Fetching choice: client-side.** Pages are Client Components using SWR (`useSWR(path, swrFetcher)`) through the same-origin `/api` rewrite. No Server Component data fetching, no Next route handlers and no server actions (ADR-002: Next is presentation only; the session cookie stays HttpOnly and is never forwarded server-side). Layouts/static chrome may stay Server Components.
- **Mutations:** call `api.*` with `version` (and `Idempotency-Key` from `newIdempotencyKey()` where §4.7 requires), then `mutate(key)`. No optimistic UI for saves that can conflict; show the pending state, then the result. `VERSION_CONFLICT` → SCR-SHR-014 component; 401 → SCR-SHR-013; 403 → SHR-011/012; validation → inline field errors.
- **Polling:** reservation heartbeat every `reservation.heartbeatSeconds` while the contact workspace is open; unread count every 60 s; otherwise SWR focus revalidation. Times render in the company timezone from settings.
- **Shared hooks (FE1, `lib/hooks/`):** `useApi`, `usePage(path, query)`, `useVersionedSave`, `useCapability(action)`, `useCompanyTime`.
- **Removing mock data:** today 22 pages hold inline mock arrays. Rule per page: (1) extract the drawn layout into components fed by props; (2) replace the mock array with a SWR hook on the real endpoint; (3) while an endpoint is not yet shipped, temporary fixtures may live only in `src/fixtures/<domain>.ts`, imported only by `lib/api/<domain>.ts` behind `NEXT_PUBLIC_USE_FIXTURES=true` (forced off in production builds, like `devFlags.ts`), never by pages; (4) the increment that ships the endpoint deletes the fixture. Release gate: `src/fixtures/` empty and `grep -rE "mock|MOCK_" src/app` returns nothing.
- Policy-dependent UI uses `DEMO_POLICY_LABEL`; dark mode navy tokens only (FE1).

---

## 10. Increment sequence

Agents work in parallel inside an increment; an increment closes when its DoD (§11) passes. Backend contracts (schemas/DTOs) are posted on the board before frontend wiring.

| Inc | Name | Backend | Frontend | Exit criteria |
|---|---|---|---|---|
| 1 | Identity foundation | **Done** (status §9) | **Done** (status §10) | — |
| 2 | Platform + contracts live | BE5: platform tables, OutboxWriter/JobQueue/Idempotency, worker + scheduler + J-03/J-09, log email transport, E-03 replaces emailStub. BE2: access engine v1 + view v1 + VT-3 declarations harness + contract tests. BE1: company_settings + `getSetting`, `GET/PATCH /api/settings`, `/settings/flags`, audit read, employee create/edit/open-items + E-01/E-02, recovery codes, `capabilities` in `/me`. BE3/BE4: migration drafts for review | FE1: states components (SHR-011..015), hooks, capability-driven nav, error routing. FE2: employees, settings, audit wired. FE3–FE5: extract components from mock pages, fixtures only via §9 | Outbox round-trip test; access contract tests green; no page in scope uses inline mocks |
| 3 | Attendance + Businesses | BE1: attendance (check-in/out, corrections, settings versions, remote exceptions, J-04). BE2: businesses, categories, duplicates, corrections, search, history | FE1: My Day, check-in/out, My Attendance, correction drawer. FE2: OWN-004/005/011 attendance. FE3: DE-001..007, SHR-008..010 | VT-7 business cases incl. day-16 boundary; duplicate races |
| 4 | Calling | BE3: assignment, reservation (lease/heartbeat/idle/override, J-05), calls (attempts, outcomes, follow-ups, DNC, reopen/requeue, opportunities view). BE4: `createAcceptedOpportunity` | FE4: CC-001..008. FE2: OWN-007/008 | SEQ-09/10/11/13 tests; U-01 rule; save-after-loss flag both branches |
| 5 | Delivery | BE4: deals (stages, closure flag both modes), meetings, projects/tasks, E-14 provisioning + J-07 | FE5: DEV-001..008 | SEQ-14; DEC-005/006/F2 flags both branches |
| 6 | Notifications, work, reports | BE5: reminder planner, J-01/J-02, in-app inbox, delivery monitor, dashboard metrics §5A, exports. BE1: targets/work items | FE1: notifications. FE2: dashboard, targets, reports, delivery monitor | SEQ-12/15; "Not configured" metrics; no fixtures left |
| 7 | Hardening & release readiness | All: security review fixes, performance, retention purge, backup/restore drill (DevOps), runbook | All: accessibility pass, mobile flows M1–M6, navy dark mode audit | Full security checklist; restore drill evidence; user acceptance |

---

## 11. Definition of Done (every increment, every agent)

Run from the package folder; paste exact results in the DONE post.

| Check | Backend (`backend/`) | Frontend (`frontend/`) |
|---|---|---|
| Typecheck | `npm run typecheck` exit 0 (tests included) | `npx tsc --noEmit` exit 0 |
| Tests | `npm test` exit 0 **with** `TEST_DATABASE_URL` pointing at the Docker test DB (`devops/scripts/test-db-up.*`): no DB suite skipped for the increment's scope; new migrations applied there | component/logic tests where added |
| Lint | strict TS (`noUnused*`), no `any` in new code | `npm run lint` 0 errors |
| Build | `npm run build` exit 0 | `npm run build` exit 0 |
| Contract | endpoints match §4.1, Zod `.strict()`, error shape §4.3, `version` §4.5, audit+outbox in tx §4.6 | uses `@/lib/api` only; no inline mocks for shipped endpoints; Figma match; navy dark mode |
| Tests required | per endpoint: happy path, validation 400, role 403, resource 403/hidden, 404, 409 version; per list: hidden rows not counted; per state machine: allowed + forbidden transitions | state screens (loading/empty/error/denied/conflict) reachable |
| Flags | every touched policy uses the registry; both FLAG branches tested | labels "Demonstration alternative — not approved" visible where required |
| Docs | board DONE post with results; `status-*.md` updated by TL at increment close | same |

## 12. Security checklist (gate for every DONE)

1. Every route: `authenticate` + `requireAction`; every resource read/write: `access.check` or `scopeFilter`; Owner admin actions require completed 2FA.
2. Mutations: Origin check + `X-CSRF-Token` (automatic via middleware/client); no new Bearer or token-in-body paths.
3. All SQL parameterized; identifiers only from whitelists; no string-built SQL from input.
4. Zod `.strict()` on every input; size limits; UUID params.
5. Audit row in the same transaction for every state change; no secrets in audit, logs or outbox payloads.
6. No hidden-record data in errors, counts, logs, notifications or exports (leakage tests).
7. Rate limits on auth and duplicate-check/search endpoints; idempotency keys where §4.7 requires.
8. No `.env` reads in code paths other than `config/index.ts` (and BE5's email config); no secrets in the repo, client bundle or logs; dev personas/fixtures off in production builds.
9. Email: `log` transport unless `EMAIL_ALLOW_REAL_SEND=true` is set by the user; no real email in this build.
10. Migrations forward-only, non-destructive, FKs RESTRICT, run on the Docker test DB only.
11. `Cache-Control: no-store` on `/api` (in app.ts); helmet on; CORS limited to `APP_ORIGIN`.
12. Dependencies: new packages only via TL REQUEST; `npm audit` high findings reported.
