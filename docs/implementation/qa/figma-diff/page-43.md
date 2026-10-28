# Figma diff: HiFi page 43 (Call Center, SCR-CC-001 … CC-008)

Read-only QA pass, 2026-10-28. Nothing in the app was changed. Built app: production build at `localhost:3100`, test DB `udigity_test_figma_qa` (e2e seed). Design source: `docs/phase6/previews/43/*.png`. No Figma MCP calls were needed.
App screenshots are in `shots/43/`, captured at the preview size (1440×900 desktop, 390×844 mobile).

**Seed-data caveat.** The e2e seed gives Maya 4 "New assignments" and nothing else: no follow-ups, no opportunities for her, no Rejected businesses. Many populated Figma states (Due-now column, follow-up list/calendar, DNC table) therefore could not be compared like-for-like. I compared the layout and components I could see, and the matching **Empty** previews where they exist. The only record I created was a reservation (Start Contact on Olive & Thyme, twice), and both were released with **Cancel contact**. I confirmed the workspace showed "Read mode · not reserved" afterwards.

## Summary

| Screen | Variants checked | Verdict |
|---|---|---|
| SCR-CC-001 Calling queue | D-L, D-D, M-L, Owner view (D-L) | **Major** (Owner view missing) |
| SCR-CC-002 Contact workspace | D-L, D-D (captured), M-L | **Major** (mobile primary action) |
| SCR-CC-003 Active contact | D-L (default, nothing selected) | Minor |
| SCR-CC-004 Follow-ups & calendar | D-L, D-D (captured), M-L, all as Empty | Minor (populated state not reachable) |
| SCR-CC-005 Reservation block | Owner viewing an agent's reservation (D-L, D-D), same user in a second tab | Minor (most states not reachable) |
| SCR-CC-006 Follow-up drawer | Create D-L, D-D (captured), M-L | Minor |
| SCR-CC-007 Opportunities | Agent Empty D-L, D-D, Owner view D-L | **Major** |
| SCR-CC-008 Do-not-call list | D-L, D-D as Empty | Minor (populated not reachable) |

Counts for page 43: **Major 4 · Minor 24 · Cosmetic 3**. These counts include the cross-cutting items X1, X2, X4 and X5 (Minor) and X3 (Cosmetic).

---

## Cross-cutting (affects pages 43 and 44)

- **X1 · Minor: shell metrics and nav.** The sidebar is 224 px wide (Figma 240) and the header is 56 px tall (Figma 64). The search field is 32 px tall (Figma 40, with a darker border). The nav count badges (Calling Queue 7, Follow-ups 3) are missing. The extra nav groups (Overview, Notifications, Businesses, Delivery), the theme toggle and the brand logo are user additions or intentional, so keep them. Files: `frontend/src/components/layout/Sidebar.tsx`, `Header.tsx`. Fix: use 240/64/40 px, and add the count badge to the calling nav items.
- **X2 · Minor: policy chips lose their topic.** Figma chips read like "DEC-016 Reopening authority" or "D4 pending". `PolicyPendingChip` swaps the label for "Demonstration alternative — not approved" whenever `demo` is set (`frontend/src/components/ui/NoticePolicy.tsx`, the `text = demo ? DEMO_ALTERNATIVE_LABEL : …` line). The chips get long and wrap badly ("DEC-\n016" in the queue rail, DEC-005 in the log panel). Fix: always render `dec + topic label`, show the demo flag as a short suffix or tooltip, and add `whitespace-nowrap` to the ID.
- **X3 · Cosmetic: dark palette.** The app's dark surfaces are saturated navy, and the sidebar and content share one colour. The Figma dark previews are near-neutral charcoal with a navy sidebar. Navy is the user's explicit directive, so the Figma previews are what is out of date. The only proposal is to restore the sidebar/content contrast in dark mode (`frontend/src/app/globals.css` tokens).
- **X4 · Minor: mobile layouts reuse the desktop header.** On mobile every page shows the top-bar title and then repeats the desktop H1, subtitle, header buttons and long policy chips. Figma mobile puts the title and a short subtitle in the top bar, drops the header buttons, and uses compact chip filters and sticky actions. Files: the page components plus `frontend/src/components/layout/Header.tsx`. Fix: add a `mobileTitle`/`mobileSubtitle` slot and hide `CallingPageHeader` actions and chips below `md`.
- **X5 · Minor: empty states.** Figma uses a full-height card with a specific title, body and primary CTA ("Open calling queue"), and hides the filters. The app shows a bare icon, different copy, no CTA, and keeps the filters visible. This applies to CC-004 and CC-007. File: `frontend/src/components/ui/State.tsx` usage in `app/calendar/page.tsx` and `components/calling/Opportunities.tsx`.

