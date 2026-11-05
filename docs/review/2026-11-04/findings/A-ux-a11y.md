# A - Product, UX and accessibility QA (Agent A, browser)

Date: 2026-11-04. Tested commit: `1644e29` on `review/2026-11-04-fixes` (production build of `frontend`, no source edits).
Stack: throwaway DB `udigity_test_ux` (migrations + `seed.ts` + `seed-demo.ts`, ~30 businesses, deals, projects, attendance), backend :5200
(`NODE_ENV=test`, e2e env copied from `run-e2e.sh`; the seeds were run with `NODE_ENV=development`, no conflict), frontend :3200. Chromium via Playwright,
axe-core (WCAG 2.0/2.1 A+AA). Viewports 1440x900 and 390x844 (touch), light and navy dark, timezone Asia/Beirut, locale en-GB.
All data is synthetic. No secrets are printed or stored. Screenshots: `docs/review/2026-11-04/evidence/ux/A-*.png`.
Confidence: **Confirmed** = reproduced in the browser (screenshot or measured); **Suspected** = inferred, not proven.
Only A-01 and A-02 are proposed as release-relevant; everything else is a Low or Medium polish/compliance item.

## Counts

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | |
| High | 1 | A-02 (confirms B-03) |
| Medium | 3 | A-01, A-12, A-13 |
| Low | 18 | A-03 ... A-11, A-14 ... A-22 |

Total 22: functional 11 (A-01...A-11), accessibility 6 (A-12...A-17), visual/design 5 (A-18...A-22).

## Top issues

1. A-02 (High) Assigned Developer cannot reach accepted opportunities: the second Deals tab is permanently disabled with no explanation; policy D15 says assigned Developers see them.
2. A-01 (Medium) Session expiry while editing/viewing gives no sign-in prompt: save shows a small red "Authentication required"; polled pages stay on screen with stale data.
3. A-12 (Medium) Horizontally scrollable tables on mobile are not keyboard focusable (axe `scrollable-region-focusable`, serious, 5 routes x 2 themes).
4. A-13 (Medium) No "skip to content" link; 24 sidebar links come before `<main>`.
5. A-14 (Low) Every page has the identical `<title>` "Udigity Management System".
6. A-09 (Low) "Assign developers" dialog briefly labels an active developer "Inactive" while the list loads.
7. A-03 (Low) "Send again" is offered on Pending delivery rows; the server then refuses it.
8. A-17 (Low) Repeated unlabelled action buttons (Start / Mark done / Cancel... on every task card; "Send again" x50; "Revoke").
9. A-18 (Low) A long unbroken business name is clipped in the page heading on mobile.
10. A-21 (Low) Dashboard and Deals deviate from the approved previews (compare toggle, role/employee filters, default filters).

## Verified OK (the review's new UI and main cross-cutting behaviour)

