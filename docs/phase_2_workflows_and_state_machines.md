# Phase 2 — Business Workflows and State Machines

Status: **Phase 2 APPROVED by the user on 2026-10-20 as the workflow and state-model baseline.** No unresolved business-policy alternative is selected; they stay pending. Where the diagram generator could not draw a transition, the transition tables are authoritative.
Board 02: [Udigity Management System — Workflows & State Machines](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP), fileKey `lwmKQNJI42na8B3SSNLQJP`. It sits in **aap047's team** (`team::1679758308922956723`). The user chose this destination; it is not the company workspace.
Baseline limitation: **Phase 1 approval is not established** (no explicit approval message exists). This inventory is prepared against the accessible Phase 1 material; the baseline is **not locked**.

## 1. Sources

| Ref | Source | Tier | Access | Use in Phase 2 |
|---|---|---|---|---|
| ART-01 | [product-description.md](product-description.md) | 1 (user requirements) | Accessible | Primary rules source |
| ART-04 | FigJam Board 01, fileKey `Ml01oLIuAs3MTzxQ7PW1L0` | 3 (representation; no approval marker) | Accessible | UC IDs, actors, lifecycle flow, DEC titles |
| ART-05 | DEC-001…026 (Board 01 `28:534`) | 3 | Titles for all 26; alternatives for DEC-001/002/005 only | Decision dependencies |
| ART-06 | Permission summary (Board 01 `27:470`) | 3 | Summary only | Authorization checks |
| ART-11 | [decisions.md](decisions.md) D1–D20 | 4 (unapproved AI proposals) | Accessible | Shown only as labelled proposals, never as rules |
| — | Phase 2 prompt (2026-10-20), §4 "Confirmed business rules" | 1 | Accessible | Confirmed rules |

**Missing (not found here; existence unknown):**
- ART-02 Phase 0 requirements baseline. Workflows map to REQ **ranges** only (e.g. `REQ-ATT-001..012`) until it is supplied.
- ART-03 Phase 1 Use Cases Specification v1.1.0. Workflows use the UC titles from Board 01; preconditions and alternate paths are derived from ART-01.
- ART-07 Screen inventory (`SCR-*`). No screen IDs are assigned in Phase 2.
- Full DEC register text and full permission matrix.

All listed workflows can be drafted from ART-01 plus the confirmed rules. Where ART-03 might hold more detail, the workflow is marked "UC detail pending ART-03".

## 2. Workflow inventory (proposed)

IDs from the Phase 2 prompt are kept. **New** marks additions proposed to close coverage gaps.

