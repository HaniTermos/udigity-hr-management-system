# Phase 6 — Intended interactions (for Phase 7 prototype wiring)

Each agent appends its own section. These are annotations only: no prototype links are made in Phase 6.

## Shared (Auth, attendance, profile, cross-cutting states)

### Sign-in and Owner 2FA
- **SCR-AUTH-001.** Enter or Sign in submits. The button changes to Loading ("Signing in…").
  - Data Entry, Call Center and Developer users land on My Day (SCR-SHR-001).
  - An Owner goes to SCR-AUTH-002, or to SCR-AUTH-003 if no factor is enrolled.
  - Show toggles password masking.
  - "Forgot password?" opens SCR-AUTH-004.
  - Invalid credentials show one generic banner and clear the password.
- **SCR-AUTH-002.** Verify leads to the Owner dashboard (SCR-OWN-001).
  - "Lost your second factor?" opens SCR-AUTH-003 recovery.
  - Sign out returns to SCR-AUTH-001.
  - Too many wrong codes end the session (the threshold is an implementation decision).
  - R-11 readings: none selected.
- **SCR-AUTH-003.**
  - Enrollment: Confirm code → Save recovery codes → Finish setup → dashboard.
  - Recovery: success re-enters enrollment and signs out other sessions; failure ends the session (OQ-12).
- **SCR-AUTH-004.** Request link shows a neutral "queued" message. The emailed link opens Set new password, then Success, then Login. An expired or used link offers "Request a new link".

### Attendance
- **SCR-SHR-001.**
  - Check in opens SCR-SHR-002; Check out opens SCR-SHR-003. The top-bar attendance chip does the same.
  - Work items open the business, follow-up or task for the role. "Open queue" opens SCR-CC-001.
  - The work list never requires check-in (A1).
  - An open session from an earlier day disables Check in and shows the DEC-011 route.
- **SCR-SHR-002.**
  - The flow opens in Verifying.
  - It then shows one of three results: Success with derived punctuality; Verification failure, with Retry check and "Request remote exception" only if DEC-010 allows it; or Open-session block, which links to SCR-SHR-004.
  - Success closes to My Day and the chip updates.
- **SCR-SHR-003.**
  - Check out runs the office check, then Closed.
  - After a failed check, Retry check is offered. Pressing Check out follows the chosen DEC-026 alternative (none selected). The button is never pre-disabled, and the session is never closed or blocked silently.
  - Cancel returns to My Day.
- **SCR-SHR-004.** Period chips filter the list. View opens the session detail. "Request correction" opens SCR-SHR-005 (DEC-011 Alt B only).
- **SCR-SHR-005.**
  - Submit validates the times (check-out after check-in, no overlap, not in the future). The request becomes Pending, and the Owner is notified.
  - Withdraw is available while the request is pending.
  - The approved or rejected outcome arrives as a notification and appears on SCR-SHR-004.
  - The original record is always kept.

### Profile
- **SCR-SHR-006.**
  - Save shows the Toast "Profile saved". A conflict shows the banner, and Review changes opens SCR-SHR-014.
  - Change password signs out other sessions (Proposed).
  - The theme radio applies immediately and is stored per user.
  - Sign out returns to SCR-AUTH-001.

### Cross-cutting
- **SCR-SHR-007.** The bell opens the list. Opening an item marks it read and re-checks access (WF-ACCESS-001); if access is gone, SCR-SHR-012 (stale link) opens. "Mark all as read" clears the dot.
- **SCR-SHR-011.** Go to My Day or Back. An Owner without 2FA gets "Continue to 2FA", which opens SCR-AUTH-002.
- **SCR-SHR-012.** Back returns to the list or to notifications. No record data is ever shown.
- **SCR-SHR-013.**
  - Any request after expiry or revocation shows this page, or the dialog if the user is mid-edit.
  - Sign in again opens SCR-AUTH-001 with the return notice.
  - A deactivated account gets "Back to sign in" only.
- **SCR-SHR-014.** The conflict appears on save when the version has changed. "Re-apply my edits" puts the user's edits on top of the latest version and they review again. "Reload latest" confirms, then discards the user's edits. Nothing is overwritten silently.
- **SCR-SHR-015.**
  - Try again retries in place.
  - Toasts auto-dismiss, except Error toasts.
  - Offline disables Save (the label states why) until the connection returns.
  - Validation summary links jump to their fields.
