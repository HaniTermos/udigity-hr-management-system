# Figma visual QA: page 41 (Owner screens)

Date 2026-10-28 · read-only pass · no source changed.
Build: production frontend http://localhost:3100, backend :5100, DB `udigity_test_figma_qa` (e2e seed). Signed in as Owner (`e2e/.auth/owner.json`). The Call Center session was used only for the non-Owner Reports state.
Design source: `docs/phase6/previews/41/*.png` (1440×900 desktop, 390×844 mobile). I made no Figma MCP calls because the previews answered every question.
App screenshots: `docs/implementation/qa/figma-diff/shots/41/` (named `OWN-<id>-<variant>.png`; DL = desktop light, DD = desktop dark, ML/MD = mobile).

**Data caveat.** The e2e seed has 7 businesses, no check-ins today, an empty correction queue and no delivery failures. The Figma frames show 248 businesses with exceptions. Where the seed state differs, I compared the app against the matching Figma *state* frame (Empty, etc.) and ignored numbers.

## Summary

| Screen | Variants checked | Verdict |
|---|---|---|
| SCR-OWN-001 Owner dashboard | DL, DD, hard-load of `/` | **Major** |
| SCR-OWN-002 Employees | DL, DD, Empty (no matches) | Minor |
| SCR-OWN-003 Employee create / edit drawer | Create new (DL), Edit (DL) | Minor |
| SCR-OWN-004 Attendance monitoring | DL, DD, ML (scrolled), MD | **Major** (mobile) / Minor (desktop) |
| SCR-OWN-005 Corrections & review | DL (= Empty queue state), DD | Minor |
| SCR-OWN-006 Targets & work lists | DL, DD | **Major** |
| SCR-OWN-007 Calling assignments | DL, DD | **Major** |
| SCR-OWN-008 Reassignment impact dialog | Initial + assignee-chosen (DL) | Minor |
| SCR-OWN-009 Reports & exports | DL, DD, Unauthorized non-Owner | **Major** |
| SCR-OWN-010 Audit log | DL, DD, Event detail | **Major** |
| SCR-OWN-011 Settings | DL (scrolled), DD, Security tab | **Major** |
| SCR-OWN-012 Delivery monitor | DL (= Empty state), DD | **Major** |

Counts across all findings below: **Major 16 · Minor 30 · Cosmetic 8** (findings that group several sub-points count once).

Not reached: loading skeletons (too fast to capture); Save-conflict, Validation, Success, Override-confirm and Export-failure states (reaching them would mean writing records or a forced 409); the Attendance "Exception detail" / "Alert delivery failed" states and the Delivery "Retrying" / "Failed item" states (the seed has no exceptions or failures); Corrections Alt A/B (empty queue); Targets "Ineligible / Insufficient work" (that structure does not exist, see OWN-006). Dark mobile was captured (`OWN-004-MD.png`) but only compared at a glance.

---

