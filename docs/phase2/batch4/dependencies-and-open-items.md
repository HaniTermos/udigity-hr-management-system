# Phase 2 Batch 4 — Dependencies, open items and baseline change requests

Author: Agent 4. Baseline SB-2 (rulings R-01..R-13 supersede BCR-01/04/05/07/08: R-13, R-04, R-05, R-06, R-09). Status: **DRAFT, repaired after review (see `repair-log.md`).** Companion to `batch4-spec.md` and `batch4-mermaid.md`. Nothing has been drawn. No DEC meaning is changed; no new DEC, WF, SM, UC, REQ or SCR IDs are created. Questions without a DEC ID are numbered locally as OQ-xx (local labels only, like D-numbers in `decisions.md`).

## 1. Contracts relied on

| Contract | Status (SB-1) | How Batch 4 uses it | Note |
|---|---|---|---|
| A1 | Unresolved, no DEC ID | No Batch 4 action is gated on check-in | — |
| A2 | Unresolved, DEC-020 | Task/milestone completion counts by own timestamp, if adopted | — |
| B1 | Confirmed | Accepted can only arise on a non-Rejected business | — |
| B6 | Unresolved, DEC-017 | Re-queue after "not proceeding" left open | — |
| C1 | Confirmed | Owner always passes access (deals, projects, reports, audit) | — |
| C2 | Confirmed | Every list/detail/calendar/notification/export calls the access check per user, per resource | Needs Batch 4 resource types in Agent 2's model — BCR-07 |
| C3 | Confirmed | Not used directly | — |
| C4 | Unresolved | DEC-002 rows (accepted opportunity, closed deal, active/completed project) and DEC-005 drive Batch 4 visibility | — |
| C5 | Contract | Referenced as "Access check (WF-ACCESS-001)"; never redefined | — |
| C6 | Proposed | Meeting reminders and reminders to deactivated users re-checked at send time | — |
| D5 | Confirmed (follow-ups) | Applied **by analogy** to meeting reminders (Proposed) | Extension requested — BCR-08 |
| E1 | Confirmed | Accepted creates a deal record at Accepted opportunity, never a closed deal | — |
| E2 | Confirmed | Call Center or Owner assigns the Developer | — |
| E3 | Proposed | "Developer not yet assigned" derived condition, visible to Owner | — |
| E4 | Unresolved | DEC-005 and DEC-017 drawn as branches | — |
| F1 | Confirmed | Project board exists for relevant delivery engagements | Tension T-5 |
| F2 | Unresolved | Provisioning drawn as Alt Auto / Alt Manual | Failure handling proposed — BCR-08 |
| G1 | Confirmed | Separate metrics table in WF-REPORT-001 | — |
| G2 | Contract | Audit/metrics table in spec §5 | Naming clarification — BCR-06 |
| G3 | Confirmed | Audit explorer has no edit/delete; modification attempts refused | — |

## 2. Interfaces with other batches (need confirmation before integration)

| Other batch / workflow | Interface | Batch 4 assumption | Status |
|---|---|---|---|
| Agent 3 — WF-CALL-003 | Accepted outcome → deal record | Same save creates the deal record; WF-CALL-003 ends at the hand-off `[[WF-DEAL-001]]` (UC-CALL-007 split: outcome in WF-CALL-003, handoff/assignment in WF-DEAL-001) | Proposed — BCR-05 |
| Agent 3 — WF-NOTIFY-001 | Events emitted: developer handoff, upcoming meeting (schedule/reschedule/cancel), new assignment (project), closure verification review item (DEC-006 Alt B), provisioning failure, export ready (async only) | WF-NOTIFY-001 owns timing, retries, failure, send-time re-check | Needs Agent 3 to list these events |
| Agent 3 — SM-REMINDER-001 | Meeting reminders | Reminder lifecycle independent of meeting state | Needs confirmation |
| Agent 3 — WF-CALL-001 / WF-FOLLOW-001 / WF-CALL-002 | Owner handles a deactivated agent's assignments, follow-ups, reservation | No automatic reassignment; items flagged "assignee inactive" | Needs confirmation that these workflows accept an inactive current assignee |
| Agent 2 — WF-ACCESS-001 / SM-VISIBILITY-001 | Access check on deal record, meeting/calendar entry, project, task, export rows; DEC-005 Alt 1 scoping access; DEC-002 rows for deals/projects | Agent 2 defines the evaluation; Batch 4 shows only Authorized/Denied | BCR-07 |
| Agent 1 — WF-ATT-001 | Owner in Pending 2FA attempting check-in | **R-11 → USER**: R11-a no access until 2FA / R11-b non-administrative actions such as check-in allowed. Neither selected | R-11, tension T-3 |
| Agent 1 — WF-ATT-003 | Deactivated employee with an open attendance session | Owner resolves via WF-ATT-003; no automatic close | Needs Agent 1 acknowledgement |

