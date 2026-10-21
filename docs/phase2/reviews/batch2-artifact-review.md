# Batch 2 Board Artifact Review (Independent Reviewer, task T2d)

**Scope:** the drawn Batch 2 artifacts on Board 02 (FigJam `lwmKQNJI42na8B3SSNLQJP`).
- Section 04 (`30:1421`): WF-BIZ-001 P1/P2, WF-BIZ-002 PA/PB, WF-BIZ-003, SM-DATAFIX-001 + table.
- Section 05 (`30:1424`): WF-ACCESS-001 P1/P2/P3, plus sub-area `56:2624` holding SM-VISIBILITY-001 P1/P2 and tables RT, VT-1, VT-3, VT-5.

**Access:** read only. Only `get_figjam` and `get_screenshot` were used. Nothing was written to any Figma file. Nothing is approved here.

**References:**
- Content baseline: `batch2-mermaid.md` and `batch2-spec.md`, after the round-2 Minor repairs, which are already in the source.
- Also used: SB-2, and Agent 2's `verification.md` and `repair-log.md`. These two were read as claims and checked independently.

---

## 1. Method and evidence

1. **Structure read-back.** I ran `get_figjam` on `30:1421` (73,734 chars) and `30:1424` (102,843 chars). Both outputs were saved to files and parsed **in full** by a scratchpad script, which:
   - matched every board shape to a Mermaid node by exact label text;
   - compared every connector as a (start label, end label, edge label) triple against the Mermaid edges.
2. **Table read-back.** All 5 tables were parsed cell by cell and compared with the spec markdown tables: §8.1, §6.1 RT, §7.2 VT-1, §7.4 VT-3 and §7.6 VT-5.
3. **Screenshots** (`enableBase64Response: true`, max 1600 px):
   - All 11 diagram sections and all 5 tables.
   - Close-ups of `36:1598` (WF-BIZ-001 P2 "Duplicate blocked"), `43:1848` (WF-BIZ-002 PB review group), `57:2634` (SM-VISIBILITY-001 P1 session group), `33:1425` (`authz`) and `33:1473` (`r11b`).
4. **Header meta lines** were read from the text nodes in the read-back and compared with the spec's per-workflow fields.
5. **Mermaid source re-check.** My structure script on the current `batch2-mermaid.md` reports: no undefined references, no unlabelled decision exits, no ID/classDef clashes, all node counts ≤ 24.

### 1.1 Structural match (script result)

| Diagram (node) | Board shapes / connectors | Mermaid nodes / edges | Label and edge diff |
|---|---|---|---|
| WF-BIZ-001 P1 `34:1547` | 19 / 28 | 19 / 28 | **none** |
| WF-BIZ-001 P2 `37:1690` | 24 / 31 | 24 / 31 | **none** |
| WF-BIZ-002 PA `42:1810` | 20 / 26 | 20 / 26 | **none** |
| WF-BIZ-002 PB `44:1931` | 22 / 25 | 22 / 25 | **none** |
| WF-BIZ-003 `46:2064` | 23 / 29 | 23 / 29 | **none** |
| SM-DATAFIX-001 `48:2127` | 6 states + start `47:2065` + end `47:2086/2087` (frame `47:2088`) / 15 | 6 states / 15 | Only the `[*]` pseudo-states differ; they are drawn as start/end shapes. All 15 transition labels match |
| WF-ACCESS-001 P1 `50:2455` | 21 / 22 | 21 / 22 | **none** |
| WF-ACCESS-001 P2 `54:2518` | 12 / 13 | 12 / 13 | **none** |
| WF-ACCESS-001 P3 `56:2621` | 20 / 19 | 20 / 19 | **none** |
| SM-VISIBILITY-001 P1 `58:2727` | 18 / 22 | 18 / 22 | **none** |
| SM-VISIBILITY-001 P2 `60:2835` | 21 / 22 | 21 / 22 | **none** |