## Cross-cutting (app shell, every Owner screen)

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| X-1 | Minor | Sidebar 240 px; top bar 64 px; content starts x=264 | Sidebar 224 px; top bar 56 px; content x=248 (x=256 on Targets, x=320 centred on Reports/Settings) | `frontend/src/components/layout/Sidebar.tsx`, `Header.tsx`, `AppShell.tsx` | Set sidebar `w-60`, header `h-16`, one page container (`px-6`, no max-width) on every Owner page. |
| X-2 | Minor | Nav groups: Overview / People / Businesses / Calling / Delivery / Admin. Delivery Monitor shows a count badge. Bottom block has My Day (check in) + My Profile | Groups: Overview (adds My Day, My Attendance, Notifications) / People & Admin / Businesses (adds Add Business); no Calling or Delivery groups for Owner; no count badge | `Sidebar.tsx` (nav config) | Restore the Figma grouping and the Delivery badge. Keep the user-added items (Roles & Permissions) inside Admin. |
| X-3 | Minor | Top bar: 360 px bordered search with icon, "Search businesses and employees"; green "Checked in · 08:52" chip; avatar with name + role stacked; unread dot on bell | 384 px search without icon, "Search businesses, phones, handles"; grey chip; name only; theme toggle added | `Header.tsx` | Add the search icon and Figma placeholder, a status-coloured check-in chip, the role line under the name and the unread dot. The theme toggle can stay. |
| X-4 | Minor (intentional?) | Dark frames are neutral charcoal: canvas `#11151b`, surface `#1a2029`, sidebar `#071226` | Saturated navy: canvas `#0b1a36`, surface `#122953`, sidebar ≈ `#0b1a35` | `frontend/src/app/globals.css` (dark tokens) | No change if the 2026-10-23 "navy, not black" directive stands; otherwise update the Figma dark variables. **Needs a user decision.** |
| X-5 | Minor | Policy chips are short ("DEC-007", "DEC-020 pending") | Long text "DEC-0xx Demonstration alternative — not approved" on many screens. In narrow panels it wraps badly ("DEC-" / "007" on two lines) | `frontend/src/components/ui/NoticePolicy.tsx` (`PolicyPendingChip`) | Use the short Figma label, add `whitespace-nowrap` to the ID and move the long text to a tooltip. |
| X-6 | Cosmetic | Date controls show formatted dates ("Tue 20 Oct 2026", "14–20 Oct 2026") | Native `mm/dd/yyyy` inputs; on Attendance a leading icon *and* the native picker icon both show | Attendance / Audit / Reports pages | Use one date-picker component with a company-format display. |
| X-7 | Cosmetic | Table name cells at regular weight | Name cells 600 (semibold) in light and dark | `EmployeeTable.tsx`, `AttendanceMonitor.tsx` | Use `font-normal` for primary cell text, as in Figma. |

## SCR-OWN-001 Owner dashboard (`frontend/src/app/page.tsx`)
Shots: `OWN-001-DL.png`, `OWN-001-DD.png`, `OWN-001-DL-scroll.png`, `OWN-001-DL-navclick.png`

- **Major (functional):** a hard load or refresh of `/` as the Owner always redirects to `/my-day` (reproduced 3/3). The dashboard only appears after a client-side click on "Dashboard". `useEffect(() => { if (!allowed) router.replace('/my-day') })` runs before the session is `active`, so `allowed` is still false. Fix: wait for auth to finish loading (sessionState known) before redirecting.
- **Major:** the header is missing the date-range picker, "Compare previous period" checkbox, All roles and All employees filters. The app has only the Today / 7 days / 30 days / Custom segment and Export. Fix: add the filter row from the Figma header.
- **Major:** "Calling activity" has no bar chart and "Pipeline events" has no step chart. The app shows two number tiles and the text "A per-day breakdown is not available yet". Fix: add the per-day bar chart and cumulative line chart (or record this as deferred).
- Minor: KPI cards have no trend line ("+23 vs 161 (7–13 Oct)"). Attendance today uses three grey stat tiles instead of the "4 of 6 / 2 / 1" inline stats with avatar rows. The Exceptions list items differ (Missing checkouts / Failed deliveries / Failed reminders summary rows instead of per-item rows with Send again).
- Minor: the content is taller than 900 px. The bottom cards are cut off; in Figma the whole grid fits in the viewport. Cards are 271 px min-height (`CARD` constant) and KPI cards 158 px. Reduce to match Figma (KPI ≈ 156 px, cards ≈ 270 px, 16 px gaps; the top grid starts at y=148).
- Cosmetic: policy chips sit at the top of each card. Figma puts them under the content ("DEC-007 · DEC-008 · DEC-022" as one row).

## SCR-OWN-002 Employees (`frontend/src/app/employees/page.tsx`, `components/owner/EmployeeTable.tsx`)
Shots: `OWN-002-DL.png`, `OWN-002-DD.png`, `OWN-002-empty.png`

- Minor: the purple "No DEC ID · Open work of a deactivated employee…" notice beside the footnote is missing, and the footnote copy is shortened ("…until reassigned" instead of "…flagged 'assignee inactive' until you reassign in its own screen"). Fix: add the notice and restore the copy.
- Minor: the row action is a vertical kebab (⋮); Figma uses a horizontal "…".
- Minor: rows are sorted alphabetically. Figma puts the Owner first.
- Cosmetic: the filter row is 6 px lower (y=160 vs 154) and "6 results" is not vertically centred with the filters.
- The Empty (no matches) state matches the structure ("No employees match" plus Clear filters).

