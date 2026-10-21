# Phase 4 — Canonical Screen Inventory (SCR)

Owner: IA Agent (W0). Version: P4-INV-1, 2026-10-20. Status: **proposed — for user review, not approved.**
Figma design file `GNrhb3DWa6mIhEX6F4Nmvw`: page `02 Screen Inventory` (`1:3`) shows this table; page `01 Sitemap & Navigation` (`1:2`) shows the navigation; page `03 Wireframe Kit` (`1:4`) holds the components.

## 0. Authority and status

- **The original screen inventory (ART-07) is unavailable.** Phase 2 assigned no SCR IDs (SB-3 §1). **From now on, this document is the canonical screen inventory.** It supersedes ART-07. Any SCR ID used elsewhere must be listed here.
- **Three IDs are preserved from Board 01 with their meanings:**
  - `SCR-OWN-004`: Owner attendance monitoring and exception alerts.
  - `SCR-CC-005`: Call Center contact reservation and concurrency block.
  - `SCR-DE-006`: Data Entry correction-request queue.
- **ID scheme (brief §5):** `SCR-<ROLE>-nnn`. ROLE ∈ {AUTH, SHR, OWN, DE, CC, DEV}. The ROLE prefix shows the main role or home section. It does not grant access: the **Role(s)** column and WF-ACCESS-001 decide access. `SHR` means used by more than one role.
- **Sources:** product description (ART-01 §2, §4–§18), Phase 2 baseline SB-3 (contracts A–G, rulings R-01..R-13), the Phase 2 inventory (§2–§4), and the Batch 1–4 specs.
- **No policy is decided here.** Policy-dependent elements list their DEC ID, or "(no DEC ID)" with the artifact-register or contract reference. Wireframes must label them visibly, e.g. `[DEC-012 pending: summary mandatory?]`, using `wf/Annotation/Policy`.
- **Contract A1:** no screen gates work actions on check-in. "Attendance gating: not adopted."

## 1. Legend

| Column | Meaning |
|---|---|
| Desk / Mob | Wireframe priority. **P1** = core, frame required. **P2** = frame required, lower priority. **—** = no frame required (the screen is still responsive in build). W1–W3 draw a mobile frame for every screen marked P1 or P2 in Mob. |
| Page / Agent | Wireframe page and writer: W1 → 10 Shared (`1:5`) and 11 Owner/Admin (`1:6`); W2 → 12 Data Entry (`1:7`) and 13 Call Center (`1:8`); W3 → 14 Developer (`1:9`) and 15 Cross-cutting States (`1:10`) |
| Roles | OWN = Owner/Admin, DE = Data Entry, CC = Call Center, DEV = Developer, ALL = all four. "(read)" = view only. "(ctx)" = context-limited access (SB-3 §11) |
| Key states | States the wireframe must show (brief §6 list), plus screen-specific ones |

Totals: **54 screens**. AUTH 4 · SHR 15 · OWN 12 · DE 7 · CC 8 · DEV 8.
By page: 10 → 10 · 11 → 12 · 12 → 10 · 13 → 8 · 14 → 8 · 15 → 6.

## 2. Authentication (W1 · page 10)

| SCR ID | Name | Roles | Purpose | UC / WF | Key actions | Key states | Desk | Mob | Policy-dependent elements |
|---|---|---|---|---|---|---|---|---|---|
| SCR-AUTH-001 | Login | ALL | Email/password sign-in; logout returns here | UC-AUTH-001, UC-AUTH-008 · WF-AUTH-001 | Sign in; "Forgot password"; show/hide password | Validation error; invalid credentials (generic message); deactivated account; session expired (return notice); loading | P1 | P1 | Lockout/throttle wording is an implementation decision (no DEC ID) |
| SCR-AUTH-002 | Owner 2FA challenge | OWN | Second factor before any admin access | UC-AUTH-002 · WF-AUTH-001 | Enter code; use recovery path; sign out | Pending-2FA restricted session; wrong/expired code; verification failure; success | P1 | P1 | 2FA method (implementation decision); R-11 → USER: may a pending-2FA Owner check in? Show both readings |
| SCR-AUTH-003 | Owner 2FA enrollment & recovery | OWN | Enroll a second factor; recover lost factor | UC-AUTH-003 (003A/003B) · WF-AUTH-002 | Start enrollment; confirm code; save recovery codes; recover | Enrollment required (forced); verification failure; recovery used; success | P1 | — | 2FA method and recovery channel (implementation decision) |
| SCR-AUTH-004 | Forgot / reset password | ALL | Self-service reset by email link; set a new password | UC-AUTH-004 · WF-AUTH-002 | Request link; set new password | Request sent (neutral message); link expired/used; password rule error; success → login | P1 | P1 | Password rules (implementation decision) |

## 3. Shared — profile, attendance, my work (W1 · page 10)

