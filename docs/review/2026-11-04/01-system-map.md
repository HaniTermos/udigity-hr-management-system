# 01 System map (Phase 1, Inventory)

Review: Udigity Management System, full-system review 2026-11-04. Read-only static inventory (file reads, grep, and local Node scripts that only read source files). No build, server, database or test was run. Baseline: branch `feat/launch-readiness`, HEAD `cab5ec9`, plus the uncommitted Owner changes in `frontend/src/components/delivery/ProjectBoard.tsx` and `frontend/src/lib/api/projects.ts` (read as they stand).

Counts: 38 frontend pages (`frontend/src/app/**/page.tsx`); 177 backend route rows (7 test-only, 1 public health; 13 deal commands and 3 remote-exception verbs expanded); 44 migrations; 56 tables plus 1 view; 12 job kinds (11 registered); 43 outbox event names; 124 matrix actions.

Role keys used below: `owner`, `data_entry`, `call_center`, `developer` (system roles). Custom roles can only hold matrix rows flagged `grantable` (see section 6).

---

## 1. Screen and route inventory

Nav roles come from `frontend/src/lib/nav.ts` (action) mapped to the grant list in `backend/src/modules/access/matrix.ts`. "All" = every signed-in role. Routes not listed in nav are reached by links or deep links only. No nav item has `built: false`.

| Route | Title / purpose | Nav item and roles that see it | Main components (`frontend/src/components/...`) |
|---|---|---|---|
| `/` | Dashboard: KPIs and charts, period filter | Dashboard · Owner (`dashboard.owner.read`) | `dashboard/DashboardCharts`, `states/ApiErrorView` |
| `/my-day` | My Day: today's work, attendance cards, breaks | My Day · All (no action) | `attendance/MyDayCards`, `BreakTimer`, `CheckInFlow`, `CheckOutFlow` |
| `/my-day/check-in` | Check-in as a focused page | Not in nav (deep link) | `attendance/CheckInFlow` |
| `/my-day/check-out` | Check-out as a focused page | Not in nav (deep link) | `attendance/CheckOutFlow` |
| `/my-attendance` | Own attendance history and corrections | My Attendance · All | `attendance/AttendanceTable`, `CorrectionDrawer` |
| `/notifications` | Notification inbox | Notifications · All (`notification.list`) | `ui/Tabs`, `notifications/format` |
| `/attendance` | Redirects to `/attendance/monitor` | Not in nav | none |
| `/attendance/monitor` | SCR-OWN-004 attendance monitoring, exception alerts | Attendance · Owner (`attendance.correction.review`) | `owner/AttendanceMonitor` |
| `/attendance/corrections` | SCR-OWN-005 correction review queue | Not in nav (Owner) | `owner/AttendanceCorrections` |
| `/employees` | Employee directory and drawer | Employees · Owner (`employee.list`) | `owner/EmployeeTable`, `owner/EmployeeDrawer` |
| `/targets` | Targets and work lists (Owner sets, users see own) | Targets & Work Lists · Owner (`target.set`) | inline in `app/targets/page.tsx` |
| `/calling-assignments` | SCR-OWN-007 assignments, reassign-impact dialog | Calling Assignments · Owner (`calling.assign`) | `owner/CallingAssignments`, `owner/ReassignImpactDialog` |
| `/reports` | Reports and data exports (step-up for export) | Reports & Exports · Owner (`report.read`) | `owner/StepUpDialog`, `states/ApiErrorView` |
| `/delivery-monitor` | Email and reminder delivery monitor, retry | Delivery Monitor · Owner (`reminder.monitor.read`) | inline in `app/delivery-monitor/page.tsx` |
| `/audit` | Audit event log | Audit · Owner (`audit.read`) | `ui/Table`, `ui/Drawer`, `owner/format`; Export button disabled |
| `/settings` | Settings: working hours, company info, enrollment tokens | Settings · Owner (`settings.read`) | `owner/EnrollmentTokenPanel`, `states/ApiErrorView` |
| `/settings/roles` | Roles and permissions (custom roles) | Roles & Permissions · Owner (`role.list`) | `settings/roles/RoleEditor.tsx`, `settings/roles/roleMeta.ts` |
| `/businesses` | Business directory (server scope filter) | Businesses · All (`business.list`) | `businesses/BusinessTable`, `BusinessFilters`, `PageHeader` |
| `/businesses/new` | Create business; duplicates blocked | Add Business · Owner, Data Entry (`business.create`) | `businesses/BusinessForm`, `DuplicateBlocked` |
| `/businesses/[id]` | Business detail, corrections, history | Not in nav (from directory, queue, search) | `businesses/BusinessDetailView`, `SubmitCorrectionDrawer` |
| `/businesses/[id]/edit` | Edit business with field diff (SHR-014) | Not in nav | `businesses/BusinessForm`, `DuplicateBlocked` |
| `/corrections` | Correction request queue | Correction Requests · All (`correction.read`, scoped) | `businesses/CorrectionsTable`, `ResolveCorrectionDrawer` |
| `/categories` | Category list and management | Categories · All (`category.list`; manage = Owner) | `businesses/CategoryTable`, `CategoryPanels` |
| `/queue` | Calling queue (buckets and counts) | Calling Queue · Owner, Call Center (`calling.queue.read`) | `calling/QueueBoard` |
| `/queue/[businessId]` | Contact workspace, log attempt, reservation | Not in nav (from queue) | `calling/ContactWorkspace`, `LogAttemptPanel`, `QueueRail`, `businesses/SubmitCorrectionDrawer` |
| `/calendar` | Follow-ups and calendar (SCR-CC-004/006) | Follow-ups & Calendar · Owner, Call Center (`follow_up.read`) | `calling/FollowUps` |
| `/opportunities` | Opportunities and handoffs, assign developer | Opportunities & Handoffs · Owner (`call_attempt.list_opportunities`) | `calling/Opportunities` |
| `/do-not-call` | Do-not-call list; reopen (Owner) | Do-not-call List · Owner, Call Center (`calling.queue.read`) | `calling/CallingPageHeader`, `ui/Table` |
| `/search` | Business search results (scoped by server) | Not in nav | `businesses/SearchResults`, `businesses/PageHeader` |
| `/deals` | Deals list | Deals · Owner, Developer (`deal.read`) | `delivery/DealsList`, `DeliveryFrame` |
| `/deals/[id]` | Deal detail, commands, history, call notes | Not in nav (from deals and opportunities) | `delivery/DealDetailView`, `DealDialogs`, `RelevantCallNotes` |
| `/meetings` | Meetings and calendar | Meetings & Calendar · Owner, Call Center, Developer (`meeting.read`) | `delivery/MeetingsView`, `MeetingDrawer`, `ScheduleMeetingDrawer` |
| `/projects` | Projects list | Projects · Owner, Developer (`project.read`) | `delivery/ProjectsList` |
| `/projects/[id]` | Project board, tasks, developers | Not in nav (from projects and deals) | `delivery/ProjectBoard`, `TaskDrawer`, `RecordDeliveredDialog` |
| `/profile` | My profile: phone, password change, revoke sessions | "More" tab and profile link · All | inline in `app/profile/page.tsx`, `ui/Dialog` |
| `/login` | Sign in, 2FA challenge, enrollment, recovery | Public | `auth/SignInForm`, `TwoFactorChallenge`, `EnrollmentFlow`, `RecoverAccess`, `AuthShell` |
| `/reset-password` | Request and complete password reset (token) | Public | `auth/AuthShell` (inline forms) |
| `/session-ended` | Session ended notice | Public | `states/SessionEnded` |

Notes:
- Visibility is client-side only (nav filter and `/api/auth/me` capabilities). Server checks every request (section 2).
- Dev-only persona switcher and login quick-fill: `components/layout/Header.tsx:142`, `app/login/page.tsx:147` (section 8).

---

## 2. API inventory

Mounts (`backend/src/modules/index.ts`, module `module.ts` files): `/api/access`, `/api/audit-events`, `/api/settings`, `/api/calling-assignments`, `/api/attendance`, `/api/businesses`, `/api/categories`, `/api/search`, `/api/calling`, `/api/follow-ups`, `/api/correction-requests`, `/api/deals`, `/api/employees`, `/api/auth`, `/api/meetings`, `/api/notifications`, `/api/delivery-monitor`, `/health/worker`, `/api/projects`, `/api/tasks`, `/api/reports`, `/api/dashboard`, `/api/reservations`, `/api/targets`, `/api/work-items`. The `duplicates` module has no mounts. `/api/test-support/*` mounts only when `NODE_ENV=test`.

Middleware legend: `authenticate` = session cookie check (`middleware/auth.ts`). `requireAction(x)` = access guard for matrix action x (`shared/access.ts`); `requireActionFor` = picks the action per request; `guard(x)` and `act(x)` are the same guard under other names used in some modules. `authenticate(router-level)` = `router.use(authenticate)` in the router (businesses, categories, search, corrections). `idempotent(op)` = `Idempotency-Key` required; `idempotent(op, optional)` = accepted but not required. `rate-limit(...)` = per-route limiter (see below). `breaks-flag` = route returns 404 when `attendance.breaksEnabled` is off.

Flagged routes (no `authenticate` or no `requireAction`), all intended:
- No `authenticate` (public or ops): `POST /api/auth/login`, `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/complete` (rate-limited), `GET /health/worker` (nginx returns 404 for it), `/api/test-support/*` and `/api/test-support/mail` (test only).
- `authenticate` but no `requireAction` (session-only steps, allowlisted in `shared/routeGuard.ts:37-53`): `POST /api/auth/2fa/verify`, `/2fa/recover`, `/2fa/enroll/start`, `/2fa/enroll/confirm`, `GET /api/auth/2fa/status`, `POST /api/auth/logout`, `GET /api/auth/me`.
- No other route lacks a guard. The startup check `enforceRouteGuards` refuses to start in production if one does (`modules/index.ts`).

Step-up and 2FA:
- Report export needs a TOTP step-up in the last 10 minutes: checked inside the service (`modules/reports/service.ts:336`, `hasRecentStepUp` in `modules/identity/routes.ts:363`), not as route middleware.
- Owner-only "admin" rows need completed 2FA (matrix `admin` flag, enforced in the access engine; the engine itself was not traced in this pass).

Rate limits: `authLimiter` (login, all `/2fa/*`, password change, password-reset; config `AUTH_RATE_LIMIT_MAX` 20 per 15 min); `perUserLimiter` on duplicate-check (30 per 10 min), duplicate-review-requests, search; `renewLimiter` (reservation renew); `exportLimiter` (report export, 20 per 10 min); global `apiReadLimiter` for GET under `/api` (`shared/rateLimit.ts`); nginx zones (section 7).

Route table (generated from source; service = first service call in the handler):