---

## SCR-CC-001 Calling queue

Shots: `shots/43/cc001-DL.png`, `cc001-DD.png`, `cc001-ML.png`, `cc001-owner-DL.png`

1. **Major: Owner view not implemented.** Figma "Owner view" shows the breadcrumb "Calling Assignments › Maya Khoury" and the title "Calling queue — Maya Khoury". It also has an agent picker, "Open Calling Assignments", an amber "1 assigned business is inaccessible" alert, an "Inaccessible (1)" tab, an **OWNER ONLY** column ("Assigned but inaccessible") and Reassign… / Unassign / Keep as is actions. In the app, the Owner at `/queue` sees their own queue ("6 businesses assigned to you") in the agent layout. No code path for this exists (no `agentId`/"inaccessible" in `components/calling`). Files: `frontend/src/app/queue/page.tsx`, `components/calling/QueueBoard.tsx`, `hooks.ts`. Fix: add an Owner mode (`/queue?agent=<id>`, linked from Calling Assignments) that renders the agent picker, the alert and the Owner-only column.
2. **Minor: filter row wraps.** The bucket tabs break onto two lines ("All / buckets", "Due today / (0)"). The two chips also stack, because the tabs and chips share a row with a fixed 240 px search field. Figma has a single row. File: `components/calling/QueueBoard.tsx` (`QueueFilterBar`, Tabs). Fix: add `whitespace-nowrap` to the tab labels and let the chip group shrink or wrap below.
3. **Minor: copy drift.** The placeholder reads "Filter by name" (Figma "Filter by name or phone"). The derived chip reads "a business is in exactly one" (Figma "a business can be in 2"), so check which rule the spec settled on. The overdue chip reads "Overdue threshold (no DEC ID) Demonstration alternative…" (Figma "No DEC ID Overdue threshold"). File: `app/queue/page.tsx`, `QueueBoard.tsx`. Fix: align the copy with `screens/callcenter-spec.md`.
4. **Minor: row meta.** Figma: "Gym · Assigned 19 Oct by Rana Haddad · no attempts yet". App: "Assigned 28 Oct 14:45 · no attempts yet", with no category and no assigner. File: `QueueBoard.tsx` row renderer. Fix: prefix the category and add "by <assigner>".
5. **Minor (mobile): wrong mobile pattern.** Figma mobile has a compact top bar ("Calling queue / Tue 20 Oct · 7 businesses") and scrollable chip filters with counts and dropdowns ("All ×", "Due today · 2 ⌄"). It has no header buttons and adds a "More below…" hint. The app stacks the header buttons, full tabs and long chips, and shows a column header (see X4). File: `app/queue/page.tsx`.
6. **Cosmetic: footer bar position.** In Figma the Rejected/DEC-016 footer bar is pinned to the bottom of the content area. In the app it sits directly under the board. Fix: `mt-auto` on a full-height column.
- Dark: structure matches; palette per X3. Not reached: Loading, Error, Empty, and the Due-now and Needs-attention columns with data.

## SCR-CC-002 Contact workspace

Shots: `shots/43/cc002-DL.png`, `cc002-DD.png`, `cc002-ML.png`

1. **Major (mobile): Start Contact is not sticky.** Figma mobile has a top bar with the business name and outcome ("Olive & Thyme Café / Café · Needs another call"). It also has a sticky bottom action bar ("Start Contact", "Reserves this business while you call") above the tab bar. In the app the top bar reads "Calling Queue", and the page repeats the desktop header with its buttons and the DEC-004 block. The Start Contact button is below the fold. File: `components/calling/ContactWorkspace.tsx`, `app/queue/[businessId]/page.tsx`. Fix: on `<md`, render a fixed bottom action bar and move the title into the mobile header.
2. **Minor: DEC-004 notice moved.** Figma puts the DEC-004 note inside the Contact panel, under the explanation text. The app puts a 3-line policy block at the top of the middle column, which pushes the business card down. File: `ContactWorkspace.tsx`. Fix: move it into the Contact panel as an inline notice.
3. **Minor: queue rail.** The rail is missing the "All buckets / Due today (n)" tabs and the count chip next to the title ("7 businesses"). The derived chip reads "Derived · buckets are not stored" (Figma "Derived · a business can be in 2 buckets"). File: `components/calling/QueueRail.tsx`. Fix: reuse `QueueFilterBar` tabs, compact version.
4. **Minor: Contact panel height.** Figma's three columns stretch to the bottom of the viewport, with Start Contact pinned to the bottom of the Contact panel. The app's columns size to their content, and Start Contact sits mid-panel. File: `ContactWorkspace.tsx`. Fix: `h-full flex flex-col` with the action in an `mt-auto` footer.
5. **Minor: extra control.** A "Customer asked not to be called…" link appears in the Contact panel. It is not in the Figma default state. Confirm against the spec; if it is a do-not-call shortcut, move it into the outcome flow.
6. **Cosmetic: breadcrumb colour.** Figma's breadcrumb parent link is teal; the app's breadcrumb is plain secondary text.
- Not reached: the "Hidden by policy", "Start Contact disabled (Rejected / not assignee)" and "Rejected (mobile)" states. Website and second-phone rows are absent because of the data.

