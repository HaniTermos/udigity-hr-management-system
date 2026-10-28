# Review 02: backend access engine, businesses, duplicates, corrections, attendance, work, reports

| Field | Value |
|---|---|
| Reviewer | Reviewer 2 (full-system review) |
| Date | 2026-10-28 |
| Scope | `backend/src/modules/{access,businesses,duplicates,corrections,attendance,work,reports}/**`, migrations 900–903 (and 014, which the access module now depends on) |
| Method | Read-only, line by line. Tests run once against `udigity_test_r2` (`access.api.test.ts`, `access.test.ts`, `be2.api.test.ts`): **12 failed / 596 passed**. No source edited, no `.env` opened |
| Result | **1 × P0 (the regression), 2 × P1, 7 × P2, 12 × P3.** 13 items of `review-inc3-7.md` fixed, 17 still open (§3) |

## 1. The regression (13 failing tests)

**Root cause: `backend/src/modules/access/rules.ts` was rewritten on 2026-10-28 01:14** (file mtime; every other access file dates from 2026-10-23/26, the last green run was 2026-10-26). The compiled `dist/modules/access/rules.js` (09:47 today) carries the same change, so the running build is affected. Three edits in `buildRuleFragments` broke the rule table:

1. **`case 'developer'`: `relation = 'TRUE'` and `windowForRole = window()`** (lines 236–241). A Developer's relation used to be the DEC-002 rows only (R1 assigned / R2 closed-deal / R3–R4 project), never the window. Now every Developer gets **`full`** access to every business inside its 15-day window: directory list, search, detail (socials, website, notes), history, `correction.submit`. Matrix §2.3/§3.4: DV = Ctx rows 1–4 only, "closed-deal list only", never full.
2. **New `case 'human_resources': case 'owner': default:` branch** (lines 242–249) with `scope = relation = 'TRUE'` and the window. `Role` was widened to `string` (migration 014, `middleware/auth.ts:15`), so **any custom role created in the Roles Studio, and any typo role, gets Data-Entry-wide business visibility** from the engine the moment `requireAction` lets it through. Before, an unknown role fell to `FALSE` (`review-inc3-7.md` §2 "unknown types/roles → FALSE"). The `'owner'` label here is dead: the engine returns before the rule table for Owners.
3. **`rowsAllowedFor` (lines 148–151) now excludes the context rows only for `business.search`.** It used to exclude them from `business.list` too (except the Developer's R2 closed-deal list). Result: a Call Center agent's row-5 callbacks and a Data Entry user's row-6 correction businesses appear in the **directory list** (Table RT rule 4; `access.test.ts:289-297`, `access.api.test.ts:198`).

Every failing assertion maps to one of these: Developer gets `full`/200 where `permission_denied`/403 is expected (`access.api.test.ts:216-248`, `be2.api.test.ts` detail/search/submit); hidden-row count 1 instead of 0 for a Developer (`access.api.test.ts:360-374`, `be2.api.test.ts:734`); CC/DE context rows on the list surface (`access.api.test.ts:198`, `:259`, `be2.api.test.ts` row-6 case); unit assertions `relation === 'FALSE'` and rows all `FALSE` on `business.list` (`access.test.ts:283, 291`).

**Verdict: a real authorization bug (hidden-record and base-scope leak), not a stale test.** The tests encode the matrix correctly. The 13th failure in the baseline (vs 12 here) is `tests/runtimeRole.test.ts`/`delivery.api.test.ts`, outside this slice but with the same cause (Developer/custom role visibility).

Fix (one file): restore `developer` to `scope='TRUE'; relation = <OR of the non-FALSE rows, else 'FALSE'>; windowForRole='FALSE'`; make `default:` (and any non-matrix role) `scope = relation = windowForRole = 'FALSE'`; restore `rowsAllowedFor`: `business.search` → none; `business.list` → `{R2}` for Developer, none for other roles; all rows elsewhere. Re-run the three suites plus `runtimeRole.test.ts` and `delivery.api.test.ts`.

## 2. Findings

| ID | Sev | file:line | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| A-01 | **P0** | `access/rules.ts:148-151, 236-249` | Rule-table regression described in §1: Developer full access inside the window; unknown/custom roles get full DE scope; context rows leak onto the directory list. | Hidden-record and base-scope leak on `/api/businesses`, `/api/search`, `/api/businesses/:id`, `/history`, `/api/categories` counts, `POST /api/correction-requests`; 12 contract tests red. | §1. Also add a unit test "unknown role → `(FALSE AND FALSE AND FALSE)`". |
| A-02 | **P1** | `shared/access.ts:165-175, 193-219`; `access/dynamicService.ts:214-306`; `access/dynamicSchemas.ts:10-15` | Dynamic RBAC can grant **Owner-only / admin actions to custom roles**: `RolePermissionInputSchema.action` is any string (not validated against `AUTHZ_MATRIX`); `createRole`/`updateRole` allow admin actions whenever the actor is an Owner; `requireAction` applies the 2FA gate only when `req.user.role === 'owner'`, so a custom role holding `employee.list`, `audit.read`, `settings.update`, `report.export`, `business.archive` … passes with no 2FA. Nobody-rows (`business.delete`, `audit.export/update/delete`) can be granted too. | Breaks matrix §1 rule "Owner-only actions require 2FA" and the "nobody" rows; `verifyDeclaredActions` does not see DB grants, so the startup drift check is blind to them. | Validate `action` against `AUTHZ_MATRIX` keys; refuse `admin` rows and empty-role rows for non-system roles (or require `admin` rows to also carry the 2FA gate for any holder); extend `verifyDeclaredActions` to DB grants; add tests. |
| A-03 | **P1** | `access/dynamicService.ts:27-89` (`ensureLoaded` never called; `invalidate()` only flips a flag) | `DynamicRoleCache` is **never loaded from the DB**: nothing calls `ensureLoaded`/`loadAll` at startup or on a cache miss. Grants only exist in memory after an in-process create/update; after a restart (or in the worker process) custom-role employees are denied everything; `deleteRole` leaves the deleted role's actions cached. | Functional outage for every custom role in production; inconsistent behaviour across `api`/`worker`; stale grants in memory until restart. | Call `ensureLoaded(pool)` in `access/module.ts init()` and after `invalidate()`; drop the role from the map on delete; add a TTL or a `role_permissions.version` check. |
| A-04 | P2 | `access/dynamicRepo.ts:18-24`, `dynamicService.ts:66-68, 142-157` | `data_scope` (`self`/`department`/`global`/`assigned_only`) is stored and advertised in the catalog but **never read** by the engine or any module (`getDataScope` has no caller). A role labelled "self" gets whatever the rule table gives (today: everything, see A-01). | Misleading security control; dead code. | Either remove the column/UI option or wire it into `scopeFilter`/`check` for non-business types. |
| A-05 | P2 | `db/migrations/014_dynamic_roles_rbac.sql:37-39`; `middleware/auth.ts:15`; `access/matrix.ts:17-21` | `employees.role` CHECK dropped and replaced by an FK to `custom_roles`; `Role` became `string & {}`. Every `switch (role)` / `role !== 'owner'` branch in the codebase is now reachable by arbitrary role ids, and the matrix tables know only four roles. No contract update in `authz-matrix.md` for custom roles. | The engine's safety rests on exhaustive role handling; A-01 is the first fallout. | Security Lead decision: either custom roles map to one of the four base roles (`custom_roles.base_role`) or every branch gets an explicit deny default. Document in the matrix. |
| A-06 | P2 | `businesses/http.ts:53`; `businesses/routes.ts:62-69, 74, 232`; `corrections/routes.ts:35` | Rate limits unchanged since R2-07: duplicate-check and search at 120/min; no per-user limiter on `GET /api/businesses`, `GET /api/correction-requests`, `GET /api/categories`. | EX-3 scraping; with A-01 a Developer can dump the directory. | `perUserLimiter('duplicate-check', 30, 600_000)`, `('search', 300, 300_000)`, shared list limiter. |
| A-07 | P2 | `businesses/service.ts:284-305` | Live duplicate preview still "Read-only; no audit": hidden/archived matches answer `{visibility:'hidden'}` with no `business.duplicate_blocked` row (R2-08) and `excludeBusinessId` is honoured without an access check (R2-21). | Phone/name oracle on hidden records, untraceable. | Audit hidden/archived matches (`source:'preview'`, ids only); honour `excludeBusinessId` only when `checkBusiness(principal,'business.update',id)` allows. |
| A-08 | P2 | `corrections/service.ts:162-165`; `businesses/repo.ts:111-117` | `businessIdsMatchingName` is unscoped and ANDed into the correction list; `ILIKE` has no `ESCAPE` (R2-09, R2-25). | Name oracle for CC/DV on a redacted request. | Scope the id list with `scopeFilter`; reuse `escapeLike` + `ESCAPE ${LIKE_ESCAPE}`. |
| A-09 | P2 | `corrections/service.ts:399-421` | `openSummaries` counts every open request for every viewer (`entry.count += 1`), so CC/DV `openCorrections` = other people's request count (R2-23). | Count leak (matrix §3.6 CC/DV = Own). | Count `mine` only for non-DE/Owner. |
| A-10 | P2 | `reports/repo.ts:134-144`; `reports/service.ts:95-111` | Dashboard "today" and `missing_checkout` use UTC midnight and a hard-coded 12 h instead of the company timezone and the D5 setting; `absentOrMissingCheckin: 0` is a hard-coded placeholder; target values 500/12/200 are hard-coded (R2-34). | Owner-only (no leak) but wrong figures on OWN-001 and a silent stub. | Use `getCompanyTimezone`/`attendance.missingCheckoutFlagHours`; read `targets`; compute missing check-in from `attendance_exceptions` or return `null` ("Not configured"). |
| A-11 | P3 | `access/routes.ts:32-106, 109-167`; `access/module.ts:11-14` | `/api/access/roles*` and `/api/roles*` mount identical handlers (duplicate surface, one more route to guard); `idempotent()` on DELETE. | Dead duplication; two URLs for the same admin action. | Keep one mount. |
| A-12 | P3 | `access/rules.ts:43-62, 169` | R2-20 unchanged: unset timezone falls back to `Etc/GMT-14` in dev/test (production now throws `ConfigError`, which is the right fail-closed behaviour for prod). | Dev/test only. | Keep; note as accepted. |
| A-13 | P3 | `businesses/routes.ts:173-179`; `corrections/service.ts:130, 237` | Ad-hoc role branches outside the engine (`categoryManageGuard` calls `next()` for DE under CA-B; corrections Owner shortcut skips `checkBusiness`) (R2-22). | Behaviour matches the matrix today; fragile with custom roles (A-05). | Express as matrix rows / flag-aware policy. |
| A-14 | P3 | `businesses/service.ts:729, 947, 962` | Audit `after`/`before` carry business and category names (R2-24). | Within caps; Owner-only. | Ids only. |
| A-15 | P3 | `attendance/routes.ts:204-207` | `test-office-check` passes `req.ip` directly, bypassing `runCommand` IP capture; result not audited (R2-19). | Owner-only; cosmetic. | Use the shared client-IP helper. |
| A-16 | P3 | `attendance/routes.ts:104-113`; `attendance/service.ts:1765-1816` | `GET /breaks/active` and `GET /sessions/:id/breaks` run inside `runCommand` (a write transaction for a read); `listSessionBreaks` does its own `role !== 'owner'` check instead of `access.check('attendance_session')` (checklist A2). | Inconsistent, not a leak (own-record enforced). | Use `pool` + `access.check` like `getSession`. |
| A-17 | P3 | `work/routes.ts:19-33, 59-73`; `work/schemas.ts:44-53` | `employeeId`/`status` read raw from the query; `dueDate` free string → pg `22P02` → 500 (R2-31). `createTarget`/`createWorkItem` do not check the employee is active; `sourceType`/`sourceId` free strings (R2-32, partially fixed: `work_item.created` is now audited). | 500 instead of 400; targets on inactive employees. | Strict query schemas; `assertActiveEmployee`; `sourceType` enum + uuid. |
| A-18 | P3 | `reports/schemas.ts:24-27`; `reports/repo.ts:221-229` | `report` validated by regex, not an enum of the four ids; `from`/`to` are accepted, stored in `export_records.filters` and the audit payload, but ignored by the query (R2-05 residual). | Misleading audit trail ("filtered" exports are not). | `z.enum(['rep-1','rep-2','rep-3','rep-4'])`; apply or drop the dates. |
| A-19 | P3 | `access/matrix.ts:60-65, 79-81`; `docs/security/authz-matrix.md` | `role.*`, `permission.*`, `attendance.break.*` rows exist in code but not in the matrix document (the harness logs `not_in_matrix` only for undeclared names; these are declared in code, so no warning). | Contract drift. | Add the rows to the matrix (Security Lead). |
| A-20 | P3 | `duplicates/module.ts`, `routes.ts`, `repo.ts` | Empty scaffold files ("STUB" headers) for a module that is a pure library. | Noise; the route-guard walker sees no mounts, fine. | Delete the three files or drop the comments. |

## 3. Status of `review-inc3-7.md` items in this slice

| Fixed (verified in code) | Still open |
|---|---|
| R2-01 CSV formula prefix (`reports/service.ts:149-160`), filename from validated id | R2-07 rate limits (A-06) |
| R2-02 step-up TOTP ≤ 10 min, `report.export_denied`/`export_failed` audited, 20/10 min per Owner, 1000-row cap, 15 s `statement_timeout` | R2-08 preview audit (A-07) |
| R2-03 `work_item.update` loads + locks, 404 for non-assignee, `work_item.updated` audited, IDOR test present (`work.api.test.ts:174`) | R2-09 corrections name oracle (A-08) |
| R2-04 `GET /export` → 405, POST only; frontend uses `fetch` POST with CSRF | R2-19 `req.ip` in test-office-check (A-15) |
| R2-05 `format` enum, `email` dropped from rep-1, unknown report → 400 (residual A-18) | R2-20 UTC+14 dev fallback (A-12, accepted) |
| R2-06 not-configured check-in/out → 409 `POLICY_NOT_CONFIGURED` (`attendance/service.ts:477-485, 549-557`) | R2-21 `excludeBusinessId` (A-07) |
| R2-32 (partial) `work_item.created` audited | R2-22 ad-hoc role branches (A-13) |
| | R2-23 open-correction count leak (A-09) |
| | R2-24 names in audit payloads (A-14) |
| | R2-25 ILIKE escape (A-08) |
| | R2-31 raw query parsing (A-17) |
| | R2-32 active-employee check, `sourceType` (A-17) |
| | R2-34 hard-coded targets (A-10) |

Out of this slice (not re-verified): R2-10..R2-17, R2-18, R2-26..R2-30, R2-33, R2-35..R2-37.

## 4. Checks with no finding

- **Matrix and flags.** Every declared action in the seven modules is taken from `AUTHZ_MATRIX` via `defineMatrixActions`; `verifyDeclaredActions` runs at init. Both branches of `visibility.timerBasis`, `access.dataEntryScope`, `deals.developerPreClosure`, `auth.ownerPending2faScope`, `categories.dataEntryManage`, `attendance.employeeRequests`, `attendance.remoteSelfRequest`, `attendance.failedCheckout` (block/hold/provisional) are implemented and tested. R11-a denies a pending Owner in the engine and in `scopeFilter`.
- **Hidden records (modulo A-01).** `scopeFilter` is ANDed before `COUNT`, facets, `tabCounts` and paging in `listBusinessRows`, `searchBusinessRows`, `listCategories` (`countScope`), `listCorrections`; `hiddenForOthersPredicate` and `archived` flags reach the Owner only; archived rows are 404 for non-Owners (`checkBusiness`); Developer context-limited detail strips `social`/`website` and the history excludes those fields; denials are audited with ids only (`business_access.denied`); Owner hidden reads audited (OI-05). Dashboard and reports are Owner + admin only.
- **Duplicates.** Whole-DB match including archived (C3/OI-26); non-Owner sees `{visibility:'hidden'}` unless `level==='full'` and not archived; similar-name warnings filtered through `checkMany`; DR-8 races caught by the two UNIQUE indexes (`guardUnique` → `UniqueRace` → re-detect outside the aborted tx → shaped `DUPLICATE_BLOCKED` + audit); `confirmSimilar` required for SN-1.
- **Attendance.** Times from `clock.now()` only; `trust proxy` = 1 hop only with `TRUST_PROXY=true`; the module never reads forwarding headers; IPv4-mapped IPv6 and zone ids normalised; CIDR via `net.BlockList`; `not_configured` (timezone, office IPs or a location mode) → 409 on check-in/out unless a granted remote exception exists; punctuality `unclassified` without a timezone; failed check-ins audited with the IP; corrections are new rows, originals kept; own-record access through `access.check`/`scopeFilter` with `attendance_session`/`attendance_correction` resolvers; a foreign session/correction is 404.
- **Work.** `target.set`/`work_item.create` Owner + 2FA; lists scoped to the principal for non-Owners; `updateWorkItem` row-locked and owner-checked (R2-03).
- **Reports/export.** Owner + admin; step-up; caps; audit on success, denial and failure; `Cache-Control: no-store`; CSV cells neutralised; JSON export uses the same rows.
- **SQL.** All statements parameterised; sort keys via `orderByClause` allowlists; `scopeFilter` validates alias/idColumn; LIKE inputs escaped except A-08.
- **Views 900–903.** Column set and order match `ACCESS_FACT_COLUMNS`; each revision is `CREATE OR REPLACE VIEW` with the same contract; 902 joins the open assignment (`ended_at IS NULL`), the scheduled follow-up and `business_calling_states`; 903 picks the open deal (else the latest closed, never `not_proceeding`) and the non-completed project (else the latest) with current developer assignments. `has_open_correction` = Submitted/In review. Consistent with `rules.ts` fragments.

## 5. Wiring map

| Route (mount) | Guard | Service | Repo / table | Notes |
|---|---|---|---|---|
| `GET /api/businesses` | `business.list` | `listBusinesses` → `scopeFilter` | `listBusinessRows` → businesses, categories, employees, access_facts | counts after scope |
| `POST /api/businesses/duplicate-check` | `business.duplicate_check` + limiter | `duplicateCheck` → `detectBlock`/`shapeMatch`/`similarFor` | `findPhoneMatch`, `findNameMatch`, `findSimilarNames` | no audit (A-07) |
| `POST /api/businesses` | `business.create` + `idempotent` | `runBusinessCommand` → `createBusiness` | `insertBusiness`, `replacePhones`, `replaceSocials`, `insertHistory`; `calls.initCallingState` | audit `business.created` |
| `GET /api/businesses/:id` | `business.read` | `checkBusiness` → `getBusinessDetail` | `businessSelect` | OI-05 audit |
| `PATCH /api/businesses/:id` | `business.update` | `updateBusiness` (+ corrections bridge `prepareApply`) | `updateBusinessCore`, phones, socials, history | row-6 apply only |
| `POST /:id/archive`, `/:id/restore` | `business.archive`/`restore` (admin) | `setBusinessArchived` | `setArchived`, history | |
| `DELETE /api/businesses/:id` | `business.delete` (nobody) | unreachable | — | by design |
| `GET /api/businesses/:id/history` | `business.history.read` | `checkBusiness` → `getHistory` | `listHistory` | OI-11 field limits |
| `GET/POST/PATCH /api/categories`, `/:id/deactivate` | `category.*` (`categoryManageGuard` for CA-B) | `listCategories`, `createCategory`, `renameCategory`, `deactivateCategory` | categories | counts scoped |
| `GET /api/search` | `business.search` + limiter | `searchBusinesses` → `scopeFilter` | `searchBusinessRows` | rows excluded |
| `GET/POST /api/correction-requests`, `GET /:id` | `correction.read`/`submit` | `listCorrections`, `submitCorrection`, `getCorrection` | data_correction_requests (+ employees) | OI-09 redaction; E-09 outbox |
| `POST /:id/{start-review,release}` | `correction.review` | `startReview`, `releaseReview` | `transition` | |
| `POST /:id/resolve` | `correction.apply` | `resolveCorrection` → `updateBusiness` → `finishResolved` | one tx | outbox outcome |
| `POST /:id/reject`, `/close-no-change`, `/withdraw` | `correction.reject`/`close`/`withdraw` | respective commands | `transition` | |
| Outbox consumer `account.deactivated` | — | `releaseForDeactivatedReviewer` | `inReviewByReviewer` | N-4 |
| `GET /api/attendance/me/today`, `/me/sessions` | `attendance.read` | `getToday`, `mySessions` (own) | attendance_sessions, remote_exceptions, settings versions | |
| `POST /check-in`, `/check-out` | `attendance.check_in`/`check_out` + idempotent | `checkIn`, `checkOut` (office check, DEC-026 branches) | `insertSession`, `updateSession`, breaks auto-close | audit + outbox |
| `POST /breaks/start`, `/breaks/end`; `GET /breaks/active`, `/sessions/:id/breaks` | `attendance.break.*` | `startBreak`, `endBreak`, `getActiveBreak`, `listSessionBreaks` | attendance_breaks | A-16 |
| `GET /sessions`, `GET /sessions/:id` | `attendance.read` | `listSessions` (`scopeFilter`), `getSession` (`check`) | `listSessions`, `sessionById` | |
| `POST /sessions` (retroactive), `/sessions/:id/adjust`, `/resolve-review` | admin actions | `createRetroactive`, `adjustSession`, `resolveReview` | sessions + corrections rows | reason required |
| `POST/GET /corrections`, `/:id`, `/:id/{approve,reject,withdraw}` | `attendance.correction.request`/`review` | corrections commands; `listCorrections` (`scopeFilter`; `kind` → review queue, `can(correctionReview)`) | attendance_corrections | E-10 outbox |
| `GET /overview` | `attendance.overview.read` | `overview` | monitoring queries | |
| `GET/PUT /settings`, `POST /settings/test-office-check` | `settings.read`/`attendance.read` via `requireActionFor`; `settings.update` | `getSettingsView`, `putSettings`, `testOfficeCheck` | attendance_settings_versions; `company.timezone` via admin | A-15 |
| `GET/POST /remote-exceptions`, `/requests`, `/:id/{approve,reject,revoke}` | `attendance.read`/`remote_exception.grant`/`.request` | `listRemote` (`scopeFilter`), `grantRemote`, `requestRemote` (flag), `decideRemote` | remote_exceptions | |
| Job `attendance.exception_check` | system | `runExceptionCheck` | attendance_exceptions | J-04 |
| `GET/POST /api/targets`, `PATCH /:id` | `target.read`/`target.set` | `listTargets` (own unless Owner), `createTarget`, `updateTarget` | targets | A-17 |
| `GET/POST /api/work-items`, `PATCH /:id` | `work_item.read`/`create`/`update` | `listWorkItems`, `createWorkItem`, `updateWorkItem` (lock + assignee check) | work_items | R2-03 fixed |
| `GET /api/dashboard` | `dashboard.owner.read` | `getDashboardMetrics` | `queryDashboardStats`, `queryDeveloperWorkload` (cross-module reads) | A-10 |
| `GET /api/reports` | `report.read` | `listReports` (static) | — | |
| `GET /api/reports/export` | `report.export` | 405 | — | R2-04 |
| `POST /api/reports/export` | `report.export` + limiter + concurrency cap | `exportReport` → `assertStepUp` (identity `hasRecentStepUp`/`verifyStepUpTotp`) → rows → `insertExportRecord` → audit | export_records; attendance_sessions / call_attempts / deals / businesses | |
| `GET /api/access/permissions`; `GET/POST/PATCH/DELETE /api/access/roles[/:id]` and `/api/roles[/:id]` | `permission.list`, `role.*` (admin) | `listPermissionsCatalog`, `listRoles`, `getRole`, `createRole`, `updateRole`, `deleteRole` | custom_roles, role_permissions, sessions (`revokeSessionsForRole`), employees | A-02, A-03, A-04, A-11 |
| Engine (no routes) | — | `createAccessEngine`: `check`/`checkMany`/`scopeFilter` over `rules.ts` fragments; resolvers registered by attendance, work (and BE3/BE4) | `access_facts` view (900–903), read-only | A-01 |

Stubs / dead code: `duplicates/{module,routes,repo}.ts` (A-20); `dynamicService.getDataScope` and `data_scope` (A-04); `DynamicRoleCache.ensureLoaded` (A-03); `rules.ts` `case 'owner'` inside the rule table (unreachable); duplicate `/api/roles` mount (A-11). No `NOT_IMPLEMENTED` handlers in the slice.
