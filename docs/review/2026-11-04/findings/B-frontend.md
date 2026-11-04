# B - Frontend engineering and wiring (Agent B, discovery only)

Date: 2026-11-04. Tested commit: local HEAD `cab5ec9` plus the uncommitted Owner work in `ProjectBoard.tsx` and `lib/api/projects.ts`.
Method: static read of `frontend/src` against `backend/src/modules/*/routes.ts` and `schemas.ts`. No browser, no servers, no source edits.
Commands run in `frontend`: `npx tsc --noEmit -p .` (clean), `npx vitest run` (6 files, 35 tests pass), `npx eslint src` (2 errors, both in the uncommitted ProjectBoard work, see B-01).
Confidence labels: Confirmed = proven by the code as read; Suspected = follows from the code but needs a browser or server run to prove; Not tested = not exercised.
Source-of-truth order used: Owner decisions (docs/decisions.md), policy baseline 2026-10-29, Figma, code.

## Counts

| Severity | Count | Blockers |
|---|---|---|
| Critical | 0 | 0 |
| High | 3 | B-01, B-02, B-03 (candidate) |
| Medium | 16 | none proposed |
| Low | 15 | none |
| Total | 34 | |

## Top issues (one line each)

1. B-01 `npm run lint` (a CI step) fails on the uncommitted Assign-developers work (2 eslint errors).
2. B-02 The approved remote-exception policy (D3) has no Owner screen: nobody can grant, approve or revoke one in the UI.
3. B-03 An assigned Developer has no list of open (pre-closure) deals; the Deals list is closed-only and the second tab is permanently disabled.
4. B-04 Deals search and project-status filters only filter the current page, although the backend now supports both.
5. B-05 The task drawer saves with the live polled version, so another person's concurrent edit is never reported as a conflict.
6. B-06 Project and meeting commands send no Idempotency-Key, so a retry after a lost response turns the user's own saved change into a false "save conflict".
7. B-07 Every `useApi` polls every 4 s by default and keeps polling after a 403 or 404; with several tabs this approaches the 600 GET / 5 min server budget.
8. B-08 Logout ignores failure; offline or on a 5xx the UI shows "signed out" while the session cookie stays valid.
9. B-09 SWR cache is not cleared on logout or login: the next user in the same tab can briefly see the previous user's cached lists.
10. B-10 The whole Delivery area ignores the company timezone (browser time for meetings, due dates, overdue, notifications) and the week navigation drifts across DST.
11. B-11 Custom roles are only half wired: several screens test `role === 'owner' | 'data_entry'` instead of the capability list.
12. B-12 On mobile there is no way to reach most screens (tab bar shows My Day, two destinations and Profile; the sidebar is desktop-only).

## Verified OK (no finding)

- Every `*Paths` constant in `lib/api/*.ts` resolves to an existing mounted Express route (path and method). The only backend routes never called are listed in B-20.
- Shapes match their backend DTOs: deals (all 8 stages incl. `signed`, `paid`, `signed_and_paid`, `closed`, `not_proceeding`), projects (incl. `cancelled`, `cancelReason`, `allowed.cancel`), meetings, attendance session/correction/today/overview, dashboard metrics, notifications, delivery monitor, `/auth/me`, roles. Earlier `fullName`/`name` drift is not present: `AssignableDeveloper` is `{id, name}` and the backend sends exactly that.
- Attendance session states include `pending_review` and `closed_provisional`; deal stage and project status labels exist for every value.
- Missing values show "-" or "Not recorded", not zero (dashboard `num()`, `moneyText`, `TargetBar`).
- No secrets in client code. `localStorage` holds only the theme. No `console.log`. `DEV_PERSONAS_ENABLED` is forced false in production builds. No `as any` except B-01.
- `INTERNAL_API_URL` is baked into the Next rewrite at build time, but `devops/frontend.Dockerfile` and `docker-compose.prod.yml` pass it as a build arg, so production is correct.
- `src/proxy.ts`: per-request nonce CSP, `strict-dynamic`, no `unsafe-inline` for scripts, reset-password `Referrer-Policy: no-referrer`, pending-2FA redirect logic matches `authRoutes.ts` (unit-tested).
- Open-redirect guard `safeRedirectTarget` and the reset-token removal from the URL (`history.replaceState`) are correct.
- Reservation heartbeat (`useContactSession`) releases on `pagehide` with `keepalive`, handles RESERVATION_LOST, keeps drafts.
- Calling save, business create, deal commands and the Opportunities handoff keep one Idempotency-Key across retries and only renew it after a definitive 4xx.

## Findings