| ID | Workflow | Board section | UC coverage (Board 01) | REQ range | DEC dependencies |
|---|---|---|---|---|---|
| WF-AUTH-001 | Login, Owner 2FA, logout, session expiry | 01 | UC-AUTH-001, 002, 008 | REQ-AUTH-001..009 | — |
| **WF-AUTH-002 (new)** | Password reset (self-service + Owner-triggered assistance); Owner 2FA enrollment & recovery | 01 | UC-AUTH-003 (003A/003B), 004 | REQ-AUTH-001..009 | — (2FA method marked an implementation decision per ART-01 §3) |
| WF-EMP-001 | Employee create, edit, role change, deactivation; self-profile update as an alternate path | 01 | UC-AUTH-005, 006, 007 | REQ-AUTH-001..009 | None; effect on assignments shown as an Owner decision point, no automatic rule invented |
| WF-ATT-001 | Check-in, open-session block, office verification, late classification | 02 | UC-ATT-001, 003 | REQ-ATT-001..012 | DEC-007, 008, 009, 010, 022 |
| WF-ATT-002 | Checkout and work summary; failed-verification alternatives | 02 | UC-ATT-002, 003 | REQ-ATT-001..012 | DEC-009, 012, 026 |
| WF-ATT-003 | Forgotten checkout and attendance correction (Owner-only vs employee-request) | 02 | UC-ATT-004, 005 | REQ-ATT-001..012 | DEC-011, 026 |
| **WF-ADMIN-001 (new)** | Configure schedule, timezone, grace, working days, office IP/geofence | 02 | UC-REP-005 | REQ-ATT-001..012 | DEC-007, 008, 009, 022 |
| WF-WORK-001 | Target assignment; manual/automatic work-list generation; insufficient work; reassignment | 03 | UC-ATT-006, 007 | REQ-ATT-001..012 (range unconfirmed) | DEC-020, 021, 025 |
| WF-BIZ-001 | Business creation, validation, duplicate block (active + hidden), save | 04 | UC-BIZ-001, 002, 003 | REQ-BIZ-001..009, REQ-SEC-DUP-001..007 | DEC-003, 013, 014, 023, 024 |
| WF-BIZ-002 | Business edit, self-exclusion, concurrent-edit conflict, duplicate revalidation; data-correction request submit / resolve / reject | 04 | UC-BIZ-004, 005, 006 | REQ-BIZ-001..009, REQ-SEC-DUP-001..007 | DEC-013 |
| **WF-BIZ-003 (new)** | Category management | 04 | UC-BIZ-007 | REQ-BIZ-001..009 | DEC-015 |
| WF-ACCESS-001 | Business access: role, assignment, 15-day visibility; search/detail/edit history; related calendar/task/project context; hidden duplicates | 05 | UC-BIZ-008, UC-PROJ-001 (visibility part) | REQ-SEC-VIS-001..006 | DEC-001, 002, 003, 005 |
| WF-CALL-001 | Queue assignment and reassignment; effect on follow-ups and active reservation | 06 | UC-CALL-001, 008 | REQ-CALL-001..011 | DEC-021, 004 |
| WF-CALL-002 | Start Contact and reservation: acquire, collision, renew, release, expire, override, network loss, stale client | 06 | UC-CALL-002, 010 | REQ-CALL-001..011 | DEC-004 |
| WF-CALL-003 | Record call attempt and finalize outcome (all 4 outcomes) | 06 | UC-CALL-003, 005, 007 | REQ-CALL-001..011 | DEC-004, 005 |
| WF-FOLLOW-001 | Callback create, reschedule, complete, cancel; return to queue | 07 | UC-CALL-004, 009 | REQ-CALL-001..011 | Notification timing (no DEC ID; see §6) |
| WF-NOTIFY-001 | Reminder and notification dispatch: schedule, deliver, fail, retry, cancel, reschedule. Covers all ART-01 §16 events, not just callbacks | 07 | None on Board 01 (gap) | None visible | Notification timing (no DEC ID) |
| WF-REJECT-001 | Do-not-call enforcement and controlled reopening | 07 | UC-CALL-005, 006 | REQ-CALL-001..011 | DEC-016 |
| WF-DEAL-001 | Accepted opportunity, developer assignment, meeting schedule/reschedule, discovery | 08 | UC-CALL-007, UC-DEAL-001, 004 | REQ-PROJ-001..008 | DEC-005, 002 |
| WF-DEAL-002 | Commercial progression, closure (accepted ≠ signed ≠ paid), project provisioning | 08 | UC-DEAL-002, 003, UC-PROJ-002 | REQ-PROJ-001..008 | DEC-006, 017, 018; commercial transitions (no DEC ID) |
| WF-PROJ-001 | Project and task delivery: assign, schedule, wait, block, resume, deliver, complete | 09 | UC-PROJ-001, 003, 004 | REQ-PROJ-001..008 | DEC-019 |
| WF-REPORT-001 | Owner dashboard, filters, comparisons, export (authorization, no data, failure, audit) | 10 | UC-REP-001, 002, 003 | REQ-REPORT-001..006 | DEC-002 (export scope) |
| **WF-REPORT-002 (new)** | Audit log explorer | 10 | UC-REP-004 | REQ-REPORT-001..006 | — |

**Proposed out of Phase 2 (needs approval):** UC-REP-006 "Execute Database Backup & Verify Recovery". This is an operational procedure, not a business workflow, so it would move to Phase 3D (deployment & recovery). It is listed here so its coverage is not lost.

## 3. State-machine inventory (proposed)