## SCR-CC-003 Active contact: log attempt & outcome

Shot: `shots/43/cc003-DL.png` (reservation released afterwards)

1. **Minor: log-panel footer wraps.** "Save, keep reservation" and "Save attempt" each break onto two lines. The panel is about 350 px wide (Figma 376) and the buttons wrap. File: `components/calling/LogAttemptPanel.tsx`. Fix: add `whitespace-nowrap` to the buttons and widen the right column (for example a `grid-cols-[344px_1fr_376px]`).
2. **Minor: outcome policy chips.** Figma shows compact "D4 pending" and "DEC-005 pending" chips inline with "Outcome *". The app shows two long chips on their own rows, and the DEC-005 chip wraps (see X2).
3. **Minor: banner styling.** The "Reserved by you" banner is green (success tone); Figma uses the teal/brand tint. DEC-004 is a 3-line block with a demo label; Figma has a single-line inline notice. File: `ContactWorkspace.tsx`. Fix: use `tone="brand"`, and `NoticePolicy size="inline"`.
- Not checked: the follow-up sub-form ("Set now / Set later"), because I did not pick an outcome. Also not checked: the Save conflict / failed / Success, On hold, Rejected and Accepted states (they need a saved attempt), and mobile/dark.

## SCR-CC-004 Follow-ups & calendar

Shots: `shots/43/cc004-DL.png`, `cc004-DD.png`, `cc004-ML.png` (all empty)

1. **Minor: status filters.** Figma has filter chips with counts and affordances: "Open (3) ×", "Completed ⌄", "Cancelled ⌄", "All ⌄", on the same row as the policy chips. The app has plain pills without counts, on a separate row under the chips. File: `frontend/src/app/calendar/page.tsx` / `components/calling/FollowUps.tsx`. Fix: use the chip-filter component and merge the rows.
2. **Minor: empty state** (compare with the "Desktop — Light — Empty" preview). The app's copy is "No open follow-ups"; Figma's is "No follow-ups scheduled". The app has no "Open calling queue" CTA and no card, and still shows the filters and chips (X5). The mobile empty state should be the compact inline row with an outlined "Open calling queue" button.
- Not reached (no follow-ups in the seed; creating some would add data): the populated list, the day-calendar side panel, the reminder-failed alert, the Week calendar, and the Cancel-with-reason dialog.

## SCR-CC-005 Contact reservation & concurrency block

Shots: `shots/43/cc005-owner-DL.png`, `cc005-owner-DD.png`, `cc005-sameuser-othertab-DL.png`

1. **Minor: Owner force-override layout.** In the Figma Owner view the queue rail is gone (two columns) and the breadcrumb reads "Calling Assignments". The right panel is titled "Reservation · Owner view" and lists Holder, Assignee and Lease. Its footer has "Wait" and a red "Override reservation…" button, with the line "Override ends Omar's reservation; it is audited." The app keeps the agent layout and rail, and puts a small neutral "Override reservation…" button inside the amber banner. Its holder card shows "Your assignment: Assigned to Maya Khoury", which is the wrong label for the Owner. File: `components/calling/ContactWorkspace.tsx`. Fix: add an Owner branch with the reservation panel and a danger-tone override in the panel footer.
2. **Minor: blocked Contact panel.** Figma (agent "Reserved by another agent") shows the title "Contact unavailable" with a "Reserved · Omar Nassar" chip. The disabled Start Contact is pinned at the bottom with "Back to queue" and "Retry" buttons and two DEC-004 notes. The app shows the title "Contact", with Retry and "Back to queue" inside the holder card. File: `ContactWorkspace.tsx`.
- Good: the rail row shows the dashed "Reserved" flag (N43-11). The app adds a "You hold this contact elsewhere" state that is not drawn in Figma, which is fine.
- Not reached: agent-versus-agent (needs a second Call Center session, for example Omar, and none is stored). Also not reached: Expiring, Network loss, Overridden-by-Owner notice, Reservation expired, Stale client, and the override dialog (I did not open it so I would not risk an override).