- **Mobile.** All tap targets are at least 44 px (Large buttons). Check-in, checkout and correction are full-screen focused flows with a sticky footer.

## Developer (page 44 — SCR-DEV-001..008)

These are annotations only; nothing is wired in Phase 6. Pending policies stay pending. No interaction below selects an alternative.

### P7 — "Record delivered" open-task warning (SCR-DEV-006). Verify in Phase 7.
Frame: `SCR-DEV-006 — Project board — Desktop — Light — Record delivered: open-task warning`.

**Trigger**
- The user is a Developer or the Owner, on the project board.
- They click **Record delivered** in the "Move project to" row.
- The project is **In progress**. Record delivered is offered only from In progress (SM-PROJECT-001). A project that is Waiting for client or Blocked must resume first.
- At least one task is not Done and not Cancelled.

If there are no open tasks, no dialog appears. The status changes to Delivered and a toast confirms it.

**Dialog copy**
- Title: "Record delivered with open tasks?"
- Description: "Glow Beauty Salon — Booking website · PRJ-0014"
- Inline warning: "3 tasks are not Done or Cancelled. Recording Delivered changes the project status only — the tasks stay as they are."
- A list of the open tasks, each with its own task status and chips:
  - Content upload · To do · Client dependency
  - Payment page · To do · DEC-018
  - Booking flow · In progress
- "Project status: In progress → Delivered"
- Caption: "Warning only: you can still record Delivered (OQ-10, Proposed). Completed is recorded later, from Delivered."
- A DEC-019 "statuses proposed" chip.

**Options**

| Option | Result |
|---|---|
| **Record delivered** (primary) | The project status becomes Delivered and `project.status_changed` is audited. The dialog closes. Toast: "Project delivered · 3 tasks still open". |
| **Review open tasks** (link) | The dialog closes with no change. The board is filtered to open tasks. |
| **Cancel** / close (×) | The dialog closes. Nothing changes. |

**What changes:** only the project status and its status history.

**What does not change:**
- Task statuses, owners and dates.
- Kanban columns.
- The deal record and its closure.

It is a warning, not a block (OQ-10 "warn, do not block", Proposed).

**Record completed** (from Delivered) uses the same pattern with the title "Record completed with open tasks?". After Completed, the board is read-only.

**Phase 7 checks**
1. With open tasks, the dialog appears.
2. With no open tasks, the dialog does not appear.
3. Cancel leaves the status at In progress.
4. Confirm changes only the project status. Every task keeps its column.

### SCR-DEV-001 Deals
- A row or "Open" opens SCR-DEV-002.
- Tabs:
  - **Closed deals:** company-wide eligible closed deals only.
  - **Accepted opportunities:** exists only under DEC-005 Alt 1 and lists only records assigned to the user. Under Alt 2 the tab is absent.
- Filters: stage, developer, date and project status, plus the "Assigned to me" chip (a derived condition).
- Rows the user cannot access are omitted and not counted.
- **Owner view:** the "Needs attention" filter shows two kinds of record:
  - "Developer not yet assigned" (E3).
  - "Closure verification requested" (only under DEC-006 Alt B).
- **Owner actions:** "Assign developer…" opens the Call Center / Owner assignment flow (SCR-CC-007). "Review" opens SCR-DEV-002 in the Owner view.
- **Load error:** "Try again" reloads.
- **Empty:** no action.

### SCR-DEV-002 Deal record detail
- **Record facts:** "Record signature…" and "Record payment…" each open a small form with a date and a reference.
  - Pre-closure, under DEC-005 Alt 1 only. Under R-12 this remains a user decision.
  - Saving advances the stage: Accepted → Signed or Paid → Signed and paid. Either order works (Proposed).
- **Closure:** only one of these will ship, depending on DEC-006.
  - "Finalize closure…" (Alt A) opens SCR-DEV-008 Confirm.
  - "Request closure verification" (Alt B) opens SCR-DEV-008 Request.