| SCR ID | Name | Roles | Purpose | UC / WF | Key actions | Key states | Desk | Mob | Policy-dependent elements |
|---|---|---|---|---|---|---|---|---|---|
| SCR-SHR-001 | My Day (role home) | DE, CC, DEV (OWN via desktop nav "My Day (check in)" in `wf/Shell/Desktop/Owner` and mobile My Day tab — RW-02) | One place for today: attendance panel (timer, 9 h progress), targets, work list, due follow-ups / tasks per role | UC-ATT-001/002 (entry), UC-ATT-006, UC-ATT-007 · WF-ATT-001, WF-ATT-002, WF-WORK-001 | Check in / Check out (→ SHR-002/003); open a work item; view target progress | Not checked in; checked in; open session from earlier day (blocked → WF-ATT-003); empty work list; insufficient work (shortfall) | P1 | P1 | Target metrics DEC-020; allocation frequency DEC-025; work-list rule DEC-021; 9 h/day DEC-007; **A1: attendance gating not adopted** (work list usable without check-in) |
| SCR-SHR-002 | Check-in flow | ALL | Start attendance with office verification; show punctuality | UC-ATT-001, UC-ATT-003 · WF-ATT-001 | Check in; retry verification; (remote exception path) | Verifying; success + punctuality (On time / Late / Unclassified / Non-working day, all *derived*); **verification failure**; open-session block; remote exception recorded | P1 | P1 | Office check mode DEC-009 (IP / location / OR / AND); remote work DEC-010; schedule DEC-007; grace DEC-008; rest days DEC-022; R-11 (Owner pending 2FA) |
| SCR-SHR-003 | Checkout + work summary | ALL | End attendance; record work summary | UC-ATT-002, UC-ATT-003 · WF-ATT-002 | Enter summary; check out; retry verification | Summary empty; verification failure → policy branch; closed; closed provisionally / pending review (alternatives) | P1 | P1 | Summary mandatory? DEC-012; failed checkout DEC-026 Alt A blocked / Alt B provisional / Alt C pending review (none selected); DEC-009 |
| SCR-SHR-004 | My Attendance history | ALL | Own sessions, hours, punctuality, open problems | UC-ATT-004, UC-ATT-005 · WF-ATT-001/002/003 | Filter by period; open a session; request correction (Alt B only) | Empty; forgotten checkout flagged; provisional/pending-review rows (if adopted); correction pending/approved/rejected | P1 | P2 | Correction authority DEC-011 (button exists only under Alt B); DEC-026 states; DEC-007 |
| SCR-SHR-005 | Attendance correction request (drawer) | ALL (requester) | Employee asks the Owner to fix a session | UC-ATT-005 · WF-ATT-003 Part 2 (Alt B) · SM-CORRECTION-001 | Propose times; reason; submit; withdraw | Validation error; submitted (pending); approved / rejected with reason | P2 | P2 | **Whole screen exists only if DEC-011 Alt B is selected**; F-01 (pending request may block next check-in) |
| SCR-SHR-006 | My Profile | ALL | Self-profile update, change password, sign out | UC-AUTH-007, UC-AUTH-008 · WF-EMP-001 (alt path), WF-AUTH-001 | Edit permitted fields; change password; sign out (all sessions?) | Validation error; save conflict; success | P2 | P2 | Which fields are self-editable (no DEC ID; ART-01 §3); theme toggle light/dark (UX, not policy) |

## 4. Owner/Admin (W1 · page 11)