| # | Method | Full path | Middleware (order as in code) | Service / handler | Source |
|---|---|---|---|---|---|
| 1 | GET | `/api/access/permissions` | authenticate + requireAction(permission.list) | dynamicService.listPermissionsCatalog | access/routes.ts:41 |
| 2 | GET | `/api/access/roles` | authenticate + requireAction(role.list) | dynamicService.listRoles | access/routes.ts:50 |
| 3 | GET | `/api/access/roles/:id` | authenticate + requireAction(role.read) | dynamicService.getRole | access/routes.ts:59 |
| 4 | POST | `/api/access/roles` | authenticate + requireAction(role.create) + idempotent(role.create, optional) | dynamicService.createRole | access/routes.ts:69 |
| 5 | PATCH | `/api/access/roles/:id` | authenticate + requireAction(role.update) + idempotent(role.update, optional) | dynamicService.updateRole | access/routes.ts:82 |
| 6 | DELETE | `/api/access/roles/:id` | authenticate + requireAction(role.delete) | dynamicService.deleteRole | access/routes.ts:96 |
| 7 | GET | `/api/audit-events` | authenticate + requireAction(audit.read) | listAudit (admin/audit) | admin/routes.ts:18 |
| 8 | GET | `/api/settings` | authenticate + requireAction(settings.read) | getSettingsView | admin/routes.ts:34 |
| 9 | GET | `/api/settings/public` | authenticate + requireAction(settings.read_public) | getPublicSettingsView | admin/routes.ts:43 |
| 10 | GET | `/api/settings/flags` | authenticate + requireAction(settings.read) | getFlagsView | admin/routes.ts:51 |
| 11 | PATCH | `/api/settings` | authenticate + requireAction(settings.update) | updateSettings (audited) | admin/routes.ts:59 |
| 12 | GET | `/api/calling-assignments` | authenticate + requireAction(calling.assign) | list (assignment/service) | assignment/routes.ts:22 |
| 13 | POST | `/api/calling-assignments/assign` | authenticate + requireAction(calling.assign) + idempotent(calling.assign, optional) | assign | assignment/routes.ts:27 |
| 14 | POST | `/api/calling-assignments/reassign-impact` | authenticate + requireAction(calling.assign) | reassignImpact | assignment/routes.ts:33 |
| 15 | POST | `/api/calling-assignments/reassign` | authenticate + requireAction(calling.reassign) | reassign | assignment/routes.ts:38 |
| 16 | POST | `/api/calling-assignments/unassign` | authenticate + requireAction(calling.unassign) | unassign | assignment/routes.ts:43 |
| 17 | POST | `/api/calling-assignments/autofill` | authenticate + requireAction(calling.autofill) + idempotent(calling.autofill, optional) | autofill | assignment/routes.ts:48 |
| 18 | GET | `/api/attendance/me/today` | authenticate + requireAction(attendance.read) | service.getToday | attendance/routes.ts:60 |
| 19 | GET | `/api/attendance/me/sessions` | authenticate + requireAction(attendance.read) | service.mySessions | attendance/routes.ts:64 |
| 20 | POST | `/api/attendance/check-in` | authenticate + requireAction(attendance.check_in) + idempotent(attendance.check_in, optional) | service.checkIn | attendance/routes.ts:69 |
| 21 | POST | `/api/attendance/check-out` | authenticate + requireAction(attendance.check_out) + idempotent(attendance.check_out, optional) | service.checkOut | attendance/routes.ts:84 |
| 22 | POST | `/api/attendance/breaks/start` | authenticate + requireAction(attendance.break.start) + idempotent(attendance.break.start, optional) + breaks-flag | service.startBreak | attendance/routes.ts:96 |
| 23 | POST | `/api/attendance/breaks/end` | authenticate + requireAction(attendance.break.end) + idempotent(attendance.break.end, optional) + breaks-flag | service.endBreak | attendance/routes.ts:102 |
| 24 | GET | `/api/attendance/breaks/active` | authenticate + requireAction(attendance.break.read) + breaks-flag | service.getActiveBreak | attendance/routes.ts:108 |
| 25 | GET | `/api/attendance/sessions/:id/breaks` | authenticate + requireAction(attendance.break.read) + breaks-flag | service.listSessionBreaks | attendance/routes.ts:113 |
| 26 | GET | `/api/attendance/sessions` | authenticate + requireAction(attendance.read) | service.listSessions | attendance/routes.ts:121 |
| 27 | POST | `/api/attendance/sessions` | authenticate + requireAction(attendance.retroactive_create) + idempotent(attendance.retroactive_create, optional) | service.createRetroactive | attendance/routes.ts:126 |
| 28 | GET | `/api/attendance/sessions/:id` | authenticate + requireAction(attendance.read) | service.getSession | attendance/routes.ts:131 |
| 29 | POST | `/api/attendance/sessions/:id/adjust` | authenticate + requireAction(attendance.adjust) + idempotent(attendance.adjust, optional) | service.adjustSession | attendance/routes.ts:136 |
| 30 | POST | `/api/attendance/sessions/:id/resolve-review` | authenticate + requireAction(attendance.failed_checkout.review) | service.resolveReview | attendance/routes.ts:142 |
| 31 | POST | `/api/attendance/corrections` | authenticate + requireAction(attendance.correction.request) + idempotent(attendance.correction.request, optional) | service.requestCorrection | attendance/routes.ts:150 |
| 32 | GET | `/api/attendance/corrections` | authenticate + requireAction(attendance.read) | service.listCorrections | attendance/routes.ts:155 |
| 33 | GET | `/api/attendance/corrections/:id` | authenticate + requireAction(attendance.read) | service.getCorrection | attendance/routes.ts:160 |
| 34 | POST | `/api/attendance/corrections/:id/approve` | authenticate + requireAction(attendance.correction.review) + idempotent(attendance.correction.approve, optional) | service.approveCorrection | attendance/routes.ts:165 |
| 35 | POST | `/api/attendance/corrections/:id/reject` | authenticate + requireAction(attendance.correction.review) + idempotent(attendance.correction.reject, optional) | service.rejectCorrection | attendance/routes.ts:171 |
| 36 | POST | `/api/attendance/corrections/:id/withdraw` | authenticate + requireAction(attendance.correction.request) | service.withdrawCorrection | attendance/routes.ts:177 |
| 37 | GET | `/api/attendance/overview` | authenticate + requireAction(attendance.overview.read) | service.overview | attendance/routes.ts:185 |
| 38 | GET | `/api/attendance/settings` | authenticate + requireActionFor(settings.read or attendance.read) | service.getSettingsView | attendance/routes.ts:194 |
| 39 | PUT | `/api/attendance/settings` | authenticate + requireAction(settings.update) | service.putSettings | attendance/routes.ts:203 |
| 40 | POST | `/api/attendance/settings/test-office-check` | authenticate + requireAction(settings.update) | service.testOfficeCheck | attendance/routes.ts:208 |
| 41 | GET | `/api/attendance/employees/:id/schedule` | authenticate + requireAction(settings.read) | service.getEmployeeSchedule | attendance/routes.ts:215 |
| 42 | PUT | `/api/attendance/employees/:id/schedule` | authenticate + requireAction(settings.update) | service.setEmployeeSchedule | attendance/routes.ts:220 |
| 43 | GET | `/api/attendance/days-off` | authenticate + requireAction(attendance.days_off.manage) | service.listDaysOff | attendance/routes.ts:228 |
| 44 | POST | `/api/attendance/days-off` | authenticate + requireAction(attendance.days_off.manage) + idempotent(attendance.days_off.create, optional) | service.createDayOff | attendance/routes.ts:233 |
| 45 | POST | `/api/attendance/days-off/:id/cancel` | authenticate + requireAction(attendance.days_off.manage) | service.cancelDayOff | attendance/routes.ts:238 |
| 46 | GET | `/api/attendance/remote-exceptions` | authenticate + requireAction(attendance.read) | service.listRemote | attendance/routes.ts:246 |
| 47 | POST | `/api/attendance/remote-exceptions` | authenticate + requireAction(attendance.remote_exception.grant) | service.grantRemote | attendance/routes.ts:251 |
| 48 | POST | `/api/attendance/remote-exceptions/requests` | authenticate + requireAction(attendance.remote_exception.request) | service.requestRemote | attendance/routes.ts:256 |
| 49 | POST | `/api/attendance/remote-exceptions/:id/approve` | authenticate + requireAction(attendance.remote_exception.grant) | service.decideRemote | attendance/routes.ts:262 (loop) |
| 50 | POST | `/api/attendance/remote-exceptions/:id/reject` | authenticate + requireAction(attendance.remote_exception.grant) | service.decideRemote | attendance/routes.ts:262 (loop) |
| 51 | POST | `/api/attendance/remote-exceptions/:id/revoke` | authenticate + requireAction(attendance.remote_exception.grant) | service.decideRemote | attendance/routes.ts:262 (loop) |
| 52 | GET | `/api/businesses` | authenticate(router-level) + requireAction(business.list) | service.listBusinesses | businesses/routes.ts:65 |
| 53 | POST | `/api/businesses/duplicate-check` | authenticate(router-level) + requireAction(business.duplicate_check) + rate-limit(duplicate-check) | service.duplicateCheck | businesses/routes.ts:74 |
| 54 | POST | `/api/businesses/duplicate-review-requests` | authenticate(router-level) + requireAction(business.duplicate_review_request) + rate-limit(duplicate-review) | service.requestDuplicateReview | businesses/routes.ts:86 |
| 55 | POST | `/api/businesses` | authenticate(router-level) + requireAction(business.create) + idempotent(business.create) | service.runBusinessCommand | businesses/routes.ts:97 |
| 56 | GET | `/api/businesses/:id` | authenticate(router-level) + requireAction(business.read) | service.getBusinessDetail | businesses/routes.ts:109 |
| 57 | PATCH | `/api/businesses/:id` | authenticate(router-level) + requireAction(business.update) | service.runBusinessCommand | businesses/routes.ts:121 |
| 58 | POST | `/api/businesses/:id/archive` | authenticate(router-level) + requireAction(business.archive) | service.runBusinessCommand | businesses/routes.ts:132 |
| 59 | POST | `/api/businesses/:id/restore` | authenticate(router-level) + requireAction(business.restore) | service.runBusinessCommand | businesses/routes.ts:145 |
| 60 | DELETE | `/api/businesses/:id` | authenticate(router-level) + requireAction(business.delete) | inline: throws (business.delete granted to nobody) | businesses/routes.ts:161 |
| 61 | GET | `/api/businesses/:id/history` | authenticate(router-level) + requireAction(business.history.read) | service.getHistory | businesses/routes.ts:169 |
| 62 | GET | `/api/categories` | authenticate(router-level) + requireAction(category.list) | service.listCategories | businesses/routes.ts:198 |
| 63 | POST | `/api/categories` | authenticate(router-level) + requireAction(category.create) | service.createCategory | businesses/routes.ts:207 |
| 64 | PATCH | `/api/categories/:id` | authenticate(router-level) + requireAction(category.rename) | service.renameCategory | businesses/routes.ts:216 |
| 65 | POST | `/api/categories/:id/deactivate` | authenticate(router-level) + requireAction(category.deactivate) | service.deactivateCategory | businesses/routes.ts:226 |
| 66 | GET | `/api/search` | authenticate(router-level) + requireAction(business.search) + rate-limit(search) | service.searchBusinesses | businesses/routes.ts:243 |
| 67 | GET | `/api/calling/queue` | authenticate + requireAction(calling.queue.read) | queue | calls/routes.ts:55 |
| 68 | GET | `/api/calling/businesses/:id/workspace` | authenticate + requireAction(calling.queue.read) | workspace | calls/routes.ts:59 |
| 69 | POST | `/api/calling/attempts` | authenticate + requireAction(call.log_attempt) + idempotent(calling.attempt) | logAttempt | calls/routes.ts:67 |
| 70 | POST | `/api/calling/attempts/inbound-rejection` | authenticate + requireAction(call.log_attempt) + idempotent(calling.inbound_rejection) | logInboundRejection | calls/routes.ts:75 |
| 71 | GET | `/api/calling/do-not-call` | authenticate + requireAction(call_attempt.list_do_not_call) | doNotCall | calls/routes.ts:80 |
| 72 | GET | `/api/calling/opportunities` | authenticate + requireAction(call_attempt.list_opportunities) | listOpportunityItems | calls/routes.ts:84 |
| 73 | POST | `/api/calling/businesses/:id/reopen` | authenticate + requireAction(business.reopen_rejected) | reopenRejected | calls/routes.ts:88 |
| 74 | POST | `/api/calling/businesses/:id/requeue` | authenticate + requireAction(business.requeue) | requeueAccepted | calls/routes.ts:94 |
| 75 | GET | `/api/follow-ups` | authenticate + requireAction(follow_up.read) | listFollowUpItems | calls/routes.ts:105 |
| 76 | POST | `/api/follow-ups` | authenticate + requireAction(follow_up.create) + idempotent(follow_up.create, optional) | createFollowUp | calls/routes.ts:109 |
| 77 | PATCH | `/api/follow-ups/:id` | authenticate + requireAction(follow_up.reschedule) | updateFollowUp | calls/routes.ts:115 |
| 78 | POST | `/api/follow-ups/:id/complete` | authenticate + requireAction(follow_up.complete) | completeFollowUp | calls/routes.ts:121 |
| 79 | POST | `/api/follow-ups/:id/cancel` | authenticate + requireAction(follow_up.cancel) | cancelFollowUp | calls/routes.ts:127 |
| 80 | GET | `/api/correction-requests` | authenticate(router-level) + requireAction(correction.read) | service.listCorrections | corrections/routes.ts:35 |
| 81 | POST | `/api/correction-requests` | authenticate(router-level) + requireAction(correction.submit) | service.submitCorrection | corrections/routes.ts:44 |
| 82 | GET | `/api/correction-requests/:id` | authenticate(router-level) + requireAction(correction.read) | service.getCorrection | corrections/routes.ts:54 |
| 83 | POST | `/api/correction-requests/:id/start-review` | authenticate(router-level) + requireAction(correction.review) | service.startReview | corrections/routes.ts:62 |
| 84 | POST | `/api/correction-requests/:id/release` | authenticate(router-level) + requireAction(correction.review) | service.releaseReview | corrections/routes.ts:73 |
| 85 | POST | `/api/correction-requests/:id/resolve` | authenticate(router-level) + requireAction(correction.apply) | service.resolveCorrection | corrections/routes.ts:84 |
| 86 | POST | `/api/correction-requests/:id/reject` | authenticate(router-level) + requireAction(correction.reject) | service.rejectCorrection | corrections/routes.ts:95 |
| 87 | POST | `/api/correction-requests/:id/close-no-change` | authenticate(router-level) + requireAction(correction.close) | service.closeNoChange | corrections/routes.ts:106 |
| 88 | POST | `/api/correction-requests/:id/withdraw` | authenticate(router-level) + requireAction(correction.withdraw) | service.withdrawCorrection | corrections/routes.ts:117 |
| 89 | GET | `/api/deals` | authenticate + requireAction(deal.read) | service.listDeals | deals/routes.ts:37 |
| 90 | GET | `/api/deals/developers` | authenticate + requireAction(deal.assign_developer) | activeEmployeesByRole (employees/service) | deals/routes.ts:50 |
| 91 | GET | `/api/deals/:id` | authenticate + requireAction(deal.read) | readDeal -> service.getDealForReader | deals/routes.ts:77 |
| 92 | GET | `/api/deals/:id/history` | authenticate + requireAction(deal.read) | readDeal(history) -> service.getDealForReader | deals/routes.ts:78 |
| 93 | GET | `/api/deals/:id/call-notes` | authenticate + requireAction(deal.read) | relevantCallNotes (deals/callNotes) | deals/routes.ts:80 |
| 94 | POST | `/api/deals/:id/developer` | authenticate + requireAction(deal.assign_developer) + idempotent(deal.assign_developer) | service.assignDeveloper | deals/routes.ts:94 (command) |
| 95 | POST | `/api/deals/:id/advance-stage` | authenticate + requireAction(deal.update_stage) + idempotent(deal.advance_stage) | service.advanceStage | deals/routes.ts:94 (command) |
| 96 | POST | `/api/deals/:id/contract` | authenticate + requireAction(deal.update_stage) + idempotent(deal.set_contract) | service.setContract | deals/routes.ts:94 (command) |
| 97 | POST | `/api/deals/:id/signature` | authenticate + requireAction(deal.record_signature) + idempotent(deal.record_signature) | service.recordSignature | deals/routes.ts:94 (command) |
| 98 | POST | `/api/deals/:id/payment` | authenticate + requireAction(deal.record_payment) + idempotent(deal.record_payment) | service.recordPayment | deals/routes.ts:94 (command) |
| 99 | POST | `/api/deals/:id/remove-fact` | authenticate + requireAction(deal.update_stage) + idempotent(deal.remove_fact) | service.removeFact | deals/routes.ts:94 (command) |
| 100 | POST | `/api/deals/:id/closure-request` | authenticate + requireAction(deal.request_closure_verification) + idempotent(deal.request_closure_verification) | service.requestClosureVerification | deals/routes.ts:94 (command) |
| 101 | POST | `/api/deals/:id/closure-verify` | authenticate + requireAction(deal.verify_closure) + idempotent(deal.verify_closure) | service.verifyClosure | deals/routes.ts:94 (command) |
| 102 | POST | `/api/deals/:id/closure-reject` | authenticate + requireAction(deal.reject_closure) + idempotent(deal.reject_closure) | service.rejectClosure | deals/routes.ts:94 (command) |
| 103 | POST | `/api/deals/:id/not-proceeding` | authenticate + requireAction(deal.mark_not_proceeding) + idempotent(deal.mark_not_proceeding) | service.markNotProceeding | deals/routes.ts:94 (command) |
| 104 | POST | `/api/deals/:id/reopen` | authenticate + requireAction(deal.reopen_not_proceeding) + idempotent(deal.reopen_not_proceeding) | service.reopenNotProceeding | deals/routes.ts:94 (command) |
| 105 | POST | `/api/deals/:id/finalize` | authenticate + requireAction(deal.finalize) + idempotent(deal.finalize) | service.finalize | deals/routes.ts:94 (command) |
| 106 | POST | `/api/deals/:id/financial-correction` | authenticate + requireAction(deal.finalize) + idempotent(deal.correct_financials) | service.correctFinancials | deals/routes.ts:94 (command) |
| 107 | GET | `/api/employees/me` | authenticate + requireAction(profile.read) | service.getOwnProfile | employees/routes.ts:78 |
| 108 | PATCH | `/api/employees/me` | authenticate + requireAction(profile.update) | service.updateEmployee | employees/routes.ts:89 |
| 109 | GET | `/api/employees` | authenticate + requireAction(employee.list) | service.listEmployees | employees/routes.ts:101 |
| 110 | POST | `/api/employees` | authenticate + requireAction(employee.create) | service.createEmployee | employees/routes.ts:113 |
| 111 | GET | `/api/employees/:id` | authenticate + requireAction(employee.read) | service.getEmployee | employees/routes.ts:124 |
| 112 | PATCH | `/api/employees/:id` | authenticate + requireAction(employee.update) | service.updateEmployee | employees/routes.ts:136 |
| 113 | GET | `/api/employees/:id/open-items` | authenticate + requireAction(employee.read_open_items) | service.getEmployeeStatus | employees/routes.ts:149 |
| 114 | PATCH | `/api/employees/:id/status` | authenticate + requireAction(employee.deactivate) | service.setEmployeeStatus | employees/routes.ts:160 |
| 115 | POST | `/api/auth/login` | rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:120 |
| 116 | POST | `/api/auth/2fa/verify` | authenticate + rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:573 |
| 117 | POST | `/api/auth/2fa/recover` | authenticate + rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:586 |
| 118 | POST | `/api/auth/2fa/enroll/start` | authenticate + rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:601 |
| 119 | POST | `/api/auth/2fa/enroll/confirm` | authenticate + rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:664 |
| 120 | POST | `/api/auth/2fa/recovery-codes` | authenticate + requireAction(employee.manage_own_recovery_codes) + rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:678 |
| 121 | POST | `/api/auth/2fa/enrollment-tokens` | authenticate + requireAction(employee.issue_2fa_enrollment_token) + rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:725 |
| 122 | GET | `/api/auth/2fa/status` | authenticate | inline (identity/routes.ts) | identity/routes.ts:797 |
| 123 | POST | `/api/auth/logout` | authenticate | inline (identity/routes.ts) | identity/routes.ts:821 |
| 124 | POST | `/api/auth/sessions/revoke-all` | authenticate + requireAction(auth.session.revoke_all) | inline (identity/routes.ts) | identity/routes.ts:851 |
| 125 | POST | `/api/auth/password/change` | authenticate + requireAction(auth.password.change) + rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:893 |
| 126 | GET | `/api/auth/me` | authenticate | inline (identity/routes.ts) | identity/routes.ts:942 |
| 127 | POST | `/api/auth/password-reset/request` | rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:969 |
| 128 | POST | `/api/auth/password-reset/complete` | rate-limit(auth) | inline (identity/routes.ts) | identity/routes.ts:1023 |
| 129 | GET | `/api/meetings` | authenticate + requireAction(meeting.read) | service.listMeetings | meetings/routes.ts:29 |
| 130 | GET | `/api/meetings/attendee-options` | authenticate + requireAction(meeting.create) | inline (meetings/routes.ts) | meetings/routes.ts:42 |
| 131 | GET | `/api/meetings/:id` | authenticate + requireAction(meeting.read) | service.getMeetingForReader | meetings/routes.ts:52 |
| 132 | POST | `/api/meetings` | authenticate + requireAction(meeting.create) + idempotent(meeting.create, optional) | service.createMeeting | meetings/routes.ts:66 |
| 133 | PATCH | `/api/meetings/:id` | authenticate + requireAction(meeting.reschedule) + idempotent(meeting.reschedule, optional) | service.rescheduleMeeting | meetings/routes.ts:76 |
| 134 | POST | `/api/meetings/:id/held` | authenticate + requireAction(meeting.complete) + idempotent(meeting.complete, optional) | service.markHeld | meetings/routes.ts:86 |
| 135 | POST | `/api/meetings/:id/missed` | authenticate + requireAction(meeting.mark_missed) + idempotent(meeting.mark_missed, optional) | service.markMissed | meetings/routes.ts:96 |
| 136 | POST | `/api/meetings/:id/cancel` | authenticate + requireAction(meeting.reschedule) + idempotent(meeting.cancel, optional) | service.cancelMeeting | meetings/routes.ts:107 |
| 137 | GET | `/api/notifications` | authenticate + requireAction(notification.list) | service.listMyNotifications | notifications/routes.ts:18 |
| 138 | GET | `/api/notifications/unread-count` | authenticate + requireAction(notification.list) | service.getMyUnreadCount | notifications/routes.ts:34 |
| 139 | POST | `/api/notifications/:id/read` | authenticate + requireAction(notification.mark_read) | service.markAsRead | notifications/routes.ts:44 |
| 140 | POST | `/api/notifications/read-all` | authenticate + requireAction(notification.mark_read) | service.markAllAsRead | notifications/routes.ts:55 |
| 141 | GET | `/api/delivery-monitor` | authenticate + requireAction(reminder.monitor.read) | service.listDeliveryMonitor | notifications/routes.ts:73 |
| 142 | POST | `/api/delivery-monitor/reminders/:id/send-again` | authenticate + requireAction(reminder.send_again) | service.retryMonitorItem | notifications/routes.ts:90 |
| 143 | GET | `/api/test-support/mail (test-only)` | NONE | mailSink (test only) | notifications/routes.ts:105 |
| 144 | DELETE | `/api/test-support/mail (test-only)` | NONE | mailSink clear (test only) | notifications/routes.ts:111 |
| 145 | GET | `/health/worker (public, ops)` | NONE | inline health check (platform/routes.ts) | platform/routes.ts:21 |
| 146 | GET | `/api/test-support/clock (test-only)` | NONE | inline (test only) | platform/routes.ts:47 |
| 147 | PUT | `/api/test-support/clock (test-only)` | NONE | inline (test only) | platform/routes.ts:51 |
| 148 | DELETE | `/api/test-support/clock (test-only)` | NONE | inline (test only) | platform/routes.ts:62 |
| 149 | POST | `/api/test-support/jobs/:kind/run (test-only)` | NONE | inline: runs a job now (test only) | platform/routes.ts:68 |
| 150 | POST | `/api/test-support/worker/tick (test-only)` | NONE | inline: worker tick (test only) | platform/routes.ts:81 |
| 151 | GET | `/api/projects` | authenticate + requireAction(project.read) | service.listProjects | projects/routes.ts:32 |
| 152 | POST | `/api/projects` | authenticate + requireAction(deal.update_stage) + idempotent(project.create_manual, optional) | service.createManualProject | projects/routes.ts:42 |
| 153 | GET | `/api/projects/:id` | authenticate + requireAction(project.read) | service.getProjectForReader | projects/routes.ts:52 |
| 154 | PATCH | `/api/projects/:id` | authenticate + requireAction(project.update_status) + idempotent(project.update, optional) | service.updateProject | projects/routes.ts:66 |
| 155 | POST | `/api/projects/:id/status` | authenticate + requireAction(project.update_status) + idempotent(project.update_status, optional) | service.changeProjectStatus | projects/routes.ts:76 |
| 156 | POST | `/api/projects/:id/reopen` | authenticate + requireAction(project.reopen_completed) + idempotent(project.reopen_completed, optional) | service.reopenProject | projects/routes.ts:86 |
| 157 | POST | `/api/projects/:id/cancel` | authenticate + requireAction(project.reopen_completed) + idempotent(project.cancel, optional) | service.cancelProject | projects/routes.ts:98 |
| 158 | POST | `/api/projects/:id/developers` | authenticate + requireAction(project.assign_developers) + idempotent(project.assign_developers, optional) | service.setProjectDevelopers | projects/routes.ts:108 |
| 159 | POST | `/api/projects/:id/provision-retry` | authenticate + requireAction(project.provision_retry) + idempotent(project.provision_retry, optional) | service.retryProvisioning | projects/routes.ts:119 |
| 160 | GET | `/api/tasks` | authenticate + requireAction(project.board.read) | service.listTasks | projects/routes.ts:134 |
| 161 | GET | `/api/tasks/:id` | authenticate + requireAction(project.board.read) | service.getTaskForReader | projects/routes.ts:145 |
| 162 | POST | `/api/tasks` | authenticate + requireAction(task.create) + idempotent(task.create, optional) | service.createTask | projects/routes.ts:156 |
| 163 | PATCH | `/api/tasks/:id` | authenticate + requireActionFor(task.complete or task.update) | service.updateTask | projects/routes.ts:165 |
| 164 | GET | `/api/dashboard` | authenticate + requireAction(dashboard.owner.read) | service.getDashboardMetrics | reports/routes.ts:16 |
| 165 | GET | `/api/reports` | authenticate + requireAction(report.read) | service.listReports | reports/routes.ts:29 |
| 166 | GET | `/api/reports/export` | authenticate + requireAction(report.export) | inline: returns 405, use POST | reports/routes.ts:42 |
| 167 | POST | `/api/reports/export` | authenticate + requireAction(report.export) + rate-limit(export) | exportReport | reports/routes.ts:60 |
| 168 | POST | `/api/reservations` | authenticate + requireAction(reservation.acquire) + idempotent(reservation.acquire) | acquire | reservation/routes.ts:31 |
| 169 | POST | `/api/reservations/:id/renew` | authenticate + requireAction(reservation.renew) + rate-limit(renew) | renew | reservation/routes.ts:41 |
| 170 | POST | `/api/reservations/:id/release` | authenticate + requireAction(reservation.release) | release | reservation/routes.ts:54 |
| 171 | POST | `/api/reservations/:id/override` | authenticate + requireAction(reservation.override) | override | reservation/routes.ts:64 |
| 172 | GET | `/api/targets` | authenticate + requireAction(target.read) | service.listTargets | work/routes.ts:19 |
| 173 | POST | `/api/targets` | authenticate + requireAction(target.set) | service.createTarget | work/routes.ts:34 |
| 174 | PATCH | `/api/targets/:id` | authenticate + requireAction(target.set) | service.updateTarget | work/routes.ts:44 |
| 175 | GET | `/api/work-items` | authenticate + requireAction(work_item.read) | service.listWorkItems | work/routes.ts:58 |
| 176 | POST | `/api/work-items` | authenticate + requireAction(work_item.create) | service.createWorkItem | work/routes.ts:75 |
| 177 | PATCH | `/api/work-items/:id` | authenticate + requireAction(work_item.update) | service.updateWorkItem | work/routes.ts:85 |