### B-01 - High - Blocker (CI) - Confirmed
**Requirement:** CI step "Frontend lint" (`.github/workflows`, `npm run lint --workspace=frontend`). **Role:** n/a.
**Location:** `frontend/src/components/delivery/ProjectBoard.tsx:796-801` and `:815` (uncommitted work).
**Reproduction:** in `frontend`, run `npx eslint src`.
**Expected vs actual:** expected 0 errors; actual 2: `react-hooks/set-state-in-effect` (the `useEffect` that calls `setSelectedIds` / `setError` when the dialog opens) and `@typescript-eslint/no-explicit-any` (`catch (e: any)`).
**Root cause:** the dialog resets its draft state inside an effect and types the catch variable as `any`.
**Proposed fix:** reset the selection when the dialog opens (key the dialog on `isOpen` or on open-event, or derive the initial state when `pending` is set), and use `catch (e)` with `e instanceof ApiError`.
**Regression test:** the CI lint step itself.
**Verification:** `cd frontend && npx eslint src` exits 0.
**Limitations:** other files lint clean.

### B-02 - High - Blocker - Confirmed (UI absent); policy fit to confirm
**Requirement:** baseline D3 / DEC-010 (APPROVED): "The Owner can grant a remote exception for a specific employee and date/range ... reason required, audited, labelled remote". **Role:** Owner; any employee blocked by the office check.
**Location:** backend routes `POST /api/attendance/remote-exceptions`, `.../:id/approve|reject|revoke`, `GET /remote-exceptions` (`attendance/routes.ts:246-267`); frontend `lib/api/attendance.ts:24` defines `remoteExceptions` but nothing calls it. Only the self-request `POST .../requests` is used (`components/attendance/CheckInFlow.tsx:99`).
**Preconditions:** office verification configured in Settings (IPs or hostnames).
**Reproduction:** as an employee outside the office network press Check in -> blocked -> "Request remote exception" -> the server refuses (flag `attendance.remoteSelfRequest` defaults false) and the UI says "The Owner records remote work" (`CheckInFlow.tsx:103`). Sign in as Owner: no screen anywhere lists, grants, approves or revokes a remote exception (search `remote` in `components/owner`: only status labels).
**Expected vs actual:** the Owner can grant a remote exception from the UI; actual: impossible without calling the API by hand. The Owner's fallback (adjust / retroactive session) also has no entry point for retroactive creation (`POST /api/attendance/sessions` unused).
**Proposed fix:** add an Owner "Remote exceptions" panel (employee, date range, reason; list with revoke) in the attendance area, wired to the four routes.
**Regression test:** Playwright: Owner grants exception, employee outside office checks in and the session shows "Remote".
**Limitations:** I could not check whether the Owner decided to defer this; docs/decisions.md was not searched beyond the D3 lines.

### B-03 - High - Blocker candidate - Confirmed (UI); verify against Figma sitemap "Developer"
**Requirement:** D15 and D16: the assigned Developer works accepted opportunities and open deals, records signature and payment, requests closure, marks not proceeding. **Role:** Developer.
**Location:** `components/delivery/DealsList.tsx:41` (`const [tab] = useState<'closed'>('closed')`), `:48-57` (`tab: 'closed'`), `:86-94` (second tab `disabled`), nav `lib/nav.ts` (Opportunities is Owner-only, matrix `call_attempt.list_opportunities` = Owner).
**Reproduction:** sign in as a Developer with an assigned, not yet closed deal -> Deals shows only "Closed deals", "Accepted opportunities" is greyed out. Opportunities is not in the menu. The only paths to the open deal are a meeting link or a notification link.
**Expected vs actual:** a list of the Developer's open deals; actual: none. `GET /api/deals?tab=accepted` exists and is already used by the schedule-meeting picker (`ScheduleMeetingDrawer.tsx:63`).
**Proposed fix:** enable the "Accepted opportunities" tab for `deal.read` users using `tab=accepted&scope=assigned_to_me`.
**Regression test:** Developer sees an assigned open deal in the list and can open it.
**Limitations:** I did not read the Figma frames; confirm whether the tab was intentionally deferred.

### B-04 - Medium - Non-blocker - Confirmed
**Location:** `components/delivery/DealsList.tsx:48-66`. Comment at `lib/api/deals.ts:83` ("the deal list has no `q` or `projectStatus` filter") is out of date: backend `ListDealsQuery` has `q`, `projectStatus`, `from`, `to` (`deals/schemas.ts:85-109`).
**Reproduction:** with more deals than one page (PAGE_SIZE) type a business name that sits on page 2 -> "no deals match" while the badge still shows the full total; the project-status dropdown likewise hides rows only on the loaded page.
**Fix:** send `q` and `projectStatus` to the server (note `q` needs 2-80 chars) and reset to page 1.
**Test:** unit test of `dealListPath` plus an e2e search on page 2.