| ID | Lifecycle | Section | Notes |
|---|---|---|---|
| SM-ACCOUNT-001 | Employee account | 11 | Kept separate from sessions |
| SM-SESSION-001 | Auth session | 11 | Includes a restricted pending-2FA state for the Owner. Revocation does not deactivate the account |
| SM-ATTENDANCE-001 | Attendance session | 11 | Late/on-time is a derived classification, not a state |
| SM-CORRECTION-001 | Attendance correction request | 11 | Shown as an alternative proposal (DEC-011) |
| SM-ASSIGNMENT-001 | Calling assignment | 11 | Not part of commercial stages |
| SM-RESERVATION-001 | Contact reservation | 11 | Renewal is a self-transition |
| SM-FOLLOWUP-001 | Follow-up commitment | 11 | Due/overdue are derived from time |
| SM-REMINDER-001 | Reminder delivery | 11 | Independent of follow-up completion |
| SM-DATAFIX-001 | Data-correction request | 11 | |
| SM-COMMERCIAL-001 | Commercial lifecycle | 11 | Call outcome and assignment kept separate. See the Pending/NEW_LEAD note (artifact-register C-02) |
| **SM-MEETING-001 (new)** | Developer meeting | 11 | New: scheduled / rescheduled / held / cancelled each change what is allowed next (ART-01 §11) |
| SM-PROJECT-001 | Project delivery | 11 | Statuses proposed (DEC-019); not linear |
| SM-TASK-001 | Project task | 11 | Distinct from project |
| SM-VISIBILITY-001 | Access evaluation (per user, per resource) | 11 | An evaluation model, not a stored flag. Timer basis, scope and exceptions kept separate |

**Considered and not proposed:**
- Separate work-item SM: work items are references to businesses, follow-ups and tasks, which already have lifecycles. Progress is derived.
- Export-job SM: depends on whether exports run asynchronously, which is a Phase 3 choice.

## 4. Coverage matrix: Board 01 use cases → workflows

| UC | WF | UC | WF |
|---|---|---|---|
| UC-AUTH-001 | WF-AUTH-001 | UC-BIZ-005 | WF-BIZ-002 |
| UC-AUTH-002 | WF-AUTH-001 | UC-BIZ-006 | WF-BIZ-002 |
| UC-AUTH-003 (A/B) | WF-AUTH-002 | UC-BIZ-007 | WF-BIZ-003 |
| UC-AUTH-004 | WF-AUTH-002 | UC-BIZ-008 | WF-ACCESS-001 |
| UC-AUTH-005 | WF-EMP-001 | UC-CALL-001 | WF-CALL-001 |
| UC-AUTH-006 | WF-EMP-001 | UC-CALL-002 | WF-CALL-002 |
| UC-AUTH-007 | WF-EMP-001 (alt path) | UC-CALL-003 | WF-CALL-003 |
| UC-AUTH-008 | WF-AUTH-001 | UC-CALL-004 | WF-FOLLOW-001 |
| UC-ATT-001 | WF-ATT-001 | UC-CALL-005 | WF-CALL-003, WF-REJECT-001 |
| UC-ATT-002 | WF-ATT-002 | UC-CALL-006 | WF-REJECT-001 |
| UC-ATT-003 | WF-ATT-001/002 | UC-CALL-007 | WF-CALL-003, WF-DEAL-001 |
| UC-ATT-004 | WF-ATT-003 | UC-CALL-008 | WF-CALL-001 |
| UC-ATT-005 | WF-ATT-003 | UC-CALL-009 | WF-FOLLOW-001 |
| UC-ATT-006 | WF-WORK-001 | UC-CALL-010 | WF-CALL-002 |
| UC-ATT-007 | WF-WORK-001 | UC-DEAL-001 | WF-DEAL-001 |
| UC-BIZ-001 | WF-BIZ-001 | UC-DEAL-002 | WF-DEAL-002 |
| UC-BIZ-002 | WF-BIZ-001 | UC-DEAL-003 | WF-DEAL-002 |
| UC-BIZ-003 | WF-BIZ-001, WF-ACCESS-001 | UC-DEAL-004 | WF-DEAL-001 |
| UC-BIZ-004 | WF-BIZ-002 | UC-PROJ-001 | WF-PROJ-001, WF-ACCESS-001 |
| UC-PROJ-002 | WF-DEAL-002 | UC-REP-001/002/003 | WF-REPORT-001 |
| UC-PROJ-003 | WF-PROJ-001 | UC-REP-004 | WF-REPORT-002 |
| UC-PROJ-004 | WF-PROJ-001 | UC-REP-005 | WF-ADMIN-001 |
| UC-REP-006 | Proposed → Phase 3D | — | — |