- Every connector has both endpoints attached; the script found none unattached.
- The round-2 repairs are on the board:
  - `r11` is a decision with "Reading R11-a…" and "Reading R11-b" exits (connectors `33:1502`, `33:1506`).
  - `proceed` names WF-FOLLOW-001.
  - `agentDen` exists.

### 1.2 Table match (script result)

| Table | Size | Cell diffs vs spec |
|---|---|---|
| SM-DATAFIX-001 transitions `48:2130` | 12 × 9 | 3. All are dropped quotation marks only, e.g. board `Stays Submitted; already in review` vs spec `Stays Submitted; "already in review"`. No content difference |
| Table RT `62:2835` | 14 × 7 | 0 (includes the RV2-24 fix "creator (Batch 2, WF-BIZ-001)") |
| VT-1 `62:3033` | 13 × 4 | 0 |
| VT-3 `62:3139` | 23 × 6 | 0 |
| VT-5 `62:3417` | 7 × 8 | 0 |

The table content is therefore exactly the spec content. That content was already checked against SB-2 in round 2: R-06 types, R-01 Owner skip, B7, R-11 readings, R-12 notes, and VT-5 actions tagged Proposed.

---

## 2. Per-artifact verdict

| Artifact | Node | Verdict | Defects |
|---|---|---|---|
| WF-BIZ-001 Part 1 | `34:1547` | Acceptable with cosmetic issues | RV2A-05 |
| WF-BIZ-001 Part 2 | `37:1690` | Acceptable with cosmetic issues | RV2A-01, RV2A-07 |
| WF-BIZ-002 Part A | `42:1810` | Acceptable with cosmetic issues | RV2A-02, RV2A-06, RV2A-07 |
| WF-BIZ-002 Part B | `44:1931` | Acceptable with cosmetic issues | RV2A-05 |
| WF-BIZ-003 | `46:2064` | Acceptable | — |
| SM-DATAFIX-001 diagram + table | `48:2127` / `48:2130` | Acceptable with cosmetic issues | RV2A-03 |
| WF-ACCESS-001 Part 1 | `50:2455` | Acceptable with cosmetic issues | RV2A-05 |
| WF-ACCESS-001 Part 2 | `54:2518` | Acceptable with cosmetic issues | RV2A-05 |
| WF-ACCESS-001 Part 3 | `56:2621` | Acceptable | — |
| SM-VISIBILITY-001 Part 1 | `58:2727` | Acceptable with cosmetic issues | RV2A-02 |
| SM-VISIBILITY-001 Part 2 | `60:2835` | Acceptable with cosmetic issues | RV2A-07 |
| Table RT | `62:2835` | Acceptable | — |
| Table VT-1 | `62:3033` | Acceptable | — |
| Table VT-3 | `62:3139` | Acceptable | — |
| Table VT-5 | `62:3417` | Acceptable | — |
| Sub-area set (tables beside diagrams) | `56:2624` | Acceptable with cosmetic issues | RV2A-08 |

**No artifact is Defective. There is no Blocker and no Major.**

---

## 3. Defect table