---

## 3. Frontend to API usage

Method used: literal and template matching of every `/api/...` string in frontend `src` (non-test), plus the path builders in `frontend/src/lib/api/*.ts`. Path builders that take a verb (for example `callingPaths.assignmentsCommand('assign')`, `dealsPaths.command(id, verb)`) were matched against their verb lists. This is static matching only; it does not prove a call happens at runtime.

(a) Frontend calls with no matching backend route: none found. Non-route strings seen were comments and imports only.

(b) Backend routes with no frontend caller (checked against literals, verb lists, and exported helpers):

| Route | Note |
|---|---|
| `GET /api/settings/public` | No caller. |
| `GET, POST /api/attendance/sessions`, `GET /api/attendance/sessions/:id`, `POST /api/attendance/sessions/:id/resolve-review` | No caller. Owner monitor uses `overview` and `corrections` only. |
| `POST /api/attendance/settings/test-office-check` | No caller. |
| `GET, POST /api/attendance/remote-exceptions`, `POST .../remote-exceptions/:id/approve`, `/reject`, `/revoke` | No caller. Only `/remote-exceptions/requests` is used (`lib/api/attendance.ts:345`). `attendancePaths.remoteExceptions` is defined but unused. |
| `GET /api/attendance/corrections/:id` | No direct caller; the path is used as a prefix for approve, reject and withdraw. |
| `GET /api/meetings/attendee-options` | No caller. |
| `GET /api/meetings/:id` | No direct caller; `meetingsPaths.detail` is used for PATCH only. |
| `PATCH /api/projects/:id` | No caller (`projects.ts` has no project PATCH). |
| `GET /api/tasks`, `GET /api/tasks/:id` | No caller (`projectsPaths.tasks` is used for POST; the board reads tasks inside `/api/projects/:id`). |
| `DELETE /api/businesses/:id` | Intentionally always refused (`business.delete` granted to nobody). |
| `GET /api/reports/export` | Intentionally returns 405 (use POST). |
| `GET /health/worker`, `/api/test-support/*` | Ops and test only. |

