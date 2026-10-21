# Phase 2 Batch 3 — Repair log (task T3d, step 1)

**Baseline: SB-2.** Source review: `docs/phase2/reviews/batch3-review.md` (RV3-01..RV3-11, all Major). Files changed: `batch3-spec.md` (spec), `batch3-mermaid.md` (mermaid), `dependencies-and-open-items.md` (deps). Optional minors were mostly not addressed; the few that came for free are noted below. No policy was decided. R-10, R-11 and R-12 stay → USER.

| Defect | Status | What changed |
|---|---|---|
| RV3-01 | Fixed | All three files re-based on SB-2. Deps §6 status table: B3-02 → R-08, B3-04 → R-09/D6, B3-05 → R-05/E5 (all Proposed); B3-01 → **R-10 → USER, unresolved** (outcome rules stay a table, no new ID). T-3 → R-07, T-8 → R-03/B8 marked resolved (Proposed). Suppressed reminder visibility retagged `[Proposed: D6]` in spec §2.4, §2.5, §3.3, §3.4. SM-REMINDER-001 readiness: no longer blocked. Contract matrix: rows B7, B8, D6, E5 added |
| RV3-02 | Fixed | B7 paragraph in spec §0. B7 applied to WF-CALL-001 Part 2 step 3, step 7 and new step 8 (Owner decision: reassign/unassign via Part 1, or keep with `calling_assignment.retained`, no automatic reassignment). Also applied to WF-CALL-002 preconditions and renewal, WF-CALL-003 and WF-FOLLOW-001 preconditions, SM-ASSIGNMENT-001 (new "keep" row and non-transition), and the SM-RESERVATION-001 Renew guard (denial → Expired at lease end). Added to §4 derived list, G2 and scenarios. Mermaid: WF-CALL-001 Part 2 subgraph `b7` (`b7cls` derived, `ownerDec`, `toPart1`, `keep`); WF-CALL-002 Part 1 `b7flag` (from `denied` and from renewal denial); WF-CALL-001 Part 1 entry `b7Start` |
| RV3-03 | Fixed | B8 paragraph in spec §0. §2.1 UC/Trigger now covers the WF-WORK-001 hand-off for both new assignment and reassignment. Assignment row `source` = manual / work list / automatic. Deps §2 row rewritten (the statement that WF-WORK-001 saves items itself was removed). Mermaid Part 1 entry `wwStart` passes the same eligibility checks |
| RV3-04 | Fixed | E5: the WF-CALL-003 save creates one deal record in stage "Accepted opportunity". G2 entity is "Deal record", emitted by Batch 3 and consumed (not re-counted) by Batch 4; "to be aligned" removed. New step 5a: DEC-017 open-deal check (WF-DEAL-001 A9), policy-dependent. Mermaid WF-CALL-003 Part 2 `openDeal`, `dealPol`, `dealBlock`; `save`/`audit`/`hDeal` relabelled |
| RV3-05 | Fixed | §2.3 step 2: the Confirmed tag is limited to "not sequential, accept/reject on first conversation". Changing from Accepted is `[Unresolved: no DEC ID; B3-Q12]`. Mermaid: WF-CALL-002 Part 1 `accChk` + `accBlock`; WF-CALL-003 Part 1 `fromAcc` (policy forbids → attempt only). Outcome table cells cite B3-Q12 |
| RV3-06 | Fixed | New D2 guard in WF-FOLLOW-001 (complete without linked call, or cancel of the last open follow-up of a Needs-another-call business → replacement follow-up or marker in the same save). Applied also to the reassignment "cancel" option and to SM-FOLLOWUP-001 Complete/Cancel rows. Mermaid WF-FOLLOW-001 `lastFu`, `repl`; `save` no longer says "marker cleared" for complete or cancel |
| RV3-07 | Fixed | Rejected save clears the marker (B1): spec §2.3 step 3 and step 6, postcondition, outcome table. Accepted marker handling is policy-dependent with D4. "Callback to be scheduled" bucket excludes Rejected (§2.1, §4). Mermaid WF-CALL-003 Part 1 `rMarker`, `aFu` ("follow-ups or marker"); WF-CALL-001 Part 2 `bFollow` |
| RV3-08 | Fixed | WF-NOTIFY-001 new change type "responsible user (or recipient) changed" (cancel the pending reminders, then plan new ones for the new recipient). Applied in spec §2.5 step 3, SM-FOLLOWUP-001 and SM-REMINDER-001 rows, and Mermaid Part 1 `kind`/`cancelOld` edges. Scenario WF-FOLLOW-001 #7 |
| RV3-09 | Fixed (question stays open) | The "keep" option is kept but annotated: it orphans the callback under Batch 3's own guards unless a guard exception is adopted. Applied in §2.1, deps B3-Q03, and the Mermaid `fuApply` label |
| RV3-10 | Fixed | Mermaid WF-CALL-002 Part 2: `relLapse` now ends in its own terminal `relEnd` ("Expires at lease end, no further action"). Only network loss and idle expiry reach `retake`. Spec §2.2 and SM-RESERVATION-001 release row state that this path never enters the stale-client path |
| RV3-11 | Fixed | R-08 applied. Spec §2.5 has two families: reminders (follow-ups and meetings, SM-REMINDER-001) and notifications (other §16 alerts, no state model, same C6 and D6 rules). New events `notification.sent/failed/suppressed` in the spec and G2. §2.5.1 table has a "Family" column. Mermaid WF-NOTIFY-001 Part 1 decision `family` routes s3–s5 to `nRecip` → `nSend`, not to the reminder instance |

**Minors addressed in passing:**
- WF-REJECT-001: added an access-result decision.
- WF-CALL-001 Part 2: `ownerStart` now passes `authOk`.
- WF-CALL-002 Part 2: added an idle/browser-closed expiry entry.
- §2.1: "one current assignee" retagged Proposed.
- WF-CALL-003 Part 2: the `audit` node now names its events.
- Suppress-vs-redact is now tagged as an Agent 3 proposal.

**Drawing-time preparation:**
- Flowcharts now carry `classDef` colours (as Batch 2 did).
- Semicolons were removed from all labels and subgraph titles.
- Re-checked with my own lint script: all 10 flowcharts pass with 19–25 nodes, and the 4 state diagrams are clean.
