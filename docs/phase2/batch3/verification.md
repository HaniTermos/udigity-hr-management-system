# Phase 2 Batch 3 — Board 02 verification record (task T3d)

- **Baseline:** SB-2.
- **Board:** Board 02, FigJam fileKey `lwmKQNJI42na8B3SSNLQJP`.
- **Written by:** Agent 3 on 2026-10-20, under the SB-2 §9a leases for section 06 (`65:3584`) and section 07 (`65:3587`).
- **Status of all drawn content:** DRAFT, not approved. No software exists and nothing was tested.
- **Scope of this record:** only what was actually read back or seen.

Link pattern: `https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=<id with - instead of :>`

## 1. Artifact index

Each diagram section carries two header texts: a 40 px bold title and a 22 px meta line (Status DRAFT, UC, REQ range, actors, contracts, policy-dependent items). Header IDs are listed per row.

| Artifact | Parent | Node ID | Header texts | Link |
|---|---|---|---|---|
| Section 06 — Calling & Reservations | board | `65:3584` | lease notes `65:3585/86` (orchestrator, not edited) | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=65-3584) |
| WF-CALL-001 Part 1 | 06 | `93:4908` | `93:4909/10` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=93-4908) |
| WF-CALL-001 Part 2 | 06 | `96:5059` | `96:5060/61` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=96-5059) |
| WF-CALL-002 Part 1 | 06 | `100:5329` | `100:5330/31` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=100-5329) |
| WF-CALL-002 Part 2 | 06 | `104:5594` | `104:5595/96` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=104-5594) |
| WF-CALL-003 Part 1 | 06 | `108:5838` | `108:5839/40` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=108-5838) |
| WF-CALL-003 Part 2 | 06 | `110:6081` | `110:6082/83` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=110-6081) |
| SM-ASSIGNMENT-001 (diagram + table) | 06 | `113:6099` | `113:6100/01`; table label `115:6183`; table `115:6184` (8×9); reading note `153:9164` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=113-6099) |
| SM-RESERVATION-001 (diagram v3 + table) | 06 | `119:6757` | `119:6758/59`; diagram sub-section `152:9164`; table label `119:6760`; table `119:6761` (11×9); reading note `153:9165` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=119-6757) |
| Calling-outcome rules table (R-10 → USER) | 06 | `119:6960` | `119:6961/62`; table `119:6963` (7×6) | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=119-6960) |
| Section 07 — Follow-ups, Reminders & Rejection | board | `65:3587` | lease notes `65:3588/89` (orchestrator, not edited) | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=65-3587) |
| WF-FOLLOW-001 | 07 | `125:7403` | `125:7404/05` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=125-7403) |
| WF-NOTIFY-001 Part 1 | 07 | `130:7991` | `130:7992/93` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=130-7991) |
| WF-NOTIFY-001 Part 2 | 07 | `137:8370` | `137:8371/72` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=137-8370) |
| WF-REJECT-001 | 07 | `140:8481` | `140:8482/83` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=140-8481) |
| SM-FOLLOWUP-001 (diagram + table) | 07 | `142:8514` | `142:8515/16`; table label `142:8517`; table `142:8518` (9×9); reading note `153:9166` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=142-8514) |
| SM-REMINDER-001 (diagram + table) | 07 | `145:8742` | `145:8743/44`; table label `145:8745`; table `145:8746` (15×9); reading note `153:9167` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=145-8742) |
| WF-NOTIFY-001 event → recipient → channel table | 07 | `145:9017` | `145:9018/19`; table `145:9020` (11×7) | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=145-9017) |

Final sizes:
- Section 06: 8000 × 15350 (enlarged in height only). It is at 8600, 13272.
- Section 07: 8000 × 11362 (enlarged in height only). It is at 17200, 13272.
- Both stay clear of sections 08–10, which start at y = 33272.

## 2. Procedure followed (SB-2 §8, §9a)

**Skills and tools.** Loaded beforehand:
- Skills: `figma-generate-diagram` (+ `references/flowchart.md` and `references/state.md`), `figma-use`, `figma-use-figjam` (+ `create-section`, `create-table`, `position-figjam-nodes`).
- Tool schemas via ToolSearch.

