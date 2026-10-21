# Phase 2 Batch 4 — Deals, Delivery and Remaining Operations (DRAFT SPECIFICATION)

Author: Agent 4. Baseline: SB-2 (`docs/phase2/shared-baseline.md`, 2026-10-20). Repaired after review `reviews/batch4-review.md` (RV4-01..06; see `repair-log.md`).
Status: **Phase 2 baseline, approved by the user on 2026-10-20.** Reviewed once and drawn on Board 02 (sections 01, 08, 09, 10). Unresolved policy alternatives stay pending. No software exists; nothing here has been tested.

## 0. Conventions used in this file

| Tag | Meaning |
|---|---|
| (Confirmed) | From a Tier 1 source (ART-01) or a Confirmed SB-1 contract / permission tag |
| (Proposed) | Agent 4 or orchestrator default. The user may change it. Never an approved rule |
| (Unresolved, DEC-xxx) | Open decision with a DEC ID. Drawn as a branch or "policy-dependent" |
| (Unresolved, no DEC ID) | Open question without a DEC ID (SB-1 §3 list or new question in `dependencies-and-open-items.md`) |
| → USER | A question SB-2 §10 reserves for the user (R-11, R-12). Both readings shown; neither selected |
| R11-a / R11-b | R-11 → USER: Owner session waiting for 2FA. **R11-a** all access waits for 2FA / **R11-b** only administrative actions wait (Batch 2 labels) |
| (Implementation decision) | ART-01 §3 / §19 leaves it to Phase 3 (2FA method, session durations, thresholds, async jobs) |
| (derived) | Derived classification, computed from stored data and time; never a stored state |
| "Access check (WF-ACCESS-001)" | The single access evaluation owned by Agent 2 (contract C5). Not redefined here |
| `[[...]]` | Hand-off to another workflow |

REQ references are **ranges only** (ART-02 unavailable). No SCR IDs. UC titles come from Board 01 via SB-1 §3. "UC detail pending ART-03" applies to every workflow below.

Audit event names follow G2 (`<entity>.<past_tense_verb>`, lower snake case; a qualifier before the verb is used where Batch 1 did the same, e.g. `attendance.checked_in`). **All names are Proposed.**

## 1. Batch-wide modelling choices (Proposed unless tagged)

1. **One commercial record per engagement ("deal record").** The accepted opportunity and the later closed deal are the same record at different commercial stages (Proposed). "Accepted opportunity" and "Closed deal" keep their SB-1 §5 meanings as stages of that record. "Deal record" is now an SB-2 §11 term (R-04).
2. **Four independent dimensions on a business are never merged:** calling outcome (Batch 3), calling assignment state (SM-ASSIGNMENT-001, Batch 3), commercial stage (SM-COMMERCIAL-001), project status (SM-PROJECT-001). Task status (SM-TASK-001) is a fifth, per task. Meeting status (SM-MEETING-001) is per meeting.
3. **The calling outcome stays "Accepted"** while the deal record progresses. Whether it changes if the deal does not proceed is Unresolved (no DEC ID; OQ-04).
4. **Developer assignment is an attribute of the deal record and of the project, not a state.** "Developer not yet assigned" is a derived condition visible to the Owner (contract E3, Proposed).
5. **No attendance gating.** No Batch 4 work action requires an open attendance session (contract A1).
6. **Visibility.** Every list, detail, calendar entry, task/project context, notification and export in this batch calls "Access check (WF-ACCESS-001)" per requesting user, per resource (C2, C5). The Owner always passes (C1). Batch 4 only states *which* resource is checked and *what happens on Denied*.
7. **Notifications** are emitted as events to `[[WF-NOTIFY-001]]` (Batch 3). Timing, recipients and escalation are Unresolved (no DEC ID). Send-time re-check of access and account status follows C6 (Proposed). A failed meeting reminder never erases or blocks the meeting (Proposed, by analogy with contract D5).
8. **Derived classifications introduced in this batch** (never states): Developer not yet assigned; Meeting not yet arranged; Meeting upcoming; Meeting awaiting outcome; Closed deal without project; Project provisioning pending; Project delivery overdue; Task overdue; Assigned to me; Account credentials not yet set.

---

## 2. Workflow specifications

### WF-DEAL-001 — Accepted opportunity, developer assignment, meetings and discovery

- **ID / Name:** WF-DEAL-001 — Accepted opportunity handoff, developer assignment, meeting scheduling/rescheduling, discovery.
- **Purpose:** Turn an Accepted calling outcome into a usable handoff for developer consultation, get a Developer assigned (now or later), arrange and track meetings, and record discovery results, without treating acceptance as closure.
- **REQ range:** REQ-PROJ-001..008 (range only). Visibility parts: REQ-SEC-VIS-001..006.
- **UC IDs:** UC-CALL-007 (shared with WF-CALL-003), UC-DEAL-001 (DEC-005), UC-DEAL-004.
- **Actors:** Call Center agent, Owner, Developer, System.
- **Trigger:** `[[WF-CALL-003]]` finalizes the calling outcome **Accepted** (UC-CALL-007). Secondary triggers: an authorized user opens an existing deal record at any non-terminal stage (Accepted opportunity, Signed, Paid, Signed and paid) to assign or reassign a Developer (RV4-05), or opens an accepted opportunity to schedule/reschedule/cancel a meeting or record discovery.
- **Preconditions:**
  - Authenticated session. Owner 2FA per R-11 (→ USER): R11-a requires completed 2FA for this non-administrative workflow; R11-b does not. Neither selected. Administrative access always requires completed 2FA (Confirmed, ART-01 §3).
  - The business exists and is not Rejected (B1, Confirmed).
  - The acting user passes Access check (WF-ACCESS-001) for the business.
- **Main path:**
  1. Call Center agent (or Owner) finalizes Accepted in WF-CALL-003.
  2. System checks whether the business already has an open deal record (Unresolved, DEC-017; see alternates).
  3. System creates the deal record at stage **Accepted opportunity** in the same save as the Accepted outcome (contract E5, R-05; event `accepted_opportunity.created` emitted by Batch 3). Acceptance creates an accepted opportunity, not a closed deal (E1, Confirmed).
  4. Call Center agent captures handoff context: client needs, service interest, link to previous call notes; business contact information is shown from the business record (Confirmed list, ART-01 §11). No field beyond the business link is mandatory (Proposed; mandatory fields need approval, by analogy with ART-01 §9.3).
  5. Call Center agent or Owner selects an active Developer and assigns them (E2, Confirmed). Assignment may be deferred (E3, Proposed) — see alternates.
  6. System records the assignment with history (Proposed), audits it and emits a "developer handoff" notification event (ART-01 §16, Confirmed event; timing Unresolved) to `[[WF-NOTIFY-001]]`.
  7. An authorized user schedules a meeting: date, time, attendees, notes (ART-01 §11, Confirmed fields). Acceptance does **not** require a finalized meeting time (Confirmed, unless the company approves otherwise).
  8. System validates (time not in the past, at least one attendee — Proposed), saves the meeting as **Scheduled**, audits, and emits an "upcoming meeting" notification event to `[[WF-NOTIFY-001]]`.
  9. After the meeting time, the Developer (or Owner) records the meeting as **Held** with discovery notes (requirements, scope, next steps).
  10. Discovery results attach to the deal record. Commercial progression continues in `[[WF-DEAL-002]]`.
- **Alternate paths:**
  - **A1 Developer assignment deferred (E3, Proposed):** the deal record is saved without a Developer; "Developer not yet assigned" (derived) shows on the Owner's overview and the deal list. Assignment later re-enters at step 5.
  - **A2 Developer reassignment (any non-terminal stage, RV4-05):** Call Center agent or Owner replaces the Developer while the deal record is at Accepted opportunity, Signed, Paid or Signed and paid (e.g. after the Developer is deactivated, WF-EMP-001 M3). Previous assignment kept in history (Proposed). Scheduled meetings are **not** silently moved: the actor is prompted to keep or update attendees (Proposed; no automatic rule).
  - **A3 Meeting not arranged at acceptance:** "Meeting not yet arranged" (derived). Scheduling can happen at any later time.
  - **A4 Reschedule:** an authorized user changes date/time/attendees/notes of a Scheduled (or Missed, Proposed) meeting. Previous values are retained (ART-01 §11 "preserve"). Notification event re-emitted; earlier pending reminders are superseded (handled in WF-NOTIFY-001).
  - **A5 Cancel:** an authorized user cancels a Scheduled meeting with a reason (reason Proposed). Pending reminders cancelled via WF-NOTIFY-001. A new meeting may be scheduled.
  - **A6 Not held / no-show (Proposed state "Missed"):** recorded after the meeting time; can be rescheduled.
  - **A7 Further discovery needed:** after a Held meeting, another meeting is scheduled (step 7).
  - **A8 Client does not proceed:** handled as the "Not proceeding" transition in `[[WF-DEAL-002]]` (Proposed).
  - **A9 Business already has an open deal record (Unresolved, DEC-017):** policy-dependent. *If multiple concurrent deals are allowed*: a new deal record is created. *If single only*: no new record; the user is shown the existing open deal record and the Accepted outcome save is blocked or linked to it (the exact behaviour is part of DEC-017). Neither branch is selected.
  - **A10 Developer pre-closure access (Unresolved, DEC-005):** *Alt 1 (assigned scoping access):* the assigned Developer passes Access check for this deal record and its business contact data and can schedule meetings and record discovery. *Alt 2 (closed-deal-only):* the Developer cannot open the accepted opportunity; meetings are scheduled and maintained by Call Center/Owner, and how the Developer receives meeting context is an open question (OQ-02). Neither alternative is selected.
