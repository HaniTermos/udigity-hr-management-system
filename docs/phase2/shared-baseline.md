# Phase 2 Shared Baseline (AUTHORITATIVE — orchestrator-owned)

Version: SB-3, 2026-10-20. Phase 2 was approved by the user as baseline; SB-3 adds only the housekeeping definitions. Earlier: SB-1, then SB-2 (§10–§11 rulings). **Only the orchestrator edits this file.** If an agent needs a change, it writes a "Baseline change request" in its own staging file. It must not edit this file.

**Phase 2 is approved by the user as the workflow and state-model baseline (2026-10-20). No unresolved policy alternative is selected.** Phases 3 and 4 are authorized; Phase 5, high-fidelity screens and production code are not.

## 1. Source documents (read these; do not copy-edit them)

| Ref | Document | Path / location | Authority |
|---|---|---|---|
| ART-01 | Product description | `docs/product-description.md` | Tier 1, user requirements. Open items inside it are NOT approved |
| ART-04 | Board 01 (Product Map & Use Cases) | FigJam fileKey `Ml01oLIuAs3MTzxQ7PW1L0`. **Read-only; never edit** | Tier 3, with no approval marker |
| ART-11 | AI proposals D1–D20, mapped to DEC IDs | `docs/decisions.md` | Tier 4, unapproved. Never present one as a rule |
| — | Artifact register and conflicts C-01..C-04 | `docs/artifact-register.md` | Reference |
| — | Phase 2 inventory, coverage, Batch 1 specs | `docs/phase_2_workflows_and_state_machines.md` | Authoritative Phase 2 doc (orchestrator merges into it) |
| — | Batch 1 diagram source | `docs/phase_2_batch1_mermaid.md` | Reference for style |

Missing (not found here; existence unknown): the Phase 0 REQ baseline (ART-02), the Phase 1 UC spec v1.1.0 (ART-03) and the screen inventory (ART-07).
- Map to REQ **ranges** only.
- Do **not** create SCR IDs.
- Do **not** create a requirements or screen inventory.

## 2. Authority order
1. Explicit user requirements and approved decisions.
2. Approved specifications.
3. FigJam representations.
4. Unapproved AI proposals.

## 3. Canonical IDs (do not rename; do not reassign)

**Use cases** (Board 01). Each list shows UC titles and their owning batch.
- **AUTH (Batch 4):**
  - UC-AUTH-001 Login
  - UC-AUTH-002 2FA (Owner)
  - UC-AUTH-003 (003A Enroll / 003B Recover 2FA)
  - UC-AUTH-004 Password reset
  - UC-AUTH-005 Create/Edit employee
  - UC-AUTH-006 Deactivate & revoke sessions
  - UC-AUTH-007 Update profile
  - UC-AUTH-008 Logout & session invalidation
- **ATT (Batch 1, done):** UC-ATT-001 through UC-ATT-007.
- **BIZ (Batch 2):**
  - UC-BIZ-001 Create business
  - UC-BIZ-002 Intercept duplicate & block
  - UC-BIZ-003 Hidden duplicate & request escalation (Pending DEC-003)
  - UC-BIZ-004 Edit business
  - UC-BIZ-005 Submit data correction
  - UC-BIZ-006 Review & resolve correction
  - UC-BIZ-007 Manage dynamic categories
  - UC-BIZ-008 Search business, view detail & edit history
- **CALL (Batch 3):**
  - UC-CALL-001 Access calling queue
  - UC-CALL-002 Acquire contact reservation (Pending DEC-004)
  - UC-CALL-003 Log call attempt & notes
  - UC-CALL-004 Schedule callback & reminder
  - UC-CALL-005 Mark Rejected
  - UC-CALL-006 Reopen rejected (Pending DEC-016)
  - UC-CALL-007 Qualify Accepted & assign developer
  - UC-CALL-008 Assignment & reassignment
  - UC-CALL-009 Follow-up reschedule/cancel/complete
  - UC-CALL-010 Reservation release/renew/override
- **DEAL/PROJ (Batch 4):**
  - UC-DEAL-001 Discovery meeting (DEC-005)
  - UC-DEAL-002 Update commercial status
  - UC-DEAL-003 Finalize closed deal
  - UC-DEAL-004 Meeting scheduling/rescheduling
  - UC-PROJ-001 View company-wide closed deals
  - UC-PROJ-002 Provision project board
  - UC-PROJ-003 Update development status & schedule
  - UC-PROJ-004 Manage tasks & milestones