**Lock cycle (per `generate_diagram` call, 16 calls in total):**
1. `mkdir` of the board lock.
2. Snapshot of the top-level IDs. Every snapshot showed exactly the 13 board sections.
3. `generate_diagram`.
4. Diff to find my new loose nodes.
5. Wrap them in place into a new section, preserving absolute positions (`child = old − section`). Connectors were appended without being repositioned.
6. Add the header.
7. Move the whole section into 06 or 07: rows at x = 120, starting at y = 260, with 120 px gaps.
8. `rmdir` the lock.

**Lock incident.** Once, during the SM-RESERVATION v2 replacement, the lock was released in a parallel call while the replace script failed. Nothing had been changed at that point. I re-acquired the lock about 16 s later, confirmed the state, and completed the step under the lock.

**Tables.** Built with `figma.createTable`: dark header row (#1E1E1E fill, white text), cell text parsed by script from `batch3-spec.md` (§2.3.1, §2.5.1, §3.1–§3.4), with markdown backticks and bold removed. In the outcome table, "Same" was replaced with "Same outcome" or "Only via reopening (DEC-016)"; the spec was aligned to match.

**Leases.** Only 06, 07 and my own sub-sections were resized. No other board section was moved or resized; this is verified in §3. Lease notes were not edited.

## 3. Structural read-back

**Top level** (`use_figma` read-only listing, after all fixes):
- Exactly 13 board sections.
- No loose nodes.
- No overlaps between top-level sections.
- No overlaps between sibling diagram sections inside 06 or 07.
- Positions and sizes of all other sections match the pre-drawing listing. Section 01 grew in height through Agent 4, not me.

**`get_figjam` on `65:3584` and `65:3587`.** Output was 101,261 and 95,523 characters, saved to files and **parsed in full by script**.

| Diagram | Shapes / connectors read back | Source nodes / edges | Match |
|---|---|---|---|
| WF-CALL-001 P1 | 25 / 30 | 25 / 30 | yes |
| WF-CALL-001 P2 | 21 / 22 | 21 / 22 | yes |
| WF-CALL-002 P1 | 24 / 29 | 24 / 29 | yes |
| WF-CALL-002 P2 | 24 / 29 | 24 / 29 | yes |
| WF-CALL-003 P1 | 19 / 28 | 19 / 28 | yes |
| WF-CALL-003 P2 | 20 / 23 | 20 / 23 | yes |
| WF-FOLLOW-001 | 22 / 26 | 22 / 26 | yes |
| WF-NOTIFY-001 P1 | 21 / 25 | 21 / 25 | yes |
| WF-NOTIFY-001 P2 | 19 / 24 | 19 / 24 | yes |
| WF-REJECT-001 | 21 / 22 | 21 / 22 | yes |
| SM-ASSIGNMENT-001 | 3 / 5 (2 states + start) | 2 states / 5 | yes |
| SM-RESERVATION-001 (first render) | 7 / 8 (4 states + start + end) | 4 / 8 | yes; v3 has 6 shapes / 8 connectors |
| SM-FOLLOWUP-001 | 6 / 7 | 3 / 7 | yes |
| SM-REMINDER-001 | 9 / 16 | 6 / 16 | yes |

Every connector has both `connectorStart` and `connectorEnd`, and both endpoints lie inside the same diagram section. There were 0 unattached connectors.

## 4. Visual inspection

**Method.**
- One `get_screenshot` per diagram section, at 2000–2400 px, with base64.
- For the state-model sections, whose reported bounds were inflated (see R-1), a full-resolution render was downloaded and cropped locally to the content area. That covered SM-ASSIGNMENT, SM-RESERVATION, SM-FOLLOWUP and SM-REMINDER.
- Both standalone tables were screenshotted.
- Re-screenshots after fixes: WF-CALL-001 P1, WF-CALL-003 P2, SM-RESERVATION v3, SM-FOLLOWUP (with note), SM-ASSIGNMENT (with note).

**Seen.**
- All flowcharts render with the SB-2 node colours from `classDef`: yellow for dependency, orange for Alt A/B, red for failure, green for success ends, blue for derived.
- Hand-offs render as double-bordered boxes.
- Every decision edge label is present.
- Header title and meta lines are legible.
- Table text is complete in every cell.

## 5. Defects found and fixed

| # | Where | Defect seen | Fix | Result |
|---|---|---|---|---|
| V-01 | 37 diamonds across all 10 flowcharts | Decision text truncated (e.g. "Owner decision (no automatic reassignme…", "Current outcome Accepted? … (B3-…", "Active contact reservatio…") | Resized about the centre to 250, 300, 360 or 420 px by text length | Re-checked WF-CALL-001 P1 and WF-CALL-003 P2: full text, connectors still attached |
| V-02 | WF-FOLLOW-001 | Top connector (e1 → reminders) ran through the meta line | Header texts moved up (title y = 6, meta y = 58, 18 px); shapes not moved | Meta ends at y = 80, above the connector (y ≥ 88) |
| V-03 | SM-REMINDER-001 | An edge touched the 2-line meta text | Meta font reduced to 18 px | Not re-screenshotted |
| V-04 | Section 06 width | My first table script measured a connector with a phantom 28,648 px width, which widened section 06 to 29,484 px (overlapping 07 and beyond) | Corrected at once to 8000 by measuring non-connector children only; all later scripts exclude connectors | Top-level overlap check clean |

## 6. Escalated after two attempts (SB-2 §8.7) — residual

**R-1. State-diagram rendering.**

*What was seen:*
- The generator does not draw self-transition loops: Assigned → Assigned (reassign), Active → Active (renew / re-entry), Scheduled → Scheduled (reschedule / responsible change), Retry pending → Retry pending.
- Some labels sit over state boxes: "acquire …" over Active; "lease elapsed …" over Expired; two labels near Cancelled; labels over Unassigned.
- The undrawn loop connectors report phantom bounds of about 29,000 px. Section screenshots are therefore mostly empty canvas.

*Attempt 1:*
- Replaced the SM-ASSIGNMENT loop connector by API. Its bounds were still phantom.
- Regenerated SM-RESERVATION as a flowchart and shifted the shapes in the section. This left stale connector routes running about 25,000 px off the diagram (the known Batch 2 lesson).
- That attempt was my own failed attempt and was deleted.

*Attempt 2:*
- Regenerated SM-RESERVATION (v3) as a flowchart, wrapped it in place into sub-section `152:9164`, and moved the whole sub-section.
- Connector geometry is now sane, but the self-loop is still not drawn and the acquire label still overlaps "Active".

*Stopped there.* Mitigation, with no regeneration: a dark-orange "Reading note (render limitation)" text was added beside each of the four state diagrams. It lists the undrawn self-transitions and states that the table below is authoritative. All transitions are in the tables.

*Recommended:* draw the self-loops by hand in FigJam, or accept the notes.

## 7. Residual issues (cosmetic unless stated)

1. R-1 above. This is meaning-relevant, and mitigated by the notes and tables.
2. Edge labels partly overlapping, all still legible:
   - WF-CALL-002 P1: "Not Accepted, or Accepted and policy allows" overlaps the `accChk` diamond edge.
   - WF-NOTIFY-001 P1: "Completed or cancelled" and "Rescheduled or responsible user changed" labels overlap near `cancelOld`. RV3-08 is also in the spec and the SM-REMINDER table.
   - WF-CALL-003 P2: "Developer assigned now" sits between the two hand-off boxes.
3. Generator caveat (as in Batch 2): edges labelled Yes/No are auto-coloured green/red regardless of meaning. Only node fills follow the SB-2 legend.
4. The resized `bizOk` diamond in WF-CALL-001 P1 slightly exceeds its phase sub-section's left edge.
5. The ELK layout produces long return edges, e.g. "Authorized" in WF-CALL-001 P1 and "Granted" in WF-NOTIFY-001 P2. They are readable.
6. Lease notes `65:3586` / `65:3589` (orchestrator) still say "Status: DRAFT, in progress". Left unedited.
7. The SM-ASSIGNMENT-001 old connector `112:6096` was replaced by `115:6386` (same endpoints, label and style) during attempt 1. The phantom-bounds issue persists on it.

## 8. Not inspected

- Not every connector label was viewed at close zoom. Labels were checked in the full-section views at 2000–2400 px.
- V-03 was not re-screenshotted.
- Screenshots are server renders. Nothing was checked in the FigJam client itself.

## 9. Source changes made while drawing

- Recorded in `batch3-mermaid.md` ("Drawing-time source changes"): SM-RESERVATION-001 was drawn from flowchart source v3, with one label shortened.
- Spec §2.3.1: the outcome-table wording "Same" was made explicit, matching the board.
- No semantic content changed.