### B-05 - Medium - Non-blocker - Confirmed
**Location:** `components/delivery/TaskDrawer.tsx:121` (`save(draft, task.version)`) with `:67-68` (`base` captured once at mount) and `ProjectBoard.tsx:603-606` (the `task` prop is the live polled record, 4 s refresh).
**Reproduction:** A opens task X (version 3). B saves X (version 4) and changes the due date. Within 4 s A's drawer receives version 4; A then edits the due date and saves: the patch is computed against A's stale `base`, sent with version 4, accepted with no 409. B's change is overwritten silently. The same pattern, to a lesser degree, applies to `DealDialogs` (live `deal.version`).
**Expected:** the version the user started editing from is sent so the server returns 409 `VERSION_CONFLICT` and `SaveConflict` shows.
**Fix:** send `baseTask.version`, not the prop's version; keep the drawer from silently adopting newer data.
**Test:** component test: change the `task` prop version after mount, assert the PATCH carries the original version.

### B-06 - Medium - Non-blocker - Confirmed (code); effect Suspected
**Location:** `projects.ts:194-211` (`changeProjectStatus`, `reopenProject`, `cancelProject`, `assignProjectDevelopers` never pass an `idempotencyKey`), `meetings.ts:79-97` (reschedule, held/missed, cancel the same), while `useVersionedSave` documents a key "stable for the whole user action, including retries" (`useVersionedSave.ts:10-14`) and `ProjectBoard.tsx:127-134` ignores `ctx.idempotencyKey` for status changes.
**Reproduction:** change a project status, drop the connection after the request leaves (or the response is lost), reload nothing, press "Try again": the retry carries the old version -> 409 -> the save-conflict screen appears for the user's own successful change.
**Fix:** thread `ctx.idempotencyKey` into these client functions (routes already accept `Idempotency-Key`, `required:false`).
**Test:** unit test that `useVersionedSave.retry` sends the same header twice.

### B-07 - Medium - Non-blocker - Confirmed (code); load Suspected
**Location:** `lib/hooks/useApi.ts:26-30` (`refreshInterval: 4000` default for every caller) and backend `shared/rateLimit.ts` (`apiRead` 600 GETs / 5 min per user).
**Facts:** SWR keeps polling after an error, so a persistent 403/404 is re-requested every 4 s while the component is mounted. Example: `ScheduleMeetingDrawer.tsx:71-75` calls the Owner-only `/api/employees` for a Developer or Call Center user: a 403 every 4 s while the drawer is open. A project board is about 30 GET/min (detail + deal), a deal detail about 45/min, plus the 20 s unread badge. One tab is within budget (120/min); three or four tabs, or a burst of filter typing, reach 429 `RATE_LIMITED` and every screen shows errors.
**Fix:** default `refreshInterval` to 0 and opt in only where freshness matters (queue, notifications), or 30 s; stop polling on 4xx (`refreshInterval: (data) => error ? 0 : n`); use `GET /api/meetings/attendee-options` (B-20).
**Test:** load test with 3 tabs on the project board, watch for 429.

### B-08 - Medium - Non-blocker - Confirmed
**Location:** `lib/auth.tsx:218-224`. `logout()` awaits `apiFetch('/api/auth/logout')` but ignores `ok`, then clears the CSRF token, sets the user to null and routes to `/login`.
**Reproduction:** go offline (writes are refused by `offline.ts`, status 0) or hit a 5xx, press Sign out: the UI lands on the login page, but the server session and cookie are still valid; the next page load, or `/me` revalidation, restores the user. On a shared PC the user believes they are signed out.
**Fix:** on failure keep the user signed in and say "Could not sign you out. Try again."; or retry with `keepalive`.
**Test:** unit test with a failing fetch.

### B-09 - Medium - Non-blocker - Suspected
**Location:** no global cache reset anywhere (grep `mutate(() =>`, `SWRConfig provider`: none); `lib/auth.tsx` `logout`/`login` only touch `/api/auth/me`. String keys such as `/api/dashboard`, `/api/employees...`, `/api/notifications`, `/api/deals...` carry no user id; business hooks key by role only (`components/businesses/hooks.ts`).
**Reproduction:** Owner views Employees and Dashboard, signs out, a second person signs in on the same tab (client navigation, no reload). SWR returns the cached lists immediately (stale-while-revalidate) before the new user's fetch finishes.
**Fix:** on logout and on a successful login clear the SWR cache (`mutate(() => true, undefined, {revalidate:false})`) or hard-navigate (`window.location.assign('/login')`).
**Test:** e2e: sign in as Owner, sign out, sign in as Developer, assert no Owner text flashes.