- **REP:**
  - UC-REP-001 Dashboard (Batch 4)
  - UC-REP-002 Compare periods (Batch 4)
  - UC-REP-003 Export XLS/CSV/PDF (Batch 4)
  - UC-REP-004 Audit log explorer (Batch 4)
  - UC-REP-005 Office IP & geofence (Batch 1, done)
  - UC-REP-006 Backup (moved to Phase 3D; approved)

**REQ ranges:**
- REQ-AUTH-001..009
- REQ-ATT-001..012
- REQ-BIZ-001..009
- REQ-SEC-DUP-001..007
- REQ-SEC-VIS-001..006
- REQ-CALL-001..011
- REQ-PROJ-001..008
- REQ-REPORT-001..006
- REQ-SEC-TECH-001..006

**Workflow and state-model IDs:** these are the approved inventory in `phase_2_workflows_and_state_machines.md` §2–§3. Do not add IDs. If a new one is genuinely needed, raise a baseline change request.

| Batch | Lead | Workflows | State / decision models |
|---|---|---|---|
| 1 (done) | Agent 1 | WF-ATT-001, WF-ATT-002, WF-ATT-003, WF-ADMIN-001, WF-WORK-001 | SM-ATTENDANCE-001, SM-CORRECTION-001 |
| 2 | Agent 2 | WF-BIZ-001, WF-BIZ-002, WF-BIZ-003, WF-ACCESS-001 | SM-DATAFIX-001, SM-VISIBILITY-001 |
| 3 | Agent 3 | WF-CALL-001, WF-CALL-002, WF-CALL-003, WF-FOLLOW-001, WF-NOTIFY-001, WF-REJECT-001 | SM-ASSIGNMENT-001, SM-RESERVATION-001, SM-FOLLOWUP-001, SM-REMINDER-001 |
| 4 | Agent 4 | WF-DEAL-001, WF-DEAL-002, WF-PROJ-001, WF-AUTH-001, WF-AUTH-002, WF-EMP-001, WF-REPORT-001, WF-REPORT-002 | SM-COMMERCIAL-001, SM-MEETING-001, SM-PROJECT-001, SM-TASK-001, SM-ACCOUNT-001, SM-SESSION-001 |

**Decision IDs:** DEC-001…DEC-026 (titles below). Never change a meaning. Never assign new DEC IDs. Questions with no DEC ID are cited by artifact-register ID or described as "(no DEC ID)".

| DEC | Title (Board 01) | Board status |
|---|---|---|
| 001 | 15-Day Policy Trigger Basis | Unresolved. Alt A: creation-based, no reset. Alt B: inactivity-based, resets on call attempt or scheduled callback |
| 002 | Active-Work Visibility Exceptions | Unresolved table: accepted opportunity, closed deal, active project, completed project, scheduled callback (Alt B: until callback + 48 h), open correction request |
| 003 | Hidden Record Match Revelation Scope | Unresolved |
| 004 | Contact Reservation Lease Duration & Idle Rule | Proposed |
| 005 | Developer Scoping Access to Accepted Opportunities | Unresolved. Alt 1: assigned scoping access. Alt 2: closed-deal-only |
| 006 | Authority to Record or Approve Commercial Closure | Unresolved |
| 007 | Workday Schedule & Hours | Unresolved |
| 008 | Late Arrival Grace Period | Unresolved |
| 009 | Office Restriction Mechanism | Unresolved |
| 010 | Remote Work Permissions & Verification Fallback | Unresolved |
| 011 | Attendance Correction Authority | Unresolved |
| 012 | Checkout Work Report Requirement | Unresolved |
| 013 | Name-Only Duplicate Blocking & Branch Handling | Unresolved |
| 014 | Unknown Social Media Metrics Handling | Proposed |
| 015 | Category Management Authority | Unresolved |
| 016 | Rejected Record Reopening Authority | Unresolved |
| 017 | Multiple Deals / Services per Business | Unresolved |
| 018 | Financial Field Governance & Evidence | Unresolved |
| 019 | Service Delivery State Machine | Proposed |
| 020 | Daily Target Metric Definitions | Unresolved |
| 021 | Automated Work Allocation Logic | Proposed |
| 022 | Weekly Rest Days & Scheduled Days Off | Unresolved |
| 023 | Follower-Count Tracking Granularity | Unresolved |
| 024 | Social Media Platform Ingestion Priority | Proposed |
| 025 | Target Allocation Frequency & Review Cycle | Unresolved |
| 026 | Failed Checkout Handling Policy | Unresolved alternative |