- **Remote exceptions Owner screen** exists (Attendance, right column). Grant dialog: labelled fields, required markers, helper text explaining the disabled submit ("Choose the employee."), "The last day is before the first day." message, focus moves into the dialog, Tab cycles inside it (0 of 14 stops outside), Escape closes and returns focus to "Grant exception", double-click on the submit sent one POST, Revoke asks for a reason first. Evidence `A-remote-exceptions-owner-screen.png`, `A-grant-exception-dialog.png`, `A-remote-exception-revoke-dialog.png`. (B-02 is addressed; date format nit is A-08.)
- **Rate limit on login**: five wrong passwords from one context, then "Sign-in failed / Too many attempts. Try again in 15 minutes." (not "password incorrect"); the form stays usable; a valid login while limited is refused with the same message. Empty submit shows field messages. Evidence `A-login-rate-limited.png`, `A-login-validation.png`. (Used a temporary backend on :5200 with `AUTH_RATE_LIMIT_MAX=5`, then restarted it with 5000.)
- **Mobile "More" drawer**: lists every destination of the role (Owner 25 = whole sidebar + Profile, Data Entry 8, Call Center 11, Developer 10; compared with the sidebar link lists), scrolls to the last item, Tab stays inside the drawer (0 of 30 stops outside), Escape returns focus to "More", tapping an item navigates and closes it. B-12 is fixed. Evidence `A-mobile-more-drawer-owner.png`.
- **Assign developers dialog** (Projects > "Manage developers"): lists active developers with checkboxes, unchecking all asks for a second confirmation ("Remove every developer?"); axe clean; fits at 390 px with Save visible. Evidence `A-assign-developers-empty-confirm.png`. The page button is "Manage developers" while the dialog title is "Assign developers" (naming mismatch, see A-17).
- **Meeting drawer**: "Schedule meeting" has a business select limited to businesses with an open deal (helper text explains why) and a host select; an existing meeting's drawer lists attendees ("Maya Khoury, Lina Aoun") plus Reschedule/Cancel forms. Evidence `A-schedule-meeting-drawer.png`, `A-meeting-drawer-attendees.png`.
- **Delivery monitor** with 130 synthetic failed/pending rows: 50 per page, "Showing 51-100 of 130", Previous/Next, status filter and kind tabs work, counts update, axe clean. Evidence `A-delivery-monitor-page2.png`.
- **Export truncation notice**: step-up dialog (one-time-code input, wrong code message "That code is not valid..."), then with the response headers set to truncated the page shows "Export is incomplete ... cut off at 50000 rows. Narrow the date range ..." and still downloads the file. The truncated headers were simulated with `route.fulfill`; the real cap was not reached. Evidence `A-export-truncation-notice.png`, `A-export-stepup-wrong-code.png`.
- **Dashboard charts**: hover shows a per-mark tooltip (readable in navy); keyboard: focus the chart and ArrowRight steps the tooltip day by day. Evidence `A-dashboard-chart-hover-dark.png`, `A-dashboard-chart-keyboard.png`.
- **Break timer** (Call Center): "Take a break" opens a type/note form, double-click on "Start break" sent one POST, timer ran (00:00:02, then 00:01:04 after 62 s), survives reload (00:01:07), "Resume work" ends it. Evidence `A-break-timer-running.png`.
- **Input preserved / offline / duplicate submit** (observed): mid-save connection drop (`route.abort`) shows "We could not confirm this was saved: the connection dropped. Your input is kept on this page. Check whether the change went through before you try again." and the form values were still present; `setOffline` shows "You're offline - Saving is paused until your connection returns. Nothing has been sent."; a double-click on "Save business" produced exactly 1 POST. Evidence `A-save-connection-dropped.png`, `A-offline-banner.png`.
- **Archive/restore**: archive asks "Archive this business?" (optional reason, says nothing is deleted), Escape cancels and returns focus to the trigger; restore asks "Restore this business?". Evidence `A-archive-confirmation.png`.
- **403 / 500** (network stubs): permission-denied panel with Go to My Day / Back; "Couldn't load deals - Your data is safe - Try again". Direct URL to a forbidden page (Call Center on /employees) shows "You don't have access to this page". Evidence `A-403-midview.png`, `A-500-state.png`.
- **Visible focus**: 59 consecutive Tab stops on /businesses, Project board (dark), Calling queue, Deals (dark): every stop had an outline or ring and stayed inside the viewport.
- **Navy dark mode** is consistent across the Owner pages and mobile pages sampled. Evidence `A-dark-owner-sheet.png`, `A-dark-mobile-sheet.png`.
- **axe** over all 528 page visits (4 roles x 33 routes x 2 viewports x 2 themes): only the issues in A-12, A-15, A-16; login, 2FA challenge, dialogs and drawers opened in the scripts were axe clean.
- Business list: search, category filter, "No matches / Clear filters" empty state, 8-per-page pager all work.

## Findings

### A-01 - Medium - Non-blocker - Confirmed (functional)
**Requirement:** session expiry while editing (review brief); B-16. **Role:** all.
**Location:** `GlobalErrorRouting`, `useApi` polling, save handlers.
**Reproduction:** Data Entry, `/businesses/new`, fill a valid form, clear the session cookie (`context.clearCookies()`), press Save business. Second case: Call Center on `/my-day`, clear the cookie, wait 12 s.
**Expected vs actual:** expected a clear "Your session ended - sign in again" path that keeps the draft. Actual: save answers only with a small red "Authentication required" next to the buttons; the whole signed-in shell (name, menu, "Checked in 08:49") stays; no redirect to `/login` or `/session-ended`. On My Day the page keeps stale content (elapsed timer, targets) after 12 s with a dead session although it polls. Only a fresh navigation redirects (`/login?redirect=%2Fbusinesses`). Input is preserved (good).
**Evidence:** `A-session-expired-while-saving.png`, `A-session-expired-polling-stale-myday.png`.
**Proposed fix:** route any 401 from a mutation or a poll to the session-ended view with a sign-in link that returns to the same URL; keep the draft until then.
**Regression test:** Playwright: clear cookie, trigger save/poll, expect the session-ended banner and unchanged field values.
**Limitations:** the cookie was cleared in the browser, not expired by the server.

