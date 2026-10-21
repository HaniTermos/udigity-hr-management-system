# Batch 2 Specification Re-review, round 2 (Independent Reviewer)

Reviewed: the repaired `docs/phase2/batch2/batch2-spec.md` (656 lines), `batch2-mermaid.md` (712 lines) and `open-items.md` (108 lines), all marked "Baseline: SB-2, repair attempt 1".
`repair-log.md` was read only as an index. **Every status below comes from the files themselves, not from the log.**
Checked against SB-2 (`shared-baseline.md`, incl. R-01..R-13 and §11), ART-01, the round-1 review (`batch2-spec-review.md`), and Board 01 quotes verified in round 1 (`24:414`, `25:430`, `26:430`, `27:470`).
The Mermaid structure script was re-run. It lives in the session scratchpad, not the project. Its checks: defined nodes, edge endpoints, labelled decision exits, node counts, reserved IDs, node-ID/classDef clashes, non-ASCII/HTML, and stateDiagram forbidden keywords.
No Figma file was read or written in this round. Nothing is approved.

---

## 1. Per-defect status (RV2-01..RV2-23)

| ID | Sev. | Status | Evidence in the repaired files |
|---|---|---|---|
| RV2-01 | Blocker | **Fixed** | Spec §6.1 "Table RT — Resource types (R-06)". It has rows for Business, Edit history entry, Call attempt, Follow-up, **Contact reservation** ("Inherits (no exception row)"), **Deal record**, **Meeting** ("Inherits from the deal record"), Project, Task, Data-correction request, Notification / reminder, **Export row** ("**Per-row Access check** as that resource type… Row excluded and not counted") and Duplicate preview. That covers all 11 R-06 types plus 2 more, each marked inherits or DEC-002 row. The rule is kept in WF-ACCESS-001: "Batches 3–4 supply **facts**…; the **rules**… are defined here only." Mermaid Part 2 subgraph: "Related record: rule defined in Table RT; Batches 3 and 4 supply relation facts". Part 3 `expRow` → `expOut` "Row excluded and not counted" |
| RV2-02 | Major | **Fixed** | Header line 3 "**Baseline: SB-2**". VT-1 row "Owner: skip steps 5–8… R-01 [Proposed ruling]". `ownerJump` "(C1, R-01)", `inO` "(R-01)". §11 rows B7 (R-02), R-06, R-07, R-11, R-12. open-items §4.1 "Resolved by SB-2 (rulings are Proposed, not approved)" |
| RV2-03 | Major | **Fixed** | §6.4 "classified **'assigned but inaccessible' (derived)** and shown to the Owner for a decision. **No automatic reassignment.**" Also in §7.1, VT-2 Call Center row, VT-7 row "Assigned day 14, no contact, now day 16" and scenario 9. Mermaid Part 3 `b7cls` (blue, derived) and `ownerDec` "any reassignment via WF-CALL-001 (B8)" |
| RV2-04 | Major | **Fixed** | VT-3 now has rows for assign business, log call attempt / finalize outcome (`27:455`), reservation acquire/renew/release and override (`27:452`, DEC-004), follow-up actions, reopen Rejected (DEC-016), assign Developer (E2), meetings (DEC-005), commercial stage, signature/payment/closure (`27:458`, DEC-006, R-12), closed-deal list and project/tasks (`27:461`) |
| RV2-05 | Major | **Fixed** | VT-4 "Reset events \| None \| `call_attempt.logged`, `follow_up.scheduled` (R-07, Proposed alignment…)". §4A Visibility. Mermaid `altB` "…latest call_attempt.logged or follow_up.scheduled (R-07)". `timer` "R-07 reset events only". Scenario 10 |
| RV2-06 | Major | **Fixed** (USER question remains) | VT-1 step 2b: "Administrative access denied [Confirmed]. Everything else is **R-11 → USER**: Reading R11-a… Reading R11-b…". The same split appears in the WF-BIZ-001 and WF-BIZ-003 preconditions, scenario 4 ("**not decided**") and VT-7 "Owner, 2FA pending". Mermaid SM-VISIBILITY-001 Part 1 `pend` → `r11` decision with labelled readings. (WF-BIZ-001 Part 1 drawing: see RV2-25) |
| RV2-07 | Major | **Fixed** | Node labels: `altA` "Alt NM-A (drafted)…", `similar` "(Alt SN-1 drafted, as ART-11 D11…)", `phonePolicy` "drafted alternatives", `altB`/`altC` "Alt CA-B/CA-C (drafted)", `denied` "(Alt CA-A drafted…)", `deact`/`inUse` "Alt CR-1/CR-2 (drafted)", `scDE` "Alt DE-1 (drafted)…". The header-meta table says "drafted… not Board 01". Spec §0.1 drafted-alternatives table; VR-5 and VT-2 marked drafted; DR-4 "coincides with ART-11 D11, Tier 4". A grep for Alt PH/NM/SN/DE/CA/CR in node labels without "drafted" found none |
| RV2-08 | Major | **Fixed** | §5 "Category removal behaviour — its own question (no DEC ID)… It is **not** C-01". Alt CR-1/CR-2. Mermaid subgraph "Category removal (no DEC ID; drafted alternatives; C-01 may influence)". §12 has a separate "Category removal (no DEC ID)" row. A grep finds no "C-01 Alt" left |
| RV2-09 | Major | **Fixed** (one residual slip, RV2-24) | Labels re-prefixed: VR-, DR-, VT-, RT, BIZ1-a.., BIZ2A-a.., BIZ2B-a.., CAT-a.., Alt DE-/SN-/NM-/PH-/CA-/CR-. A grep finds no bare V1..V12, D1..D9 (local), Alt S1/S2 or Alt P1/P2. The remaining "D6" hits are the SB-2 contract D6 (R-09), which is correct |
| RV2-10 | Major | **Fixed** | Mermaid Part 2: `bizChk -->\|"Denied"\| own`; `own` "Item owned by U?… list rows never"; `own -->\|"No"\| omit` "Item omitted and not counted". `dec005` is now a decision with "Alt 1 and assigned to U: read-only" → `bizChk` and "Alt 1 not assigned, or Alt 2" → `deny005` "row omitted and not counted (R-12, USER)". No denied exit reaches an item-shown end. Spec §6.3 and scenario 7 agree |
| RV2-11 | Major | **Fixed** | DR-8 "(b) every edit that changes the name or a phone (including the apply step…)… edit/edit on different businesses, or edit/create". §4A step 6(c). Mermaid Part A `res -->\|"Concurrent duplicate found"\| blocked`. Part A scenario 4. §8.1 apply rows "atomic re-check DR-8" |
| RV2-12 | Major | **Fixed** (USER confirmation via OI-27) | VT-5 has a new column "Actions allowed under the context-limited outcome [Proposed]" for every row, e.g. row 6 "apply the request through WF-BIZ-002 Part A (the **only** context-limited master-data edit)". VT-6 references it. Mermaid `editChk` "Context-limited: only row 6 Alt B apply"; Part A `access` matches |
| RV2-13 | Minor | **Fixed** | §0.4 and §6.2 "Edit history: any user who passes the check (SB-2 §11), showing only fields that the outcome allows [Proposed field limit]". Mermaid `limitedV --> nextAct -->\|"View edit history"\| hist` |
| RV2-14 | Minor | **Fixed** | DR-8 "[Confirmed-derived] from DR-5…". Save conflict "[Confirmed-derived…; 'no silent overwrite' Proposed…]". VT-3 Manage categories "CC/Dev No [Proposed] (Board `27:446` non-owner Unresolved)". VT-5 rows 3–5 "who" is *implied*. §3 step 8 "[Proposed interpretation; OI-17a]" |
| RV2-15 | Minor | **Fixed** (other VT-7 rows: RV2-28) | VT-7 "DEC-005 Alt 1: **context-limited, read-only** contact and notes"; "`follow_up.scheduled` on day 18 for day 22; now day 20" |
| RV2-16 | Minor | **Fixed** | `altB` "Alt B: 15 days from creation, then from latest…" |
| RV2-17 | Minor | **Fixed** | §4B Preconditions "**No attendance gating (A1).**" |
| RV2-18 | Minor | **Fixed** | `saveFail` / `catSaveFail` (the script reports no ID/classDef clash). `nameChk -->\|"Missing"\| nameMiss` and `-->\|"Duplicate"\| dupCat`. `blockDel` is now a pill end node. `fullV`/`limitedV` → labelled decision `nextAct` |
| RV2-19 | Minor | **Fixed** | §4A Decision dependencies "…**DEC-003** (duplicate preview)…" |
| RV2-20 | Minor | **Fixed** | `data_correction_request.*` throughout §4B, §8.1, §10. `business.duplicate_blocked` entity "(attempted create or edit; no business saved; references the matched business)". `business.hidden_match_revealed` actor "System, to Data Entry (the Owner always sees full matches)" |
| RV2-21 | Minor | **Fixed** | R-12 → USER appears in VT-2, VT-3 (closure row), VT-7, Table RT Deal record, §6.3, `deny005` and `scDev` |
| RV2-22 | Minor | **Fixed** | "Deal record" in §0.4, Table RT, VT-2, VT-5 row 1. The only remaining "closed deals" is the canonical UC-PROJ-001 title. "Rejected (request)" in §8, §8.1, `RejectedReq`, `rRejected` and the G1 line |
| RV2-23 | Minor | **Fixed** | VR-8 "DEC-024… is **possibly related; its scope is not defined** and no meaning is assigned to it here". `vSocial` no longer cites DEC-024. OI-28 |