**Questions with no DEC ID:**
- Deletion vs archiving (C-01)
- Pending vs NEW_LEAD (C-02)
- Notification timing, recipients and escalation
- Recovery objectives
- Commercial-stage transition rules

## 4. Permission summary (Board 01 `27:470`, Tier 3; tags as written there)
- **Employee directory:** Owner only [Confirmed]. Everyone can view their own profile.
- **Attendance check-in/out:** all roles [Confirmed]. Office gating applies to all; NO Owner exemption (evidence in ART-02, unavailable; finding F-04).
- **Attendance correction:** employee submits [Proposed: DEC-011]; Owner adjusts [Confirmed].
- **Business creation:** Data Entry and Owner [Confirmed]. Duplicate block is mandatory.
- **Business edit:** Data Entry and Owner [Confirmed]. The duplicate check excludes the record's own ID.
- **Business deletion:** Owner only [Confirmed on board]. **ART-01 §2.1 says this is still open (C-01).** Treat it as unresolved. Data Entry deletion is denied (Confirmed by ART-01).
- **Dynamic categories:** Owner [Confirmed]. Non-owner [Unresolved: DEC-015].
- **Duplicate blocking:** all roles are blocked on a match [Confirmed]. Hidden revelation [Unresolved: DEC-003].
- **Contact reservation:** Call Center and Owner acquire [Proposed: DEC-004]. Owner force override [Proposed].
- **Call logging:** Call Center and Owner [Confirmed]. Reopening rejected [Unresolved: DEC-016].
- **Deal closure recording/approval:** Owner and Developer [Confirmed: REQ-PROJ-004]. Sign-off gate [Unresolved: DEC-006].
- **Delivery board:** Developers and Owner view and update [Confirmed].
- **Reporting & exports:** Owner only [Confirmed].
- **Audit trail:** Owner only; application-level, append-only [Confirmed].

**ART-01 role rules (Tier 1):**
- Call Center and Developer request corrections; they do not edit master data.
- Data Entry cannot change commercial status.
- Developers see company-wide eligible closed deals.
- Call Center or Owner assign Developers.
- Owner full access is subject to authentication and audit.
- An Owner session gets no admin access before 2FA completes.

## 5. Canonical terminology (use exactly)

| Term | Meaning | Not to be confused with |
|---|---|---|
| Business | Company record (master data + operational history) | "lead", "customer", "client record" as separate entities |
| Calling outcome | Result of contact. UI labels: Pending, On hold (= no answer), Needs another call (= client asked for later contact), Rejected (= do not call), Accepted (= interested, proceeding). Proposed internal ids: `pending`, `on_hold`, `needs_another_call`, `rejected`, `accepted` | Assignment state; commercial stage |
| Call attempt | One logged contact attempt (history row) | The business's current outcome |
| Assignment state | Unassigned / Assigned (to one Call Center agent), with history | Calling outcome. `NEW_LEAD` is NOT a stored status (C-02 unresolved; describe as "unassigned + pending") |
| Contact reservation | Temporary in-app lock while an agent handles contact | Assignment |
| Follow-up | Saved callback commitment (scheduled / completed / cancelled). Due/overdue are derived | Reminder |
| Reminder | Email delivery attempt for a follow-up or meeting | Follow-up; a failed reminder never erases or blocks a follow-up |
| Accepted opportunity | Business that accepted, proceeding to developer consultation | Closed deal |
| Closed deal | Accepted + signed + paid | Completed project |
| Commercial stage | Deal lifecycle (Agent 4 defines; transitions have no DEC ID, so they are Proposed) | Calling outcome |
| Project status | Proposed (ART-01 §13): Scheduled, In progress, Waiting for client, Blocked, Delivered, Completed. Non-linear (DEC-019) | Task status |
| Hidden (15-day) | Access restriction for a given user. The record is still stored and still duplicate-checked | Deleted / archived |
| Data-correction request | Flag that business master data is wrong (Call Center, Developer, Owner) | Attendance correction (Batch 1) |