### A-02 - High - Candidate blocker - Confirmed (UI); policy question open
**Requirement:** policy D15 ("Accepted opportunities: Assigned Developer and Owner only"), B-03. **Role:** Developer (and the Owner on this tab).
**Location:** `frontend/src/components/delivery/DealsList.tsx:84-92`: the "Accepted opportunities" tab is a hard-coded `disabled` button, no tooltip or explanation; "Opportunities & Handoffs" is Owner-only in the nav.
**Reproduction:** log in as Lina Aoun (Developer), open Deals.
**Expected vs actual:** the approved preview `SCR-DEV-001` shows the same two tabs with a chip "DEC-005 tab only if Alt 1", i.e. the tab is conditional on an undecided alternative; the built page shows a permanently greyed tab with no reason, and no other screen gives a Developer their open (pre-closure) deals or the contact details and call notes D15 lists. The footnote says "no pre-closure or unassigned rows".
**Evidence:** `A-compare-deals-preview-vs-built.png`.
**Proposed fix:** Owner decision on DEC-005 (Alt 1 vs closed-only). If closed-only stays, remove the dead tab; if Alt 1, build the list for assigned Developers.
**Limitations:** this review does not resolve the policy alternative.

### A-03 - Low - Confirmed (functional)
Delivery monitor offers "Send again" on **Pending** rows; clicking it shows "Only a failed or suppressed item can be sent again" (server rule). Hide or disable the button for non-failed rows with a reason. Evidence `A-delivery-send-again-pending-error.png`.

### A-04 - Low - Confirmed (functional/visual)
Owner on Meetings & calendar: the default "My meetings" chip hides every meeting (the Owner hosts none), so the week looks empty; the chip text wraps onto two lines ("My / meetings"). Clicking the chip did not visibly clear it in my run (not re-tested). Evidence `A-meetings-owner-chip-wrap.png`.

### A-05 - Low - Confirmed (functional)
List state is not in the URL: Businesses page 2, sort and filters reset on reload and after Back from a detail page (reload returns to "Showing 1-8 of 31"). No deep links to a filtered view.

### A-06 - Low - Confirmed (copy)
"Edit schedule" on a project is disabled with the title text "Edit schedule is not designed yet (deferred)": developer jargon shown to the user. Use a plain reason or hide the control.

### A-07 - Low - Confirmed (functional)
Denied pages still call forbidden endpoints before showing the denied view (Call Center on `/audit`: 403 on `/api/settings`, `/api/employees`, `/api/audit-events`; similar on /employees, /reports, /settings, /targets, /deals, /projects). Harmless to the user, noisy for monitoring and for the per-IP read limits. Check capability before fetching. Data Entry and Developer on `/calendar` (follow-ups, Call Center feature) render the page header with 403 requests behind it; I did not look at that body state closely.

### A-08 - Low - Confirmed (visual/copy)
Attendance monitor: remote-exception dates are printed as `2026-11-06 - 2026-11-07` (ISO) while the rest of the app uses "4 Nov 2026"; the Verification column shows the raw token "mode ip" under "Recorded" (the preview says "Mode pending"); the Date filter starts empty (preview: today). Evidence `A-remote-exceptions-owner-screen.png`.

### A-09 - Low - Confirmed (transient)
Assign developers dialog: while "Loading active developers..." is shown, an already assigned developer appears with an orange "Inactive" badge and Save is disabled; it corrects itself once the list loads. Evidence `A-assign-developers-mobile-inactive-flash.png`.

### A-10 - Low - Suspected
"Check out" stays enabled (no explanation) while a break is running on My Day. Not clicked; whether the break auto-ends or the checkout is refused was not observed.