- **Errors and recovery:**
  - Access check Denied (business hidden by policy, not assigned, DEC-005 Alt 2): "Record hidden by policy" / "Permission denied" state; nothing saved.
  - Selected Developer inactive or not a Developer: rejected; choose another (Proposed guard).
  - Meeting time in the past / no attendee: validation loop (Proposed).
  - Save conflict (another user changed the deal record or meeting): show "Save conflict", reload, re-apply (Proposed).
  - Save failed: nothing changes; retry. Under the atomic-save assumption (step 3), a failed opportunity creation also leaves the calling outcome unchanged (Proposed).
  - Notification/reminder failure: meeting and assignment remain saved (Proposed, D5 analogy); failure surfaced per WF-NOTIFY-001.
- **Authorization:**
  - Create deal record: whoever may finalize Accepted in WF-CALL-003 — Call Center and Owner (Confirmed, call logging).
  - Assign / reassign Developer: Call Center or Owner (Confirmed, E2). Data Entry denied (Confirmed: Data Entry cannot change commercial status; assignment of commercial work is not a Data Entry permission — Proposed reading).
  - Schedule / reschedule / cancel meetings: Call Center and Owner (Proposed); assigned Developer only under DEC-005 Alt 1.
  - Record meeting Held / Missed and discovery notes: assigned Developer (DEC-005 Alt 1) and Owner; Call Center attendee (Proposed).
- **Visibility/assignment:** Access check (WF-ACCESS-001) on the business and the deal record for every view, including meeting calendar entries and notifications (C2). Whether the accepted opportunity stays visible after 15 days is DEC-002 (accepted-opportunity row). "Assigned to me" (derived) for Developers.
- **Data changes:** New deal record (stage Accepted opportunity; links: business, accepting agent, call history; handoff fields). Developer assignment + assignment history. Meeting records (status, date/time, attendees, notes, reschedule history, cancellation reason, discovery notes).
- **Audit events (Proposed names):** consumes `accepted_opportunity.created` (emitted by Batch 3 in the WF-CALL-003 save, contract E5 / R-05; **not** re-emitted or counted again here); `opportunity.handoff_updated`, `opportunity.developer_assigned`, `opportunity.developer_reassigned`, `meeting.scheduled`, `meeting.rescheduled`, `meeting.cancelled`, `meeting.held`, `meeting.missed`.
- **Notification events:** Developer handoff (on assignment/reassignment); Upcoming meeting (on schedule/reschedule; cancellation cancels pending reminders). All via WF-NOTIFY-001; timing and recipients Unresolved (no DEC ID).
- **Postconditions:** The business's calling outcome is Accepted; exactly one deal record exists for this acceptance (subject to DEC-017); the record is at stage Accepted opportunity; it either has an assigned Developer or shows "Developer not yet assigned"; any meeting has a status and preserved history. No closed deal has been created.
- **Decision dependencies:** DEC-005, DEC-002, DEC-017; notification timing (no DEC ID); mandatory handoff fields (no DEC ID, OQ-01); developer meeting context under DEC-005 Alt 2 (OQ-02).

### WF-DEAL-002 — Commercial progression, closure and project provisioning

- **ID / Name:** WF-DEAL-002 — Commercial progression, closure (accepted ≠ signed ≠ paid), project provisioning.
- **Purpose:** Record signature and payment as distinct facts, finalize closure only when accepted + signed + paid, keep closure authority and evidence rules open, and hand the closed deal to delivery.
- **REQ range:** REQ-PROJ-001..008.
- **UC IDs:** UC-DEAL-002, UC-DEAL-003, UC-PROJ-002.
- **Actors:** Developer, Owner, Call Center agent (authority Unresolved), System.
- **Trigger:** An authorized user opens a deal record and records signature, payment, closure, or "not proceeding".
- **Preconditions:** Authenticated; Owner 2FA per R-11 (→ USER; R11-a / R11-b, neither selected); deal record exists and is not Closed or Not proceeding; actor passes Access check (WF-ACCESS-001) for the deal record (Developers subject to DEC-005).
- **Main path:**
  1. Developer (or Owner) opens the deal record; System runs Access check and the role permission check.
  2. Developer records **signature**: date and agreement reference (Proposed fields; agreement reference is listed in ART-01 §12 "depending on final scope"). **No attachment is required** (Unresolved, DEC-018).
  3. System saves; stage becomes *Signed (payment outstanding)* (Proposed stage name; no DEC ID).
  4. Developer records **payment**: date and confirmation reference (Proposed). Whether a deposit counts as payment is Unresolved (DEC-018). Money amount/currency fields are Unresolved (DEC-018) and are not required.
  5. System saves; stage becomes *Signed and paid (awaiting closure)* (Proposed).
  6. Closure authority (Unresolved, DEC-006; options taken from ART-01 §12 wording, not Board alternatives):
     - **Alt A — Developer finalizes directly:** the Developer (or Owner) selects Finalize closure.
     - **Alt B — Owner verification required:** the Developer requests verification; an Owner review item is raised; the Owner verifies and finalizes, or rejects with a reason.
  7. System checks the closure guard: accepted + signed + paid all recorded (Confirmed definition). Saves stage **Closed deal**, audits `deal.closed`.
  8. Project provisioning (Unresolved, contract F2):
     - **Alt Auto:** System creates the project board at verified closure (ART-01 §13 "design proposal").
     - **Alt Manual:** Owner or Developer creates the project board later; until then "Closed deal without project" (derived) shows on the Owner overview.
  9. Hand-off to `[[WF-PROJ-001]]`.
- **Alternate paths:**
  - **B1 Payment before signature:** payment is recorded first → *Paid (signature outstanding)*; signature later → *Signed and paid*. Order-independence is Proposed (OQ-05).
  - **B2 Not proceeding (Proposed):** Owner or Developer (Call Center from Accepted only — Unresolved) records "not proceeding" with a reason from any non-closed stage. Calling-outcome effect Unresolved (OQ-04); re-queue Unresolved (B6, DEC-017).
  - **B3 Fact recorded in error (Proposed):** Owner removes a recorded signature or payment before closure, with reason; stage reverts. Original entries stay in audit (G3).
  - **B4 Owner rejects verification (DEC-006 Alt B only):** reason recorded; stage stays *Signed and paid*; Developer corrects facts (B3 path via Owner) or re-requests.
  - **B5 Owner closes directly:** the Owner may finalize under either alternative (Owner full access, C1; Proposed reading).
  - **B6 Multiple deals per business (Unresolved, DEC-017):** progression is per deal record; whether a second concurrent record can exist is decided in WF-DEAL-001 A9.
- **Errors and recovery:**
  - Access check Denied or role not permitted (Data Entry always; Call Center pending OQ-03; Developer under DEC-005 Alt 2 before closure — **R-12 → USER (DEC-005 Alt 2 × DEC-006)**: this would contradict Board 01 "Owner and Developer [Confirmed: REQ-PROJ-004]" and make DEC-006 Alt A impossible; not settled here): "Permission denied"; nothing saved.
  - Finalize attempted without signature or payment recorded: blocked with the missing fact named.
  - Save conflict: reload and re-apply (Proposed).
  - Save failed: stage unchanged; retry.
  - Provisioning failure under Alt Auto: closure **stays committed** (the commercial fact is true independently of tooling); "Project provisioning pending" (derived) is shown to the Owner with retry (Proposed). Rationale: ART-01 §12 requires closure to be distinct from project lifecycle.
- **Authorization:** Recording closure / approval: Owner and Developer (Confirmed on Board 01 summary, REQ-PROJ-004); sign-off gate Unresolved (DEC-006). Developer recording before closure under DEC-005 Alt 2: **R-12 → USER (DEC-005 Alt 2 × DEC-006)**, not settled. Data Entry cannot change commercial status (Confirmed, ART-01 §2.2). Call Center authority over commercial stage: Unresolved (no DEC ID; ART-01 §2.3 "update permitted calling and sales information", OQ-03). Owner: always (C1).
- **Visibility/assignment:** Access check (WF-ACCESS-001) on the deal record. Closed deals are visible company-wide to Developers subject to the 15-day policy (ART-01 §2.4; DEC-002 closed-deal row). Before closure, Developer access follows DEC-005.
- **Data changes:** Deal record stage; signature fact (date, reference); payment fact (date, reference; deposit flag and money fields only if DEC-018 approves); closure timestamp and closer; verification request/decision (Alt B); not-proceeding reason; project link (if provisioned).
- **Audit events (Proposed):** `deal.signature_recorded`, `deal.payment_recorded`, `deal.fact_removed`, `deal.closure_requested` (Alt B), `deal.closure_rejected` (Alt B), `deal.closed`, `deal.marked_not_proceeding`, `project.provisioned`, `project.provisioning_failed`.
- **Notification events:** Owner review item for closure verification (Alt B only; channel per WF-NOTIFY-001). Provisioning failure to Owner (Proposed). No closure notification is required by ART-01 §16.
- **Postconditions:** A Closed deal has all three facts recorded and an attributed closer; it is never equated with a completed project. Under Alt Auto it has a project or a visible provisioning-pending condition; under Alt Manual it may show "Closed deal without project".
- **Decision dependencies:** DEC-006, DEC-018, DEC-017, DEC-005, DEC-002; contract F2; commercial-stage transition rules (no DEC ID).