All 48 Board 01 UCs (counting 003A/003B as one) are covered, with UC-REP-006 subject to approval.

**ART-01 requirements with no Board 01 UC:**
- Notifications (§16) → WF-NOTIFY-001
- Owner missing-check-in/checkout alerts (§4, §16) → WF-ATT-003 + WF-NOTIFY-001

## 5. Tooling and destination

- **Connected Figma account:** `aap047@mhs.uwks.ac.id`; only plan: "aap047's team" (`team::1679758308922956723`, student). This is **not** the intended company workspace.
- **Board 02 existence:** can't be checked. The connector has no file-listing or search operation.
- **Create:**
  - `create_new_file` can only target a plan the connected account belongs to, which is aap047's team only.
  - `generate_diagram` (Mermaid flowchart/stateDiagram) and `use_figma` (FigJam Plugin API: sections, shapes, connectors, text, tables) can write into an **existing** board given its fileKey and editor access.
- **Read back / inspect:** `get_figjam` (structure and text) and `get_screenshot` (rendered image).
- **Known limits:**
  - Mermaid output has automatic layout. There are no true swimlanes; subgraphs approximate them.
  - Diagram placement must be arranged afterwards with `use_figma`.
  - FigJam table creation is to be confirmed in Batch 1.

## 6. Open decisions referenced (no new DEC IDs assigned)
DEC-001 … DEC-026 as titled on Board 01. Questions with no DEC ID are referenced by artifact-register conflict IDs:
- Deletion vs archiving (C-01)
- Pending vs NEW_LEAD (C-02)
- Notification timing/recipients
- Recovery objectives
- Commercial-stage transitions

---

# Batch 1 — Attendance and Daily Work (approved baseline)

## 7. Batch 1 artifact index

Node links use `https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=<id with - instead of :>`.

| Artifact | Board section | Node ID | Link | Version |
|---|---|---|---|---|
| 00 — Index, Legend, Sources & Open Decisions | — | `12:737` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=12-737) | current |
| 02 — Attendance | — | `12:741` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=12-741) | current |
| WF-ATT-001 | 02 | `11:721` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=11-721) | v1 (role clusters) |
| WF-ATT-002 | 02 | `21:1151` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=21-1151) | v3 (v1 and v2 deleted) |
| WF-ATT-003 Part 1 | 02 | `25:1355` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=25-1355) | v2 (v1 deleted) |
| WF-ATT-003 Part 2 | 02 | `11:724` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=11-724) | v1 |
| WF-ADMIN-001 | 02 | `27:1421` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=27-1421) | v2 (v1 deleted) |
| 03 — Targets & Work Allocation | — | `12:743` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=12-743) | current |
| WF-WORK-001 | 03 | `23:1283` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=23-1283) | v3 (v1 and v2 deleted) |
| 11 — State Machines | — | `12:745` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=12-745) | current |
| SM-ATTENDANCE-001 diagram | 11 | `11:727` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=11-727) | v1 |
| SM-ATTENDANCE-001 transition table | 11 | `13:721` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=13-721) | v1 |
| SM-ATTENDANCE-001 derived classifications | 11 | `13:902` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=13-902) | v1 |
| SM-CORRECTION-001 diagram | 11 | `11:728` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=11-728) | v1 |
| SM-CORRECTION-001 transition table | 11 | `13:951` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=13-951) | v1 |
| 12 — Coverage & Review Findings | — | `12:739` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=12-739) | current |

Superseded versions were **deleted** from the board, not kept beside the current ones, so the board has exactly one version of each diagram. They were removed because v1 used role clusters that routed unreadably, and v2 connectors broke during a move. Board sections 01 and 04–10 don't exist yet; they will be created in later batches.

## 8. Notation (all Batch 1 diagrams)