(c) Frontend API client, endpoints per file (`frontend/src/lib/api/`):

| File | Backend endpoints |
|---|---|
| `admin.ts` | GET `/api/audit-events`; GET, PATCH `/api/settings`; GET `/api/settings/flags`; GET, PUT `/api/attendance/settings` |
| `assignments.ts` | GET `/api/calling-assignments`; POST `.../assign`, `.../autofill`, `.../reassign-impact`, `.../reassign`, `.../unassign`; POST `/api/reservations/:id/override` |
| `attendance.ts` | GET `/api/attendance/me/today`, `/me/sessions`, `/corrections`, `/settings`, `/days-off`, `/breaks/active`, `/sessions/:id/breaks`, `/employees/:id/schedule`; POST `/check-in`, `/check-out`, `/corrections`, `/corrections/:id/withdraw`, `/remote-exceptions/requests`, `/days-off`, `/days-off/:id/cancel`, `/breaks/start`, `/breaks/end`; PUT `/employees/:id/schedule` |
| `attendanceOwner.ts` | GET `/api/attendance/overview`, `/corrections`; POST `/corrections/:id/approve`, `/corrections/:id/reject`, `/sessions/:id/adjust` |
| `businesses.ts` | GET, POST `/api/businesses`; GET, PATCH `/api/businesses/:id`; GET `/:id/history`; POST `/:id/archive`, `/:id/restore`, `/duplicate-check`, `/duplicate-review-requests`; GET, POST `/api/categories`; PATCH `/api/categories/:id`; POST `/:id/deactivate`; GET `/api/search` |
| `calling.ts` | GET `/api/calling/queue`, `/businesses/:id/workspace`, `/do-not-call`, `/opportunities`; POST `/api/calling/attempts`, `/attempts/inbound-rejection`, `/businesses/:id/reopen`, `/businesses/:id/requeue`; GET, POST `/api/follow-ups`; PATCH `/api/follow-ups/:id`; POST `/:id/complete`, `/:id/cancel`; POST `/api/reservations`, `/:id/renew`, `/:id/release`, `/:id/override` |
| `corrections.ts` | GET, POST `/api/correction-requests`; GET `/:id`; POST `/:id/start-review`, `/release`, `/resolve`, `/reject`, `/close-no-change`, `/withdraw` |
| `deals.ts` | GET `/api/deals`, `/:id`, `/:id/history`, `/developers`; POST `/api/deals/:id/` + developer, advance-stage, contract, signature, payment, remove-fact, closure-request, closure-verify, closure-reject, not-proceeding, reopen, finalize, financial-correction (`DealVerb` list) |
| `deliveryMonitor.ts` | GET `/api/delivery-monitor`; POST `/reminders/:id/send-again` |
| `employees.ts` | GET, POST `/api/employees`; GET, PATCH `/api/employees/:id`; PATCH `/:id/status`; GET `/:id/open-items`; GET `/api/employees/me` (identity) |
| `identity.ts` | POST `/api/auth/password-reset/request`, `/2fa/recovery-codes`, `/2fa/recover`, `/2fa/enroll/start`, `/2fa/enroll/confirm`, `/2fa/enrollment-tokens`, `/sessions/revoke-all`; GET `/2fa/status`; PATCH `/api/employees/me`; path `/api/auth/password/change` (used by `app/profile/page.tsx:129`) |
| `meetings.ts` | GET, POST `/api/meetings`; PATCH `/api/meetings/:id`; POST `/:id/held`, `/:id/missed`, `/:id/cancel` |
| `myDay.ts` | GET `/api/work-items` (state=open, 5 rows); GET `/api/targets?scope=self` |
| `notifications.ts` | GET `/api/notifications`; GET `/unread-count`; POST `/:id/read`, `/read-all` |
| `projects.ts` | GET, POST `/api/projects`; GET `/:id`; POST `/:id/status`, `/reopen`, `/cancel`, `/developers`, `/provision-retry`; POST `/api/tasks`; PATCH `/api/tasks/:id` |
| `reports.ts` | GET `/api/dashboard`; GET `/api/reports`; POST `/api/reports/export` (via fetch) |
| `roles.ts` | GET, POST `/api/access/roles`; GET, PATCH, DELETE `/api/access/roles/:id`; GET `/api/access/permissions` |
| `work.ts` | GET, POST `/api/targets`; PATCH `/api/targets/:id`; GET, POST `/api/work-items`; PATCH `/api/work-items/:id` |

Direct calls outside `lib/api` (pages and components): `/api/dashboard?period=...` (`app/page.tsx:59`, `app/targets/page.tsx:79`); `/api/employees?role=call_center&pageSize=100` (`components/calling/FollowUps.tsx:353`); `/api/employees?pageSize=100&status=active` (`components/delivery/ScheduleMeetingDrawer.tsx:71`); `/api/deals/:id/call-notes` (`components/delivery/RelevantCallNotes.tsx:29`); `/api/delivery-monitor?kind=...` (`app/delivery-monitor/page.tsx:69`); `/api/settings` (`lib/hooks/useCompanyTime.ts:43`); `/api/auth/login`, `/logout`, `/me`, `/2fa/verify`, `/2fa/recover` (`lib/auth.tsx`); `/api/auth/password-reset/*` (`app/reset-password/page.tsx`); `/api/auth/me` (`proxy.ts:28`, `components/layout/GlobalErrorRouting.tsx`); `/api/tasks/:id` PATCH referenced in `components/delivery/TaskDrawer.tsx:40`.

(d) Exported `lib/api` functions never imported outside `lib/api` (pages call `useApi` with raw paths or the function is unused). Not a runtime fault by itself, but these contracts are not exercised by the UI: `admin.ts`: `getSettings`, `getAttendanceSettings`; `assignments.ts`: `ReassignInput`, `UnassignInput` (types only); `attendance.ts`: `getSessionBreaks`, `CorrectionsQuery`, `RemoteRequestInput`, `DaysOffQuery`, `MySessionsDto`; `attendanceOwner.ts`: `ownerAttendancePaths` (paths only); `businesses.ts`: `checkDuplicate`; `calling.ts`: `getQueue`, `getWorkspace`, `getDoNotCall`, `getOpportunities`, `listFollowUps`; `corrections.ts`: `resolveCorrection`; `deals.ts`: `dealListPath`; `meetings.ts`: type `RescheduleMeetingInput`; `reports.ts`: `getDashboardMetrics`, `listReports`; `roles.ts`: `listRoles`, `listPermissions`; `work.ts`: `listTargets`, `listWorkItems`; `identity.ts`: `IssueEnrollmentTokenInput` (type); `projects.ts`: `TaskPatch`, `NewTask`, `ProjectListQuery` (types).

---

## 4. Database inventory

Migration order (`backend/src/db/migrations`, applied by `db/migrate.ts`; `schema_migrations` table from 001):

001_initial_schema, 002_identity_hardening, 010_identity_sec3, 011_admin_company_settings, 012_admin_restricted_app_role, 013_identity_session_step_up, 014_dynamic_roles_rbac, 020_attendance_core, 021_attendance_breaks, 030_work_targets_items, 100_platform_core, 101_notifications_deliveries, 102_notifications_reminders, 103_reports_export_records, 200_businesses_core, 201_businesses_directory, 202_corrections_requests, 300_assignment_calling_assignments, 310_calls_business_calling_states, 320_reservation_contact_reservations, 330_calls_call_attempts, 340_calls_follow_ups, 350_calls_outcome_reopenings, 400_deals_core, 410_meetings, 420_projects_tasks, 900_access_facts_v1, 901_access_facts_v2, 902_access_facts_v3, 903_access_facts_v4, 960_custom_roles_version, 970_tasks_start_date, 971_attendance_breaks_hardening, 972_notification_delivery_accepted_captured, 980_attendance_policy_v1, 981_attendance_employee_schedules, 985_notification_delivery_summary, 987_deals_commercial_policy_v1, 988_projects_cancelled, 990_social_metric_observed_at, 992_access_facts_v5, 993_employees_fixed_v1_roles, 994_custom_roles_on, 997_ops_alerts (44 files).