### WF-PROJ-001 — Project and task delivery

- **ID / Name:** WF-PROJ-001 — Project and task delivery: view, assign, schedule, wait, block, resume, deliver, complete; tasks and milestones.
- **Purpose:** Let Developers and the Owner run delivery of closed deals with a non-linear project status and separate task statuses.
- **REQ range:** REQ-PROJ-001..008.
- **UC IDs:** UC-PROJ-001 (view part; visibility part is WF-ACCESS-001), UC-PROJ-003, UC-PROJ-004.
- **Actors:** Developer, Owner, System.
- **Trigger:** A project board exists (from WF-DEAL-002 provisioning) and a Developer or Owner opens the delivery workspace.
- **Preconditions:** Authenticated; Owner 2FA per R-11 (→ USER; R11-a / R11-b, neither selected); the user passes Access check (WF-ACCESS-001) for the project's closed deal.
- **Main path:**
  1. Developer opens the company-wide list of eligible closed deals / projects. System filters every row through Access check (WF-ACCESS-001) and marks "Assigned to me" (derived) (ART-01 §13, Confirmed).
  2. Owner assigns (or confirms) the responsible Developer(s) on the project (Confirmed for Owner, ART-01 §2.1). Cardinality (one vs several Developers) is open (OQ-07).
  3. Developer sets or updates the schedule: start date, target delivery date, milestone dates (Proposed fields). Audited as a development schedule change (Confirmed audit coverage, ART-01 §17).
  4. Developer moves the project status (Proposed statuses, DEC-019): Scheduled → In progress.
  5. Developer creates and maintains tasks: title, owner, status, dates (ART-01 §13, Confirmed attributes). Task status changes do not change project status (Confirmed: "task status and project status should remain distinct").
  6. Developer records **Delivered** (from In progress, Proposed) when the service is handed to the client.
  7. Developer or Owner records **Completed** (Proposed authority).
- **Alternate paths:**
  - **P1 Waiting for client:** from any active status, with a client-dependency note (note Proposed). Resume → In progress (or Scheduled).
  - **P2 Blocked:** from any active status, with a blocker reason (Proposed). Unblock → In progress (or Scheduled).
  - **P3 Not forced through waiting/blocked:** Scheduled → In progress → Delivered → Completed is valid without visiting either (Confirmed non-linear, ART-01 §13).
  - **P4 Rework after delivery (Proposed):** Delivered → In progress.
  - **P5 Schedule change only:** dates change without a status change.
  - **P6 Developer reassignment:** Owner replaces the Developer; history kept (Proposed). Call Center reassignment of projects is Unresolved (ART-01 §2.3 says "opportunities or deals", OQ-08).
  - **P7 Tasks:** create, assign owner, start, complete, reopen (Proposed), cancel (Proposed). Milestones: dated items; whether a milestone is a task attribute or a separate entity is a Phase 3 data choice (OQ-09).
  - **P8 Open tasks at Delivered/Completed:** warn, do not block (Proposed, OQ-10).
- **Errors and recovery:**
  - Access check Denied (e.g. closed deal hidden by 15-day policy, DEC-002): "Record hidden by policy"; nothing shown beyond what WF-ACCESS-001 allows.
  - Developer updates a project not assigned to them: policy-dependent (Unresolved, no DEC ID, OQ-06). Board 01 tags "Developers and Owner view and update" as Confirmed without saying "assigned only".
  - Invalid transition (e.g. Completed → Blocked): rejected; status unchanged.
  - Invalid dates (delivery before start): validation loop.
  - Save conflict / save failed: reload or retry; nothing changes.
- **Authorization:** Delivery board view and update: Developers and Owner (Confirmed, Board 01). Project developer assignment: Owner (Confirmed); Call Center / Developer self-assignment Unresolved (OQ-08). Data Entry and Call Center have no project update rights (Proposed reading of ART-01 §2.2–2.3).
- **Visibility/assignment:** Access check (WF-ACCESS-001) per project/closed deal; DEC-002 rows "active project" and "completed project" govern 15-day behaviour. Contract C5 — not redefined here.
- **Data changes:** Project status + status history; schedule fields + history; assigned Developer(s) + history; blocker / client-dependency notes; tasks (status, owner, dates, completion); milestones.
- **Audit events (Proposed):** `project.developer_assigned`, `project.status_changed`, `project.schedule_changed`, `task.created`, `task.assigned`, `task.status_changed`, `task.completed`, `task.cancelled`, `milestone.achieved`.
- **Notification events:** None required by ART-01 §16. Assignment to a project may emit "New assignment" (ART-01 §16 lists "new assignment"; scope of that event across modules is Unresolved, no DEC ID).
- **Postconditions:** Project status and task statuses are stored separately; every status and schedule change is attributed and audited; a Completed project is never counted as a closed deal or vice versa (G1).
- **Decision dependencies:** DEC-019 (statuses Proposed), DEC-002, DEC-020 (Developer target counting of tasks/milestones), contract F2 (how projects come to exist), OQ-06..OQ-10.

### WF-AUTH-001 — Login, Owner 2FA, logout, session expiry

- **ID / Name:** WF-AUTH-001 — Login, Owner 2FA verification, logout, session expiry and revocation.
- **Purpose:** Authenticate employees by email and password, enforce mandatory Owner 2FA before any administrative access, and end sessions cleanly.
- **REQ range:** REQ-AUTH-001..009 (possibly also REQ-SEC-TECH-001..006; unverifiable).
- **UC IDs:** UC-AUTH-001, UC-AUTH-002, UC-AUTH-008.
- **Actors:** Employee (any role), Owner, System.
- **Trigger:** User submits email and password on the login page; or selects Logout; or a session reaches its expiry; or a revocation event occurs.
- **Preconditions:** User is not already in an Active session on this client (otherwise redirected to workspace — Proposed).
- **Main path (login):**
  1. User submits email and password (Confirmed, ART-01 §3).
  2. System verifies credentials and that the account is Active (SM-ACCOUNT-001).
  3. Role is not Owner → session **Active**; user lands in the role workspace (Confirmed).
  4. Role is Owner → session **Pending 2FA verification (restricted; scope: R-11 → USER)**. No administrative access (Confirmed). Always allowed: submit second factor, start 2FA recovery, logout. Non-administrative actions (e.g. check-in, deal or project work): **R11-a** none until 2FA / **R11-b** allowed. Neither selected.
  5. Owner submits the second factor (method: Implementation decision). Valid → session **Active** with Owner workspace.
- **Main path (logout):** User selects Logout → session **Ended** (reason logged_out); token invalidated server-side (Proposed); user returned to login.
- **Alternate paths:**
  - **L1 Owner with no enrolled factor:** session **Pending 2FA enrollment (restricted; scope: R-11 → USER)** → `[[WF-AUTH-002]]` enrollment.
  - **L2 Owner lost factor:** from Pending 2FA verification → `[[WF-AUTH-002]]` recovery.
  - **L3 Session expiry:** idle or absolute expiry (durations: Implementation decision) → **Ended** (reason expired). Next request shows "Session expired" and the login page; unsaved input handling is a Phase 3 UX choice.
  - **L4 Revocation:** account deactivation, password reset completion, 2FA recovery, role change (Proposed) → all of that employee's sessions **Ended** (reason revoked). Revocation does not deactivate the account (SB-1 inventory note, Confirmed for the model).
  - **L5 Pending 2FA abandoned or timed out:** **Ended** (Proposed).
- **Errors and recovery:**
  - Invalid credentials: generic "email or password incorrect"; no indication whether the email exists (Proposed); no session created. Lockout/throttling thresholds: Implementation decision.
  - Deactivated account with correct password: login denied with a generic message (Proposed wording); no session.
  - Invalid second factor: stays Pending 2FA verification; after the threshold (Implementation decision) → Ended.
  - Authentication service failure: error shown; no session created; retry.
- **Authorization:** Any Active account may log in. Owner administrative access only from an Active session after 2FA (Confirmed).
- **Visibility/assignment:** n/a (identity only).
- **Data changes:** Session records (state, reason, timestamps, client info as decided in Phase 3); failed-attempt counters.
- **Audit events (Proposed):** `login.failed`, `session.created`, `session.second_factor_verified`, `session.second_factor_failed`, `session.logged_out`, `session.expired`, `session.revoked`.
- **Notification events:** None required by ART-01. Optional new-login alert to Owner is not proposed.
- **Postconditions:** No Owner session has administrative access without completed 2FA; every session ends with a recorded reason; revocation leaves the account state unchanged.
- **Decision dependencies:** None with a DEC ID. Implementation decisions: 2FA method, session durations, lockout thresholds (ART-01 §3). Scope of the restricted state: R-11 → USER (R11-a / R11-b).

