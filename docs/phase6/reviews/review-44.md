# Review — Page 44 HiFi Developer (SCR-DEV-001..008)

Independent UI reviewer, 2026-10-21. Source: the fresh previews in `docs/phase6/previews/44/` (51 PNGs, re-taken after C01–C08, DS-13c relayout and D-2 fit fixes). No Figma access was used. Checked against brief §1/§3/§6, inventory rows SCR-DEV-001..008, `screens/developer-spec.md`, the Developer section of `interaction-spec.md` and `coordination.md`.

**Frames inspected:** all 51. That covers every primary Light, all 8 Dark, all 7 mobile, and all 36 state frames.
**Status:** this review approves nothing. It lists defects only.
**Known open item (recorded, not re-reported):** D-1, the Notice/Access Context-limited text width. A component fix is in progress. It is visible as the narrow DEC-006/R-12 notice in the board's Deal context rail and as the "Limited business context" notice on DEV-002/008.

## Coverage vs inventory

| Screen | Inventory needs | Frames present | Gaps |
|---|---|---|---|
| DEV-001 Deals | D P1 · stages incl. Not proceeding (Proposed) · dev not yet assigned · provisioning pending · empty | L, D, Accepted (Alt 1), Owner needs-attention, Empty, Loading, Load error | The **Not proceeding** stage is never shown as a row or badge; it appears only as an Owner tab count. Signed / Paid appear only on the Alt 1 tab, which is correct. |
| DEV-002 Deal detail | D P1 · each stage · verification requested/rejected · save conflict · hidden · actions record signature/payment, mark not proceeding, Owner remove fact | L, D, Accepted, Rejected, Owner review, Owner remove fact, Hidden, Conflict | **Not drawn:** the Record signature/payment form (date + reference) and the Mark-not-proceeding reason dialog. Neither is listed as "not drawn" in the spec. **Missing affordance:** "Request correction" (see M-1). |
| DEV-003 Meetings | D P1, M P2 · upcoming/awaiting · Missed · reminder failed · empty | Week L, Week D, List with states, Empty, Mobile L | OK. |
| DEV-004 Meeting drawer | D P1, M P2 · past-time, ≥1 attendee, previous values, success | Reschedule L/D, Validation, Record outcome, Cancel, Mobile Reschedule, Mobile Outcome+success | The "Schedule new" mode is not drawn (it is DEC-005 Alt 1 only, so acceptable if recorded). There is no desktop success. |
| DEV-005 Projects | D P1 · statuses Scheduled…Completed · overdue · empty | L, D, Empty, Loading | No **Scheduled** or **Delivered** project-status row is shown. |
| DEV-006 Project board | D P1, M P1 · open-task warning · Completed read-only · conflict · hidden · Owner assign developer | L, D, Record delivered warning, Completed, Conflict, Hidden, Mobile L | The Waiting for client… / Blocked… reason dialogs and the Edit schedule drawer are not drawn; the spec declares this. There is no Owner view (assign developer). |
| DEV-007 Task drawer | D P1, M P1 · overdue · validation · conflict · success | L, D, Validation, Conflict, Success, Mobile L, Mobile Conflict | Reopen (Done → In progress) is not shown. Minor. |
| DEV-008 Closure dialog | D P1 · not allowed (fact/role) · F3 · success | Confirm L/D, Request (Alt B), Not allowed, F3, Success F2 | OK. The role reading is carried by the R-12 note only. |

## Policy and boundary checks

| Check | Result |
|---|---|
| Developer sees eligible closed deals only | Pass. The Closed tab shows Closed deal rows only. Pre-closure rows appear only on the Alt 1-labelled tab. Hidden rows are "omitted and not counted". |
| Never edits master data / uses "Request correction" | **Fail.** No editing controls are shown, but no "Request correction" / "Flag incorrect data" entry point exists anywhere on page 44 (M-1). |
| "Waiting for client" is a project status only; tasks use the "Client dependency" chip | Pass on all board, drawer, dialog and mobile frames. |
| "Record delivered" open-task warning | Pass. The copy matches interaction-spec P7. It is a warning, not a block, and is labelled OQ-10 Proposed. |
| Reports, exports and audit not visible to Developer | Pass. The Developer sidebar is My Day / Attendance / Deals / Meetings / Projects. Reports and Audit appear only in the Owner-view frames. |
| Pending policies labelled, never decided | Pass. DEC-005/006/017/018/019/002, R-12, R-13, F2 and F3 are all chipped "pending / not selected", and the F2 success shows both alternatives. |
| Dark readability | Pass overall, with one minor item (see the minor list). |

