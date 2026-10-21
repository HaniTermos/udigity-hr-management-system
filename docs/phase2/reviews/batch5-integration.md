# Phase 2 — Batch 5 Integration Review (T5)

- **Reviewer:** Integration Reviewer, 2026-10-20. I did not write any batch.
- **Baseline:** SB-2 (`docs/phase2/shared-baseline.md`).
- **Scope:** one cross-batch consistency pass. Cosmetic layout is not reported. Batches 1–2 are the accepted baseline and are flagged only for a genuine blocking contradiction.
- **This review approves nothing.** No batch, ruling, event name or policy is approved by it. There is no software; nothing was tested.

**Read:**
- SB-2 and the task register.
- The Phase 2 doc §1–§14a (Batch 1 specs and the §4 coverage matrix).
- `batch1-maintenance.md`.
- Specs: `batch2-spec.md`, `batch3-spec.md`, `batch4-spec.md`.
- Batch 2–4 `verification.md`, plus Batch 2 `open-items.md`, Batch 3 and Batch 4 `dependencies-and-open-items.md` (open-question lists only).
- ART-01 §15.

**Board 02.** Read-only `get_figjam` on the root (`0:1`, 752 k characters, saved to file). I parsed it by script for every section name and checked selected labels in WF-WORK-001 and section 12. I did not read every text node by eye, and I made no Figma writes.

---

## (a) Readiness verdict

**Blocking issues listed (1).** Phase 2 is not ready to call complete until B-1 is fixed. B-1 is a one-paragraph text fix in Batch 3 §6 and Batch 4 WF-REPORT-001; no redraw is needed except optionally the G1 table `93:4914`.

Everything else is consistent, or is a documented, labelled open policy. The B8 / WF-WORK-001 overlap is ruled **Non-blocking**: it is a documented interface note under SB-2 R-03, but it is a pre-merge repair condition (N-1).

---

## (b) Coverage summary

**Use cases.** All 48 Board 01 UCs in the §4 matrix map to a specified workflow:
- UC-AUTH-001..008
- UC-ATT-001..007
- UC-BIZ-001..008
- UC-CALL-001..010
- UC-DEAL-001..004
- UC-PROJ-001..004
- UC-REP-001..005

UC-AUTH-003 A/B counts as one. UC-REP-006 is in Phase 3D (approved). Each target workflow is drawn on Board 02.

| Area | Inventory IDs | Board 02 sections found (node) | Drawn exactly once? |
|---|---|---|---|
| Batch 1 (02, 03, 11) | WF-ATT-001/002/003, WF-ADMIN-001, WF-WORK-001, SM-ATTENDANCE-001, SM-CORRECTION-001 | `11:721`, `21:1151`, `25:1355` + `11:724` (P1/P2), `27:1421`, `23:1283`, `11:727`, `11:728` | Yes |
| Batch 2 (04, 05) | WF-BIZ-001/002/003, WF-ACCESS-001, SM-DATAFIX-001, SM-VISIBILITY-001 | `34:1547`+`37:1690`, `42:1810`+`44:1931`, `46:2064`, `50:2455`+`54:2518`+`56:2621`, `48:2127`, `58:2727`+`60:2835` | Yes (multi-part) |
| Batch 3 (06, 07) | WF-CALL-001/002/003, WF-FOLLOW-001, WF-NOTIFY-001, WF-REJECT-001, SM-ASSIGNMENT-001, SM-RESERVATION-001, SM-FOLLOWUP-001, SM-REMINDER-001 | `93:4908`+`96:5059`, `100:5329`+`104:5594`, `108:5838`+`110:6081`, `125:7403`, `130:7991`+`137:8370` (+ event table `145:9017`), `140:8481`, `113:6099`, `119:6757` (diagram sub-section `152:9164` nested inside it), `142:8514`, `145:8742`; outcome table `119:6960` | Yes |
| Batch 4 (01, 08, 09, 10) | WF-AUTH-001/002, WF-EMP-001, WF-DEAL-001/002, WF-PROJ-001, WF-REPORT-001/002, SM-ACCOUNT-001, SM-SESSION-001, SM-COMMERCIAL-001, SM-MEETING-001, SM-PROJECT-001, SM-TASK-001 | `70:3683`+`72:3769`, `74:3887`+`76:3973`, `78:4102`+`80:4213`+`82:4276`, `98:5188`+`102:5455`, `106:5714`+`110:5959`, `119:7183`+`123:7279`, `93:4911`+`132:8099`+`135:8177`, `137:8255`, `93:4341`, `86:4347`, `115:6383`, `115:6434`, `127:7466`, `127:7513` | Yes |