Extensions: `pgcrypto` (001, `gen_random_uuid()`), `pg_trgm` (201). Roles: `udigity_app` NOLOGIN role created in 012 (DO block) with grants in 012, 020, 980, 981, 997; runtime login roles are created by `devops/postgres/init/10-app-role.sh` and the backup role by `20-backup-role.sh`.

View: `access_facts` (`CREATE OR REPLACE` in 900, 901, 902, 903, 992; 992 is current). Read-only fact view for the access engine.

Triggers and functions (all append-only or immutability guards):
- `audit_events_append_only()` and `trg_audit_events_append_only` on `audit_events` (002).
- `business_edit_history_append_only()` and `trg_business_edit_history_append_only` on `business_edit_history` (201).
- `call_attempts_immutable()` and `trg_call_attempts_immutable` on `call_attempts` (330).
- `businesses_default_category()` (201, default category function).

Key constraints of note (from the table): `uq_attendance_sessions_one_open` (one open session per employee); `uq_calling_assignments_open_business` and `uq_contact_reservations_active_business` (one active assignment and one active reservation per business); `uq_deals_one_open_per_business`; `uq_dda_one_current` and `uq_pda_current` (one current developer assignment); `uq_follow_ups_open_business`; `background_jobs (kind, dedupe_key)` unique; `call_attempts (agent_id, idempotency_key)` unique; `idempotency_records` PK `(actor_id, operation, idem_key)`; `businesses.name_key` unique and `business_phones.normalized_phone` unique; `deal_changes`, `project_changes`, `meeting_changes` have no unique keys (history tables).

Tables (PK, FK with ON DELETE, unique, check constraints; "cols" approximate from `CREATE TABLE` plus ALTERs; migration file that created the table; FKs added in later migrations are tagged with their file):

| Table | Migration (created) | Approx. cols | Primary key | Foreign keys (ON DELETE) | Unique / partial unique | Check constraints |
|---|---|---|---|---|---|---|
| schema_migrations | 001_initial_schema.sql | 2 | version | - | - | - |
| employees | 001_initial_schema.sql | 10 | id | [014_dynamic_roles_rbac.sql] fk_employees_role role->custom_roles(id) | email | role:inline, [993_employees_fixed_v1_roles.sql] employees_role_v1_check |
| credentials | 001_initial_schema.sql | 5 | id | employee_id->employees(id) ON DELETE CASCADE UNIQUE; [002_identity_hardening.sql] credentials_employee_id_fkey employee_id->employees(id) | employee_id | - |
| two_factor_factors | 001_initial_schema.sql | 7 | id | employee_id->employees(id) ON DELETE CASCADE UNIQUE; [002_identity_hardening.sql] two_factor_factors_employee_id_fkey employee_id->employees(id) | employee_id | [010_identity_sec3.sql] two_factor_factors_secret_present, [010_identity_sec3.sql] two_factor_factors_key_id_present |
| sessions | 001_initial_schema.sql | 11 | id | employee_id->employees(id) ON DELETE CASCADE; [002_identity_hardening.sql] sessions_employee_id_fkey employee_id->employees(id) | token; UNIQUE INDEX idx_sessions_token_hash (token_hash) | [002_identity_hardening.sql] sessions_state_check, [002_identity_hardening.sql] sessions_end_reason_check |
| audit_events | 001_initial_schema.sql | 9 | id | actor_id->employees(id) ON DELETE SET NULL; [002_identity_hardening.sql] audit_events_actor_id_fkey actor_id->employees(id) | - | - |
| security_tokens | 002_identity_hardening.sql | 9 | id | employee_id->employees(id) ON DELETE RESTRICT | token_hash | purpose:inline, [010_identity_sec3.sql] security_tokens_purpose_check, [010_identity_sec3.sql] security_tokens_issued_via_check |
| two_factor_recovery_codes | 010_identity_sec3.sql | 8 | id | employee_id->employees(id) ON DELETE RESTRICT | - | - |
| company_settings | 011_admin_company_settings.sql | 6 | id | updated_by->employees(id) ON DELETE RESTRICT | - | id:inline, "values":inline |
| custom_roles | 014_dynamic_roles_rbac.sql | 7 | id | created_by->employees(id) ON DELETE SET NULL | - | - |
| role_permissions | 014_dynamic_roles_rbac.sql | 5 | id | role_id->custom_roles(id) ON DELETE CASCADE | UNIQUE(role_id, action) | data_scope:inline |
| attendance_settings_versions | 020_attendance_core.sql | 16 | id | created_by->employees(id) ON DELETE RESTRICT | version_no | version_no:inline, timezone:inline, shift_start:inline, shift_end:inline, grace_minutes:inline, verification_mode:inline, summary_min_length:inline, missing_checkout_flag_hours:inline |
| remote_exceptions | 020_attendance_core.sql | 13 | id | employee_id->employees(id) ON DELETE RESTRICT; requested_by->employees(id) ON DELETE RESTRICT; decided_by->employees(id) ON DELETE RESTRICT | - | status:inline, CHECK (end_date >= start_date) |
| attendance_sessions | 020_attendance_core.sql | 21 | id | employee_id->employees(id) ON DELETE RESTRICT; remote_exception_id->remote_exceptions(id) ON DELETE RESTRICT; settings_version_id->attendance_settings_versions(id) ON DELETE RESTRICT; review_resolved_by->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_attendance_sessions_one_open (employee_id) WHERE state = 'open' | state:inline, origin:inline, check_in_at TIMESTAMPTZ NOT NULL, check_out_at TIMESTAMPTZ, checkout_attempted_at TIMESTAMPTZ, check_out_unknown BOOLEAN NOT NULL DEFAULT false, check_in_verification JSONB NOT NULL DEFAULT '{}'::jsonb, check_out_verification JSONB, checkout_failure_reason TEXT, CHECK (check_out_at IS NULL OR check_out_at >= check_in_at), CHECK (effective_check_out_at IS NULL OR effective_check_out_at >= effective_check_in_at) |
| attendance_corrections | 020_attendance_core.sql | 19 | id | session_id->attendance_sessions(id) ON DELETE RESTRICT; employee_id->employees(id) ON DELETE RESTRICT; decided_by->employees(id) ON DELETE RESTRICT; created_by->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_attendance_corrections_open (session_id) WHERE status = 'submitted' AND session_id IS NOT NULL | kind:inline, status:inline |
| attendance_exceptions | 020_attendance_core.sql | 6 | id | employee_id->employees(id) ON DELETE RESTRICT; session_id->attendance_sessions(id) ON DELETE RESTRICT | UNIQUE INDEX uq_attendance_exceptions (kind, work_date, COALESCE(employee_id, '00000000-0000-0000-0000-000000000000'::uuid)) | kind:inline, [980_attendance_policy_v1.sql] attendance_exceptions_kind_check |
| attendance_breaks | 021_attendance_breaks.sql | 10 | id | session_id->attendance_sessions(id) ON DELETE CASCADE; employee_id->employees(id) ON DELETE RESTRICT; [971_attendance_breaks_hardening.sql] attendance_breaks_session_id_fkey session_id->attendance_sessions(id) | UNIQUE INDEX uq_attendance_breaks_active (session_id) WHERE ended_at IS NULL | break_type:inline, CHECK (ended_at IS NULL OR ended_at >= started_at), CHECK (duration_seconds IS NULL OR duration_seconds >= 0), [971_attendance_breaks_hardening.sql] attendance_breaks_notes_len |
| targets | 030_work_targets_items.sql | 12 | id | employee_id->employees(id) ON DELETE RESTRICT | - | period:inline |
| work_items | 030_work_targets_items.sql | 11 | id | assignee_id->employees(id) ON DELETE RESTRICT | - | status:inline |
| outbox_events | 100_platform_core.sql | 13 | id | - | - | state:inline |
| outbox_consumer_runs | 100_platform_core.sql | 3 | PRIMARY KEY (event_id, consumer) | event_id->outbox_events(id) ON DELETE RESTRICT | - | - |
| background_jobs | 100_platform_core.sql | 13 | id | - | UNIQUE (kind, dedupe_key) | state:inline |
| idempotency_records | 100_platform_core.sql | 8 | PRIMARY KEY (actor_id, operation, idem_key) | actor_id->employees(id) ON DELETE RESTRICT | - | - |
| worker_heartbeats | 100_platform_core.sql | 4 | worker_id | - | - | - |
| notification_deliveries | 101_notifications_deliveries.sql | 20 | id | event_id->outbox_events(id) ON DELETE RESTRICT; recipient_id->employees(id) ON DELETE RESTRICT | dedupe_key | family:inline, channel:inline, state:inline, [972_notification_delivery_accepted_captured.sql] notification_deliveries_state_check |
| notification_secrets | 101_notifications_deliveries.sql | 5 | ref_id | - | - | - |
| reminders | 102_notifications_reminders.sql | 15 | id | recipient_id->employees(id) ON DELETE RESTRICT | dedupe_key | source_type:inline, channel:inline, state:inline |
| export_records | 103_reports_export_records.sql | 7 | id | requested_by->employees(id) ON DELETE RESTRICT | - | format:inline |
| businesses | 200_businesses_core.sql | 8 | id | created_by->employees(id) ON DELETE RESTRICT; archived_by->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_businesses_name_key (name_key) | - |
| categories | 201_businesses_directory.sql | 10 | id | created_by->employees(id) ON DELETE RESTRICT; updated_by->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_categories_normalized_name (normalized_name) | categories_system_active |
| business_phones | 201_businesses_directory.sql | 8 | id | business_id->businesses(id) ON DELETE RESTRICT | UNIQUE INDEX uq_business_phones_normalized (normalized_phone) | - |
| social_accounts | 201_businesses_directory.sql | 11 | id | business_id->businesses(id) ON DELETE RESTRICT | - | followers:inline |
| business_edit_history | 201_businesses_directory.sql | 10 | id | business_id->businesses(id) ON DELETE RESTRICT; changed_by->employees(id) ON DELETE RESTRICT | - | change_kind:inline |
| data_correction_requests | 202_corrections_requests.sql | 16 | id | business_id->businesses(id) ON DELETE RESTRICT; requested_by->employees(id) ON DELETE RESTRICT; reviewer_id->employees(id) ON DELETE RESTRICT; resolved_by->employees(id) ON DELETE RESTRICT | - | status:inline, dcr_in_review_has_reviewer, dcr_terminal_has_resolver |
| calling_assignments | 300_assignment_calling_assignments.sql | 13 | id | business_id->businesses(id) ON DELETE RESTRICT; assignee_id->employees(id) ON DELETE RESTRICT; assigned_by->employees(id) ON DELETE RESTRICT; ended_by->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_calling_assignments_open_business (business_id) WHERE ended_at IS NULL | source:inline, end_reason:inline, calling_assignments_end_consistent |
| business_calling_states | 310_calls_business_calling_states.sql | 11 | business_id | business_id->businesses(id) ON DELETE RESTRICT; outcome_changed_by->employees(id) ON DELETE RESTRICT | - | outcome:inline, business_calling_states_rejected_no_marker |
| contact_reservations | 320_reservation_contact_reservations.sql | 17 | id | business_id->businesses(id) ON DELETE RESTRICT; holder_id->employees(id) ON DELETE RESTRICT; ended_by->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_contact_reservations_active_business (business_id) WHERE state = 'active' | state:inline, end_reason:inline, contact_reservations_end_consistent, contact_reservations_override_reason |
| call_attempts | 330_calls_call_attempts.sql | 16 | id | business_id->businesses(id) ON DELETE RESTRICT; agent_id->employees(id) ON DELETE RESTRICT; reservation_id->contact_reservations(id) ON DELETE RESTRICT; [340_calls_follow_ups.sql] fk_call_attempts_fulfils_follow_up fulfils_follow_up_id->follow_ups(id) | UNIQUE INDEX uq_call_attempts_agent_key (agent_id, idempotency_key) | channel:inline, outcome:inline, call_attempts_rejected_reason, call_attempts_unapplied_means_lost |
| follow_ups | 340_calls_follow_ups.sql | 17 | id | business_id->businesses(id) ON DELETE RESTRICT; responsible_id->employees(id) ON DELETE RESTRICT; created_by->employees(id) ON DELETE RESTRICT; created_by_attempt_id->call_attempts(id) ON DELETE RESTRICT; completed_by_attempt_id->call_attempts(id) ON DELETE RESTRICT | UNIQUE INDEX uq_follow_ups_open_business (business_id) WHERE state = 'scheduled' | state:inline, cancel_source:inline, follow_ups_state_consistent |
| follow_up_changes | 340_calls_follow_ups.sql | 10 | id | follow_up_id->follow_ups(id) ON DELETE RESTRICT; old_responsible_id->employees(id) ON DELETE RESTRICT; new_responsible_id->employees(id) ON DELETE RESTRICT; changed_by->employees(id) ON DELETE RESTRICT | - | kind:inline |
| outcome_reopenings | 350_calls_outcome_reopenings.sql | 8 | id | business_id->businesses(id) ON DELETE RESTRICT; performed_by->employees(id) ON DELETE RESTRICT | - | kind:inline, previous_outcome:inline, new_outcome:inline, outcome_reopenings_kind_from |
| deals | 400_deals_core.sql | 27 | id | business_id->businesses(id) ON DELETE RESTRICT; accepted_attempt_id->call_attempts(id) ON DELETE RESTRICT; accepted_by_id->employees(id) ON DELETE RESTRICT; assigned_developer_id->employees(id) ON DELETE RESTRICT; signature_recorded_by_id->employees(id) ON DELETE RESTRICT; payment_recorded_by_id->employees(id) ON DELETE RESTRICT; closed_by_id->employees(id) ON DELETE RESTRICT; not_proceeding_by_id->employees(id) ON DELETE RESTRICT | code; accepted_attempt_id; UNIQUE INDEX uq_deals_one_open_per_business (business_id) WHERE stage NOT IN ('closed','not_proceeding') | stage:inline, payment_amount:inline, closure_mode:inline, deals_signed_has_fact, deals_paid_has_fact, deals_closed_needs_both, deals_np_has_reason, deals_amount_needs_currency, [987_deals_commercial_policy_v1.sql] deals_stage_check, [987_deals_commercial_policy_v1.sql] deals_contract_amount_needs_currency, [987_deals_commercial_policy_v1.sql] deals_signed_has_fact, [987_deals_commercial_policy_v1.sql] deals_closed_evidence, [987_deals_commercial_policy_v1.sql] deals_closed_evidence |
| deal_developer_assignments | 400_deals_core.sql | 7 | id | deal_id->deals(id) ON DELETE RESTRICT; developer_id->employees(id) ON DELETE RESTRICT; assigned_by_id->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_dda_one_current (deal_id) WHERE unassigned_at IS NULL | - |
| closure_reviews | 400_deals_core.sql | 10 | id | deal_id->deals(id) ON DELETE RESTRICT; requested_by_id->employees(id) ON DELETE RESTRICT; decided_by_id->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_closure_reviews_one_open (deal_id) WHERE status = 'requested' | status:inline, closure_reviews_decided |
| deal_changes | 400_deals_core.sql | 8 | id | deal_id->deals(id) ON DELETE RESTRICT; actor_id->employees(id) ON DELETE RESTRICT | - | change_type:inline, [987_deals_commercial_policy_v1.sql] deal_changes_change_type_check |
| meetings | 410_meetings.sql | 17 | id | deal_id->deals(id) ON DELETE RESTRICT; outcome_recorded_by_id->employees(id) ON DELETE RESTRICT; created_by_id->employees(id) ON DELETE RESTRICT | - | status:inline, meetings_end_after_start, meetings_cancel_reason |
| meeting_attendees | 410_meetings.sql | 4 | PRIMARY KEY (meeting_id, employee_id) | meeting_id->meetings(id) ON DELETE RESTRICT; employee_id->employees(id) ON DELETE RESTRICT | - | - |
| meeting_changes | 410_meetings.sql | 8 | id | meeting_id->meetings(id) ON DELETE RESTRICT; actor_id->employees(id) ON DELETE RESTRICT | - | change_type:inline |
| projects | 420_projects_tasks.sql | 16 | id | deal_id->deals(id) ON DELETE RESTRICT; business_id->businesses(id) ON DELETE RESTRICT; provisioned_by_id->employees(id) ON DELETE RESTRICT | code; deal_id | status:inline, provisioned_by:inline, projects_dates, projects_note_required, projects_completed_at, [988_projects_cancelled.sql] projects_status_check, [988_projects_cancelled.sql] projects_cancelled_has_reason |
| project_developer_assignments | 420_projects_tasks.sql | 7 | id | project_id->projects(id) ON DELETE RESTRICT; developer_id->employees(id) ON DELETE RESTRICT; assigned_by_id->employees(id) ON DELETE RESTRICT | UNIQUE INDEX uq_pda_current (project_id, developer_id) WHERE unassigned_at IS NULL | - |
| project_changes | 420_projects_tasks.sql | 9 | id | project_id->projects(id) ON DELETE RESTRICT; actor_id->employees(id) ON DELETE RESTRICT | - | change_type:inline |
| tasks | 420_projects_tasks.sql | 18 | id | project_id->projects(id) ON DELETE RESTRICT; owner_id->employees(id) ON DELETE RESTRICT; completed_by_id->employees(id) ON DELETE RESTRICT; created_by_id->employees(id) ON DELETE RESTRICT | - | status:inline, tasks_done_has_completion, tasks_cancel_reason, [970_tasks_start_date.sql] tasks_start_before_due |
| project_provisioning_states | 420_projects_tasks.sql | 8 | deal_id | deal_id->deals(id) ON DELETE RESTRICT | - | - |
| attendance_days_off | 980_attendance_policy_v1.sql | 12 | id | employee_id->employees(id) ON DELETE RESTRICT; created_by->employees(id) ON DELETE RESTRICT; cancelled_by->employees(id) ON DELETE RESTRICT | - | reason:inline, cancel_reason:inline, CHECK (end_date >= start_date), CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL)) |
| employee_schedules | 981_attendance_employee_schedules.sql | 8 | id | employee_id->employees(id) ON DELETE RESTRICT; created_by->employees(id) ON DELETE RESTRICT | - | shift_start:inline, working_days:inline, reason:inline |
| ops_alerts | 997_ops_alerts.sql | 9 | id | - | dedupe_key | kind:inline, detail:inline |