| SCR ID | Name | Roles | Purpose | UC / WF | Key actions | Key states | Desk | Mob | Policy-dependent elements |
|---|---|---|---|---|---|---|---|---|---|
| SCR-OWN-001 | Owner dashboard | OWN | Company-wide operational overview (ART-01 §15) | UC-REP-001, UC-REP-002 · WF-REPORT-001 | Filter (date, employee, role…); compare periods; drill down; export (→ OWN-009) | Loading; no data; partial data; G1 distinctions labelled (attempts ≠ businesses contacted; accepted ≠ closed; closed ≠ completed project; not checked in ≠ absent) | P1 | — | Target metrics DEC-020; Development workload (SB-3 §11 definition, Proposed); revenue not shown (DEC-018); punctuality needs DEC-007/008/022 |
| SCR-OWN-002 | Employees | OWN | Employee directory (Owner only) | UC-AUTH-005, UC-AUTH-006 · WF-EMP-001 | Search; filter by role/status; create; open | Empty; active / deactivated (account state ≠ session state); assigned-to-inactive flags | P1 | — | Effect of deactivation on assignments: Owner decision, no automatic rule |
| SCR-OWN-003 | Employee create / edit (drawer) | OWN | Create, edit, change role, deactivate, reactivate; trigger reset assistance | UC-AUTH-005, UC-AUTH-006 · WF-EMP-001, WF-AUTH-002 | Save; change role (one role per employee); deactivate + revoke sessions (confirm dialog); send reset link | Validation error (duplicate email); save conflict; deactivate impact (open assignments, follow-ups, reservations listed); success | P1 | — | Handling of the deactivated employee's open work (no DEC ID; Owner decides) |
| **SCR-OWN-004** | **Attendance monitoring & exception alerts** (preserved ID) | OWN | Live company attendance: checked in / out, missing check-in, missing checkout, late, remote, open review items | UC-ATT-001/002/004 · WF-ATT-001, WF-ATT-002, WF-ATT-003 Part 1, WF-NOTIFY-001 | Filter by day/employee; open exception; jump to correction (→ OWN-005) | Empty (no exceptions); schedule not configured (punctuality Unclassified); alert delivery failed; G1: "not checked in" ≠ absent | P1 | P1 | Missing check-in threshold DEC-007/008/022; recipients and timing of alerts (no DEC ID); DEC-010 remote |
| SCR-OWN-005 | Attendance corrections & review queue | OWN | Owner fixes sessions; reviews employee requests and failed-checkout items | UC-ATT-004, UC-ATT-005 · WF-ATT-003 Part 2, WF-ATT-002 | Enter corrected times + reason; approve / reject request (reason) | Empty queue; validation error; save conflict; success (audit noted) | P1 | — | DEC-011 Alt A (Owner-only edit) vs Alt B (request queue tab); DEC-026 Alt B/C review items |
| SCR-OWN-006 | Targets & work lists | OWN | Assign targets and work lists (manual / automatic proposal) | UC-ATT-006, UC-ATT-007 · WF-WORK-001 | Set targets per role; generate list; review proposal; adjust; reassign; hand off Call Center items to WF-CALL-001 (B8) | Insufficient work (shortfall); ineligible items with reason; empty | P1 | — | Metrics DEC-020; automatic allocation DEC-021 (Proposed); frequency DEC-025; R-03/B8 hand-off |
| SCR-OWN-007 | Calling assignments | OWN | Assign / reassign / unassign businesses to Call Center agents; view any agent's queue | UC-CALL-001, UC-CALL-008 · WF-CALL-001 Part 1 | Multi-select + assign; reassign (reason); unassign; open agent queue (CC-001 in Owner view); decide B7 items | Ineligible items excluded with reason (B1/B2/B4/B6); **assigned but inaccessible** (B7, derived); assigned to inactive agent (derived); save conflict; reserved by another agent | P1 | — | DEC-021 automatic allocation; DEC-017 open-deal re-queue (B6); C-01 archived (B4); phone mandatory (B2, no DEC ID); DEC-001/002 for B7 |
| SCR-OWN-008 | Reassignment impact (dialog) | OWN | Show and resolve the impact of a reassignment before saving | UC-CALL-008, UC-CALL-010 · WF-CALL-001, WF-CALL-002 (override), WF-FOLLOW-001 | Per follow-up: transfer / cancel (reason) / keep (with warning); active reservation: wait / override; confirm | Active reservation present; open follow-ups; "callback to be scheduled" marker; developer not yet assigned; save conflict | P1 | — | Follow-up handling on reassignment (no DEC ID, B3-Q03; no default); override rules DEC-004 (Proposed); previous agent informed? (no DEC ID) |
| SCR-OWN-009 | Reports & exports | OWN | Build filtered reports; export Excel / CSV / PDF | UC-REP-002, UC-REP-003 · WF-REPORT-001 | Choose report and filters; export (format); download | Unauthorized (non-Owner); no data → nothing exported; export failure; generating (if async); audit notice | P1 | — | Export scope DEC-002; sync vs async (Phase 3 ADR); revenue fields DEC-018 |
| SCR-OWN-010 | Audit log explorer | OWN | Read-only, append-only audit trail | UC-REP-004 · WF-REPORT-002 | Filter by actor, entity, event, date; open event detail; export (audited) | Empty; loading; event detail (before/after); no edit actions anywhere (G3) | P1 | — | Retention (no DEC ID; recovery/retention operational decision) |
| SCR-OWN-011 | Settings | OWN | Attendance schedule, timezone, grace, working days, office IP / geofence; company and security settings | UC-REP-005 · WF-ADMIN-001 | Edit and save each settings group; test office check | Not configured (punctuality Unclassified); validation error; save conflict; success | P1 | — | DEC-007, DEC-008, DEC-009, DEC-022; DEC-010 remote; Owner 2FA is mandatory (Confirmed, not a setting) |
| SCR-OWN-012 | Delivery & exception monitor | OWN | Failed or suppressed reminders / notifications (D6) and failed project provisioning (F3) | — (no Board 01 UC) · WF-NOTIFY-001, WF-DEAL-002 | Filter by type; open item; retry; mark reviewed | Empty; failed; suppressed (recipient inactive or no access, C6); retrying | P2 | — | Notification timing, recipients, escalation (no DEC ID); retry policy (Phase 3); provisioning trigger F2 |

