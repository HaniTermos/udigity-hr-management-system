# Review 04 — Integration / Contract review (frontend ↔ backend)

Reviewer 4 (Integration/Contract). Date: 2026-10-28. Scope: read-only review of `frontend/src/lib/api/**`, the `fetch` and SWR calls in `frontend/src`, `backend/src/modules/**/routes.ts` and schemas, `lib/actions.ts`, `lib/nav.ts`, `modules/access/matrix.ts`, the proxy, Next rewrites and nginx.

## Method

1. **Backend route inventory.** I listed routes programmatically with `listRoutes(modules)` from `shared/routeGuard.ts`, using a temporary script that has since been deleted. That gives 162 routes, and every `/api` route is guarded or on the allowlist.
2. **Action registry.** I dumped the registry with `listActions()`/`getActionPolicy()` after `initModules()` and diffed it against `frontend/src/lib/actions.ts`.
3. **Frontend calls.** I mapped every `lib/api/*.ts` function and every UI-level `useSWR`/`useApi`/`fetch` call to a route. Request bodies were compared with the Zod schemas.
4. **Live check.**
   - Backend: `NODE_ENV=development`, port 5099, against `udigity_test_r4`. I migrated (31 migrations), ran the dev seed, logged in as all 4 roles (Owner via the seed TOTP) and ran 37 GETs per role.
   - I sent 2 contract mutations that are rejected by validation, plus a CSRF-less POST.
   - The server was stopped afterwards.

Status legend: **OK** = path, method, body and response shape match. **MISMATCH** = wired, but the body, response, casing or semantics are wrong. **MISSING** = one side has no counterpart. **UNUSED-FE** = the frontend function exists but no screen calls it.

---

## 1. Contract table

### Identity / auth (`/api/auth`)
| Frontend fn / caller | Backend route | Zod / response | Status |
|---|---|---|---|
| `auth.tsx login` → POST `/api/auth/login` `{email,password}` | POST /login (allowlisted) | LoginSchema → `{message,requires2FA,twoFactorStep,csrfToken,user}` | OK (live 200) |
| `verify2FA` → POST `/api/auth/2fa/verify` `{token}` | POST /2fa/verify | TotpCodeSchema `{token}` → `{message,csrfToken,user}` | OK (live 200) |
| `recoverWithCode` → POST `/2fa/recover` `{code}` | POST /2fa/recover | RecoverSchema `{code}` | OK |
| `startEnrollment` → POST `/2fa/enroll/start` `{enrollmentToken,currentPassword}` | POST /2fa/enroll/start | EnrollStartSchema → `{method,secret,otpauthUrl}` | OK |
| `confirmEnrollment` → POST `/2fa/enroll/confirm` `{token}` | POST /2fa/enroll/confirm | → `{recoveryCodes}` | OK |
| — (`identityPaths.recoveryCodes` defined, never called) | POST /2fa/recovery-codes (`employee.manage_own_recovery_codes`) | `{token}` → `{recoveryCodes}` | MISSING (no UI) |
| — (`identityPaths.enrollmentTokens` defined, never called) | POST /2fa/enrollment-tokens (`employee.issue_2fa_enrollment_token`) | → 201 `{enrollmentToken,expiresAt}` | MISSING (no UI) — see F-05 |
| — (`identityPaths.twoFactorStatus`, never called) | GET /2fa/status | `{required,method,enrolled,sessionState,pending,enrollmentTokenRequired,recoveryCodesRemaining}` | MISSING (unused) |
| `logout` → POST `/api/auth/logout` | POST /logout | `{message}` | OK |
| profile → POST `/api/auth/sessions/revoke-all` `{}` | POST /sessions/revoke-all (`auth.session.revoke_all`) | RevokeAllSchema `{keepCurrent?}` → `{revoked,currentSessionEnded}` | OK |
| profile → POST `/api/auth/password/change` `{currentPassword,newPassword}` | POST /password/change (`auth.password.change`) | 401 `INVALID_CREDENTIALS` on a wrong password; the UI handles it | OK (see F-14) |
| `AuthProvider` SWR + `proxy.ts` → GET `/api/auth/me` | GET /me (allowlisted) | `{user{…,sessionState},capabilities,csrfToken}` | OK (live) |
| reset page → POST `/password-reset/request` `{email}`; `identity.requestPasswordReset` | POST /password-reset/request | → 202 `{message}` | OK |
| reset page → POST `/password-reset/complete` `{token,newPassword}` | POST /password-reset/complete | 400 `RESET_LINK_INVALID` | OK |