| ID | Severity | Node id | What I saw | Fix |
|---|---|---|---|---|
| RV2A-01 | Minor | WF-BIZ-001 P2 diamond `canRead` and its "Not readable" connector, inside `36:1598` | The issue Agent 2 escalated. In the close-up of `36:1598`, the diamond's last line and the edge label run together: "read the matchNot readable: hidden or out of scope". The "?" is covered, and the label's tail ("scope") touches the "Unreadable match…" box. **Does it mislead?** Not semantically. The other exit "Readable, or Owner" is clear, the target node says "Unreadable match: extra detail per DEC-003 (unselected); minimum is already exists", and the read-back holds the exact label. But this is the hidden-match branch (DEC-003), so it should read cleanly before any approval | Manual nudge in FigJam: drag the label along its connector, or move the connector's label position. Do not move shapes; Agent 2 showed that this leaves stale routes. Cosmetic; no regeneration needed |
| RV2A-02 | Minor | Edge colours: WF-BIZ-002 PA connector `changed` → `save` ("No"); SM-VISIBILITY-001 P1 connector `pend` → `role` ("No") and `pend` → `r11` ("Yes") | The generator colours every "No" edge red and every "Yes" edge green, whatever it means. SM-VISIBILITY-001 P1 thus draws the **normal path for every non-pending request** (Step 2b "No" → Step 3) in red. WF-BIZ-002 PA draws "no name/phone change → save" in red, while the 2FA-pending branch is green. SB-2 §7 defines red as failure (for nodes). A reader can take these normal paths as failures | Recolour these connectors neutral grey manually, or ask the orchestrator to add a legend note in section 00: "edge colours are automatic; only node fills follow the legend". Same caveat as `verification.md` §7.2 |
| RV2A-03 | Minor | SM-DATAFIX-001 `48:2127`, around state "In review" | Crowded. The "reviewer starts review" and "released or reviewer deactivated" edges (Submitted ↔ In review) run side by side with arrowheads bunched at In review, so their direction is hard to tell. "apply blocked" floats above In review with no visible self-loop curve. "rejected with reason" sits on a segment that visually continues toward the "requester withdraws" path into Withdrawn. All 15 labels exist, and the transition table directly below (`48:2130`) is complete and correct, which limits the risk | Manually spread the Submitted/In review edges. Pull "rejected with reason" onto the In review → Rejected (request) segment. Make the self-loop visible. Optional: add a line under the header: "Table below is authoritative for transitions" |
| RV2A-04 | — | (withdrawn) | Not used. The Yes/No colours on WF-ACCESS-001 P1 `exists` and P2 `own` happen to match their meaning, so they are not a defect | — |
| RV2A-05 | Minor (cosmetic) | Label overlaps: WF-BIZ-001 P1 connector `r11b → enter` label over shape `33:1473`; WF-BIZ-002 PB "Hidden from Data Entry" over `rOwner` (seen in the `43:1848` close-up); WF-ACCESS-001 P1 "Denied: hidden by policy" over shape `49:2372`; WF-ACCESS-001 P2 "Not closed: accepted opportunity" over the `devPre` diamond | Each label touches or slightly overlaps its neighbour node. All are still legible in the screenshots and match `verification.md` §7.1. In WF-ACCESS-001 P1 the four `evalD` exit labels share one vertical trunk, so which label belongs to which branch is readable only by following the line | Optional manual label nudges. No content change |
| RV2A-06 | Minor (cosmetic) | WF-BIZ-002 PA `42:1810` layout | The ELK layout puts "Edit and validate" (`41:1707`) at the far right and "Duplicate revalidation" (`41:1717`) at the far left. The main path reads right → left → centre, with two section-wide return edges ("Valid", "Concurrent duplicate found"). It is readable but against the left-to-right phase reading of SB-2 §7 | Accept as is, or re-lay out manually if a cleaner board is wanted before approval |
| RV2A-07 | Minor | Header meta texts `37:1692`, `42:1812`, `60:2837` | Compared with the spec's decision-dependency fields: `37:1692` (WF-BIZ-001 P2) omits C-02 (the node `done` shows "(C-02)") and C-01 (archived businesses in DR-2); `42:1812` (WF-BIZ-002 PA) omits R-11 and "category removal (no DEC ID)", both listed in spec §4A; `60:2837` (SM-VISIBILITY-001 P2) has **no UC field**, while every other header has one (planned "as Part 1": UC-BIZ-008, UC-PROJ-001). All headers carry "Status: DRAFT, not approved" and "Baseline SB-2" | Add the missing items to the three meta lines (text-only edits) |
| RV2A-08 | Minor | Sub-area `56:2624` (tables) vs spec §13 | Spec §13: "Tables to draw beside the diagrams in T2c: Table RT, VT-2, VT-3, VT-5, VT-7 and §8.1". The board has RT, **VT-1**, VT-3, VT-5 and §8.1. **VT-2** (role scope, including drafted Alt DE-1/DE-2 and the B7 text) and **VT-7** (worked evaluations) are not drawn. VT-2's content is only partly visible in SM-VISIBILITY-001 P1 nodes `scDE`/`scCC`/`scDev`. The orchestrator's T2d list names RT/VT-1/VT-3/VT-5, so this may be intended | Orchestrator decides: either draw VT-2 (and optionally VT-7), or change spec §13 to match the board |