| Marker | Meaning |
|---|---|
| Yellow fill + "(DEC-xxx)" | Depends on an Unresolved or Proposed policy; the label says which |
| Orange fill / "Alt A/B/C" | Unselected policy alternative |
| Red | Failure, rejection or error |
| Green | Successful end state |
| Blue + "(derived)" | Derived classification, not a stored state |
| Dotted arrow | Retry loop or side effect |
| Double-bordered box | Hand-off to another workflow |
| Grouping box | WF-ATT-001: role cluster. Other diagrams: flow phase, with the actor named in each step |

## 9. Workflow specifications

### WF-ATT-001 — Check-in and late-arrival classification
- **Purpose:** Start an attendance session from the office and derive punctuality.
- **REQ:** REQ-ATT-001..012 (range only; ART-02 unavailable). **UC:** UC-ATT-001, UC-ATT-003.
- **Actors:** Employee (any role, including the Owner; see F-04), System.
- **Trigger:** Employee selects Check In.
- **Preconditions:** Authenticated session. Owner admin access requires completed 2FA (Confirmed); check-in is an employee action.
- **Main path:**
  1. System confirms authenticated and active.
  2. Confirms no open session.
  3. Evaluates the office check (mode per DEC-009).
  4. Records the check-in time and opens the session.
  5. Derives punctuality.
  6. Audits.
  7. Shows the active panel (timer, 9 h progress, work list).
- **Alternate paths:**
  - Office check fails but a remote exception applies (DEC-010): session is recorded as remote.
  - Schedule not configured: punctuality "Unclassified".
  - Not a scheduled working day (DEC-022): "Non-working day".
- **Errors and recovery:**
  - Not authenticated or inactive: redirected; nothing recorded.
  - Open session exists: blocked; resolve via WF-ATT-003.
  - Office check fails with no exception: rejected; the failed attempt is audited (Proposed).
- **Authorization:** Active account; the employee acts only on their own attendance.
- **Visibility/assignment:** n/a.
- **Data changes:** New attendance session (Open) with check-in time, verification result and remote flag. Punctuality is derived.
- **Audit:** `attendance.checked_in`; failed attempt (Proposed).
- **Notifications:** None required (F-09).
- **Postconditions:** Exactly one Open session for the employee.
- **Decision dependencies:** DEC-007, DEC-008, DEC-009, DEC-010, DEC-022.

### WF-ATT-002 — Checkout and work summary
- **REQ:** REQ-ATT-001..012 (range). **UC:** UC-ATT-002, UC-ATT-003.
- **Actors:** Employee, System.
- **Trigger:** Employee selects Check Out.
- **Preconditions:** Authenticated, active, and has an Open session.
- **Main path:**
  1. Access checks.
  2. Office check passes.
  3. Summary rule applied (DEC-012: mandatory or optional; unselected).
  4. Record checkout, compute duration, close the session.
  5. Derive duration vs 9 h.
  6. Audit and show the completed-day summary.
- **Alternate paths:** Remote exception (DEC-010) continues to the summary step.
- **Errors and recovery:**
  - No open session: notice only.
  - Invalid summary: corrected in a loop.
  - Save failed: session stays Open; retry.
  - Office check fails with no exception: DEC-026 alternatives, none selected:
    - Alt A: blocked.
    - Alt B: closed provisionally, with an Owner review item.
    - Alt C: held for Owner review.
- **Authorization:** Session owner only.
- **Data changes:** Session → Closed / Closed provisionally / Pending review; summary stored.
- **Audit (proposed names):** `attendance.checked_out`, `attendance.checkout_failed`, `attendance.checkout_provisional`, `attendance.checkout_pending_review`.
- **Notifications:** An Owner review item under Alt B/C. The channel depends on the notification decision (no DEC ID).
- **Postconditions:** The session is never closed or blocked silently. Every failure path ends visibly.
- **Decision dependencies:** DEC-009, DEC-010, DEC-012, DEC-026. Open gap F-02.

### WF-ATT-003 — Forgotten checkout, exceptions and correction
**Part 1 (exception detection).**
- **Actors:** System scheduler, Notification processing, Owner.
- **Trigger:** Scheduled check. Timing is unresolved.
- **Flow:** Only on the employee's scheduled working day (DEC-022), the check flags:
  - Missing check-in → notify the Owner.
  - Missing checkout → session **stays open, no automatic close**; notify (recipients unresolved).

  Both appear on the Owner dashboard and hand off to Part 2.