## MUST-FIX

| ID | Preview file | Frame | What you see | Fix |
|---|---|---|---|---|
| M-1 | `SCR-DEV-002 — Deal record detail — Desktop — Light.png` (and Dark, Accepted, Rejected, Conflict; DEV-006 Deal context rail) | SCR-DEV-002 D-L `125:78078` | The Business context rail shows Business / Category / Phone / Website but has no "Request correction" action. The brief §6 boundary requires the Developer to use "Request correction" for master data, and interaction-spec lists "Flag incorrect data" → SCR-SHR-009. | Add a "Request correction" link or tertiary button in the Business context card, targeting SCR-SHR-009. The target frame is still blocked (DE-2), so annotate it as pending. Show it on at least D-L, Dark and Accepted. |
| M-2 | `SCR-DEV-002 — Deal record detail — Desktop — Light — Save conflict.png` | Save conflict `125:80199` | The banner says the payment fact was removed and the stage is now Signed (payment outstanding). The page still shows "Signed and paid · awaiting closure", Payment "Recorded 15 Oct", "All three facts are recorded", and **Finalize closure… / Request closure verification enabled**. The view contradicts itself and invites a second invalid action. | Either show the reloaded state (Payment = Not recorded, stage Signed, closure actions replaced by "Record payment…"), or mark the facts as stale and disable the closure actions until "Review changes" / reload. Apply the same treatment to the DEV-006 conflict frame (`SCR-DEV-006 … Save conflict.png`), where the "Move project to" buttons stay live under "status changed to Waiting for client". |
| M-3 | `SCR-DEV-001 — Deals — Desktop — Light — Empty.png`, `… — Load error.png` | Empty `123:12615`, Load error `123:12933` | The "Closed deals **5**" tab count is still shown above "No eligible closed deals yet" and above "Deals could not be loaded". | Set the count to 0 (Empty) and hide it (Load error). |
| M-4 | `SCR-DEV-003 — Meetings & calendar — Mobile — Light.png` | Mobile L | Every agenda row truncates both the meeting name and its condition: "Sunrise Bakery — s…", "Mon 19 Oct, 11:00 · awai…", "reschedul…", "needs rearran…". The key information (awaiting outcome, needs rearranging) is unreadable on the mobile view. | Let the title wrap to 2 lines and put the derived condition on its own line or chip (for example, an "Awaiting outcome" chip instead of "Scheduled" in the Needs-an-outcome group). Keep the status badge. |
| M-5 | `SCR-DEV-002 — … — Accepted opportunity (DEC-005 Alt 1, not selected).png` (also visible in `SCR-DEV-008 … Not allowed (missing facts).png`) | Accepted `125:78533` | The rail meeting item reads "Member app ki…" / "Wed 21 Oct, 14:0…": the meeting time is cut. | Wrap the title to 2 lines or drop "kickoff", and give the meta line full width (move the Scheduled badge below or shorten it). The time must never truncate. |
| M-6 | `SCR-DEV-004 — … — Desktop — Light — Cancel meeting.png`, `… — Record outcome.png`, `… — Mobile — Light — Record outcome + success.png` | Cancel / Record outcome drawers | Badges are stretched to the full drawer width. The "Scheduled" badge in Cancel and the "DEC-005 who may record an outcome" chip on desktop and mobile appear as long pill bars, likely a side effect of the FIXED→FILL relayout. This is inconsistent with the hug-width chips used everywhere else. | Set these Badge/Chip instances back to HUG (only fields get FILL). Re-check the other drawers after the relayout. |
| M-7 | `SCR-DEV-007 — Task detail — Mobile — Light — Save conflict.png` | Mobile Save conflict | The "Review changes" action is a small inline text link (about 16 px tall) inside the banner. Brief §2.8 requires mobile tap targets of at least 44 px. | Make it a 44 px tertiary button, or move it into the footer next to Discard / Reload task. |
| M-8 | `SCR-DEV-006 — Project board — Desktop — Light — Completed (read-only).png` vs `SCR-DEV-005 — Projects — Desktop — Light.png` | Completed board | There are two data contradictions. (a) The project starts on **21 Sep** and "Design approved" is on 24 Sep, but the deal closed on **28 Sep** and the project was "Provisioned 28 Sep", so delivery work predates closure and provisioning. (b) The board has 3 tasks (2 Done + 1 Cancelled), while DEV-005 says Urban Cuts is "4 of 4 done". | Move the start date and first milestone to on or after 28 Sep. Align the task totals, for example board Tasks 4 = 3 Done + 1 Cancelled, and the list shows "3 of 3 done · 1 cancelled", or make both 4. |
| M-9 | (coverage) DEV-002, DEV-006 | — | Inventory actions with required fields have no HiFi frame and are not listed as "not drawn": the Record signature… / Record payment… form (date + reference) and the Mark not proceeding… reason dialog. The project "Waiting for client… / Blocked…" reason dialogs are declared not drawn but are not reconciled in the screen register. | Either add the frames (one small dialog per pattern is enough), or have the orchestrator record them explicitly in `screen-register.md` as deferred annotation-only items. |

