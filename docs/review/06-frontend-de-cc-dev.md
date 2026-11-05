# Review 06: Frontend Data Entry / Call Center / Developer (2026-10-28, Reviewer 6)

Scope: `frontend/src/app/{businesses,categories,corrections,search,queue,calendar,opportunities,do-not-call,deals,meetings,projects}/**` and `frontend/src/components/{businesses,calling,delivery}/**` (about 9k lines, 17 pages and 45 components).
Method: every file listed at the end was read in full, line by line. Greps for hex colours, raw Tailwind palette classes, mocks, dead controls and unload handling covered the whole slice. Figma specs `page-42.md`, `page-43.md` and `page-44.md` were compared screen by screen.
Read-only; no `.env` opened. UI primitives under `components/ui`, `components/states` and `lib/**` are outside this slice and were only read where needed.

Severity: P1 = functional gap or data-integrity risk, P2 = missing spec behaviour or robustness gap, P3 = polish, copy, consistency.

## Findings

| ID | Sev | file:line | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| R6-01 | P1 | components/calling/hooks.ts:176-181 | The reservation is released only on React unmount. There is no `pagehide`/`beforeunload` handler and no `keepalive`/`sendBeacon` release (`releaseReservation` in lib/api/calling.ts:351 is a plain fetch). Closing the tab or reloading leaves the contact reserved until the lease or idle timeout. | The brief requires release on unload. Other agents are blocked from the business, and the Owner needs an override. | Add a `pagehide` listener that sends a `keepalive: true` POST to the release endpoint. Allow `keepalive` in the api client. |
| R6-17 | P1 | components/delivery/ProjectBoard.tsx:386-389, 579-615 | **SCR-DEV-007 Task detail drawer is not built.** Task cards are not clickable. A task's owner, start and due dates, description, client-dependency flag and note cannot be edited after creation. The only task actions are the inline status buttons and "Cancel…". There is no "Save changes", no task conflict view and no mobile task page. | A whole spec screen is missing. Developers cannot maintain tasks, including the client dependency that the board displays. | Build the drawer from the spec (status select, conditions row, Owner select, dates, description, "Cancel task…") on `updateTask`. |
| R6-02 | P2 | components/calling/ContactWorkspace.tsx:446-450 | `InboundRejectionDialog.submit` calls `newIdempotencyKey()` on every click. A retry after a timeout or network error gets a new key. | A retried save can double-apply. The brief requires the same key on retry. | Hold the key in a ref per dialog open (as `businesses/new/page.tsx:37` does). Rotate it only after success or a definitive failure. |
| R6-03 | P2 | app/businesses/new/page.tsx:79 | The key is rotated on every failure except `NETWORK_ERROR`, including 5xx and timeouts where the outcome is unknown. | A timed-out create that actually succeeded would be created again. | Keep the key for 5xx and timeouts. Rotate only on 4xx or after success. |
| R6-04 | P2 | components/calling/hooks.ts:121-141 | A 5xx on heartbeat is treated as "offline" (`isNetwork` includes `status >= 500`), so the banner says the network is down. A genuine 403/404 maps to `access_denied`. | Misleading copy. Low risk otherwise. | Show a server-error banner distinct from the offline banner. |
| R6-05 | P2 | components/calling/Opportunities.tsx:88-103; LogAttemptPanel.tsx:333-348 | "Assign developer", "Schedule first meeting" and the Developer select are permanently `disabled` with an empty options list. The Accepted form has no developer field either, so **there is no path in the UI to assign a developer**. The SCR-CC-007 "Edit handoff context" link and the row kebab are also absent. | The handoff screen cannot do its job. Deals created from Accepted stay "Developer not yet assigned". | Backend assign endpoint plus wiring, or offer the developer select on the Accepted outcome (BE3-C1 accepts `developerId`). |
| R6-06 | P2 | components/calling/LogAttemptPanel.tsx:365-372 | "Save, keep reservation" stays visible while the session is `lost`. It is correctly hidden for Rejected (`allowed.keepReservation[outcome]`, server driven, and the body also forces `keepReservation:false` for rejected, line 79). | Offering "keep reservation" with no reservation is confusing. | Hide it when `session.phase === 'lost'`. |
| R6-07 | P2 | app/do-not-call/page.tsx:1541 | "Start Contact" on a Rejected business is permanently disabled with no reason text. The workspace version (ContactWorkspace.tsx:511-523) explains itself, this one does not. | Dead-looking control, no a11y reason. | Add `title`/`aria-describedby` ("Rejected businesses cannot be contacted. Reopen first.") or remove it. |
| R6-08 | P2 | components/delivery/DealDetailView.tsx:112-127 | The header actions `a.reopen` and `a.markNotProceeding` rely entirely on server `allowed`; there is no client `!closed` guard. The closure section guards `closed`, and fact-remove uses `!closed`. | If the server ever returns `markNotProceeding` on a closed deal, the UI would offer it. | Add a defensive `!closed &&` on both. |
| R6-18 | P2 | components/calling/FollowUps.tsx:272-340, 408-444; app/calendar/page.tsx:1216-1219 | After a 409 the drawer/dialog call `onChanged()` to reload lists, but they keep the snapshot `target` (and its `version`) the user opened. The retry sends the same stale version and conflicts again until the drawer is closed and reopened. | The user cannot recover from a conflict in place; the message says the latest version is loaded, which is untrue for the form. | After a conflict, re-read the follow-up and swap the target (keep the typed time and reason). |
| R6-19 | P2 | components/calling/ContactWorkspace.tsx:489-608 | **SCR-CC-005 reserved-by-other panel** lacks "Retry", "Back to queue" and the reservation-details card (holder, since, lease ends, "your assignment"). Only a disabled Start Contact and one sentence are shown. | The agent must reload the page to retry. Spec behaviour missing. | Add the details card and the Retry (re-fetch workspace) and Back-to-queue buttons. |
| R6-20 | P2 | app/calendar/page.tsx; components/calling/FollowUps.tsx:109-153, 290-385 | **SCR-CC-004/006:** no state filter chips (Open / Completed / Cancelled / All); only open follow-ups plus a "Completed follow-ups: n" count. No "Callback to be scheduled" group. The create drawer has no "Responsible *" select, no Note field and no "Clears Callback to be scheduled" banner. | Businesses with the D2 callback marker cannot be scheduled from the follow-up page; completed or cancelled items cannot be reviewed. | Add the filter chips and the callback group; add Responsible and Note to the drawer. |
| R6-21 | P2 | components/delivery/ScheduleMeetingDrawer.tsx:54, 62 | Hard-coded endpoints `'/api/businesses?pageSize=100'` and `'/api/employees?pageSize=100'` bypass `lib/api` path helpers. Only the first 100 businesses are selectable (no search), and the employees list is needed for the required Host field; if the role cannot list employees the Host select is empty and the form cannot be submitted. | Large directories are unreachable. A Developer or Call Center user may be blocked. | Use a typeahead on a search endpoint. Default the host to the current user and make the employee list optional. |
| R6-22 | P2 | components/delivery/DealsList.tsx:50-68, 178-190 | Search text and Project status are applied client-side to the one loaded page of 50. The tab count, "Page n of m" and totals ignore them. | Filters hide matches that sit on other pages; counts mislead. | Pass `q` and `projectStatus` to the API (BE4-C1 item 6), or label the filters as page-local. |
| R6-23 | P2 | components/delivery/MeetingDrawer.tsx:55-236 | **SCR-DEV-004** differs from the spec: no "Previous time" info banner, no Attendees multi-select, no Notes field with counter, no "Request correction" entry on mobile, and "Cancel meeting…" is a tab, not a left-aligned ghost button. Reschedule takes datetime-local inputs instead of Date + Start/End. | Reschedule cannot change attendees. Spec fidelity gap. | Align with the frame. |
| R6-09 | P3 | components/delivery/DealsList.tsx:87-96 | The "Accepted opportunities" tab is a permanently disabled tab with the DEC-005 chip. | Intentional per Alt-1, but a dead tab. | Keep. Confirm with the product owner. |
| R6-10 | P3 | components/delivery/ProjectBoard.tsx:263 | "Edit schedule" is disabled with the title "not designed yet (deferred)". | Dead button, documented. | Hide until designed. |
| R6-11 | P3 | components/businesses/ResolveCorrectionDrawer.tsx:153 | "Edit business" is rendered disabled when `!canAct`, with no reason. | No explanation for the disabled state. | Add helper text, e.g. "Take the request first". |
| R6-12 | P3 | do-not-call/page.tsx:1513, ContactWorkspace.tsx:49, DealDetailView.tsx:320,339 | Inline text-link buttons ("Request correction", "Schedule", "Withdraw") have no 44 px target. | Mobile target size. | `min-h-11` on small screens. |
| R6-28 | P3 | businesses/FilterChip.tsx:30; delivery/MeetingsView.tsx:117,137 | FilterChip is `h-8`; the Week/List tabs and "My meetings" toggle are `h-8` (32 px). Spec mobile wraps chips in 44 px hit areas. | Mobile target size. | Add 44 px hit-area wrappers. |
| R6-13 | P3 | businesses/format.ts:5; delivery/shared.tsx:25-44 | Three time bases: business screens render UTC (TODO for `useCompanyTime`), delivery screens use the browser's local time (`fmtTime`, `fmtDayMonth`, week Monday), calling screens use the company timezone. | The same instant shows different times across modules. | Move all to `useCompanyTime`. |
| R6-14 | P3 | components/calling/LogAttemptPanel.tsx:184,191 | Two `eslint-disable react-hooks/exhaustive-deps`. | Stale-closure risk, related to the baseline lint errors. | Memoise or use refs. |
| R6-15 | P3 | components/calling/ContactWorkspace.tsx:224-225 | Copy "times illustrative" and "idle rule pending" is shown to users in the banner. | Demo wording; deliberate labelling. | Show only while the policy is pending. |
| R6-24 | P3 | components/calling/Opportunities.tsx:46,76; delivery/DealDetailView.tsx:304 | Raw enum strings reach the screen: the Opportunities Stage cell and handoff "Commercial stage" print `o.deal.stage` (e.g. `accepted_opportunity`). Deal history prints `type.replace(/[._]/g,' ')` with no actor. | Unpolished copy. | Use `DEAL_STAGE_LABEL`; add history labels and the actor. |
| R6-25 | P3 | app/queue/page.tsx:1160; calling/QueueBoard.tsx:11-44 | The "Rejected: do not call (n) — view only" strip is plain text, not a link to `/do-not-call` (spec: Link S with chevron). There is no "Data correction requested" bucket and no mobile chip row (To schedule / New / Correction). Filter is name only (spec: name or phone). Derived-chip copy says "exactly one" bucket, spec says "can be in 2". | Dead-looking strip; spec deviation. | Make it a link; add bucket and chips if the API provides them. |
| R6-26 | P3 | businesses/BusinessTable.tsx:93-137; SearchResults.tsx | Directory and search render the desktop table with horizontal scroll on phones. Spec SCR-DE-001 mobile is a 64 px row list with no chevrons, plus a full-width "Add business" footer. | Poor mobile usability and fidelity. | Add a mobile list layout. |
| R6-29 | P3 | calling/FollowUps.tsx:199-267; delivery/MeetingsView.tsx:226-290; calendar/opportunities/do-not-call/projects pages | Week grids hide events outside 09:00-18:00 with no indicator. Completed events in the follow-up week grid are buttons that do nothing. Lists are capped at `pageSize` 100 with no truncation notice (calendar, opportunities, do-not-call, projects). | Silent data loss in views. | Show an "outside hours" row and a truncation notice. |
| R6-30 | P3 | delivery/ProjectsList.tsx:224-236 | "Create project" shows to every viewer when auto-provision is off; the deal page limits it to Owner or the assigned developer. | Users get a 403 after clicking. | Gate by role like `DealDetailView`. |
| R6-31 | P3 | delivery/ProjectsList.tsx:74-83 | The workload metric shows "active · open tasks" with hint "SB-3 §11 definition", and the Active projects hint reads "No change". The spec metric is "Deals · Projects · Tasks (yours)". | Placeholder-style copy. | Align copy and values with the spec. |
| R6-32 | P3 | app/businesses/new/page.tsx:124; edit/page.tsx:575 | "Cancel" calls `router.push` without a dirty-state confirmation; only `beforeunload` guards tab close. | In-app navigation discards the form silently. | Confirm when dirty. |
| R6-33 | P3 | businesses/businessFormModel.ts:9; FlagChips.tsx:8 | `COUNTRY_CODES = ['+000','+961']` ships a placeholder code. The flag label reads "No phone (B2)" and leaks a rule ID. | Placeholder in production UI. | Source from settings; drop the ID. |
| R6-34 | P3 | calling/ContactWorkspace.tsx:67 | Copy-phone button calls `navigator.clipboard?.writeText` with no feedback or error handling. | The user cannot tell it worked. | Toast on success and failure. |
| R6-35 | P3 | delivery/ProjectBoard.tsx:344-363, 396-426 | **SCR-DEV-006:** the milestone track is a 4-column dot grid. The spec has a track with a progress bar, a Today line and a "31 days to target" chip. The rail rows lack the actor ("2 Oct · Maya Khoury") and the "Business details wrong? Request correction" link. Status bar lacks "· by <name>". | Fidelity gap. | Build the Timeline/Milestone component. |
| R6-36 | P3 | delivery/DealDialogs.tsx:192-264 | **SCR-DEV-008** finalize dialog is the generic command dialog. It does not show the Accepted/Signed/Paid KV block or the "Closing records you and the time" sentence. | Spec fidelity. | Add the facts block. |
| R6-37 | P3 | businesses/SubmitCorrectionDrawer.tsx:61; calling/FollowUps.tsx:323; delivery/ProjectBoard.tsx:625 | Create calls (`submitCorrection`, `createFollowUp`, `createTask`, `createProject`, `scheduleMeeting`) carry no Idempotency-Key. Double submit is blocked by the busy state only. | A retry after a lost response can duplicate the record. | Reuse a per-open key if the API accepts one. |
| R6-38 | P3 | businesses/BusinessDetailView.tsx:492-500 | The "Related" tab is a static empty state with no data source. | Placeholder tab. | Hide it until wired. |
| R6-16 | Info | whole slice | **No hex colours and no raw Tailwind palette classes** found. The only `var(--…)` use is `accent-[var(--brand-primary)]` (RadioCard) and `focus-within:shadow-[inset_0_0_0_2px_var(--focus-ring)]` (website field), both tokens. **No mock data**: every page uses API hooks. Pending policies render the demo chip. | Meets the tokens-only and real-data rules. | None. |