## SCR-OWN-003 Employee drawer (`components/owner/EmployeeDrawer.tsx`)
Shots: `OWN-003-create.png`, `OWN-003-edit-menu.png`

- **Major:** in Create, Role is pre-filled with "Call Center Specialist". Figma shows "Select one role" with no default. A silent default role is risky. Fix: an empty placeholder option, required.
- Minor: the footer (Cancel / primary) sits right after the form. Figma pins it to the bottom of the drawer with a top divider. Fix: a sticky footer.
- Minor: Create is missing the "Used for sign-in and the invitation link." helper under Email, the "Impl. decision · Credential setup…" notice and the "+000" country-code select on Phone. The Role helper copy differs.
- Minor (copy): the subtitle reads "Create an account; a set-password link is queued by email" instead of "New account · Owner only". The primary button reads "Add employee" instead of "Create employee".
- Cosmetic: section headings are uppercase caps ("PROFILE DETAILS", "ROLE AND STATUS"); Figma uses sentence-case semibold. In Edit, the Role / Account values are right-aligned; Figma uses a label | value two-column layout. "Send reset link" is an outlined button; Figma uses a ghost button.

## SCR-OWN-004 Attendance monitoring (`app/attendance/monitor/page.tsx`, `components/owner/AttendanceMonitor.tsx`)
Shots: `OWN-004-DL.png`, `OWN-004-DD.png`, `OWN-004-ML.png`, `OWN-004-ML-scroll2.png`, `OWN-004-MD.png`

- **Major (mobile):** the Figma mobile layout is a "Today" header, a 2×2 KPI grid, an "Exceptions · n" list card, a "Not checked in yet · n" list card and a bottom nav of Today / My Day / Alerts / More. The app renders the desktop page squeezed into 390 px: stacked Date / Employee / Corrections controls, 5 KPI cards, then the desktop table with status chips wrapping to 3 lines and columns cut off. The bottom nav is My Day / Dashboard / Queue / More. Fix: a dedicated mobile layout (card lists, no table, no filters as the register notes) and the Owner mobile nav from Figma (`components/layout/MobileNav.tsx`).
- Minor: visible "Date" and "Employee" labels sit above the header controls. Figma has none (the controls align with the title row, y=93).
- Minor: the Late arrivals KPI shows "0 · After grace period". Figma shows "—" with "Not configured · policy pending" and a DEC-008 chip, because grace is a pending policy. Showing 0 contradicts the "no fabricated zero" rule in the dashboard code.
- Minor: the policy chips under the table ("DEC-007/008 schedule & grace pending → Unclassified", "DEC-009 office check mode") are missing. The Exceptions panel chips wrap badly (X-5).

## SCR-OWN-005 Corrections & review (`app/attendance/corrections/page.tsx`, `components/owner/AttendanceCorrections.tsx`)
Shots: `OWN-005-DL.png`, `OWN-005-DD.png` (compared with "Empty queue")

- Minor: there is an extra tab, "Employee requests 0", between Review queue and Corrected sessions. This is likely the DEC-011 Alt B path; Figma folds requests into the queue. Confirm with the user, or merge it into Review queue.
- Minor (copy): the empty state reads "Nothing needs review / Sessions that stay open or are flagged show up here. Nothing is waiting." Figma reads "Nothing to review / Missing checkouts, correction requests (DEC-011 Alt B) and failed-checkout review items (DEC-026 Alt B/C) appear here."
- Cosmetic: tab counts are a teal pill badge; Figma uses an inline "· 0".

## SCR-OWN-006 Targets & work lists (`app/targets/page.tsx`)
Shots: `OWN-006-DL.png`, `OWN-006-DD.png`

- **Major:** the structure differs completely. Figma has a per-employee targets table (Employee / Metric / Progress / Work list) and a right-hand "Work list · <employee>" panel with Target only / Manual / Automatic proposal radios, a proposal list, a Rule B8 info box and "Hand off 40 to assignments". The app has three company-progress cards, an "Employee work list" task checklist and a "Targets & territories" list, with Add work item / Allocate target. Territories and task checklists are user-added (keep them), but the Figma per-employee table and work-list panel are absent. Fix: rebuild the Figma table and panel; keep territories as an extra section.
- Minor: the date picker and the DEC-021 chip are missing. The title is "Targets & Work Lists"; Figma uses sentence case "Targets & work lists". The primary button is "Allocate target"; Figma uses "Set target".

