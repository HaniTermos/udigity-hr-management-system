# Phase 2 Batch 3 — Dependencies, open items and baseline change requests (DRAFT)

- **Status:** DRAFT by Agent 3, re-based on **SB-2** (2026-10-20) after the independent review (RV3-01..11, see `repair-log.md`). Not approved. SB-2 rulings are orchestrator rulings with status Proposed; R-10, R-11 and R-12 remain **→ USER**.
- **Companion files:** `batch3-spec.md`, `batch3-mermaid.md` (same folder).
- **Local labels:** `B3-Q..`, `BCR-B3-..`, `T-..` are local to Batch 3 staging files. They are not shared IDs. No DEC, UC, WF, SM or REQ IDs were created.

## 1. Cross-batch contracts relied on

Y = relied on directly. (Y) = referenced or emitted for another batch.

| Contract | WF-CALL-001 | WF-CALL-002 | WF-CALL-003 | WF-FOLLOW-001 | WF-NOTIFY-001 | WF-REJECT-001 | SM-ASSIGN | SM-RESERV | SM-FOLLOW | SM-REMIND |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 no attendance gating (Unresolved) | Y | Y | Y | Y | | | | | | |
| A2 target counting by own timestamp (DEC-020) | | | (Y) | (Y) | | | | | | |
| B1 not Rejected (Confirmed) | Y | Y | Y | Y | | Y | Y | Y | Y | |
| B2 phone number (Proposed) | Y | | | | | | Y | | | |
| B3 active Call Center assignee; Owner may act (Confirmed) | Y | Y | | Y | | | Y | Y | Y | |
| B4 archived/deleted ineligible (Unresolved, C-01) | Y | Y | | | | | Y | Y | | |
| B5 open correction does not block (Proposed) | Y | | | | | Y | | | | |
| B6 open deal re-queue (Unresolved, DEC-017) | Y | | (Y) | | | | Y | | | |
| B7 every calling action runs Access check, assignee included; "assigned but inaccessible" for Owner; no automatic reassignment (Proposed, R-02) | Y | Y | Y | Y | | | Y | Y | Y | |
| B8 only WF-CALL-001 creates/changes calling assignments (Proposed, R-03) | Y | | | | (Y) | | Y | | | |
| C1 Owner always has access | Y | Y | | Y | | | | | | |
| C2 per user, per resource (incl. calendars, notifications) | Y | Y | Y | Y | Y | Y | | | | Y |
| C3 duplicate check includes hidden/rejected | | | | | | (Y) | | | | |
| C4 DEC-001/002/003/005 unresolved | (Y) | (Y) | (Y) | (Y) | (Y) | (Y) | | | | |
| C5 only WF-ACCESS-001 defines access | Y | Y | Y | Y | Y | Y | | | | Y |
| C6 re-check at send (Proposed) | | | | Y | Y | | | | | Y |
| D1 Needs another call meaning (Confirmed) | | | Y | Y | | | | | | |
| D2 follow-up or explicit marker (Proposed) | | | Y | Y | | | | | Y | |
| D3 On hold returns to queue; follow-up optional (Proposed) | | | Y | | | | | | | |
| D4 open follow-ups on Rejected/Accepted (Unresolved) | | | Y | Y | | Y | | | Y | |
| D5 reminder failure never erases/blocks follow-up (Confirmed) | | | Y | Y | Y | | | | Y | Y |
| D6 failed or suppressed reminder visible to Owner (Proposed, R-09) | | | | Y | Y | | | | Y | Y |
| E1 Accepted → accepted opportunity, not closed deal (Confirmed) | | | Y | | | | | | | |
| E2 Call Center or Owner assigns Developer (Confirmed) | | | Y | | | | | | | |
| E3 developer not yet assigned, visible to Owner (Proposed) | | | Y | | | | | | | |
| E5 Accepted creates one deal record in stage "Accepted opportunity", event `accepted_opportunity.created` emitted by Batch 3 (Proposed, R-05) | | | Y | | | | | | | |
| E4 DEC-005 / DEC-017 (Unresolved) | | | (Y) | | (Y) | | | | | |
| G1 reporting distinctions (Confirmed) | | | Y | Y | | | | | | |
| G2 audit/metrics table (Contract) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| G3 append-only audit (Confirmed) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