## 5. Data Entry and business records (W2 · page 12)

| SCR ID | Name | Roles | Purpose | UC / WF | Key actions | Key states | Desk | Mob | Policy-dependent elements |
|---|---|---|---|---|---|---|---|---|---|
| SCR-DE-001 | Business directory | DE, OWN (all incl. hidden), CC/DEV only within WF-ACCESS-001 scope | List and filter businesses the user may see | UC-BIZ-008 · WF-ACCESS-001 | Search; filter (category, phone, creator, website, social metrics, correction status…); open; add (→ DE-002) | Empty; loading; Owner-only "hidden for others" marker; correction-requested flag | P1 | P2 | 15-day timer DEC-001; exceptions DEC-002; archive filter C-01 |
| SCR-DE-002 | Create business | DE, OWN | Enter a new business with validation and duplicate check | UC-BIZ-001 · WF-BIZ-001 | Fill name, category, phones, ≥1 social account, website, notes, manual metrics; save | Validation errors; **duplicate blocked** (→ DE-003); success | P1 | P2 | Phone mandatory? (no DEC ID, B2); unknown metrics DEC-014; follower granularity DEC-023; platform priority DEC-024; category creation DEC-015 |
| SCR-DE-003 | Duplicate blocked (dialog) | DE, OWN (all roles that create or edit) | Block a duplicate save; show the match the user may see | UC-BIZ-002, UC-BIZ-003 · WF-BIZ-001, WF-ACCESS-001 (duplicate preview) | Open visible match; request escalation (hidden match); cancel | Visible match; hidden match (limited preview); no bypass action exists | P1 | — | Hidden-match revelation DEC-003; name-only / branch rule DEC-013 |
| SCR-DE-004 | Edit business | DE, OWN | Change master data with revalidation | UC-BIZ-004 · WF-BIZ-002 Part A | Edit fields; save; view edit history | Duplicate blocked (self-excluded check); **save conflict** (→ SHR-014); validation error; success | P1 | — | DEC-013; DEC-014; deletion vs archiving C-01 (no delete button for DE) |
| SCR-DE-005 | Resolve correction (drawer) | DE, OWN | Fix master data from a correction request, or reject it | UC-BIZ-006 · WF-BIZ-002 Part B · SM-DATAFIX-001 | Open business edit; resolve with note; reject with reason | Already resolved by someone else (conflict); duplicate blocked on edit; success | P1 | — | Who resolves (DE and/or Owner, no DEC ID); notification recipients (no DEC ID) |
| **SCR-DE-006** | **Correction-request queue** (preserved ID) | DE, OWN | Work queue of data-correction requests | UC-BIZ-005, UC-BIZ-006 · WF-BIZ-002 Part B | Filter (status, requester, age); open (→ DE-005) | Empty; open / resolved / rejected; business hidden for viewer (request still listed?) | P1 | — | DEC-002 (open correction request as visibility exception) |
| SCR-DE-007 | Categories | OWN (DE conditional) | Manage the dynamic category list | UC-BIZ-007 · WF-BIZ-003 | Add; rename; deactivate/merge | Name exists; in use (cannot remove); permission denied for non-owner | P2 | — | Category authority DEC-015; delete vs archive C-01 |
| SCR-SHR-008 | Business detail | DE, OWN; CC (assigned, read); DEV (ctx) | One business record: master data, phones, socials, website, notes, edit history, related context | UC-BIZ-008, UC-BIZ-004 (entry), UC-PROJ-001 (ctx) · WF-ACCESS-001, WF-BIZ-002 | Edit (DE/OWN); flag incorrect data (→ SHR-009); view history | **Record hidden by policy** (→ SHR-012); permission denied; read-only for CC; context-limited fields for DEV; correction pending flag | P1 | P2 | DEC-001, DEC-002, DEC-005 (DEV before closure); R-06 related resources |
| SCR-SHR-009 | Submit data correction (drawer) | CC, DEV, OWN (DE edits directly) | Flag wrong business master data | UC-BIZ-005 · WF-BIZ-002 Part B | Pick field(s); describe; submit | Validation error; duplicate open request warning; submitted | P1 | P2 | Recipients and notification (no DEC ID) |
| SCR-SHR-010 | Search results | ALL (scoped) | Global business search; results respect access | UC-BIZ-008 · WF-ACCESS-001 | Search by name / phone / social handle; open result | Empty; results omitted by policy (no hint of existence for non-owners); Owner sees hidden markers | P2 | — | DEC-001/002; DEC-003 (no leakage through search) |

## 6. Call Center (W2 · page 13)