## SCR-OWN-007 Calling assignments (`app/calling-assignments/page.tsx`, `components/owner/CallingAssignments.tsx`)
Shots: `OWN-007-DL.png`, `OWN-007-DD.png`

- **Major:** the tabs Assignments / Opportunities & handoffs / Do-not-call list are missing.
- **Major:** the filter row is wrong. Figma has a search box ("Search business, phone or handle"), filter chips (All ✕ / Unassigned · n / Needs decision · n), All categories and All outcomes. The app has two dropdowns (All businesses, All assignees).
- Minor: the table is missing the Phone column, the category subtitle under the business name, and Last attempt (with agent); it has "Assigned since" instead. Header case is mixed ("Business", "Assigned to", "Assigned since" title case next to uppercase "OUTCOME", "FLAGS"). Fix: one uppercase header style.
- Minor: the bulk bar is a white bordered card with Assign / Unassign / Autofill on two rows. Figma has a grey tinted single-row bar (n selected · agent select · Assign · Unassign · chips right). Each row shows Reassign / Unassign buttons; Figma uses a "…" row menu. The footer is a pagination bar; Figma has the line "Showing 7 of 248 businesses…".
- Cosmetic: the page subtitle reads "7 businesses · 1 unassigned · Owner only"; Figma also lists per-agent counts.

## SCR-OWN-008 Reassignment impact (`components/owner/ReassignImpactDialog.tsx`)
Shots: `OWN-008-reassign.png`, `OWN-008-impact.png` (assignee chosen, nothing saved)

- Minor: the dialog opens on a "New assignee" step. Figma opens with the target already chosen ("From Maya Khoury to Omar Nassar") and the impact sections visible. That is acceptable if the two-step flow is intended. Note: the e2e seed had no active reservation or follow-ups, so the Active reservation and follow-up choice blocks were not visible.
- Minor: a "Reason *" textarea is always shown. In Figma, Reason appears only with Override (the Override confirm state).
- Minor (copy): the footer hint reads "Reassign stays disabled until you choose a reason." Figma reads "…until the reservation and each follow-up have a choice." The initial step reads "…the new assignee, a reason." The grammar is broken in both.
- Cosmetic: the footer has a grey band with a divider; in Figma the footer sits on the dialog surface.

## SCR-OWN-009 Reports & exports (`app/reports/page.tsx`)
Shots: `OWN-009-DL.png`, `OWN-009-DD.png`, `OWN-009-nonowner.png`

- **Major:** the screen differs completely. Figma has a left "Reports" list (Calling activity, Businesses, Attendance, Targets, Deals & pipeline, Projects & workload, Delivery failures), a filter card (Date range / Role / Employee / Category / Calling outcome / Compare), three KPI cards, a preview table with an "All agents" total row, a format select and an Export button in the header. The app shows four static export cards ("Company Timesheet & Punctuality Export", "Payroll Ready", etc.) with Download buttons, a format select and From/To inputs. This looks like the older Gemini page. Fix: rebuild it to the Figma layout.
- **Major:** in the non-Owner state, the Format select and From/To date inputs are still shown above the "You don't have access" message, along with an extra "Back" link and the OQ-18 footer. Figma shows only the lock empty state ("Reports and exports are for the Owner/Admin… Nothing was exported."). Fix: render only the access-denied state for unauthorised roles.
- Minor (copy): the title reads "Reports & Data Exports" instead of "Reports & exports". The page uses a centred max-width container (x=320–1344) instead of full width.

## SCR-OWN-010 Audit log (`app/audit/page.tsx`)
Shots: `OWN-010-DL.png`, `OWN-010-DD.png`, `OWN-010-detail.png`

