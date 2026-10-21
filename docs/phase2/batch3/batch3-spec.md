# Phase 2 Batch 3 — Calling and Follow-ups: Specifications (DRAFT)

- **Status:** DRAFT by Agent 3, repaired after the independent review (`docs/phase2/reviews/batch3-review.md`, RV3-01..11; see `repair-log.md`). Not approved. Nothing here is an approved policy.
- **Baseline:** `docs/phase2/shared-baseline.md` **SB-2** (2026-10-20), including contracts B7, B8, D6, E5 and rulings R-01..R-13. Where this file and SB-2 disagree, SB-2 wins. SB-2 rulings are orchestrator rulings with status Proposed; R-10, R-11 and R-12 stay **→ USER**.
- **Board:** Drawn on Board 02 sections 06 (`65:3584`) and 07 (`65:3587`) under the SB-2 §9a leases; see `verification.md`. Diagram source is in `batch3-mermaid.md`.
- **Missing sources:** ART-02 (REQ text), ART-03 (UC detail), ART-07 (screens). REQ references are ranges only. UC detail is derived from ART-01 and Board 01 titles ("UC detail pending ART-03"). No SCR IDs are used.
- **Local labels:** `B3-Q..` (questions) and `BCR-B3-..` (baseline change requests) are local labels in this batch's staging files. They are not shared IDs.

## 0. Conventions used in this file

**Tags on rules.** Each rule carries a source tag:
- `[Confirmed: <source>]` — Tier 1 (ART-01) or a Confirmed SB-2 contract.
- `[Proposed: <source>]` — SB-2 Proposed contract or Board 01 Proposed tag. The user may change it.
- `[Unresolved: DEC-xxx]` or `[Unresolved: no DEC ID]` — drawn as a branch or "policy-dependent".
- `[Agent 3 proposal]` — a drafting default introduced here to make a flow complete. Weaker than an SB-2 Proposed contract. Listed in `dependencies-and-open-items.md` §4 for review.
- ART-11 (D1–D20) items are cited only as "ART-11 Dn proposal (unapproved)", never as rules.

**Four separate dimensions (SB-2 §5).** Batch 3 never stores one of these inside another.

| Dimension | Values | Owned by | Changed by |
|---|---|---|---|
| Assignment state | Unassigned / Assigned (to one Call Center agent), with history | SM-ASSIGNMENT-001 | WF-CALL-001 only |
| Calling outcome | Pending, On hold, Needs another call, Rejected, Accepted (`pending`, `on_hold`, `needs_another_call`, `rejected`, `accepted`, proposed ids) | Outcome rules table in WF-CALL-003 §2.3.1. No state-model ID: R-10 **→ USER** (approve `SM-OUTCOME-001` or keep the table); until decided it stays a table | WF-CALL-003 (call save), WF-REJECT-001 (reopening) |
| Contact reservation | Per reservation instance: Active / Released / Expired / Overridden | SM-RESERVATION-001 | WF-CALL-002 |
| Commercial stage | Defined by Agent 4 (SM-COMMERCIAL-001) | Agent 4 | WF-DEAL-001/002. Batch 3 only creates the deal record in stage "Accepted opportunity" in the WF-CALL-003 save (E5, R-05) and hands off |

Follow-ups (SM-FOLLOWUP-001) and reminders (SM-REMINDER-001) are separate records with their own lifecycles. A reminder outcome never changes a follow-up (D5).

`NEW_LEAD` is not stored. Where Board 01 says NEW_LEAD, Batch 3 uses the derived view "unassigned + pending" (C-02, unresolved).

**Access.** Every list, detail, search, calendar entry, notification and export in Batch 3 is filtered by "Access check (WF-ACCESS-001)". Batch 3 does not define who may see a business (C5). Where Batch 3 says "assigned businesses", the assignment is only one input to that check.

**B7 (R-02, Proposed).** Every calling action runs the Access check, **including for the assignee**: open in the calling workspace, acquire **and renew** a reservation, log an attempt, finalize an outcome, and every follow-up action. If the assignee is denied, the action is refused ("Record hidden by policy", no business data) and the business is classified **"assigned but inaccessible" (derived)** for the Owner. The assignment stays as it is. **No automatic reassignment.** The Owner's decision goes through WF-CALL-001 (reassign, unassign, or keep as is), and is audited there.

**B8 (R-03, Proposed).** Only WF-CALL-001 creates or changes calling assignments. WF-WORK-001 (Batch 1) hands Call Center items to WF-CALL-001 for both new assignment and reassignment.

**Owner (R-01).** The Owner skips the scope/assignment/timer/exception steps of the Access check but is still subject to resource state: a Rejected business is do-not-call for the Owner too.

**Attendance.** No Batch 3 action requires an open attendance session. Attendance gating: not adopted (A1).

**Time.** "Today", "due" and "overdue" are evaluated in the company timezone (configured in WF-ADMIN-001; value is DEC-007 territory). The overdue threshold is unresolved (notification timing, no DEC ID).

---

## 1. Batch 3 coverage

| UC (Board 01) | Title | Workflow(s) | Notes |
|---|---|---|---|
| UC-CALL-001 | Access calling queue | WF-CALL-001 (Part 2) | Queue buckets are derived |
| UC-CALL-002 | Acquire contact reservation (Pending DEC-004) | WF-CALL-002 | |
| UC-CALL-003 | Log call attempt & notes | WF-CALL-003 | |
| UC-CALL-004 | Schedule callback & reminder | WF-FOLLOW-001, WF-NOTIFY-001 | |
| UC-CALL-005 | Mark Rejected | WF-CALL-003 (marking), WF-REJECT-001 (enforcement) | |
| UC-CALL-006 | Reopen rejected (Pending DEC-016) | WF-REJECT-001 | |
| UC-CALL-007 | Qualify Accepted & assign developer | WF-CALL-003 (deal record in stage "Accepted opportunity", E1/E5) → WF-DEAL-001 (Agent 4) | Developer assignment detail belongs to WF-DEAL-001 |
| UC-CALL-008 | Assignment & reassignment | WF-CALL-001 (Part 1) | |
| UC-CALL-009 | Follow-up reschedule/cancel/complete | WF-FOLLOW-001 | |
| UC-CALL-010 | Reservation release/renew/override | WF-CALL-002 | |
| (none — gap) | ART-01 §16 notifications | WF-NOTIFY-001 | Board 01 has no notification UC (artifact-register gap 4) |

ART-01 §9.2 reservation checklist (all covered in WF-CALL-002): acquisition conflicts, explicit release, renewal, expiration, network interruption, reassignment (with WF-CALL-001), authorized override, unsaved notes.

ART-01 §18 UI states used by Batch 3: Loading, Empty, Validation error, Permission denied, Record hidden by policy, Contact reserved by another agent, Session expired, Save conflict, Successful completion.

---

## 2. Workflow specifications

### 2.1 WF-CALL-001 — Calling queue access, assignment and reassignment

- **ID:** WF-CALL-001. Two parts: Part 1 assignment and reassignment (Owner); Part 2 calling-queue access (agent).
- **Name:** Calling queue access, assignment and reassignment.
- **Purpose:** Put eligible businesses into exactly one Call Center agent's queue, change that assignment without losing history, account for open follow-ups and an active reservation, and give the agent a queue of derived work buckets.
- **REQ range:** REQ-CALL-001..011 (range only; ART-02 unavailable).
- **UC IDs:** UC-CALL-001, UC-CALL-008. Under **B8** this is the only workflow that creates or changes calling assignments. It receives the WF-WORK-001 (Batch 1) hand-off for **both** new assignment and reassignment of Call Center items, and the Owner's decision on a B7 "assigned but inaccessible" item.
- **Actors:**
  - Owner — assigns, reassigns, unassigns; views any agent's queue. `[Confirmed: ART-01 §2.1 "Assign businesses to Call Center agents"]`
  - Call Center agent — views own queue. `[Confirmed: ART-01 §2.3, §9]`
  - System — eligibility checks, derived buckets, automatic allocation proposal if adopted.
  - No other role assigns businesses; no source grants it. Self-assignment by Call Center is not granted. (UC detail pending ART-03.)
- **Trigger:**
  - Part 1: Owner selects one or more businesses and an agent and chooses Assign or Reassign; WF-WORK-001 hand-off for new assignment or reassignment (B8); Owner decides on a B7 "assigned but inaccessible" item (from Part 2); an automatic allocation proposal is produced (DEC-021, Proposed; trigger unselected). All entries pass the same eligibility checks.
  - Part 2: Agent (or Owner) opens the calling queue.
- **Preconditions:**
  - Authenticated, active account. Owner administrative actions require completed 2FA. `[Confirmed: ART-01 §3]`
  - Access check (WF-ACCESS-001) passes for the actor on each business.
  - No attendance precondition (A1).
- **Main path — Part 1 (assign an unassigned business):**
  1. Owner selects businesses and a target agent.
  2. System confirms Owner authorization (2FA complete) and runs Access check (WF-ACCESS-001). The Owner always has access, with audit (C1).
  3. System checks each business against contract B:
     - B1 outcome is not Rejected `[Confirmed]`;
     - B2 at least one phone number `[Proposed]` (phone mandatory at creation is `[Unresolved: no DEC ID]`);
     - B4 not archived or deleted `[Unresolved: C-01]`;
     - B6 open deal → re-queue allowed or not `[Unresolved: DEC-017]` (drawn as policy-dependent);
     - B5 an open data-correction request does **not** block; it is shown as a flag `[Proposed]`.
  4. System checks the assignee: active account with the Call Center role (B3) `[Confirmed]`.
  5. Business is currently Unassigned → save. (Currently Assigned → reassignment path below.)
  6. Single save: new assignment history row (business, agent, assigned by, assigned at, source = manual / work list (WF-WORK-001, B8) / automatic, optional note); assignment state → Assigned. Calling outcome, follow-ups and commercial stage are **not** changed.
  7. Audit `calling_assignment.assigned`.
  8. "New assignment" notification to the assignee via WF-NOTIFY-001 `[Confirmed event: ART-01 §16]`; timing and recipients `[Unresolved: no DEC ID]`.
  9. Business appears in the agent's queue (Part 2) under "New assignments (derived)".