## 6. Cross-batch contracts (orchestrator-owned)
Status values:
- **Confirmed:** from Tier 1/2.
- **Proposed:** orchestrator default; the user may change it.
- **Unresolved:** must be drawn as a branch or "policy-dependent".

Agents must use these. They must not pick conflicting defaults.

**A. Attendance → Daily Work**
- A1 (Unresolved, no DEC ID): Does viewing or working the work list require an open attendance session? No approved rule says so. **Agents must NOT gate work actions on check-in.** Show "attendance gating: not adopted" only where relevant.
- A2 (Unresolved, DEC-020): Target progress counts actions by their own timestamp in company time. It does not depend on attendance state.

**B. Business Data → Calling (eligibility for assignment / contact)**
- B1 (Confirmed): The business exists, and its calling outcome is not Rejected. Rejected businesses are excluded from normal calling.
- B2 (Proposed): The business has at least one phone number. Whether a phone is mandatory at creation is **Unresolved (no DEC ID)**; ART-01 requires at least one social account, not a phone.
- B3 (Confirmed): The assignee is an active Call Center agent. Owner may also act.
- B4 (Unresolved, C-01): Archived or deleted businesses are ineligible. Archiving itself is unresolved.
- B5 (Proposed): An open data-correction request does NOT block assignment or contact. It is shown as a flag in the queue (ART-01 §9.1 "businesses requiring data correction").
- B6 (Unresolved, DEC-017): Whether a business with an open deal can be re-queued.

**C. Visibility → All Modules**
- C1 (Confirmed): The Owner always has access (with authentication and audit).
- C2 (Confirmed): Access is evaluated **per requesting user, per resource**. There is no global "visible" flag. It applies to lists, search, detail, direct URLs, calendars, tasks/projects context, notifications and exports.
- C3 (Confirmed): Duplicate detection checks the entire database, including hidden records.
- C4 (Unresolved): Timer origin and reset (DEC-001); exceptions (DEC-002); hidden-duplicate revelation (DEC-003); developer pre-closure access (DEC-005).
- C5 (Contract): **WF-ACCESS-001 / SM-VISIBILITY-001 (Agent 2) is the only definition of the access evaluation.** Agents 3 and 4 reference it as "Access check (WF-ACCESS-001)" and do not redefine it.
- C6 (Proposed): Notifications and reminders re-check access and account status at send time (WF-NOTIFY-001 references C5).

**D. Calling → Follow-ups**
- D1 (Confirmed): Outcome "Needs another call" means the client asked to be contacted later.
- D2 (Proposed): Finalizing "Needs another call" either creates a follow-up in the same save, or records an explicit "callback to be scheduled" pending marker. It is never silently missing.
- D3 (Proposed): On hold (no answer) returns the business to the queue. A follow-up is optional.
- D4 (Unresolved, no DEC ID): What happens to open follow-ups when the outcome becomes Rejected or Accepted. Draw it as policy-dependent.
- D5 (Confirmed): A reminder failure never erases or blocks the follow-up.

**E. Calling → Deals**
- E1 (Confirmed): Accepted creates an accepted opportunity, NOT a closed deal.
- E2 (Confirmed): Call Center or Owner assigns the Developer.
- E3 (Proposed): Developer assignment may be deferred. This is an explicit "developer not yet assigned" condition, visible to the Owner.
- E4 (Unresolved): Developer pre-closure access (DEC-005); multiple deals (DEC-017).

**F. Deals → Projects**
- F1 (Confirmed): A project or task board exists for relevant delivery engagements.
- F2 (Unresolved): Provisioning trigger. Automatic at verified closure (ART-01 §13 calls this "a design proposal") vs manual. Closure authority is DEC-006.

**G. All Modules → Reporting / Audit**
- G1 (Confirmed, ART-01 §15): Reports must never conflate call attempts with distinct businesses contacted, accepted with closed, closed with completed project, or "not checked in" with absent on a scheduled day.
- G2 (Contract): Every batch lists its audit events and countable metrics in a table with columns `Event (proposed name) | Entity | Actor | Counted in report? | Source workflow`. Naming: `<entity>.<past_tense_verb>` in lower snake case. Names stay Proposed until approved.
- G3 (Confirmed): Audit is append-only, and normal users cannot rewrite history.