## SCR-CC-006 Follow-up create / reschedule (drawer)

Shots: `shots/43/cc006-DL.png`, `cc006-DD.png`, `cc006-ML.png`

1. **Minor: date/time field.** The app uses a native `datetime-local` field: "mm/dd/yyyy --:-- --" in US format with a second calendar icon. Figma shows a formatted picker: "Wed 21 Oct 2026 · 09:30", helper "Must be in the future." File: `components/calling/FollowUps.tsx` (`DrawerBody`). Fix: use the shared date/time picker with company-format display.
2. **Minor: Responsible field.** The app shows a read-only text input "Maya Khoury (you)". Figma has a select with an avatar and the helper "Default: the assignee. Active Call Center agent or the Owner." This may be intentional for the agent role; confirm against the spec.
3. **Minor: copy and structure.**

   | Element | Figma | App |
   |---|---|---|
   | Subtitle | business · context ("Cedar Home Realty · Callback to be scheduled") | "Reminder timing has no DEC ID" |
   | Policy note | violet block at the bottom | chip at the top |
   | Footnote "No contact reservation is needed to schedule outside a call." | present | missing |
   | Primary button | "Save follow-up" | "Schedule follow-up" |
   | Cancel button | outlined | ghost |

   Opening the drawer from the calendar header adds a Business picker, which is reasonable; Figma draws the variant opened from context.
- Not reached: Reschedule, Past time rejected, Save conflict, Success.

## SCR-CC-007 Opportunities & developer handoff

Shots: `shots/43/cc007-DL.png`, `cc007-DD.png`, `cc007-owner-DL.png`

1. **Major: Owner view incomplete.** The following elements from the Figma Owner view are missing in the app:
   - the title suffix "— all agents" and the subtitle "from every agent";
   - the amber "Developer not yet assigned · 1" alert;
   - the **CREATED BY** column;
   - the row sub-lines ("Menu website · accepted 22 Oct 11:04");
   - developer avatars and the row "⋯" menus;
   - the "Edit handoff context" link.

   File: `frontend/src/components/calling/Opportunities.tsx`, `app/opportunities/page.tsx`.
2. **Major: closed deal listed as an opportunity, with contradictory copy.** The page says "accepted opportunities · not closed deals", but Glow Beauty Salon is listed with stage **Closed deal**. Its handoff panel reads "Commercial stage: **Closed deal — not a closed deal**". `Opportunities.tsx:116` appends "— not a closed deal" unconditionally. Fix: exclude closed deals from this list (or label them), and only append the suffix when the stage is not Closed.
3. **Minor: filters.** The app has a segmented control "All / Developer assigned / Not yet assigned". Figma has chips with counts: "All (3) ×", "Developer not yet assigned (1) ⌄", "Meeting not yet arranged (1) ⌄". The meeting-not-arranged filter is missing. The DEC chips also lose their topics (X2).
- Agent empty state: see X5. The agent's populated list was not reached (Maya has no opportunities in the seed). Not reached: "Developer assigned".

## SCR-CC-008 Do-not-call list & reopening

Shots: `shots/43/cc008-DL.png`, `cc008-DD.png`

1. **Minor: filters and copy.**
   - The app adds a "Search by business name" input that is not in Figma.
   - The "Reopened" filter chip is missing; only a static "Rejected (0)" badge is shown, and Figma's "Rejected (1) ×" is a removable chip.
   - The subtitle is missing "· view only".
   - Banner copy: Figma reads "You can view this list but cannot reopen a business. Who may reopen … is undecided (DEC-016)." The app reads "…only the Owner can reopen a business (DEC-016, demonstration alternative)". This matches the running demo default but not the Figma text; the user decides which one stands.

   File: `frontend/src/app/do-not-call/page.tsx`.
- Policy chips lose their topics ("Reopening authority", "Open follow-ups on Rejected"); see X2.
- Not reached (no Rejected business in the seed): the table, the detail panel with Open business / Start Contact disabled / Reopen…, the Owner reopen dialog, and Reopened.