## 2. Interfaces with other batches

| Interface | Other side | What Batch 3 needs / provides | Status |
|---|---|---|---|
| Access check (WF-ACCESS-001 / SM-VISIBILITY-001) | Agent 2 | Batch 3 calls it for queue, detail, Start Contact, follow-ups, calendar, reminder re-check. Batch 3 **emits** `call_attempt.logged` and `follow_up.scheduled`, which DEC-001 Alt B would use as timer resets | Event names to align with Agent 2 (T-3) |
| Business created → outcome Pending, Unassigned | Agent 2 (WF-BIZ-001) | Initial calling outcome `pending` and assignment Unassigned (C-02 separation) | Needs Agent 2 to state the initial values |
| Data-correction flag in queue; correction from rejected screens | Agent 2 (WF-BIZ-002) | Read-only flag (B5); hand-off to submit | Reference only |
| Work-list items → assignment | Batch 1 (WF-WORK-001) | Under **B8** WF-WORK-001 hands Call Center items to WF-CALL-001 for **both** new assignment and reassignment; WF-CALL-001 records source "work list" | Ruled by R-03 (Proposed). Batch 1 text/diagram repair is tracked by Agent 1, not executed yet |
| Missing check-in/checkout alerts; attendance correction awaiting review | Batch 1 (WF-ATT-003) | Source events for WF-NOTIFY-001 | Recipients/timing unresolved |
| Deal record (stage Accepted opportunity) → developer assignment, meetings | Agent 4 (WF-DEAL-001, SM-MEETING-001, SM-COMMERCIAL-001) | The WF-CALL-003 save creates one deal record in stage "Accepted opportunity" (E5) with handoff context and developer-assigned / not-yet-assigned condition, and emits `accepted_opportunity.created` (consumed, not re-counted, by Batch 4). The DEC-017 open-deal check (WF-DEAL-001 A9) runs in the same save | Ruled by R-05 (Proposed) |
| Meeting reminders | Agent 4 (SM-MEETING-001) | Meeting scheduled/rescheduled/cancelled events feed WF-NOTIFY-001 | Event names from Agent 4 |
| Account status at send; deactivation effect | Agent 4 (SM-ACCOUNT-001, WF-EMP-001, SM-SESSION-001) | Re-check at send (C6); deactivated assignee/holder/responsible user produce derived Owner flags; no automatic reassignment | B3-Q06 |
| Reports and audit explorer | Agent 4 (WF-REPORT-001/002) | G2 table in spec §6; metric rules | "Callback requests" definition (B3-Q11) |

## 3. Decisions — effect on Batch 3 and on drawing

No unresolved decision **blocks drawing**: SB-2 §6 requires unresolved items to be drawn as branches or "policy-dependent", and every one below is drawn that way. Drawing is authorized (SB-2 §9a).