## 7. Diagram and spec standard
**Per-workflow fields:** ID, Name, Purpose, REQ range, UC IDs, Actors, Trigger, Preconditions, Main path, Alternate paths, Errors & recovery, Authorization, Visibility/assignment, Data changes, Audit events, Notification events, Postconditions, Decision dependencies.

**Per-state-model transition table:** Current state | Event | Actor | Guard/permission | Next state | Side effects | Audit event (proposed name) | Failure behavior | Decision dependency.
- Distinguish states, events, actions and derived classifications.
- Do not turn events into states.

**Each critical workflow:** at least 3 Given/When/Then scenarios, labelled "intended behaviour, not tested".

**Notation (must match Batch 1):**

| Marker | Meaning |
|---|---|
| Yellow (`#FFECBD`/`#FFC943`) + "(DEC-xxx)" | Unresolved or Proposed dependency |
| Orange (`#FFE0C2`/`#FF9E42`) + "Alt A/B" | Unselected alternatives |
| Red (`#FFCDC2`/`#FF7556`) | Failure |
| Green (`#CDF4D3`/`#66D575`) | Success end |
| Blue (`#C2E5FF`/`#3DADFF`) + "(derived)" | Derived classification |
| Dotted | Retry or side effect |
| `[[...]]` | Hand-off to another workflow |

**Layout lessons from Batch 1 (mandatory):**
- Use `flowchart LR` with **phase subgraphs** (not role swimlanes), and name the actor inside each step ("Data Entry enters…"). Role-lane clusters produced unreadable routing.
- Keep each diagram at or under ~25 nodes; split into Part 1 / Part 2 if larger.
- State diagrams: `stateDiagram-v2`. No `note`, no `classDef`/`style` (they create phantom states).
- Every decision edge is labelled (Valid/Invalid, Duplicate/No duplicate, Authorized/Denied, Save succeeded/Save failed, …).

## 8. Board 02 (FigJam fileKey `lwmKQNJI42na8B3SSNLQJP`) — section leases
**One writer per section.**

| Section | Node | Owner (writer) | Notes |
|---|---|---|---|
| Board structure, 00 Index, 12 Coverage | `12:737`, `12:739` | Orchestrator | Agents never edit |
| 02 Attendance, 03 Targets | `12:741`, `12:743` | Agent 1 | No board writes authorized this checkpoint |
| 11 State Machines (Batch 1 content) | `12:745` | Agent 1 | No board writes this checkpoint |
| 04 Business Data & Corrections | see task register | Agent 2 | Write lease active |
| 05 Access & Visibility | see task register | Agent 2 | Write lease active. Batch 2 state/decision models go **here**, in a sub-area titled "Batch 2 state & decision models", NOT in section 11 (avoids a second writer in 11). The orchestrator relocates them at integration if wanted |
| 01, 06–10 | not created | — | Batches 3–4 drawing NOT authorized |

**FigJam procedure (mandatory for any board writer):**
1. Load the Figma skills before writing: `figma:figma-generate-diagram` and its `references/flowchart.md` / `references/state.md`, plus `figma:figma-use` and `figma:figma-use-figjam`. Load Figma MCP tool schemas via ToolSearch.
2. Generate each diagram with `generate_diagram` (pass `fileKey`). It lands as loose top-level nodes.
3. **Immediately** wrap those new loose nodes into a new section **in place**, with absolute positions preserved: `child.x = oldX - section.x`. Never re-position loose connectors individually; that broke the connectors in Batch 1. Add a header (40 px bold title; 22 px meta line with Status, UC, REQ range, Actors, Policy-dependent DECs).
4. Then move that whole diagram section into your leased parent section with `appendChild` and set its x/y. Moving whole sections is safe.
5. Never touch nodes outside your lease. Never move or resize other board sections. You may enlarge your own leased section.
6. Read back with `get_figjam` (output may be large; it saves to a file) and inspect each diagram with `get_screenshot` (`enableBase64Response: true`). Report what you actually saw.
7. If the same rendering defect survives two repair attempts, stop and escalate. Do not keep regenerating.
8. Delete only your own failed attempts. Never delete completed diagrams of others.

## 9. Documentation locations