Foreign-key delete behaviour: 002 moved every FK to `employees` to `ON DELETE RESTRICT` (including `audit_events.actor_id`, `sessions`, `credentials`, `two_factor_factors`). 971 moved `attendance_breaks.session_id` to RESTRICT. The only remaining `ON DELETE CASCADE` in the listing is `role_permissions.role_id` to `custom_roles(id)` (014). `custom_roles.created_by` is SET NULL (014).

---

## 5. Worker and job inventory

Worker loop (`backend/src/worker.ts`): every 2 s, run outbox relay (J-03), then scheduler tick, then due jobs. Scheduled specs are `every:N` seconds. Scheduler rows are unique per `(kind, slot)`; claims use SKIP LOCKED with leases.

Job kinds (`backend/src/shared/platform.ts` JobKind; `registerJob` calls):

| Job kind | Registered in | Schedule | Max attempts | Lease | Purpose |
|---|---|---|---|---|---|
| `platform.outbox_relay` (J-03) | `modules/platform/module.ts:10` | every loop (2 s) | 1 | - | Relay outbox events to consumers |
| `platform.heartbeat` (J-09) | `platform/module.ts:36` | every 60 s | 1 | - | Worker heartbeat (health via `/health/worker`) |
| `platform.retention_purge` (J-12) | `platform/module.ts:46` | every 21600 s | 3 | - | Retention purge (`POLICY_RETENTION_*`) |
| `notifications.reminder_dispatch` (J-01) | `notifications/module.ts:22` | every 30 s | 3 | - | Send due reminders |
| `notifications.delivery_dispatch` (J-02) | `notifications/module.ts:34` | every 30 s | 3 | - | Email retries (60 s / 10 min / 60 min) |
| `notifications.daily_digest` (J-13) | `notifications/module.ts:49` | every 300 s | 3 | 120 s | In-app shift digests |
| `notifications.ops_alerts` (J-14) | `notifications/module.ts:60` | every 60 s | 3 | 60 s | Operator failure alerts to `ALERT_EMAIL_TO` |
| `attendance.exception_check` (J-04) | `attendance/module.ts:25` | every 300 s | 3 | 120 s | Missing check-in/out detection |
| `reservation.expiry_sweep` (J-05) | `reservation/module.ts:22` | every 60 s | 3 | - | Expire contact reservations |
| `identity.session_cleanup` (J-06) | `identity/module.ts:22` | every 3600 s | 3 | 300 s | Session cleanup |
| `projects.provision_retry` (J-07) | `projects/module.ts:39` | none (enqueue-only) | 3 | - | Retry project provisioning |
| `reports.daily_snapshot` (J-08) | not registered | none | n/a | n/a | JobKind declared, "not in v1 (OQ-17)" |

Outbox events: 43 names in `OUTBOX_EVENTS` (`backend/src/shared/outbox.ts:18-61`). Consumers (`registerOutboxConsumer`):

| Consumer name | Registered in | Events |
|---|---|---|
| `corrections.release_on_reviewer_deactivation` | `corrections/module.ts:23` | `account.deactivated` |
| `identity.revoke_sessions` (E-02) | `identity/module.ts:18` (`identity/service.ts:151`) | `account.deactivated`, `account.role_changed` |
| `meetings.cancel_for_deal_not_proceeding` | `meetings/module.ts:20` | `deal.not_proceeding` |
| `notifications.security_email` (E-03) | `notifications/module.ts:80` (`service.ts:57`) | `password_reset.requested`, `account.created` |
| `notifications.reminder_planner` (E-05, E-06) | `notifications/module.ts:81` (`service.ts:449`) | follow-up scheduled/rescheduled/reassigned/completed/cancelled; meeting scheduled/rescheduled/cancelled/held/missed; opportunity developer assigned/reassigned; calling assignment assigned/reassigned |
| `notifications.business_events` (E-07..E-15, BL-03) | `notifications/module.ts:82` (`service.ts:731`) | calling assignment; opportunity developer; data correction submitted/resolved/rejected/closed; attendance correction submitted; attendance checkout provisional/pending review; missing check-in/check-out detected; missing checkout reminder; contact reservation overridden; deal closure requested, closed, closure rejected; project provisioning failed; duplicate review requested; two-factor recovery succeeded; notification failed/suppressed; reminder failed/suppressed |
| `projects.provision` (E-15) | `projects/module.ts:31` | `deal.closed` |

Events with no consumer: `call_outcome.changed` (reporting only, by design), `password_reset.assistance_triggered` and `password_reset.completed` (listed in `NO_CONSUMER_EVENTS`, not emitted in v1). `deal.not_proceeding` is consumed by meetings.

Several event names are placeholders awaiting approval (tag "G2" in code); see section 8.

---

## 6. Access matrix source