- **Owner view (Alt B):**
  - "Verify & finalize closure" closes the deal, then provisioning runs per F2.
  - "Reject with reason…" requires a reason. The Developer then sees the rejected banner, and the stage stays Signed and paid.
  - "Remove recorded fact…" opens a dialog: choose the fact and give a required reason. The stage reverts; history and audit are kept.
- "Mark not proceeding…" requires a reason (Proposed).
- Meetings "Schedule" opens SCR-DEV-004. For Developers this exists only under DEC-005 Alt 1.
- **Save conflict:** a banner appears and nothing is overwritten. "Review changes" opens the SCR-SHR-014 comparison.
- **Hidden by policy:** generic, with no data. "Back to deals".
- **Request correction** (Business context head; also the SCR-DEV-004 reschedule drawer and the SCR-DEV-006 Deal context rail / mobile): opens the shared data-correction drawer SCR-SHR-009 (page 42, not built yet — DE-2) prefilled with the business. The Developer never edits master data.
- **Save conflict (as drawn):** the page shows the reloaded record — payment removed, stage Signed, closure actions disabled, "Record payment…" offered.

### SCR-DEV-003 Meetings & calendar
- Week / List segmented control.
- Previous and next week; Today.
- The "My meetings" filter is on by default.
- An event or row opens SCR-DEV-004 in the right mode:
  - **Reschedule…** for Scheduled or Missed meetings.
  - **Record outcome…** for Scheduled meetings whose start time has passed (derived "Awaiting outcome").
  - **View notes** for Held meetings.
  - No actions for Cancelled meetings.
- "Schedule meeting" is shown to Developers only under DEC-005 Alt 1.
- The reminder-failed banner is informational; the meeting is unchanged.
- Mobile: agenda rows open the full-screen meeting sheet.

### SCR-DEV-004 Meeting drawer
- **Reschedule:**
  - Save checks two things: the time is not in the past, and there is at least one attendee. Errors show an error summary and field messages.
  - On success the drawer closes, a toast says "Meeting rescheduled", and the event moves.
  - The previous values go to history. Rescheduling is an event, not a state (R-13).
  - Pending reminders are superseded.
- **Record outcome:** choose Held or Missed (Missed is a Proposed state).
  - **Held:** discovery notes attach to the deal.
  - **Missed:** the meeting shows that it needs rearranging.
  - Toast: "Outcome saved".
- **Cancel meeting:** requires a reason and uses a destructive confirm. Reminders are cancelled and the meeting is not reopenable.
- **Close** discards unsaved input.
- **Mobile:** a full-screen sheet with Back and a sticky primary button.

### SCR-DEV-005 Projects
- A row or "Open board" opens SCR-DEV-006.
- Filters: status, developer, Assigned to me (derived), Delivery overdue (derived).
- The info banner about a deal without a project links to that deal (SCR-DEV-002).

### SCR-DEV-006 Project board
- **Project status:** only the allowed next statuses are offered. Invalid transitions are never shown.
  - "Waiting for client…" opens a small dialog with a required note.
  - "Blocked…" opens a small dialog with a required reason.
  - "Back to Scheduled" applies directly.
  - "Record delivered" follows P7 above.
  - Completed: everything is disabled (read-only). Reopening is an open question (OQ-15).
- **Cards:**
  - Clicking a card opens SCR-DEV-007.
  - Dragging a card changes the task status only.
  - Dropping a card on Cancelled asks for a reason.
  - Done → In progress is Reopen.
  - "+n more" expands a column.
- **Edit schedule:** opens a schedule drawer. Dates are validated and history is kept. This drawer is not drawn; Phase 7 may reuse the SCR-DEV-007 drawer pattern.
- "Open deal DL-…" opens SCR-DEV-002.
- **Save conflict:** "Reload project".
- **Mobile:** "Change status" opens the same allowed-next list as a sheet. Cards open the mobile SCR-DEV-007.

### SCR-DEV-007 Task drawer
- **Save checks:** Cancelled needs a reason, and the due date must be on or after the start date.
- **On success:** the drawer closes, the card updates, and a toast says "Task saved … Project status unchanged".
- **"Cancel task…":** sets the task to Cancelled; a reason is required.
- **"Mark dependency resolved":** clears the derived Client dependency chip. The task status does not change.
- **Save conflict:** "Reload task" or "Discard my changes". Nothing is overwritten.