- **Major:** the filter row overflows. With From + To + Actor + Entity type + Event + Entity reference, the last input runs past the content edge (to ~1430 px) and gets clipped; the From/To/Entity reference inputs touch with no gap. Figma has a single Date range (200 px) + Actor + Entity type + Event (dropdown) + Entity reference (flex). Fix: a single range picker, `gap-3`, and an Event select.
- **Major:** table columns are too narrow. Time wraps to 3 lines ("28 Oct, / 14:52 / 2026") and actor names wrap, so rows are about 58 px tall and uneven. Entity shows raw ids ("session · f6357cb0…") and Summary shows raw UUIDs ("rotatedFrom: 3cc7b301-…"). Figma shows "20 Oct 11:16 / 2026", "Business · Lumen Yoga Studio" and readable summaries. Fix: fixed column widths (Time 140, Actor 180), human entity labels, and summaries that hide internal UUIDs.
- Minor: the OQ-19 retention chip next to the G3 info banner is missing. The "Placeholder name (§5)" sub-line under event names is missing. The System actor shows as "Unknown".
- Minor (Event detail): the drawer is 560 px; Figma uses 480. The title is "Event detail" instead of the event name with the timestamp as subtitle. The app shows raw AFTER / DETAILS JSON blocks; Figma shows a "Changed fields" Field / Before / After table. There is no footer Close button, the "No edit, delete or hide action exists…" note is missing, and a large focus ring sits on ✕ when the drawer opens.

## SCR-OWN-011 Settings (`app/settings/page.tsx`)
Shots: `OWN-011-DL.png`, `OWN-011-DL-scroll.png`, `OWN-011-DD.png`, `OWN-011-security.png`

The extra settings tabs (Company Information, Roles & Access Control, Security & 2FA) are user-added and intentional.

- **Major:** the layout is a single centred column of stacked cards. Figma has two columns: Work schedule on the left, Office verification on the right. Office verification uses four RadioCards (Office network / Location / IP or location / IP and location); the app uses a dropdown. The Office geofence field and the "Test office check" button with helper text are missing.
- **Major:** the header has no Discard / "Save attendance settings" buttons; there is a single "Save working hours" button at the bottom of the scroll. Fix: header actions as in Figma (or a sticky footer).
- Minor: working days are seven large filled toggle buttons; Figma uses Mon–Sun checkboxes with a DEC-022 chip. The labels say "(24h)" but the inputs show "09:00 AM / 06:00 PM" (browser 12-hour locale). Fix: a 24-hour format or a text HH:MM input. Grace is prefilled "10"; Figma shows "Not set · min" while DEC-008 is pending. The DEC-010 and DEC-007/008/022 notices are missing. The "Workday length · 9 hours · Confirmed" row is missing.
- Minor (copy): the title reads "System Settings" instead of "Settings", and the subtitle differs. The tabs are labelled "Working Hours & Shifts"; Figma uses "Attendance & office check".
- Note: the register already marks this screen "not ready" (C11 blocked, M-16 open), so this diff is informational.

## SCR-OWN-012 Delivery & exception monitor (`app/delivery-monitor/page.tsx`)
Shots: `OWN-012-DL.png`, `OWN-012-DD.png` (compared with "Empty")

- **Major:** the header shows an internal screen-ID badge, "SCR-OWN-012", next to the title. It is visible to end users and is not in Figma. There is also an extra icon tile and the title "Delivery & Exception Monitor". Fix: remove the badge and the tile; use the title "Delivery monitor" and subtitle "Nothing needs attention" / "n items · …".
- **Major:** the filters differ. Figma has chips (All · n ✕ / Reminders · n / Notifications · n / Project provisioning · n) and an "All statuses" select. The app has a segmented control (All Items / Notifications / Reminders) with no Project provisioning filter and no status filter. The table header (Type / Item / Recipient / Status / Reason / Action) is missing in the empty state. The header action is "Refresh Status"; Figma has "Open audit log".
- Minor (copy): the empty state reads "All Dispatches Clean / No delivery failures or pending items in this view." Figma reads "No delivery problems / Failed or suppressed reminders and notifications, and failed project provisioning (F3), appear here…". The AR-13 notice uses non-product marketing copy ("audit-ready exception states and exponential retry backoff"). Figma has three short chips (AR-13 / F2 / No DEC ID) and the D5/C6 footnote.

---

## Blocked / not checked
- No blockers on environment or sessions; all four storage states were valid.
- States that need data writes, forced conflicts or exceptions in the seed were not reproduced (listed under the summary).
- Other QA agents were active at the same time; the audit event count rose from 8 to 18 between captures. This does not affect layout findings.