- **Rule kept:** Not being checked in on a non-working day is not an absence (product description §15).

**Part 2 (correction).**
- **Triggers:**
  - Check-in blocked by an open session.
  - Missing-checkout flag.
  - Pending-review checkout (DEC-026 Alt C).
  - A wrong time reported.
- **Authority (DEC-011, unselected):**
  - **Alt A, Owner-only:** the Owner enters corrected times and a reason.
  - **Alt B, employee request:** the request is validated, held pending, and the Owner is notified ("attendance correction awaiting review", a Confirmed event). The Owner approves or rejects; a rejection records the reason and the original stands.
- **Apply step:**
  1. Validate the times: checkout after check-in, no overlap with other sessions, not in the future.
  2. Save a correction record beside the original. The original is never overwritten (Confirmed).
  3. Audit `attendance.corrected`.
  4. The session is closed or adjusted, and check-in is unblocked.
- **Save failed:** nothing changes; retry.
- **UC:** UC-ATT-004, UC-ATT-005.
- **Decision dependencies:** DEC-011, DEC-026, DEC-022; alert timing and recipients (no DEC ID). Open risk F-01.

### WF-ADMIN-001 — Attendance and office-verification settings
- **UC:** UC-REP-005.
- **Actors:** Owner, System.
- **Guard:** Owner session with completed 2FA.
- **Editable values:**
  - Working days (DEC-022), shift start and timezone (DEC-007), grace (DEC-008).
  - Office IP list and/or geofence, and verification mode (DEC-009).
  - 9 h duration: Confirmed.
- **Validation:** Values are valid, and a verifier exists for the chosen mode.
- **Save:** Settings apply to future sessions (Proposed). Audited as a security setting change.
- **Errors:** Permission denied; invalid values loop back to editing; save failed keeps the previous settings.

### WF-WORK-001 — Targets and work-list generation
- **UC:** UC-ATT-006, UC-ATT-007.
- **Actors:** Owner, System, Assigned employee.
- **Flow:**
  1. Owner authorized.
  2. Select an active employee and period.
  3. Set the metric and value (DEC-020, DEC-025).
  4. Validate for the role, then save and audit.
  5. Choose the work-list method:
     - **Target only:** no work list.
     - **Manual:** each item is checked for eligibility (role, not rejected, in scope). Items assigned to someone else hand off to WF-CALL-001.
     - **Automatic:** the allocation rule is applied (DEC-021, unselected). A shortfall is shown when there isn't enough eligible work. The Owner reviews and accepts, or adjusts.
  6. Hand every Call Center assignment to WF-CALL-001, which alone creates or changes calling assignments (contract B8, housekeeping 2026-10-20). WF-CALL-001 sends the assignment notices (timing unresolved). The target itself is saved and audited here.
  7. Progress is derived (DEC-020). The employee sees target, completed, remaining and overdue.
- **Not invented:** automatic reassignment on deactivation (belongs to WF-EMP-001, Batch 4).
- **Dependency:** "In scope" depends on WF-ACCESS-001 (Batch 2).

## 10. State models

### SM-ATTENDANCE-001
- **States:** Open, Closed.
- **Alternative states (DEC-026, unselected):** Closed provisionally (Alt B), Pending review (Alt C).
- **Not states (derived):** punctuality, duration vs 9 h, missing check-in/checkout, remote flag.
- **Not a state (attribute):** "adjusted", for a corrected session.