### A-11 - Low - Confirmed
Login: after an empty submit the field messages appear but focus stays on the Sign in button instead of moving to the first invalid field.

### A-12 - Medium - Non-blocker - Confirmed (accessibility)
**Requirement:** WCAG 2.1.1 / axe `scrollable-region-focusable` (serious). **Location:** `.overflow-x-auto` table wrappers.
At 390 px tables scroll inside a container (Corrections, Attendance monitor, Opportunities, Do-not-call, Search results; Employees, Audit and Calling assignments also overflow: scrollWidth 720/914/841 vs 390) but the container has no focusable content or `tabindex="0"`, so keyboard and switch users cannot scroll to hidden columns (Employees "Status", Deals "Developer"). Flagged on 14 page visits (7 per theme). The page itself does not scroll sideways (scrollX stays 0). Evidence `A-mobile-employees-table-scroll.png`.
**Fix:** `tabindex="0"`, `role="region"` and an accessible name on each scroll wrapper, or a stacked card layout on mobile.

### A-13 - Medium - Non-blocker - Confirmed (accessibility)
No skip link (a search for "skip" in `frontend/src` finds none). The Owner has 24 sidebar links before `<main>` (WCAG 2.4.1). Add a "Skip to main content" link, visible on focus.

### A-14 - Low - Confirmed (accessibility)
Every route returns `document.title` "Udigity Management System" (measured on /employees, /audit, /corrections, /search, /calling-assignments, /attendance/monitor, /opportunities). Users of assistive technology and browser history cannot tell pages apart (WCAG 2.4.2). Set a per-page title.

### A-15 - Low - Confirmed (accessibility)
`/settings/roles` (Owner): axe `label-content-name-mismatch` (button `aria-label="Hide Attendance & Time options"` does not contain its visible text, WCAG 2.5.3) and `color-contrast` 4.12:1 for 10 px text at 75% opacity (light theme).

### A-16 - Low - Confirmed (accessibility)
Owner `/queue/<id>`: the "Calling Queue" breadcrumb link is distinguished from surrounding text only by colour (link to text contrast 1.1:1; axe `link-in-text-block`, serious, all 4 theme/device combinations). Add underline or weight.

### A-17 - Low - Confirmed (accessibility)
Controls whose accessible name repeats without context: task cards on the project board ("Start", "Mark done", "Cancel..." with no `aria-label`; 4 identical "Mark done" in one project), "Send again" x50 on one monitor page, "Revoke" per remote exception. Add the item name to `aria-label`. The page button "Manage developers" opens a dialog titled "Assign developers".

### A-18 - Low - Confirmed (visual)
A long unbroken business name (197 characters) is cut off at the right edge of the `<h1>` on mobile (no wrap or ellipsis, text lost) and truncated in the breadcrumb on desktop. List and search views cope. Evidence `A-long-name-clipped-mobile.png`. Add `overflow-wrap: anywhere`.

### A-19 - Low - Confirmed (visual)
Mobile: Correction requests tabs are cut ("Open / Resolved / Closed / With..."), the Delivery monitor "Any state" filter is cut and "All Items" wraps, the Businesses search placeholder is truncated ("Search name, phone or"). Evidence `A-mobile-corrections-tabs-cut.png`, `A-delivery-monitor-mobile.png`.