## Minor (fix if cheap; no re-review needed)

1. **DEV-001 L/D: row heights vary.** Rows are 56 / 80 / 100 px depending on chips, and the long deal titles truncate ("Patient booking p…", "Online booki…").
2. **DEV-003 Week:** the "Outcome due" event uses the red error style, but the legend shows Awaiting outcome as an amber dashed chip. Align the colours.
3. **DEV-003 List:** rows are not in chronological order (Mon 19 after Wed 21; Thu 15 after Mon 19), and the attendees truncate ("Maya Kho…"). Group by need, as mobile does, or sort by date.
4. **DEV-004 Record outcome:** the radio-card description text wraps at about 200 px, leaving a large empty right side. This looks like a fixed-width text layer.
5. **DEV-004 Mobile Record outcome + success:** the "Outcome saved" toast is shown while the sheet is still open with "Save outcome". Per the spec the sheet closes on success, so show the toast over the agenda.
6. **DEV-004 Mobile Reschedule:** there is no "Cancel meeting…" entry, although it exists on desktop.
7. **DEV-005:** the list says "Sorted by target delivery date", but the order is 16 Oct, 20 Nov, 4 Dec, 10 Oct. The Active-projects caption reads "Company-wide eligible" on the primary frame and "Assigned to you" on Empty.
8. **DEV-006 L / Conflict / Success:** the "Today · 20 Oct" marker sits on the Content received (28 Oct) node instead of between 17 Oct and 28 Oct. The Activity title truncates ("Client dependency add…").
9. **DEV-006 Dark:** the kanban column backgrounds disappear, so the columns are not visually separated (Light has a grey column fill). This also applies to the DEV-007 Dark background.
10. **The "+" icon on the primary "Add task" button** (DEV-006 L, Conflict, Success; mobile) is nearly invisible against navy.
11. **DEV-006 Record delivered dialog:** the task names in the open-task rows are centre-aligned. Left-align them after the status badge.
12. **DEV-006 Conflict:** the To do column collapses to "+1 more · Payment page" even though there is room. The count says 2.
13. **DEV-006 Mobile:** the bottom-nav tab is labelled "Tasks" while the screen is a project board, and there is no "Open deal" link.
14. **DEV-007 Conflict (desktop/mobile):** the owner select shows "Sami Fares (yours) · Lina Aoun (latest)" inside the field. The mobile due date still shows the old 14 Oct although Lina changed it. Prefer the SCR-SHR-014 comparison pattern.
15. **DEV-007 Validation:** the In-progress "Booking flow" has a start date of 21 Oct, which is in the future (today is 20 Oct).
16. **DEV-008 Dark Confirm:** the scrim is weak, so the background text stays fully legible behind the dialog.
17. **DEV-008 F3 / Success:** the background header still shows "Signed and paid · awaiting closure" behind a "Deal closed" dialog. This is acceptable for an overlay, but consider a Closed deal stage behind it.
18. **DEV-001 Load error:** the empty state card is fine. Consider not showing the filters as active while nothing is loaded.

**Must-fix count: 9** (M-1 … M-9). D-1 is excluded as a known open item.

## Recheck 2026-10-22 (fresh previews)

Source: the 57 fresh PNGs in `previews/44/` (index dated 2026-10-22), checked against the M items above and the [D-3]/[D-5] posts. No Figma access was used. **This recheck approves nothing.**