### SCR-DEV-008 Finalize closure dialog
- **Confirm (Alt A):** the deal closes, then provisioning runs per F2. The success state depends on F2:
  - **Automatic:** a "pending" chip; "Open project board" stays disabled until the board exists.
  - **Manual:** "Create project board".
- **Request (Alt B):** "Send for verification" creates an Owner review item.
- **Not allowed:** only "Back to deal".
- **F3:** the closure is kept. "Back to deal". The Owner retries from SCR-OWN-012.

## Call Center (page 43 — SCR-CC-001..008)

| From | Trigger | Result |
|---|---|---|
| SCR-CC-001 queue row | Click | SCR-CC-002 Contact workspace (read mode) |
| SCR-CC-001 chips / tabs | Click | Filter the derived buckets (no state change) |
| SCR-CC-001 Owner view | Reassign… / Unassign / Keep as is | SCR-OWN-007 / OWN-008 flow (audited); no automatic reassignment |
| SCR-CC-002 Start Contact | Click | Free → SCR-CC-003 "Reserved by you"; held by another user → SCR-CC-005 Reserved by another agent; Rejected or not assignee → disabled |
| SCR-CC-002/003 Request correction | Click | SCR-SHR-009 drawer (page 42); no master-data editing |
| SCR-CC-003 outcome card | Select | Shows the matching branch fields (On hold / Needs another call / Rejected / Accepted); no default |
| SCR-CC-003 Save attempt | Click | Validate → all-or-nothing save → release reservation → success (mobile: SCR-CC-003 Success); failure → Save failed (reservation kept); conflict → Save conflict |
| SCR-CC-003 Save, keep reservation | Click | Attempt logged; reservation stays Active |
| SCR-CC-003 Cancel contact | Click | Warn if notes are unsaved → release; no attempt is logged |
| SCR-CC-003 Accepted · Decide later | Select | No developer stored → SCR-CC-007 shows "Developer not yet assigned" |
| Reservation timer | Idle / lease / offline / server mismatch / override | SCR-CC-005 Expiring / Expired / Network loss / Stale client / Overridden |
| SCR-CC-005 Retry · Back to queue · Start contact again | Click | Re-check acquire · SCR-CC-001 · new reservation or collision |
| SCR-CC-005 Owner Override… | Click | Dialog (reason required, destructive confirm) → holder sees "Overridden" at next sync |
| SCR-CC-004 List / Week | Toggle | List ↔ week calendar |
| SCR-CC-004 Reschedule / Schedule follow-up | Click | SCR-CC-006 drawer (mobile: full-screen sheet) |
| SCR-CC-004 Cancel | Click | Reason dialog; last open follow-up of a Needs another call business → D2 guard (marker or replacement) |
| SCR-CC-006 Save | Click | Past time → inline error; conflict → Reload; success → toast and the row moves group |
| SCR-CC-007 Assign developer | Click | Handoff notification; Schedule first meeting → SCR-DEV-004 (page 44) |
| SCR-CC-008 Reopen… (Owner) | Click | Reason dialog → Reopened (record + toast); Call Center: disabled (DEC-016 pending) |

Prototype notes:
- Rejected businesses never link into a callable bucket.
- All reservation durations are illustrative (DEC-004).
- Mobile hit areas are at least 44 px.

## Data Entry (page 42 — SCR-DE-001..007, SCR-SHR-008..010)

Frames come from `scripts/dataentry/B01…B08`; the build notes are in `screens/dataentry-spec.md`. Every policy branch stays pending.