**Summary:** 23 of 23 Fixed. Two of them have small residual or knock-on items, logged as new defects below (RV2-24, RV2-28). No Blocker or Major remains open.

---

## 2. New defects introduced or exposed by the repair

| ID | Severity | Artifact + exact location | Evidence (quoted) | Required fix |
|---|---|---|---|---|
| RV2-24 | Minor | spec §6.1 Table RT, row "Business", column "Relation facts" | "creator (B2 batch), current assignee (WF-CALL-001)…". "B2" is contract B2 (phone/eligibility), so this repeats the label clash that RV2-09 removed | Write "creator (Batch 2, WF-BIZ-001)" |
| RV2-25 | Minor | mermaid WF-BIZ-001 Part 1, node `r11` and edge `authz -->\|"Owner with 2FA pending"\| r11` | `r11(["Owner with 2FA pending: R-11, USER decision. Reading R11-a: denied. Reading R11-b: only admin actions blocked"])` is a **terminal** node for both readings. Under R11-b the flow still stops, while spec §3 says R11-b may allow non-administrative creation ("whether creation counts as administrative is part of the same question"). An unresolved decision is drawn as a dead end, not as unselected branches. SM-VISIBILITY-001 Part 1 draws the same item correctly as a decision (`r11` with two labelled exits) | Make `r11` a decision with labelled exits: "Reading R11-a" → `denied`; "Reading R11-b (creation administrative? USER)" → a yellow policy-dependent node or `enter`. Keeps the ≤ 25-node limit (19 nodes) |
| RV2-26 | Minor | mermaid WF-ACCESS-001 Part 3, nodes `proceed`, `b7`, `b7cls` | `proceed[["Calling action continues in WF-CALL-002 or WF-CALL-003"]]`, but §6.4 lists "schedule/complete follow-up" among B7 actions, which belong to WF-FOLLOW-001 (Batch 3). The failing exit `b7 -->\|"Fails for the assignee"\| b7cls` shows only the Owner classification; the acting agent's own result (action denied, no business data, per VT-6 "Record hidden by policy") is not drawn | Add WF-FOLLOW-001 to `proceed`. Add a red end such as "Agent: action denied, Record hidden by policy, no data", with `b7cls` as a dotted side effect. 20 nodes after the fix |
| RV2-27 | Minor | spec §6.1 "Rules common to all rows" (4) and §6.2 Lists/Detail vs mermaid WF-ACCESS-001 Part 1 `evalD -->\|"Context-limited"\| limitedV` | Rule (4): "context-limited items appear only in their context surface, never in general business search". VT-5 row 2: "Closed-deal list only (Board: 'not permanent business visibility')". Yet a direct business URL can reach the context-limited detail view, and the spec does not say whether that detail is the context surface. This leaves a route to business detail outside the granting context (e.g. a Developer pasting a business URL) | State in §6.2 that a direct business URL under a context-limited outcome renders only the granting context's view (or is denied outside it). Tag it [Proposed] and tie it to OI-27 |
| RV2-28 | Minor | spec §7.8 VT-7, rows "`call_attempt.logged` day 12, now day 20, no follow-up" and "Assigned day 14, no contact, now day 16" | Neither row gives the **creation day**, yet both Alt A results ("Hidden") depend on it (Alt A counts from creation). The round-1 table had "Created day 0" on the equivalent row | Add "created day 0" to both rows |