- **Main path — Part 1 (reassign, UC-CALL-008):**
  1. Owner selects a new agent different from the current assignee and enters a reason `[Agent 3 proposal: reason required]`.
  2. System runs steps 2–4 above for the new agent.
  3. System shows an impact summary: open follow-ups on the business (count, responsible user, next due), active contact reservation (holder, since), "callback to be scheduled" marker, "developer not yet assigned" condition if any. Unsaved notes live on the holder's client and cannot be shown; the active reservation is the signal for them.
  4. **Active reservation present** → Owner chooses `[ART-01 §9.1 "account for … active contact activity"; no automatic rule]`:
     - Wait: reassignment is not saved; Owner is told it can be retried after release or expiry.
     - Override: hand-off to WF-CALL-002 Owner override `[Proposed: Board 01 permission summary]`; after the reservation is Overridden, reassignment continues.
  5. **Open follow-ups present** → Owner chooses for each follow-up `[Unresolved: no DEC ID — follow-up handling on reassignment; see B3-Q03]`:
     - transfer responsibility to the new agent;
     - cancel with a reason. If this cancels the last open follow-up of a "Needs another call" business, the same save sets the "callback to be scheduled" marker unless a replacement follow-up is created (D2; see WF-FOLLOW-001);
     - keep with the current responsible user — **warning (RV3-09):** under this batch's own guards the previous agent can no longer Start Contact (WF-CALL-002 requires the current assignee) and may fail the Access check once unassigned (B7, WF-ACCESS-001), so the callback would be orphaned. "Keep" is only workable if a guard exception is adopted (previous agent may contact and access the business for that follow-up). No such rule exists; the option is shown only with this consequence.
     No default is selected (B3-Q03 stays unresolved). The chosen change is applied through WF-FOLLOW-001 events (`follow_up.reassigned` / `follow_up.cancelled`) in the same save.
  6. Single save: end the current assignment row (ended at, ended by, reason), create the new row, apply follow-up choices. History rows are never overwritten (G3).
  7. Audit `calling_assignment.reassigned` (+ follow-up events).
  8. Notify the new assignee (WF-NOTIFY-001). Whether the previous agent is informed is `[Unresolved: no DEC ID]`.
  9. The previous agent's continued access to the business is decided by Access check (WF-ACCESS-001) under DEC-001/DEC-002, not here.
- **Main path — Part 2 (queue access, UC-CALL-001):**
  1. Agent opens the calling queue (no check-in required, A1).
  2. System confirms the account is authenticated and active.
  3. System loads businesses currently assigned to the agent and runs Access check (WF-ACCESS-001) per business. Businesses that fail are omitted for the agent ("Record hidden by policy" if opened directly, no business data). Under **B7** each such business is classified **"assigned but inaccessible" (derived)** and shown in the Owner's queue overview.
  4. System derives buckets per business (a business can appear in more than one). All are **derived classifications**, not stored states:
     - New assignments — Assigned to this agent, no call attempt since this assignment.
     - Requires contact — current outcome Pending or On hold, no open follow-up `[Agent 3 proposal for bucket rule]`.
     - Callback to be scheduled — the D2 pending marker is set **and the outcome is not Rejected** (B1).
     - Callbacks due today — open follow-up whose time falls today (company timezone).
     - Overdue follow-ups — open follow-up whose time has passed (threshold unresolved).
     - Data correction requested — open data-correction request (B5 flag; the request itself is WF-BIZ-002).
     - Rejected: do not call — view only; Start Contact is disabled (WF-REJECT-001).
     - Each row shows the previous outcome and last attempt time.
  5. Agent selects a business → contact workspace in read mode (details, contact history, current outcome, notes, upcoming follow-ups) `[Confirmed: ART-01 §9]`.
  6. Agent selects Start Contact → hand-off to WF-CALL-002.
  7. Owner can open the same view for any agent ("relevant owner overviews", ART-01 §10; C1, R-01). The Owner view also lists B7 "assigned but inaccessible" items.
  8. **B7 Owner decision:** for an "assigned but inaccessible" item the Owner chooses: reassign or unassign → WF-CALL-001 Part 1 (same eligibility checks, audited `calling_assignment.reassigned` / `calling_assignment.unassigned`); or keep as is → assignment unchanged, audited `calling_assignment.retained` `[Agent 3 proposal name]`. The system never reassigns automatically.
- **Alternate paths:**
  - Unassign `[Agent 3 proposal]`: Owner removes the assignment → Unassigned. Same impact summary and the same reservation/follow-up choices as reassignment. Audit `calling_assignment.unassigned`.
  - Automatic allocation `[Proposed: DEC-021, rule unselected]`: System proposes assignments using the adopted rule; each candidate passes the same eligibility checks; the Owner reviews and accepts (WF-WORK-001 review step). Whether automatic allocation may move a business with open follow-ups or an active reservation is part of DEC-021 (ART-11 D8 proposal "never" is unapproved).
  - Multi-select with some ineligible items: ineligible items are excluded with a per-item reason; eligible items proceed `[Agent 3 proposal]`.
  - Assignee later deactivated (WF-EMP-001, Agent 4): the assignment stays as is; the Owner sees a derived "assigned to inactive agent" flag. No automatic reassignment is invented (consistent with WF-WORK-001 and the inventory note for WF-EMP-001).
  - Assignee loses access to the business (15-day policy, DEC-001/DEC-002): the assignment stays as is; B7 "assigned but inaccessible" item for the Owner; no automatic reassignment.
  - Empty queue: Empty state.
  - Business rejected or reassigned after the queue was loaded: Start Contact is re-checked in WF-CALL-002 and blocked.
- **Errors and recovery:**
  - Non-Owner or Owner without 2FA tries to assign → Permission denied; denial recorded per WF-ACCESS-001 rules.
  - Ineligible assignee → Owner picks another agent; nothing saved.
  - Save conflict (business reassigned, rejected or reserved by someone else since the view loaded) → conflict shown, view reloads; nothing overwritten.
  - Save failed → nothing changed; retry.
  - Notification failure → assignment stays saved; handled in WF-NOTIFY-001 `[Agent 3 proposal, by analogy with D5]`.
