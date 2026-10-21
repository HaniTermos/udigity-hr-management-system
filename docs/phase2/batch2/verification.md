# Phase 2 Batch 2 — Board 02 verification record (task T2c-part2)

**Baseline: SB-2.** Board 02: FigJam fileKey `lwmKQNJI42na8B3SSNLQJP`. Written 2026-10-20 by Agent 2 under the write lease for sections 04 (`30:1421`) and 05 (`30:1424`).
Status of all drawn content: **DRAFT, not approved.** No software exists; nothing was tested. This record states only what was actually read back or seen.

Link pattern: `https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=<id with - instead of :>`.

## 1. Artifact index

| Artifact | Parent | Node ID | Link | Version |
|---|---|---|---|---|
| Section 04 — Business Data & Corrections | board | `30:1421` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=30-1421) | enlarged to 8000 × 10795 (width unchanged) |
| WF-BIZ-001 Part 1 | 04 | `34:1547` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=34-1547) | v1 (one shape resized) |
| WF-BIZ-001 Part 2 | 04 | `37:1690` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=37-1690) | v1 |
| WF-BIZ-002 Part A | 04 | `42:1810` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=42-1810) | v1 |
| WF-BIZ-002 Part B | 04 | `44:1931` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=44-1931) | v1 (one shape resized) |
| WF-BIZ-003 | 04 | `46:2064` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=46-2064) | v1 |
| SM-DATAFIX-001 diagram + transition table | 04 | `48:2127` (table `48:2130`) | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=48-2127) | v1 |
| Section 05 — Access & Visibility | board | `30:1424` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=30-1424) | enlarged to 8000 × 12145 (width unchanged) |
| WF-ACCESS-001 Part 1 | 05 | `50:2455` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=50-2455) | v1 (one shape resized) |
| WF-ACCESS-001 Part 2 | 05 | `54:2518` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=54-2518) | v2 (v1 `52:2518` deleted) |
| WF-ACCESS-001 Part 3 | 05 | `56:2621` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=56-2621) | v1 (one shape resized) |
| Sub-area "Batch 2 state & decision models" | 05 | `56:2624` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=56-2624) | — |
| SM-VISIBILITY-001 Part 1 | sub-area | `58:2727` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=58-2727) | v1 (one shape resized) |
| SM-VISIBILITY-001 Part 2 | sub-area | `60:2835` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=60-2835) | v1 (six row boxes made taller) |
| Table RT — resource types | sub-area | `62:2835` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=62-2835) | 14 × 7 |
| Table VT-1 — evaluation order | sub-area | `62:3033` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=62-3033) | 13 × 4 |
| Table VT-3 — actions by role | sub-area | `62:3139` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=62-3139) | 23 × 6 |
| Table VT-5 — DEC-002 exception rows incl. allowed actions | sub-area | `62:3417` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=62-3417) | 7 × 8 |

**Placement decision:** SM-DATAFIX-001 and its transition table are in section **04** (business-data lifecycle). SM-VISIBILITY-001 and the four tables are in the 05 sub-area. Nothing was placed in section 11.

Each diagram section carries a 40 px bold title "<ID> — <name>" and a 22 px meta line "Status: DRAFT, not approved | UC | REQ range | Actors | Policy-dependent…". Where alternatives were drafted, the meta line says "drafted …, not Board 01". Header text node IDs: `34:1548/49`, `37:1691/92`, `42:1811/12`, `44:1932/33`, `46:2065/66`, `48:2128/29` (+ table label `48:2347`), `50:2456/57`, `54:2519/20`, `56:2622/23`, `58:2728/29`, `60:2836/37`; sub-area title `56:2625/26`; table labels `62:3032`, `62:3138`, `62:3416`, `62:3530`.