| Decision | Status | Affects | How it is shown | Redraw risk when decided |
|---|---|---|---|---|
| DEC-004 Lease duration & idle rule | Proposed | WF-CALL-002, WF-CALL-003, SM-RESERVATION-001, WF-CALL-001 (wait/override) | Yellow lease/idle nodes; tab switch = no release | Low (values only) unless DEC-004 drops reservations entirely |
| DEC-016 Reopening authority | Unresolved | WF-REJECT-001, outcome rules | Yellow authority decision; post-reopening outcome policy-dependent | Medium if a request-and-approve model is chosen (B3-Q09) |
| DEC-021 Automatic allocation | Proposed | WF-CALL-001, SM-ASSIGNMENT-001 | Yellow alternate start; same eligibility | Low |
| DEC-017 Multiple deals | Unresolved | WF-CALL-001 (B6), outcome rules (Accepted → ?) | Inside eligibility label; outcome table "Unresolved" | Low |
| DEC-001 / DEC-002 Visibility timer and exceptions | Unresolved | Queue contents, follow-up visibility, reminder re-check | Via Access check hand-off only | None for Batch 3 diagrams (T-2 is a policy issue) |
| DEC-005 Developer pre-closure access | Unresolved | Developer handoff notification; accepted opportunity visibility | Via WF-DEAL-001 / WF-ACCESS-001 | None for Batch 3 diagrams (T-4) |
| DEC-020 Target metrics | Unresolved | What Batch 3 events count | G2 table only | None |
| C-01 Deletion vs archiving | Unresolved (no DEC ID) | Eligibility B4 | Inside eligibility label | Low |
| C-02 Pending vs NEW_LEAD | Unresolved (no DEC ID) | Initial outcome; "attempt only" branch | Yellow "attempt only" node | Low |
| Notification timing, recipients, escalation | Unresolved (no DEC ID) | WF-NOTIFY-001, WF-FOLLOW-001, WF-CALL-001 | Yellow planning subgraph; event table | Low |
| D4 open follow-ups on Rejected/Accepted | Unresolved (no DEC ID) | WF-CALL-003, WF-FOLLOW-001, WF-REJECT-001, SM-FOLLOWUP-001 | Policy-dependent edges | Low |

## 4. Agent 3 drafting proposals (need review; not rules)

Introduced only to make flows complete. Each is marked `[Agent 3 proposal]` in the spec.

1. Reassignment and override require a reason.
2. Unassign exists as an Owner action (B3-Q15).
3. Multi-select assignment excludes ineligible items with per-item reasons; eligible items proceed.
4. Same-user re-entry (second tab/device) returns the existing reservation; not a collision.
5. Collision message shows holder name and since-time.
6. Unsaved notes can be kept as a local draft on cancel or loss.
7. Holder deactivation ends the reservation by lease expiry (B3-Q06).
8. Reservation acquired/released/expired/overridden are audit events; renewals and refused acquires are operational log only.
9. A call save may mark the due follow-up it fulfils as Completed; "Save and continue" keeps the reservation.
10. Outcome stays assignment-neutral (assignment unchanged by Rejected/Accepted).
11. "Requires contact" bucket = Pending or On hold with no open follow-up; Accepted leaves the calling buckets.
12. Follow-up time must be in the future; reschedule needs a reason; completed follow-ups are never reopened; no reservation needed to manage follow-ups.
13. Notifications only for committed source changes; reminder scheduling failure is flagged and retried; suppressed reminders raise an Owner-visible item; failure-alert loop guard.
14. Reopening keeps assignment unchanged; mistaken rejection uses the reopening path.

## 5. Questions (no DEC ID unless stated)