| Current | Event | Actor | Guard | Next | Side effects | Audit (proposed) | Failure | DEC |
|---|---|---|---|---|---|---|---|---|
| (start) | Check in | Employee | Active; no open session; office check or remote exception | Open | Timer; punctuality derived | attendance.checked_in | No session; attempt audited (Proposed) | 007, 008, 009, 010, 022 |
| Open | Check out (verified) | Session owner | Office check or exception; summary rule | Closed | Duration; 9 h classification | attendance.checked_out | Stays Open | 009, 010, 012 |
| Open | Verification failed | Session owner | Alt A selected | Open | — | attendance.checkout_failed | Stays Open | 026 |
| Open | Verification failed | Session owner | Alt B selected | Closed provisionally | Owner review item | attendance.checkout_provisional | Stays Open | 026 |
| Open | Verification failed | Session owner | Alt C selected | Pending review | Attempted time stored; review item | attendance.checkout_pending_review | Stays Open | 026 |
| Open | Correction sets checkout | Owner (Alt A) / Owner approving (Alt B) | 2FA-complete Owner; valid times | Closed | Correction record; check-in unblocked | attendance.corrected | No change | 011 |
| Closed provisionally | Owner confirms or corrects | Owner | 2FA-complete; valid times | Closed | Correction record if corrected | attendance.provisional_resolved | No change | 026, 011 |
| Pending review | Owner resolves | Owner | 2FA-complete; valid times | Closed | Correction record | attendance.review_resolved | Stays | 026, 011 |
| Closed | Correction applied | Owner / approved request | Valid times | Closed (adjusted) | Original kept | attendance.corrected | No change | 011 |

### SM-CORRECTION-001 (only if DEC-011 Alt B is selected)
- **States:** Submitted, Approved, Rejected, Withdrawn (Withdrawn is Proposed).
- **Under Alt A:** there is no request lifecycle.

| Current | Event | Actor | Guard | Next | Side effects | Audit (proposed) | Failure | DEC |
|---|---|---|---|---|---|---|---|---|
| (start) | Submit | Employee | Own session; complete; one open request per session (Proposed) | Submitted | Notify Owner | attendance_correction.submitted | Not created | 011 |
| Submitted | Approve | Owner | 2FA-complete; valid times | Approved | Correction applied in the same save | attendance_correction.approved + attendance.corrected | Stays Submitted | 011 |
| Submitted | Reject | Owner | Reason recorded (Proposed) | Rejected | Employee informed (channel unresolved) | attendance_correction.rejected | Stays Submitted | 011 |
| Submitted | Withdraw | Employee | Own request | Withdrawn | — | attendance_correction.withdrawn | Stays Submitted | 011 |

## 11. Acceptance scenarios (Given / When / Then)

These describe intended behaviour. **No software exists yet, and none of this has been tested.**

**WF-ATT-001**
1. Given an active employee with no open session and a passing office check, when they check in, then one Open session is recorded with the check-in time and an audit event.
2. Given an employee with an Open session from yesterday, when they check in, then check-in is blocked and they are routed to the correction flow; no second session exists.
3. Given a failing office check and no remote exception, when they check in, then no session is created and the rejection is shown.
4. Given no schedule is configured, when they check in, then the session opens with punctuality "Unclassified" (it is not invented).
5. Given two simultaneous check-in requests from two devices, then exactly one Open session exists (confirmed rule; mechanism in Phase 3).

**WF-ATT-002**
1. Given an Open session and a passing office check, when the employee checks out with a valid summary (if required), then the session is Closed, the duration is computed and the summary is shown.
2. Given a save failure at checkout, then the session remains Open and the employee can retry.
3. Given a failing office check and no exception, then the outcome follows the selected DEC-026 alternative. No outcome is assumed while it is unselected.

**WF-ATT-003**
1. Given a scheduled working day and an Open session past the checkout threshold, when the scheduled check runs, then the session is flagged and stays Open, and an alert is raised.
2. Given a non-working day (DEC-022), when the check runs, then no missing-check-in alert is raised.
3. Given a valid correction, when it is applied, then a correction record exists beside the unchanged original, an audit event exists, and check-in is unblocked.
4. Given corrected times that overlap another session, then the correction is rejected and nothing changes.

**WF-ADMIN-001**
1. Given a non-Owner or an Owner without completed 2FA, when they open settings, then access is denied.
2. Given a verification mode with no configured verifier, then the settings can't be saved.

**WF-WORK-001**
1. Given automatic generation with fewer eligible items than needed, then a shortfall is shown and the Owner decides; nothing is fabricated.
2. Given a manually selected item already assigned to another agent, then reassignment goes through WF-CALL-001 instead of a silent takeover.