### Employees / profile / roles / admin
| Frontend fn / caller | Backend route | Zod / response | Status |
|---|---|---|---|
| profile `useApi(ownProfilePath)` GET `/api/employees/me` | GET /employees/me (`profile.read`) | `{employee}` | OK (live) |
| profile PATCH `/api/employees/me` `{version,phone}` | PATCH /employees/me (`profile.update`) | UpdateOwnProfileSchema (not `.strict()`) | OK |
| `listEmployees` GET `/api/employees` | GET /employees (`employee.list`, Owner) | `Page` + legacy `employees` | OK; but called from non-Owner screens (F-06, F-07) |
| `createEmployee` POST `/api/employees` + Idempotency-Key | POST /employees (`employee.create`) | CreateEmployeeSchema; there is no `idempotent()` middleware, so the header is ignored | OK (header unused) |
| `updateEmployee` PATCH `/api/employees/:id` | PATCH /employees/:id | UpdateEmployeeSchema | OK |
| `setEmployeeActive` PATCH `/:id/status` `{isActive,version,reason}` → `{employee}` | PATCH /employees/:id/status | StatusBodySchema; codes `CANNOT_DEACTIVATE_SELF`, `LAST_ACTIVE_OWNER` are handled in EmployeeDrawer | OK |
| `getOpenItems` GET `/:id/open-items` | GET /employees/:id/open-items | OpenItemsDto | OK |
| — | GET /employees/:id | employee DTO | MISSING (no caller; the list carries everything) |
| `listRoles`/`getRole`/`createRole`/`updateRole`/`deleteRole`/`listPermissions` → `/api/access/roles[/:id]`, `/api/access/permissions` | /api/access/* | `{roles}`, `{role}`, `{permissions}` | OK (live) — but see F-08 (SWR key collision) |
| — | GET/POST/PATCH/DELETE `/api/roles[/:id]` (duplicate mount) | same handlers | MISSING caller (alias, dead surface) |
| `listAuditEvents` GET `/api/audit-events` | GET /audit-events (`audit.read`) | AuditQuerySchema (`entityRef` alias) → Page | OK (live) |
| `getSettings` / `format.ts` / `useCompanyTime` GET `/api/settings` | GET /settings (`settings.read`, Owner) | `{version,updatedAt,label,company,policies,settings}` | OK |
| `patchSettings` PATCH `/api/settings` `{version,company:{'company.name'}}` | PATCH /settings | PatchSettingsSchema; `company.name` is not a registry key | **MISMATCH** — live 400 `Unknown setting` (F-02) |
| `listPolicyFlags` GET `/api/settings/flags` | GET /settings/flags | `{label,flags}` | OK |
| — | GET /settings/public (`settings.read_public`, all roles) | `{label,company{'company.timezone'},configured}` | MISSING caller (non-Owners take the timezone from `/attendance/me/today`) |

### Attendance (`/api/attendance`)
| Frontend fn / caller | Backend route | Zod / response | Status |
|---|---|---|---|
| `getToday` GET `/me/today` | GET /me/today | AttendanceTodayDto | OK (live) |
| `checkIn` POST `/check-in` `{}` + Idem | POST /check-in (idem optional) | CheckInSchema strict `{}` → 201 `{session,outcome,label}` | OK |
| `checkOut` POST `/check-out` `{version?,summary}` + Idem | POST /check-out | CheckOutSchema | OK |
| `getMySessions` GET `/me/sessions` | GET /me/sessions | Page + `summary` | OK (live) |
| `getMyCorrections` GET `/corrections` | GET /corrections | Page | OK |
| `submitCorrection` POST `/corrections` + Idem | POST /corrections | CorrectionRequestSchema | OK |
| `withdrawCorrection` POST `/corrections/:id/withdraw` `{version}` | POST …/withdraw | WithdrawSchema | OK |
| `requestRemoteException` POST `/remote-exceptions/requests` + Idem | POST /remote-exceptions/requests | RequestRemoteSchema | OK (no `idempotent()` → header ignored) |
| `getAttendanceFlags` GET `/settings` | GET /settings | `{…,flags:{employeeRequests,remoteSelfRequest,failedCheckout,label}}` | OK |
| settings page `api.get('/api/attendance/settings')` | GET /settings | `current.workingDays` = `["MON",…]` | OK |
| settings page PUT `/api/attendance/settings` | PUT /settings (`settings.update`) | PutSettingsSchema: `WEEKDAYS` uppercase | **MISMATCH** — live 400 for every save (F-01); the hardcoded fields overwrite policy (F-03) |
| `getActiveBreak`/`startBreak`/`endBreak` | GET /breaks/active, POST /breaks/start, /breaks/end | `{activeBreak,…}`, `{break,label}` | OK (live) |
| `getSessionBreaks` | GET /sessions/:id/breaks | `{breaks}` | UNUSED-FE |
| `getAttendanceOverview` GET `/overview` | GET /overview (Owner) | AttendanceOverview | OK (live keys match) |
| `listReviewItems` GET `/corrections?kind=…` | GET /corrections (kind branch) | `{items,…,counts,previews,label}` | OK (live) |
| `adjustSession` POST `/sessions/:id/adjust` `{version,checkOutAt,reason}` + Idem | POST /sessions/:id/adjust | AdjustSchema | OK |
| `approveRequest` / `rejectRequest` | POST /corrections/:id/approve, /reject | VersionReasonSchema / RejectCorrectionSchema | OK |
| — | POST /sessions/:id/resolve-review (`attendance.failed_checkout_review`) | ResolveReviewSchema | MISSING caller (the UI uses `adjust` for pending_review) |
| — | GET /sessions, POST /sessions (retroactive), GET /sessions/:id, GET /corrections/:id | | MISSING caller |
| — (`attendancePaths.remoteExceptions` defined) | GET/POST /remote-exceptions, POST /remote-exceptions/:id/{approve,reject,revoke} | | MISSING (Owner cannot grant or decide remote exceptions in the UI) |
| — | POST /settings/test-office-check | | MISSING caller |

### Businesses / categories / search / corrections
| Frontend fn / caller | Backend route | Zod / response | Status |
|---|---|---|---|
| `listBusinesses` GET `/api/businesses` | GET /businesses | BusinessListQuerySchema → `{items,…,counts,facets}` | OK (live) |
| `getBusiness` GET `/:id` | GET /businesses/:id | BusinessDetail | OK |
| `getBusinessHistory` GET `/:id/history?page&pageSize` | GET /businesses/:id/history | Page | OK |
| `createBusiness` POST + Idem (required) | POST /businesses (`idempotent('business.create')`) | CreateBusinessSchema → 201 | OK |
| `updateBusiness` PATCH `/:id` | PATCH /businesses/:id | UpdateBusinessSchema | OK |
| `archiveBusiness`/`restoreBusiness` | POST /:id/archive, /:id/restore | VersionBodySchema | OK |
| `checkDuplicate` POST `/duplicate-check` | POST /businesses/duplicate-check | DuplicateCheckSchema | UNUSED-FE (no live duplicate warning while typing) |
| — | DELETE /businesses/:id (granted to no role, always 403) | | MISSING by design (C-01) |
| `listCategories` GET `/api/categories?pageSize=100` | GET /categories | Page | OK (live) |
| `createCategory` / `renameCategory` / `deactivateCategory` | POST /categories, PATCH /:id, POST /:id/deactivate | strict schemas | OK |
| `searchBusinesses` GET `/api/search` | GET /search | SearchQuerySchema (q ≥ 2) → `{…,counts}` | OK (live) |
| `listCorrections` / `getCorrection` | GET /correction-requests[/:id] | `{…,tabCounts,requesters}` | OK (live) |
| `startReview`/`release`/`closeNoChange`/`reject`/`withdraw` | POST /:id/{start-review,release,close-no-change,reject,withdraw} | strict schemas | OK |
| `resolveCorrection` | POST /:id/resolve | ResolveSchema | UNUSED-FE (the UI resolves via PATCH business + `correctionId`) |
| `submitCorrection` POST `/correction-requests` | POST /correction-requests | SubmitCorrectionSchema (issueType enum identical) | OK |

### Calling / follow-ups / reservations / assignments
| Frontend fn / caller | Backend route | Zod / response | Status |
|---|---|---|---|
| `useQueue` (useApi) GET `/api/calling/queue` | GET /calling/queue | QueueQuery → `{…,counts,agentId}` | OK (live) |
| `useWorkspace` GET `/calling/businesses/:id/workspace` | GET … /workspace | WorkspaceDto | OK |
| `acquireReservation` POST `/api/reservations` + Idem (required) | POST /reservations | `{businessId}` → 201/200 holder | OK |
| `renewReservation` / `releaseReservation` / `overrideReservation` | POST /reservations/:id/{renew,release,override} | strict schemas | OK |
| `logAttempt` POST `/calling/attempts` + Idem (required) | POST /calling/attempts | LogAttemptBody discriminated union, identical fields | OK |
| `logInboundRejection` + Idem (required) | POST /calling/attempts/inbound-rejection | strict | OK |
| `useDoNotCall` / `useOpportunities` | GET /calling/do-not-call, /calling/opportunities | Page / `+dealInfoAvailable` | OK (live) |
| `reopenBusiness` / `requeueBusiness` `{reason,stateVersion}` | POST /calling/businesses/:id/{reopen,requeue} | ReopenBody | OK |
| `useFollowUps` / `createFollowUp` / `updateFollowUp` / `completeFollowUp` / `cancelFollowUp` | /api/follow-ups … | strict schemas, identical | OK |
| `listAssignments` GET `/api/calling-assignments` | GET /calling-assignments | ListAssignmentsQuery → Page | OK (live) |
| `assignBusinesses` / `autofillAgent` (+Idem) / `getReassignImpact` / `reassignBusiness` / `unassignBusiness` | POST /calling-assignments/{assign,autofill,reassign-impact,reassign,unassign} | strict schemas, identical | OK |

### Deals / meetings / projects / tasks
| Frontend fn / caller | Backend route | Zod / response | Status |
|---|---|---|---|
| `DealsList` usePage GET `/api/deals` | GET /deals | ListDealsQuery → Page | OK (live) |
| `DealDetailView` GET `/deals/:id`, `/deals/:id/history` | GET /deals/:id, /:id/history | `{deal,access,exceptionRow?}`, `{items}` | OK |
| `runDealCommand` verbs signature, payment, remove-fact, closure-request/verify/reject, not-proceeding, reopen, finalize (+Idem, required) | POST /deals/:id/<verb> | strict schemas → `{deal}` | OK |
| `runDealCommand('developer')` — typed, but no dialog uses it | POST /deals/:id/developer (`deal.assign_developer`) | AssignDeveloperBody | **MISSING UI** (F-09) |
| — | GET /deals/developers | `{items:[{id,name}],total}` | MISSING caller (F-09) |
| `MeetingsView` / DealDetail useApi `meetingListPath` | GET /meetings | ListMeetingsQuery (range ≤ 62 d or dealId) → `{items}` (not paged) | OK; the frontend reads `{items}` |
| `scheduleMeeting` / `rescheduleMeeting` / `recordMeetingOutcome` / `cancelMeeting` | POST /meetings, PATCH /:id, POST /:id/{held,missed,cancel} | strict → `{meeting}` | OK |
| `ScheduleMeetingDrawer` GET `/api/employees?pageSize=100` (attendee picker) | GET /employees (Owner only) | | **MISMATCH** — 403 for Call Center and Developer (F-06) |
| — | GET /meetings/:id | | MISSING caller |
| projects list useApi / `ProjectBoard` GET `/projects/:id` | GET /projects, /projects/:id | `{…,workload,unprovisioned,policy}`, `{project,access}` | OK (live) |
| `changeProjectStatus` / `reopenProject` / `createProject` / `retryProvisioning` | POST /projects/:id/status, /:id/reopen, POST /projects, /:id/provision-retry | strict | OK |
| — | PATCH /projects/:id (name and dates), POST /projects/:id/developers | | MISSING UI (F-10) |
| tasks (useApi) / `createTask` / `updateTask` | GET /tasks?projectId, POST /tasks, PATCH /tasks/:id | → `{task}` | OK |
| — | GET /tasks/:id | | MISSING caller (harmless) |

### Work, targets, notifications, reports
| Frontend fn / caller | Backend route | Zod / response | Status |
|---|---|---|---|
| `listTargets` / `createTarget` / `updateTarget` | GET/POST /targets, PATCH /targets/:id | CreateTargetSchema / UpdateTargetSchema → TargetDto | OK |
| `getMyTargets` GET `/api/targets` (maps `territory/metric/currentValue/targetValue`) | GET /targets | Page<TargetDto> | OK (`?scope=self` is ignored by the backend) |
| `listWorkItems` / `createWorkItem` / `updateWorkItem` | GET/POST /work-items, PATCH /:id | WorkItemDto | OK |
| `getMyWorkList` GET `/api/work-items?limit=5` → expects `WorkItemDto{businessId,businessName,kind,detail,statusLabel,dueAt}` | GET /work-items → `{items:WorkItem{title,status,dueDate…}}` | `limit` ignored (`PageQuerySchema` non-strict) | **MISMATCH** (F-04) |
| `listNotifications` / `getUnreadCount` / `markNotificationRead` / `markAllNotificationsRead` | GET /notifications, /unread-count, POST /:id/read, /read-all | Page / `{unreadCount}` / `{ok}` / `{ok,markedCount}` | OK (live) |
| `listDeliveryMonitor` / `retryReminder` | GET /delivery-monitor, POST /reminders/:id/send-again | Page / `{ok,message}`; the UI sends `kind=all` (silently ignored) | OK |
| `getDashboardMetrics` GET `/api/dashboard` | GET /dashboard (`dashboard.owner.read`) | DashboardMetricsDto, period enum matches | OK — but called from screens every role can reach (F-07) |
| `listReports` GET `/api/reports` | GET /reports | `{items,total}`; ids rep-1..4 match | OK |
| `exportReport` raw `fetch` POST `/api/reports/export` `{report,format,from,to,totpCode}` | POST /reports/export | ExportQuerySchema; 403 `STEP_UP_REQUIRED` when there is no TOTP within 10 min | **MISMATCH** — UI never collects `totpCode`, error code discarded (F-04b) |
| `getExportUrl` (GET link builder) | GET /reports/export → 405 | | UNUSED-FE; it would 405 if used |

### Totals
- **Frontend calls with no backend route (would 404):** none found. Every frontend path resolves to a mounted route.
- **Backend routes with no frontend caller (24):**
  - auth: `/2fa/recovery-codes`, `/2fa/enrollment-tokens`, `/2fa/status`
  - employees: `GET /employees/:id`
  - roles: the `/api/roles/*` alias (5)
  - settings: `/settings/public`
  - attendance:
    - sessions: `GET /sessions`, `POST /sessions`, `GET /sessions/:id`, `/sessions/:id/resolve-review`
    - corrections: `GET /corrections/:id`
    - remote exceptions: `GET /remote-exceptions`, `POST /remote-exceptions`, `/remote-exceptions/:id/{approve,reject,revoke}`
    - settings: `/settings/test-office-check`
  - businesses: `/businesses/duplicate-check`, `DELETE /businesses/:id`
  - corrections: `/correction-requests/:id/resolve`
  - deals: `/deals/developers`, `/deals/:id/developer`
  - meetings: `GET /meetings/:id`
  - projects: `PATCH /projects/:id`, `/projects/:id/developers`
  - tasks: `GET /tasks/:id`
  - reports: `GET /reports/export`

---

## 2. Capabilities: `actions.ts` / `nav.ts` vs `access/matrix.ts`

The backend registry declares 117 actions. `/api/auth/me` returns the server list, and `useCapability` uses it whenever it is present. `ROLE_DEFAULTS` is used only as a fallback when that list is missing. So the **server matrix decides what the nav shows**, and the frontend defaults are stale.

| Action | Frontend `ROLE_DEFAULTS` | Backend registry | Effect |
|---|---|---|---|
| `dashboard.self.read` | ALL | in `AUTHZ_MATRIX` but **never registered** (no module declares it) | `can()` is always false; currently unused in the UI |
| `target.read` | owner, call_center | ALL | "Targets & Work Lists" (an Owner admin page) shows for Data Entry and Developer; the page then 403s on `/api/employees` and `/api/dashboard` |
| `business.list` | owner, DE, CC | + developer | Businesses nav shows for Developer |
| `category.list` | owner, DE | ALL | Categories admin page shows for CC and DEV |
| `correction.read` | owner, DE | ALL | "Correction Requests" (DE review queue) shows for CC and DEV (they see only their own requests) |
| `deal.read`, `meeting.read` | owner, developer | + call_center | Deals and Meetings nav shows for Call Center (live: 200) |
| matrix-only, intentionally unregistered | — | `auth.password_reset.assist`, `session.revoke`, `audit.export/update/delete` | no route; OK |

Other nav issues:
- Nav items with no `action` show for every role: Dashboard `/`, My Day, My Attendance. `/` is the Owner dashboard (F-07).
- `Opportunities` and `Do-not-call` are gated by `calling.queue.read`. The backend uses `call_attempt.list_opportunities` and `call_attempt.list_do_not_call`, which have the same roles today (owner, CC), so they are OK but could drift.
- All 24 nav `href` pages exist under `frontend/src/app`. `built` flags: only Notifications and Delivery Monitor carry `built: true`; nothing is `built: false`.

## 3. Auth plumbing

| Item | Finding |
|---|---|
| Session cookie | Backend: `udigity_session` in dev, `__Host-udigity_session` in prod (`config/index.ts:231`). `proxy.ts` checks both. httpOnly, cookie-only (no Bearer). OK |
| CSRF | Backend cookie `udigity_csrf` / `__Host-udigity_csrf` with value equal to the derived token (live: cookie == body `csrfToken`). Header `X-CSRF-Token` is checked in `authenticate`. Frontend `http.ts` sends `X-CSRF-Token` on every POST/PUT/PATCH/DELETE (cookie first, then the token remembered from `/me` or login). Missing header → live 403 `CSRF_FAILED`. OK, except F-12 |
| Origin check | Global `originCheck` on mutations against `APP_ORIGIN`. Works with the same-origin Next rewrite and with nginx. OK |
| Idempotency-Key | Sent wherever the backend requires it: business create, reservation acquire, call attempts, inbound rejection, deal commands. Also sent (harmlessly) where it is optional or ignored. No required-but-missing case found |
| 401 | `classifyError` → `/session-ended?reason=`. The reason mapping expects `ACCOUNT_DEACTIVATED`/`SESSION_REVOKED`, but the backend only ever sends `UNAUTHENTICATED`/`SESSION_EXPIRED`/`SESSION_INVALID` (plus `SESSION_ENDED` from 2FA lockout). So "deactivated" is never shown (F-13) |
| 403 | `PERMISSION_DENIED`/`FORBIDDEN_ROLE` → permission view; `HIDDEN_BY_POLICY` → hidden view; `OWNER_2FA_REQUIRED` handled. `CSRF_FAILED` and `STEP_UP_REQUIRED` fall into "permission denied" (F-12, F-04b) |
| 409 | `VERSION_CONFLICT` with `details.currentVersion`/`current`. Employees also put `currentVersion` at the top level for backward compatibility. Handled. `DUPLICATE_BLOCKED`/`CONFLICT_DUPLICATE` (similar names) handled in `businesses.ts` |
| Proxy redirect | `proxy.ts` calls `INTERNAL_API_URL/api/auth/me` with the cookie (2.5 s timeout, fail-open), then `resolveGuardRedirect`. Pending-2FA Owners are confined to the 2FA steps. Stale cookies are deleted, but `response.cookies.delete('__Host-…')` without `Secure`/`path=/` is ignored by browsers in prod (F-15) |
| Dev API base | Browser calls are same-origin `/api/*`; the Next rewrite sends them to `INTERNAL_API_URL` (default `http://localhost:5000`). CORS is restricted to `APP_ORIGIN` with credentials. OK |
| Prod API base | nginx sends `/api/` straight to the backend (zone `api` 20 r/s) and `/api/auth/` to the backend (zone `auth` **10 r/min**). Health endpoints are blocked at the edge. The Next rewrite and the proxy use `INTERNAL_API_URL=http://backend:5000`. Routing is OK, but see F-11 for the rate limit |

---

## 4. Findings

| ID | Severity | file:line | Finding | Fix |
|---|---|---|---|---|
| F-01 | **High** | `frontend/src/app/settings/page.tsx:28,78,117,129` vs `backend/src/modules/attendance/time.ts:10` | The working-hours form uses lowercase day ids (`'mon'…`). The backend `WEEKDAYS` enum is `'SUN'…'SAT'`. **Every save of attendance settings fails with 400** (verified live). Loaded values (`["MON",…]`) never match the toggle ids, so the form also shows no days selected. | Use the backend enum values as ids (or map both ways). Add a contract test. |
| F-02 | **High** | `frontend/src/app/settings/page.tsx:170-174` vs `backend/src/shared/flags.ts` (no `company.name`) | The company-info save PATCHes `company.name`, which is not a registered setting. **Live: 400 `{"company.name":["Unknown setting"]}`**, so the Company tab can never save. | Either register `company.name` (SET, editable) in `POLICY_FLAGS`, or remove the field from the UI. |
| F-03 | **High** | `frontend/src/app/settings/page.tsx:131-145` | The attendance PUT hardcodes `holidays: []`, `summaryRequired: false`, `summaryMinLength: 0`, `missingCheckoutFlagHours: 14` and a fixed `reason`. Once F-01 is fixed, every save will **silently wipe holidays and the summary/missing-checkout policy** (the current version has summaryRequired=true, minLength=10, flag hours=6). | Send back the loaded `current.*` values for fields the form does not edit, or add those fields to the form. |
| F-04 | **High** | `frontend/src/lib/api/myDay.ts:50-52`, `components/attendance/MyDayCards.tsx:266-269` vs `backend/src/modules/work/schemas.ts` (`WorkItemDto`) | My Day expects work items `{businessId,businessName,kind,detail,statusLabel,dueAt}`, but `/api/work-items` returns `{title,status,dueDate,sourceType,…}`. Rows render blank names and labels. `limit=5` is ignored (25 are returned). | Map the `WorkItem` fields (title→name, status→label, dueDate→dueAt) in `getMyWorkList`, or add a dedicated `/api/work-items/me` DTO. Pass `pageSize=5`. |
| F-04b | **High** | `frontend/src/lib/api/reports.ts:127-151`, `app/reports/page.tsx:56-75` vs `backend/src/modules/reports/service.ts:221-233` | Export needs a TOTP step-up within 10 minutes (EX-2). The UI never asks for `totpCode`, and the raw `fetch` throws `Export failed with HTTP 403` without the body. **Exports fail for any Owner who signed in more than 10 minutes ago**, with no way to recover. | Parse the error body. On `STEP_UP_REQUIRED` (or `INVALID_2FA_TOKEN`), prompt for a 6-digit code and retry with `totpCode`. Route this through `apiFetch` so `ApiError` codes are kept. |
| F-05 | **High** | `frontend/src/lib/api/identity.ts:11,15` (paths only), `components/auth/EnrollmentFlow.tsx:89-96` | A new Owner must enter a 43-character enrollment token to set up 2FA, but **no UI issues tokens** (`POST /api/auth/2fa/enrollment-tokens` has no caller). Recovery-code regeneration (`/2fa/recovery-codes`) is also unreachable. Only the bootstrap CLI can onboard Owners. | Add an "Issue 2FA enrollment token" action (Owner step-up) in the Employee drawer and a "Regenerate recovery codes" action on the profile page. |
| F-06 | **High** | `frontend/src/components/delivery/ScheduleMeetingDrawer.tsx:62-65` | The attendee picker loads `GET /api/employees?pageSize=100`, which is Owner-only. Call Center and Developer have `meeting.create` but get **403, an empty picker, and cannot schedule** (`attendeeIds.min(1)`). | Add a narrow lookup endpoint (for example `GET /api/meetings/attendee-options`, or reuse `/api/deals/developers`) guarded by `meeting.create`. |
| F-07 | Medium | `frontend/src/lib/nav.ts` (Dashboard, no `action`), `app/page.tsx:37-44`, `app/targets/page.tsx:84-85` | The Dashboard `/` is shown to every role but calls `/api/dashboard`, `/api/employees` and `/api/access/roles` (all Owner-only), so non-Owners get 403s and an empty dashboard. The Targets page (visible to all roles via `target.read`) also calls Owner-only `/api/dashboard` and `/api/employees`. | Gate Dashboard with `dashboard.owner.read` (or send non-Owners to `/my-day`). Split Targets into an Owner admin view and a self view. Align `ROLE_DEFAULTS` with the matrix. |
| F-08 | Medium | `frontend/src/app/page.tsx:44` vs `components/owner/EmployeeDrawer.tsx:108,309`, `app/settings/roles/page.tsx:91` | **SWR cache-key collision.** `'/api/access/roles'` is cached as `RoleSummary[]` (via `listRoles()`) on the dashboard, and as `{roles:[…]}` (via `swrFetcher`) elsewhere. After visiting `/`, the role dropdowns read `.roles` of an array and show empty. `'/api/employees'` is shared with different page sizes (100 vs 25). | Use one fetcher per key (always the raw response, or include the shape in the key). Use the `employeesListKey(q)` helper everywhere. |
| F-09 | Medium | `frontend/src/components/delivery/DealDialogs.tsx:52-73` | There is no dialog for the `developer` verb. `POST /api/deals/:id/developer` and `GET /api/deals/developers` are unused, so deals with "developer not assigned" cannot be fixed from the UI. | Add an "Assign developer" dialog backed by `/api/deals/developers`. |
| F-10 | Medium | `frontend/src/lib/api/projects.ts:6-13` | `projectsPaths.developers` is defined but never called. `PATCH /api/projects/:id` (name and dates) has no client function. Project developers and schedule cannot be edited. | Add client functions and the Owner UI, or drop the routes. |
| F-11 | Medium | `devops/nginx/nginx.conf:35`, `conf.d/udigity.conf:36-41`; `frontend/src/lib/auth.tsx:118` | The nginx `auth` zone (10 req/min per IP, burst 10) also covers `GET /api/auth/me`, which SWR revalidates on every focus and after each mutation. Office staff share one NAT IP, which the office-IP check requires, so `/me` will hit 429 and `meFetcher` throws "Failed to fetch session". | Exempt `location = /api/auth/me` (and `/2fa/status`) into the `api` zone. Keep the strict zone for login, 2FA and reset only. |
| F-12 | Medium | `frontend/src/lib/errorRouting.ts:57` | 403 `CSRF_FAILED` (for example after a cookie rotation) and `STEP_UP_REQUIRED` are classified as "permission denied". | Treat `CSRF_FAILED` as: refresh `/api/auth/me`, then retry once. Give `STEP_UP_REQUIRED` its own route kind. |
| F-13 | Low | `frontend/src/lib/errorRouting.ts:20-30` vs `backend/src/middleware/auth.ts:56-58,116-123` | The frontend maps `ACCOUNT_DEACTIVATED`/`SESSION_REVOKED`, which the backend never sends. A deactivated account gets `SESSION_INVALID` and is shown as "revoked". `SESSION_ENDED` (2FA lockout) maps to "expired". | Have the backend send distinct codes (`ACCOUNT_DEACTIVATED`, `SESSION_REVOKED`), add them to `ErrorCode`, and map `SESSION_ENDED`. |
| F-14 | Low | `backend/src/modules/identity/routes.ts:887` | A wrong current password on `/password/change` returns **401** `INVALID_CREDENTIALS`. The profile page handles it locally, but a 401 there means "session ended" to any generic handler, and SWR `onError` would redirect if the call were ever moved to a hook. | Return 400 `REAUTH_FAILED`, consistent with `/2fa/enroll/start`. |
| F-15 | Low | `frontend/src/proxy.ts:84-86` | `response.cookies.delete(name)` for `__Host-` cookies omits `Secure` and `path=/`, so browsers ignore the deletion in prod. Each request then repeats the `/me` round-trip. | Use `response.cookies.set(name, '', { path: '/', secure: true, maxAge: 0 })`. |
| F-16 | Low | `frontend/src/lib/api/attendance.ts:37` vs `backend/src/modules/attendance/schemas.ts` (`VERIFICATION_MODES`) | The frontend `VerificationMode` type (`none\|ip\|location\|either\|both`) differs from the backend (`ip\|geofence\|ipOrLocation\|ipAndLocation\|disabled`). It is masked by `\| string`. | Mirror the backend enum. |
| F-17 | Low | `frontend/src/lib/actions.ts` (`ROLE_DEFAULTS`) vs registry | The fallback defaults disagree with the matrix for 6 actions (table in §2). `dashboard.self.read` is in the matrix but no module registers it. | Generate `ROLE_DEFAULTS` from `AUTHZ_MATRIX`, or add a CI diff test. Register `dashboard.self.read` or remove it. |
| F-18 | Low | `frontend/src/lib/hooks/useApi.ts:26` | `useApi` polls every 4 s by default on every screen, so N tabs × hooks hit the per-IP `api` zone (20 r/s) behind the office NAT. | Make polling opt-in per screen (queue and workspace only). |
| F-19 | Info | `backend/src/modules/access/module.ts` | `/api/roles/*` duplicates `/api/access/roles/*` with no caller. `GET /reports/export` exists only to return 405. `createEmployee` and remote requests send `Idempotency-Key`, which the backend ignores. | Remove the alias, or document it. Optionally add `idempotent()` to employee create. |
| F-20 | Info | `backend/src/modules/attendance/routes.ts:131`, `:204-224` | Owner remote-exception management (grant, approve, reject, revoke), retroactive sessions and `resolve-review` are built in the backend with no UI. | Confirm scope. Build the OWN screens or hide the routes behind a flag. |

## 5. Live check summary (2026-10-28, `udigity_test_r4`)

- **Role results.** All 37 GETs answered with the documented shapes.
  - Owner: 37/37 returned 200.
  - Data Entry, Call Center, Developer: 403 `FORBIDDEN_ROLE` or `PERMISSION_DENIED` exactly where the matrix denies.
  - Notable allows: Call Center can read deals, meetings and `/deals/developers`; Developer can read projects, deals and meetings.
- **List shape.** Every list returns `{items,page,pageSize,total}` (plus extras), except `/api/meetings` (`{items}`) and `/api/reports` (`{items,total}`). The frontend types for both match.
- **Confirmed by live calls:**

  | Finding | Request | Result |
  |---|---|---|
  | F-01 | PUT `/attendance/settings` with lowercase days | 400 |
  | F-02 | PATCH `/settings` with `company.name` | 400 `Unknown setting` |
  | F-12 | POST without CSRF header | 403 `CSRF_FAILED` |
  | Contract check | — | CSRF cookie value == `csrfToken` |
