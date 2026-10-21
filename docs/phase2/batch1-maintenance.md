# Batch 1 Maintenance — Attendance and Work Allocation (Agent 1, task T1)

Baseline: SB-1 (`docs/phase2/shared-baseline.md`). Date: 2026-10-20.
Status: **DRAFT maintenance notes. Batch 1 itself is still not approved. No unresolved policy is selected here.**

**Method and limits (read first):**
- This is a document review of `docs/phase_2_workflows_and_state_machines.md` §7–§14, `docs/phase_2_batch1_mermaid.md`, `docs/product-description.md` (ART-01), `docs/decisions.md` (unapproved proposals only) and SB-1.
- No Figma/FigJam call was made. Board 02 was **not** re-read. Fill colours are not in the Mermaid source (colour lines were omitted), so colour/notation conformance for the drawn board cannot be confirmed here.
- Node counts and labels below come from the Mermaid source. Nothing has been tested; no software exists.
- "Proposed" repairs are not executed. Nothing in the Batch 1 docs or board was changed.
- New observations use local labels **N-1..N-n**. These are **not** F IDs and not DEC IDs; the orchestrator decides whether to adopt them.

---

## 1. Findings tracker (F-01..F-10)

Status vocabulary: **open**, **needs user decision**, **deferred to Phase 3**, **addressable now** (no policy decision needed).