## 12. Batch 1 review findings
These match Board 02 section 12 (table `14:1343`):
- **F-01:** DEC-011 Alt B may block next-day check-in.
- **F-02:** The summary under DEC-026 Alt B/C is not defined.
- **F-03:** Punctuality after a check-in correction is not defined.
- **F-04:** Owner exemption from the office check depends on ART-02.
- **F-05:** Alert thresholds and recipients have no DEC ID.
- **F-06:** Concurrent check-in is enforced in Phase 3.
- **F-07:** Swimlane approximation and the regenerations.
- **F-08:** Audit names are proposed.
- **F-09:** No late-arrival notification is required.
- **F-10:** Batch 2 dependency for "in scope".

## 13. Batch 1 verification record
- **Created:** 8 diagrams (generated with `generate_diagram`), 3 FigJam tables, 5 board sections, and header and index text (with `use_figma`). Each call returned its node IDs; they're listed in §7.
- **Read back:** `get_figjam` on the full board. It contains 5 top-level sections, the 8 diagram sections with their sub-groups, and no loose nodes. A `use_figma` bounds check found no overlapping sections.
- **Visually inspected (`get_screenshot`):**
  - Current versions: WF-ATT-001, WF-ATT-002 v3, WF-ATT-003 Part 1 v2, WF-ATT-003 Part 2, WF-ADMIN-001 v2, WF-WORK-001 v3, section 11 (both state models and all tables), section 00, and section 12 after its F-07 edit.
  - Two later edits were not re-screenshotted: the legend row edit in section 00 and the shortened SM-CORRECTION title.
- **Defects found by inspection and fixed:**
  - Unreadable routing in four lane-based diagrams.
  - Broken connectors after a move.
  - An overlapping section after layout.
  - A clipped SM-CORRECTION title.
  - A notification-lane colour clash (that lane no longer exists after regeneration).
- **Residual cosmetics:**
  - In SM-ATTENDANCE-001, the "Owner confirms or corrects" label sits close to an edge.
  - WF-ATT-001 keeps role clusters, so it has one long return edge.
- **Not done:** no software behaviour has been tested; there is no software. Batch 1 is **not** approved.

## 14a. Batches 2–4 (multi-agent execution, 2026-10-20)
These files are linked here, not merged; the orchestrator merges content once each batch is approved.
- **Shared baseline (SB-2), contracts A–G and rulings R-01..R-13:** [phase2/shared-baseline.md](phase2/shared-baseline.md). **Task register:** [phase2/task-register.md](phase2/task-register.md).
- **Batch 2 (drawn, DRAFT):**
  - [spec](phase2/batch2/batch2-spec.md), [Mermaid](phase2/batch2/batch2-mermaid.md), [open items](phase2/batch2/open-items.md), [repair log](phase2/batch2/repair-log.md)
  - [verification and node IDs](phase2/batch2/verification.md)
  - Reviews: [spec r1](phase2/reviews/batch2-spec-review.md), [spec r2](phase2/reviews/batch2-spec-review-r2.md), [artifacts](phase2/reviews/batch2-artifact-review.md)
- **Batch 3 (drawn in 06/07, DRAFT):** [spec](phase2/batch3/batch3-spec.md), [verification](phase2/batch3/verification.md), [review](phase2/reviews/batch3-review.md).
- **Batch 4 (drawn in 01/08/09/10, DRAFT):** [spec](phase2/batch4/batch4-spec.md), [verification](phase2/batch4/verification.md), [review](phase2/reviews/batch4-review.md).
- **Final cross-batch check:** [batch5-integration.md](phase2/reviews/batch5-integration.md). Blocking issue B-1 was fixed afterwards by the orchestrator.
- **Batch 1 maintenance tracker:** [phase2/batch1-maintenance.md](phase2/batch1-maintenance.md).

## 14. Mermaid source (current versions)

WF-ATT-001 v1, WF-ATT-002 v3, WF-ATT-003 Part 1 v2, WF-ATT-003 Part 2 v1, WF-ADMIN-001 v2, WF-WORK-001 v3, SM-ATTENDANCE-001, SM-CORRECTION-001. The exact source sent to `generate_diagram` is kept in [phase_2_batch1_mermaid.md](phase_2_batch1_mermaid.md).