---

## 4. Specific checks requested

- **Match with Mermaid:** exact for all 11 diagrams (§1.1). No missing, extra or relabelled node or edge.
- **Decision exits:** every decision diamond's exits carry labels on the board; the read-back connector text matches the source. None were seen without a label in the screenshots.
- **Header meta:** all 11 diagram headers carry "Status: DRAFT, not approved", the UC (except `60:2837`), REQ ranges marked "(range/ranges)", actors, policy-dependent items and "Baseline SB-2". Drafted alternatives are flagged "not Board 01" in `34:1549`, `37:1692`, `46:2066` and `58:2729`. WF-ACCESS-001 P3 correctly marks "C1, C3 Confirmed" and the rest Proposed. Omissions are in RV2A-07.
- **Tables:** content identical to the spec (§1.2). The text is fully legible in screenshots; no truncated cell was seen. VT-1 row 2b shows the R-11 readings, "neither selected". VT-5's actions column is tagged "[Proposed]".
- **Unresolved policies visibly unselected:**
  - DEC-001 Alt A/B: both orange in SM-VISIBILITY-001 P2.
  - DEC-002 rows 1–6: each shows Alt A / Alt B text.
  - DEC-005: "unselected", with two labelled exits.
  - DEC-013 NM-A/B/C and SN-1/SN-2, DEC-015 CA-A/B/C, category removal CR-1/CR-2, and phone PH-1/PH-2: all orange and labelled "(drafted)".
  - R-11: the "USER decision, unselected" decision appears in both WF-BIZ-001 P1 and SM-VISIBILITY-001 P1.
  - DEC-003 escalation: "only if adopted".
  - Nothing is drawn as selected.
- **Hidden-data leakage:** no leakage path is visible.
  - Lists and searches end in "Empty state; inaccessible matches not hinted or counted" (P1).
  - Denied related list rows end in "Item omitted and not counted".
  - Developer pre-closure denial ends in "row omitted and not counted (R-12, USER)" (P2).
  - Denied export rows end in "Row excluded and not counted" (P3).
  - Denied notifications carry "no business data" (P3).
  - The duplicate warning for an unreadable match is existence-only ("already exists"), the Confirmed ART-01 §7 behaviour.
  - Redaction appears only on the owned-item exit ("list rows never").
- **Escalated defect:** see RV2A-01. Severity **Minor**. It is cosmetic and not semantically misleading, but it sits on a security-relevant branch, so I recommend the manual label nudge before any approval.

---

## 5. What I could not inspect

- **Phase subgraph titles.** The phase sections exist in the read-back with correct names (e.g. `33:1425` "Authorization", `36:1598` "Duplicate blocked: no bypass, no merge", `45:1988` "Category removal (no DEC ID, drafted alternatives, C-01 may influence)"). Their **names are not visible** in the server-rendered screenshots, which show only unlabelled boxes. I could not confirm whether FigJam's UI shows them. If it does not, the phase grouping that SB-2 §7 requires would read only as boxes.
- **Fine detail of the large sections.** At the 1600 px cap, the wide sections (WF-BIZ-001 P1/P2, WF-BIZ-003, SM-VISIBILITY-001 P1/P2; 4,800–7,300 px wide) render small text at about 0.2–0.3 scale. Their node and edge text was verified through the read-back, not visually at full size. Close-ups were taken only for the five sub-nodes listed in §1.
- **Node fill colours.** These are not in the `get_figjam` output, so they were judged from screenshots only. They match the SB-2 legend everywhere I could see.
- **Rendering in the FigJam client.** Not checked; all images are server renders. Connector routes after any future manual nudges are also unchecked.
- **Board 01 and sections outside 04/05.** Not re-read in this task. Agent 2's claim that other sections were not moved was not re-verified beyond the 04/05 positions in the read-back (04 at 11690,0; 05 at 20290,0; widths 8000).