**Totals.** All 23 workflow IDs and 14 state-model IDs are present.
- No ID appears in two places.
- There are no duplicate or superseded diagram versions.
- There is no undeclared ID: there is no `SM-OUTCOME-001`, and the calling outcome stays a table under R-10.
- The top level holds exactly the 13 orchestrator sections.

**Notes:**
- WF-NOTIFY-001 has no Board 01 UC. It covers ART-01 §16 (a known gap, artifact-register item 4).
- State models live in their batch sections (05, 06, 07, 01, 08, 09), not in section 11, as SB-2 §8/§9a authorised. The §3 inventory "Section" column still says 11 (see N-9).

---

## (c) Blocking issues

### B-1 — "Accepted opportunities" dashboard count conflates accepted with closed (G1, Confirmed)

**Evidence:**
- **G1 (Confirmed; ART-01 §15 "Reporting rules"):** the dashboard must not confuse accepted opportunities with closed deals. ART-01 §15 lists "Accepted opportunities" and "Closed deals" as separate business metrics.
- **Batch 3 `batch3-spec.md` §6** (`call_outcome.changed` row and the metric rules, line ~671) says dashboard business counts by outcome, **including "Accepted opportunities"**, "are snapshots of the current outcome".
- **Batch 4 `batch4-spec.md` §1 item 3** says "The calling outcome stays 'Accepted' while the deal record progresses", including after Closed deal.
- Read together, Batch 3's snapshot of businesses with outcome Accepted also counts every business whose deal record is **Closed deal**, Signed, Paid or Not proceeding. That violates G1.
- **Batch 4 WF-REPORT-001** (G1 table `93:4914`) defines only the **period** metric (`accepted_opportunity.created` vs `deal.closed`). It does not define the current-count "Accepted opportunities" tile, so nothing overrides Batch 3's definition. SB-2 §11 defines the term as a deal record "in stage 'Accepted opportunity' until it progresses".

**Why blocking:** two artifacts give contradictory definitions of the same Confirmed-rule metric, and one of them breaks the rule.

**Minimal fix (no redraw needed, no policy selected):**
1. In Batch 4 WF-REPORT-001, define the current-count "Accepted opportunities" as **deal records currently in commercial stage Accepted opportunity**. Whether Signed/Paid stages count as "accepted, not yet closed" can be shown as a separate Proposed metric. Keep the period count as `accepted_opportunity.created`.
2. In Batch 3 §6, remove "Accepted opportunities" from the calling-outcome snapshot list and reference the WF-REPORT-001 definition.
3. Optionally add one row to table `93:4914`.

---

## (d) Non-blocking cross-batch notes

**N-1 — B8 vs WF-WORK-001 (documented interface note; repair before merge).**
- The Batch 1 spec §9 step 6 and the Board 02 label in WF-WORK-001 `23:1283` ("Save assignments; audit") still write work-list assignments directly. Only the "assigned to someone else" case hands off to WF-CALL-001.
- B8 (R-03) and Batch 3 (WF-CALL-001 trigger; SM-ASSIGNMENT-001 rows "Assign (manual, or WF-WORK-001 hand-off)" and "Automatic allocation accepted") make WF-CALL-001 the only assignment writer.
- **Ruled non-blocking** because:
  - SB-2 R-03 already resolves which artifact governs;
  - the repair is explicitly deferred to Agent 1;
  - Batch 3's side is complete.