| SCR ID | Name | Roles | Purpose | UC / WF | Key actions | Key states | Desk | Mob | Policy-dependent elements |
|---|---|---|---|---|---|---|---|---|---|
| SCR-CC-001 | Calling queue | CC (own); OWN (any agent) | Assigned businesses grouped into derived buckets | UC-CALL-001 · WF-CALL-001 Part 2 | Filter by bucket; open business (→ CC-002); Owner: switch agent | Buckets (all *derived*): New assignments, Requires contact, Callback to be scheduled, Callbacks due today, Overdue follow-ups, Data correction requested, Rejected (view only); empty queue; Owner view lists "assigned but inaccessible" (B7) | P1 | P1 | Overdue threshold (no DEC ID); DEC-001/002 hidden items; A1 (no check-in required) |
| SCR-CC-002 | Contact workspace | CC, OWN | Read view of one assigned business before and between contacts | UC-CALL-001, UC-CALL-002 · WF-CALL-001, WF-CALL-002 | Start Contact (acquire reservation); view history, outcome, follow-ups, notes; flag incorrect data (→ SHR-009) | Read mode; Start Contact disabled (Rejected; not assignee); hidden by policy | P1 | P1 | DEC-004 reservation rules |
| SCR-CC-003 | Active contact — log attempt & outcome | CC, OWN | Record a call attempt and finalize the calling outcome under a reservation | UC-CALL-003, UC-CALL-005, UC-CALL-007, UC-CALL-010 · WF-CALL-003, WF-CALL-002 | Notes; outcome (Pending, On hold, Needs another call, Rejected, Accepted); schedule follow-up in same save (D2); renew; release | Reservation timer; renew failed / expired / network loss (→ CC-005); "callback to be scheduled" marker; Accepted → deal record created (E5), developer optional (E3); save failed | P1 | P1 | Lease and idle rule DEC-004; open follow-ups on Rejected/Accepted D4 (no DEC ID); DEC-005 handoff access; outcome model R-10 → USER |
| SCR-CC-004 | Follow-ups & calendar | CC (own), OWN (all) | Callback commitments in list and week calendar | UC-CALL-004, UC-CALL-009 · WF-FOLLOW-001 | Open; reschedule; complete; cancel (reason); switch list/week | Due today / overdue (*derived*); reminder failed (follow-up unaffected, D5); empty | P1 | P1 | Reminder lead time, overdue threshold, escalation (no DEC ID); DEC-002 Alt B (callback + 48 h) |
| **SCR-CC-005** | **Contact reservation & concurrency block** (preserved ID) | CC, OWN | All reservation conflicts and recovery | UC-CALL-002, UC-CALL-010 · WF-CALL-002 | Wait / back to queue; retry; Owner force override (confirm + reason) | **Reserved by another agent** (holder, since); reservation expired; stale client; renew failed / network loss; overridden by Owner (notice to holder) | P1 | P1 | DEC-004 lease duration and idle rule (Proposed); Owner override [Proposed] |
| SCR-CC-006 | Follow-up create / reschedule (drawer) | CC, OWN | Create or change a callback commitment | UC-CALL-004, UC-CALL-009 · WF-FOLLOW-001 | Date/time; responsible user; note; save | Past time rejected; validation error; save conflict; success | P1 | P1 | Reminder timing (no DEC ID) |
| SCR-CC-007 | Opportunities & developer handoff | CC, OWN | Accepted opportunities created from calls; assign a Developer; arrange the first meeting | UC-CALL-007, UC-DEAL-001, UC-DEAL-004 · WF-DEAL-001, WF-CALL-003 | Assign / reassign Developer; edit handoff context; schedule meeting (→ DEV-004) | **Developer not yet assigned** (E3, visible to Owner); meeting not yet arranged (*derived*); success | P1 | — | Developer access before closure DEC-005; multiple deals per business DEC-017 |
| SCR-CC-008 | Do-not-call list & reopening | CC (read), OWN | Rejected businesses; controlled reopening | UC-CALL-005, UC-CALL-006 · WF-REJECT-001 | View; request / perform reopen (reason) | Start Contact disabled; reopen not permitted for this role; reopened → back to eligibility | P2 | — | Reopening authority DEC-016 |

## 7. Developer (W3 · page 14)