| ID | Finding | Status | What exactly is needed | DEC ID |
|---|---|---|---|---|
| F-01 | DEC-011 Alt B may block next-day check-in | **Needs user decision** | The Confirmed rule (ART-01 §4.5) is that no new session opens while a previous one is open. Under Alt B the employee stays blocked until the Owner acts. The user must (a) select DEC-011 and, if Alt B, (b) say what happens while a request is pending and after a rejection (the employee is still blocked; Part 2 ends at "Original stands; employee informed" with no onward path), and (c) accept Owner-response expectations from the F-05 decision. Until then, draw the post-rejection state as policy-dependent (R-9). | DEC-011 (touches DEC-026 Alt C; alert timing has no DEC ID) |
| F-02 | Work summary under DEC-026 Alt B/C is not defined | **Needs user decision** (drawing the gap is addressable now) | In WF-ATT-002 the `failPolicy` branch happens **before** the summary step (`sumReq`), so provisional or pending-review sessions never collect a summary, even if DEC-012 later makes it mandatory. Needed: DEC-026 and DEC-012 selections, then a rule for when the summary is collected (at attempt, or at Owner resolution). Now: add a yellow "Summary handling (DEC-012, DEC-026)" node on the Alt B/C branches (R-7). | DEC-012, DEC-026 |
| F-03 | Punctuality after a check-in correction is not defined | **Needs user decision** | Decide whether punctuality is re-derived from the effective (corrected) check-in time or the original, and whether an "adjusted" marker is shown. Interacts with N-3 (derived vs settings applied to future sessions). | (no DEC ID; touches DEC-008, DEC-011) |
| F-04 | Owner exemption from the office check depends on ART-02 | **Open (blocked on missing source)** | SB-1 §4 fixes "NO Owner exemption" with evidence in ART-02, which is unavailable. Needed: ART-02 supplied, or the user confirms that rule. Batch 1 already treats the Owner as subject to the office check, which matches SB-1. Remote exceptions for the Owner stay with DEC-010. | (no DEC ID; touches DEC-009, DEC-010) |
| F-05 | Alert thresholds and recipients have no DEC ID | **Needs user decision** (cross-batch with Agent 3) | Missing check-in and missing checkout thresholds, recipients, escalation, and whether an "Owner review item" (DEC-026 Alt B/C) is a notification at all. Owned by the general "notification timing, recipients and escalation" question; WF-NOTIFY-001 (Batch 3) must carry it. `docs/decisions.md` D18 is an unapproved proposal only. | (no DEC ID) |
| F-06 | Concurrent check-in is enforced in Phase 3 | **Deferred to Phase 3** (plus one small drawing repair, R-4) | The rule is Confirmed ("exactly one Open session", scenario WF-ATT-001 #5). The mechanism (constraint/transaction) is a Phase 3 design. Phase 2 can show a "lost the race: open session exists" outcome in WF-ATT-001. | (no DEC ID) |
| F-07 | Swimlane approximation and regenerations | **Addressable now** (needs board-write authorization at a later checkpoint) | WF-ATT-001 v1 still uses role clusters (the layout the baseline now forbids) and has one long return edge. Rebuild with phase subgraphs. Also re-screenshot the two edits that were not re-inspected (§13: legend row in section 00; shortened SM-CORRECTION title) and the SM-ATTENDANCE-001 label near an edge. | none |
| F-08 | Audit names are proposed | **Addressable now** (docs); approval of names pending | The G2 table (§3.3) and a rename table (§3.2) are drafted here. Names stay Proposed until approved. Five Batch 1 names do not match `<entity>.<past_tense_verb>`. | none |
| F-09 | No late-arrival notification is required | **Open (informational; no repair)** | ART-01 §16 lists no late-arrival event; "Late arrivals" is a dashboard metric (§15). It becomes "needs user decision" only if the user wants a late alert. | (no DEC ID) |
| F-10 | Batch 2 dependency for "in scope" | **Open (cross-batch; resolves at integration)**; relabel is addressable now (R-3) | WF-WORK-001 `eligible` says "in scope". Per SB-1 C5 it must reference "Access check (WF-ACCESS-001)", evaluated for the **assignee**, not the Owner who is selecting (C1 would otherwise make everything in scope). Verify against Agent 2's WF-ACCESS-001 at integration. | DEC-001, 002, 005 live in WF-ACCESS-001, not in Batch 1 |

### 1.1 Additional observations (proposed new findings; not F IDs)

| Label | Observation | Evidence | Status |
|---|---|---|---|
| N-1 | **Dangling hand-off.** WF-ATT-002 sends "Closed provisionally" (Alt B) to `ownerItem[["Owner review via WF-ATT-003"]]`, but WF-ATT-003 Part 2 has no trigger for it. Triggers are only `t1` open-session block, `t2` missing-checkout flag, `t3` pending-review (Alt C) and `t4` wrong time. SM-ATTENDANCE-001 has "Closed provisionally → Closed: Owner confirms or corrects", also unreachable from Part 2. Spec §9 repeats the same four triggers. | Mermaid WF-ATT-002 `provDone -.-> ownerItem`; WF-ATT-003 Part 2 `trig` | **Addressable now** (add a trigger; R-6) |
| N-2 | **Missing check-in has no resolution path.** Part 1 hands both missing check-in and missing checkout to Part 2 (`review`), but Part 2 starts from "Owner opens session record" and validates "checkout after check-in". No session exists for a missing check-in. Whether a retroactive session may be created is not stated. | Mermaid Part 1 `alertIn --> dash --> review`; Part 2 `aOpen`, `validate` | **Needs user decision** (no DEC ID; touches DEC-011). Drawing it as policy-dependent is addressable now |
| N-3 | **"Derived" punctuality vs "settings apply to future sessions".** Spec says punctuality is derived and WF-ADMIN-001 says settings apply to future sessions (Proposed). If punctuality is computed on read from current settings, a schedule change rewrites history. The text needs to say which settings version a classification uses (the one effective at check-in). | Spec §9 WF-ATT-001 "Punctuality is derived"; WF-ADMIN-001 "Save" | **Addressable now** (wording; the "future sessions" rule is already marked Proposed) |
| N-4 | **Remote flag labelled derived but stored.** SM-ATTENDANCE-001 lists "remote flag" under "Not states (derived)", but WF-ATT-001 "Data changes" stores a remote flag on the session. It is an attribute set at check-in/checkout. | Spec §9 vs §10 | **Addressable now** (wording) |
| N-5 | **Missing SM transition.** Part 2 trigger `t4` ("Wrong time reported") and F-03 imply correcting the check-in time on a session that is still Open. SM-ATTENDANCE-001 has no Open to Open (adjusted) transition; only "correction sets checkout". | Mermaid SM-ATTENDANCE-001; Part 2 `validate` | **Addressable now** (R-8) |
| N-6 | **No "Save failed" branch** at WF-ATT-001 `record`, WF-WORK-001 `saveT` and `saveW`. SB-1 §7 requires labelled save outcomes; WF-ATT-002, Part 2 and WF-ADMIN-001 already have them. | Mermaid | **Addressable now** (R-4) |
| N-7 | **Withdraw path missing in Part 2.** SM-CORRECTION-001 has Submitted to Withdrawn (Proposed); the Part 2 diagram has no withdraw edge. | Mermaid Part 2 `bPending`; SM-CORRECTION-001 | **Addressable now** (draw as Proposed; R-9) |
| N-8 | **Owner 2FA not visible in WF-WORK-001.** WF-ADMIN-001 uses "Owner with completed 2FA?" but WF-WORK-001 `authz` says "Owner authorized?". ART-01 §3 / SB-1 §4: no Owner admin access before 2FA. Also: whether a pending-2FA Owner session may use **check-in** is not stated (spec WF-ATT-001 treats check-in as an employee action). | Mermaid; spec §9 preconditions | Label fix **addressable now**; the check-in question is cross-batch with SM-SESSION-001 (Agent 4). No DEC ID |
| N-9 | **Alt B/C audit duplication unclear.** WF-ATT-002 audits the failed attempt (`auditFail`) on every failure path, then Alt B/C produce a second status. SM-ATTENDANCE-001 maps each Alt to one event. Clarify: `attendance.checkout_failed` is emitted for all alternatives, and Alt B/C add a status event. | Mermaid WF-ATT-002; SM table rows 3–5 | **Addressable now** (R-8) |
| N-10 | **Deactivation interplay not covered** (open session, open correction request, targets, work lists when an employee is deactivated). Correctly not invented in Batch 1; it must come from WF-EMP-001 (Batch 4). | Spec §9 WF-WORK-001 "Not invented" | **Open** (cross-batch; §5) |

### 1.2 Policy dependencies in Batch 1 (none selected here)

| DEC | Batch 1 artifacts that depend on it |
|---|---|
| DEC-007 | WF-ATT-001 `schedOk`; WF-ADMIN-001 |
| DEC-008 | WF-ATT-001 `classify`; WF-ADMIN-001 |
| DEC-009 | WF-ATT-001 `verifyMode`, `verifyOk`; WF-ATT-002 `verify`; WF-ADMIN-001 `modeCheck` |
| DEC-010 | WF-ATT-001 `remoteOk`; WF-ATT-002 `remoteOk` |
| DEC-011 | WF-ATT-003 Part 2 `authority`; SM-CORRECTION-001 (exists only under Alt B); SM-ATTENDANCE-001 correction rows |
| DEC-012 | WF-ATT-002 `sumReq` |
| DEC-022 | WF-ATT-001 `workDay`; WF-ATT-003 Part 1 `workDay`; WF-ADMIN-001 |
| DEC-026 | WF-ATT-002 `failPolicy`; SM-ATTENDANCE-001 Alt B/C states; Part 2 trigger `t3` |
| DEC-020 / 021 / 025 | WF-WORK-001 `setTarget`, `rule`, `progress` (not attendance-selectable; listed for completeness) |

---

## 2. Contract A check

### 2.1 A1 — no gating of work-list access or work actions on attendance

**Verdict: compliant (no gate exists).** Presentation is not annotated, which leaves a reader ambiguity (see 2.3).

Evidence:
1. WF-WORK-001 Mermaid: the entry path is `start(["Owner opens targets and work lists"])` → `authz{"Owner authorized?"}` → `pickEmp` … → `view(["Employee views target, completed, remaining, overdue"])`. No node mentions attendance, check-in or "Open session". No edge enters `progress` or `view` from an attendance node.
2. Spec §9 WF-WORK-001 steps 1–7: no attendance precondition. Actors: "Owner, System, Assigned employee".
3. ART-01 §2.2, §2.3 and §2.4 each say the role can "view their targets, work list, and attendance" (or equivalent) with no check-in condition. This supports the non-gating reading of A1.
4. Attendance workflows block only attendance actions:
   - WF-ATT-001 `seeOpen` ("Notice: open session exists") blocks **check-in** only; it hands off to WF-ATT-003.
   - WF-ATT-002 closes the session and shows `daySum`; nothing revokes work-list access.
   - WF-ATT-003 Part 1 `stayOpen` ("Session stays open: no automatic close") has no effect on work actions.
5. The only coupling is presentational: WF-ATT-001 `panel` ("Active panel: timer, 9 h progress, work list") and ART-01 §4.1 step 7 ("Displays the employee's work list and target progress"). This is a **display after check-in**, not a gate.

### 2.2 A2 — progress counts actions by their own timestamp in company time, independent of attendance state

**Verdict: consistent, but not stated.** WF-WORK-001 says `progress["Count progress per DEC-020 (derived)"]` and spec step 7 "Progress is derived (DEC-020)". Neither mentions the timestamp basis nor independence from attendance state. Nothing contradicts A2: no Batch 1 node bounds counting by an attendance session window.

Points to make explicit (R-2):
- Actions performed outside an Open attendance session (before check-in, after checkout, during a stuck-open session) still count by their own timestamp.
- WF-ATT-002 `daySum` ("Completed-day summary shown") and ART-01 §4.4 ("Target progress" as a summary item) must read target progress by A2, **not** by the session window. No WF-ATT-002 node computes it today, so there is no conflict.
- "Company time" requires the timezone setting (WF-ADMIN-001, DEC-007). If unset, the day/period boundary is undefined. Show it as policy-dependent, parallel to the "Unclassified" punctuality outcome.
- A2 itself stays **Unresolved (DEC-020)**: the metric definitions are not decided. The note must not pick a metric.

### 2.3 Annotation gap

SB-1 A1: "Show 'attendance gating: not adopted' only where relevant." Batch 1 shows it nowhere. Relevant places: WF-WORK-001 (employee view) and WF-ATT-001 `panel`. Recommend R-1. This needs no user decision.

---

## 3. Baseline conformance check (SB-1)

### 3.1 Terminology (§5), notation (§7), layout

| Check | Result | Detail / repair |
|---|---|---|
| Calling outcome / assignment state terms | Conforms | WF-WORK-001 uses "not rejected" (calling outcome, Contract B1) and "Assigned to someone else" (assignment state). No `NEW_LEAD`. |
| "Session" ambiguity | **Minor gap** | Batch 1 says "open session" throughout (attendance session). WF-ADMIN-001 says "Owner session" (auth session; SM-SESSION-001 is Batch 4). Qualify as "attendance session" in labels (R-14). |
| "Correction" vs data-correction request (§5) | **Minor gap** | Spec mostly says "attendance correction". Mermaid Part 2 labels `bPending` "Request pending review" and `bNotify` "Notify Owner: correction awaiting review" drop "attendance" (the ART-01 §16 event is "attendance correction awaiting review"). Prefix to avoid confusion with the data-correction request (R-14). |
| G1 (no conflation) | Conforms | Part 1 flags missing check-in only on a scheduled working day and states a non-working day is not an absence. No "absent" label exists. Check-in/out and late are kept separate from call or deal metrics. |
| Notation: DEC marker | Conforms in text | DEC-xxx appears in labels (e.g. "(DEC-009, unselected)"). Colour not verifiable here. |
| Notation: derived | One gap | `unclassified` reads "Classify: Unclassified (pending DEC-007)" without "(derived)". Add it for consistency. |
| Notation: Alt A/B | Conforms in text | WF-ATT-002 `failAlt` and Part 2 `altA`/`altB`. |
| Notation: dotted, hand-off `[[...]]` | Conforms | Retry edges use `-.->`; `resolve`, `ownerItem`, `review`, `reassign` use `[[...]]`. |
| Decision-edge labels | Conforms (style note) | All decision edges are labelled. Several use Yes/No where SB-1 prefers descriptive pairs (e.g. `openExists`, `remoteOk`). Optional. |
| Save outcomes | **Gap** | Missing at WF-ATT-001 `record`, WF-WORK-001 `saveT` and `saveW` (N-6). |
| Node count (≤ ~25 per diagram) | Conforms | WF-ATT-001: 21. WF-ATT-002: 26 (borderline; acceptable at "~25"). WF-ATT-003 Part 1: 14. Part 2: 22. WF-ADMIN-001: 12. WF-WORK-001: 23. |
| Layout: `flowchart LR` with phase subgraphs, no role lanes | **WF-ATT-001 non-conforming** | WF-ATT-001 v1 still uses role clusters (`emp`, `sys`); the other five flowcharts use phase subgraphs (F-07). |
| State diagrams: `stateDiagram-v2`, no `note`/`classDef`/`style` | Conforms | Both SM diagrams comply in source. |
| Per-workflow fields (§7) | **Partial** | See 3.4. |
| ≥ 3 Given/When/Then for each critical workflow | Partial | WF-ATT-001: 5. WF-ATT-002: 3. WF-ATT-003: 4. WF-ADMIN-001: 2. WF-WORK-001: 2. See 3.5. |
| SM transition table columns | Conforms | Both SM tables carry Current / Event / Actor / Guard / Next / Side effects / Audit / Failure / DEC. |
| Derived vs states vs events | One wording defect | N-4 (remote flag). Punctuality, duration vs 9 h, and missing flags are correctly derived. |
| Mapping to REQ ranges, no SCR IDs | Conforms | Ranges only. WF-WORK-001's range is marked unconfirmed. |

### 3.2 Audit event naming (`<entity>.<past_tense_verb>`, lower snake case)

All names are lower snake case with one dot. These do not follow entity + past-tense verb:

| Current (Batch 1) | Issue | Suggested rename (Proposed; naming only) |
|---|---|---|
| `attendance.checkout_failed` | noun + participle, not a verb | `attendance.check_out_rejected` |
| `attendance.checkout_provisional` | adjective, not a verb | `attendance.closed_provisionally` |
| `attendance.checkout_pending_review` | noun phrase | `attendance.held_for_review` |
| `attendance.provisional_resolved` | noun + participle | `attendance.provisional_closure_resolved` |
| `attendance.review_resolved` | noun + participle | `attendance.hold_resolved` |
| (unnamed: "failed check-in attempt (Proposed)") | no name | `attendance.check_in_rejected` |
| (unnamed: "security setting changed") | no name | `attendance_settings.updated` |
| (unnamed: "Save target; audit") | no name | `target.assigned` |
| (unnamed: "Save assignments; audit") | no name | `work_list.assigned` (to be reconciled with Batch 3 assignment events) |

Conforming as written: `attendance.checked_in`, `attendance.checked_out`, `attendance.corrected`, `attendance_correction.submitted`, `.approved`, `.rejected`, `.withdrawn`.

Cross-batch caution: `work_list.assigned` for business items overlaps Batch 3's SM-ASSIGNMENT-001 events. Reconcile at integration; do not let two names describe one fact.

### 3.3 G2 audit and metrics table (Batch 1 — draft)

Names are Proposed (G2). A dagger marks names that do not follow the naming rule (see 3.2). "Counted in report?" is a proposal for Batch 4's WF-REPORT-001/002 to confirm against ART-01 §15; report scope is not decided here.

| Event (proposed name) | Entity | Actor | Counted in report? | Source workflow |
|---|---|---|---|---|
| `attendance.checked_in` | Attendance session | Employee (any role, including Owner) | Yes (proposed): "employees checked in"; punctuality derived from it | WF-ATT-001 |
| (unnamed in Batch 1; suggest `attendance.check_in_rejected`) | Attendance session (attempt; no session created) | Employee (attempt), System | Audit only. Must not count as checked in (G1) | WF-ATT-001 |
| `attendance.checked_out` | Attendance session | Session owner | Yes (proposed): "employees checked out", recorded working hours | WF-ATT-002 |
| `attendance.checkout_failed` † | Attendance session | Session owner, System | Audit only (verification failures) | WF-ATT-002 |
| `attendance.checkout_provisional` † (DEC-026 Alt B) | Attendance session | Session owner, System | Hours treatment unresolved (follows DEC-026) | WF-ATT-002 |
| `attendance.checkout_pending_review` † (DEC-026 Alt C) | Attendance session | Session owner, System | Hours treatment unresolved (follows DEC-026) | WF-ATT-002 |
| `attendance.provisional_resolved` † | Attendance session | Owner | Yes (proposed): hours use the effective value, with an adjusted marker if corrected | WF-ATT-003 Part 2 (see N-1) |
| `attendance.review_resolved` † | Attendance session | Owner | Same as above | WF-ATT-003 Part 2 |
| `attendance.corrected` | Attendance session | Owner (Alt A) / Owner approving (Alt B) | Yes (proposed): effective hours; original kept and distinguishable | WF-ATT-003 Part 2 |
| `attendance_correction.submitted` (DEC-011 Alt B only) | Attendance correction request | Employee | Audit only. The pending count is an Owner queue item; whether it is a report metric is Batch 4's call | WF-ATT-003 Part 2 |
| `attendance_correction.approved` (Alt B only) | Attendance correction request | Owner | Audit only (paired with `attendance.corrected`) | WF-ATT-003 Part 2 |
| `attendance_correction.rejected` (Alt B only) | Attendance correction request | Owner | Audit only | WF-ATT-003 Part 2 |
| `attendance_correction.withdrawn` (Alt B only; Withdrawn is Proposed) | Attendance correction request | Employee | Audit only | WF-ATT-003 Part 2 |
| (unnamed; suggest `attendance_settings.updated`) | Attendance settings | Owner (2FA complete) | Audit only (security setting change) | WF-ADMIN-001 |
| (unnamed; suggest `target.assigned`) | Target | Owner | Yes (proposed): "assigned targets" | WF-WORK-001 |
| (unnamed; suggest `work_list.assigned`) | Work list / assignment | Owner (manual or automatic) | Audit only; assignment counts belong to Batch 3 (reconcile) | WF-WORK-001 |
| metric: late arrivals (derived, no event) | Attendance session | System (derivation) | Yes: "late arrivals" (needs DEC-007/008/022) | WF-ATT-001 |
| metric: duration vs 9 h (derived, no event) | Attendance session | System (derivation) | Yes (proposed): "recorded working hours" | WF-ATT-002 |
| metric: missing check-in (derived, no event) | Employee/day | System scheduler | Yes: "missing check-ins", scheduled working days only (G1) | WF-ATT-003 Part 1 |
| metric: missing checkout (derived, no event) | Attendance session | System scheduler | Yes: "missing checkouts"; the session is never auto-closed | WF-ATT-003 Part 1 |
| metric: target progress (derived, no event) | Target | System (derivation) | Yes: "target completion". Counted by action timestamp (A2; DEC-020 unresolved) | WF-WORK-001 |

Notes:
- Derived flags are not stored states and not audit events. Alert dispatch and delivery failure belong to WF-NOTIFY-001 (Batch 3).
- Missing a check-in is not absence, and not being checked in is not absence on a scheduled day (G1).

### 3.4 Per-workflow field completeness (SB-1 §7)

| Workflow | Missing or thin fields (versus the 18 required) |
|---|---|
| WF-ATT-001 | Complete. |
| WF-ATT-002 | Purpose, Visibility/assignment, explicit Data changes beyond "Session → Closed…" |
| WF-ATT-003 | Not in field form: ID/Name, Purpose, Preconditions, Authorization, Visibility, Data changes, Postconditions, Audit events (Part 1) |
| WF-ADMIN-001 | Purpose, REQ, Trigger, Preconditions, Alternate paths, Visibility, Data changes, Notifications, Postconditions, Decision dependencies as a field |
| WF-WORK-001 | Purpose, REQ, Trigger, Preconditions, Authorization, Audit event names, Data changes, Postconditions, Decision dependencies as a field |

Recommend R-12. This is documentation only.

### 3.5 Third scenario for WF-ADMIN-001 and WF-WORK-001 (drafted; intended behaviour, not tested)

- **WF-ADMIN-001 #3.** Given a saved settings change, when an employee who checked in before the change is later viewed, then that session keeps the classification it received under the settings effective at its check-in (N-3, Proposed).
- **WF-WORK-001 #3.** Given a Call Center agent with no Open attendance session, when they open their work list, then it is available. Given an action performed after checkout, then it counts toward progress by its own timestamp in company time (Contract A1 and A2; DEC-020 unresolved).
- **WF-WORK-001 #4.** Given an item the assignee cannot access under WF-ACCESS-001, when the Owner selects it, then it is not eligible and no assignment is saved.

---

## 4. Proposed repairs (not executed)

"Board write" means the change touches Board 02 and needs a later authorized board checkpoint. "User decision" means a policy choice is required to resolve it. Drawing a gap as policy-dependent never selects a policy.

| # | Change | Artifact | Reason | User decision? | Board write? |
|---|---|---|---|---|---|
| R-1 | Add "Attendance gating: not adopted" note | WF-WORK-001 spec and diagram; WF-ATT-001 `panel` | Contract A1 annotation (§2.3) | No | Yes (diagram); spec text no |
| R-2 | Add progress timestamp-basis note: "counted by action timestamp in company time, independent of attendance state (A2; DEC-020 unresolved)". Note that the completed-day summary reads A2 progress and that timezone is DEC-007-dependent | WF-WORK-001 `progress`; spec step 7; WF-ATT-002 `daySum` note | A2 not stated (§2.2) | No (DEC-020 stays unresolved) | Optional |
| R-3 | Relabel `eligible` to "Eligible? Role, not rejected, Access check for assignee (WF-ACCESS-001)", and reference Contract B rather than redefining it (B2 phone, B4 archived, B6 open deal are Proposed or Unresolved) | WF-WORK-001 `eligible` | F-10, SB-1 C5, C1 vs assignee | No (verify with Batch 2 at integration) | Yes |
| R-4 | Add Save failed / Save succeeded outcomes at `record`, `saveT`, `saveW`. Add a "race: open session now exists" outcome at WF-ATT-001 `record` (mechanism is Phase 3) | WF-ATT-001, WF-WORK-001 | N-6, F-06, SB-1 §7 | No | Yes |
| R-5 | Rebuild WF-ATT-001 with phase subgraphs; label "open attendance session" | WF-ATT-001 | F-07, layout lessons | No | Yes |
| R-6 | Add Part 2 trigger "Provisional checkout awaiting Owner confirmation (DEC-026 Alt B)". Add a yellow policy-dependent node for "missing check-in resolution" (retroactive session or not) | WF-ATT-003 Part 2; spec §9 | N-1 (no decision needed); N-2 (resolution needs a decision) | N-1 no; N-2 yes (no DEC ID) | Yes |
| R-7 | Add yellow "Summary handling (DEC-012, DEC-026)" on Alt B/C branches | WF-ATT-002 | F-02 | Drawing no; resolution yes (DEC-012, DEC-026) | Yes |
| R-8 | SM-ATTENDANCE-001: add Open → Open (adjusted) row and transition for check-in correction; reword "remote flag" as an attribute; state that `attendance.checkout_failed` is emitted for every Alt and Alt B/C add a status event | SM-ATTENDANCE-001 diagram and table; spec §10 | N-4, N-5, N-9 | No (who may correct is DEC-011) | Yes (diagram/table) |
| R-9 | Part 2: draw Withdraw (Proposed). Draw the post-rejection state for a blocked employee as policy-dependent (yellow) | WF-ATT-003 Part 2; SM-CORRECTION-001 | N-7, F-01 | Drawing no; resolution yes (DEC-011) | Yes |
| R-10 | Adopt or amend the rename table (§3.2) | Spec §9–§10, G2 | F-08, SB-1 G2 naming | Yes: name approval stays with the orchestrator/user | Spec text, SM tables, board tables |
| R-11 | Merge the G2 table (§3.3) into the Phase 2 doc | `phase_2_workflows_and_state_machines.md` | G2 requires it | No (orchestrator merges) | No |
| R-12 | Expand WF-ATT-002/003, WF-ADMIN-001, WF-WORK-001 to the 18 fields; add scenarios (§3.5) | Spec §9, §11 | §3.4 | No | No |
| R-13 | Relabel WF-WORK-001 `authz` to "Owner authorized, 2FA complete?" | WF-WORK-001 | N-8, ART-01 §3 | No | Yes |
| R-14 | Terminology: "attendance session", "attendance correction request" in labels; add "(derived)" to `unclassified` | Mermaid labels, spec | §3.1 | No | Yes (labels) |
| R-15 | Clarify that derived punctuality uses the settings effective at the session's check-in | Spec §9 WF-ATT-001, WF-ADMIN-001 | N-3 | No (the "future sessions" rule remains Proposed; user may change it) | No |
| R-16 | WF-WORK-001 completeness: multiple-item selection loop (manual path handles one item then saves); the "Reassign via WF-CALL-001" hand-off is terminal and needs a return outcome; no edit or cancel path for an existing target or work list; "not rejected" applies to calling items only, other item types (tasks, follow-ups) need their own eligibility via their batches | WF-WORK-001 | Review of Mermaid | Edit/cancel and review cycle touch DEC-025 | Yes |

Not proposed: selecting any of DEC-007/008/009/010/011/012/022/026, choosing a notification schedule, or choosing target metrics or allocation rules.

---

## 5. Interfaces Batch 1 exposes, and what Batch 1 expects

### 5.1 Batch 1 exposes

| To | Interface (Batch 1 side) | What Batch 1 expects from the other batch |
|---|---|---|
| WF-ACCESS-001 / SM-VISIBILITY-001 (Batch 2) | WF-WORK-001 `eligible`: "in scope" for each manual or automatic item (F-10) | An evaluable "Access check (WF-ACCESS-001)" for (assignee, business) returning allowed/denied. It is evaluated for the **assignee**, not the selecting Owner (C1, C2). It must state how an item behaves if the business later becomes hidden for the assignee (shown as hidden by policy, or removed); none of this is defined in Batch 1. |
| WF-CALL-001 (Batch 3) | WF-WORK-001 `reassign[["Reassign via WF-CALL-001"]]` for items assigned to someone else | Reassignment with history, handling of open follow-ups and active reservation. A return outcome (reassigned or declined) so WF-WORK-001 can include or skip the item. Business assignment writes (including automatic generation's `saveW`) should go through SM-ASSIGNMENT-001 rather than a second definition in Batch 1. |
| WF-CALL-002 (Batch 3) | Indirect: a work item may have an active reservation by another agent | The reservation behaviour on reassignment is owned by WF-CALL-001/002; Batch 1 does not duplicate it. |
| WF-NOTIFY-001 (Batch 3) | Events: missing check-in (Owner), missing checkout (recipients unresolved), attendance correction awaiting review (Owner), new assignment (assignees, timing unresolved), Owner review item under DEC-026 Alt B/C (not an ART-01 §16 event; F-05) | Timing, recipients, escalation (no DEC ID); access and account status re-checked at send time (C6); a delivery failure raises "Notification-delivery failure" to the Owner and **never** changes attendance records or assignments (parallel to D5). |
| WF-REPORT-001 / WF-REPORT-002 (Batch 4) | G2 table (§3.3): events and derived metrics; effective vs original values for corrected sessions | Dashboard must keep "not currently checked in" apart from "absent on a scheduled working day" (G1). Hours for provisional or pending-review sessions are unresolved (follow DEC-026). Corrected sessions show the effective value with the original distinguishable. The audit explorer reads the event names in §3.3 once approved. |
| WF-AUTH-001 / SM-SESSION-001 (Batch 4) | Preconditions "authenticated and active"; Owner "2FA complete" for WF-ADMIN-001, WF-WORK-001 and Alt B approvals | Definition of what a pending-2FA Owner session may do (is **check-in** allowed? N-8). Active/inactive status check usable at check-in. |
| WF-EMP-001 (Batch 4) | WF-WORK-001 "Target valid for role?" and "active employee" selection; WF-ATT-001 inactive redirect | Behaviour at deactivation: open attendance session, open correction request, targets and work lists. Behaviour on role change vs existing targets. Batch 1 invents none of these (N-10). |
| WF-CALL-003, WF-BIZ-001, WF-PROJ-001 (Batches 2–4) | Targets count actions by their own timestamp in company time (A2; DEC-020 unresolved) | Each countable action (call attempt, business created, task completed) carries actor and its own timestamp. Which actions count is for DEC-020. |
| WF-FOLLOW-001 (Batch 3) | WF-WORK-001 work items can reference follow-ups; "due/overdue" is shown to the employee | Due/overdue stay derived from time (SM-FOLLOWUP-001). Batch 1 does not define follow-ups. |

### 5.2 Internal to Batch 1

- WF-ADMIN-001 settings (working days, timezone, grace, verification mode) are consumed by WF-ATT-001, WF-ATT-002 and WF-ATT-003 Part 1.
- WF-ATT-001 `seeOpen`, WF-ATT-002 `ownerItem` and WF-ATT-003 Part 1 `review` all hand off to WF-ATT-003 Part 2 (see N-1 and N-2 for the triggers that are missing).
