# Figma diff: HiFi page 44 (Developer / Delivery, SCR-DEV-001 … DEV-008)

Read-only QA pass, 2026-10-28. Nothing in the app was changed. Built app: `localhost:3100`, test DB `udigity_test_figma_qa`. Design source: `docs/phase6/previews/44/*.png`. No Figma MCP calls were needed. App screenshots are in `shots/44/`, captured at 1440×900 / 390×844.

**Seed-data caveat.** The developer persona (Lina Aoun) can see one deal: Glow Beauty Salon, DL-0002, already **Closed**. There is one project (PRJ-0001, In progress, 3 To-do tasks, no milestones) and one meeting (28 Oct, Outcome due). So the pre-closure deal states and DEV-008 cannot be reached without creating or advancing records. I only opened dialogs and drawers and closed them without saving.

The cross-cutting findings X1 to X5 (shell sizes, policy chips losing their topic, navy dark palette, mobile pages reusing the desktop header, empty states) are described in `page-43.md` and apply here as well. They are not counted again below.

## Summary

| Screen | Variants checked | Verdict |
|---|---|---|
| SCR-DEV-001 Deals | D-L, D-D, Owner view (D-L) | **Major** (Owner view missing) |
| SCR-DEV-002 Deal record detail | D-L, D-D (captured), Owner D-L (captured) on a Closed deal | Minor (pre-closure states not reachable) |
| SCR-DEV-003 Meetings & calendar | Week D-L, D-D (captured), List D-L, M-L | **Major** (List view) |
| SCR-DEV-004 Meeting drawer | Record outcome D-L, D-D (captured); Schedule-new D-L (not designed in Figma) | Minor |
| SCR-DEV-005 Projects | D-L, D-D (captured) | **Major** (filter layout) |
| SCR-DEV-006 Project board | D-L, D-D (captured), M-L, Blocked dialog, Record-delivered dialog | **Major** (task cards) |
| SCR-DEV-007 Task detail drawer | D-L; D-D and M-L captured but not compared in detail | Minor |
| SCR-DEV-008 Finalize closure | none | **Not reachable** |

Counts for page 44: **Major 4 · Minor 14 · Cosmetic 2**. X1 to X5 are counted in `page-43.md` only.

---

## SCR-DEV-001 Deals

Shots: `shots/44/dev001-DL.png`, `dev001-DD.png`, `dev001-owner-DL.png`

1. **Major: Owner view not implemented.** The Owner sees the developer layout (a "Closed deals" tab only, and a "For you" column). Figma's Owner view has:
   - the subtitle "All deal records with their commercial stage. Owner view.";
   - tabs **All deals 10 / Closed deals 5 / Not proceeding 1**;
   - "Needs attention ×", "Developer not yet assigned · 1 ⌄" and "Closure verification requested · 1 ⌄" chips;
   - **STAGE SINCE** and **ATTENTION** columns, with inline "Assign developer…" and "Review" actions;
   - the RW-04 "Proposed" note.

   This also leaves the register's "Not proceeding" gap unsolved. File: `frontend/src/components/delivery/DealsList.tsx`. Fix: add a role-based Owner variant (tabs, attention filters, attention column).
2. **Minor: filter bar.** The search field and three Selects sit in an equal 4-column grid (`DealsList.tsx:100`, `grid lg:grid-cols-4`), so each dropdown is about 280 px wide. Figma has a 300 px search field plus compact chip dropdowns: "Assigned to me ⌄", "Developer: Any ⌄", "Closed: last 30 days ⌄", "Project status: Any ⌄". The "Sorted by…" label sits on the same row. The **Developer** filter is missing. The defaults also differ: the app uses "All eligible deals" and "Closed: any time".
3. **Minor: deal rows.** The deal title lacks the service ("Glow Beauty Salon — Booking website"), and the sub-line lacks the category ("DL-0031 · Salon · Downtown branch"). In light mode "Open" is dark text; Figma uses a teal link.
4. **Cosmetic: tab badge and padding.** The tab count badge is a solid teal circle (Figma: a subtle pill). The content gutter is 32 px (left edge at 256), while Figma's is 24 px (264).
- Dark: same structure; palette per X3. Not reached: Loading, Load error, Empty, and the Accepted-opportunities tab (DEC-005 Alt 1).

## SCR-DEV-002 Deal record detail

Shots: `shots/44/dev002-DL.png`, `dev002-DD.png`, `dev002-owner-DL.png`