### WF-AUTH-002 — Password reset and Owner 2FA enrollment / recovery

- **ID / Name:** WF-AUTH-002 — Password reset (self-service and Owner-triggered assistance); Owner 2FA enrollment and recovery.
- **Purpose:** Restore access securely without the Owner ever learning an employee's password, and keep Owner 2FA mandatory through enrollment and recovery.
- **REQ range:** REQ-AUTH-001..009.
- **UC IDs:** UC-AUTH-003 (003A Enroll, 003B Recover 2FA), UC-AUTH-004.
- **Actors:** Employee, Owner, System, Email service.
- **Triggers:** (a) "Forgot password" on the login page; (b) Owner selects "Send password reset" on an employee record; (c) Owner session enters Pending 2FA enrollment; (d) Owner selects "Lost second factor" from Pending 2FA verification.
- **Preconditions:** (a) none; (b) Owner Active session with 2FA complete; (c)/(d) Owner credentials already verified in this session.
- **Main path (self-service reset, Confirmed: "password recovery by email"):**
  1. User enters their email.
  2. System shows the same confirmation whether or not the account exists (Proposed).
  3. If an Active account matches, System issues a single-use, time-limited reset link (Proposed; duration Implementation decision) and emits the email.
  4. User opens the link; System validates it (unused, unexpired).
  5. User sets a new password meeting the password policy (Implementation decision).
  6. System saves, invalidates the link, **revokes all existing sessions** of that account (Proposed), audits.
  7. User logs in via `[[WF-AUTH-001]]`. An Owner still needs 2FA (reset never bypasses 2FA — Proposed, required by the Confirmed 2FA rule).
- **Alternate paths:**
  - **R1 Owner-triggered assistance (Confirmed: "owner-triggered password-reset assistance"):** Owner opens the employee (directory is Owner only, Confirmed) and triggers a reset; System sends the reset link to the employee's registered email; continue at step 4. The Owner never sees or sets the password (Proposed mechanism; Confirmed principle that Owner access does not include existing passwords). A temporary-password variant is an Implementation decision and is not drawn.
  - **R2 Deactivated account:** no link is sent (Proposed); the response looks the same as for an unknown email; an Owner-triggered reset on a deactivated account is refused with an explanation (Proposed).
  - **E1 Owner 2FA enrollment (003A):** Pending 2FA enrollment → System presents the enrollment step (method Implementation decision) → Owner confirms with a valid factor → factor stored, recovery material issued if the method has one → session Active. Triggered at first Owner login and after a role change to Owner.
  - **E2 Owner 2FA recovery (003B):** Owner selects "Lost second factor" → completes the approved recovery method (Implementation decision) → success: old factor invalidated, all other sessions revoked, session moves to Pending 2FA enrollment (re-enroll) → E1. Failure: session Ended; Owner follows the documented operational recovery procedure (Unresolved, no DEC ID; "Recovery objectives" in SB-1 §3; OQ-12).
- **Errors and recovery:**
  - Expired or used link: "Link expired"; request a new one.
  - Password fails policy: validation loop.
  - Email delivery failure: self-service user sees the generic confirmation and can retry; for Owner-triggered resets the Owner sees the delivery failure (Proposed) via WF-NOTIFY-001 failure handling.
  - Enrollment code invalid: stays Pending 2FA enrollment; retry; threshold → Ended (Implementation decision).
  - Save failed: password/factor unchanged; retry.
- **Authorization:** Self-service: anyone (outcome reveals nothing). Owner-triggered: Owner with 2FA complete. Enrollment/recovery: the Owner's own account only.
- **Visibility/assignment:** n/a.
- **Data changes:** Reset token (issued, used/expired); password hash; 2FA factor and recovery material; session revocations.
- **Audit events (Proposed):** `password_reset.requested`, `password_reset.assistance_triggered`, `password_reset.completed`, `two_factor.enrolled`, `two_factor.recovery_succeeded`, `two_factor.recovery_failed`, plus `session.revoked` from revocation.
- **Notification events:** Reset email (security email; not a WF-NOTIFY-001 business reminder, but delivery uses the same email integration). Proposed: confirmation email after password change and after 2FA recovery.
- **Postconditions:** A password change always ends prior sessions; the Owner remains subject to 2FA; no actor ever reads a password.
- **Decision dependencies:** None with a DEC ID. Implementation decisions: 2FA method, recovery method, token duration, password policy, thresholds. Operational recovery procedure (no DEC ID).

### WF-EMP-001 — Employee create, edit, role change, deactivation; self-profile update