| Path | Writer |
|---|---|
| `docs/phase2/shared-baseline.md`, `docs/phase2/task-register.md` | Orchestrator only |
| `docs/phase2/batch1-maintenance.md` | Agent 1 |
| `docs/phase2/batch2/` (specs, Mermaid source, node IDs, verification) | Agent 2 |
| `docs/phase2/batch3/` | Agent 3 (draft only) |
| `docs/phase2/batch4/` | Agent 4 (draft only) |
| `docs/phase2/reviews/` | Independent Reviewer / Integration Reviewer |
| `docs/phase_2_workflows_and_state_machines.md` | Orchestrator merges accepted content; agents do not edit |

Never edit `docs/product-description.md`, `docs/decisions.md` or `docs/artifact-register.md`, and never touch the separate `udigity platform` project.

## 9a. Batch 3–4 drawing leases and the board lock (added 2026-10-20 after the user accepted Batches 1–2)
**Batches 1 and 2 are accepted by the user as baseline. Do not reopen them** unless a genuinely blocking contradiction appears; if one does, report it to the orchestrator and do not edit those sections.

| Section | Node | Writer | Content |
|---|---|---|---|
| 01 — Authentication & Employees | `65:3581` | Agent 4 | WF-AUTH-001, WF-AUTH-002, WF-EMP-001, SM-ACCOUNT-001, SM-SESSION-001 |
| 06 — Calling & Reservations | `65:3584` | Agent 3 | WF-CALL-001, WF-CALL-002, WF-CALL-003, SM-ASSIGNMENT-001, SM-RESERVATION-001, and the calling-outcome table (R-10) |
| 07 — Follow-ups, Reminders & Rejection | `65:3587` | Agent 3 | WF-FOLLOW-001, WF-NOTIFY-001, WF-REJECT-001, SM-FOLLOWUP-001, SM-REMINDER-001 |
| 08 — Deals & Developer Meetings | `65:3590` | Agent 4 | WF-DEAL-001, WF-DEAL-002, SM-COMMERCIAL-001, SM-MEETING-001 |
| 09 — Projects & Tasks | `65:3593` | Agent 4 | WF-PROJ-001, SM-PROJECT-001, SM-TASK-001 |
| 10 — Reporting & Exports | `65:3596` | Agent 4 | WF-REPORT-001, WF-REPORT-002 |

**Board lock (mandatory while two agents draw in parallel).** `generate_diagram` drops loose top-level nodes on the shared canvas. Without a lock, one agent could wrap the other agent's nodes. So:
1. Before each `generate_diagram`, acquire the lock by **creating a directory** (an atomic step): `mkdir "C:/Users/Hani/AppData/Local/Temp/claude/D--udigity-company-udigity-hr-system/afffccab-67aa-402b-a6ff-b54731f49d96/scratchpad/board02.lock"`. If it already exists, the other agent holds it. Do other work (screenshots, tables, docs) and retry later. Never delete a lock you don't hold.
2. While holding it, take a snapshot of the top-level node IDs, call `generate_diagram`, and diff to get **your** new loose nodes. Wrap them in place in a new section, then move that section into your leased section.
3. Release the lock with `rmdir` on the same path immediately after the move.
4. If the lock has existed for over 15 minutes without progress, report to the orchestrator. Do not break it.

`use_figma` edits inside your own sections (tables, headers, moving your own diagram sections) need no lock.

## 10. SB-2 integration rulings (orchestrator, 2026-10-20)
These resolve interface conflicts between batches. **They are orchestrator rulings with status Proposed. They are not approved business policy; the user may overturn any of them.** Items marked "→ USER" need a user decision and stay unresolved.