### B-10 - Medium - Non-blocker - Confirmed
**Requirement:** show times in company timezone (`useCompanyTime`; baseline D1). **Roles:** Owner, Developer, Call Center.
**Location:** none of `components/delivery/*` imports `useCompanyTime`. Browser time is used in `delivery/shared.tsx:25-39` (`fmtTime`, `fmtDayMonth`, `toLocalInput`, `todayInput`), `MeetingsView.tsx:31-36,54-62,68-71,231,254` (`mondayOf` with `setHours`, `getDay`), `ScheduleMeetingDrawer.tsx:22-30,106,123` (`datetime-local` -> `new Date(...).toISOString()`), `TaskDrawer.tsx` (overdue vs `todayInput()`), `app/notifications/page.tsx:221`, `app/delivery-monitor/page.tsx:238`, `RelevantCallNotes.tsx:44`, `DuplicateBlocked.tsx:113` (`toLocaleString(undefined)`; also a different date format from the `en-GB` used elsewhere).
**Reproduction:** set the company timezone to Asia/Beirut, open Meetings from a browser set to another zone (a travelling Owner, a remote Developer): meeting times, week columns, "start cannot be in the past" and overdue days all use the browser zone. Week navigation (`shift` adds `n * 86_400_000` ms to a local midnight) moves 1 hour off midnight after a DST change, so later weeks show meetings in the wrong day column.
**Fix:** format and bucket by company timezone (`useCompanyTime().format/dayKey`), convert `datetime-local` using the company zone (as `components/calling/format.ts toIso` already does), advance weeks by date arithmetic.
**Test:** unit tests with `TZ` set to a DST zone; e2e with a browser timezone different from the company's.

### B-11 - Medium - Non-blocker - Confirmed
**Requirement:** custom roles ON (S-26); capabilities are the permission source (`/api/auth/me` `capabilities`).
**Location:** role-name checks: `components/businesses/BusinessDetailView.tsx:320` (`canEdit = role === 'data_entry' || 'owner'`) and `:447,:496`, `app/do-not-call/page.tsx:30` (reopen), `app/queue/[businessId]/page.tsx:47` and `components/calling/ContactWorkspace.tsx:252,521,530` (override, inbound), `components/businesses/ResolveCorrectionDrawer.tsx:104`, `app/businesses/page.tsx:40`, `components/calling/FollowUps.tsx:347`, `lib/hooks/useCompanyTime.ts` (settings key only for `role==='owner'`).
**Reproduction:** create a custom role with `business.update` (or `reservation.override`) and assign it: the Edit / Override / Reopen controls never appear although the server would allow the call.
**Fix:** replace with `useCapability(ACTIONS...)`/`can()`; the UI already has most action names in `lib/actions.ts`.
**Test:** unit test of `actionAllowed` plus an e2e with a custom role.

### B-12 - Medium - Non-blocker (verify against Figma "Mobile - bottom tabs and focused flows") - Confirmed
**Location:** `lib/nav.ts mobileTabs` (My Day + at most 2 role destinations + "More" = `/profile`); `components/layout/AppShell.tsx` renders `Sidebar` only at `md:`; `MobileNav.tsx` has no menu; `app/profile/page.tsx` has no navigation list.
**Reproduction:** Owner on a phone: tabs are My Day, Dashboard, Queue, More(Profile). Employees, Reports, Settings, Targets, Audit, Deals, Projects, Businesses are reachable only by typing the URL or by in-page links. Data Entry cannot reach Add Business or Categories; Call Center cannot reach Do-not-call; Developer cannot reach Projects.
**Fix:** make "More" open a sheet with all `visibleSections`.
**Test:** mobile e2e that every nav item is reachable.

### B-13 - Medium - Non-blocker - Confirmed
**Location:** `app/login/page.tsx:80-88` and `lib/auth.tsx:137-154`. Any failed login except `TOO_MANY_ATTEMPTS` shows "Email or password is incorrect.", including network failure (`status 0`, the real message "Network error occurred" is discarded), 5xx and 403.
**Reproduction:** sign in while the backend is down or offline: the user is told the password is wrong and may start a reset.
**Fix:** distinguish `OFFLINE`/`NETWORK_ERROR`/5xx ("We could not reach the server") from `INVALID_CREDENTIALS`.