Areas probed with **no new defect:**
- **Table RT vs R-06:** all 11 types present; each inherits or names its DEC-002 row; rules kept in Batch 2 (C5).
- **VT-5 vs R-01/B7:** Owner skips steps 5–8 and keeps step 9 ("Rejected… still do-not-call for the Owner per R-01"). Row-5 actions include "log call attempt", consistent with B7 (the check passes as context-limited). The VT-5 actions column is tagged [Proposed], not Confirmed.
- **Part 2/Part 3 split:** clean. Part 2 has 12 nodes and Part 3 has 19. The hand-offs are consistent with spec §6.3/§6.4.
- **Leakage of inaccessible items:** every list/count path ends in "omitted and not counted" (`omit`, `deny005`, `expOut`, `denyScope`, `denyHidden`, Part 1 `empty`). Redaction is limited to owned items (rule 3). Notifications carry no data when denied (`notifNo`). Duplicate existence-only is the Confirmed ART-01 §7 behaviour.
- **Confirmed tags:** new Confirmed tags were checked against ART-01 or SB-2 §4. Examples: VT-1 2b admin part (ART-01 §3); VT-3 call logging `27:455`, delivery board `27:461`, closure `27:458`; follow-ups ART-01 §2.3/§10; Developer commercial status ART-01 §2.4; exports Owner-only SB-2 §4. Owner follow-up actions are correctly "[Confirmed-derived]". None was found without tier-1/2 or SB-2 §4 backing.
- **Terminology and IDs:** no new shared IDs or DEC IDs; no DEC meaning changed. New local labels (RT, VT-, OI-27..29) are declared local.
- **Scenarios:** ≥ 3 per critical workflow, labelled "Intended behaviour, not tested"; the new scenarios 9–11 and Part A-4 are consistent with the rules.