### A-20 - Low - Confirmed (copy/visual)
Add Business footer: "Created by and last updated by are set by the system when you save." (words missing). The "Last post" date input is clipped (`mm/dd/yyy`). Native date inputs show `mm/dd/yyyy` although the context locale is en-GB (Chromium behaviour; not verified on the Owner's browser); Settings "Shift start (24h)" shows "09:00 AM". Evidence `A-new-business-form.png`.

### A-21 - Low - Confirmed (visual vs approved design)
Deviations from the approved previews (reported, not redesigned): the Dashboard has no "Compare" toggle, role or employee filters (only Today / 7 days / 30 days / Custom) and different cards (status and pipeline bars instead of "Businesses now" / "Pipeline events"); Deals defaults to "All eligible deals / Closed: any time" (preview "Assigned to me / last 30 days"), uses "Verified closed" (preview "Closed deal") and the business name as row title; content width differs between Notifications, Reports, Check-in (narrow column) and other pages. Matches closely: Login, Employees, Calling queue, Attendance monitor layout and hierarchy. Evidence `A-compare-*.png`, `A-dashboard-owner-light.png`.

### A-22 - Low - Confirmed (visual)
The Owner sidebar is taller than the viewport at 900 px (nav scrollHeight 1118 vs 754): the Calling and Delivery sections sit below the fold and are reachable only by scrolling the nav, with no hint that more items exist.

## Coverage matrix

Legend: V = visited by script with screenshot + axe + console + overflow probe (every route listed, per role, desktop/mobile x light/dark); I = interactive scenario run; numbers are finding IDs; "denied" = the role sees the permission-denied view (checked).

| Screen | Owner | Data Entry | Call Center | Developer |
|---|---|---|---|---|
| Login, 2FA challenge, forgot link (d+m, light+dark) | I: A-11 | - | I (rate limit) | - |
| Dashboard `/` | V; I hover/keyboard: A-21 | redirects to My Day | redirects to My Day | redirects to My Day |
| My Day, check-in, check-out | V | V | V; I break timer: A-10 | V |
| My Attendance, Notifications, Profile | V: A-21 (width) | V | V | V |
| Attendance monitor + remote exceptions | V; I: A-08, A-12, A-17 | denied | denied: A-07 | denied |
| Attendance corrections, Employees, Targets, Calling assignments | V: A-12 (mobile) | denied | denied: A-07 | denied |
| Reports & exports | V; I step-up + truncation: 0 | denied | denied | denied |
| Delivery monitor | V; I pager/filter/send again: A-03, A-17, A-19 | denied | denied | denied |
| Audit, Settings, Roles studio | V: A-12, A-15 | denied | denied | denied |
| Businesses list/detail/new | V; I filters, archive/restore, long name: A-05, A-18 | V; I save drop/offline/expiry/duplicate: A-01, A-20 | V | V |
| Correction requests, Categories | V: A-12, A-19 | V | V | V |
| Calling queue, contact workspace | V: A-16 | denied | V (preview matches) | denied |
| Follow-ups, Opportunities, Do-not-call | V: A-12 | denied | V (follow-ups, DNC) | denied |
| Deals, Deal detail | V | denied | denied | V; I 403/500: A-02 |
| Meetings + schedule/meeting drawers | V; I: A-04 | denied | V | V |
| Projects, Project board, Assign developers | V; I desktop + mobile dark: A-06, A-09, A-17 | denied | denied | V |
| Search results | V: A-12, A-14 | V | V | V |
| Mobile "More" drawer | I (light, dark): 0 | I | I | I |

All 528 visits were checked by script; a screenshot was looked at by eye for a subset (those in the evidence folder). The rest were assessed by axe, overflow, console and text probes only.

## Output paths

- This file: `docs/review/2026-11-04/findings/A-ux-a11y.md`
- Evidence: `docs/review/2026-11-04/evidence/ux/` (37 PNGs, about 4.9 MB, synthetic data)
- Scripts and raw crawl JSON (not in the repo): `C:\Users\Hani\AppData\Local\Temp\claude\a25399f2550b68da\b1ed2321-d7ef-454b-bbf7-54f33e576861\scratchpad\agent-a\`

## Not covered

- Loading/skeleton states (screens loaded too fast to capture) against the approved "Loading" previews; check-in and check-out flows (verification failure, provisional, open-session block) were visited but not driven; correction drawer, task drawer conflict (B-05), deal command dialogs (record delivered, close), role create/edit, employee drawer, reassign impact dialog, Owner 2FA enrolment/recovery and password-reset flows, bulk-assign actions.
- Real server-side session expiry, a real permission change while a page is open (only simulated at the network with 403/500 stubs), the real export row cap, real email delivery.
- Screen-reader and real-device testing; 200% zoom/text size; reduced motion; forced-colours mode; contrast beyond axe (chart series colours not measured manually).
- Time zone display only seen in Asia/Beirut with en-GB; a browser in another time zone was not tried (B-10 not re-verified).
- Sorting beyond the Businesses name column; pagination of other lists; "large list" beyond the 130-row delivery monitor and the 1297-event audit log.
- Visual comparison covered Login, Employees, Attendance monitor, Calling queue, Deals and Dashboard against the previews; the other ~45 preview frames were not compared one by one.