### B-14 - Medium - Non-blocker - Suspected
**Location:** `lib/api/offline.ts:19-21,40-44`, `http.ts:80-84`. A `fetch` rejection on a mutation always yields "Not saved: the connection dropped". The request may already have reached the server (response lost, proxy reset, 60 s timeout), and most client functions send no idempotency key (see B-06, plus profile PATCH, categories, targets, work items, employees update, role updates).
**Reproduction:** save a target, kill the network after the request is sent -> "Not saved ... Try again" -> the user saves again -> duplicate or 409 on a write that actually succeeded.
**Fix:** word it "We could not confirm this was saved; check before trying again" for post-send failures, and add idempotency keys to the remaining writes.

### B-15 - Medium - Non-blocker - Confirmed
**Location:** `lib/api/businesses.ts` and every form except business create/edit: `components/businesses/useUnsavedChangesGuard.ts` only adds a `beforeunload` handler and is used in 2 files (`businesses/new`, `businesses/[id]/edit`).
**Reproduction:** fill the business form (or a Settings / Employee / Target form), click a sidebar link: the page changes with no prompt and the input is lost. The session-ended dialog also tells the user "Your unsaved changes were not saved" with only a Link to /login.
**Fix:** guard client navigation (intercept links / `beforeunload` + route-change confirm) for dirty forms.

### B-16 - Medium - Non-blocker - Suspected
**Location:** `components/layout/AppShell.tsx:24-37`, `lib/auth.tsx:96-103`, `lib/hooks/useErrorRouter.ts`. Only `LogAttemptPanel` calls `routeError`; other mutation 401s show a form error. Pages with `refreshInterval: 0` (reports, settings, roles, targets) never poll, so no 401 reaches `GlobalErrorRouting`. `/api/auth/me` revalidates on focus and a 401 sets the user to null, which makes `resolveGuardRedirect` send the page to `/login` (spinner, page unmounted) unless the "ended" signal was raised first.
**Reproduction:** open Settings, type a long value, let the session expire, return to the tab: `/me` and the page race; if `/me` wins, the user is redirected to login and the typed input is lost with no "session ended" dialog.
**Fix:** treat a 401 from `/me` while a protected page is mounted as `signalSessionEnded('expired')` first; route 401s from every mutation catch.
**Test:** e2e that expires the session mid-edit and asserts the dialog and the retained input.

### B-17 - Medium - Non-blocker - Confirmed
**Location:** `ScheduleMeetingDrawer.tsx:71-75` calls `/api/employees` (Owner-only, `employee.list`); the purpose-built `GET /api/meetings/attendee-options` (`meetings/routes.ts:42`, action `meeting.create`) is never called.
**Reproduction:** Developer or Call Center schedules a meeting: the staff picker is unavailable (the code says so) and the 403 repeats every 4 s (B-07). Attendees are only "me + host".
**Fix:** use `attendee-options`.

### B-18 - Medium - Non-blocker - Confirmed
**Location:** `app/delivery-monitor/page.tsx:73` (`pageSize: 50`, no pager), `:166` (count badge shows `data.total`), only `kind` is sent although the route accepts `state`; `provisioning` kind has no filter tab; `:83-90` swallows retry errors with `console.error`.
**Reproduction:** more than 50 items: the oldest failed delivery cannot be reached; press "Send again" while the API fails -> nothing happens and no message.
**Fix:** add pagination and a Failed/Pending state filter; show an error toast.

### B-19 - Medium - Non-blocker - Confirmed (code review of the uncommitted work)
**Scope reviewed:** "Assign developers" in `ProjectBoard.tsx:263-290,590-600,777-878` and `projects.ts:208-211`.
**Wiring OK:** `POST /api/projects/:id/developers`, body `{version, developerIds[]}` equals `AssignProjectDevelopersBody` (strict, max 20), response `{project}` equals the client type; `p.allowed.assignDevelopers` is the server flag (Owner-only, `requireOwner`); picker uses `GET /api/deals/developers` (`{items:[{id,name}]}`, gate `deal.assign_developer` = Owner, Call Center, so it works for the Owner). Project detail refreshes through `retry()`.
**Problems:**
1. Lint failure (B-01).
2. Not using `useVersionedSave`: a 409 shows the raw server message in an Alert instead of the standard save-conflict screen (`catch (e: any)` -> `e.message`), a 401 is not routed, the offline message works only via `e.message`.
3. No Idempotency-Key (B-06).
4. The effect resets `selectedIds` whenever `project.developers` changes; if another Owner changes developers while the dialog is open (4 s polling), the user's ticks are overwritten without notice, and the save uses `project.version` of the live record (same issue as B-05).
5. A currently assigned developer who is now inactive is not in the picker list but stays in `selectedIds`; saving silently keeps or (if the server rejects) fails without explaining.
6. Saving with nothing ticked removes every developer without a confirmation.
7. Two entry points for the same action (inline "Assign…/Edit…" link without focus ring or `cursor-pointer`, and a header button).
**Fix:** use `useVersionedSave` + `DeliveryConflict`, pass the key, snapshot `project.version` when the dialog opens, confirm removal of all developers.