## 3. Decisions affecting Batch 4 diagrams

None of these blocks drawing: each is drawn as a labelled branch or a "policy-dependent" marker. They block **approval** of the affected paths.

| Decision | Where | How drawn |
|---|---|---|
| DEC-005 Developer pre-closure access | WF-DEAL-001 P1/P2, WF-DEAL-002 P1, SM-COMMERCIAL-001, SM-MEETING-001 | Orange "Alt 1 / Alt 2" (Board alternatives) |
| DEC-006 Closure authority | WF-DEAL-002 P2, SM-COMMERCIAL-001 | Orange "Alt A / Alt B" — **taken from ART-01 §12 wording**, not from Board alternatives (Board shows none for DEC-006) |
| DEC-017 Multiple deals per business | WF-DEAL-001 P1, provisioning cardinality | Yellow decision "Multiple allowed / Single only" |
| DEC-018 Financial fields & evidence (deposit, money, attachments) | WF-DEAL-002 P1 | Yellow; attachments explicitly not required |
| DEC-019 Service delivery statuses | WF-PROJ-001, SM-PROJECT-001 | All statuses labelled Proposed |
| DEC-002 Active-work visibility exceptions | Inside WF-ACCESS-001 (referenced) | Not drawn in Batch 4 |
| DEC-020 Target metrics | WF-PROJ-001 P2 | Yellow "if adopted" |
| DEC-007, 008, 022 | WF-REPORT-001 P1 | Yellow "policy pending, not zero" |
| F2 provisioning trigger | WF-DEAL-002 P2, SM-PROJECT-001 | Orange "Alt Auto / Alt Manual" |
| Commercial-stage transition rules (no DEC ID) | SM-COMMERCIAL-001, WF-DEAL-002 | Whole model labelled Proposed |
| Implementation decisions (2FA method, recovery method, session durations, thresholds, async export) | WF-AUTH-001/002, WF-REPORT-001 | Abstract steps labelled "implementation decision" / "Phase 3 choice" |

**Logistical blockers to drawing (not content):**
1. Batch 4 drawing is not authorized.
2. Board 02 sections 01, 08, 09, 10 do not exist and have no lease.
3. Section 11 (state machines) has a single writer (Agent 1). Batch 4 state models need a location — suggest the Batch 2 pattern (a "Batch 4 state models" sub-area inside a Batch 4 section).

## 4. Open questions (no DEC ID)

| OQ | Question | Proposed default used in the draft | Affects |
|---|---|---|---|
| OQ-01 | Which handoff fields are mandatory at acceptance? | None beyond business link and accepting agent | WF-DEAL-001 |
| OQ-02 | Under DEC-005 Alt 2, how does the Developer get meeting context (business, contact, needs) without access to the accepted opportunity? | Not defined; flagged | WF-DEAL-001, SM-MEETING-001 |
| OQ-03 | May Call Center record signature/payment or "not proceeding"? (ART-01 §2.3 "permitted calling and sales information") | Unresolved; drawn as "Call Center unresolved" | WF-DEAL-002 |
| OQ-04 | What happens to the calling outcome (still Accepted?) when a deal does not proceed? | Unchanged; open | WF-DEAL-002, Batch 3 |
| OQ-05 | Must signature precede payment? | Order-independent | SM-COMMERCIAL-001 |
| OQ-06 | May a Developer update a project/task not assigned to them? | Policy-dependent branch | WF-PROJ-001 |
| OQ-07 | One or several Developers per project? | Open | WF-PROJ-001 |
| OQ-08 | May Call Center (ART-01 §2.3 "deals") or a Developer (self) assign project Developers? | Owner only confirmed | WF-PROJ-001 |
| OQ-09 | Is a milestone a task attribute or a separate entity? | Phase 3 data choice | WF-PROJ-001 |
| OQ-10 | Do open tasks block Delivered/Completed? | Warn, do not block | WF-PROJ-001 |
| OQ-11 | Is a cancelled/abandoned project status needed? (ART-01 §13 lists none) | Not modelled | SM-PROJECT-001 |
| OQ-12 | What happens if the Owner's 2FA cannot be recovered (especially with a single Owner)? | Documented operational procedure; ties to "Recovery objectives" (SB-1 §3) | WF-AUTH-002 |
| OQ-13 | Which profile fields can an employee self-edit? | Photo and phone | WF-EMP-001 |
| OQ-14 | Can a deactivated account be reactivated? | Yes, Owner, without restoring assignments | WF-EMP-001, SM-ACCOUNT-001 |
| OQ-15 | Can a Closed deal, Not proceeding deal, or Completed project be reopened? | Not modelled | SM-COMMERCIAL-001, SM-PROJECT-001 |
| OQ-16 | What does exporting an empty result produce? | File with filter summary and zero rows | WF-REPORT-001 |
| OQ-17 | Period comparison of stock metrics (e.g. pending businesses last month) needs status history/snapshots — required? | "Comparison not available" where history is missing | WF-REPORT-001, Phase 3 data model |
| OQ-18 | Should audit-log viewing be audited, and can the audit log be exported? | Viewing optional; export not offered | WF-REPORT-002 |
| OQ-19 | Audit log retention period | Open (related to "Recovery objectives") | WF-REPORT-002 |