- **ID / Name:** WF-EMP-001 — Employee account administration with self-profile update as an alternate path.
- **Purpose:** Let the Owner manage employee accounts and roles, and deactivate accounts with immediate access revocation, while keeping history and active work intact and visible for manual handling.
- **REQ range:** REQ-AUTH-001..009.
- **UC IDs:** UC-AUTH-005, UC-AUTH-006, UC-AUTH-007.
- **Actors:** Owner, Employee (self-profile), System.
- **Trigger:** Owner opens the employee directory (create / edit / change role / deactivate); or an employee opens their own profile.
- **Preconditions:** Owner Active session with 2FA complete (Confirmed). Self-profile: any Active session.
- **Main path (create):**
  1. Owner opens the employee directory (Owner only, Confirmed).
  2. Owner enters full name, email, profile photo, phone, department, job title, role (ART-01 §3, Confirmed fields).
  3. System validates: required fields (Proposed: name, email, role), email format and uniqueness (Proposed), exactly one role (Confirmed).
  4. (Create only: role is entered here; on edit the role and status fields are excluded — see M1.) System saves the account as **Active** and starts initial credential setup (method: Implementation decision, e.g. invitation link to the employee's email). "Account credentials not yet set" (derived) until the employee sets a password. The Owner never sees the password.
  5. Audit; if the role is Owner, the new account must enroll 2FA at first login (`[[WF-AUTH-002]]` E1).
- **Alternate paths:**
  - **M1 Edit profile fields (Owner):** change ART-01 §3 fields **except role and status** (RV4-04): role changes only via M2 (guard + session revocation), status only via M3/M4; validation as step 3; history kept (Confirmed: account changes audited, ART-01 §17).
  - **M2 Role change (Owner):** select a new role; System shows the impact summary (open items tied to the old role); on confirm, saves the role and **revokes the employee's sessions** (Proposed; required at minimum for a change *to* Owner so no admin access exists without 2FA). Open items are **not** reassigned automatically (Confirmed instruction: no automatic rule invented).
  - **M3 Deactivate (Owner):** System shows the employee's open items — calling assignments, follow-ups, active contact reservation, deal records and meetings where they are assigned Developer or attendee, projects and tasks, open attendance session, open correction requests. Owner confirms. System sets **Deactivated**, revokes all sessions (Confirmed: "access revocation when an employee is deactivated"; UC-AUTH-006), audits. Every open item stays attached to the deactivated employee and is flagged "assignee inactive" (derived, Proposed) until the Owner reassigns it through the owning workflow: `[[WF-CALL-001]]`, `[[WF-FOLLOW-001]]`, `[[WF-CALL-002]]` (reservation release/override), `[[WF-DEAL-001]]`, `[[WF-PROJ-001]]`, `[[WF-ATT-003]]`. Reminders addressed to the deactivated user are suppressed at send time (C6, Proposed).
  - **M4 Reactivate (Proposed; not stated in ART-01, OQ-14):** Owner sets Active; previous assignments are not restored automatically; credential reset may be required.
  - **M5 Self-profile update (UC-AUTH-007):** employee edits own permitted fields (Proposed: photo and phone; name, email, department, job title, role and status remain Owner-only — OQ-13); validation; save; audit.
- **Errors and recovery:**
  - Non-Owner or Owner without 2FA opens the directory: "Permission denied".
  - Duplicate email / invalid fields: validation loop.
  - Owner tries to deactivate or demote themselves, or the last active Owner: blocked (Proposed safety guard).
  - Session revocation fails after deactivation save: deactivation stays committed; revocation is retried, and any request from a deactivated account is refused at authorization time (Proposed: account status checked on every request).
  - Save conflict / save failed: nothing changes; retry.
- **Authorization:** Create/edit/role change/deactivate/reactivate: Owner only, 2FA complete (Confirmed for create/edit/deactivate/role assignment; reactivation Proposed). Self-profile: the employee for their own record only (Confirmed: "everyone can view their own profile"; editable field set Proposed).
- **Visibility/assignment:** Employee directory Owner only (Confirmed). Other employees appear to non-Owners only as names on records they can already access (Proposed).
- **Data changes:** Account record (fields, role, status) and change history; credential-setup token; session revocations. Historical attribution on attendance, businesses, calls and projects is never changed (Confirmed, ART-01 §3).
- **Audit events (Proposed):** `account.created`, `account.updated`, `account.role_changed`, `account.deactivated`, `account.reactivated`, `account.profile_updated` (self), plus `session.revoked`.
- **Notification events:** Credential-setup email on create (security email). Proposed: notify the employee of role change. No automatic notification to other employees.
- **Postconditions:** A deactivated employee has no Active session and cannot authenticate; all their history remains attributed; no work item was silently moved.
- **Decision dependencies:** None with a DEC ID. Deletion vs archiving of employee records (C-01, no DEC ID) — this workflow offers deactivation only. OQ-13, OQ-14.

### WF-REPORT-001 — Owner dashboard, filters, period comparison, export

- **ID / Name:** WF-REPORT-001 — Owner dashboard, filters, period comparison, export (XLS/CSV/PDF).
- **Purpose:** Give the Owner a company-wide operational overview that never conflates distinct measures, with exports that match the selected filters and authorized scope and are audited.
- **REQ range:** REQ-REPORT-001..006.
- **UC IDs:** UC-REP-001, UC-REP-002, UC-REP-003.
- **Actors:** Owner, System.
- **Trigger:** Owner opens the dashboard, changes filters, selects a comparison, or requests an export.
- **Preconditions:** Owner Active session with 2FA complete (reporting and exports are Owner only, Confirmed).
- **Main path:**
  1. Owner opens the dashboard; System authorizes (Owner + 2FA).
  2. System computes metrics for the default period in company time (company timezone from WF-ADMIN-001; Proposed default period: today / current month).
  3. Owner applies filters (ART-01 §15 list: date range, employee, role, category, business name, phone, assigned agent, creator, calling outcome, commercial stage, follow-up date, project status, website availability, social metrics, correction status). Availability depends on the view (Confirmed).
  4. Owner selects a comparison period (Proposed: previous equivalent period or a custom range of the same length). System shows both values and the difference.
  5. Owner selects Export and a format: Excel, CSV or PDF (Confirmed).
  6. System builds the export from the **same filters** and passes rows through Access check (WF-ACCESS-001) — for the Owner this returns full scope (C1, C2). Delivery mode (immediate download or background job) is a Phase 3 choice; the spec treats it as one abstract "export produced" step.
  7. System records `report.exported` (actor, format, filters, row count, time — Proposed fields) and delivers the file.
- **Alternate paths:**
  - **D1 No data for filters/period:** explicit empty state per widget ("No data for this period"), never a fabricated zero where the metric is undefined (Proposed). Export of an empty result produces a file with the filter summary and zero rows (Proposed, OQ-16).
  - **D2 Metric undefined because a policy is unresolved:** e.g. late arrivals without DEC-007/008, missing check-ins without DEC-022, target completion without DEC-020: shown as "Not configured / policy pending", not as zero (Proposed).
  - **D3 Stock metric comparison:** current-count metrics (e.g. pending businesses) for past periods require status history snapshots; if unavailable the comparison shows "not available" (Proposed; Phase 3 data requirement, OQ-17).
  - **D4 Background export (if chosen in Phase 3):** Owner is told the export is being prepared and is notified when ready; same audit.
- **Errors and recovery:**
  - Non-Owner or Owner without 2FA: "Permission denied"; for exports the denied attempt is audited (`report.export_denied`, Proposed).
  - Invalid filter (end before start, comparison periods of unequal length if required): validation loop.
  - Metric query failure: the affected widget shows an error with retry; other widgets still render (Proposed).
  - Export generation failure: error shown; no partial file delivered (Proposed); `report.export_failed` audited; Owner may retry.
- **Authorization:** Owner only, 2FA complete (Confirmed). Not extended to other roles. (The inventory's DEC-002 "export scope" dependency only matters if exports are ever extended beyond the Owner; see dependencies file.)
- **Visibility/assignment:** Owner sees hidden records (C1); reports still call Access check per C2 so a future role extension cannot bypass it.
- **Data changes:** None to operational data. Export audit records; export job records if async.
- **Audit events (Proposed):** `report.exported`, `report.export_failed`, `report.export_denied`. Dashboard views are not audited (Proposed; ART-01 §17 lists report exports only).
- **Notification events:** Only under D4 (export ready / failed) — Phase 3.
- **Postconditions:** Every export matches the on-screen filters and is audited; G1 distinctions hold in every widget and export.
- **Reporting distinctions (contract G1, Confirmed) — each pair is two separate metrics with separate definitions:**

  | Must not be conflated | Metric 1 (source) | Metric 2 (source) |
  |---|---|---|
  | Call attempts vs businesses contacted | Count of call-attempt rows in period (WF-CALL-003) | Count of distinct businesses with ≥1 attempt in period (WF-CALL-003) |
  | Accepted vs closed | Deal records reaching Accepted opportunity in period, `accepted_opportunity.created` (emitted by WF-CALL-003, E5; counted once) | Deal records reaching Closed deal in period, `deal.closed` (WF-DEAL-002) |
  | Accepted opportunities (dashboard snapshot, integration fix B-1) | Deal records currently in stage "Accepted opportunity" (excludes Signed, Paid, Closed and Not proceeding) | Closed deals snapshot: deal records currently in stage Closed deal |
  | Closed vs completed project | `deal.closed` (WF-DEAL-002) | Projects reaching Completed, `project.status_changed` to Completed (WF-PROJ-001) |
  | Not checked in vs absent on scheduled day | No open/closed session right now (derived, SM-ATTENDANCE-001) | Missing check-in on a scheduled working day (derived, WF-ATT-003, DEC-022) |
  | Also kept apart (Proposed) | Pending businesses (calling outcome) | Unassigned businesses (assignment state; C-02) |
  | Also kept apart (Proposed) | Delivered projects | Completed projects |

  Revenue reporting is excluded until DEC-018 approves financial fields (Confirmed, ART-01 §15).
- **Decision dependencies:** DEC-007, DEC-008, DEC-020, DEC-022 (metric definitions), DEC-019 (project-status filter values), commercial-stage names (no DEC ID), DEC-002 (only if export roles extended); async export (Phase 3).

### WF-REPORT-002 — Audit log explorer

- **ID / Name:** WF-REPORT-002 — Audit log explorer.
- **Purpose:** Let the Owner search and inspect the append-only audit history without any ability to change it.
- **REQ range:** REQ-REPORT-001..006.
- **UC IDs:** UC-REP-004.
- **Actors:** Owner, System.
- **Trigger:** Owner opens the audit log.
- **Preconditions:** Owner Active session with 2FA complete (audit trail Owner only, Confirmed).
- **Main path:**
  1. Owner opens the audit log; System authorizes.
  2. Owner filters by date range, actor, entity type, entity reference, event name (Proposed filter set).
  3. System queries and returns a paged, time-ordered list.
  4. Owner opens an entry: actor, timestamp (company time), event, entity, and previous/new values where captured (ART-01 §6.3 / §17).
  5. No edit, delete or hide control exists anywhere (Confirmed: append-only, G3).
- **Alternate paths:** No results → empty state. Entry refers to a deactivated employee or hidden business → shown in full to the Owner (C1); attribution is never rewritten.
- **Errors and recovery:** Non-Owner or Owner without 2FA → "Permission denied" (attempt audited, Proposed). Query failure → error, retry. Any modification attempt through any interface → refused (G3); the attempt is audited (Proposed).
- **Authorization:** Owner only, 2FA complete (Confirmed).
- **Visibility/assignment:** Owner full access (C1). Audit records must not contain passwords, reset tokens or 2FA secrets (Proposed security rule).
- **Data changes:** None (read-only). Optional `audit_log.viewed` (Proposed, OQ-18).
- **Audit events:** `audit_log.access_denied` (Proposed); `audit_log.viewed` optional (OQ-18).
- **Notification events:** None.
- **Postconditions:** Audit history unchanged.
- **Decision dependencies:** None with a DEC ID. Audit export and retention: open (no DEC ID; OQ-18, OQ-19).

---

## 3. State models

General rule applied (SB-1 §7): something is a **state** only if it changes which events are allowed next. Otherwise it is an event (self-transition), an attribute, or a derived classification.

### SM-COMMERCIAL-001 — Commercial lifecycle of a deal record

All state names and transitions are **Proposed** (commercial-stage transition rules have no DEC ID). The calling outcome (Batch 3) and calling assignment (SM-ASSIGNMENT-001) are separate dimensions and are not states here. `NEW_LEAD` / Pending (C-02) are not part of this model.

- **States:** Accepted opportunity; Signed (payment outstanding); Paid (signature outstanding); Signed and paid (awaiting closure); Closed deal; Not proceeding.
- **Why these are states:** each changes what may happen next — e.g. only *Signed and paid* allows Finalize; only non-closed states allow "not proceeding"; *Closed deal* allows project provisioning.
- **Not states:** Developer assigned / not yet assigned (attribute + derived, E3); meeting arranged (SM-MEETING-001); closure verification requested under DEC-006 Alt B (a review item on *Signed and paid*, not a separate state — the allowed next events are the same, only the permitted actor differs); project exists (derived "Closed deal without project").
- **Order of signature and payment:** modelled order-independent (Proposed, OQ-05). If the company requires signature first, *Paid (signature outstanding)* is removed.

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Accepted outcome finalized | Call Center agent, Owner | Business not Rejected (B1); actor passes Access check; open-deal rule | Accepted opportunity | Handoff context captured; "Developer not yet assigned" if none; developer handoff event if assigned | accepted_opportunity.created (Batch 3 event, consumed; not re-counted) | Outcome and record not saved (atomic, E5) | DEC-017; E5 (R-05) |
| Accepted opportunity / Signed / Paid / Signed and paid (any non-terminal stage, RV4-05) | Assign / reassign Developer | Call Center agent, Owner | Assignee is an active Developer (Proposed) | Same stage (self) | Assignment history; developer handoff notification | opportunity.developer_assigned / opportunity.developer_reassigned | Assignment unchanged | E2, E3 |
| Accepted opportunity | Handoff context updated | Call Center agent, Owner; Developer (Alt 1) | Access check | Accepted opportunity (self) | Previous values kept | opportunity.handoff_updated | Unchanged | DEC-005 |
| Accepted opportunity | Signature recorded | Developer, Owner; Call Center (Unresolved) | Access check; not Data Entry; evidence rule | Signed (payment outstanding) | Signature date/reference stored | deal.signature_recorded | Stage unchanged | DEC-005, DEC-018, OQ-03; R-12 → USER (DEC-005 Alt 2 × DEC-006) |
| Accepted opportunity | Payment recorded | Developer, Owner; Call Center (Unresolved) | Access check; payment meets definition | Paid (signature outstanding) | Payment date/reference stored | deal.payment_recorded | Stage unchanged | DEC-018 (deposit), OQ-05; R-12 → USER (DEC-005 Alt 2 × DEC-006) |
| Signed (payment outstanding) | Payment recorded | Developer, Owner | As above | Signed and paid (awaiting closure) | Under Alt B: verification can be requested | deal.payment_recorded | Stage unchanged | DEC-018 |
| Paid (signature outstanding) | Signature recorded | Developer, Owner | As above | Signed and paid (awaiting closure) | As above | deal.signature_recorded | Stage unchanged | DEC-018 |
| Signed and paid (awaiting closure) | Closure verification requested | Developer | DEC-006 Alt B only | Signed and paid (self) | Owner review item | deal.closure_requested | Request not raised | DEC-006 |
| Signed and paid (awaiting closure) | Closure verification rejected | Owner | DEC-006 Alt B; reason required | Signed and paid (self) | Requester informed | deal.closure_rejected | Unchanged | DEC-006 |
| Signed and paid (awaiting closure) | Finalize closure | Alt A: Developer or Owner. Alt B: Owner | Accepted + signed + paid recorded (Confirmed) | Closed deal | Closer and time recorded; provisioning per F2 | deal.closed | Stays Signed and paid | DEC-006, F2; R-12 → USER (DEC-005 Alt 2 × DEC-006) |
| Signed / Paid / Signed and paid | Recorded fact removed (entered in error) | Owner | Before closure; reason required | Previous stage (Accepted opportunity, Signed or Paid) | Original entry retained in audit | deal.fact_removed | Unchanged | Commercial rules (no DEC ID) |
| Any non-closed state | Mark not proceeding | Owner, Developer; Call Center from Accepted only (Unresolved) | Reason required | Not proceeding | Pending meeting reminders cancelled; calling-outcome effect open | deal.marked_not_proceeding | Unchanged | OQ-03, OQ-04, DEC-017 (re-queue, B6) |
| Closed deal | Project provisioned | System (Alt Auto) / Owner or Developer (Alt Manual) | No project yet for this deal (cardinality DEC-017) | Closed deal (self) | Project created in Scheduled | project.provisioned | Closure kept; "Project provisioning pending" (derived) | F2, DEC-017 |

Terminal states: Closed deal (commercial lifecycle ends; delivery continues in SM-PROJECT-001) and Not proceeding. Reopening either is an open question (OQ-15), not modelled.

### SM-MEETING-001 — Developer meeting

New approved ID. States are Proposed.

- **States:** Scheduled; Held; Cancelled; Missed (Proposed).
- **Justification (states vs events):**
  - *Scheduled* allows reschedule, cancel, record held, record missed.
  - *Held* allows only notes amendments (discovery notes); terminal for scheduling.
  - *Cancelled* allows nothing further on this meeting; a new meeting is a new record.
  - *Missed* (Proposed) allows reschedule (back to Scheduled) but not "held"; it differs from Cancelled because it happens after the meeting time and keeps the opportunity's "meeting needs rearranging" visible.
  - **Rescheduled is an event, not a state:** a rescheduled meeting allows exactly the same next events as a Scheduled one; the reschedule is a self-transition with retained history (previous date/time/attendees/notes, ART-01 §11). The inventory note ("scheduled / rescheduled / held / cancelled") is refined accordingly — SB-2 ruling R-13.
- **Derived (not states):** Upcoming (Scheduled and start time in future); Awaiting outcome (Scheduled and start time passed); Meeting not yet arranged (on the deal record, no Scheduled meeting); rescheduled count.
- **Not modelled:** reminder delivery (SM-REMINDER-001, Batch 3). A reminder failure never changes meeting state (Proposed).

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Schedule meeting | Call Center agent, Owner; assigned Developer (Alt 1) | Access check on deal record; date/time not past; ≥1 attendee (Proposed) | Scheduled | Upcoming-meeting reminder event to WF-NOTIFY-001 | meeting.scheduled | No meeting created | DEC-005; notification timing (no DEC ID) |
| Scheduled | Reschedule | Same as schedule | New time not past | Scheduled (self) | Previous values kept; reminders superseded | meeting.rescheduled | Original values unchanged | DEC-005 |
| Scheduled | Cancel | Same as schedule | Reason (Proposed) | Cancelled | Pending reminders cancelled | meeting.cancelled | Stays Scheduled | — |
| Scheduled | Record held | Assigned Developer (Alt 1), Owner, attending Call Center agent | Start time reached (Proposed) | Held | Discovery notes attached to deal record | meeting.held | Stays Scheduled | DEC-005 |
| Scheduled | Record missed / no-show | Same as record held | Start time passed (Proposed) | Missed | Deal record shows meeting needs rearranging (derived) | meeting.missed | Stays Scheduled | Proposed state |
| Missed | Reschedule | Same as schedule | New time not past | Scheduled | New reminders | meeting.rescheduled | Stays Missed | Proposed state |
| Held | Discovery notes amended | Developer (Alt 1), Owner | Access check | Held (self) | Previous notes kept | meeting.notes_updated | Unchanged | DEC-005 |

### SM-PROJECT-001 — Project delivery

Statuses **Proposed** (ART-01 §13; DEC-019 Proposed). Non-linear: no transition requires visiting Waiting for client or Blocked. "Active statuses" below = Scheduled, In progress, Waiting for client, Blocked.

- **States:** Scheduled; In progress; Waiting for client; Blocked; Delivered; Completed.
- **Not states:** delivery overdue (derived: target date passed and not Delivered/Completed); assigned Developer (attribute); task progress (SM-TASK-001; derived percentage, Proposed); schedule changes (events).
- **Not modelled:** cancelled / abandoned project — no ART-01 status exists; open question OQ-11.

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Project provisioned | System (Alt Auto) / Owner or Developer (Alt Manual) | Deal record is Closed deal | Scheduled | Linked to deal; deal context shown | project.provisioned | Closure kept; provisioning pending (derived) | F2, DEC-017, DEC-019 |
| Scheduled | Start work | Developer, Owner | Access check; assignment rule | In progress | — | project.status_changed | Unchanged | DEC-019, OQ-06 |
| Any active status | Client dependency raised | Developer, Owner | Dependency note (Proposed) | Waiting for client | Note stored | project.status_changed | Unchanged | DEC-019 |
| Any active status | Blocker recorded | Developer, Owner | Blocker reason (Proposed) | Blocked | Reason stored | project.status_changed | Unchanged | DEC-019 |
| Waiting for client / Blocked | Resume | Developer, Owner | — | In progress or Scheduled | Dependency/blocker marked resolved | project.status_changed | Unchanged | DEC-019 |
| In progress | Return to planning | Developer, Owner | — | Scheduled | — | project.status_changed | Unchanged | DEC-019 (Proposed) |
| In progress | Record delivered | Developer, Owner | Open tasks → warning only (Proposed). Only from In progress (Proposed): a Waiting/Blocked project resumes first; no project is forced through Waiting/Blocked | Delivered | — | project.status_changed | Unchanged | DEC-019, OQ-10 |
| Delivered | Rework needed | Developer, Owner | Reason (Proposed) | In progress | — | project.status_changed | Unchanged | DEC-019 (Proposed) |
| Delivered | Record completed | Developer, Owner (Proposed) | Open tasks → warning only (Proposed) | Completed | Counted as completed project (G1) | project.status_changed | Unchanged | DEC-019, OQ-10 |
| Any non-completed | Schedule changed | Developer, Owner | Valid dates | Same state (self) | Schedule history | project.schedule_changed | Unchanged | — |
| Any non-completed | Developer assigned / reassigned | Owner; others Unresolved | Assignee active Developer | Same state (self) | Assignment history; new-assignment event | project.developer_assigned | Unchanged | OQ-07, OQ-08 |

Completed is terminal; reopening is an open question (OQ-15).

### SM-TASK-001 — Project task

Task statuses have **no source** beyond ART-01 §13 ("ownership, status, dates, and completion tracking"); all states are **Proposed (no DEC ID)**. Distinct from project status.

- **States:** To do; In progress; Done; Cancelled.
- **Not states:** overdue (derived: due date passed and not Done/Cancelled); owner (attribute); milestone flag (attribute or entity, OQ-09).

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Create task | Developer, Owner | Access check on project; project not Completed (Proposed) | To do | Optional owner and dates | task.created | Not created | OQ-06 |
| To do | Start | Task owner, Developer, Owner | — | In progress | — | task.status_changed | Unchanged | — |
| In progress | Pause | Task owner, Developer, Owner | — | To do | — | task.status_changed | Unchanged | — |
| To do / In progress | Complete | Task owner, Developer, Owner | — | Done | Completion time and actor recorded; counts for Developer target if adopted | task.completed | Unchanged | DEC-020 |
| Done | Reopen | Developer, Owner | Project not Completed (Proposed) | In progress | Completion kept in history | task.status_changed | Unchanged | DEC-020 (whether reopen reverses the count) |
| To do / In progress | Cancel | Developer, Owner | Reason (Proposed) | Cancelled | — | task.cancelled | Unchanged | — |
| Any non-terminal | Reassign owner | Developer, Owner | Assignee active Developer (Proposed) | Same state (self) | Assignment history | task.assigned | Unchanged | — |

### SM-ACCOUNT-001 — Employee account

Kept separate from sessions (SB-1 inventory).

- **States:** Active; Deactivated.
- **Not states:** credentials not yet set (derived); 2FA enrolled (attribute, Owner only); role (attribute; changes are events); "assignee inactive" flags on work items (derived on the items).
- **Why no "Invited" state:** credential setup method is an Implementation decision; an Active account with credentials not yet set allows the same Owner events as any Active account (Proposed).

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Create employee | Owner (2FA complete) | Valid fields; unique email (Proposed); one role (Confirmed) | Active | Credential-setup email; Owner role → 2FA enrollment at first login | account.created | Not created | Implementation decision (credential setup) |
| Active | Edit profile | Owner | Valid fields | Active (self) | Change history | account.updated | Unchanged | — |
| Active | Self-profile update | Employee (own) | Permitted fields only (Proposed) | Active (self) | Change history | account.profile_updated | Unchanged | OQ-13 |
| Active | Change role | Owner | Not last active Owner (Proposed); not self-demotion (Proposed) | Active (self) | Sessions revoked (Proposed); open items listed, not moved | account.role_changed | Unchanged | Role-change revocation (Proposed) |
| Active | Deactivate | Owner | Not self; not last active Owner (Proposed); confirmation after open-items summary | Deactivated | All sessions revoked (Confirmed); open items flagged; reminders suppressed at send (C6) | account.deactivated + session.revoked | Stays Active | — |
| Deactivated | Login attempt | Former employee | — | Deactivated (self) | Denied; no session | login.failed | — | — |
| Deactivated | Reactivate | Owner | Proposed (not in ART-01) | Active | Assignments not restored; credential reset may be required | account.reactivated | Stays Deactivated | OQ-14 |

### SM-SESSION-001 — Authentication session

- **States:** Pending 2FA enrollment (restricted, Owner only; scope: R-11 → USER); Pending 2FA verification (restricted, Owner only; scope: R-11 → USER); Active; Ended.
- **Why two pending states:** they allow different events (enroll vs verify/recover).
- **Why one Ended state:** logout, expiry, revocation and abandonment all allow no further events; the cause is an attribute (`end_reason`: logged_out, expired, revoked, abandoned). Revocation is an **event** ending sessions; it is **not** account deactivation (account state is unaffected unless WF-EMP-001 deactivates).
- **Not states:** failed login (no session is created); idle timer renewal (self-transition on Active); 2FA attempt counter (attribute).
- **Restricted** = no administrative access (Confirmed, ART-01 §3); second-factor entry, recovery and logout always allowed. Non-administrative access: **R-11 → USER** — R11-a none until 2FA / R11-b allowed. Neither selected.

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Credentials valid | Employee | Account Active; role not Owner | Active | Role workspace | session.created | No session; generic error | — |
| (start) | Credentials valid | Owner | Account Active; factor enrolled | Pending 2FA verification | Restricted | session.created | No session | — |
| (start) | Credentials valid | Owner | Account Active; no factor enrolled | Pending 2FA enrollment | Restricted | session.created | No session | — |
| (start) | Credentials invalid / account deactivated | Anyone | — | (no session) | Attempt counter | login.failed | — | Implementation decision (thresholds) |
| Pending 2FA verification | Valid second factor | Owner | Within attempt threshold | Active | Admin access granted | session.second_factor_verified | Stays pending | Implementation decision (method) |
| Pending 2FA verification | Invalid second factor | Owner | Below threshold | Pending 2FA verification (self) | Counter incremented | session.second_factor_failed | — | Implementation decision |
| Pending 2FA verification | Threshold exceeded / timeout / logout | Owner, System | — | Ended | end_reason recorded | session.ended (reason) | — | Implementation decision |
| Pending 2FA verification | Recovery succeeded | Owner | Approved recovery method | Pending 2FA enrollment | Old factor invalidated; other sessions revoked | two_factor.recovery_succeeded | Stays pending; failure → Ended | Implementation decision; OQ-12 |
| Pending 2FA enrollment | Enrollment confirmed | Owner | Valid confirmation code | Active | Factor stored | two_factor.enrolled | Stays pending | Implementation decision |
| Pending 2FA enrollment | Timeout / logout | Owner, System | — | Ended | — | session.ended (reason) | — | — |
| Active | Activity | User | Within idle limit | Active (self) | Idle timer renewed | (none) | — | Implementation decision (durations) |
| Active | Logout | User | — | Ended | Token invalidated | session.logged_out | — | — |
| Active | Idle or absolute expiry | System | Duration reached | Ended | "Session expired" on next request | session.expired | — | Implementation decision |
| Any non-ended | Revoke | System (deactivation, password reset, 2FA recovery, role change), Owner | — | Ended | Account state unchanged by this event | session.revoked | Retried; requests also re-check account status | Role-change revocation (Proposed) |

---

## 4. Acceptance scenarios (Given / When / Then)

**Intended behaviour, not tested.** No software exists.

**WF-DEAL-001**
1. Given a business whose call is finalized as Accepted by a Call Center agent, when the save succeeds, then a deal record exists at stage Accepted opportunity, the calling outcome is Accepted, and no closed deal exists.
2. Given an accepted opportunity saved without a Developer, when the Owner opens the deals overview, then the record shows "Developer not yet assigned" and can be assigned later by Call Center or Owner.
3. Given an accepted opportunity with no meeting, when it is saved, then it is valid and shows "Meeting not yet arranged"; no meeting time was required.
4. Given a Scheduled meeting, when a Call Center agent reschedules it to a new time, then the meeting stays Scheduled, the previous date/time/attendees/notes are kept in history, and an upcoming-meeting event is re-emitted.
5. Given DEC-005 is unselected, when a non-assigned Developer opens an accepted opportunity, then the outcome follows the selected alternative; no access rule is assumed while it is unselected.
6. Given the meeting reminder email fails, then the meeting remains Scheduled and unchanged.

**WF-DEAL-002**
1. Given a deal record at Accepted opportunity, when a Developer records a signature, then the stage is Signed (payment outstanding) and the deal is not counted as closed.
2. Given a deal record with signature recorded but no payment, when anyone tries to finalize closure, then finalization is blocked and the missing payment is named.
3. Given a deal record with signature and payment recorded, when the authorized closer (per DEC-006) finalizes, then the stage is Closed deal with closer and time recorded, and `deal.closed` is audited.
4. Given a Data Entry user, when they attempt any commercial-stage change, then it is denied and nothing changes.
5. Given automatic provisioning (F2 Alt Auto) and a provisioning failure, when closure is finalized, then the deal stays Closed and the Owner sees "Project provisioning pending" with retry.
6. Given no attachment is uploaded, when signature and payment are recorded, then they are accepted (attachments are not required while DEC-018 is unresolved).

**WF-PROJ-001**
1. Given a Developer and three eligible closed deals, one assigned to them, when they open the delivery list, then all three appear (subject to Access check) and the assigned one is marked "Assigned to me".
2. Given a project In progress, when the Developer records Delivered, then the project moves to Delivered without having passed through Waiting for client or Blocked.
3. Given a project Blocked, when the blocker is resolved, then the project can move to In progress, and the blocker reason remains in history.
4. Given all tasks Done, when the Developer views the project, then the project status is unchanged until someone changes it explicitly.
5. Given a project Completed, when someone tries to set it to Blocked, then the transition is rejected.

**WF-AUTH-001**
1. Given an active Call Center employee with correct credentials, when they log in, then an Active session is created and they land in the Call Center workspace.
2. Given an Owner with correct credentials, when they log in, then the session is Pending 2FA verification and any administrative page request is refused until the second factor is verified.
3. Given an unknown email, when someone submits the login form, then the same generic error appears as for a wrong password and no session exists.
4. Given an Active session past the idle limit, when the user makes a request, then they see "Session expired" and the session is Ended with reason expired.
5. Given an employee with two Active sessions, when one session's user logs out, then only that session is Ended (Proposed), and the account stays Active.

**WF-AUTH-002**
1. Given any email entered in "Forgot password", when submitted, then the same confirmation is shown whether or not an account exists.
2. Given a valid reset link, when the user sets a valid new password, then the password changes, the link can't be reused, and all previous sessions are Ended.
3. Given an Owner who resets their password, when they log in again, then 2FA is still required.
4. Given the Owner triggers a reset for an employee, then the reset link goes to the employee's registered email and the Owner never sees a password.
5. Given an Owner who loses the second factor and completes recovery, then the old factor is invalid, other sessions are Ended, and the Owner must enroll again before reaching Active.

**WF-EMP-001**
1. Given an Owner with 2FA complete, when they create an employee with a unique email and one role, then the account is Active, credentials are not yet set, and `account.created` is audited.
2. Given an employee with assigned businesses, follow-ups and a project, when the Owner deactivates them, then all their sessions are Ended, they cannot log in, and every open item remains attached and flagged for manual reassignment (nothing is moved automatically).
3. Given a Data Entry employee with an Active session, when the Owner changes their role to Owner, then their sessions are revoked and their next login requires 2FA enrollment.
4. Given an employee editing their own profile, when they change their phone number, then it saves; when they try to change their role, then the field is not editable.
5. Given the only active Owner, when they try to deactivate themselves, then it is blocked.

**WF-REPORT-001**
1. Given 10 call attempts on 4 distinct businesses in the period, when the Owner views the dashboard, then "Call attempts" shows 10 and "Businesses contacted" shows 4.
2. Given 5 accepted opportunities of which 2 are closed and 1 project completed, then accepted = 5, closed = 2, completed projects = 1 as three separate metrics.
3. Given filters "role = Call Center, last month", when the Owner exports CSV, then the file contains exactly the filtered rows and `report.exported` records format, filters and row count.
4. Given a Developer, when they request the dashboard or an export, then access is denied and the export attempt is audited.
5. Given an export failure, then no partial file is delivered and `report.export_failed` is audited.
6. Given DEC-022 is unselected, when the Owner views "missing check-ins", then the widget shows "policy pending", not zero.

**WF-REPORT-002**
1. Given an Owner with 2FA complete, when they filter the audit log by actor and date, then matching entries appear in time order with previous/new values where captured.
2. Given any user, including the Owner, when they try to edit or delete an audit entry through any interface, then it is refused.
3. Given a non-Owner, when they open the audit log URL directly, then access is denied.

---

## 5. Audit events and countable metrics (contract G2)

All names **Proposed**.

| Event (proposed name) | Entity | Actor | Counted in report? | Source workflow |
|---|---|---|---|---|
| accepted_opportunity.created (emitted by Batch 3; listed here only as consumed — same event, not counted separately) | Deal record | Call Center agent, Owner | Counted once, in Batch 3's G2 table — Accepted opportunities | WF-CALL-003 (consumed by WF-DEAL-001) |
| opportunity.handoff_updated | Deal record | Call Center agent, Owner, Developer (DEC-005 Alt 1) | No | WF-DEAL-001 |
| opportunity.developer_assigned | Deal record | Call Center agent, Owner | No (assignment history only). Development workload is derived; see SB-2 §11. Emitted also when a Developer is chosen inside the Accepted save (WF-CALL-003, E5) | WF-DEAL-001 |
| opportunity.developer_reassigned | Deal record | Call Center agent, Owner | No | WF-DEAL-001 |
| meeting.scheduled | Meeting | Call Center agent, Owner, Developer (Alt 1) | Yes — upcoming meetings (ART-01 §1) | WF-DEAL-001 |
| meeting.rescheduled | Meeting | As above | No | WF-DEAL-001 |
| meeting.cancelled | Meeting | As above | No | WF-DEAL-001 |
| meeting.held | Meeting | Developer (Alt 1), Owner, Call Center attendee | Proposed — meetings held | WF-DEAL-001 |
| meeting.missed | Meeting | As above | No | WF-DEAL-001 |
| meeting.notes_updated | Meeting | Developer (Alt 1), Owner | No | WF-DEAL-001 |
| deal.signature_recorded | Deal record | Developer, Owner (Call Center Unresolved) | Proposed — signed, not yet closed | WF-DEAL-002 |
| deal.payment_recorded | Deal record | Developer, Owner (Call Center Unresolved) | Proposed — paid, not yet closed | WF-DEAL-002 |
| deal.fact_removed | Deal record | Owner | No | WF-DEAL-002 |
| deal.closure_requested | Deal record | Developer | No (DEC-006 Alt B only) | WF-DEAL-002 |
| deal.closure_rejected | Deal record | Owner | No (DEC-006 Alt B only) | WF-DEAL-002 |
| deal.closed | Deal record | Developer or Owner (DEC-006) | Yes — Closed deals | WF-DEAL-002 |
| deal.marked_not_proceeding | Deal record | Owner, Developer (Call Center Unresolved) | Proposed — opportunities not proceeding | WF-DEAL-002 |
| project.provisioned | Project | System / Owner / Developer (F2) | Proposed — closed deals with project | WF-DEAL-002 |
| project.provisioning_failed | Project | System | No (operational alert) | WF-DEAL-002 |
| project.developer_assigned | Project | Owner (others Unresolved) | No (assignment history only). Development workload is derived; see SB-2 §11 | WF-PROJ-001 |
| project.status_changed | Project | Developer, Owner | Yes — projects by status; Completed counted separately from closed deals (G1) | WF-PROJ-001 |
| project.schedule_changed | Project | Developer, Owner | No (audit only; ART-01 §17) | WF-PROJ-001 |
| task.created | Task | Developer, Owner | No | WF-PROJ-001 |
| task.assigned | Task | Developer, Owner | No | WF-PROJ-001 |
| task.status_changed | Task | Developer, Owner | No | WF-PROJ-001 |
| task.completed | Task | Task owner, Developer, Owner | Yes, if DEC-020 adopts it — Developer target | WF-PROJ-001 |
| task.cancelled | Task | Developer, Owner | No | WF-PROJ-001 |
| milestone.achieved | Milestone | Developer, Owner | Yes, if DEC-020 adopts it — Developer target | WF-PROJ-001 |
| login.failed | Login attempt | Anyone | No (security audit) | WF-AUTH-001 |
| session.created | Session | Employee | No | WF-AUTH-001 |
| session.second_factor_verified | Session | Owner | No | WF-AUTH-001 |
| session.second_factor_failed | Session | Owner | No | WF-AUTH-001 |
| session.logged_out | Session | Employee | No | WF-AUTH-001 |
| session.expired | Session | System | No | WF-AUTH-001 |
| session.ended | Session | System (abandoned / threshold) | No | WF-AUTH-001 |
| session.revoked | Session | System, Owner | No | WF-AUTH-001, WF-AUTH-002, WF-EMP-001 |
| password_reset.requested | Account | Employee (self) | No | WF-AUTH-002 |
| password_reset.assistance_triggered | Account | Owner | No | WF-AUTH-002 |
| password_reset.completed | Account | Employee | No | WF-AUTH-002 |
| two_factor.enrolled | Account | Owner | No | WF-AUTH-002 |
| two_factor.recovery_succeeded | Account | Owner | No | WF-AUTH-002 |
| two_factor.recovery_failed | Account | Owner | No | WF-AUTH-002 |
| account.created | Account | Owner | Proposed — employee count | WF-EMP-001 |
| account.updated | Account | Owner | No | WF-EMP-001 |
| account.role_changed | Account | Owner | No | WF-EMP-001 |
| account.deactivated | Account | Owner | Proposed — active employee count | WF-EMP-001 |
| account.reactivated | Account | Owner | No (Proposed event) | WF-EMP-001 |
| account.profile_updated | Account | Employee (self) | No | WF-EMP-001 |
| report.exported | Report export | Owner | No (audit only) | WF-REPORT-001 |
| report.export_failed | Report export | System | No | WF-REPORT-001 |
| report.export_denied | Report export | Any non-authorized user | No | WF-REPORT-001 |
| audit_log.access_denied | Audit log | Any non-authorized user | No | WF-REPORT-002 |
| audit_log.viewed | Audit log | Owner | No (optional, OQ-18) | WF-REPORT-002 |

Metrics that are **derived, not events** (no audit row): Developer not yet assigned; Meeting not yet arranged; Closed deal without project; Project delivery overdue; Task overdue; Development workload (single definition, SB-2 §11: per Developer, open deal records + active projects + open tasks assigned to them).