| From | Trigger | Result |
|---|---|---|
| SCR-DE-001 search | Type (name, normalised phone, handle) | The list filters; access is checked before counting and paging |
| SCR-DE-001 filters / chips | Click | Filters combine with AND; Archived is disabled (C-01) |
| SCR-DE-001 row / Add business | Click | SCR-SHR-008 / SCR-DE-002 |
| SCR-DE-001 load error | Try again | Reload; filters are kept |
| SCR-DE-001 empty | Add business | SCR-DE-002 |
| SCR-DE-002 Save | Click | Invalid → error summary (links focus their fields); duplicate → SCR-DE-003; success → toast, then SCR-SHR-008; save failed → nothing created, retry re-runs the duplicate check |
| SCR-DE-002 Unknown / Has website | Toggle | Unknown disables the metric (never stored as 0); unticking Has website clears and hides the URL |
| SCR-DE-003 dialog | Open | Focus moves to the title |
| SCR-DE-003 dialog | Esc / close (×) / Back to form | Back to the form; all values are kept |
| SCR-DE-003 Open existing business | Click | Confirm that unsaved input will be discarded → SCR-SHR-008 |
| SCR-DE-003 hidden match | — | Existence only; no primary action, no escalation (DEC-003) |
| SCR-DE-003 name-only warning (DEC-013 branch) | Continue / Cancel | Save / nothing |
| SCR-DE-004 Save | Click | Validates; if the name or a phone changed, runs the duplicate check with this record excluded; duplicate → error banner; success → toast and history entries |
| SCR-DE-004 save conflict | Show what changed / Re-apply mine / Discard my changes | SCR-SHR-014 diff / restore the draft / reload |
| SCR-DE-004 View edit history | Click | SCR-SHR-008 Edit history tab |
| SCR-DE-006 tabs / filters | Click | Open = Submitted + In review |
| SCR-DE-006 row Open | Click | SCR-DE-005 drawer; the redacted row is not clickable and is not counted (DEC-002 row 6) |
| SCR-DE-005 outcome | Select | Starts review; the first reviewer wins |
| SCR-DE-005 Apply changes → Continue | Click | SCR-DE-004 in request context; that save resolves the request |
| SCR-DE-005 No change needed / Reject | Click | Note or reason required → the request closes, toast |
| SCR-DE-005 Release | Click | Back to Submitted |
| SCR-DE-005 resolved by someone else | — | Read-only banner; nothing is saved |
| SCR-DE-005 duplicate on apply | — | Existence-only error; the request stays In review |
| SCR-DE-007 Add / Rename | Click | Normalised unique-name check (inline error, Add disabled) / inline rename |
| SCR-DE-007 Remove… | Click | Checks usage; in-use dialog; the removal rule is pending (no DEC ID) |
| SCR-DE-007 opened by Data Entry | — | Permission denied (DEC-015) |
| SCR-SHR-008 tabs | Click | Overview / Edit history / Related (each related item re-checked) |
| SCR-SHR-008 Edit business (Data Entry, Owner) | Click | SCR-DE-004 |
| SCR-SHR-008 Flag incorrect data (Call Center, Developer, Owner) | Click | SCR-SHR-009 |
| SCR-SHR-008 direct URL or stale link | — | Hidden → SCR-SHR-012 pattern; role or scope denied → Permission denied |
| SCR-SHR-009 Submit | Click | Validates issue type + description → toast; the Correction requested count increases; an open-request warning never blocks |
| SCR-SHR-009 mobile sheet | Cancel | Closes the sheet; nothing saved |
| SCR-SHR-010 top-bar search | Enter | Results page; chips narrow by match type |
| SCR-SHR-010 Open | Click | SCR-SHR-008 (access re-checked) |
| SCR-SHR-010 no match | — | Empty state with no hint of hidden matches (DEC-003) |

Phase 7 checks:
- No hidden business name or count appears in any list, search result or dialog.
- The duplicate dialog has no bypass control for any role.
- Every mobile tap target is at least 44 px. Open item: the DS header Back and drawer Close buttons are 40 px (CR-DE-1).

## Owner/Admin (page 41, SCR-OWN-001..012)

- **SCR-OWN-001 Dashboard.**
  - **Filters.** Today / 7 days / 30 days / Custom, the date range, Compare, Role and Employee update the period widgets. Snapshot tiles ignore the period (Accepted B-1, Development workload, Businesses · now, Attendance today).
  - **Card actions.** Each card's action link opens its screen: Attendance → OWN-004, Calling → OWN-009 (report), Delivery monitor → OWN-012, Businesses → DE-001, Deals & meetings → DEV-001, Targets & work lists → OWN-006.
  - **Exceptions.** Review opens the OWN-004 exception detail. Send again (reminders) creates a new reminder. View opens OWN-012.
  - **Export.** Opens OWN-009 with the current filters.
  - **States.** A widget that fails shows Retry and re-queries only itself.
