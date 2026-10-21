# Phase 3 — Architecture board updates (Task 2)

Figma Operator, 2026-10-20. Board: FigJam `YKQi8IAz6sOGoLqwolHKPk`.
Status: Phase 3 is still "submitted for user review, NOT approved". Only labels, layout and diagrams changed. No policy was selected.
**No quota or rate-limit error occurred.**

Two script errors happened along the way:
- One batch of 4 scripts failed on its return statement (a `.text` read on a SECTION node). The plugin rolled the whole batch back, which a read-back confirmed, and the batch was re-run successfully.
- A cloned connector, and connectors moved into a new parent, kept stale routing that ran thousands of pixels off-section. They were recreated as fresh connectors (see below).

## 1. architecture-a.md §14 (A-2), all items applied

### Section 03 `1:11`
- **D03a:**
  - Text edits on `11:1274`, `11:1282`, `11:1266`, `11:1216`, `11:1219`, `11:1246` and `11:1270`.
  - Connector `11:1250` was deleted.
  - New connector "initCallingState in creation tx" `101:7544` (MOD-business → MOD-calls).
  - New dashed connector "event call_outcome.changed (outbox, async)" `101:7552` (MOD-calls → MOD-assignment, routed under the boxes).
  - The A-2 note was appended to meta `12:1275`.
- **D03b:** `13:1315`, `13:1287` and `13:1291` changed. The provider-port sentence in meta `14:1332` was replaced. Done as a text edit only: the connector was not re-pointed and no cylinder was added.
- **T03 `33:2792`:**
  - New row 1, MOD-platform (8 cells).
  - Edits to the rows MOD-employees, MOD-access, MOD-admin, MOD-attendance, MOD-business, MOD-duplicates, MOD-assignment, MOD-calls and MOD-reports, matched by the name in column 0.
- Section `1:11` was resized to height 4684.

### Section 07 `1:23`
- **T07a `36:3622`:**
  - J-03, J-09 and J-11 edited.
  - New row J-12 inserted before "Not a job: exports".
- **T07b `36:3833`:** MOD-admin column 1 replaced; MOD-attendance column 1 appended.
- **New T07c** "Canonical outbox-event catalogue": title `88:7228` and table `88:7083`, header plus E-01..E-17 verbatim.
- D07b was not changed, as instructed.

### Section 08 `1:26`
- `24:2164`, `25:2219`+, `28:2304`, section `28:2323` renamed, `28:2314`, `28:2330`, `28:2333`, `29:2381`+.
- T08a `38:4639` cells (3,4) and (4,4); T08b `38:4769` cell (3,2).

### Section 09 `1:29`
- **T09a `39:4847`:** ADR-006, ADR-013, ADR-015 and ADR-017 edited; ADR-019 row appended.
- **T09b `39:5077`:** row 6, columns 1–2.
- **T09c `39:5239`:** RISK-03 edited; RISK-17 and RISK-18 appended.
- **T09d `39:5445`:** row 10 edited; rows 16 and 17 appended.

### Additions in §14.6 (A-3), appended after Task 2 started, all applied
- **T03 `33:2792`:** MOD-notifications row (17), columns 1 and 2 appended.
- **D03a meta `12:1275`:** AR-11 sentence appended.
- **T07a:** J-05 columns 3 and 4; J-01 column 5 appended.
- **D07a meta `21:2066`:** AR-13 sentence appended.
- **T07c:** footnote `103:7544`.
- **New T07d** "Async vs sync UI states (AR-15)": title `103:7545`, table `103:7546` (6 rows from §4.7).
- **New T09e** "Dashboard metric catalogue": title `103:7611`, table `103:7612` (17 rows from §5A).
- **T09b:** row 20 appended (WF-REPORT-001 metrics).

## 2. architecture-b.md §14
- **14.1, all 32 text edits applied:**
  - Section 04: `16:1962` and the `8:112` cells.
  - Section 05: AUTH-2 shape `47:6186`, `47:6189`, and `47:6192` (prefix added).
  - Section 06: the `10:858` cells; SEQ-02 connectors `56:6376` and `56:6384` and annotation `57:6388`; SEQ-09 `77:6854`, `77:6870` and `78:6863`; SEQ-10 `81:6933`; SEQ-11 `83:6999` and `84:6994`.
- **#33 SEQ-03:**
  - Generated v2 `95:7474`, with lifelines widened by k × 220.
  - It replaced the old inner diagram `59:6385` (deleted) inside the existing wrapper `60:6456`.
  - Header `60:6457` and annotation `60:6459` were updated with the §9 bullets.
- **#34 ERD-5:**
  - Generated v2. Its 8 tables (`96:7540`, `96:7565`, `96:7646`, `96:7703`, `96:7776`, `96:7833`, `96:7870`, `96:7935`) were moved into the existing wrapper `42:6048`.
  - The 7 old tables and 8 old connectors were deleted.
  - Per-column de-overlap applied (48 px gap).
  - The 8 connectors were recreated as fresh nodes: `101:7556`, `101:7560`, `101:7564`, `101:7568`, `101:7572`, `101:7576`, `101:7580`, `101:7584`.
  - The old header was kept. Meta `42:6050` was updated with the row-2 text.