| SCR ID | Name | Roles | Purpose | UC / WF | Key actions | Key states | Desk | Mob | Policy-dependent elements |
|---|---|---|---|---|---|---|---|---|---|
| SCR-DEV-001 | Deals | DEV, OWN | Company-wide eligible closed deals; accepted opportunities where permitted | UC-PROJ-001, UC-DEAL-001 · WF-DEAL-001, WF-DEAL-002, WF-ACCESS-001 | Filter by stage, developer, date; open (→ DEV-002) | Stages: Accepted opportunity, Signed, Paid, Signed and paid, Closed deal, Not proceeding (Proposed); developer not yet assigned; project provisioning pending (*derived*, F3); empty | P1 | — | DEC-005 Alt 1 / Alt 2; DEC-017; commercial transitions (no DEC ID) |
| SCR-DEV-002 | Deal record detail | DEV, OWN; CC (handoff context) | One deal: stage, signature / payment facts, handoff context, meetings, context-limited business info | UC-DEAL-001, UC-DEAL-002 · WF-DEAL-002, WF-DEAL-001 | Record signature; record payment; request closure verification (Alt B); mark not proceeding (reason); Owner: remove fact entered in error | Each stage; closure verification requested / rejected (DEC-006 Alt B); save conflict; hidden by policy | P1 | — | Closure authority DEC-006; evidence and financial fields DEC-018; R-12 → USER (DEC-005 Alt 2 × DEC-006); signature/payment order (Proposed) |
| SCR-DEV-003 | Meetings & calendar | DEV, CC, OWN | Developer meetings in list / week calendar | UC-DEAL-004, UC-DEAL-001 · WF-DEAL-001 · SM-MEETING-001 | Open; reschedule; cancel; record held / missed | Upcoming / awaiting outcome (*derived*); Missed (Proposed state); reminder failed; empty | P1 | P2 | DEC-005 (who may schedule); reminder timing (no DEC ID) |
| SCR-DEV-004 | Meeting schedule / record (drawer) | DEV, CC, OWN | Schedule or reschedule a meeting; record outcome and discovery notes | UC-DEAL-004, UC-DEAL-001 · WF-DEAL-001 | Date/time, attendees, note; save; record held + discovery notes; record missed | Past time rejected; ≥1 attendee; previous values kept on reschedule; success | P1 | P2 | DEC-005; "Missed" state Proposed (R-13) |
| SCR-DEV-005 | Projects | DEV, OWN | Delivery projects and Development workload | UC-PROJ-001, UC-PROJ-003 · WF-PROJ-001 | Filter by status / developer; open board (→ DEV-006) | Status (Scheduled, In progress, Waiting for client, Blocked, Delivered, Completed — Proposed); delivery overdue (*derived*); empty | P1 | — | Project statuses DEC-019 (Proposed); workload definition SB-3 §11 (Proposed) |
| SCR-DEV-006 | Project board | DEV, OWN | One project: status, schedule, task kanban, deal context | UC-PROJ-003, UC-PROJ-004 · WF-PROJ-001 · SM-PROJECT-001, SM-TASK-001 | Change project status (reason where needed); change schedule; add / move task; assign developer (Owner) | Open-task warning on Delivered/Completed; Completed = read-only; save conflict; hidden by policy | P1 | P1 | DEC-019; cancelled project not modelled (OQ-11); reopen (OQ-15) |
| SCR-DEV-007 | Task detail (drawer) | DEV, OWN | Update one task | UC-PROJ-004 · WF-PROJ-001 · SM-TASK-001 | Status (To do, In progress, Done, Cancelled — Proposed); owner; dates; cancel reason; reopen | Overdue (*derived*); validation error; save conflict; success | P1 | P1 | Task statuses (no DEC ID); task counts for targets DEC-020 |
| SCR-DEV-008 | Finalize closure & provision project (dialog) | DEV, OWN (per DEC-006) | Close a Signed-and-paid deal; create or link the project | UC-DEAL-003, UC-PROJ-002 · WF-DEAL-002 | Confirm closure; provision project (manual) or see automatic result | Not allowed (missing fact / role); closure saved but provisioning failed (F3, visible to Owner); success | P1 | — | DEC-006; provisioning trigger F2 (auto vs manual); DEC-017 cardinality; DEC-018 evidence |

## 8. Cross-cutting (W3 · page 15)

| SCR ID | Name | Roles | Purpose | UC / WF | Key actions | Key states | Desk | Mob | Policy-dependent elements |
|---|---|---|---|---|---|---|---|---|---|
| SCR-SHR-007 | Notifications | ALL | In-app list of the user's notifications | — (no Board 01 UC) · WF-NOTIFY-001 | Open target (re-checked by WF-ACCESS-001); mark read | Empty; target no longer accessible (hidden by policy); email-only events shown? | P2 | P2 | In-app presentation, timing, recipients (no DEC ID); C6 re-check at send time |
| SCR-SHR-011 | Permission denied | ALL | The actor's role or action is not allowed | all · WF-ACCESS-001 (VT-6 outcomes) | Back; go home | Role denied; Owner without completed 2FA → AUTH-002 | P1 | P2 | — |
| SCR-SHR-012 | Record hidden by policy | non-owner roles | Record exists but is outside the user's access; no business data shown | UC-BIZ-008, UC-BIZ-003 · WF-ACCESS-001 | Back; (request access / escalation if adopted) | Direct URL; stale link from notification or calendar | P1 | P2 | DEC-001, DEC-002, DEC-003 |
| SCR-SHR-013 | Session expired / signed out | ALL | Session ended (expiry, revocation, deactivation) | UC-AUTH-008 · WF-AUTH-001 · SM-SESSION-001 | Sign in again; unsaved-input notice | Expired; revoked by Owner; account deactivated | P1 | P2 | Session lifetime (implementation decision) |
| SCR-SHR-014 | Save conflict | ALL editing roles | Someone else changed the record since it was opened | UC-BIZ-004 (+ any edit) · WF-BIZ-002, WF-CALL-001, WF-PROJ-001, WF-DEAL-002 | Reload; review changes; re-apply my edits | Field-level diff; nothing overwritten | P1 | P2 | — |
| SCR-SHR-015 | System state patterns | ALL | Reference sheet: loading, empty, validation error, save failed, network offline, success toast | all | — | All brief §6 states not covered by a dedicated screen | P1 | P2 | — |