---

## 3. Mermaid structure check (re-run)

| Diagram | Nodes | Edges | Undefined refs | Unlabelled decision exits | Reserved IDs / classDef clash | Non-ASCII/HTML |
|---|---|---|---|---|---|---|
| WF-BIZ-001 Part 1 | 18 | 25 | none | none | none | none |
| WF-BIZ-001 Part 2 | 24 | 31 | none | none | none | none |
| WF-BIZ-002 Part A | 20 | 26 | none | none | none (`fail` renamed) | none |
| WF-BIZ-002 Part B | 22 | 25 | none | none | none | none |
| WF-BIZ-003 | 23 | 29 | none | none | none (`fail` renamed) | none |
| WF-ACCESS-001 Part 1 | 21 | 22 | none | none | none | none |
| WF-ACCESS-001 Part 2 | 12 | 13 | none | none | none | none |
| WF-ACCESS-001 Part 3 | 19 | 18 | none | none | none | none |
| SM-VISIBILITY-001 Part 1 | 18 | 22 | none | none | none | none |
| SM-VISIBILITY-001 Part 2 | 21 | 22 | none | none | none | none |
| SM-DATAFIX-001 (stateDiagram-v2) | 6 states | 15 | none undeclared / unused | n/a | no `note`/`classDef`/`style` | none |

Every node count is ≤ 24, within the ~25 limit, and every node is connected. Rectangle sinks remaining: `noPhone`, `escal`, `timer`, `sNotify`, `effect`, `hist`, `logDeny`. All are dotted side effects or informational yellow nodes, which is acceptable under the notation.

---

## 4. Per-diagram verdict

| Diagram | Verdict | Note |
|---|---|---|
| WF-BIZ-001 Part 1 | **Not ready** | RV2-25 (Minor): turn `r11` into a two-exit decision. No re-review needed after this edit |
| WF-BIZ-001 Part 2 | **Ready to draw** | |
| WF-BIZ-002 Part A | **Ready to draw** | |
| WF-BIZ-002 Part B | **Ready to draw** | |
| WF-BIZ-003 | **Ready to draw** | |
| WF-ACCESS-001 Part 1 | **Ready to draw** | RV2-27 is a spec-text clarification; the node `limitedV` stays valid |
| WF-ACCESS-001 Part 2 | **Ready to draw** | |
| WF-ACCESS-001 Part 3 | **Not ready** | RV2-26 (Minor): add WF-FOLLOW-001 to `proceed` and the agent-denied end. No re-review needed after this edit |
| SM-VISIBILITY-001 Part 1 | **Ready to draw** | |
| SM-VISIBILITY-001 Part 2 | **Ready to draw** | |
| SM-DATAFIX-001 | **Ready to draw** | |

The text-only Minors (RV2-24, RV2-27, RV2-28) should be fixed in the spec before the tables (RT, VT-7) are drawn beside the diagrams. They do not block the diagrams.

**Open Blocker/Major defects: none.** USER-reserved items remain open and are correctly drawn as unselected: R-11, R-12, OI-27 (context-limited actions), and the drafted alternative sets (OI-01, OI-02, OI-03, OI-16). Nothing in this review approves any of them.
