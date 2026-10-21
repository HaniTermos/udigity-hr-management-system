# Phase 2 Batch 2 — Repair log (repair attempt 1, task T2c-part1)

**Baseline: SB-2.** Source review: `docs/phase2/reviews/batch2-spec-review.md` (RV2-01..RV2-23). Files changed: `batch2-spec.md` (spec), `batch2-mermaid.md` (mermaid), `open-items.md` (OI). No Figma writes. Nothing tested. Mermaid re-checked with the local structural script only (not rendered).

| Defect | Severity | Status | What changed (file + section) / reason |
|---|---|---|---|
| RV2-01 | Blocker | Fixed | Spec §6.1 new **Table RT**: all 11 R-06 resource types (business, call attempt, follow-up, contact reservation, deal record, meeting, project, task, notification, export row, duplicate preview) plus data-correction request and edit-history entry. Columns: linked business, visibility basis (inherits / DEC-002 row), relation facts (supplied by Batches 3–4), rule (defined here, C5), when denied, surfaces. Export row = per-row check. Spec §6.3–6.4 rewritten. Mermaid: WF-ACCESS-001 split into Part 2 (related records, Developer lists; subgraph label "rule defined in Table RT; Batches 3 and 4 supply relation facts") and Part 3 (B7, notifications, per-row export `expRow`, duplicate preview) |
| RV2-02 | Major | Fixed | All three files say "Baseline: SB-2". R-01 cited in VT-1, `ownerJump`, `inO`. B7/R-02 in spec §6.4, §11. R-04/§11 terms in §0.4. OI §4.1 "Resolved by SB-2" lists BCR-1/2/3 as ruled (Proposed) |
| RV2-03 | Major | Fixed | Spec §6.4 (B7), VT-2 Call Center row, §7.1 (derived classification), VT-7 rows "day 12/20" and "assigned day 14, now day 16", scenario 9. Mermaid WF-ACCESS-001 Part 3 `b7`, `b7cls` (blue, derived, "no automatic reassignment"), `ownerDec` → WF-CALL-001 (B8) |
| RV2-04 | Major | Fixed | Spec VT-3 extended: assign business, log call/finalize outcome (Board `27:455`), reservation acquire/renew/release and override (DEC-004, `27:452`), follow-up actions, reopen rejected (DEC-016), assign Developer (E2), meetings (DEC-005), commercial stage (Batch 4 OQ-03), signature/payment/closure (`27:458`, DEC-006, R-12), closed-deal list, project/tasks (`27:461`) |
| RV2-05 | Major | Fixed | Spec VT-4 "Reset events: `call_attempt.logged`, `follow_up.scheduled` (R-07)"; §4A Visibility; mermaid `altB` (SM-VISIBILITY-001 Part 2) and `timer` (WF-BIZ-002 Part A). Scenario 10 added (Alt B reset, notes edit does not reset) |
| RV2-06 | Major | Fixed (USER question remains) | Spec VT-1 new step 2b: admin access before 2FA [Confirmed]; everything else R-11 → USER with Reading R11-a / R11-b. WF-BIZ-001 and WF-BIZ-003 preconditions, VT-7 row, scenario 4 rewritten. Mermaid: SM-VISIBILITY-001 Part 1 `pend`, `r11`, `r11b`; WF-BIZ-001 Part 1 `r11`. Escalated: OI §1 "USER questions" |
| RV2-07 | Major | Fixed | Every drafted alternative carries "(drafted)" in mermaid labels (Alt PH, NM, SN, CA, CR, DE) and header meta lines say "drafted alternatives, not Board 01". Spec §0.1 drafted-alternatives table; VR-5 and VT-2 marked drafted; DR-4 discloses Alt SN-1 = ART-11 D11 (Tier 4) |
| RV2-08 | Major | Fixed | Category removal is now its own question "(no DEC ID)" with drafted Alt CR-1 / CR-2; C-01 only "may influence". Spec §5, BIZ2A-d, §12 matrix (separate row); mermaid WF-BIZ-003 subgraph `remP` and nodes relabelled; OI-16 updated |
| RV2-09 | Major | Fixed | Local labels re-prefixed: VR-1..12, DR-1..9, VT-1..7, Table RT, alternate paths BIZ1-a.., BIZ2A-a.., BIZ2B-a.., CAT-a..; Data Entry scope Alt DE-1/DE-2; similar names Alt SN-1/SN-2; names Alt NM-A/B/C; phone Alt PH-1/PH-2; categories Alt CA-A/B/C, CR-1/CR-2. No local label now reuses a contract letter+number, ART-11 D-number or another local label |
| RV2-10 | Major | Fixed | Mermaid WF-ACCESS-001 Part 2: denied items go to `own` ("list rows never") → `omit` ("omitted and not counted"); redaction only for owned items. `dec005` is a decision with labelled exits "Alt 1 and assigned to U: read-only" → check, "Alt 1 not assigned, or Alt 2" → `deny005` (omitted, not counted, R-12). No path from a denied exit to a shown-with-data end. Spec §6.1 common rules, §6.3, VT-6 "omitted and not counted"; scenario 7 |
| RV2-11 | Major | Fixed | Spec DR-8 extended to edits and the correction apply step; §4A step 6(c), Errors; §8.1 apply rows. Mermaid WF-BIZ-002 Part A `save` label and new edge `res -->|"Concurrent duplicate found"| blocked`; Part B `rApply` label. Scenario Part A-4 (two businesses, same new phone) |
| RV2-12 | Major | Fixed (USER confirmation needed) | Spec VT-5 new column "Actions allowed under the context-limited outcome" per DEC-002 row, Proposed and tied to the row; VT-6 references it. Mermaid WF-ACCESS-001 Part 1 `editChk` ("Context-limited: only row 6 Alt B apply"), WF-BIZ-002 Part A `access`. OI-27 |
| RV2-13 | Minor | Fixed | Edit history aligned with SB-2 §11 (anyone who passes the check, incl. context-limited), with a Proposed field limit. Spec §6.2, Table RT, VT-3; mermaid Part 1 `hist` reachable from both `fullV` and `limitedV` via `nextAct`. OI-11 kept open for previous values |
| RV2-14 | Minor | Fixed | DR-8 retagged [Confirmed-derived]; save conflict [Confirmed-derived] + "no silent overwrite" Proposed; VT-3 Manage categories CC/Dev "No [Proposed]" with Board `27:446` note; VT-5 rows 3–4 (and 5) "who" marked *implied*; §3 step 8 tagged [Proposed interpretation] |
| RV2-15 | Minor | Fixed | VT-7: DEC-005 Alt 1 → "context-limited, read-only contact and notes"; callback row states "`follow_up.scheduled` on day 18 for day 22" |
| RV2-16 | Minor | Fixed | Mermaid `altB`: "15 days from creation, then from latest …"; VT-4 origin tagged Proposed interpretation (OI-17a) |
| RV2-17 | Minor | Fixed | Spec §4B Preconditions: "No attendance gating (A1)" |
| RV2-18 | Minor | Fixed | Node `fail` renamed `saveFail` (WF-BIZ-002 Part A) and `catSaveFail` (WF-BIZ-003); WF-BIZ-003 `nameChk` has separate "Missing" (`nameMiss`) and "Duplicate" (`dupCat`) exits; `blockDel` is now a red end node; WF-ACCESS-001 Part 1 `fullV`/`limitedV` branch through labelled decision `nextAct` |
| RV2-19 | Minor | Fixed | Spec §4A Decision dependencies now include DEC-003 |
| RV2-20 | Minor | Fixed | Events renamed `data_correction_request.*` (entity token matches the Entity column); `business.duplicate_blocked` entity clarified ("attempted create or edit; no business saved; references the matched business"); `business.hidden_match_revealed` actor "System, to Data Entry" |
| RV2-21 | Minor | Fixed | R-12 (→ USER) note added wherever DEC-005 Alt 2 appears: spec VT-2, VT-3, VT-7, Table RT, §6.3; mermaid `deny005`, `scDev` |
| RV2-22 | Minor | Fixed | "Deal record" (SB-2 §11) used in spec §0.4, Table RT, VT-2, VT-3, VT-5; request terminal state renamed "Rejected (request)" in spec §8 and mermaid (`RejectedReq`, `rRejected`) |
| RV2-23 | Minor | Fixed | VR-8 and WF-BIZ-001 Part 1 `vSocial`: DEC-024 removed from the label; spec cites it as "possibly related; scope not defined" (OI-28); §12 matrix row reworded |