## 9. Coverage — every Phase 2 workflow → screens

| WF | Home screen(s) | Other screens |
|---|---|---|
| WF-AUTH-001 | SCR-AUTH-001, SCR-AUTH-002 | SCR-SHR-013, SCR-SHR-006 (sign out), SCR-SHR-011 |
| WF-AUTH-002 | SCR-AUTH-004, SCR-AUTH-003 | SCR-OWN-003 (Owner-triggered reset), SCR-SHR-006 |
| WF-EMP-001 | SCR-OWN-002, SCR-OWN-003 | SCR-SHR-006 (self-profile alt path) |
| WF-ATT-001 | SCR-SHR-002 | SCR-SHR-001, SCR-SHR-004, SCR-OWN-004 |
| WF-ATT-002 | SCR-SHR-003 | SCR-SHR-001, SCR-OWN-005 (DEC-026 review items) |
| WF-ATT-003 | SCR-OWN-005 | SCR-OWN-004 (detection), SCR-SHR-004, SCR-SHR-005 (Alt B) |
| WF-ADMIN-001 | SCR-OWN-011 | — |
| WF-WORK-001 | SCR-OWN-006 | SCR-SHR-001 (work list view) |
| WF-BIZ-001 | SCR-DE-002 | SCR-DE-003 |
| WF-BIZ-002 | SCR-DE-004, SCR-DE-006 | SCR-DE-005, SCR-SHR-009, SCR-SHR-008, SCR-SHR-014 |
| WF-BIZ-003 | SCR-DE-007 | — |
| WF-ACCESS-001 | SCR-SHR-008 | SCR-DE-001, SCR-SHR-010, SCR-SHR-011, SCR-SHR-012, SCR-DE-003 (duplicate preview) |
| WF-CALL-001 | SCR-OWN-007, SCR-CC-001 | SCR-OWN-008, SCR-CC-002 |
| WF-CALL-002 | SCR-CC-005 | SCR-CC-002, SCR-CC-003, SCR-OWN-008 (override) |
| WF-CALL-003 | SCR-CC-003 | SCR-CC-007 (Accepted) |
| WF-FOLLOW-001 | SCR-CC-004 | SCR-CC-006, SCR-OWN-008 |
| WF-NOTIFY-001 | SCR-SHR-007, SCR-OWN-012 | SCR-OWN-004 (alerts) |
| WF-REJECT-001 | SCR-CC-008 | SCR-CC-001 (Rejected bucket), SCR-CC-002 (disabled Start Contact) |
| WF-DEAL-001 | SCR-CC-007, SCR-DEV-003 | SCR-DEV-001, SCR-DEV-002, SCR-DEV-004 |
| WF-DEAL-002 | SCR-DEV-002 | SCR-DEV-001, SCR-DEV-008, SCR-OWN-012 (F3) |
| WF-PROJ-001 | SCR-DEV-006 | SCR-DEV-005, SCR-DEV-007 |
| WF-REPORT-001 | SCR-OWN-001 | SCR-OWN-009 |
| WF-REPORT-002 | SCR-OWN-010 | — |

**Result: all 23 Phase 2 workflows have a home screen. No coverage gap.**
- All 48 Board 01 use cases appear in the UC column (UC-AUTH-001..008, UC-ATT-001..007, UC-BIZ-001..008, UC-CALL-001..010, UC-DEAL-001..004, UC-PROJ-001..004, UC-REP-001..005).
- **UC-REP-006** (backup and recovery) moved to Phase 3D. It has no application screen. This is intentional, not a gap.
- WF-NOTIFY-001 and SCR-OWN-012 have no Board 01 UC. That gap was already recorded in Phase 2 §4.