- **#35 SEQ-12..15:** generated with `generate_diagram` using the board fileKey. Each landed as its own section, so its absolute layout was preserved and its connectors were never moved individually. Lifelines were widened (4 participants: k × 320; 5: k × 220). No `0:1` self-message connectors were found.

  Each generated section was then placed in a new wrapper inside section 06, with a header, a meta line ("Status: Proposed — Phase 3, not approved | IDs") and the six-bullet annotation:

  | Sequence | Wrapper | Inner diagram | Position in section 06 |
  |---|---|---|---|
  | SEQ-12 | `98:8015` | `90:7222` | (120, 11400) |
  | SEQ-13 | `98:8019` | `92:7289` | (2590, 11400) |
  | SEQ-14 | `98:8023` | `93:7360` | (5250, 11400) |
  | SEQ-15 | `98:8027` | `94:7425` | (120, 13636) |

  The rows follow the existing 3-column grid below the matrix.
- **#36:** SEQ-11 `84:6991` was screenshotted. It is readable, with no hidden arrows.
- **#38:** No `get_figjam` read-back was made, to save quota. The `use_figma` read-backs (bounds, overlap check, no loose top-level nodes) and screenshots stand in for it.

## 3. Section resize and re-flow
Sections 04, 05 and 06 were fitted to their content plus 120 px. No section moved: the two rows do not overlap (overlap check = 0), and no loose nodes remain on the page.

| Section | Bounds (x, y, w × h) |
|---|---|
| 00 `1:2` | 0, 0, 8000 × 3000 |
| 01 `1:5` | 8600, 0, 8000 × 3000 |
| 02 `1:8` | 17200, 0, 8000 × 4497 |
| 03 `1:11` | 25800, 0, 8000 × 4684 |
| 04 `1:14` | 34400, 0, 10376 × 12256 |
| 05 `1:17` | 0, 16000, 8000 × 7088 |
| 06 `1:20` | 8600, 16000, 8000 × 15312 |
| 07 `1:23` | 17200, 16000, 8000 × 8294 |
| 08 `1:26` | 25800, 16000, 8000 × 7362 |
| 09 `1:29` | 34400, 16000, 8000 × 7503 |

## 4. Section 00 and lease notes
- **Section 00** gained:
  - title `99:7462`
  - status `99:7463` ("Phase 3 — submitted for user review, NOT approved")
  - "Section index" heading `99:7464` and table `99:7465` (00–09, with purpose and owner taken from each lease note)
  - "Legend" heading `99:7532` and table `99:7533` (Proposed / Pending policy / Confirmed)
  - "Open decisions" heading `99:7550` and list `99:7551`, which cites:
    - ADR-001..019
    - RPO/RTO, backup retention, drill frequency and the off-VPS restore environment
    - notification timing
    - R-10, R-11, R-12
    - DEC-001..006, 013, 014/023, 017, 026
    - F2, C-01, D4, B3-Q05, B3-Q08
    - retention windows / OQ-19, the E-12 placeholder names, hosting providers, OQ-12
- **Lease notes 01–09** now end with "Status: Phase 3 — submitted for review, not approved.": `1:7`, `1:10`, `1:13`, `1:16`, `1:19`, `1:22`, `1:25`, `1:28`, `1:31`. The section 00 lease note `1:4` was left unchanged.

## 5. Wireframe file cover (`GNrhb3DWa6mIhEX6F4Nmvw`, page `0:1`, frame `1:11`)
- The status in `1:13` now reads "Status: Phase 4 — submitted for user review, NOT approved."
- New: screen-index heading `34:2`, a per-page index `34:3` (10: 10 · 11: 12 · 12: 10 · 13: 8 · 14: 8 · 15: 6, with SCR ranges), and a status line `34:4`.

## 6. Checkpoints (inline screenshots)
- Section 00 and section 06, whole.
- SEQ-11 `84:6991` and SEQ-13 `98:8019`.
- ERD-5 `42:6048`, before and after the connector fix.
- D03a `12:1273`, three times while fixing connector routing.
- T03 `33:2792`, T07c `88:7083`, T07d `103:7546` and T09e `103:7612`.
- Sections 08 and 09, whole.
- The cover frame `1:11`.

Not screenshotted on their own: SEQ-12, SEQ-14, SEQ-15 and SEQ-03 v2. They appear in the section 06 overview screenshot. Sections 04 (apart from ERD-5) and 05 (text edits only) were not screenshotted.

## 7. Not applied or deviations
- D03b `13:1315`: the label was changed, but the optional re-point and the "Access-facts view" cylinder were not added.
- No `get_figjam` read-back (#38), replaced as described in §2.
- The pre-existing small label overlap near MOD-business/MOD-duplicates in D03a was left as it was.