## 5. Readiness (for drawing, once authorized)

| Artifact | Readiness | Depends on |
|---|---|---|
| WF-DEAL-001 (2 parts) | Ready to draw with branches | BCR-05 (Agent 3 alignment), BCR-04 term; OQ-02 open under DEC-005 Alt 2 |
| WF-DEAL-002 (2 parts) | Ready to draw with branches | Orchestrator accepts the Proposed commercial-stage model (no DEC ID); BCR-08 (provisioning failure) |
| WF-PROJ-001 (2 parts) | Ready to draw | DEC-019 stays Proposed; OQ-06 drawn as branch |
| WF-AUTH-001 (2 parts) | Ready to draw | BCR-03 (restricted scope, role-change revocation) |
| WF-AUTH-002 (2 parts) | Ready to draw | — (methods abstracted) |
| WF-EMP-001 (3 parts) | Ready to draw | Batch 3 hand-off acknowledgements (§2) |
| WF-REPORT-001 (2 parts) | Ready to draw | — |
| WF-REPORT-002 | Ready to draw | — |
| SM-COMMERCIAL-001 | Ready to draw **as Proposed** | Commercial transitions have no DEC ID; OQ-03, OQ-05 |
| SM-MEETING-001 | Ready to draw | BCR-01 acknowledgement |
| SM-PROJECT-001 | Ready to draw (Proposed, DEC-019) | — |
| SM-TASK-001 | Ready to draw (Proposed, no source) | — |
| SM-ACCOUNT-001 | Ready to draw | OQ-14 (reactivation shown as Proposed) |
| SM-SESSION-001 | Ready to draw | BCR-03 |

All of the above are also blocked by the logistical items in §3 (authorization, sections, section-11 writer).

## 6. Baseline change requests (for the orchestrator; Agent 4 does not edit SB-1)

**BCR-01 — SM-MEETING-001 inventory note.** Inventory says "scheduled / rescheduled / held / cancelled each change what is allowed next". Batch 4 models *Rescheduled* as an **event** (self-transition with history), because it allows the same next events as Scheduled, and adds a Proposed *Missed* state (after the meeting time; can be rescheduled; differs from Cancelled). Request: update the note to "Scheduled / Held / Cancelled / Missed (proposed); reschedule is an event". No ID change.

**BCR-02 — Inventory DEC dependency columns.**
- WF-DEAL-001: add DEC-017 (open-deal check at acceptance).
- WF-DEAL-002: add DEC-005 (Developer recording pre-closure facts) and DEC-002 (closed-deal visibility).
- WF-PROJ-001: add DEC-002 (active/completed project rows) and DEC-020 (task/milestone counting).
- WF-REPORT-001: DEC-002 "export scope" applies only if exports are ever extended beyond the Owner (Confirmed Owner-only today); add DEC-007, DEC-008, DEC-019, DEC-020, DEC-022 as metric-definition dependencies.

**BCR-03 — New cross-batch rule (Auth → all modules), Proposed.**
- (a) **Superseded by SB-2 R-11 (→ USER).** Batch 4 no longer proposes a scope for the pending-2FA state; it shows both readings (R11-a / R11-b) and selects neither. Only "no administrative access before 2FA" is Confirmed.
- (b) A role change revokes the employee's sessions — at minimum a change **to** Owner, otherwise an existing session would hold admin rights without 2FA (contradicting the Confirmed rule).
- (c) Account status is re-checked on every request, so a deactivated account is refused even if a session revocation is delayed.