**State-model touchpoints (for reviewers):** SM-ACCOUNT-001 → OWN-002/003. SM-SESSION-001 → AUTH-001/002, SHR-013. SM-ATTENDANCE-001 → SHR-002/003/004, OWN-004/005. SM-CORRECTION-001 → SHR-005, OWN-005. SM-ASSIGNMENT-001 → OWN-007/008. SM-RESERVATION-001 → CC-003/005. SM-FOLLOWUP-001 → CC-004/006. SM-REMINDER-001 → OWN-012, SHR-007. SM-DATAFIX-001 → DE-005/006, SHR-009. SM-COMMERCIAL-001 → DEV-001/002/008, CC-007. SM-MEETING-001 → DEV-003/004. SM-PROJECT-001 → DEV-005/006. SM-TASK-001 → DEV-006/007. SM-VISIBILITY-001 → SHR-008/010/011/012, DE-001.

## 10. Wireframe kit — component reference (page `03 Wireframe Kit`, `1:4`)

W1–W3 **instantiate** these components. They do not edit or detach the masters. Override text through component properties (`Label`, `Title`, `Body`, `Value`, `Col 1…`). Nested buttons, badges and inputs are exposed instances.

| Group | Component (node ID) |
|---|---|
| Shells | wf/Shell/Desktop/Owner `8:80` · /DataEntry `8:166` · /CallCenter `8:217` · /Developer `8:268` (1440×900). wf/Shell/Mobile/Owner `8:316` · /DataEntry `8:340` · /CallCenter `8:364` · /Developer `8:388` (390×844) |
| Bars & nav | wf/TopBar `7:177` · wf/Nav/Item `3:187` · wf/Nav/Item/Active `3:192` · wf/Nav/SectionLabel `3:197` · wf/Nav/MobileHeader `7:195` · wf/Nav/MobileTabBar `7:202` · wf/Nav/MobileTab `3:201` · wf/Nav/MobileTab/Active `3:206` |
| Buttons | wf/Button/Primary `3:48` · /Secondary `3:52` · /Ghost `3:56` · /Destructive `3:60` · /Disabled `3:64` · /Focused `3:68` |
| Inputs | wf/Input/Text `3:72` · /Focused `3:79` · /Error `3:86` · wf/Select `3:93` · wf/Input/Date `3:100` · /Search `3:107` · /Textarea `3:113` · wf/Checkbox `3:120` · wf/Checkbox/Checked `3:125` |
| Status & chips | wf/Badge/Status/Light `3:134` · /Mid `3:138` · /Dark `3:142` · /Outline `3:146` · /Derived `3:150` (dashed = derived) · wf/Badge/Count `3:154` · wf/Chip/Filter `3:158` · wf/Chip/Filter/Active `3:163` · wf/Tabs `3:168` · wf/Avatar `3:179` |
| Layout & data | wf/PageHeader `6:6` · wf/FilterBar `6:17` · wf/Table/Header `6:35` · wf/Table/Row `6:44` · wf/Card `6:55` · wf/Card/Stat `6:64` · wf/List/Item `6:70` · wf/Placeholder/Box `6:79` · wf/Placeholder/Chart `6:83` |
| Calendar & board | wf/Calendar/Event `6:101` · wf/Calendar/Week `6:105` · wf/Kanban/Card `6:141` · wf/Kanban/Column `6:148` |
| Overlays | wf/Drawer `7:137` (480×900) · wf/Dialog `7:164` (520) · wf/Overlay/Scrim `7:174` (1440×900) |
| Feedback & states | wf/Toast `7:46` · wf/Banner/Info `7:51` · /Warning `7:60` · /Error `7:69` · /Success `7:78` · wf/State/Empty `7:87` · /Loading `7:96` · /Error `7:105` · /Restricted `7:114` |
| Annotations | wf/Annotation/Policy `7:123` (use for every unresolved DEC item) · wf/Annotation/Note `7:129` |

Text styles: `wf/H1` (Inter Bold 24), `wf/H2` (Semi Bold 18), `wf/H3` (Semi Bold 16), `wf/Body` (Regular 14), `wf/Caption` (Regular 12).

**Assembly rule:** a desktop screen is a 1440×900 frame with a shell instance at (0,0) and a content frame at x 240, y 64 (1200×836; 24 px padding → 1152 wide content column). A mobile screen is a 390×844 frame with a shell instance and content at y 100 (390×680). To show the screen's own nav entry as active, swap that nav item instance to `wf/Nav/Item/Active` and the default one back to `wf/Nav/Item`. Drawers sit at x 960 over `wf/Overlay/Scrim`; dialogs are centred.

## 11. Verification
See [sitemap.md §7](sitemap.md#7-verification-ia-agent-w0-2026-10-20). It records what was created, read back and visually inspected, and what was not inspected, for both W0 docs and pages 01–03. Specific to this inventory:
- Page 02 contains all 54 SCR IDs (checked with grep on the get_metadata output).
- The coverage table was checked against the 23 workflows in Phase 2 §2.

## 12. Change log
- P4-INV-1 (2026-10-20): first canonical inventory. Supersedes the unavailable ART-07. Preserves SCR-OWN-004, SCR-CC-005 and SCR-DE-006.