## Checks that passed

- **Reservation acquire.** `start()` posts with `newIdempotencyKey()`. It handles `RESERVATION_CONFLICT` (holder banner) and `STATE_CONFLICT` (refresh).
- **Heartbeat.** Interval is `heartbeatSeconds` from policy; idle seconds come from user input only (blur is not idle); `keepWorking` after the max-total warning; the `online` event renews immediately; server deadlines are trusted.
- **Offline and lost banners.** Offline shows a banner and a "Retry now" button. `RESERVATION_LOST` maps to a lost banner with the reason and "Reopen contact"; the reopen path re-acquires without losing the draft.
- **Log-attempt save.** `useVersionedSave.retry()` reuses the same Idempotency-Key and stored version; a new save gets a new key. A 409 keeps the draft and refreshes the workspace. A failed save never clears the draft.
- **Save-after-loss, both flag branches.** `reject`: save is blocked, the alert explains, a server `RESERVATION_LOST` calls `markLost`. `keepAttemptOnly`: the button reads "Save attempt only", and `outcome_not_applied` shows a warning toast plus the attempt-only alert.
- **Rejected outcome.** "Save, keep reservation" is hidden from `w.allowed.keepReservation` (U-01). The request body also forces `keepReservation: false` for rejected.
- **Duplicate flow.** A visible match shows name, phone and "Open existing business". A hidden match shows existence only. There is no bypass, and `SimilarNameDialog` uses `confirmSimilar`.
- **Correction drawers.** Submit: issue type and description required, open requests warn without blocking. Resolve: Take, Release, Close-no-change and Reject need a note, terminal states are read-only, conflicts reload the state.
- **Required reasons.** At least 3 characters on override, reopen and re-queue, inbound rejection, follow-up cancel and reschedule, deal reject / not-proceeding / reopen / remove-fact, meeting cancel, project blocked / waiting / reopen and task cancel. Signature and payment references, amount and currency are validated.
- **Closed deals.** Closure actions (finalize, request, verify, reject) are hidden and replaced by an info card. Fact removal is hidden. Provisioning retry shows only for the Owner.
- **Record delivered.** `RecordDeliveredDialog` consumes the 422 `OPEN_TASKS_WARNING`. Confirm resends with `acknowledgeOpenTasks: true`. Cancel and "Review open tasks" make no call.
- **Policy chips.** Demo chips (`PolicyPendingChip`/`NoticePolicy demo`) appear on every screen with a pending policy. "Accepted keeps reservation" (U-01) is correctly unchipped.
- **Hooks order.** Early returns in pages and views come after all hooks.