| Label | Question | Where it matters | Shown as |
|---|---|---|---|
| B3-Q01 | Besides the Owner, may anyone assign or reassign businesses (UC-CALL-008 actor; ART-03 missing)? | WF-CALL-001 | Owner only (only confirmed capability) |
| B3-Q02 | Is Start Contact limited to the current assignee plus the Owner? | WF-CALL-002 | Yes, from ART-01 §2.3 + DEC-004 permission row |
| B3-Q03 | On reassignment, what happens to open follow-ups by default (transfer / keep / cancel)? Note (RV3-09): "keep" orphans the callback under Batch 3's own guards unless a guard exception lets the previous agent contact and access the business | WF-CALL-001, WF-FOLLOW-001 | Owner chooses per follow-up; "keep" shown with its consequence |
| B3-Q04 | May a business have more than one open follow-up? | WF-FOLLOW-001, SM-FOLLOWUP-001 | Unresolved note |
| B3-Q05 | A save arrives after the reservation was lost: reject (Alt A) or keep the attempt row only (Alt B)? | WF-CALL-002, WF-CALL-003 | Alt A / Alt B (orange) |
| B3-Q06 | When a holder is deactivated, does the reservation end immediately or at lease end? | WF-CALL-002 (DEC-004 / WF-EMP-001) | Lease end (Agent 3 proposal) |
| B3-Q07 | Can the attempt time be edited or backdated, and by whom? | WF-CALL-003 | Defaults to now |
| B3-Q08 | Reminder whose trigger time is already past at scheduling, or whose job runs after the business event time: send or skip? | WF-NOTIFY-001, SM-REMINDER-001 | Policy-dependent |
| B3-Q09 | If DEC-016 selects request-and-approve reopening, which workflow/state model holds the request lifecycle? | WF-REJECT-001 | Not modelled |
| B3-Q10 | How is a do-not-call instruction received outside a call recorded? | WF-REJECT-001, WF-CALL-003 | Unresolved note |
| B3-Q11 | "Callback requests" (ART-01 §15): businesses currently Needs another call, or follow-ups scheduled in the period? | Reports (Agent 4) | G2 note |
| B3-Q12 | Can Accepted change back to a calling outcome (for example deal lost), and who does it? | Outcome rules, Agent 4 | "Unresolved" row |
| B3-Q13 | C-02 sub-question: may an attempt be logged without changing the outcome (Pending after contact)? | WF-CALL-003 | Policy-dependent branch |
| B3-Q14 | Override: is a reason mandatory, and how is the holder informed? | WF-CALL-002 | Reason (Agent 3 proposal); channel unresolved |
| B3-Q15 | Is "unassign" (back to Unassigned) a wanted Owner action? | WF-CALL-001, SM-ASSIGNMENT-001 | Agent 3 proposal |
| B3-Q16 | Which outcome-specific fields become mandatory (ART-01 §9.3: approval needed before enforcement)? | WF-CALL-003 | Proposed fields only |

## 6. Baseline change requests (for the orchestrator; SB-2 not edited)

**Status after SB-2 (all rulings Proposed unless → USER):**

| BCR | SB-2 ruling | Status |
|---|---|---|
| BCR-B3-01 calling-outcome model ID | R-10 | **→ USER, unresolved.** The outcome rules stay a table inside WF-CALL-003 (spec §2.3.1); no new SM ID. Drawn as a table in section 06 |
| BCR-B3-02 SM-REMINDER-001 scope | R-08 | Ruled (Proposed): reminders = follow-ups and meetings; other §16 alerts are notifications without a state model. Applied in spec §2.5/§3.4 and Mermaid |
| BCR-B3-03 new no-DEC-ID questions | — | Open (not ruled) |
| BCR-B3-04 suppressed reminders visible | R-09 (contract D6) | Ruled (Proposed). Applied |
| BCR-B3-05 accepted-opportunity hand-off | R-05 (contract E5) | Ruled (Proposed). Applied: deal record, event emitted by Batch 3 |
| BCR-B3-06 inventory DEC dependencies | — | Open (for orchestrator merge) |
| BCR-B3-07 override under DEC-004? | — | Open |

Original requests (kept for traceability):

**BCR-B3-01 — Calling-outcome rules have no model ID.**
SB-1 §3 and the inventory listed no state/decision model for the calling outcome. SM-COMMERCIAL-001 explicitly keeps the outcome out. The outcome has real rules: non-sequential moves, Rejected changes only by reopening, Accepted → ? unresolved. Request: either (a) the orchestrator assigns a model ID for the calling outcome, or (b) confirms the rules stay as a table inside WF-CALL-003 (spec §2.3.1). Agent 3 has not created an ID.