## 2. Procedure followed (SB-2 §8)
- Skills loaded before writing: `figma-generate-diagram` (+ `references/flowchart.md`, `references/state.md`), `figma-use`, `figma-use-figjam` (+ `create-section.md`, `create-table.md`, `position-figjam-nodes.md`). Tool schemas loaded via ToolSearch.
- One `generate_diagram` call per diagram, with `fileKey`. Immediately after each one, the new loose top-level nodes were wrapped in place. "New" meant top-level nodes not in {12:737, 12:739, 12:741, 12:743, 12:745, 30:1421, 30:1424}. Section bounds were computed with connectors skipped, and each child was set to `old − section` so absolute positions were preserved. Connectors were appended with their siblings; none was repositioned on its own. Then the header was added and the whole diagram section was moved into 04, 05 or the sub-area with `appendChild`, in rows with 120 px gaps starting at y = 260.
- Only 04 and 05 (and my own sub-area/diagram sections) were resized. No other board section was moved or resized; this was verified by reading back the top level (§3).
- Tables were built with `figma.createTable`. The header row is dark (#1E1E1E fill, white text, hex/255). Cell content was parsed programmatically from `batch2-spec.md` (§6.1, §7.2, §7.4, §7.6) so it matches the spec. The only change is that "*implied*" is rendered as "implied".

## 3. Structural read-back
- `use_figma` read-only listing after drawing:
  - The page has exactly the 7 original top-level sections and **no loose nodes**.
  - Positions and sizes of 00, 12, 02, 03 and 11 are unchanged (00 at 0,0 4020×2744; 12 at 4220,0 3300×1844; 02 at 0,2944 7564×6658; 03 at 0,9802 6608×1838; 11 at 6808,9802 4482×2870).
  - 04 is at 11690,0, 8000×10795. 05 is at 20290,0, 8000×12145. They do not overlap horizontally.
  - A sibling bounding-box overlap check inside 04, 05 and the sub-area found no overlaps.
- `get_figjam` on `30:1421` (73,710 chars) and `30:1424` (102,820 chars). Both outputs were saved to files and **parsed in full by script**.
  - Per diagram section, shapes / connectors, compared with the Mermaid source:

    | Diagram | Shapes / connectors | Matches source |
    |---|---|---|
    | WF-BIZ-001 Part 1 | 19 / 28 | yes |
    | WF-BIZ-001 Part 2 | 24 / 31 | yes |
    | WF-BIZ-002 Part A | 20 / 26 | yes |
    | WF-BIZ-002 Part B | 22 / 25 | yes |
    | WF-BIZ-003 | 23 / 29 | yes |
    | WF-ACCESS-001 Part 1 | 21 / 22 | yes |
    | WF-ACCESS-001 Part 2 | 12 / 13 | yes |
    | WF-ACCESS-001 Part 3 | 20 / 19 | yes |
    | SM-VISIBILITY-001 Part 1 | 18 / 22 | yes |
    | SM-VISIBILITY-001 Part 2 | 21 / 22 | yes |
    | SM-DATAFIX-001 | 6 states + start + end (end drawn as 2 ellipses) / 15 transitions | yes |

  - **Every connector has both `connectorStart` and `connectorEnd` attached** (0 unattached across 252 connectors).

## 4. Visual inspection (`get_screenshot` / `node.screenshot`)
What was looked at:
- Each diagram section in full: WF-BIZ-001 P1 at 1600 px and again at 3000 px, all others at 0.39–0.6 scale.
- Close-ups of these groups and shapes:
  - WF-BIZ-001 P1: the validation group, the entry shape and the `r11b` area.
  - WF-BIZ-001 P2: the duplicate-check and blocked groups.
  - WF-BIZ-002 P B: four suspect shapes and the Submit group.
  - WF-ACCESS-001 P1: the detail group.
  - WF-ACCESS-001 P3: the notifications group.
  - SM-VISIBILITY-001 P1: the session group.
  - SM-VISIBILITY-001 P2: the exception-row group.
- All four tables at 0.55–0.75 scale.
- Final overviews of sections 04 and 05 at 1600 px.

Seen:
- All nodes render with the Batch 1 notation colours from `classDef`: yellow for dependency, orange for alternatives, red for failure, green for success, blue for derived.
- Drafted alternatives carry "(drafted)" in their labels.
- Every decision edge label is present.
- Table text is complete in every cell after the fixes below.

## 5. Defects found and fixed

| # | Diagram | Defect seen | Fix | Result seen |
|---|---|---|---|---|
| V-01 | WF-BIZ-001 P1 | Entry parallelogram truncated ("…social accounts w…") | Shape resized about its centre (380×280), Entry group grown | Full text; connectors still attached |
| V-02 | WF-BIZ-002 P B | `sAcc` diamond truncated ("…passes for thi…") | Resized about centre (330×330) | Full text; connectors at vertices |
| V-03 | WF-ACCESS-001 P1 | `evalD` diamond truncated ("…read outc…") | Resized about centre (320×320) | Full text; branches attached |
| V-04 | WF-ACCESS-001 P2 v1 | Label "Alt 1 not assigned, or Alt 2" overlapped the `deny005` text (semantically important, RV2-10) | v1 deleted (own attempt); regenerated with `deny005` outside the `devP` subgraph (layout only, same content) | Label clear in v2 |
| V-05 | WF-ACCESS-001 P3 | `notifNo` truncated ("…visible to Owner…") | Resized about centre (300×230), group grown | Full text incl. "(D6)" |
| V-06 | SM-VISIBILITY-001 P1 | `authn` diamond truncated, then a mid-word break | Two resizes (220×220, then 290×230) | Reads "Step 2: session authenticated?" |
| V-07 | SM-VISIBILITY-001 P2 | Row 1 box truncated ("…Developer and C…") | All six DEC-002 row boxes made taller (175), width and centre unchanged | All six rows fully legible |
| V-08 | SM-DATAFIX-001 table | `closed_no_change` broke mid-word | Audit column widened to 420 | Single-word rendering |
| V-09 | Table VT-5 | "Row" header wrapped | Column 0 widened to 90 | Fixed (width change only; not re-screenshotted) |
| V-10 | WF-BIZ-003 (generation) | Parser rejected `;` in a subgraph title (nothing created) | Commas used; same fix applied pre-emptively to the WF-ACCESS-001 P2 title | Generated |

## 6. Escalated defect (stopped after two repair attempts, SB-2 §8.7)
- **WF-BIZ-001 Part 2, edge label "Not readable: hidden or out of scope" overlaps the `canRead` diamond text ("…read the match?").**
  - Attempt 1: shifted the four target nodes 140 px right. This cleared the label, but two connectors kept stale routes (the hiddenShow→blockEnd line ran through the preview box).
  - Attempt 2: re-assigned endpoints and toggled the line type. Routes did not recompute.
  - I then **reverted** the shift; the screenshot confirms the original clean routing.
  - Remaining state: the label partly covers the last words of the diamond text. Both texts are still mostly legible. Needs a manual nudge in FigJam, or acceptance as cosmetic.
- Lesson recorded: moving shapes after `generate_diagram` leaves stale connector geometry. Resizing a shape about its centre did not (V-01..V-07 all re-checked).

## 7. Residual issues (cosmetic unless stated)
1. Edge labels partly touching node edges, all still legible:
   - WF-BIZ-001 P1: "Only if creation is non-administrative" on the `r11b` box.
   - WF-BIZ-002 P B: "Hidden from Data Entry" on the `rOwner` box.
   - WF-ACCESS-001 P1: "Denied: hidden by policy" on the hidden-by-policy node.
   - WF-ACCESS-001 P2: "Not closed: accepted opportunity" near the `devPre` diamond.
2. **Notation caveat:** the generator auto-colours edges labelled "Yes" green and "No" red regardless of meaning (e.g. SM-VISIBILITY-001 P1 "Step 2b … pending? No" is a normal path drawn red). Only node fills follow the SB-2 legend. The section 00 legend (orchestrator) may want a note.
3. ELK layout choices produce long return edges: WF-BIZ-002 Part A (the "Edit and validate" phase is placed far right) and the retry loop in WF-BIZ-001 P2. Readable.
4. Crowding around "In review" in SM-DATAFIX-001; all 15 transition labels are present.
5. Subgraph (phase) names exist as FigJam section names (seen in the read-back), but were **not visible in the screenshots**. I could not confirm how they appear in the FigJam UI.
6. The lease notes `30:1423` / `30:1426` (orchestrator text) still say "Status: in progress". I left them unedited.
7. Sections 04 and 05 grew tall (10795 / 12145). Board-level re-flow is left to the orchestrator as instructed.

## 8. Not inspected
- Not every connector label in every diagram was viewed at close zoom. The groups listed in §4 were; the rest were checked only in the full-section views (labels legible at that scale but not individually confirmed).
- V-09 (VT-5 header width) was not re-screenshotted after the change.
- No check in the FigJam desktop or web client itself; screenshots are server renders.

## 9. Source changes made while drawing (also in `batch2-mermaid.md`)
- WF-BIZ-003 subgraph `remP` title: semicolons → commas (parser limitation).
- WF-ACCESS-001 Part 2 subgraph `relP` title: semicolon → comma.
- WF-ACCESS-001 Part 2: `deny005` moved outside the `devP` subgraph (layout only).

No semantic content changed.