## Per-screen fidelity (against page-42 / page-43 / page-44)

| Screen | Status | Deviations from the Figma spec |
|---|---|---|
| SCR-DE-001 Business directory | Minor | 5-column filter grid; search is one of five (spec: search flex-1 plus 4 selects). "Created by: Any" (spec "Anyone"). "Archived" is a live Owner-only chip (spec: disabled "Archived · C-01 pending"); intentional C-01 alternative. Mobile card list and full-width "Add business" footer are missing (R6-26). Page size 8 and pagination match. |
| SCR-DE-002 Create business | Minor | 3-column grid, cards, required markers, footer status text and DEC-013/015/014-023/B2 chips match. "Suggest a new category" is "View categories" (link to `/categories`). Mobile footer is a wrapped bar, not the two-button sticky footer. Key handling R6-03. |
| SCR-DE-003 Duplicate blocked | Match | Spec marks it blocked (no frame). The dialog uses Dialog md plus a danger banner as the spec suggests. |
| SCR-DE-004 Edit business | Match | Breadcrumb, title, chips (extra DEC-013), "View edit history", two-line attribution footer and "Unsaved changes" status all match. The conflict view (SHR-014) is wired. |
| SCR-DE-005 Resolve correction | Minor | Status row, Request box, RadioCards, note counter, Release/Close/Edit business footer match. Disabled "Edit business" has no reason (R6-11). |
| SCR-DE-006 Correction queue | Match | Tabs with open count, filters, columns, sort, redacted row (`surface/subtle`, "Owner review only"), "Showing 1–n of n open" and the DEC-002 note match. Select labels say "Any" for "Anyone". |
| SCR-DE-007 Categories | Minor | Table, columns, Rename / Remove…, add card, policy blocks match. Add-card subtitle copy differs. Adds a "Built in" badge for system rows. Removal note shows only for the Owner. |
| SCR-SHR-008 Business detail | Minor | Header, tabs, Contact / Social / Notes cards, Correction requests, Record, DEC-001/002 block match. "Related" tab is a static placeholder (R6-38). Mobile tab-bar and order are the shared shell. |
| SCR-SHR-009 Submit correction | Match | Warning banner for open requests, fields, counter, footer match. An extra "Branch" field. Mobile bottom-sheet behaviour comes from the shared Drawer (not verified here). |
| SCR-SHR-010 Search results | Match | Match-type chips with counts, columns, "Matched on" tags, empty state with no hidden-record hint. |
| SCR-CC-001 Calling queue | Minor | Three-column board and bucket order match. H1 is 22/28 (spec H2 20/28). No "Data correction requested" bucket, no mobile chip row, filter is name only, DNC strip is not a link, derived-chip copy differs (R6-25). |
| SCR-CC-002 Contact workspace | Minor | Rail, business card, call history and contact panel present. Row/Phone has no "Main" tag, no social rows or business-details block, no "+n more number", no mobile sticky Start Contact footer. |
| SCR-CC-003 Active contact | Minor | Outcome RadioCards with dots, D4/DEC-005 chips, follow-up box with Set now / Set later, notes and footer match. The reservation banner uses the success tone, spec uses Brand. "Keep reservation" visible when lost (R6-06). Mobile "Keep reserved" ghost not in a sticky footer. Notes counter missing. |
| SCR-CC-004 Follow-ups & calendar | Deviation | No Open/Completed/Cancelled/All chips, no reminder-failure banner, no "Callback to be scheduled" group (R6-20). Groups Overdue / Due today / Upcoming, row actions, Today agenda and DEC-002 chip match. |
| SCR-CC-005 Reservation & concurrency | Deviation | Banner and disabled Start Contact present. Missing: reservation-details card, Retry, Back to queue (R6-19). Adds an Owner override with a mandatory reason. |
| SCR-CC-006 Follow-up drawer | Deviation | Date/time with a past-time error and a reschedule reason exist. Missing: Responsible select, Note, callback banner (R6-20); stale version after a conflict (R6-18). |
| SCR-CC-007 Opportunities & handoff | Deviation | Table and handoff panel present, but actions are disabled (R6-05). Filter chips differ (no "Meeting not yet arranged"). No row kebab or "Edit handoff context". Raw stage enum (R6-24). |
| SCR-CC-008 Do-not-call list | Minor | No Phone column and no "Reopened" chip. The banner copy is role dependent. Start Contact disabled without a reason (R6-07). The Reopen dialog is Owner only and carries the DEC-016 chip. |
| SCR-DEV-001 Deals | Minor | Header, count badge, columns, caption and policy row match. The filter bar uses selects, not chips; no "Developer: Any" filter; caption says "closed date" (spec "stage date"). Client-side filtering (R6-22). |
| SCR-DEV-002 Deal detail | Minor | Facts, closure card, handoff, history and Business-context rail present. Rail omits Category / Phone / Website KV and the DEC-005 chip. No "Previous call notes" link and no "More actions" button. R6-08. |
| SCR-DEV-003 Meetings & calendar | Minor | Week grid (60 px/hour, today pill, event kinds), legend, toolbar and policy row match. The mobile agenda sections (NEEDS AN OUTCOME / TODAY / TOMORROW) are a flat sorted list. Policy chip reads "DEC-005" without the "Alt 2" text. Events outside 09:00-18:00 are hidden (R6-29). |
| SCR-DEV-004 Meeting drawer | Deviation | R6-23. |
| SCR-DEV-005 Projects | Minor | Table, filters (selects instead of chips; no "Developer: Any"), provisioning banner (a card list), conditions and policy row. Metric tiles differ (R6-31). |
| SCR-DEV-006 Project board | Minor | Status bar with moves, 4 kanban columns, deal-context rail, activity and the Record-delivered warning flow work. Milestone track and rail details differ (R6-35). Mobile status card actions ("Change status", "Open deal", "Request correction") are absent. |
| SCR-DEV-007 Task detail drawer | **Missing** | R6-17. |
| SCR-DEV-008 Finalize closure dialog | Minor | R6-36. Built behind the server's `allowed.finalize`/`closureMode` as the spec's flag requires. |