Source: `backend/src/modules/access/matrix.ts` (`AUTHZ_MATRIX`, mirrors `docs/security/authz-matrix.md` section 3). 124 actions. Roles: Owner, DataEntry, CallCenter, Developer. "(nobody)" rows are never grantable. "grantable" rows (matrix section 3.11) can be given to a custom role; the holder still needs a verified second factor for admin rows. Startup drift check: `verifyDeclaredActions` (throws when a module's declared roles differ from the matrix).

Cross-check: every literal action in route guards exists in the matrix. Matrix rows with no literal use in any route, schema or service: `audit.export`, `audit.update`, `audit.delete` (nobody, by design), `auth.password_reset.assist`, `session.revoke`, `dashboard.self.read` (no route uses it; `/api/dashboard` uses `dashboard.owner.read` only). Attendance rows referenced through `A.*` constants (`modules/attendance/schemas.ts`) were mapped to their matrix names.

| Action | Roles granted | Flags | Matrix section |
|---|---|---|---|
| `auth.password_reset.assist` | Owner | Owner + 2FA | 3.1 |
| `session.revoke` | Owner | Owner + 2FA | 3.1 |
| `auth.session.revoke_all` | Owner, DataEntry, CallCenter, Developer | - | 3.1 |
| `auth.password.change` | Owner, DataEntry, CallCenter, Developer | - | 3.1 |
| `employee.manage_own_recovery_codes` | Owner | Owner + 2FA | 3.1 |
| `employee.list` | Owner | grantable; Owner + 2FA | 3.2 |
| `employee.read` | Owner | grantable; Owner + 2FA | 3.2 |
| `employee.create` | Owner | Owner + 2FA | 3.2 |
| `employee.update` | Owner | Owner + 2FA | 3.2 |
| `employee.deactivate` | Owner | Owner + 2FA | 3.2 |
| `employee.activate` | Owner | Owner + 2FA | 3.2 |
| `employee.read_open_items` | Owner | grantable; Owner + 2FA | 3.2 |
| `profile.read` | Owner, DataEntry, CallCenter, Developer | - | 3.2 |
| `profile.update` | Owner, DataEntry, CallCenter, Developer | - | 3.2 |
| `role.list` | Owner | Owner + 2FA | 3.2 |
| `role.read` | Owner | Owner + 2FA | 3.2 |
| `role.create` | Owner | Owner + 2FA | 3.2 |
| `role.update` | Owner | Owner + 2FA | 3.2 |
| `role.delete` | Owner | Owner + 2FA | 3.2 |
| `permission.list` | Owner | Owner + 2FA | 3.2 |
| `attendance.check_in` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.check_out` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.read` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.correction.request` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.correction.review` | Owner | grantable; Owner + 2FA | 3.3 |
| `attendance.adjust` | Owner | grantable; Owner + 2FA | 3.3 |
| `attendance.retroactive_create` | Owner | grantable; Owner + 2FA | 3.3 |
| `attendance.remote_exception.grant` | Owner | grantable; Owner + 2FA | 3.3 |
| `attendance.failed_checkout.review` | Owner | grantable; Owner + 2FA | 3.3 |
| `attendance.overview.read` | Owner | grantable; Owner + 2FA | 3.3 |
| `attendance.remote_exception.request` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.break.start` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.break.end` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.break.read` | Owner, DataEntry, CallCenter, Developer | - | 3.3 |
| `attendance.days_off.manage` | Owner | Owner + 2FA | 3.3 |
| `business.list` | Owner, DataEntry, CallCenter, Developer | - | 3.4 |
| `business.search` | Owner, DataEntry, CallCenter, Developer | - | 3.4 |
| `business.read` | Owner, DataEntry, CallCenter, Developer | - | 3.4 |
| `business.create` | Owner, DataEntry | - | 3.4 |
| `business.duplicate_check` | Owner, DataEntry | - | 3.4 |
| `business.duplicate_review_request` | DataEntry | - | 3.4 |
| `business.update` | Owner, DataEntry | - | 3.4 |
| `business.archive` | Owner | Owner + 2FA | 3.4 |
| `business.restore` | Owner | Owner + 2FA | 3.4 |
| `business.delete` | (nobody) | - | 3.4 |
| `business.history.read` | Owner, DataEntry, CallCenter, Developer | - | 3.4 |
| `business.read_hidden` | Owner | Owner + 2FA | 3.4 |
| `category.list` | Owner, DataEntry, CallCenter, Developer | - | 3.5 |
| `category.create` | Owner | Owner + 2FA | 3.5 |
| `category.rename` | Owner | Owner + 2FA | 3.5 |
| `category.deactivate` | Owner | Owner + 2FA | 3.5 |
| `correction.submit` | Owner, CallCenter, Developer | - | 3.6 |
| `correction.read` | Owner, DataEntry, CallCenter, Developer | - | 3.6 |
| `correction.withdraw` | Owner, CallCenter, Developer | - | 3.6 |
| `correction.review` | Owner, DataEntry | - | 3.6 |
| `correction.apply` | Owner, DataEntry | - | 3.6 |
| `correction.reject` | Owner, DataEntry | - | 3.6 |
| `correction.close` | Owner, DataEntry | - | 3.6 |
| `calling.queue.read` | Owner, CallCenter | - | 3.7 |
| `calling.assign` | Owner | Owner + 2FA | 3.7 |
| `calling.reassign` | Owner | Owner + 2FA | 3.7 |
| `calling.unassign` | Owner | Owner + 2FA | 3.7 |
| `calling.autofill` | Owner | Owner + 2FA | 3.7 |
| `reservation.acquire` | Owner, CallCenter | - | 3.7 |
| `reservation.renew` | Owner, CallCenter | - | 3.7 |
| `reservation.release` | Owner, CallCenter | - | 3.7 |
| `reservation.override` | Owner | Owner + 2FA | 3.7 |
| `call.log_attempt` | Owner, CallCenter | - | 3.7 |
| `call.set_outcome` | Owner, CallCenter | - | 3.7 |
| `business.reopen_rejected` | Owner | Owner + 2FA | 3.7 |
| `business.requeue` | Owner | Owner + 2FA | 3.7 |
| `follow_up.create` | Owner, CallCenter | - | 3.7 |
| `follow_up.reschedule` | Owner, CallCenter | - | 3.7 |
| `follow_up.complete` | Owner, CallCenter | - | 3.7 |
| `follow_up.cancel` | Owner, CallCenter | - | 3.7 |
| `follow_up.read` | Owner, CallCenter | - | 3.7 |
| `call_attempt.list_do_not_call` | Owner, CallCenter | - | 3.7 |
| `call_attempt.list_opportunities` | Owner | - | 3.7 |
| `deal.read` | Owner, Developer | - | 3.8 |
| `deal.list_closed` | Owner, Developer | - | 3.8 |
| `deal.assign_developer` | Owner, CallCenter | - | 3.8 |
| `deal.update_stage` | Owner, Developer | - | 3.8 |
| `deal.record_signature` | Owner, Developer | - | 3.8 |
| `deal.record_payment` | Owner, Developer | - | 3.8 |
| `deal.request_closure_verification` | Developer | - | 3.8 |
| `deal.verify_closure` | Owner | Owner + 2FA | 3.8 |
| `deal.finalize` | Owner | Owner + 2FA | 3.8 |
| `deal.reject_closure` | Owner | Owner + 2FA | 3.8 |
| `deal.mark_not_proceeding` | Owner, Developer | - | 3.8 |
| `deal.reopen_not_proceeding` | Owner | Owner + 2FA | 3.8 |
| `meeting.create` | Owner, CallCenter, Developer | - | 3.8 |
| `meeting.reschedule` | Owner, CallCenter, Developer | - | 3.8 |
| `meeting.mark_missed` | Owner, CallCenter, Developer | - | 3.8 |
| `meeting.complete` | Owner, CallCenter, Developer | - | 3.8 |
| `meeting.read` | Owner, CallCenter, Developer | - | 3.8 |
| `project.read` | Owner, Developer | - | 3.8 |
| `project.board.read` | Owner, Developer | - | 3.8 |
| `project.update_status` | Owner, Developer | - | 3.8 |
| `project.assign_developers` | Owner | Owner + 2FA | 3.8 |
| `project.reopen_completed` | Owner | Owner + 2FA | 3.8 |
| `project.provision_retry` | Owner | Owner + 2FA | 3.8 |
| `task.create` | Owner, Developer | - | 3.8 |
| `task.update` | Owner, Developer | - | 3.8 |
| `task.complete` | Owner, Developer | - | 3.8 |
| `target.set` | Owner | Owner + 2FA | 3.9 |
| `target.read` | Owner, DataEntry, CallCenter, Developer | - | 3.9 |
| `work_item.read` | Owner, DataEntry, CallCenter, Developer | - | 3.9 |
| `work_item.create` | Owner | Owner + 2FA | 3.9 |
| `work_item.update` | Owner, DataEntry, CallCenter, Developer | - | 3.9 |
| `settings.read` | Owner | Owner + 2FA | 3.9 |
| `settings.read_public` | Owner, DataEntry, CallCenter, Developer | - | 3.9 |
| `settings.update` | Owner | Owner + 2FA | 3.9 |
| `notification.list` | Owner, DataEntry, CallCenter, Developer | - | 3.9 |
| `notification.mark_read` | Owner, DataEntry, CallCenter, Developer | - | 3.9 |
| `reminder.monitor.read` | Owner | Owner + 2FA | 3.9 |
| `reminder.send_again` | Owner | Owner + 2FA | 3.9 |
| `dashboard.owner.read` | Owner | Owner + 2FA | 3.10 |
| `report.read` | Owner | Owner + 2FA | 3.10 |
| `dashboard.self.read` | Owner, DataEntry, CallCenter, Developer | - | 3.10 |
| `report.export` | Owner | Owner + 2FA | 3.10 |
| `audit.read` | Owner | Owner + 2FA | 3.10 |
| `audit.export` | (nobody) | - | 3.10 |
| `audit.update` | (nobody) | - | 3.10 |
| `audit.delete` | (nobody) | - | 3.10 |

---

## 7. Environment and deployment map

Backend config (`backend/src/config/index.ts`, `config.*` names; production refuses to start without the marked values):
- Core: `NODE_ENV` (unset = production), `PORT` (5000), `DATABASE_URL` or `DB_HOST`, `DB_PORT` (5432), `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `MIGRATION_DATABASE_URL` (migrate only), `SESSION_SECRET` (>= 32 chars, required in production), `TOTP_ENC_KEY` (32 bytes, required in production), `TOTP_ENC_KEY_ID` (default k1), `TOTP_ENC_PREVIOUS_KEYS`, `TOTP_ISSUER`.
- Origins and cookies: `APP_ORIGIN` (required in production), `CORS_ORIGIN`, `PUBLIC_APP_URL` (email link base; falls back to `APP_ORIGIN`; default in dev `http://localhost:3000`), `COOKIE_SECURE`, `SESSION_COOKIE_NAME` (default `__Host-udigity_session` in production), `CSRF_COOKIE_NAME` (`__Host-udigity_csrf`), `ALLOW_MISSING_ORIGIN` (dev default true), `TRUST_PROXY`, `TRUSTED_PROXY_CIDRS`.
- Sessions and auth: `SESSION_IDLE_MINUTES` (120), `SESSION_ABSOLUTE_HOURS` (12; alias `SESSION_MAX_AGE_HOURS`), `SESSION_PENDING_2FA_MINUTES` (10), `OWNER_PENDING_2FA_SCOPE`, `LOCKOUT_MAX_FAILURES` (5), `LOCKOUT_WINDOW_MINUTES` (15), `LOCKOUT_DURATION_MINUTES` (15), `AUTH_RATE_LIMIT_MAX` (20), `AUTH_RATE_LIMIT_WINDOW_MINUTES` (15), `PASSWORD_MIN_LENGTH` (12), `PASSWORD_RESET_TTL_MINUTES` (30), `PASSWORD_BCRYPT_ROUNDS`, `RECOVERY_CODE_BCRYPT_ROUNDS`.
- Attendance aliases: `COMPANY_TIMEZONE`, `OFFICE_IP_ALLOWLIST`, `ATTENDANCE_OFFICE_MODE` (mapped to POLICY_* values).
- Email: `EMAIL_TRANSPORT` (log / smtp / memory / none), `EMAIL_FROM`, `EMAIL_ALLOW_REAL_SEND`, `EMAIL_LOG_LINKS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`; `ALERT_EMAIL_TO` (operator alerts, J-14).
- Policy registry: `POLICY_FLAGS` in `backend/src/shared/flags.ts` (70 keys; each has a `POLICY_*` override name, e.g. `POLICY_COMPANY_TIMEZONE`, `POLICY_ATTENDANCE_OFFICE_IPS`, `POLICY_RESERVATION_LEASE_SECONDS`). Values not yet approved are labelled "Demonstration alternative - not approved" (`DEMO_LABEL`).
- Test only: `TEST_DATABASE_URL`, `PROBE_DATABASE_URL` (scripts and tests).

Frontend env (`frontend/src`, `next.config.mjs`):
- `INTERNAL_API_URL` (server-side rewrite `/api/* -> backend`; default `http://localhost:5000` in `next.config.mjs:10` and `src/proxy.ts:24`).
- `NEXT_PUBLIC_CSRF_COOKIE_NAME` (`lib/api/http.ts:17`), `NEXT_PUBLIC_PASSWORD_MIN_LENGTH` (default 12, `app/reset-password/page.tsx:18`).
- `NEXT_PUBLIC_ENABLE_DEV_PERSONAS` and `NEXT_PUBLIC_DEV_SEED_PASSWORD` (`lib/devFlags.ts`; ignored when `NODE_ENV=production`).
- Runtime: `NODE_ENV`, `PORT`, `HOSTNAME`, `NEXT_TELEMETRY_DISABLED`.

Compose, development (`docker-compose.yml`, project `udigity`):
- `db`: postgres:17-alpine; host `127.0.0.1:55433` to 5432; volume `devdata`; POSTGRES_PASSWORD `udigity_dev_local_only` in file.
- `backend`: built from `devops/backend.Dockerfile`; command runs `node dist/db/migrate.js` then `node dist/index.js`; `127.0.0.1:5000`; hard-coded `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN`/`CORS_ORIGIN`/`PUBLIC_APP_URL` = `http://localhost:3000`; `NODE_ENV=development`, `TRUST_PROXY=true`, `ALLOW_MISSING_ORIGIN=true`; healthcheck `/healthz`.
- `worker`: same image, `node dist/worker.js`, no port, `EMAIL_TRANSPORT=log`.
- `frontend`: built from `devops/frontend.Dockerfile`; `3000:3000` (published on all host interfaces, not 127.0.0.1); `INTERNAL_API_URL=http://backend:5000`.
- Network `udigity-net` (bridge); volume `devdata`.

Compose, test (`docker-compose.test.yml`): `test-db` postgres:17-alpine on `127.0.0.1:55432`, tmpfs data, fsync off; throwaway password in file.

Compose, production (`docker-compose.prod.yml`, runbook `devops/README.md`):
- `db`: postgres:17-alpine; no published port; networks `internal`; volumes `pgdata`, `wal_archive` (`/wal`), init scripts `devops/postgres/init`; `archive_mode=on`, `archive_timeout=900`; env from `devops/env/postgres.env`.
- `backend`: image `udigity-backend:${UDIGITY_TAG}`; `read_only`, `user 1000:1000`, `cap_drop ALL`; env `devops/env/backend.env`; networks `internal`; healthcheck `/readyz`; no published port.
- `migrate` (profile `tools`): same image, `node dist/db/migrate.js`, owner credentials from `devops/env/migrate.env` (only this service).
- `worker`: `node dist/worker.js`; networks `internal` and `egress` (outbound SMTP); healthcheck `GET http://backend:5000/health/worker`.
- `frontend`: `INTERNAL_API_URL=http://backend:5000`, `PORT=3000`, env `devops/env/frontend.env`; networks `internal`; healthcheck `/login`.
- `backup`: `devops/backup.Dockerfile`; volume `backups` (or host path `BACKUP_VOLUME`); mounts `wal_archive`; `backupd.sh health`; env `devops/env/backup.env`.
- `nginx`: nginx 1.27-alpine; ports `${HTTP_PORT:-80}:80` and `${HTTPS_PORT:-443}:443`; networks `internal` and `public`; mounts `devops/nginx/nginx.conf`, `devops/nginx/conf.d`, certs (`${NGINX_CERTS_DIR:-./devops/nginx/certs}`), `devops/nginx/acme`.
- Networks: `internal` (internal: true), `public`, `egress`. Volumes: `pgdata`, `wal_archive`, `backups`.

Nginx (`devops/nginx/nginx.conf`, `conf.d/udigity.conf`):
- Upstreams `backend` (backend:5000) and `frontend` (frontend:3000), keepalive 16.
- Port 80: `/nginx-health`, ACME challenge, everything else 301 to https.
- Port 443 (TLS 1.2/1.3, certs `/etc/nginx/certs/fullchain.pem` and `privkey.pem`): `server_name app.example.com`.
- Blocked (404): `/healthz`, `/readyz`, `/health/`, `/health`.
- Rate zones (`nginx.conf:36-47`): `auth` 10 r/min (applies to `/api/auth/`, burst 10), `authme` 10 r/s (`/api/auth/me`), `api` 20 r/s (`/api/`, burst 40), `web` 30 r/s (everything else), `perip` connection cap.
- Static `/_next/static/` cached 1 year immutable.
- Security headers include HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy.

Hard-coded hostnames and origins (source, config and devops; docs excluded):
- `app.example.com`: `devops/nginx/conf.d/udigity.conf:1,16`; `devops/env/backend.env.example:43,44,47,49` (APP_ORIGIN, CORS, PUBLIC_APP_URL); `devops/scripts/prod-smoke.sh:15`; `devops/scripts/check-env.sh:223`; `devops/README.md:81`. Placeholder only; no production hostname is configured in the repository.
- `example.com`: placeholders in `devops/env/backend.env.example:111`, `check-env.sh:169`, `prod-smoke.sh:91,92`.
- `localhost:3000`: `docker-compose.yml:47-49`; `backend/src/config/index.ts:255` (dev default origin).
- `localhost:5000`: `frontend/next.config.mjs:10`, `frontend/src/proxy.ts:24` (fallback when `INTERNAL_API_URL` unset).
- `127.0.0.1:5000` / `55432` / `55433`: compose files, `devops/scripts/test-db-up.*`, `e2e/` scripts (test).
- `name@udigity.com`: placeholder text only, `frontend/src/app/reset-password/page.tsx:186`.
- `@udigity.demo` persona accounts: `frontend/src/app/login/page.tsx:22-25` (dev personas only).
- `hrsystem` and `systemmanagement`: not present in any code, config, compose, nginx or devops file (present only in review docs). Known conflict K-1 (brief vs earlier chat) is therefore not reflected anywhere in the repo.

---

## 8. Dead, mock and placeholder indicators (user-facing and runtime)

Frontend:
- `frontend/src/app/audit/page.tsx:151-155`: Export button disabled, "Export is not available" (audit.export not in v1).
- `frontend/src/components/delivery/ProjectBoard.tsx:290`: "Edit schedule is not designed yet" (disabled button).
- `frontend/src/app/do-not-call/page.tsx:111,142`: static "Start Contact disabled" copy and disabled button.
- `frontend/src/lib/api/identity.ts:59-63`: comment says PATCH /api/employees/me and password change are "NOT shipped", but flags are `profileUpdate: true` and `passwordChange` is the path (stale comment). Line 68: "other two are proposed paths only (not shipped)" (stale).
- `frontend/src/app/profile/page.tsx:133` client check accepts 8 characters; backend `PASSWORD_MIN_LENGTH` default is 12 (`backend/src/modules/identity/routes.ts:60`). Mismatch.
- `frontend/src/components/businesses/format.ts:5`: TODO (FE1 `useCompanyTime`) (timezone rendering).
- `frontend/src/components/calling/LogAttemptPanel.tsx:162`: "Demonstration alternative" save-after-loss branch (`keepAttemptOnly`).
- `frontend/src/components/ui/NoticePolicy.tsx:6,32`: user-visible label "Demonstration alternative - not approved" for policy-driven screens.
- `frontend/src/components/owner/EmployeeDrawer.tsx:396` and `components/owner/EmployeeTable.tsx:11`, `lib/api/employees.ts:47`: "Not available yet" when a module has not shipped its count (never shown as 0).
- `frontend/src/components/attendance/CheckInFlow.tsx:101`: "Remote requests are not available. The Owner records remote work." (copy; remote-exception self-request UI is not wired).
- `frontend/src/lib/devFlags.ts:10-14` and `app/login/page.tsx:21-26`, `components/layout/Header.tsx:54-55,142-143`: dev persona quick-login with fallback password literal `Password123!` (only when `NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true` and not a production build; off in `devops/env/frontend.env.example:11`).
- `frontend/src/app/reset-password/page.tsx:17`: "Demonstration alternative, not approved" comment (copy and rules).
- No mock data or fixtures remain in `frontend/src` (`lib/api/calling.ts:10` and `businesses.ts:5` say the fixtures were deleted). The e2e config says journeys were "still mocked as of 2026-10-23" (`e2e/playwright.config.ts:11`, stale comment).

Backend:
- `backend/src/shared/errors.ts:112`: `notImplemented()` helper (HTTP 501). Used by `reservation/service.ts:134-137` as the default acquire guard (replaced when `modules/calls/module.ts:27` registers the real guard), and caught in `employees/service.ts:167-179` so unshipped open-item counts show `null`.
- `backend/src/modules/notifications/emailStub.ts:14-34`: `sendEmailStub` has no caller outside tests (dead code; logs links to the console).
- `backend/src/modules/duplicates/module.ts` and `routes.ts`: module with no mounts and an empty router (placeholder module, "MOD-duplicates").
- `backend/src/shared/platform.ts:25`: `reports.daily_snapshot` JobKind declared, never registered ("not in v1, OQ-17").
- `backend/src/modules/businesses/routes.ts:161-167`: `DELETE /api/businesses/:id` throws "unreachable" behind a guard granted to nobody (C-01 placeholder).
- Placeholder audit and outbox event names awaiting approval (tagged "placeholder" / "G2"): `shared/outbox.ts:38,42-44,48,50,53-54,57`; `modules/attendance/service.ts:572,681,1004,1231,1382,1504,1558,1591,1617,1650,1883,2123,2142`; `modules/employees/service.ts:295,346,365`; `modules/identity/routes.ts:488,498,696,771,1062`; `modules/identity/bootstrap.ts:106,134,145`; `modules/businesses/service.ts:321`; `modules/work/service.ts:208`. The admin audit API flags these (`modules/admin/repo.ts:99`, `PLACEHOLDER_AUDIT_NAMES`).
- Policy defaults marked "Demonstration alternative - not approved" (label `DEMO_LABEL`, `shared/flags.ts:23`), used across modules (for example `modules/notifications/service.ts:1315`, `modules/platform/retention.ts:6`, `modules/reports/service.ts:222`, `shared/rateLimit.ts:44`, `config/index.ts:288-326`, `middleware/auth.ts:150`, `modules/identity/security.ts:154` R11-b). Placeholder CFG values: `shared/flags.ts:140-142` (`company.timezone`, `business.defaultCountryCode`, `deals.defaultCurrency` labelled placeholder).
- `backend/src/config/index.ts:308`: auth rate limit noted as placeholder.
- `backend/src/db/seed-demo.ts`: demo data generator (not part of the runtime path; `seed.ts` and `e2e-seed.ts` are other seeds).
- Stub comment in `backend/src/app.ts:75` ("plus the stub mounts"); the mounts are real.

Counts of TODO / FIXME in `backend/src` and `frontend/src` (non-test): only one TODO found in production code (`frontend/src/components/businesses/format.ts:5`).

---

## Gaps noticed

Facts only; no fixes proposed here.

1. Public hostname: neither `systemmanagement.udigity.com` nor `hrsystem.udigity.com` appears in repo code or config. Every origin placeholder is `app.example.com`. Conflict K-1 is unresolved in the repo.
2. Dev compose publishes the frontend on all interfaces (`"3000:3000"`) while DB and API bind to 127.0.0.1.
3. Dev compose file contains the dev DB password, `SESSION_SECRET` and `ALLOW_MISSING_ORIGIN=true` as literals (local only; the same values are not used in prod files).
4. Profile password change client check (8 characters) disagrees with the server minimum (12 by default).
5. Stale comments in `frontend/src/lib/api/identity.ts:59-68` contradict the flags and paths below them.
6. Backend endpoints with no UI caller (section 2b): remote-exception grant/approve/reject/revoke and list, attendance sessions family, `settings/public`, `attendance/settings/test-office-check`, `meetings/attendee-options`, `PATCH /api/projects/:id`, `GET /api/tasks`, `GET /api/tasks/:id`, `GET /api/meetings/:id`.
7. Many exported `lib/api` functions are not imported (section 3d); pages fetch the same endpoints through `useApi` with raw strings in several places, so two contracts exist for some endpoints.
8. Nginx `auth` zone is 10 requests per minute (burst 10) for all `/api/auth/` routes, including login, 2FA and reset. Requests above that rate are refused by nginx before reaching the app (configuration fact; not load-tested).
9. Nginx `server_name` and certificate paths are placeholders (`app.example.com`); the stack cannot serve a real host until these are set.
10. Worker `reports.daily_snapshot` JobKind has no registration (declared only).
11. Outbox events `password_reset.assistance_triggered` and `password_reset.completed` are declared but never emitted in v1; `call_outcome.changed` has no consumer (reporting only).
12. Matrix rows with no route use: `dashboard.self.read`, `session.revoke`, `auth.password_reset.assist`, `audit.export`, `audit.update`, `audit.delete`.
13. Email sink stub `emailStub.ts` is unused in runtime code.
14. Access view `access_facts` was rewritten five times (900 to 903, 992). The current definition is in 992; earlier versions are not dropped.
15. Migrations 993 (fixed four roles) and 994 (custom roles on) are both present; the net state is custom roles ON per Owner decision S-26.
16. Placeholder names for audit and outbox events (section 8) are still in code; the admin audit screen labels them through `placeholderName`.
17. Report export step-up is enforced in the service, not as middleware, so any new export route must repeat the check.
18. Matrix admin flag and Owner 2FA enforcement live in the access engine (`shared/access.ts`, `modules/access/*`), which this inventory did not trace line by line.