- **Condition:** before the Batch 1 content is merged as final, the repair must be executed in both text and diagram: "Save assignments" becomes "hand off to WF-CALL-001 (new + reassignment), WF-CALL-001 returns assigned/declined per item". That also removes the double audit/notification risk; WF-WORK-001 should not emit its own assignment event.
- **Tracker gap:** `batch1-maintenance.md` (written against SB-1) mentions this only in the §5.1 interface table. Add a numbered repair item for B8 / R-03.

**N-2 — Developer assigned in the acceptance save emits no assignment event (G2).**
- Batch 3 WF-CALL-003 lets the agent "assign now" in the Accepted save. Its event list has no `opportunity.developer_assigned`.
- Batch 4 counts `opportunity.developer_assigned` ("Development workload") and says "Developer not yet assigned is derived from its absence". SM-COMMERCIAL-001's start row lists only `accepted_opportunity.created`.
- Result: an assign-now Developer is undercounted and could show as "not yet assigned".
- Fix: either WF-CALL-003 emits `opportunity.developer_assigned` in the same save, or Batch 4 derives the condition from the attribute, not the event.

**N-3 — Development workload counted three ways.** Batch 4 counts `opportunity.developer_assigned` and `project.developer_assigned` as "Development workload", and also lists "Development workload" as a derived (non-event) metric. Pick one definition, or a Developer moving from deal to project is counted twice.

**N-4 — Deactivation: "nothing moves" vs automatic release.**
- WF-EMP-001 M3 says every open item stays attached and flagged until the Owner reassigns it, and its postcondition says no work item was silently moved.
- SM-DATAFIX-001 (Batch 2) moves an In review correction request back to Submitted automatically ("Reviewer account deactivated → System").
- Both are Proposed. Reconcile with one line in WF-EMP-001 M3 naming the SM-DATAFIX-001 exception.
- M3 lists "open correction requests" without saying data-correction or attendance correction, and without a hand-off target (`[[WF-BIZ-002]]` / `[[WF-ATT-003]]`).

**N-5 — Hand-off without a matching entry: WF-EMP-001 M3 → `[[WF-ATT-003]]`.** WF-ATT-003 Part 2 has no trigger for "open attendance session of a deactivated employee". The Owner can only use the generic triggers. Add the trigger when the Batch 1 repairs run. All other `[[...]]` targets in Batches 2–4 exist, with a matching entry or trigger.

**N-6 — "New assignment" notification source.** The WF-NOTIFY-001 table §2.5.1 lists WF-CALL-001 as the only source (B8). Batch 4 SM-PROJECT-001 and WF-PROJ-001 also emit a "new-assignment event" on project Developer assignment, and Batch 4 marks its cross-module scope Unresolved. Add a project row in §2.5.1, or keep the event calling-only. This is a question with no DEC ID (notification scope).

**N-7 — DEC-005 Alt 1 wording.**
- Batch 2 (Table RT, VT-2) describes Alt 1 as "read-only contact and notes". Batch 4 lets the Alt 1 Developer schedule meetings, record discovery, update handoff context and (VT-3) record signature/payment.
- This is consistent if "read-only" means **business master data** only, which VT-3 and VT-5 row 1 (meetings allowed) imply.
- Clarify the word in Table RT so it is not read as read-only on the deal record. No DEC meaning has changed.

**N-8 — One user question appears under three local labels:** B3-Q12 (can Accepted change back?), Batch 4 OQ-04 (calling outcome when a deal is Not proceeding), and B6/DEC-017 (re-queue). They are consistent (all unresolved). Ask them once (see e).