**BCR-B3-02 — Scope of SM-REMINDER-001 and of the term "Reminder".**
SB-1 §5 defines Reminder as an email delivery attempt for a follow-up or meeting. WF-NOTIFY-001 must also cover the other ART-01 §16 events (missing check-in, new assignment, delivery failure, …), which are alerts rather than reminders. Request one of:
- (a) widen SM-REMINDER-001 to "notification delivery" for all §16 events, and rename audit events to `notification.*`; or
- (b) keep SM-REMINDER-001 reminder-only and state that other notifications follow the same delivery rules without their own model.

**BCR-B3-03 — New questions with no DEC ID.**
Add to SB-2 §3 "Questions with no DEC ID" (or fold into existing items): follow-up handling on reassignment (B3-Q03), multiple open follow-ups (B3-Q04), late save after reservation loss (B3-Q05), reservation override rules (ART-01 §9.2; B3-Q14), reminder short-notice/late-run and retry policy (B3-Q08; could fold into "notification timing"), mandatory call fields (B3-Q16), attempt backdating (B3-Q07), out-of-call do-not-call (B3-Q10).

**BCR-B3-04 — Proposed contract D6: suppressed reminders are visible.**
C6 (re-check at send) plus D5 (failure never erases the follow-up) still allow a callback to be **silently missed**: the reminder is suppressed because the responsible user was deactivated or lost access, and nobody is told. Proposal (Proposed): a reminder suppressed at send time produces an Owner-visible item; the follow-up stays Scheduled. See T-1.

**BCR-B3-05 — Ownership of the accepted-opportunity hand-off.**
Contract E says what Accepted creates but not which batch emits the record and audit event. Batch 3 drafts `accepted_opportunity.created` (emitted by the WF-CALL-003 save) and the "developer not yet assigned" condition. Request: confirm Batch 3 emits it and Agent 4 consumes it, so the names are not defined twice.

**BCR-B3-06 — Inventory DEC dependencies are incomplete.**
`phase_2_workflows_and_state_machines.md` §2 lists:
- WF-CALL-001: DEC-021, DEC-004. Also needs DEC-017 (B6), C-01 (B4), and DEC-001/002 through WF-ACCESS-001.
- WF-CALL-003: DEC-004, DEC-005. Also needs DEC-016, DEC-017 and DEC-020.
- WF-FOLLOW-001: notification timing only. Also needs DEC-002 (callback exception) and DEC-001 (Alt B reset).

Request that the orchestrator update the inventory when merging.

**BCR-B3-07 — Is the Owner override part of DEC-004?**
SB-2 §4 lists "Owner force override [Proposed]" next to DEC-004, but DEC-004's title covers lease duration and the idle rule only, and ART-01 §9.2 says override rules are undecided. Batch 3 cites override rules as "no DEC ID". Request: confirm, or state that DEC-004 covers override.

## 7. Contract conflicts and tensions noticed