## Files read in full

All of these were read in full, line by line.

Pages (`frontend/src/app/`):
- businesses/page.tsx, businesses/new/page.tsx, businesses/[id]/page.tsx, businesses/[id]/edit/page.tsx
- categories/page.tsx, corrections/page.tsx, search/page.tsx
- queue/page.tsx, queue/[businessId]/page.tsx
- calendar/page.tsx, opportunities/page.tsx, do-not-call/page.tsx
- deals/page.tsx, deals/[id]/page.tsx, meetings/page.tsx
- projects/page.tsx, projects/[id]/page.tsx

`frontend/src/components/businesses/`:
- AsyncState.tsx, BusinessDetailView.tsx, BusinessFilters.tsx, BusinessForm.tsx, BusinessFormCards.tsx, businessFormModel.ts, BusinessTable.tsx
- CategoryPanels.tsx, CategoryTable.tsx, CorrectionsTable.tsx, DuplicateBlocked.tsx
- FilterChip.tsx, FlagChips.tsx, format.ts, hooks.ts, PageHeader.tsx, RadioCard.tsx
- ResolveCorrectionDrawer.tsx, saveErrors.ts, SearchResults.tsx, SubmitCorrectionDrawer.tsx, useUnsavedChangesGuard.ts

`frontend/src/components/calling/`:
- CallingPageHeader.tsx, ContactWorkspace.tsx, FollowUps.tsx, format.ts, hooks.ts
- LogAttemptPanel.tsx, Opportunities.tsx, PolicyNotes.tsx, QueueBoard.tsx, QueueRail.tsx