| M-id | status | preview | note |
|---|---|---|---|
| M-1 | Verified fixed | `SCR-DEV-002 — … — Desktop — Light.png`, `… — Accepted opportunity …png`, `SCR-DEV-006 — … — Save conflict.png`, `SCR-DEV-004 — … — Reschedule.png` | "Request correction" now appears in the Business context header, the DEV-006 Deal context rail and the DEV-004 drawer, with no edit controls. The DE-2 "pending" annotation is not visible in the frames themselves, so it is assumed to be on the Annotations frame. |
| M-2 | Verified fixed | `SCR-DEV-002 — … — Save conflict.png`, `SCR-DEV-006 — … — Save conflict.png` | DEV-002 shows the reloaded state (Signed · payment outstanding, Payment Not recorded, closure actions disabled, "Record payment…"). On DEV-006 the status is marked "Out of date · reload" and the move actions are disabled. |
| M-3 | Verified fixed | `SCR-DEV-001 — … — Empty.png`, `… — Load error.png` | The Empty tab count is 0 and the Load error frame hides the count. |
| M-4 | Verified fixed | `SCR-DEV-003 — Meetings & calendar — Mobile — Light.png` | Titles and times show in full. The condition is now its own chip (Awaiting outcome / Upcoming / Needs rearranging). |
| M-5 | Verified fixed | `SCR-DEV-002 — … — Accepted opportunity …png`, `SCR-DEV-008 — … — Not allowed (missing facts).png` | The rail reads "Member app kickoff / Wed 21 Oct, 14:00–15:00 · upcoming" in full, with the badge on its own line. |
| M-6 | Fixed but new problem | `SCR-DEV-004 — … — Cancel meeting.png`, `… — Record outcome.png`, `… — Mobile — Light — Record outcome.png` | The badges and the DEC-005 chip now hug their content. However, the same drawers now have form fields that do not fill the drawer width and text that is clipped (see N44-1, N44-2). |
| M-7 | Verified fixed | `SCR-DEV-007 — Task detail — Mobile — Light — Save conflict.png` | "Review changes" is now a full-width button of about 44 px, below the banner. |
| M-8 | Verified fixed | `SCR-DEV-006 — … — Completed (read-only).png`, `SCR-DEV-005 — Projects — Desktop — Light.png` | The project starts 28 Sep and the first milestone is 1 Oct, both on or after closure and provisioning. The board has Tasks 4 = 3 Done + 1 Cancelled, and the list shows "3 of 3 done · 1 cancelled". |
| M-9 | Fixed but new problem | `SCR-DEV-002 — … — Record payment …png`, `… — Mark not proceeding (Proposed).png`, `SCR-DEV-006 — … — Waiting for client (note required).png`, `… — Blocked (reason required).png` | The dialogs are now drawn, and the remaining deferrals are recorded in `screen-register.md` (line 20). But the C02b dialogs have the same field-width and clipping defect (N44-1, N44-2), and the Waiting for client value row is clipped. |

**D-5 fit check:** the week-view event titles are not clipped (`SCR-DEV-003 … Desktop — Light.png`, and Light in the drawer backdrops). The full-height drawers (DEV-004, DEV-007) reach the frame bottom and their footers are fully visible, with no vertical clipping. This confirms the "padding only" reading for height. The width defects below are a separate problem that the fit check does not catch.

### New must-fix

| ID | Preview file | What you see | Fix |
|---|---|---|---|
| N44-1 | `SCR-DEV-004 — … — Desktop — Light — Reschedule.png`, `… — Cancel meeting.png`, `… — Record outcome.png`; `SCR-DEV-007 — Task detail — Desktop — Light.png`; `SCR-DEV-002 — … — Record payment …png`, `… — Mark not proceeding (Proposed).png` (likely also Record signature) | Select, Input, Date/Time and Textarea instances stay at about 320 px (or about 150 px for half-width fields) inside the drawer or dialog, while the trailing chevron or calendar/clock icon sits outside the field border at the right edge. Textarea text runs past the field border ("…cakes with| pickup slots", "…members|hip tiers", "…photos on|ce received"). | Set the field instances, and their inner box, to FILL inside drawers and dialogs, with the icon inside the box. Then re-take previews and re-run the fit check against a horizontal-overflow rule (child text wider than its parent box). The C06b dialogs (Blocked / Waiting for client) are already correct and can serve as the reference. |
| N44-2 | `SCR-DEV-004 — … — Cancel meeting.png` ("A cancelled r… / neede…"), `… — Reschedule.png` ("Lina Aou…"), `… — Record outcome.png` (helper "amended la…"), `SCR-DEV-002 — … — Mark not proceeding (Proposed).png` ("full histo…"), `… — Record payment …png` ("(DEC-(…"), `SCR-DEV-008 — … — Not allowed (missing facts).png` ("Maya Khour…"), `SCR-DEV-006 — … — Waiting for client (note required).png` ("Waiting for clie…") | Text in Notice bodies, helper text and key-value value cells is hard-clipped at a fixed width inside drawers and dialogs, so the policy and warning copy is unreadable. | Set the Notice body, helper and value text to FILL with wrap (DS-13d FILL does not seem to reach drawer and dialog instances). Verify on every DEV-002, DEV-004, DEV-006 and DEV-008 overlay frame. |