**N-9 — Stale status text (orchestrator hygiene, no rule impact):**
- `batch4-spec.md` header still says "Drawing … not authorized; nothing here has been drawn".
- The task register still shows T3d "Running", although `batch3/verification.md` records completion.
- Phase 2 doc §3 lists "Section 11" for every state model, and §14a says Batches 3–4 are not drawn.
- Board 02 index `14:1039` says "Batch 1 CREATED as DRAFT".
- Section 12 holds only Batch 1 and Batch 2 coverage tables; there are none for Batch 3/4.
- The lease notes `65:3586`/`65:3589` say "in progress".

**N-10 — Other G1 metrics with no owner definition.** ART-01 §15 stock tiles "Callback requests" (B3-Q11), "Total businesses" and "Businesses needing corrections" are defined only by Batch 2/3 G2 notes, not in WF-REPORT-001. They don't contradict anything (unlike B-1), but WF-REPORT-001 should reference them.

**Checked and consistent (no finding):**
- **A1.** No batch gates work on attendance; it is stated in Batches 2, 3 and 4.
- **A2 (DEC-020).** Applied in Batch 3 §6.
- **B1–B7.** B7 is applied identically in Batch 2 §6.4 / VT-2 and Batch 3 §0 / every calling action. There is no automatic reassignment anywhere.
- **C5.** Batches 3 and 4 only call "Access check (WF-ACCESS-001)" and never redefine it. Batch 2 Table RT lists all 11 R-06 resource types.
- **D1–D6.** D2 is in WF-CALL-003 and the WF-FOLLOW-001 guard. D4 is policy-dependent in both places. D5/D6 hold in WF-NOTIFY-001, SM-REMINDER-001 and the Batch 2 RT notification row.
- **E1–E5.** There is a single `accepted_opportunity.created`: emitted by WF-CALL-003, consumed and not re-counted by WF-DEAL-001 / SM-COMMERCIAL-001. The DEC-017 open-deal branch is identical in WF-CALL-003 step 5a and WF-DEAL-001 A9.
- **F1–F3.** Closure stays committed on provisioning failure; F2 Auto/Manual is unselected.
- **G2/G3.** The R-07 reset events match (`call_attempt.logged`, `follow_up.scheduled`) in Batch 2 VT-4 and Batch 3. Audit is append-only everywhere.
- **Shared terms.**
  - The calling outcome values match SB-2 §5 in every batch.
  - Assignment, outcome and commercial stage are kept separate (Batch 3 §0; Batch 4 §1 item 2).
  - Follow-up ≠ reminder (R-08 scope identical in Batch 3; Batch 4 meetings use SM-REMINDER-001).
  - Deal record, accepted opportunity and closed deal are used per SB-2 §11.
  - Project status ≠ task status.
  - Data-correction "Rejected (request)" ≠ calling Rejected.
- **Permissions.** Batch 3 and Batch 4 actions match Batch 2 VT-3 and the SB-2 §4 summary. Call Center commercial authority is Unresolved (OQ-03) in both; Developer assignment is Call Center/Owner (E2); project Developer assignment is Owner only (Call Center OQ-08 unresolved); exports and audit are Owner only.
- **DEC IDs.** No DEC meaning has changed. Drafted alternatives (DEC-006 Alt A/B, DEC-013, DEC-015) are labelled as drafted or ART-01-derived. R-10, R-11 and R-12 stay "→ USER" wherever they appear: the R-12 label occurs 10× in section 01 and 13× in section 08 per Batch 4 read-back, and is also seen in section 05.

---

## (e) Consolidated open USER decisions

None of these is selected by any batch.

**SB-2 → USER rulings:**
- **R-10:** approve `SM-OUTCOME-001`, or keep the calling-outcome table in WF-CALL-003 (currently a table, `119:6960`).
- **R-11:** what an Owner session waiting for 2FA may do. R11-a: nothing until 2FA. R11-b: non-administrative actions allowed, which includes check-in (Batch 1 N-8).
- **R-12:** DEC-005 Alt 2 (closed-deal-only) × DEC-006. Under Alt 2 a Developer cannot record signature or payment before closure, contrary to Board 01 "Owner and Developer [Confirmed: REQ-PROJ-004]".