**Summary:** 23 of 23 defects addressed in the files. Items that still need a USER decision (not fixable by Agent 2): R-11 (RV2-06), R-12 (RV2-21), the context-limited action set (RV2-12 / OI-27), and the drafted alternative sets (RV2-07 / OI-01, OI-16).

**Updated node counts:** WF-BIZ-001 P1 18 (was 17), P2 24; WF-BIZ-002 A 20, B 22; WF-BIZ-003 23 (was 22); WF-ACCESS-001 P1 21 (was 19), P2 12 (was 18, split), P3 19 (new part); SM-VISIBILITY-001 P1 18 (was 15), P2 21; SM-DATAFIX-001 6 states.

---

## Round 2 Minors (review r2, `reviews/batch2-spec-review-r2.md`) — fixed in T2c-part2 step 1, no re-review required

| Defect | Severity | Status | What changed |
|---|---|---|---|
| RV2-24 | Minor | Fixed | Spec §6.1 Table RT, Business row: "creator (Batch 2, WF-BIZ-001)" replaces "creator (B2 batch)" |
| RV2-25 | Minor | Fixed | Mermaid WF-BIZ-001 Part 1: `r11` is now an orange decision with labelled exits "Reading R11-a: all access waits for 2FA" → `denied` and "Reading R11-b" → new yellow node `r11b` ("whether creation is administrative is part of the USER question"), dotted "Only if creation is non-administrative" → `enter`. 19 nodes |
| RV2-26 | Minor | Fixed | Mermaid WF-ACCESS-001 Part 3: `proceed` now names WF-CALL-002, WF-CALL-003 or WF-FOLLOW-001; new red end `agentDen` ("Agent: action denied, Record hidden by policy, no business data"); `b7cls` is a dotted side effect of `agentDen`. Spec §6.4 text aligned. 20 nodes |
| RV2-27 | Minor | Fixed | Spec §6.2: new bullet "Direct URL under a context-limited outcome [Proposed; OI-27]" — renders only the granting context's view; outside that context business detail is denied |
| RV2-28 | Minor | Fixed | Spec §7.8 VT-7: both rows now start "Created day 0" |

Node counts after round 2: WF-BIZ-001 Part 1 = 19, WF-ACCESS-001 Part 3 = 20; others unchanged.

## Drawing-time source adjustments (T2c-part2 step 2; layout/syntax only, no content change)

| Item | Change | Reason |
|---|---|---|
| WF-BIZ-003 `remP` subgraph title | "; " → ", " | `generate_diagram` parser rejected semicolons in a subgraph title |
| WF-ACCESS-001 Part 2 `relP` subgraph title | "; " → ", " | Same parser limitation (pre-emptive) |
| WF-ACCESS-001 Part 2 `deny005` | Moved outside the `devP` subgraph | Board defect V-04: edge label overlapped the node; see `verification.md` |