`frontend/src/components/delivery/`:
- DealDetailView.tsx, DealDialogs.tsx, DealsList.tsx, DeliveryFrame.tsx
- MeetingDrawer.tsx, MeetingsView.tsx, ProjectBoard.tsx, ProjectsList.tsx
- RecordDeliveredDialog.tsx, ScheduleMeetingDrawer.tsx, shared.tsx

Also read for context (outside the slice): `lib/hooks/useVersionedSave.ts`, `lib/api/calling.ts` (release and renew calls), and specs `page-42.md`, `page-43.md` and `page-44.md`.

## Wiring map (slice)

- **Directory / detail / forms:** `lib/api/businesses.ts` through SWR hooks in `businesses/hooks.ts`. Writes: `createBusiness` (with an Idempotency-Key), `updateBusiness` (version, optional `correctionId`), archive / restore, category create / rename / deactivate.
- **Corrections:** `lib/api/corrections.ts` (list, get, submit, take, release, close-no-change, reject, withdraw).
- **Calling:** `lib/api/calling.ts` through `calling/hooks.ts` (queue, workspace, follow-ups, opportunities, do-not-call); reservation acquire / renew / release / override; `logAttempt` and `logInboundRejection` with Idempotency-Keys; reopen / requeue; follow-up create / update / complete / cancel.
- **Delivery:** `lib/api/deals.ts` (`runDealCommand` with an Idempotency-Key through `useVersionedSave`), `lib/api/projects.ts`, `lib/api/meetings.ts`; `ScheduleMeetingDrawer` also calls raw `/api/businesses` and `/api/employees` (R6-21).
- **Unwired controls:** Assign developer, Schedule first meeting, Developer select (R6-05); Edit schedule (R6-10); Accepted opportunities tab (R6-09); Start Contact on the do-not-call page (R6-07).