**Recheck result:** 7 of 9 verified fixed, 2 fixed but with a new problem (M-6, M-9), and 2 new must-fix items (N44-1, N44-2). Nothing is approved.

## Recheck 2026-10-23

Source: the PNGs marked `new` in `previews/44/index.md` (OP-13-44, dated 2026-10-23, from C02, C02b, C04, C06b, C07 and C08), checked against N44-1, N44-2, M-6 and M-9 and the [D-6] post. No Figma access was used. **This recheck approves nothing.**

| ID | status | preview | note |
|---|---|---|---|
| N44-1 | Verified fixed | `SCR-DEV-004 — … — Desktop — Light — Reschedule.png`, `SCR-DEV-002 — … — Record payment …png`, `SCR-DEV-007 — Task detail — Desktop — Light.png` | The Select, Input, Date/Time and Textarea fields now fill the drawer or dialog width (half-width pairs too). Chevrons and calendar/clock icons sit inside the border, and the textarea copy wraps inside the box ("…cakes with pickup slots", "…membership tiers", "…photos once received"). |
| N44-2 | Verified fixed | `SCR-DEV-004 — … — Cancel meeting.png`, `SCR-DEV-002 — … — Mark not proceeding (Proposed).png`, `SCR-DEV-008 — … — Not allowed (missing facts).png`, `SCR-DEV-006 — … — Waiting for client (note required).png` | The notice bodies, helper text and value cells now wrap in full: "A cancelled meeting cannot be reopened…", "keeps its full history", "Maya Khoury", "In progress → Waiting for client" and "(DEC-018 pending)". |
| M-6 | Verified fixed | `SCR-DEV-004 — … — Desktop — Light — Cancel meeting.png`, `… — Record outcome.png`, `… — Mobile — Light — Record outcome.png` | The badges and the DEC-005 chip hug their content, and the N44-1/N44-2 follow-on defects in these drawers are gone. |
| M-9 | Verified fixed | `SCR-DEV-002 — … — Record signature …png`, `… — Record payment …png`, `… — Mark not proceeding (Proposed).png`, `SCR-DEV-006 — … — Waiting for client …png`, `… — Blocked …png` | All five dialogs are drawn with full-width fields and unclipped copy. Required markers, helper text and the "Stage after saving" row are present. |

### New must-fix

| ID | Preview file | What you see | Fix |
|---|---|---|---|
| N44-3 | `SCR-DEV-004 — Meeting schedule - record — Mobile — Light — Outcome saved (agenda + toast).png` | The toast says "Meeting marked Held. Notes added to DL-0037." The agenda behind it still lists Sunrise Bakery under NEEDS AN OUTCOME as Scheduled with Awaiting outcome. The post-save state contradicts the success message, which is the same class of defect as M-2. The toast also covers the bottom of the list, just above the DEC-005 chip. | Show the saved state: move Sunrise Bakery to EARLIER with a Held badge (or empty the NEEDS AN OUTCOME group), and keep the toast clear of the content or chip. |
| N44-4 | `SCR-DEV-008 — Finalize closure — Desktop — Light — Success (F2 Automatic vs Manual).png`, `… — Closed, provisioning failed (F3).png` | The header now shows the "Closed deal" stage, but the background Closure card still shows an enabled primary "Finalize closure…" with "All three facts are recorded", and the header still offers "Mark not proceeding…". The page is closed but still offers both actions, so it contradicts itself. | Update the background to the closed-deal state: replace the closure actions with a closed summary or "Open project board", and hide or disable "Mark not proceeding…" on a closed deal. |

**Recheck result:** all 4 rechecked items are verified fixed (N44-1, N44-2, M-6, M-9), and there are 2 new must-fix items (N44-3, N44-4). Nothing is approved.