### B-20 - Low - Non-blocker - Confirmed
Backend routes never called by the UI: `GET /api/meetings/attendee-options` (B-17), `GET /api/settings/public`, `GET|POST /api/attendance/sessions`, `GET /api/attendance/sessions/:id`, `POST /sessions/:id/resolve-review` (failed-checkout review, DEC-026 alternative), `POST /api/attendance/settings/test-office-check`, `GET /api/attendance/remote-exceptions` and decisions (B-02), `PATCH /api/projects/:id` (name/schedule), `GET /api/reports/export`, `GET /api/auth/2fa/recovery-codes` path constant. Decide per route: build the UI, or remove the route.

### B-21 - Low - Non-blocker - Confirmed
**Location:** `ProjectBoard.tsx:279-286` "Edit schedule" is a permanently disabled button (title "not designed yet (deferred)") visible to every user; tasks have no start date in the UI although the backend sends and accepts `startDate` (`lib/api/projects.ts Task`, `TaskPatch`, `NewTask` lack the field; FX-BE-C6). Dead button and drift.

### B-22 - Low - Non-blocker - Confirmed
**Location:** `public/` holds 157 design PNGs (4.5 MB: "00 Cover & Index", "01 Sitemap & Navigation" ... "11 Owner (Admin)", one named `Screenshot (522).png`). `src/proxy.ts` matcher skips any path with an extension, and the Dockerfile copies `public` into the image, so these are served without sign-in at `https://<host>/01%20Sitemap%20...png`. They show internal screens and flows. Fix: move the images out of `public/` (e.g. `docs/`).

### B-23 - Low - Non-blocker - Confirmed
**Location:** `components/layout/AppShell.tsx:62-77` renders a "Restricted Owner session" banner when `isOwner2faPending`, but the guard at `:24-37` redirects every pending session away from non-login pages, so the banner is unreachable. Also an already active user opening `/login?step=2fa` sees the 2FA challenge (`app/login/page.tsx:35-45`) and a wrong code shows "Code is incorrect" instead of redirecting home; `/login` with no step never redirects a signed-in user.

### B-24 - Low - Non-blocker - Confirmed
**Location:** `app/page.tsx:9` statically imports `DashboardCharts` (recharts). Non-Owner users land on `/`, download the chart chunk, then are redirected to `/my-day`. Use `next/dynamic` for the Owner dashboard body.

### B-25 - Low - Non-blocker - Confirmed
**Location:** search inputs are not debounced or cancelled: `app/employees/page.tsx:30` and `app/audit/page.tsx:100` use `useDeferredValue` (not a debounce), businesses/corrections filters write straight to the SWR key. Every keystroke is a GET (`swrFetcher` passes no `AbortSignal`), consuming the budget in B-07 and returning out-of-order work.

### B-26 - Low - Non-blocker - Suspected
**Location:** `app/settings/roles/RoleEditor.tsx:119-143` protects against concurrent edits by comparing `updatedAt` from a second GET and then PATCHing (time-of-check/time-of-use; the roles API has no `version`). `app/settings/roles/page.tsx:73-80` retries a 409 by inventing a new role id, which can create a duplicate role if the first create had succeeded but the response was lost. `roles.ts` creates a fresh idempotency key on every call, so a user retry never reuses it.

### B-27 - Low - Non-blocker - Confirmed
**Location:** `app/categories/page.tsx:80-83` sends `row?.version ?? 1` when the row is missing; conflict text is the raw server message (`fieldMessage`). `components/owner/EmployeeDrawer.tsx:158-166` "Review the latest version" closes the drawer and drops the user's edits instead of showing a diff.

### B-28 - Low - Non-blocker - Confirmed
**Location:** `components/delivery/DealDialogs.tsx:36-38` shows raw numeric strings (`12000.00 USD`) with no grouping or locale; the client accepts amounts with more than 2 decimals (`DealDialogs.tsx:215`) that the server rejects (`multipleOf(0.01)`), so the error comes back from the server.

### B-29 - Low - Non-blocker - Confirmed
**Location:** `app/layout.tsx:27-28` puts `suppressHydrationWarning` on both `<html>` and `<body>`; it hides every hydration mismatch in the body, not just the theme attribute. Prefer it on `<html>` only. Currently nothing renders time-dependent text on the server (pages show the session spinner until `/me` loads), so no live mismatch was found.