- **SCR-OWN-002 Employees.**
  - Row click or ⋯ › Edit opens the OWN-003 drawer. Add employee opens it in create mode.
  - The ⋯ menu has: Send reset link, Change role…, Deactivate… / Reactivate (Proposed). These are disabled for your own row and for the last active Owner (Proposed).
  - Clear filters resets search and selects.
- **SCR-OWN-003 Employee drawer.**
  - **Save.** Validates the fields, then shows a toast and closes the drawer. A duplicate email shows an inline error and the drawer stays open. A conflict shows Review changes, which reloads.
  - **Change role… / Deactivate….** Each opens its confirm dialog. Confirm revokes sessions and returns to the list with the employee flagged.
  - **Send reset link.** Shows a "Reset link queued" toast; it never says "sent".
- **SCR-OWN-004 Attendance monitoring.**
  - The date and employee filters update the table and tiles.
  - Review / a row opens the Exception detail drawer. Its "Correct session" opens OWN-005 with the session preselected.
  - "View" or the banner action opens OWN-012 filtered to the alert. "Open settings" opens OWN-011.
  - Mobile: list rows open the same detail as a full-screen sheet. The Alerts tab opens SHR-007.
- **SCR-OWN-005 Corrections & review.**
  - Selecting a queue item loads its detail.
  - The detail's action area follows DEC-011:
    - Alt A: the Owner enters corrected times and a reason, then Save.
    - Alt B: Approve and apply, or Reject… (reason required).
    - Prototype both readings as separate flows; neither is the default.
  - Validation runs on Save (after check-in, no overlap, not in the future). A conflict offers Review latest. Success shows a toast and the item leaves the queue.
- **SCR-OWN-006 Targets & work lists.**
  - Set target opens the target form. Selecting a table row loads that employee's work list.
  - The method radios (Target only / Manual / Automatic proposal) switch the panel.
  - "+ n more / excluded (reasons)" expands the list. Adjust opens item selection.
  - Hand off sends Call Center items to OWN-007 (WF-CALL-001), with the items preselected.
- **SCR-OWN-007 Calling assignments.**
  - Selecting checkboxes shows the bulk bar. Assign shows the result banner: assigned count plus excluded items with reasons.
  - Reassign… on an item with a reservation or open follow-ups opens OWN-008 first.
  - "Needs decision" filter: Reassign… / Unassign / Keep per row; each is audited.
  - Open agent queue opens CC-001 in Owner view. The tabs open CC-007 and CC-008.
  - A conflict banner offers Reload list.
- **SCR-OWN-008 Reassignment impact.**
  - Reassign is enabled only after the reservation choice and every follow-up choice are made.
  - Wait closes the dialog and saves nothing.
  - With Override chosen, Reassign… opens Override confirm (reason). That then saves, closes and shows the success toast.
  - A conflict offers Review again, which reloads the impact.
- **SCR-OWN-009 Reports & exports.**
  - Report list items switch the report. Filters update the totals and the preview.
  - Export: the button shows a Loading state ("Preparing download…") and an inline info banner, then the browser download starts and a success toast appears.
  - On failure the error banner appears in place, with Try again. With no data, Export is disabled.
  - A non-Owner hitting the route sees the permission-denied page; "Go to My Day" opens SHR-001.
- **SCR-OWN-010 Audit log.**
  - Filters re-query.
  - A row opens the read-only detail drawer. It has a Close action only; there is no edit, delete or hide anywhere.
  - Export is shown only if OQ-18 is adopted.
- **SCR-OWN-011 Settings.**
  - Tabs switch between groups.
  - Test office check shows the inline result without saving.
  - Save validates, then shows a toast (applies to future sessions, Proposed). Invalid values show an error summary plus inline field errors. A conflict offers Review latest. Discard reverts.
- **SCR-OWN-012 Delivery monitor.**
  - Filter chips and Status filter the list.
  - A row opens the detail drawer.
  - Send again (reminders only) creates a new reminder; the old row stays Failed.
  - View (notifications) opens the detail. Retrying rows have no action.
  - Provisioning rows (F3) would offer Retry ›, linking to DEV-002.