1. **Minor: header.** The title lacks the service suffix. The "Mark not proceeding…" action and the "⋯" menu are absent. That may be correct for a Closed deal (the Figma default is "Signed and paid · awaiting closure"), so it could not be confirmed. File: `frontend/src/components/delivery/DealDetailView.tsx`.
2. **Minor: Business context card.** The app lists Business, Deal and Accepted. Figma lists Category, Phone and Website, and has a "Schedule" link beside "Meetings". The DEC-005 chip in the limited-context box wraps (X2).
- Matches well: the four fact cards (Accepted / Signature / Payment / Closure), the DEC-018 note, Handoff context, and the Meetings list.
- Not reached (the only deal is Closed): the closure section with "Finalize closure…" or "Request closure verification", the Record signature, Record payment and Mark-not-proceeding dialogs, Save conflict, Hidden by policy, the Owner remove-fact view, and the verification states.

## SCR-DEV-003 Meetings & calendar

Shots: `shots/44/dev003-DL.png`, `dev003-DD.png`, `dev003-list-DL.png`, `dev003-ML.png`

1. **Major: List view lacks the table.** Figma's "List with states" is a table with the columns WHEN / MEETING (with a DL id · stage sub-line) / ATTENDEES / STATUS / CONDITION. Each row has its action: Reschedule…, Record outcome…, View notes, or "No further actions". There is also a reminder-not-sent alert and footnote chips. The app renders a plain card per meeting with only badges, with no actions or columns, and it repeats the legend. File: `frontend/src/components/delivery/MeetingsView.tsx`. Fix: render the list mode as `Table` with a condition column and row actions.
2. **Minor (mobile): grouped agenda missing.** Figma mobile is a grouped agenda (NEEDS AN OUTCOME / TODAY / TOMORROW / EARLIER) under the top bar "Meetings / Week 19–25 Oct". The app stacks the desktop controls (Week/List, arrows, chip, select, legend, three policy chips). The developer bottom nav shows **My Day / Businesses / Deals / More**, with no tab active on Meetings; Figma has My Day / Projects / Meetings / More. File: `MeetingsView.tsx`, `frontend/src/components/layout/MobileNav.tsx`.
3. **Minor: toolbar.**
   - The "My meetings ×" chip wraps to two lines.
   - Status is a full-height Select instead of a chip.
   - The range label "26 – 1 Nov 2026" omits the start month ("26 Oct – 1 Nov").
   - The event label "12:45 · Outcome due" wraps.
   - The hour grid runs to 17:00, which pushes the legend and notes below the fold. Figma ends at 16:00 and the legend is visible.
4. **Cosmetic: meeting title.** The meeting title repeats the business: "Glow Beauty Salon · Glow Beauty Salon kick-off".
- Not reached: Empty.

## SCR-DEV-004 Meeting schedule / record (drawer)

Shots: `shots/44/dev004-DL.png`, `dev004-DD.png`, `dev004-schedule-DL.png`

1. **Minor: Record outcome drawer.**

   | Element | Figma | App |
   |---|---|---|
   | Title | "Record meeting outcome" | business name |
   | Mode switch | none; each mode is its own drawer | segmented control "Record outcome / Reschedule / Cancel" inside the drawer |
   | Outcome input | two radio cards, "Held — The meeting took place…" and "Missed (no-show) — … Proposed state (R-13)" | dropdown |
   | Status chip | "Awaiting outcome" | "Outcome due" |
   | Under the notes | "Attached to deal DL-… Notes can be amended later; history kept." and a 0/2000 counter | missing |
   | Close button | outlined | ghost |

   File: `frontend/src/components/delivery/MeetingDrawer.tsx`.
2. **Minor: Schedule-new drawer (not drawn in Figma; D-3 deferred).** The native `datetime-local` fields show US format, and the value is clipped ("10/28/2026 04:00 F"). The drawer has a Business/Client select plus a second "Search businesses" field, which is redundant. File: `ScheduleMeetingDrawer.tsx`. Fix: use the shared date and time pickers (Figma Reschedule shows Date + Start/End time) and a single searchable combobox.
- Not reached: Reschedule (fields only seen as a tab), Cancel meeting, Validation error. Mobile: clicking the meeting on the mobile list timed out, so the mobile drawer was not captured.

## SCR-DEV-005 Projects

Shots: `shots/44/dev005-DL.png`, `dev005-DD.png`

1. **Major: filters stack as full-width rows.** The three filters stack as full-width 1152 px dropdown rows ("Status: Any", "All eligible projects", "Delivery: Any"), which takes about 140 px of vertical space. Figma has one row of compact chips: "Status: Any ⌄ / Developer: Any ⌄ / Assigned to me ⌄ / Delivery overdue ⌄", plus "Sorted by target delivery date" on the right. Cause: `ProjectsList.tsx:97`, where a `flex-wrap` row holds full-width `Select`s. The Developer filter is missing. Fix: give the Selects `w-auto` (or use chip dropdowns) and add the Developer filter.
2. **Minor: KPI cards.**
   - The workload KPI shows two numbers, "1 · 3" (Active projects · Open tasks). Figma shows three, "2 · 2 · 6" (Deals · Projects · Tasks).
   - The trend lines have no icons (Figma: "— No change", "↗ +1 vs September").
   - The "Development workload — Proposed" title wraps.