### B-30 - Low - Non-blocker - Confirmed
**Location:** `src/proxy.ts:53-63`: every document and RSC navigation calls the backend `GET /api/auth/me` (2.5 s timeout, fails open to "pass"). Adds latency to each page change and doubles `/me` traffic (the client also calls it). `NEXT_PUBLIC_PASSWORD_MIN_LENGTH` (`reset-password/page.tsx:18`) is a build-time copy of a backend policy and can drift.

### B-31 - Low - Non-blocker - Confirmed
**Location:** `components/auth/EnrollmentFlow.tsx:226-238`: setup shows only the text key and an `otpauth://` link, no QR code; an Owner without the authenticator on the same device must type the key. The recovery codes are shown once and are lost if the tab reloads before acknowledgement (by design; the copy says so).

### B-32 - Low - Non-blocker - Confirmed
**Location:** `lib/api/http.ts:79-85` `fetch` has no timeout or abort; a stalled backend leaves `Saving...` and disabled buttons forever, and the reservation heartbeat (`isNetwork`) never sees an error.

### B-33 - Low - Non-blocker - Confirmed
**Location:** repo hygiene found during review: a path-mangled directory `C:UsersHaniAppDataLocalTemp` exists in the repo root (`drill` inside), and my `tsc` run left `D:\udigity company\scratch_tsc.txt` (one line, outside the repo; deletion was blocked by the safety check, please remove it).

### B-34 - Low - Non-blocker - Confirmed
**Location:** `ROLE_DEFAULTS` in `lib/actions.ts` (used only when `/me` sends no capabilities) differs from the backend matrix: `target.read`, `business.list`, `meeting.read`, `meeting.create` include roles the table omits. Harmless while `/me` sends capabilities, wrong on an older backend.

## UI to API wiring matrix (main actions)

Status: OK = path, method, body and response shape match the backend as read (static). drift = mismatch or stale. dead = control cannot be used. untested = not traced.