**DEC IDs referenced as open across Phase 2:**

| DEC | Topic | Where it bites |
|---|---|---|
| DEC-001 | Timer basis | VT-4; R-07 resets |
| DEC-002 | Exception rows 1–6 | VT-5 |
| DEC-003 | Hidden-match revelation | — |
| DEC-004 | Lease and idle rule | — |
| DEC-005 | Developer pre-closure access | — |
| DEC-006 | Closure authority | — |
| DEC-007, DEC-008, DEC-009, DEC-010 | Attendance | — |
| DEC-011 | Correction authority | F-01 |
| DEC-012 | Checkout summary | — |
| DEC-013 | Name matching | — |
| DEC-014 | Unknown metrics | — |
| DEC-015 | Category authority | — |
| DEC-016 | Reopen rejected | Includes B3-Q09 request model |
| DEC-017 | Multiple deals | Including the B6 re-queue |
| DEC-018 | Financial evidence | — |
| DEC-019 | Project statuses | Proposed |
| DEC-020 | Target metrics | — |
| DEC-021 | Allocation | Proposed |
| DEC-022 | Rest days | — |
| DEC-023 | Follower granularity | — |
| DEC-024 | Scope undefined | — |
| DEC-025 | Target cycle | — |
| DEC-026 | Failed checkout | — |

**Questions with no DEC ID:**
- **SB-2 §3 list:**
  - C-01 deletion vs archiving (business, employee, category removal);
  - C-02 Pending vs NEW_LEAD (incl. B3-Q13 attempt-only logging);
  - notification timing, recipients, escalation and in-app presentation (incl. F-05 alert thresholds, B3-Q08 late/short-notice reminders, retry policy, N-6 scope);
  - recovery objectives (incl. OQ-12 unrecoverable Owner 2FA, OQ-19 audit retention);
  - commercial-stage transitions (incl. OQ-03 Call Center commercial authority, OQ-05 signature/payment order, OQ-15 reopening closed/not-proceeding/completed).
- **Calling:**
  - Accepted → other outcome / deal not proceeding / re-queue (B3-Q12 + OQ-04 + B6; ask once);
  - D4 open follow-ups on Rejected/Accepted;
  - follow-up handling on reassignment (B3-Q03);
  - multiple open follow-ups (B3-Q04);
  - late save after reservation loss (B3-Q05);
  - holder deactivation timing (B3-Q06);
  - attempt backdating (B3-Q07);
  - out-of-call do-not-call (B3-Q10);
  - "Callback requests" definition (B3-Q11);
  - override rules (B3-Q14);
  - unassign action (B3-Q15);
  - mandatory outcome fields (B3-Q16);
  - overdue threshold;
  - attendance gating (A1, not adopted).
- **Business and visibility (Batch 2):**
  - phone mandatory (B2 / OI-03);
  - Data Entry base scope (OI-02);
  - "day 16" boundary (OI-04);
  - Owner hidden-read audit (OI-05);
  - "unless extended" (OI-06);
  - owned-item redaction (OI-07);
  - plus OI-08..OI-29 as listed in `batch2/open-items.md`.
- **Deals, delivery and accounts (Batch 4):**
  - OQ-01 mandatory handoff fields;
  - OQ-02 Developer meeting context under DEC-005 Alt 2;
  - OQ-06..OQ-11 project scope, cardinality, assignment, milestones, open tasks, cancelled status;
  - OQ-13 self-editable fields;
  - OQ-14 reactivation;
  - OQ-16..OQ-18 empty export, stock-metric history, audit-log viewing/export;
  - F2 project provisioning trigger.
- **Batch 1:**
  - F-01..F-05 user-facing items (DEC-011 pending/rejection path, DEC-012/026 summary, punctuality after correction, Owner office-check exemption (ART-02), alert thresholds);
  - N-2 missing check-in resolution.