| ID | Raised by | Ruling | Status |
|---|---|---|---|
| R-01 | Agent 2 BCR-1 | Clarifies C1. The Owner passes evaluation steps 1–4 (account, authentication + 2FA, role, action), **skips** steps 5–8 (scope, assignment, timer, exceptions), and is still subject to step 9 (resource state, e.g. a rejected business is still do-not-call). | Proposed |
| R-02 | Agent 2 BCR-2 | New contract **B7**. Every calling action requires the Access check (WF-ACCESS-001), even for the assignee. If a business is assigned but hidden for its assignee, it appears to the Owner as "assigned but inaccessible" for an Owner decision. There is **no automatic reassignment**. | Proposed; Agent 3 must align |
| R-03 | Agent 3 T-8 | New contract **B8**. **Only WF-CALL-001 creates or changes calling assignments.** WF-WORK-001 (Batch 1) hands Call Center items to WF-CALL-001 for both new assignment and reassignment. Batch 1 needs a text and diagram repair, which Agent 1 tracks and does not execute yet. | Proposed |
| R-04 | Agent 2 BCR-3, Agent 4 BCR-04 | Terminology additions (see §11 below). | Proposed |
| R-05 | Agent 3 BCR-B3-05, Agent 4 BCR-05 | New contract **E5**. Finalizing outcome Accepted (WF-CALL-003) creates, in the same save, one **deal record** whose initial commercial stage is "Accepted opportunity". Event: `accepted_opportunity.created`, emitted by Batch 3 and consumed by Batch 4. Developer assignment can follow later (E3). | Proposed |
| R-06 | Agent 4 BCR-07 | WF-ACCESS-001 must explicitly list these resource types: business, call attempt, follow-up, contact reservation, deal record, meeting, project, task, notification, export row, duplicate preview. Each one either inherits from its business or is stated as an exception row (DEC-002). | Required for Batch 2 repair |
| R-07 | Agent 2 / Agent 3 T-3 | The DEC-001 Alt B reset touchpoints use Batch 3 event names `call_attempt.logged` and `follow_up.scheduled`. Edits, notes and status tweaks never reset (Board 01 `24:414`). | Proposed alignment |
| R-08 | Agent 3 BCR-B3-02 | SM-REMINDER-001 covers email reminders for **follow-ups and meetings**. Other ART-01 §16 alerts (missing check-in/checkout, assignment, handoff, correction requests, delivery failure) are notifications dispatched by WF-NOTIFY-001 **without** a separate state model. | Proposed |
| R-09 | Agent 3 BCR-B3-04, Agent 4 BCR-08 | New contracts **D6**: a reminder suppressed or failed at send time is visible to the Owner (delivery-failure notification), and the follow-up or meeting is unaffected. **F3**: if automatic project creation fails, the closure stays committed and the failure is visible to the Owner. | Proposed |
| R-10 | Agent 3 BCR-B3-01 | A calling-outcome state model would need a **new ID**, and the user previously approved the inventory without one. → USER: approve `SM-OUTCOME-001`, or keep outcome changes as a table inside WF-CALL-003. Until decided, it stays a table. | → USER |
| R-11 | Agent 4 BCR-03 / Batch 1 T-3 | Can an Owner session that is waiting for 2FA perform non-admin actions such as check-in? ART-01 only forbids admin access before 2FA. → USER. Until decided, both readings are shown. | → USER |
| R-12 | Agent 4 T-1 | DEC-005 Alt 2 (closed-deal-only access) conflicts with Developers recording signature and payment before closure (Board 01 "Owner and Developer [Confirmed: REQ-PROJ-004]"). Recorded as a **decision interaction** between DEC-005 and DEC-006. → USER. | → USER |
| R-13 | Agent 4 BCR-01 | SM-MEETING-001: "rescheduled" is an event, not a state. The "Missed" state stays Proposed for review. | Proposed |

## 11. Terminology additions (SB-2, Proposed)

| Term | Meaning |
|---|---|
| Edit history | Field-level before/after history of a business, visible to users who pass the Access check for that business |
| Audit trail | Owner-only, append-only log of security and operational events (G3) |
| Context-limited access | Access to only the fields a context needs (e.g. a Developer seeing business phone numbers and notes through an eligible closed deal), without directory browsing |
| Deal record | Commercial record created when outcome Accepted is finalized (E5). It is in stage "Accepted opportunity" until it progresses. A closed deal is a deal record that is accepted + signed + paid |
| Meeting | A scheduled developer/client discussion attached to a deal record (SM-MEETING-001) |
| Not proceeding | Proposed commercial end stage for a deal record that does not close (Agent 4). Its name and transitions are Proposed (no DEC ID) |
| Development workload | **Single definition (housekeeping, 2026-10-20; Proposed):** a derived snapshot per Developer with three sub-counts: (1) deal records in a non-terminal commercial stage where they are the assigned Developer, (2) projects in an active status (Scheduled, In progress, Waiting for client, Blocked) where they are assigned, (3) open tasks assigned to them. Assignment events (`opportunity.developer_assigned`, `project.developer_assigned`) are history only and are not counted as workload |