| Role | Screen / action | Client call -> endpoint | Status |
|---|---|---|---|
| All | Sign in, 2FA verify, recover, enroll start/confirm | `apiFetch` -> `POST /api/auth/login`, `/2fa/verify`, `/2fa/recover`, `/2fa/enroll/start`, `/2fa/enroll/confirm` | OK; error copy drift (B-13) |
| All | Session, capabilities, sign out | `GET /api/auth/me`, `POST /api/auth/logout` | OK; logout failure unhandled (B-08) |
| All | Reset password | `POST /api/auth/password-reset/request|complete` | OK |
| All | Profile edit, change password, sign out everywhere | `PATCH /api/employees/me`, `POST /api/auth/password/change`, `/sessions/revoke-all` | OK |
| All | My Day, check in/out, correction request | `GET /attendance/me/today`, `POST /check-in`, `/check-out`, `/corrections`, `/corrections/:id/withdraw` | OK |
| All | Break start/end/active | `/attendance/breaks/*` | OK |
| All | Request remote exception | `POST /attendance/remote-exceptions/requests` | OK; no Owner counterpart (B-02) |
| All | My Attendance | `GET /attendance/me/sessions` | OK |
| All | Notifications list, mark read, mark all, badge | `GET /api/notifications`, `/unread-count`, `POST /:id/read`, `/read-all` | OK |
| All | Header search | `GET /api/search` | OK |
| Owner | Dashboard | `GET /api/dashboard?period=...&from&to` | OK |
| Owner | Reports and export (step-up) | `GET /api/reports`, `POST /api/reports/export` | OK; 401 not routed (B-16) |
| Owner | Employees list/create/edit/status/open items | `/api/employees`, `/:id`, `/:id/status`, `/:id/open-items` | OK |
| Owner | Enrollment token for another Owner | `POST /api/auth/2fa/enrollment-tokens` | OK |
| Owner | Roles and permissions | `/api/access/roles`, `/api/access/permissions` | OK; no version (B-26) |
| Owner | Settings (company, attendance), flags | `/api/settings`, `/settings/flags`, `/api/attendance/settings` | OK |
| Owner | Audit log | `GET /api/audit-events` | OK |
| Owner | Attendance monitor, corrections queue, adjust, approve, reject | `/attendance/overview`, `/corrections`, `/sessions/:id/adjust`, `/corrections/:id/approve|reject` | OK |
| Owner | Days off, employee schedule | `/attendance/days-off`, `/employees/:id/schedule` | OK |
| Owner | Grant/approve/revoke remote exception | `/attendance/remote-exceptions*` | dead: no UI (B-02) |
| Owner | Retroactive session, resolve review, office-check test | `/attendance/sessions`, `/resolve-review`, `/settings/test-office-check` | dead: no UI (B-20) |
| Owner | Targets and work lists | `/api/targets`, `/api/work-items` | OK |
| Owner | Calling assignments (assign, autofill, reassign impact, reassign, unassign, override) | `/api/calling-assignments/*`, `/api/reservations/:id/override` | OK |
| Owner | Opportunities and handoff, assign developer | `GET /api/calling/opportunities`, `GET /api/deals/developers`, `POST /api/deals/:id/developer` | OK |
| Owner | Delivery monitor, send again | `GET /api/delivery-monitor`, `POST /reminders/:id/send-again` | OK; no pager/filter (B-18) |
| Owner | Do-not-call reopen, requeue | `POST /api/calling/businesses/:id/reopen|requeue` | OK; role-name gate (B-11) |
| Owner | Project assign developers (uncommitted) | `POST /api/projects/:id/developers` | OK wiring; see B-01, B-19 |
| Owner | Project edit schedule | `PATCH /api/projects/:id` | dead: button disabled, endpoint unused (B-21) |
| Owner | Finalize, financial correction, reopen deal | `POST /api/deals/:id/finalize|financial-correction|reopen` | OK |
| Owner / Developer | Project status, reopen, cancel | `POST /api/projects/:id/status|reopen|cancel` | OK; no idempotency key (B-06) |
| Owner / Developer | Tasks create, edit, status, cancel | `POST /api/tasks`, `PATCH /api/tasks/:id` | OK; `startDate` missing (B-21), lock bypass (B-05) |
| Owner / Developer | Closed deals list | `GET /api/deals?tab=closed` | drift: search/status client-side (B-04) |
| Developer | Open (accepted) deals list | `GET /api/deals?tab=accepted` | dead: tab disabled (B-03) |
| Developer | Deal detail, record signature/payment, closure request, not proceeding | `GET /api/deals/:id`, `/history`, `POST /:id/signature|payment|closure-request|not-proceeding|advance-stage|contract|remove-fact` | OK |
| Developer | Provision retry / manual project | `POST /api/projects/:dealId/provision-retry`, `POST /api/projects` | OK (`:id` is the deal id, handled) |
| Owner / Developer / CC | Meetings list, schedule, reschedule, held, missed, cancel | `/api/meetings*` | OK; local-time (B-10), no key (B-06), attendee list (B-17) |
| Developer | Business view and correction request | `GET /api/businesses/:id`, `POST /api/correction-requests` | OK |
| Data Entry / Owner | Business list, create, edit, archive, restore | `/api/businesses*` | OK |
| Data Entry / Owner | Duplicate check and review request | `POST /api/businesses/duplicate-check`, `/duplicate-review-requests` | OK |
| Data Entry / Owner | Categories | `/api/categories*` | OK; version fallback (B-27) |
| Data Entry / Owner | Correction queue, resolve | `/api/correction-requests*` | OK |
| Call Center | Queue, workspace, reserve, heartbeat, release | `/api/calling/queue`, `/businesses/:id/workspace`, `/api/reservations*` | OK |
| Call Center | Log attempt, inbound rejection | `POST /api/calling/attempts`, `/attempts/inbound-rejection` | OK |
| Call Center | Follow-ups and calendar | `/api/follow-ups*` | OK |
| Call Center | Do-not-call list | `GET /api/calling/do-not-call` | OK |
| Custom role | Any screen gated by role name | n/a | drift (B-11) |
| Mobile (all) | Reach screens not in the 4 tabs | n/a | dead (B-12) |

Rows marked OK were traced on paths, bodies and response types, not exercised. Anything that needs a running server (real 409 flows, 429, offline) is Suspected or Not tested until the browser QA pass.

## Limitations

- Static review plus `tsc`, `eslint`, `vitest`; no `next build`, no servers, no browser, so bundle sizes, hydration warnings, SWR polling cadence and race findings (B-07, B-09, B-14, B-16) are inferred from code and SWR's documented behaviour.
- Components not read line by line: `CallingAssignments`, `ReassignImpactDialog`, `AttendanceMonitor`, `BusinessFormCards`, `ContactWorkspace` (reservation lifecycle read in `hooks.ts` only), `Settings` forms, `Table`/`Input` primitives. Their API calls were matched to routes but their internal state handling was not audited.
- Accessibility and visual fidelity are Agent A's scope and were not assessed.
- I did not read the Figma frames; B-03 and B-12 need a check against the sitemap images.