- Rows match: status pill, developer avatar, target date, tasks "0 of 3 done", "Assigned to me" chip, "Open board". Not reached: Empty, Loading, the "closed deal has no project yet" banner.

## SCR-DEV-006 Project board

Shots: `shots/44/dev006-DL.png`, `dev006-DD.png`, `dev006-ML.png`, `dev006-blocked-DL.png`, `dev006-delivered-DL.png`

1. **Major: task cards carry inline actions.** Each task card has stacked "Start", "Mark done" and "Cancel…" buttons, so cards are about 200 px tall and only one and a half fit above the fold. Figma cards show the title, a description, chips (Client dependency, DEC-018 pending), and the assignee avatar with the due date. Actions live in the Task drawer (DEV-007). File: `frontend/src/components/delivery/ProjectBoard.tsx`. Fix: remove the inline buttons, or move them into a "⋯" menu; open the drawer on card click.
2. **Minor: header and status bar.**
   - The "Move project to:" options are text buttons except "Record delivered"; Figma has all of them as outlined buttons, in the order Waiting… / Blocked… / Back to Scheduled / Record delivered.
   - "Edit schedule" is disabled; Figma has it enabled (the drawer is D-3 deferred, so maybe intentional).
   - The "⋯" overflow is missing.
   - The project-status pill is small; Figma uses a larger pill.
   - Not checkable for lack of data: the "31 days to target" chip and the Today marker on milestones.
3. **Minor: Deal context and notes.** The facts lack the check icons and actor/reference ("2 Oct · Maya Khoury", "9 Oct · AGR-0109"). The "Add note" link (Client dependencies) and the "View all" link (Activity) are missing, and Activity is empty, with no "Business details wrong? Request correction" line.
4. **Minor: Blocked dialog.**

   | Element | Figma | App |
   |---|---|---|
   | Title | "Move project to Blocked" | "Mark project blocked" |
   | Subtitle | "… — Booking website · PRJ-0014" | missing id |
   | "Project status: In progress → Blocked" row | present | missing |
   | Explanation "Blocked does not change tasks…" | present | missing |
   | DEC-019 chip and 0/500 counter | present | missing |
   | Buttons | "Cancel / Set Blocked" | "Back / Save", on a grey footer band |

   File: `ProjectBoard.tsx` (status dialogs). The Record-delivered warning dialog matches, except the task rows lack their condition chips.
5. **Minor (mobile): board layout.** Figma mobile has a top bar "Booking website / Glow Beauty Salon · PRJ-0014" and a status card with "Change status" + "Add task", followed by grouped task lists (TO DO · 2 …). The app shows the desktop breadcrumb and H1, the status buttons wrapped over three lines, and the wrong bottom nav (see DEV-003 #2).
- Not reached: Waiting for client (a dialog shot was captured as `dev006-waiting-DL.png` but not compared), Completed (read-only), Hidden by policy, Save conflict.

## SCR-DEV-007 Task detail (drawer)

Shots: `shots/44/dev007-DL.png` (`dev007-DD.png`, `dev007-ML.png` captured only)

1. **Minor: drawer fields.**
   - The **Start date** field is missing; only Due date is shown, as a native "mm/dd/yyyy" input. Figma has Start date and Due date side by side, as formatted pickers.
   - The Owner select has no avatar, and a redundant avatar + name line sits below it.
   - Client dependency is a checkbox ("Waiting on the client…"). Figma shows a chip line plus a dependency note card with "Mark dependency resolved".
   - The app adds an editable Title field. It is not in Figma, but is acceptable.

   File: `frontend/src/components/delivery/TaskDrawer.tsx`.
- Not reached: Validation error, Save conflict (desktop/mobile), Success.

## SCR-DEV-008 Finalize closure & provision project (dialog)

**Not reachable.** No deal in the seed is "Signed and paid · awaiting closure". The developer sees only the Closed DL-0002, whose closure section reads "No further closure action is available", so the Finalize dialog (Confirm, Not allowed, Success F2, Closed-provisioning-failed F3, Request verification) cannot be opened without advancing a deal. Recommendation: add a signed-and-paid deal to `backend/src/db/e2e-seed.ts` so this screen and DEV-002's pre-closure states can be QA'd.