| Label | Description | Sources | Suggested handling |
|---|---|---|---|
| T-1 | A follow-up kept by a previous agent (reassignment "keep") or a deactivated responsible user has its reminders suppressed under C6. It is not erased (D5), but it can be missed silently | C6, D5, ART-01 §10 | Addressed by D6 (R-09, Proposed): suppression is visible to the Owner. "Keep" also flagged in WF-CALL-001 (RV3-09) |
| T-2 | ART-01 §10 says follow-ups appear in the agent's dashboard and calendar. C2 applies access checks to calendars. Under DEC-002 Alt B ("until callback + 48 h"), a follow-up overdue by more than 48 h may vanish from the responsible agent's calendar while still Scheduled | ART-01 §10, C2, DEC-002 | Resolve within DEC-002; Owner overview always shows it (C1). Drawn via the Access check hand-off |
| T-3 | DEC-001 Alt B resets the timer on "call attempt or scheduled callback". Those events are emitted by Batch 3 but consumed by WF-ACCESS-001 | DEC-001, C5 | **Resolved by R-07 (Proposed):** reset touchpoints use `call_attempt.logged` and `follow_up.scheduled` |
| T-4 | Under DEC-005 Alt 2 (closed-deal-only developer access), the confirmed "Developer handoff" notification at acceptance would go to a developer who cannot open the accepted opportunity. C6 would suppress it | ART-01 §16, DEC-005, C6, E2 | Agent 4 / orchestrator; drawn as hand-off only |
| T-5 | Board 01 lifecycle uses stored `NEW_LEAD`. Batch 3 follows SB-2 (derived "unassigned + pending") | ART-04 `30:553`, C-02 | No action. Consistent with SB-2; noted for integration review |
| T-6 | ART-11 D8 (unapproved) says automatic allocation never moves businesses with open follow-ups or active reservations. Batch 3 leaves this to DEC-021 | DEC-021, ART-11 D8 | No action; simplifies WF-CALL-001 if adopted |
| T-7 | Batch 1 WF-WORK-001 manual eligibility checks "role, not rejected, in scope" but not B2 (phone, Proposed) or B4/B6 | WF-WORK-001, contract B | Agent 1 (batch1-maintenance) to align with contract B |
| T-8 | Batch 1 WF-WORK-001 saves assignments for unassigned items itself ("Save assignments; audit; notify assignees") and hands only reassignment to WF-CALL-001. Two workflows then create calling assignments | WF-WORK-001, WF-CALL-001 | **Resolved by R-03 / contract B8 (Proposed):** only WF-CALL-001 writes calling assignments; Batch 1 repair tracked by Agent 1 |

No direct contradiction with an SB-2 Confirmed contract was found. T-3 and T-8 are resolved by SB-2 rulings (Proposed); T-1 is addressed by D6 (R-09).

## 8. Readiness

"Ready to draw" means the spec and Mermaid are complete enough for independent review and, once drawing is authorized, generation. All are DRAFT and unreviewed.

| Item | Readiness | Notes |
|---|---|---|
| WF-CALL-001 (Part 1, Part 2) | Ready to draw | B7/B8 applied (R-02, R-03) |
| WF-CALL-002 (Part 1, Part 2) | Ready to draw | DEC-004 yellow; B3-Q05 as Alt A/B |
| WF-CALL-003 (Part 1, Part 2) | Ready to draw | Hand-off label to WF-DEAL-001 to align with Agent 4 (BCR-B3-05) |
| WF-FOLLOW-001 | Ready to draw | |
| WF-NOTIFY-001 (Part 1, Part 2) | Ready to draw | R-08 applied: reminders vs notifications |
| WF-REJECT-001 | Ready to draw | Medium redraw risk if DEC-016 selects request-and-approve (B3-Q09) |
| SM-ASSIGNMENT-001 | Ready to draw | |
| SM-RESERVATION-001 | Ready to draw | |
| SM-FOLLOWUP-001 | Ready to draw | |
| SM-REMINDER-001 | Ready to draw | No longer blocked: R-08 fixes the scope (follow-up and meeting reminders) |
| Calling-outcome rules | Drawn as a table, not a model | R-10 → USER; table per spec §2.3.1 |

## 9. Verification record (what was actually done)

- Files written only under `docs/phase2/batch3/`. No Figma/FigJam calls; nothing drawn; no other file edited.
- Mermaid checked with a local structural lint script (scratchpad, not part of the project). It confirmed for all 10 flowcharts that:
  - every edge endpoint is defined;
  - there are no orphan nodes;
  - every decision has two or more outgoing edges, all labelled;
  - no label contains an embedded quote;
  - node counts are 17–23, matching each diagram header.
- The lint also checked the 4 state diagrams: no `note`, `classDef` or `style`, and no undeclared states.
- **Not done:** the Mermaid was not rendered by Mermaid or FigJam, so layout quality is unverified. No software exists, so nothing was tested.