**BCR-04 — Terminology additions (SB-1 §5).**
- "Deal record": the single commercial record whose stage runs from Accepted opportunity to Closed deal or Not proceeding. Not to be confused with the business or the project.
- "Meeting": developer/client meeting tied to a deal record (SM-MEETING-001). Not to be confused with a follow-up (callback).
- "Not proceeding" (Proposed commercial stage). Not to be confused with the calling outcome Rejected.

**BCR-05 — Contract E5 (Proposed).** Finalizing Accepted in WF-CALL-003 and creating the deal record happen in **one save**: an Accepted business without a deal record never exists (mirrors D2). WF-CALL-003 ends at the `[[WF-DEAL-001]]` hand-off; WF-DEAL-001 owns handoff context and Developer assignment (UC-CALL-007 split). DEC-017 decides behaviour when an open deal record already exists.

**BCR-06 — G2 naming clarification.** Allow `<entity>.<qualifier>_<past_tense_verb>` (e.g. `opportunity.developer_assigned`, `deal.signature_recorded`), as Batch 1 already does (`attendance.checked_in`, `attendance.checkout_provisional`). Entities used here: opportunity, deal, meeting, project, task, milestone, session, login, account, password_reset, two_factor, report, audit_log. "Opportunity" and "deal" refer to the same deal record (BCR-04); the orchestrator may prefer one entity name (`deal.*`) for all.

**BCR-07 — Contract C2/C5 scope confirmation.** Confirm that WF-ACCESS-001 / SM-VISIBILITY-001 (Agent 2) cover the resource types deal record, meeting/calendar entry, project, task and export rows, and define DEC-005 Alt 1 "assigned scoping access" there. Batch 4 cannot draw a correct Denied path for Developers otherwise.

**BCR-08 — Contract extensions (Proposed).**
- D6: a meeting reminder failure never erases or blocks the meeting (extends D5).
- F3: commercial closure stays committed if automatic provisioning fails; a visible "project provisioning pending" condition is raised for the Owner.

## 7. Contract conflicts and tensions noticed

| ID | Tension | Sources | Suggested handling |
|---|---|---|---|
| T-1 | **DEC-005 Alt 2 vs Developer closure recording.** Board 01 tags "Deal closure recording/approval: Owner and Developer [Confirmed: REQ-PROJ-004]", and ART-01 §2.4 lets Developers update commercial status. Under Alt 2 (closed-deal-only) a Developer cannot open a deal record before closure, so cannot record signature, payment or closure. Alt 2 would effectively leave pre-closure recording to the Owner (or Call Center, OQ-03). | Board 01 `27:470`; ART-01 §2.4, §12; DEC-005 | **SB-2 R-12 → USER** (DEC-005 Alt 2 × DEC-006 decision interaction). Labelled "R-12 → USER" on WF-DEAL-002 errors/authorization, SM-COMMERCIAL-001 signature/payment/finalize rows, Mermaid #3 and #4. Not settled |
| T-2 | **Call Center assigning "deals".** ART-01 §2.3 says Call Center can "assign relevant opportunities or deals to Developers"; E2 covers the opportunity handoff only. Assignment of closed-deal projects by Call Center is undefined. | ART-01 §2.3; SB-1 E2 | OQ-08 |
| T-3 | **Pending-2FA scope vs Batch 1.** Batch 1 WF-ATT-001 precondition may imply an Owner can check in before 2FA. | Batch 1 §9; ART-01 §3 | R-11 → USER |
| T-4 | **WF-REPORT-001 DEC-002 dependency** in the inventory is moot while exports are Owner-only (Confirmed). | Inventory §2; Board 01 permissions | BCR-02 |
| T-5 | **F1 "relevant delivery engagements" vs F2 Alt Auto.** "Relevant" suggests not every closed deal needs a project; automatic provisioning at every verified closure would create one each time. | SB-1 F1/F2; ART-01 §13 | Decide with F2; Alt Manual or an "auto unless not applicable" option |
| T-6 | **Delivery-board update scope.** Board 01 "Developers and Owner view and update [Confirmed]" does not say whether updates are limited to assigned projects; ART-01 §13 only requires distinguishing assigned work. | Board 01; ART-01 §13 | OQ-06 |
| T-7 | **"Paid" definition split across DECs.** Deposit-counts sits under DEC-018 (per `decisions.md` mapping of D16 rows) while closure authority is DEC-006; ART-01 §12/§20 groups them as one "Deal closure" decision. | ART-01 §20; decisions.md mapping | Keep both DEC references on the payment and closure steps |

No conflict was found that requires changing a DEC meaning or adding an ID.