- **Authorization:** Assign/reassign/unassign: Owner `[Confirmed capability]`. View own queue: Call Center `[Confirmed]`. Owner views any queue (C1). Data Entry and Developer: no queue access is defined for them.
- **Visibility/assignment:** Assignment is an input to Access check (WF-ACCESS-001); Batch 3 does not define the resulting visibility. At most one current assignee per business `[Proposed: SB-2 §5 "to one Call Center agent"]`.
- **Data changes:** Assignment history rows (start/end, actors, reason, source); assignment state; follow-up responsibility or cancellation (via WF-FOLLOW-001). No change to calling outcome, call attempts or commercial stage.
- **Audit events:** `calling_assignment.assigned`, `calling_assignment.reassigned`, `calling_assignment.unassigned` (Agent 3 proposal), `calling_assignment.retained` (B7 "keep as is", Agent 3 proposal), `follow_up.reassigned`, `follow_up.cancelled`, `callback_marker.set` (D2 on cancel), `contact_reservation.overridden` (via WF-CALL-002).
- **Notification events:** New assignment → assignee (recipient Proposed; timing unresolved). Previous agent informed: unresolved.
- **Postconditions:** At most one current assignment per business; complete assignment history; every open follow-up still has a responsible user (per the Owner's choice); no reservation was silently broken.
- **Decision dependencies:** DEC-021, DEC-004, DEC-017 (B6), DEC-001/DEC-002 (through WF-ACCESS-001; B7 items), C-01 (B4), C-02 (NEW_LEAD as derived view); contracts B7, B8 (Proposed); phone mandatory (no DEC ID, B2); follow-up handling on reassignment (no DEC ID); notification recipients and timing (no DEC ID).

### 2.2 WF-CALL-002 — Start Contact and contact reservation

- **ID:** WF-CALL-002. Two parts: Part 1 acquire, collision, renew; Part 2 release, expiry, network loss, stale client, override.
- **Name:** Start Contact and contact reservation.
- **Purpose:** Prevent conflicting simultaneous contact by coordinating work **inside the application** (no telephony; it does not control calls placed outside the app) `[Confirmed: ART-01 §9.2]`.
- **REQ range:** REQ-CALL-001..011.
- **UC IDs:** UC-CALL-002, UC-CALL-010.
- **Actors:** Call Center agent (current assignee), Owner, System (lease timer).
- **Trigger:** Start Contact; periodic renewal from an open contact workspace; explicit release; lease elapsed; Owner override; reassignment requiring override (from WF-CALL-001).
- **Preconditions:**
  - Access check (WF-ACCESS-001) passes, for the assignee too (B7). Denied assignee → action refused, B7 "assigned but inaccessible" item for the Owner.
  - Business outcome is not Rejected (B1; also for the Owner, R-01); business not archived/deleted (B4, C-01).
  - Business outcome is Accepted → whether contact (and a later outcome change) is offered is `[Unresolved: no DEC ID; B3-Q12; DEC-017]` — drawn as policy-dependent.
  - Actor is the current assignee, or the Owner `[Proposed: DEC-004 permission row "Call Center and Owner acquire"; restriction to the current assignee follows ART-01 §2.3 "specifically assigned businesses"]`.
- **Main path (Part 1):**
  1. Actor selects Start Contact.
  2. System runs Access check, outcome check and assignee check.
  3. System checks atomically for an Active reservation on the business:
     - none → create an Active reservation (holder, business, acquired at, lease expiry). Lease duration, idle rule and any maximum total duration: `[Proposed: DEC-004, values undecided]`;
     - Active and held by the same user (for example a second tab or device) → return the existing reservation `[Agent 3 proposal: same-user re-entry is not a collision]`;
     - Active and held by another user → collision (alternate path).
  4. Contact workspace opens in "reserved by you" mode with a lease indicator. The agent places the call outside the app.
  5. While the workspace is open, the client renews the lease. Renewal is a **self-transition** of Active (SM-RESERVATION-001). Renewal cadence: DEC-004. Each renewal re-runs the Access check (B7); if the holder is now denied, the renewal is refused, the reservation ends as Expired at lease end, and (if the holder is the assignee) the B7 item is raised for the Owner.
  6. Switching browser tabs, minimizing or changing windows is **not** a release event. Whether background inactivity counts as "idle" is decided by the DEC-004 idle rule; until then no tab-switch rule is adopted.
  7. Agent records the attempt and outcome in WF-CALL-003. Only after that save succeeds does the system release the reservation (Part 2).
- **Alternate paths:**
  - **Collision:** System shows "Contact reserved by another agent" `[Confirmed UI state: ART-01 §18]`, with holder name and since-time `[Agent 3 proposal]`. No reservation is created for the requester. Agent returns to the queue; Owner may choose override. Collision sources in practice: Owner vs agent; previous agent with a stale page after reassignment; the same business opened by two users through any shared view.
  - **Explicit release without saving (cancel):** agent selects Cancel contact. If notes are unsaved, the system warns; agent chooses to keep them as a local draft `[Agent 3 proposal]` or discard. Reservation → Released. No call attempt is logged for a cancelled contact (nothing is fabricated).
  - **Release after save:** WF-CALL-003 save succeeded → System releases → Released. If the release gets no response, the reservation simply expires at lease end; the call data is already saved, so this never enters the network-loss / stale-client path (no re-acquire, no second save).
  - **Expiration:** lease elapses without renewal (idle per DEC-004, network loss, closed browser, revoked session) → Expired. The business becomes available. The holder's client shows "reservation expired" at its next contact with the server; unsaved notes remain in the form.
  - **Network loss:** renewals fail; client shows an offline banner; notes stay in the form/draft. On reconnect:
    - still Active and held by this user → renewal succeeds;
    - Expired and the business is free → user may re-acquire (a **new** reservation instance);
    - another user now holds it → collision; the draft is kept; saving is blocked until the user holds a reservation again.
  - **Session expired during contact** (SM-SESSION-001, Agent 4): treated like network loss; after re-login the reconnect rules above apply.
  - **Stale client:** client believes it holds a reservation that the server shows as Released (for example released from another tab), Expired or Overridden. Every renewal and save is validated server-side against the reservation. On mismatch: "reservation no longer held". Behaviour of a late save is `[Unresolved: no DEC ID — B3-Q05]`:
    - Alt A: reject the save; keep the draft until the user re-acquires and saves;
    - Alt B: accept the call attempt row only (the call did happen); any change to the current outcome, follow-ups or accepted opportunity requires re-acquiring.
  - **Owner override:** `[Proposed: Board 01 permission summary "Owner force override"; override rules undecided, ART-01 §9.2; no DEC ID]`
    1. Owner selects Override on a reserved business and enters a reason `[Agent 3 proposal: reason required]`.
    2. System ends the reservation as Overridden; audit `contact_reservation.overridden` `[Confirmed audit category: ART-01 §17 "Reservation overrides"]`.
    3. Holder is informed in the workspace at next sync; any other channel is unresolved.
    4. Owner then acquires a reservation (Part 1) or continues the reassignment (WF-CALL-001).
    5. Holder's unsaved notes stay on the holder's client; a later save follows the stale-client path.
  - **Reassignment while reserved:** WF-CALL-001 offers the Owner "Wait" or "Override". Reassignment never silently ends a reservation.
  - **Holder deactivated** (WF-EMP-001): sessions are revoked, renewals stop, the reservation ends as Expired at lease end `[Agent 3 proposal]`. Immediate termination on deactivation is a question for DEC-004 / WF-EMP-001 (B3-Q06).
- **Errors and recovery:**
  - Access denied / record hidden by policy → message; no reservation.
  - Outcome Rejected → do-not-call message; hand-off to WF-REJECT-001 view.
  - Not the assignee and not Owner → Permission denied.
  - Acquire save failed → no reservation; retry.
  - Renewal fails transiently → retried until lease end (dotted retry); then Expired.
  - Release fails (no response) → reservation expires at lease end; harmless because the call data is already saved.
- **Authorization:** Acquire: assigned Call Center agent and Owner `[Proposed: DEC-004]`. Release: holder. Override: Owner `[Proposed]`. Nobody else ends another user's reservation.
- **Visibility/assignment:** Access check (WF-ACCESS-001) on acquire and on every renewal (B7). A reservation never changes assignment state or calling outcome.
- **Data changes:** Reservation instance: holder, business, acquired at, current lease expiry, last renewed at, ended at, end reason (released / expired / overridden), overriding user and reason.
- **Audit events:** `contact_reservation.acquired`, `contact_reservation.released`, `contact_reservation.expired`, `contact_reservation.overridden`. `contact_reservation.acquire_conflicted` and `contact_reservation.renewed` are operational log entries, not audit `[Agent 3 proposal: avoid audit noise]`.
- **Notification events:** Override → holder informed (channel unresolved, no DEC ID). No email for reservations.
- **Postconditions:** At most one Active reservation per business at any moment; every reservation ends as Released, Expired or Overridden; no reservation ends merely because the agent switched tabs; no unsaved notes are discarded without a warning.
- **Decision dependencies:** DEC-004 (duration, idle rule, renewal, re-entry); override rules (ART-01 §9.2, no DEC ID); late save after loss (no DEC ID, B3-Q05); behaviour on deactivation (B3-Q06); contact on an Accepted business (B3-Q12, DEC-017); B7; DEC-001/DEC-002 via WF-ACCESS-001.

### 2.3 WF-CALL-003 — Record call attempt and finalize outcome

- **ID:** WF-CALL-003. Two parts: Part 1 attempt entry and outcome-specific fields; Part 2 validate, save, release, hand-offs.
- **Name:** Record call attempt and finalize outcome.
- **Purpose:** Log every contact attempt as its own history row, set the business's current calling outcome (all four outcomes, never merged, never forced sequential), create follow-ups, pending markers and (for Accepted) the deal record in stage "Accepted opportunity" (E5) consistently in the same save, and only then release the reservation.
- **REQ range:** REQ-CALL-001..011.
- **UC IDs:** UC-CALL-003, UC-CALL-005 (marking), UC-CALL-007 (accepted opportunity; developer assignment handed to WF-DEAL-001).
- **Actors:** Call Center agent (reservation holder), Owner (reservation holder), System.
- **Trigger:** Holder selects "Log attempt" in the reserved contact workspace, during or after the external call.
- **Preconditions:**
  - Actor holds an Active reservation on the business `[Proposed: DEC-004]`.
  - Access check (WF-ACCESS-001) passes on log and on finalize, for the assignee too (B7). Denied assignee → refused, B7 item for the Owner.
  - Outcome is not Rejected (it could not have been reserved otherwise; re-checked at save).
- **Main path (Part 1 — entry):**
  1. Agent enters the attempt: attempt time (defaults to now; editing or backdating `[Unresolved: no DEC ID — B3-Q07]`) and notes `[Confirmed fields: ART-01 §9.3 business, agent, timestamp, outcome, notes, related follow-up]`.
  2. Agent selects the resulting outcome: **On hold**, **Needs another call**, **Rejected** or **Accepted**. Outcomes are not sequential, and a business may accept or reject on the first conversation `[Confirmed: ART-01 §9.4]`. From Pending, On hold or Needs another call any of the four may be chosen (outcome rules table §2.3.1). If the current outcome is **Accepted**, changing it is `[Unresolved: no DEC ID; B3-Q12; DEC-017]` — drawn as policy-dependent (if the policy forbids a change, only an attempt-only log could apply, itself unresolved). A further choice "no outcome change (attempt only)" is `[Unresolved: C-02 sub-question — does Pending still apply after a contact without a resolved outcome?]`.
  3. Outcome-specific fields. All are **proposed fields**; making any of them mandatory needs approval `[ART-01 §9.3 "Additional mandatory fields should be approved before being enforced"]`, except where an SB-2 contract already requires the item:
     - **On hold (no answer):** optional follow-up (time, purpose) `[Proposed: D3]`. Business returns to the queue.
     - **Needs another call (client asked for later contact):** either a follow-up (time, purpose) created in the same save, **or** an explicit "callback to be scheduled" pending marker `[Proposed: D2 — never silently missing]`. Requested-by-client note (proposed field).
     - **Rejected (do not call):** rejection reason (proposed field). Any "callback to be scheduled" marker is **cleared in the same save** (B1: a do-not-call business must not stay in a callback bucket, and scheduling is blocked afterwards). Open follow-ups are handled per `[Unresolved: D4]` (policy-dependent; options shown: cancel with system reason, keep, or agent chooses in the same save — none selected).
     - **Accepted (interested, proceeding):** client needs, service interest, call notes carried forward (handoff context, ART-01 §11; proposed fields). Developer: assign now (Call Center or Owner, E2 `[Confirmed]`) or defer → explicit "developer not yet assigned" condition visible to the Owner (E3 `[Proposed]`). Meeting arrangements optional; acceptance does not require a meeting time `[Confirmed: ART-01 §11]`. Open follow-ups **and any "callback to be scheduled" marker** per `[Unresolved: D4]` (policy-dependent).
- **Main path (Part 2 — validate and save):**
  4. System validates contract-required items (D2 for Needs another call), any approved mandatory fields, follow-up time validity (same rules as WF-FOLLOW-001), and developer eligibility if assigned now (active Developer; detail in WF-DEAL-001).
  5. System re-validates that the actor still holds the reservation (stale-client check) and that the business has not changed since the workspace loaded (assignment, outcome, follow-ups) `[Confirmed UI state "Save conflict": ART-01 §18]`.
  5a. **Accepted only — open deal record check `[Unresolved: DEC-017]`** (same rule as WF-DEAL-001 A9, Agent 4): if the business already has an open deal record, then either a new deal record is created (multiple concurrent deals allowed), or no new record is created and the user is shown the existing open deal record, with the Accepted save blocked or linked to it (single deal only). Neither branch is selected.
  6. **Single all-or-nothing save:**
     - new call attempt row (business, agent, attempt time, outcome recorded on this attempt, notes, related follow-up id);
     - current calling outcome updated if different (the previous value stays visible through attempt history and audit; the attempt row and the current outcome are separate data) `[Confirmed: ART-01 §9.3]`;
     - follow-up created (Needs another call / optional On hold), or a due follow-up this attempt fulfils marked Completed (agent selects it) `[Agent 3 proposal]`;
     - D2 marker set (Needs another call, deferred), cleared when a follow-up is created, cleared on Rejected (B1); on Accepted per D4 (policy-dependent);
     - D4 follow-up handling applied when the policy is adopted;
     - Accepted: **one deal record whose initial commercial stage is "Accepted opportunity"** (E5, R-05), with handoff context and developer-assigned / "developer not yet assigned" condition (E1, E3) — **not** a closed deal; subject to step 5a;
     - audit events, including `accepted_opportunity.created` (emitted here by Batch 3, consumed by Batch 4 WF-DEAL-001; counted once).
  7. After the save succeeds, System releases the reservation (WF-CALL-002). A failed release is harmless: the lease expires.
  8. Hand-offs:
     - Accepted → [[WF-DEAL-001]] (Agent 4): the deal record created in this save, developer assignment if deferred, meetings, discovery. Batch 3 does not define commercial stages beyond creating the record in "Accepted opportunity" (E5).
     - Follow-up created → [[WF-FOLLOW-001]], which schedules reminders via [[WF-NOTIFY-001]].
     - Rejected → [[WF-REJECT-001]] enforcement.
     - Developer assigned now → "Developer handoff" notification via [[WF-NOTIFY-001]] `[Confirmed event: ART-01 §16]`.
  9. Business re-enters the queue according to derived buckets (WF-CALL-001 Part 2). Accepted businesses leave the "requires contact" buckets `[Agent 3 proposal]`.
- **Alternate paths:**
  - Same outcome as current (for example a second On hold): attempt logged, outcome unchanged, no `call_outcome.changed` event.
  - Save and continue `[Agent 3 proposal]`: agent logs an attempt (for example first number unreachable) and keeps the reservation to try another number; release happens on finish.
  - Pending → Accepted or Rejected on the first conversation: allowed (§9.4).
  - Needs another call with scheduling deferred: marker set; business shows under "Callback to be scheduled" until WF-FOLLOW-001 creates the follow-up.
  - Accepted with developer deferred: "developer not yet assigned" visible to the Owner (E3); resolved in WF-DEAL-001.
  - Current outcome is Accepted and the business is contacted again: changing Accepted to another calling outcome is `[Unresolved: no DEC ID; B3-Q12; relates to DEC-017 and Agent 4 commercial rules]` (policy-dependent in WF-CALL-002 guards and WF-CALL-003 Part 1).
  - Accepted while the business already has an open deal record: step 5a (DEC-017, policy-dependent).
- **Errors and recovery:**
  - Validation error → stays in the form; nothing saved; reservation kept and renewed.
  - Save failed (server or network) → nothing saved; form data retained; reservation remains Active; retry. **The reservation is never released before the save succeeds.**
  - Reservation lost (expired or overridden) → stale-client path in WF-CALL-002 (policy-dependent, B3-Q05).
  - Save conflict (business reassigned, rejected, outcome or follow-ups changed by another user) → conflict shown with the current values; agent reviews and resubmits; nothing overwritten silently.
  - Developer assignment invalid (inactive or wrong role) → agent picks another or defers (E3).
  - Downstream notification or reminder failure → the save stands (D5).
- **Authorization:** Call logging and outcome changes: Call Center and Owner `[Confirmed: Board 01 permission summary]`; Call Center only on businesses assigned to them `[Confirmed: ART-01 §2.3]`. Developer assignment: Call Center or Owner (E2). Data Entry and Developer cannot log calls or change calling outcomes (no source grants it).
- **Visibility/assignment:** Access check (WF-ACCESS-001). Developer access to the new accepted opportunity is DEC-005, evaluated in WF-ACCESS-001. Assignment state is unchanged by any outcome `[Agent 3 proposal; keeps dimensions separate]`.
- **Data changes:** Call attempt row (append-only); current calling outcome; follow-up (create/complete); D2 marker (set/cleared); deal record in stage "Accepted opportunity" with handoff context (E5); "developer not yet assigned" condition; reservation end.
- **Audit events:** `call_attempt.logged`, `call_outcome.changed`, `follow_up.scheduled`, `follow_up.completed`, `follow_up.cancelled` (D4), `callback_marker.set`, `callback_marker.cleared`, `accepted_opportunity.created` (E5; emitted by Batch 3, consumed by Batch 4), `contact_reservation.released`.
- **Notification events:** Developer handoff → assigned developer (recipient Proposed; channel and timing unresolved). Follow-up reminders via WF-FOLLOW-001 → WF-NOTIFY-001.
- **Postconditions:**
  - Exactly one new call attempt row per attempt save; past attempts are never edited by a later outcome.
  - "Needs another call" never exists without a follow-up or an explicit marker (D2).
  - Accepted creates one deal record in stage "Accepted opportunity" (E5), never a closed deal (E1); DEC-017 governs an existing open deal record.
  - A Rejected save leaves no "callback to be scheduled" marker (B1).
  - The reservation is released only after a successful save.
  - Rejected and Accepted have consistent follow-up handling once D4 is decided; until then the branch is policy-dependent.
- **Decision dependencies:** DEC-004, DEC-005, DEC-016 (Rejected only changes via reopening), DEC-017 (open deal record, step 5a; Accepted → ?), DEC-020 (what counts toward targets), DEC-001 Alt B (`call_attempt.logged` is a reset touchpoint, R-07 — consumed by WF-ACCESS-001, not computed here); contracts B7, D2, D3, D4, E1–E3, E5; mandatory fields (ART-01 §9.3, no DEC ID); C-02 sub-question; attempt backdating (no DEC ID); late save after loss (no DEC ID).

#### 2.3.1 Calling-outcome change rules (part of WF-CALL-003; not a state model)

No state-model ID exists for the calling outcome in the approved inventory. **R-10 → USER:** approve `SM-OUTCOME-001`, or keep outcome changes as this table inside WF-CALL-003. Until the user decides, it stays a table (drawn as a table in Board 02 section 06).

| From \ To | Pending | On hold | Needs another call | Rejected | Accepted |
|---|---|---|---|---|---|
| (business created) | Initial value `[Proposed: C-02 separation; set by WF-BIZ-001, Agent 2]` | — | — | — | — |
| Pending | Attempt only: C-02 sub-question | Call save | Call save (+ follow-up or marker) | Call save (marker cleared) | Call save (+ deal record, E5; DEC-017) |
| On hold | Not via call save `[Agent 3 proposal]` | Same outcome (attempt only) | Call save | Call save | Call save |
| Needs another call | Not via call save `[Agent 3 proposal]` | Call save | Same outcome (attempt only; new follow-up or marker) | Call save | Call save |
| Rejected | Only via WF-REJECT-001 reopening; target outcome policy-dependent (DEC-016) | Only via reopening (DEC-016) | Only via reopening (DEC-016) | — | Only via reopening (DEC-016) |
| Accepted | Unresolved (no DEC ID; B3-Q12; DEC-017; Agent 4) | Unresolved (B3-Q12) | Unresolved (B3-Q12) | Unresolved (B3-Q12) | — |

"Call save" = WF-CALL-003 save by a reservation holder. Non-sequential moves are allowed (ART-01 §9.4).

### 2.4 WF-FOLLOW-001 — Follow-up create, reschedule, complete, cancel

- **ID:** WF-FOLLOW-001.
- **Name:** Callback (follow-up) lifecycle and return to queue.
- **Purpose:** Keep each saved callback commitment as its own record — scheduled, completed or cancelled — with reschedule history, independent of reminders, visible in dashboard, queue, calendar and owner overviews.
- **REQ range:** REQ-CALL-001..011.
- **UC IDs:** UC-CALL-004, UC-CALL-009.
- **Actors:** Call Center agent (responsible user), Owner, System (derived due/overdue).
- **Trigger:**
  - Created inside a WF-CALL-003 save.
  - Agent schedules from the queue to resolve a "callback to be scheduled" marker, or from the business workspace.
  - Reschedule, complete or cancel on an existing follow-up.
  - Responsibility change during reassignment (WF-CALL-001).
  - Outcome change to Rejected or Accepted (D4, policy-dependent).
- **Preconditions:**
  - Access check (WF-ACCESS-001) passes, for the assignee too (B7). Denied assignee → refused, B7 item for the Owner.
  - Actor is the responsible user, the current assignee, or the Owner `[Agent 3 proposal]`.
  - For schedule and reschedule: outcome is not Rejected (B1).
  - A contact reservation is **not** required to schedule, reschedule, complete or cancel outside a call `[Agent 3 proposal: scheduling is not contact]`.
- **Main path (schedule):**
  1. Actor enters date and time (company timezone) and purpose/notes `[Confirmed fields: ART-01 §10]`.
  2. Responsible user defaults to the current assignee; must be an active Call Center agent or the Owner (B3).
  3. System validates: time in the future `[Agent 3 proposal]`; business not Rejected.
  4. Save: follow-up Scheduled; D2 marker cleared if present.
  5. Audit `follow_up.scheduled`.
  6. Reminders scheduled via [[WF-NOTIFY-001]] (timing unresolved). A reminder scheduling failure never blocks or rolls back the follow-up (D5).
  7. Follow-up appears in the agent's dashboard, calling queue, calendar and relevant owner overviews `[Confirmed: ART-01 §10]`, each filtered by Access check (C2).
- **Main path (reschedule):** new date/time and reason `[Agent 3 proposal: reason required]` → history row (previous time, new time, by, at, reason) → follow-up stays Scheduled (self-transition) → pending reminders cancelled and replaced via WF-NOTIFY-001 → audit `follow_up.rescheduled` `[Confirmed: ART-01 §10 "Rescheduling history"]`.
- **Main path (complete):** normally through a WF-CALL-003 attempt that references the follow-up; or manually with a completion note `[Agent 3 proposal]` → Completed (completed by, at, linked attempt) → reminders cancelled → audit `follow_up.completed`. If another contact is needed, a **new** follow-up is created; a completed follow-up is not reopened `[Agent 3 proposal]`.
- **Main path (cancel):** reason → Cancelled → reminders cancelled → audit `follow_up.cancelled`.
- **D2 guard on complete/cancel (RV3-06, Proposed under D2):** if the business's current outcome is **Needs another call** and this is its **last open follow-up**, and it is cancelled (standalone, reassignment "cancel") or completed **without** a linked call attempt, then in the same save the agent either adds a replacement follow-up, or the system sets the "callback to be scheduled" marker (`callback_marker.set`). The client's callback request is never left without a follow-up or a marker. (Completion through a linked attempt is covered by that attempt's own D2 rule in WF-CALL-003.) Completing or cancelling never clears a marker; a marker is cleared only when a follow-up is scheduled or the outcome becomes Rejected.
- **Return loop:** after completion or cancellation, the business appears in queue buckets according to its current outcome (WF-CALL-001 Part 2).
- **Derived classifications (not states):** Upcoming, Due today, Overdue (Scheduled and time passed; threshold unresolved), "responsible user inactive" (flag for Owner).
- **Alternate paths:**
  - Several open follow-ups on one business: `[Unresolved: no DEC ID — B3-Q04]`.
  - Outcome becomes Rejected or Accepted while follow-ups are open: D4 policy-dependent.
  - Reassignment: Owner chooses transfer / keep / cancel (WF-CALL-001); a transfer is a responsibility change on a Scheduled follow-up with history (`follow_up.reassigned`).
  - Responsible user deactivated (WF-EMP-001): follow-up stays Scheduled; the Owner sees "responsible user inactive" `[Agent 3 proposal]`; reminders to that user are suppressed at send time (C6) and the suppression is visible to the Owner `[Proposed: D6, R-09]`.
  - Responsible user loses access to the business under DEC-001/DEC-002 while the follow-up is open: the Owner overview still shows it (C1); whether the agent still sees it is decided by WF-ACCESS-001 (DEC-002 "scheduled callback" row). See tension T-2 in `dependencies-and-open-items.md`.
- **Errors and recovery:** Invalid time → correct; business Rejected → schedule/reschedule blocked (do-not-call); not authorized → Permission denied; save conflict (for example the follow-up was completed by a call save while being rescheduled) → conflict shown, reload; save failed → nothing changed, retry; reminder scheduling failed → follow-up stays saved, failure flagged and retried in WF-NOTIFY-001.
- **Authorization:** Call Center (own follow-ups on assigned businesses) and Owner `[Confirmed: ART-01 §2.3 "Schedule and manage follow-ups"]`.
- **Visibility/assignment:** Access check (WF-ACCESS-001); calendar entries are access-checked (C2).
- **Data changes:** Follow-up (business, responsible user, scheduled time, purpose, state, completion/cancellation info, linked attempt); reschedule and responsibility history; D2 marker cleared on schedule, set by the D2 guard on complete/cancel.
- **Audit events:** `follow_up.scheduled`, `follow_up.rescheduled`, `follow_up.reassigned`, `follow_up.completed`, `follow_up.cancelled`, `callback_marker.set`, `callback_marker.cleared`.
- **Notification events:** Follow-up due and overdue reminders to the responsible user `[Confirmed: ART-01 §10 email reminders required; §16 events]`; Owner recipients and escalation unresolved.
- **Postconditions:** Completed and Cancelled are terminal; reschedule history is complete; no reminder outcome changes the follow-up (D5); a "Needs another call" business always keeps an open follow-up or a marker (D2).
- **Decision dependencies:** Notification timing, recipients and escalation (no DEC ID); overdue threshold (no DEC ID); DEC-002 (callback visibility exception); DEC-001 Alt B (`follow_up.scheduled` is a reset touchpoint, R-07 — consumed by WF-ACCESS-001); D2, D4, D6, B7; follow-up handling on reassignment (no DEC ID); multiple open follow-ups (no DEC ID).

### 2.5 WF-NOTIFY-001 — Reminder and notification dispatch

- **ID:** WF-NOTIFY-001. Two parts: Part 1 event intake and scheduling; Part 2 dispatch, re-check, failure, retry.
- **Name:** Reminder and notification dispatch.
- **Purpose:** Turn committed business events into reminders and notifications, deliver them, and handle failures without erasing, blocking or changing the source record.
- **Two delivery families (R-08, Proposed):**
  - **Reminders** — email reminders for **follow-ups and meetings**. Each is a reminder instance with the SM-REMINDER-001 lifecycle and `reminder.*` events.
  - **Notifications** — all other ART-01 §16 alerts (missing check-in/checkout, new assignment, developer handoff, data-correction request, attendance correction awaiting review, delivery failure, and the B7 Owner item). Dispatched by this workflow **without a state model**, using the same C6 re-check and D6 failure-visibility rules, with their own `notification.*` events so reminder counts never include other alerts.
- **REQ range:** None visible (inventory); ART-02 unavailable.
- **UC IDs:** None on Board 01 (gap, artifact-register §C item 4). Covers ART-01 §16.
- **Actors:** System scheduler and notification processing; email provider (external); recipients (employees); Owner (delivery-failure notifications).
- **Trigger:** A committed source event (table §2.5.1); a reminder's trigger time arriving; a retry time arriving.
- **Preconditions:** The source save has committed. Nothing is sent for unsaved or rolled-back changes `[Agent 3 proposal]`.
- **Three different times (kept apart):** business event time (for example the follow-up at 14:00), trigger/job time (when the reminder is due to be sent; lead time unresolved), and delivery time (when the provider accepted it). The job time is not the business event time.
- **Main path (Part 1 — intake and scheduling):**
  1. Source event committed.
  2. Family (R-08): follow-up or meeting → reminder path (steps 3–7); any other §16 alert → notification path (step 8).
  3. Reminder change type:
     - new follow-up or meeting → plan delivery;
     - rescheduled → cancel pending reminders for that source, then plan new ones;
     - **responsible user (or recipient) changed**, e.g. `follow_up.reassigned` → cancel pending reminders, then plan new ones for the new recipient (RV3-08);
     - completed or cancelled → cancel pending reminders (Cancelled).
  4. Determine recipients `[Unresolved: no DEC ID]`. Email reminders are required for follow-ups `[Confirmed: ART-01 §10]`; meetings use the same "Reminder" term (SB-2 §5, R-08); any in-app presentation is `[Unresolved: no DEC ID]`.
  5. Compute the trigger time from the business event time and the timing policy (unresolved).
  6. Trigger time already in the past at scheduling (short-notice follow-up) → `[Unresolved: no DEC ID — B3-Q08]`: send now, or skip.
  7. Create the reminder instance → Scheduled. If scheduling itself fails, the source is unaffected; the failure is flagged and retried `[Agent 3 proposal]`.
  8. Notification path: determine recipients and channel (unresolved, no DEC ID); send immediately or per timing policy (unresolved); delivery uses the Part 2 re-check and failure rules (C6, D6, retry) but creates no reminder instance and no state model. Events `notification.sent`, `notification.failed`, `notification.suppressed`.
- **Main path (Part 2 — dispatch):**
  9. At trigger time a worker picks up the Scheduled reminder (or a notification is dispatched).
  10. Re-check at send time (C6 `[Proposed]`):
      - reminders only: source still open and unchanged (version matches; for example the follow-up is still Scheduled at the same time) — otherwise Cancelled as stale;
      - reminders only: job running after the business event time (worker downtime) → `[Unresolved: no DEC ID — B3-Q08]`: send labelled late, or skip;
      - recipient account active (SM-ACCOUNT-001, Agent 4);
      - recipient still passes Access check (WF-ACCESS-001) for the related business; content is limited to what the recipient may see. Choosing to suppress rather than redact is `[Agent 3 proposal]`.
  11. Send the email. Provider accepted → Sent.
  12. Record the delivery result.
- **Alternate paths:**
  - Re-check fails on account or access → Suppressed; visible to the Owner as a delivery-failure notification `[Proposed: D6, R-09]`. The follow-up or meeting is unchanged.
  - Overdue reminder: a separate reminder instance with its own trigger time; same lifecycle.
  - Digests (ART-11 D18 proposal, unapproved) are not adopted.
- **Errors and recovery:**
  - Transient failure → Retry pending with backoff; retry count and backoff `[Proposed retry; values unresolved, no DEC ID]`. Each retry repeats the re-check.
  - Retries exhausted or permanent failure (invalid address, rejected) → Failed.
  - Bounce reported after Sent (only if the provider supports it; Phase 3) → Failed.
  - Failed or suppressed → "Notification-delivery failure" `[Confirmed event: ART-01 §16]` visible to the Owner `[Proposed: D6, R-09]` (recipient Proposed; channel unresolved). Loop guard: the failure of a failure notification does not raise another one `[Agent 3 proposal]`.
  - **No delivery outcome erases, blocks or changes a follow-up or meeting** `[Confirmed: D5, ART-01 §10; D6]`.
- **Authorization:** System only. No user edits delivery history (G3). Owner can view delivery failures (D6).
- **Visibility/assignment:** Access re-check at send (C6, referencing C5). Recipients are re-evaluated at send time, not only at scheduling.
- **Data changes:** Reminder instance (SM-REMINDER-001): source type and id, source version, recipient, channel, business event time, trigger time, state, attempt count, last error, sent at. Notification delivery record (no state model): event, recipient, channel, result, attempts.
- **Audit events:** Reminders: `reminder.scheduled`, `reminder.sent`, `reminder.retry_scheduled`, `reminder.failed`, `reminder.suppressed`, `reminder.cancelled`. Notifications: `notification.sent`, `notification.failed`, `notification.suppressed`.
- **Notification events:** Notification-delivery failure → Owner (D6).
- **Postconditions:** Every reminder instance ends Sent, Failed, Suppressed or Cancelled; every failed or suppressed delivery is visible to the Owner (D6); source records are untouched by delivery results.
- **Decision dependencies:** Notification timing, recipients, in-app presentation and escalation (no DEC ID); retry policy (no DEC ID); C6, D5, D6, R-08; DEC-001/DEC-002 through WF-ACCESS-001; DEC-007/DEC-022 for attendance-alert timing (Batch 1).

#### 2.5.1 ART-01 §16 events — event → recipient → channel

All timing is `[Unresolved: no DEC ID — notification timing, recipients and escalation]`. Recipients marked Proposed are drafting defaults only. "Family" follows R-08.

| Event (ART-01 §16) | Family (R-08) | Source workflow | Business event time | Recipient | Channel | Status |
|---|---|---|---|---|---|---|
| Follow-up due | Reminder (SM-REMINDER-001) | WF-FOLLOW-001 | Follow-up scheduled time | Responsible user (Proposed) | Email reminder `[Confirmed: §10]`; in-app unresolved | Lead time unresolved |
| Follow-up overdue | Reminder (SM-REMINDER-001) | WF-FOLLOW-001 | Scheduled time + overdue threshold (unresolved) | Responsible user (Proposed); Owner unresolved | Email (Proposed); in-app unresolved | Threshold and escalation unresolved |
| Upcoming meeting | Reminder (SM-REMINDER-001) | WF-DEAL-001 / SM-MEETING-001 (Agent 4) | Meeting time | Meeting attendees (Proposed); exact list unresolved | Email reminder (Proposed, SB-2 §5 "Reminder") | Lead time unresolved |
| Missing check-in | Notification | WF-ATT-003 Part 1 (Batch 1) | Detection time | Owner (Batch 1 diagram) | Unresolved | Threshold DEC-007/008/022 + no DEC ID |
| Missing checkout | Notification | WF-ATT-003 Part 1 (Batch 1) | Detection time | Unresolved (Batch 1: "recipients unresolved") | Unresolved | Unresolved |
| New assignment | Notification | WF-CALL-001 (only assignment writer, B8) | Assignment save | Assignee (Proposed) | Unresolved | Unresolved |
| Developer handoff | Notification | WF-CALL-003 / WF-DEAL-001 | Developer assignment save | Assigned developer (Proposed) | Unresolved | Unresolved |
| Data-correction request | Notification | WF-BIZ-002 (Agent 2) | Request submit | Unresolved (Data Entry and/or Owner) | Unresolved | Unresolved |
| Attendance correction awaiting review | Notification | WF-ATT-003 Part 2 Alt B (Batch 1) | Request submit | Owner (Batch 1) | Unresolved | Only exists if DEC-011 Alt B |
| Notification-delivery failure | Notification | WF-NOTIFY-001 (D6) | Failure or suppression time | Owner (Proposed; D6 requires Owner visibility) | Unresolved | Loop guard (Agent 3 proposal) |

### 2.6 WF-REJECT-001 — Do-not-call enforcement and controlled reopening

- **ID:** WF-REJECT-001.
- **Name:** Do-not-call enforcement and controlled reopening.
- **Purpose:** Make Rejected a clear do-not-call state excluded from normal calling, and allow reopening only under the authority DEC-016 selects, always recording reason and responsible user.
- **REQ range:** REQ-CALL-001..011.
- **UC IDs:** UC-CALL-005 (enforcement; marking is in WF-CALL-003), UC-CALL-006.
- **Actors:** Call Center agent, Owner, System. Reopening actor depends on DEC-016 (unselected; ART-11 D14 "Owner only" is an unapproved proposal).
- **Trigger:** A WF-CALL-003 save sets Rejected; any attempt to contact, schedule or assign a Rejected business; a user selects Reopen.
- **Preconditions:** Access check (WF-ACCESS-001). For reopening: current outcome is Rejected. The Owner is also bound by do-not-call (R-01, resource state).
- **Main path (enforcement):**
  1. Rejected is saved in WF-CALL-003 (with the proposed reason field).
  2. System shows a clear do-not-call state wherever the business appears (queue "Rejected: do not call" list, detail, search) `[Confirmed: ART-01 §9.5, §9.1]`.
  3. Guards:
     - Start Contact blocked (WF-CALL-002 acquire guard);
     - new or rescheduled follow-ups blocked (WF-FOLLOW-001);
     - excluded from assignment, reassignment and automatic allocation (B1, WF-CALL-001);
     - excluded from WF-WORK-001 manual work items ("not rejected" check, Batch 1).
  4. Open follow-ups handled per D4 (policy-dependent).
  5. Data-correction requests stay available from the business workspace → [[WF-BIZ-002]] `[Confirmed: ART-01 §14]`.
  6. Duplicate detection still matches the record (C3; Agent 2).
- **Main path (reopening, UC-CALL-006):**
  1. User selects Reopen on a Rejected business.
  2. Access check (WF-ACCESS-001); denied → Permission denied.
  3. Authority check per DEC-016 (unselected) — drawn as policy-dependent.
  4. User enters a reason. Reason and responsible user are always recorded `[Confirmed: ART-01 §9.5]`.
  5. System sets the outcome to the post-reopening value defined by DEC-016 (unselected; ART-11 D14 proposes Pending, unapproved).
  6. Single save: reopening record (by, at, reason, previous outcome, new outcome); all call attempts and history kept; assignment unchanged `[Agent 3 proposal]`.
  7. Audit `call_outcome.reopened`.
  8. Business re-enters calling via WF-CALL-001 (queue buckets if assigned; otherwise Owner assigns).
- **Alternate paths:**
  - User without reopening authority: Permission denied. If DEC-016 adopts a request-and-approve model, a request flow is needed that no current ID covers (B3-Q09).
  - Rejected by mistake: same reopening path (no separate "undo") `[Agent 3 proposal]`.
  - Do-not-call instruction received outside a call (for example by email): `[Unresolved: no DEC ID — B3-Q10]` whether it is recorded as a call attempt via WF-CALL-003 or by a direct Owner outcome change.
- **Errors and recovery:** Permission denied; missing reason → user adds it; save conflict (outcome already changed) → reload; save failed → stays Rejected; retry.
- **Authorization:** Marking Rejected: Call Center and Owner (call logging, Confirmed). Reopening: DEC-016 `[Unresolved]`.
- **Visibility/assignment:** Access check (WF-ACCESS-001). How long a Rejected business stays visible is DEC-001/DEC-002 territory, not defined here.
- **Data changes:** Current outcome; reopening record. No call history is deleted or edited.
- **Audit events:** `call_outcome.changed` (to Rejected, from WF-CALL-003), `call_outcome.reopened`. Blocked contact attempts on Rejected businesses: operational log `[Agent 3 proposal]`.
- **Notification events:** None required. Informing the assignee of a reopening: unresolved.
- **Postconditions:** A Rejected business never returns to normal calling without a recorded reopening (reason, responsible user, time).
- **Decision dependencies:** DEC-016; D4; B1; DEC-001/DEC-002 via WF-ACCESS-001; out-of-call do-not-call (no DEC ID).

---

## 3. State models — transition tables

Columns follow SB-2 §7. "—" = none. Audit names are proposed (G2).

### 3.1 SM-ASSIGNMENT-001 — Calling assignment

- **States:** Unassigned, Assigned (to exactly one Call Center agent).
- **Not states:**
  - "New assignment", queue buckets, "assigned to inactive agent" — derived classifications.
  - `NEW_LEAD` — derived view "unassigned + pending" (C-02).
  - Calling outcome, reservation and commercial stage — separate dimensions.
- **Events vs actions:** Assign, Reassign, Unassign are events; history-row creation and notifications are side effects.

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Business created | System (WF-BIZ-001, Agent 2) | Business saved | Unassigned | — | (Agent 2 business event) | — | C-02 |
| Unassigned | Assign (manual, or WF-WORK-001 hand-off, B8) | Owner | 2FA complete; Access check; B1, B2 (Proposed), B4 (C-01), B6 (DEC-017); assignee per B3 | Assigned | Assignment row (source manual / work list); New-assignment notification | `calling_assignment.assigned` | Stays Unassigned; per-item reason shown | DEC-017, C-01, phone (no DEC ID) |
| Unassigned | Automatic allocation accepted | Owner reviews system proposal | Same guards; adopted rule | Assigned | As above; source = automatic | `calling_assignment.assigned` | Stays Unassigned; shortfall shown (WF-WORK-001) | DEC-021 |
| Assigned | Reassign | Owner | New agent ≠ current, per B3; no Active reservation, or it was Overridden; follow-up choice made; reason (Agent 3 proposal) | Assigned (new agent) | Old row ended, new row created; follow-ups transferred/cancelled (or kept, needs a guard exception, RV3-09); D2 marker if last follow-up of a Needs-another-call business is cancelled; notify new assignee | `calling_assignment.reassigned` | Unchanged; conflict or error shown | DEC-004, follow-up handling (no DEC ID), DEC-001/002 via WF-ACCESS-001 |
| Assigned | Unassign (Agent 3 proposal) | Owner | Same reservation and follow-up resolution | Unassigned | Row ended; follow-up choice applied | `calling_assignment.unassigned` | Unchanged | No DEC ID |
| Assigned | B7 Owner decision: keep as is | Owner | Business is "assigned but inaccessible" (derived, B7) | Assigned (unchanged) | B7 item closed | `calling_assignment.retained` (Agent 3 proposal) | Unchanged | B7; DEC-001/002 via WF-ACCESS-001 |
| Unassigned / Assigned | Business archived or deleted | Owner | C-01 | Policy-dependent | — | — | — | C-01 |

**Documented non-transitions:** assignee deactivated (stays Assigned; derived flag; no automatic reassignment); **assignee loses access (B7): stays Assigned; "assigned but inaccessible" item for the Owner; no automatic reassignment** (Owner may reassign, unassign or keep via WF-CALL-001); outcome becomes Rejected or Accepted (stays Assigned, Agent 3 proposal); reservation acquired/released (no effect); 15-day hiding (no effect on stored assignment; access per WF-ACCESS-001).

### 3.2 SM-RESERVATION-001 — Contact reservation

- **Scope:** one reservation **instance**. A new acquire after an end creates a new instance. "No reservation" is the absence of an Active instance, not a state.
- **States:** Active; terminal: Released, Expired, Overridden (Proposed).
- **Not states:** collision (a refused acquire), network loss (a cause of expiry), stale client (a client-side condition), "reserved by you" (UI view of Active), renewal (a self-transition).

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Acquire | Assigned agent or Owner | Access check; not Rejected; not archived (C-01); no Active instance for the business | Active | Lease expiry set | `contact_reservation.acquired` | No instance; retry | DEC-004 |
| (start) | Acquire while another user holds Active | Assigned agent or Owner | — | No transition (no instance) | "Contact reserved by another agent" shown | Operational log `contact_reservation.acquire_conflicted` | — | DEC-004 |
| Active | Acquire by the same holder (second tab/device) | Holder | Holder matches (Agent 3 proposal) | Active | Existing instance returned | — | — | DEC-004 |
| Active | Renew | Holder's client | Holder matches; not elapsed; within any maximum (DEC-004); **Access check passes (B7)** | Active | Expiry extended | Operational log `contact_reservation.renewed` | Transient failure: stays Active until expiry, client retries. Access denied: renewal refused, Expired at lease end, B7 item if holder is the assignee | DEC-004; B7 |
| Active | Release after successful call save | System on holder's behalf | WF-CALL-003 save committed | Released | — | `contact_reservation.released` | No response: Expired at lease end; call data already saved, no stale-client path | DEC-004 |
| Active | Release without saving (cancel) | Holder | Unsaved-notes warning answered | Released | Draft kept locally if chosen (Agent 3 proposal) | `contact_reservation.released` | Lease expires later | DEC-004 |
| Active | Lease elapsed without renewal (idle, network loss, revoked session) | System | Expiry reached per DEC-004 idle rule | Expired | Holder sees "expired" at next sync; notes remain on client | `contact_reservation.expired` | — | DEC-004 |
| Active | Override | Owner | 2FA complete; reason (Agent 3 proposal) | Overridden | Holder informed; Owner may acquire or reassign | `contact_reservation.overridden` | Stays Active | Override rules (ART-01 §9.2, no DEC ID) |
| Active | Tab switch / window blur | — | — | No transition | — | — | — | DEC-004 idle rule |
| Released / Expired / Overridden | Late save or renewal from holder's client | Former holder | — | No transition | Stale-client path (WF-CALL-002) | — | Policy-dependent (B3-Q05) | No DEC ID |

### 3.3 SM-FOLLOWUP-001 — Follow-up commitment

- **States:** Scheduled; terminal: Completed, Cancelled.
- **Derived (not states):** Upcoming, Due today, Overdue, "responsible user inactive".
- **Not a follow-up state:** the D2 "callback to be scheduled" marker (no follow-up exists yet; it is an attribute on the business/attempt).
- **Not events on this model:** reminder sent or failed (SM-REMINDER-001; D5).

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Schedule (in call save or standalone) | Agent or Owner | Access check; not Rejected; valid future time (Agent 3 proposal); responsible user active Call Center or Owner | Scheduled | Reminders planned (WF-NOTIFY-001); D2 marker cleared | `follow_up.scheduled` | Not created; form kept | Notification timing (no DEC ID); multiple open follow-ups (no DEC ID) |
| Scheduled | Reschedule | Responsible user, assignee or Owner | Not Rejected; valid new time; reason (Agent 3 proposal) | Scheduled | History row; old reminders Cancelled; new reminders planned | `follow_up.rescheduled` | Unchanged | Notification timing (no DEC ID) |
| Scheduled | Change responsible user (reassignment) | Owner | New user per B3 | Scheduled | History row; pending reminders Cancelled and new ones planned for the new user (WF-NOTIFY-001 change type "responsible user changed") | `follow_up.reassigned` | Unchanged | Follow-up handling on reassignment (no DEC ID) |
| Scheduled | Complete | Responsible user or Owner | Linked call attempt or completion note; Access check (B7) | Completed | Reminders Cancelled; if last open follow-up of a Needs-another-call business and no linked attempt: replacement follow-up or D2 marker in same save | `follow_up.completed` (+ `callback_marker.set`) | Unchanged | D2 |
| Scheduled | Cancel | Responsible user or Owner | Reason; Access check (B7) | Cancelled | Reminders Cancelled; if last open follow-up of a Needs-another-call business: replacement follow-up or D2 marker in same save | `follow_up.cancelled` (+ `callback_marker.set`) | Unchanged | D2 |
| Scheduled | Outcome set to Rejected or Accepted | Per D4 policy | D4 adopted | Policy-dependent: Cancelled or Scheduled | Reminders Cancelled if Cancelled | `follow_up.cancelled` (if cancelled) | Unchanged (whole call save fails) | D4 (no DEC ID) |
| Scheduled | Time passes | — | — | No transition (Overdue is derived) | Overdue reminder may fire | — | — | Overdue threshold (no DEC ID) |
| Scheduled | Reminder failed or suppressed | — | — | No transition | Failure visible to Owner (D6) | — | — | D5, D6 |

### 3.4 SM-REMINDER-001 — Reminder delivery

- **Scope (R-08, Proposed):** email reminders for **follow-ups and meetings** only; one reminder instance = one recipient, one trigger time, one source version. Other ART-01 §16 alerts are notifications dispatched by WF-NOTIFY-001 without a state model (events `notification.*`).
- **States:** Scheduled, Retry pending (Proposed); terminal: Sent, Failed, Suppressed, Cancelled.
- **Not states:** "sending" (a transient action), "late" (a derived condition of a job run after the business event time), "due/overdue" (follow-up classifications).
- **Independence:** no transition here changes a follow-up or meeting (D5).

| Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Source event committed | System | Source saved; recipients/timing per policy | Scheduled | — | `reminder.scheduled` | Scheduling failure flagged and retried; source unaffected (Agent 3 proposal) | Notification timing (no DEC ID) |
| Scheduled | Trigger reached; re-check passes; provider accepts | System | Source version matches; account active; Access check passes (C6) | Sent | — | `reminder.sent` | See failure rows | C6 |
| Scheduled | Trigger reached; source changed or closed (stale job) | System | Version mismatch | Cancelled | — | `reminder.cancelled` | — | — |
| Scheduled | Source rescheduled, completed, cancelled, or responsible user changed | System | — | Cancelled | Replacement planned on reschedule or recipient change | `reminder.cancelled` | — | — |
| Scheduled | Trigger reached after business event time | System | Late-run policy | Policy-dependent: Sent (labelled late) or Cancelled (skipped) | — | `reminder.sent` / `reminder.cancelled` | — | B3-Q08 (no DEC ID) |
| Scheduled | Re-check fails (recipient inactive or no access) | System | C6 | Suppressed | Visible to Owner as delivery-failure notification (D6) | `reminder.suppressed` | — | C6; DEC-001/002 via WF-ACCESS-001 |
| Scheduled | Transient send failure | System | Retries left (Proposed) | Retry pending | Backoff scheduled | `reminder.retry_scheduled` | — | Retry policy (no DEC ID) |
| Scheduled | Permanent send failure | System | — | Failed | Delivery-failure notification to Owner (D6) | `reminder.failed` | — | Recipients (no DEC ID) |
| Retry pending | Retry: re-check passes; provider accepts | System | As for Sent | Sent | — | `reminder.sent` | — | C6 |
| Retry pending | Transient failure, retries left | System | — | Retry pending | Next backoff | `reminder.retry_scheduled` | — | Retry policy |
| Retry pending | Retries exhausted or permanent failure | System | — | Failed | Delivery-failure notification to Owner (D6; loop guard) | `reminder.failed` | — | Recipients (no DEC ID) |
| Retry pending | Re-check fails | System | C6 | Suppressed | Visible to Owner (D6) | `reminder.suppressed` | — | C6 |
| Retry pending | Source changed or closed | System | — | Cancelled | — | `reminder.cancelled` | — | — |
| Sent | Bounce reported (if provider supports; Phase 3) | System | — | Failed | Delivery-failure notification to Owner (D6) | `reminder.failed` | — | Phase 3 |

---

## 4. Derived classifications used in Batch 3 (blue, "(derived)")

| Classification | Derived from | Used in |
|---|---|---|
| New assignment | Assigned + no call attempt since current assignment | Queue |
| Requires contact | Outcome Pending or On hold + no open follow-up (Agent 3 proposal) | Queue |
| Callback to be scheduled | D2 marker set and outcome not Rejected (B1) | Queue, Owner overview |
| Callback due today | Scheduled follow-up whose time is today (company timezone) | Queue, dashboard, calendar |
| Overdue follow-up | Scheduled follow-up past its time (+ threshold, unresolved) | Queue, dashboard, reminders |
| Data correction requested | Open data-correction request (B5) | Queue flag |
| Do not call | Outcome Rejected | Everywhere the business appears |
| Developer not yet assigned | Accepted opportunity without developer (E3) | Owner overview (WF-DEAL-001) |
| Assigned to inactive agent / responsible user inactive | Assignment or follow-up + account state | Owner overview |
| Assigned but inaccessible (B7, R-02) | Current assignee fails the Access check (WF-ACCESS-001) on a calling action or queue load | Owner queue overview; Owner decision via WF-CALL-001 (no automatic reassignment) |
| Unassigned + pending (Board 01 "NEW_LEAD") | Assignment state + outcome | Owner views (C-02) |
| Reminder late | Job run time > business event time | WF-NOTIFY-001 |

---

## 5. Acceptance scenarios (Given / When / Then)

**Intended behaviour, not tested.** No software exists; none of this has been tested.

### WF-CALL-001
1. Given an unassigned business with outcome Pending, a phone number and no open deal, when the Owner (2FA complete) assigns it to an active Call Center agent, then one assignment row exists, the outcome stays Pending, `calling_assignment.assigned` is recorded and the agent sees it under "New assignments".
2. Given a business whose outcome is Rejected, when the Owner tries to assign it, then it is excluded with the reason "do not call" and no assignment row is created.
3. Given an assigned business with an Active reservation held by agent A, when the Owner reassigns it to agent B, then the system shows the reservation and offers "Wait" or "Override"; choosing "Wait" saves nothing and agent A's reservation stays Active.
4. Given an assigned business with two open follow-ups owned by agent A, when the Owner reassigns it to agent B, then the Owner must choose, per follow-up, transfer, keep or cancel; the previous assignment row is ended, not overwritten; and the follow-up history records the choice.
5. Given a Data Entry user, when they attempt to assign a business, then permission is denied and nothing changes.
6. Given an agent who has not checked in today, when they open the calling queue, then the queue loads normally (attendance gating not adopted, A1).
7. Given an assigned business whose assignee now fails the Access check (B7), when the agent opens the queue, then the business is not shown to the agent, the Owner sees it as "assigned but inaccessible", and the assignment is unchanged until the Owner reassigns, unassigns or keeps it through WF-CALL-001.
8. Given a WF-WORK-001 work list that selects an unassigned business for a Call Center agent, then the assignment is created by WF-CALL-001 with source "work list", after the same eligibility checks (B8).

### WF-CALL-002
1. Given an assigned, non-Rejected business with no Active reservation, when its agent selects Start Contact, then exactly one Active reservation exists for that agent and the workspace shows "reserved by you".
2. Given an Active reservation held by agent A, when the Owner selects Start Contact on the same business, then no second reservation is created and "Contact reserved by another agent" is shown with agent A and the start time.
3. Given an Active reservation and an open workspace, when the agent switches to another browser tab for a few minutes, then the reservation is not released by the tab switch (expiry follows only the DEC-004 lease/idle rule).
4. Given an Active reservation, when the client loses network connectivity until the lease elapses, then the reservation becomes Expired, the business becomes available, and on reconnect the agent's unsaved notes are still in the form.
5. Given an Active reservation held by agent A, when the Owner overrides it with a reason, then the reservation becomes Overridden, `contact_reservation.overridden` is recorded with the Owner and reason, and agent A's next save reports "reservation no longer held".
6. Given an agent with unsaved notes, when they select Cancel contact, then they are warned before the notes are discarded, and no call attempt is logged.

### WF-CALL-003
1. Given an agent holding the reservation on a Pending business, when they log an attempt with outcome Accepted on the first conversation, then one call attempt row exists, the current outcome is Accepted, one deal record in stage "Accepted opportunity" (not a closed deal) exists (E5), and the reservation is released after the save.
2. Given an agent logging "Needs another call", when they neither enter a follow-up nor choose "callback to be scheduled", then the save is refused; when they choose "callback to be scheduled", then the marker is saved and the business appears under "Callback to be scheduled".
3. Given a save that fails on the server, when the agent logs any outcome, then no attempt row, outcome change or follow-up is stored, the form keeps the entered data and the reservation stays Active.
4. Given an On hold business, when the agent logs a second "no answer" attempt, then a second attempt row exists, the current outcome stays On hold, and the two attempts remain separately visible in history.
5. Given an agent logging Accepted and choosing to defer developer assignment, then one deal record in stage "Accepted opportunity" exists (E5), it shows "developer not yet assigned" to the Owner, and `accepted_opportunity.created` is emitted once for WF-DEAL-001.
6. Given the business was reassigned by the Owner after the workspace loaded and the reservation was overridden, when the agent saves, then nothing is overwritten and the stale-client path applies.
7. Given a Needs-another-call business with a "callback to be scheduled" marker, when the agent logs Rejected, then the marker is cleared in the same save and the business no longer appears in the callback bucket (B1).
8. Given a business whose current outcome is Accepted, when an agent tries to log a different outcome, then the result follows the rule selected for B3-Q12; no behaviour is assumed while it is unselected.

### WF-FOLLOW-001
1. Given a Scheduled follow-up, when the agent reschedules it with a reason, then it stays Scheduled at the new time, a history row holds the old and new time, old reminders are Cancelled and new reminders are Scheduled.
2. Given a Scheduled follow-up whose time passed an hour ago, when the agent opens the queue, then it appears under "Overdue follow-ups" and its stored state is still Scheduled.
3. Given a follow-up whose email reminder Failed, when anyone views the follow-up, then it still exists unchanged as Scheduled (D5).
4. Given a Rejected business, when the agent tries to schedule a follow-up, then it is blocked with the do-not-call message.
5. Given a due follow-up, when the agent logs a call attempt linked to it, then the follow-up becomes Completed with the linked attempt, and pending reminders are Cancelled.
6. Given a Needs-another-call business whose only open follow-up is cancelled, then in the same save either a replacement follow-up is created or the "callback to be scheduled" marker is set (D2); the business stays in a queue bucket.
7. Given a follow-up transferred to agent B during reassignment, then agent A's pending reminders are Cancelled and new reminders are Scheduled for agent B.

### WF-NOTIFY-001
1. Given a follow-up reminder Scheduled for agent A, when agent A's account is deactivated before the trigger time, then at send time the reminder becomes Suppressed, no email is sent and the follow-up is unchanged.
2. Given a reminder whose follow-up was rescheduled after the reminder was created, when the old job runs, then it is Cancelled as stale and only the reminder for the new time is sent.
3. Given a transient email failure, when retries remain, then the reminder enters Retry pending and re-checks recipient account and access before the next attempt.
4. Given retries are exhausted, then the reminder is Failed and one notification-delivery failure alert is raised for the Owner; if that alert also fails, no further alert is generated.
5. Given a follow-up saved for five minutes from now with a lead time longer than five minutes, then the reminder follows the selected short-notice rule (B3-Q08); no behaviour is assumed while it is unselected.

### WF-REJECT-001
1. Given a Rejected business, when its agent selects Start Contact, then no reservation is created and the do-not-call message is shown.
2. Given a Rejected business, when a user with reopening authority under DEC-016 reopens it with a reason, then the outcome changes to the DEC-016 post-reopening value, a reopening record holds the reason, user and time, and all previous call attempts remain.
3. Given a user without reopening authority, when they select Reopen, then permission is denied and the business stays Rejected.
4. Given a reopening attempt with an empty reason, then the save is refused.
5. Given a Rejected business, when a Call Center agent opens it, then they can still submit a data-correction request (WF-BIZ-002).

---

## 6. Audit events and countable metrics (G2)

Names are **Proposed** until approved. Format `<entity>.<past_tense_verb>`.

| Event (proposed name) | Entity | Actor | Counted in report? | Source workflow |
|---|---|---|---|---|
| `calling_assignment.assigned` | Calling assignment | Owner (manual or accepted automatic proposal) | Yes — assignments per agent/period | WF-CALL-001 |
| `calling_assignment.reassigned` | Calling assignment | Owner | Yes — reassignments (assignment changes, ART-01 §17) | WF-CALL-001 |
| `calling_assignment.unassigned` | Calling assignment | Owner | No (audit only) | WF-CALL-001 (Agent 3 proposal) |
| `calling_assignment.retained` | Calling assignment | Owner (B7 "keep as is" decision) | No (audit only) | WF-CALL-001 (Agent 3 proposal) |
| `contact_reservation.acquired` | Contact reservation | Call Center agent / Owner | No (audit only) | WF-CALL-002 |
| `contact_reservation.released` | Contact reservation | Holder / System | No (audit only) | WF-CALL-002, WF-CALL-003 |
| `contact_reservation.expired` | Contact reservation | System | No (audit only; could feed an operational metric later) | WF-CALL-002 |
| `contact_reservation.overridden` | Contact reservation | Owner | No (audit; ART-01 §17 "Reservation overrides") | WF-CALL-002 |
| `contact_reservation.acquire_conflicted` | Contact reservation | Call Center agent / Owner | No (operational log, not audit — Agent 3 proposal) | WF-CALL-002 |
| `contact_reservation.renewed` | Contact reservation | Holder's client | No (operational log, not audit — Agent 3 proposal) | WF-CALL-002 |
| `call_attempt.logged` | Call attempt | Call Center agent / Owner | Yes — **call attempts**; also basis of **distinct businesses contacted** (count distinct business, G1) | WF-CALL-003 |
| `call_outcome.changed` | Business (calling outcome) | Call Center agent / Owner | Yes — outcome transitions (flow); current counts of Pending/On hold/Needs another call/Rejected/Accepted are snapshots of current outcome, not event counts | WF-CALL-003 |
| `call_outcome.reopened` | Business (calling outcome) | Per DEC-016 | Yes — reopened businesses | WF-REJECT-001 |
| `callback_marker.set` | Business (D2 marker) | Call Center agent / Owner | Yes — callbacks awaiting scheduling (snapshot) | WF-CALL-003 |
| `callback_marker.cleared` | Business (D2 marker) | Call Center agent / Owner / System | No (audit only) | WF-CALL-003, WF-FOLLOW-001 |
| `accepted_opportunity.created` | Deal record (initial stage "Accepted opportunity", E5) | Call Center agent / Owner | Yes — **accepted opportunities**, counted once here (never counted as closed deals, G1) | WF-CALL-003 (emitted by Batch 3; consumed, not re-counted, by Batch 4 WF-DEAL-001; E5, R-05) |
| `follow_up.scheduled` | Follow-up | Call Center agent / Owner | Yes — follow-ups scheduled | WF-CALL-003, WF-FOLLOW-001 |
| `follow_up.rescheduled` | Follow-up | Call Center agent / Owner | Yes — reschedules | WF-FOLLOW-001 |
| `follow_up.reassigned` | Follow-up | Owner | No (audit only) | WF-CALL-001, WF-FOLLOW-001 |
| `follow_up.completed` | Follow-up | Call Center agent / Owner | Yes — follow-ups completed (on time vs late is derived) | WF-CALL-003, WF-FOLLOW-001 |
| `follow_up.cancelled` | Follow-up | Call Center agent / Owner / System (D4) | Yes — follow-ups cancelled | WF-FOLLOW-001, WF-CALL-001, WF-CALL-003 |
| `reminder.scheduled` | Reminder | System | No (audit only) | WF-NOTIFY-001 |
| `reminder.sent` | Reminder | System | Yes — reminders sent (operational) | WF-NOTIFY-001 |
| `reminder.retry_scheduled` | Reminder | System | No (audit only) | WF-NOTIFY-001 |
| `reminder.failed` | Reminder | System | Yes — reminder delivery failures (D6) | WF-NOTIFY-001 |
| `reminder.suppressed` | Reminder | System | Yes — suppressed reminders (Owner attention) | WF-NOTIFY-001 |
| `reminder.cancelled` | Reminder | System | No (audit only) | WF-NOTIFY-001 |
| `notification.sent` | Notification (non-reminder §16 alert, R-08) | System | Yes — notifications sent (operational; never mixed with reminder counts) | WF-NOTIFY-001 |
| `notification.failed` | Notification | System | Yes — notification-delivery failures (D6) | WF-NOTIFY-001 |
| `notification.suppressed` | Notification | System | Yes — suppressed notifications (D6, Owner attention) | WF-NOTIFY-001 |

**Metric rules (G1 applied to Batch 3):**
- Call attempts (count of `call_attempt.logged`) and businesses contacted (distinct businesses with at least one attempt in the period) are always reported separately.
- Accepted opportunities are never reported as closed deals.
- Dashboard business counts by outcome (ART-01 §15 "Pending businesses", "On-hold businesses", "Callback requests", "Rejected businesses") are snapshots of the current outcome, distinct from period counts of `call_outcome.changed`. **Exception (integration fix B-1, G1):** the "Accepted opportunities" tile is NOT an outcome snapshot (the outcome stays Accepted after closure); it counts deal records currently in commercial stage "Accepted opportunity", as defined in Batch 4 WF-REPORT-001.
- "Callback requests" (ART-01 §15) is ambiguous: businesses currently "Needs another call", or follow-ups scheduled in the period. See B3-Q11.
- Target progress counts actions by their own timestamp in company time (A2, DEC-020).
- Overdue and due-today counts are derived at query time; no event is emitted when time passes.
