# Phase 5 — S2 Owner Dashboard: high-fidelity sample spec

Owner Screen Agent, version P5-OWN-1, 2026-10-20. Status: **proposed, for the visual approval sample**. Nothing here is a decision.

| Item | Value |
|---|---|
| Screen | SCR-OWN-001 Owner dashboard (UC-REP-001/002, WF-REPORT-001) |
| Low-fi source | page 11 `1:6`, desktop `24:5`, states `24:263` Loading · `24:272` No data · `24:282` Partial data · `24:300` G1 distinctions. Workload tile `24:217` and annotation `24:259` follow RW-03 (`wireframe-fixes.md`) |
| Target | file `GNrhb3DWa6mIhEX6F4Nmvw`, page `30 HiFi — Visual Sample` `36:4`, section **`S2 Owner Dashboard`** |
| Frames | 2 frames, 1440×900 each: Light and Dark. Same content; only the variable mode differs |
| Metric definitions | `architecture-a.md` §5A (AR-16). Snapshot = current state. Period = events in the selected range, company time |
| Rules | Brief §2 (no Figma calls, scripts only), §3 (DS instances only), §5 (fictional content), §6 (policy labels) |

DS component and variable names below are **provisional** and marked `‹DS: …›`. `design-system.md` does not exist yet. In STEP 2 each name is mapped to the ID the Design-System Agent returns. If a name differs, the DS name wins and this spec is not reopened.

---

## 1. Frames and section

| Node | Name | Position in section | Size | Variable mode |
|---|---|---|---|---|
| Section | `S2 Owner Dashboard` | page origin chosen by orchestrator (default x 0, y 1200 below S1) | 3040×1060 | — |
| Frame A | `S2 — SCR-OWN-001 Owner dashboard — Desktop 1440 — Light` | x 80, y 80 | 1440×900, clips content | collection `‹DS: Theme›` → mode **Light** (set explicitly) |
| Frame B | `S2 — SCR-OWN-001 Owner dashboard — Desktop 1440 — Dark` | x 1600, y 80 | 1440×900, clips content | same collection → mode **Dark** (set explicitly) |
| Caption | `S2 caption` (text, above each frame, y 40) | — | — | "Light · 1440×900" / "Dark · 1440×900" |

The frame background binds to `color/bg/canvas`. No hard-coded colours anywhere; every fill, stroke and text colour is bound to a variable so mode switching is the only difference between A and B.

## 2. Layout grid

- Shell: left nav 240 wide (x 0–240), top bar 64 high (x 240–1440).
- Content area: x 240, y 64, 1200×836, padding 24 → usable 1152×788 (x 264–1416, y 88–876).
- 12-column grid inside content: column 74, gutter 24.
- Vertical rhythm: 8 px base. Gaps between rows and cards: 16.
- Everything fits in 900 px; no scroll shown. (Production may scroll; the sample is a fixed viewport.)

| Row | y (frame) | Height | Contents (columns) |
|---|---|---|---|
| R0 Shell | 0 | 900 | Side nav + top bar |
| R1 Header & filters | 88 | 40 | Title (cols 1–3) · filter bar (cols 4–12) |
| R2 KPI strip | 144 | 104 | 6 KPI tiles, 2 columns each (172 wide) |
| R3 | 264 | 300 | Attendance today (cols 1–4) · Calling activity bar chart (cols 5–8) · Exceptions panel (cols 9–12) |
| R4 | 580 | 284 | Businesses snapshot (cols 1–4) · Pipeline events line chart (cols 5–8) · Targets + Development workload stacked (cols 9–12) |

Each card in R3/R4 is 376 wide (4 columns), radius `radius/lg`, padding 16, fill `color/bg/surface`, 1 px stroke `color/border/subtle`, shadow `elevation/1` (or none if the DS chooses flat cards).

## 3. R0 — Shell

Instance `‹DS: Shell/Desktop/Owner›` at (0,0), 1440×900, or composed from `‹DS: Nav/Side›` + `‹DS: TopBar›` if no shell component exists.

**Side nav** (fill `color/nav/bg`, the deep-navy surface in both modes):
- Top: `‹DS: Brand/Logo (placeholder — awaiting supplied file)›` 176×40, then the word "Management System" is **not** added; the placeholder alone.
- Sections and items, in this order (sitemap §3.1): OVERVIEW — **Dashboard** (active) · Attendance; PEOPLE — Employees · Targets & Work Lists; BUSINESSES — Businesses · Correction Requests · Categories; CALLING — Calling Assignments · Follow-ups & Calendar; DELIVERY — Deals & Meetings · Projects; ADMIN — Reports & Exports · Audit Log · Delivery Monitor · Settings; bottom — My Day (check in) · My Profile.
- Item: `‹DS: Nav/Item›` State=Default; "Dashboard" State=Active (teal indicator bar + `color/nav/item-active-bg`).
- "Delivery Monitor" carries a count badge `‹DS: Badge/Count›` "4" (matches the exceptions panel).

**Top bar** (fill `color/bg/surface`, bottom stroke `color/border/subtle`):
- Left: breadcrumb text "Overview / Dashboard" (`text/body-sm`, `color/text/secondary`).
- Right, in order: attendance chip `‹DS: Chip/Attendance›` State=Checked in, label "Checked in · 08:52"; notification button `‹DS: IconButton›` bell with `‹DS: Badge/Count›` "2"; user menu `‹DS: Avatar›` initials "RH" + "Rana Haddad" / "Owner" + chevron.

## 4. R1 — Header and filters

- Title "Dashboard" (`text/heading-lg`, `color/text/primary`). Under it, a 1-line meta text: "Company time · updated 11:20, Tue 20 Oct 2026" (`text/caption`, `color/text/muted`). (Height budget 40: title 28 + meta 12 overlapping into gap is acceptable; or put meta inline to the right of the title.)
- Filter bar, right-aligned, Auto Layout horizontal, gap 8, height 36:
  1. `‹DS: SegmentedControl›` options "Today" · **"7 days"** (selected) · "30 days" · "Custom".
  2. `‹DS: Input/DateRange›` value "14 Oct – 20 Oct 2026", calendar icon.
  3. `‹DS: Toggle›` ON + label "Compare with 7–13 Oct".
  4. `‹DS: Select›` "All roles".
  5. `‹DS: Select›` "All employees".
  6. `‹DS: Button›` Variant=Secondary, Size=Medium, icon download, label "Export…" (routes to SCR-OWN-009; export is synchronous and streamed, ADR-010).

Intended interactions (annotated only, no prototype): changing period or compare updates every **period** metric; snapshot metrics ignore the period and say so.

## 5. R2 — KPI strip (period and G1 separation)

Six `‹DS: Stat/Tile›` instances, 172×104, gap 24. Each tile: label (`text/label`, `color/text/secondary`), value (`text/display-sm`, `color/text/primary`), comparison line (`text/caption`), and an optional scope tag.

Comparison line format: arrow glyph + absolute difference + "vs N". Deltas use **neutral** `color/text/secondary` with an arrow (▲/▼/–), never red/green, because "up" is not always good and colour must not be the only signal.

| # | Label | Value | Comparison line | Scope tag | Source (§5A) |
|---|---|---|---|---|---|
| 1 | Call attempts | **184** | "▲ 23 vs 161" | "Period" | count of `call_attempt.logged` |
| 2 | Businesses contacted | **97** | "▲ 7 vs 90" | "Period · distinct" | distinct businesses with ≥1 attempt |
| 3 | Accepted opportunities | **3** | "Snapshot — comparison not available" | "Snapshot" + `‹DS: Tag/Policy›` "B-1" | deals currently in stage Accepted opportunity |
| 4 | Accepted in period | **2** | "– 0 vs 2" | "Period" | `accepted_opportunity.created`, counted once |
| 5 | Closed deals in period | **1** | "▼ 1 vs 2" | "Period" | `deal.closed` |
| 6 | Projects completed in period | **1** | "– 0 vs 1" | "Period" + `‹DS: Tag/Policy›` "DEC-019" | `project.status_changed` → Completed |

Tiles 1–2 sit together with a shared micro-caption under the strip's left pair: "Attempts ≠ businesses contacted". Tiles 3–6 carry the micro-caption "Accepted ≠ closed ≠ completed project (G1)". Captions are `text/caption`, `color/text/muted`, placed in the 16 px gap below the strip (they may overlap the gap; keep 4 px clearance from R3).

Tile 3 tooltip (annotated): "Deals currently in stage 'Accepted opportunity'. Excludes Signed, Paid, Closed deal and Not proceeding. Not a calling-outcome count. Definition B-1 — pending confirmation." The B-1 tag opens `‹DS: Notice/Policy pending›` in the tooltip.

Stock comparison note (OQ-17): snapshot tiles show "Snapshot — comparison not available" (needs J-08 daily snapshots, Proposed).

## 6. R3 — Attendance, calling chart, exceptions

### 6.1 Card "Attendance today" (cols 1–4, 376×300)

Header: title "Attendance today" (`text/heading-sm`) + right meta "Tue 20 Oct · 11:20" + link `‹DS: Button›` Variant=Link "Open attendance ›" (→ SCR-OWN-004).

Three stat segments in a row (Auto Layout, equal width, separated by `‹DS: Divider/Vertical›`):

| Segment | Value | Sub-label | Visual |
|---|---|---|---|
| Checked in | **4** of 6 | "Open session now" | `‹DS: Badge/Status›` Tone=Success dot |
| Not checked in yet | **2** | "≠ absent" (bold, `color/text/secondary`) | Tone=Neutral dot |
| Missing checkout | **1** | "From Mon 19 Oct" | Tone=Warning dot |

Below: people list (`‹DS: List/Row›` compact, 28 px each, avatar initials + name + right-side status):
- Rana Haddad — "In · 08:52"
- Karim Saleh — "In · 08:58"
- Maya Khoury — "In · 09:01"
- Lina Aoun — "In · 09:14"
- Omar Nassar — "Not checked in yet" (neutral badge)
- Sami Fares — "Not checked in yet" (neutral badge)

Footer rows (`text/body-sm`), each value replaced by a pending state, **never zero** (WF-REPORT-001 D2):
- "Absent on a scheduled day: **Not configured — policy pending**" + `‹DS: Tag/Policy›` "DEC-007 · DEC-022".
- "Late arrivals: **Not configured — policy pending**" + tag "DEC-008".
- "Checked out today: 0".

Card note (caption): "Not checked in yet means no session right now. Absence needs a configured schedule."

### 6.2 Card "Calling activity" — grouped bar chart (cols 5–8, 376×300)

Header: "Calling activity" + meta "14–20 Oct · by day". Legend `‹DS: Chart/Legend›`: ■ "Call attempts" (`color/chart/series-1`, navy in light / light navy-blue in dark) · ■ "Businesses contacted (distinct per day)" (`color/chart/series-2`, teal).

Chart `‹DS: Chart/Bar›` Grouped, plot area ≈ 344×190, y-axis 0–60 step 20 with gridlines `color/chart/grid`, x-axis day labels.

| Day | Wed 14 | Thu 15 | Fri 16 | Sat 17 | Sun 18 | Mon 19 | Tue 20* |
|---|---|---|---|---|---|---|---|
| Call attempts | 31 | 34 | 29 | 12 | 0 | 56 | 22 |
| Businesses contacted (per day) | 19 | 20 | 16 | 7 | 0 | 30 | 13 |

Totals: attempts 184 (matches tile 1). *Tue 20 is partial (to 11:20): x-label "Tue 20 (so far)", bars use 50 % opacity of the same series token or a hatched style if the DS provides one.

Footer caption: "Daily distinct counts add up to 105; the period distinct count is 97 because some businesses were called on more than one day." By agent (small two-column text under caption): "Maya Khoury 102 attempts · 53 businesses" / "Omar Nassar 82 attempts · 44 businesses".

No rest-day shading (DEC-022 pending); Sunday simply shows 0 recorded events.

### 6.3 Card "Exceptions" (cols 9–12, 376×300)

Header: "Exceptions" + `‹DS: Badge/Count›` "4" + link "Delivery monitor ›" (→ SCR-OWN-012).

Rows `‹DS: List/Row›` with leading status icon, two text lines, trailing action. Order by severity then time:

| # | Icon / tone | Line 1 | Line 2 (`color/text/secondary`) | Action |
|---|---|---|---|---|
| 1 | Warning | Missing checkout — Omar Nassar | "Mon 19 Oct · in 09:04 · no checkout" + `‹DS: Tag/Policy›` "DEC-026" | `‹DS: Button›` Tertiary Small "Review ›" (→ OWN-004 exception detail) |
| 2 | Danger | Reminder failed — Meeting · Peak Fitness Gym | "To Lina Aoun · 20 Oct 08:30" | Secondary Small "**Send again**" with helper text below "Creates a new reminder" |
| 3 | Warning | Reminder suppressed — Meeting · Nova Dental Clinic | "To Sami Fares · 19 Oct 17:00 · access re-check failed" | Secondary Small "**Send again**" + "Creates a new reminder" |
| 4 | Danger | Notification failed — Assignment changed | "To Omar Nassar · 19 Oct 16:10" | Tertiary Small "View ›" (no Send again — AR-13 covers reminders only) |

Panel footer caption + tag: "AR-13: Send again creates a new reminder; the failed one stays failed." Security emails are excluded from this list (§5A).

## 7. R4 — Businesses, pipeline chart, targets and workload

### 7.1 Card "Businesses" (cols 1–4, 376×284)

Header: "Businesses" + meta "Snapshot unless marked" + link "Open businesses ›".

Two-column key/value list (`‹DS: List/KeyValue›` or `List/Row` dense, 28 px rows):

| Label | Value | Note |
|---|---|---|
| Total businesses | 248 | tag "C-01" (archived excluded? pending) |
| Added in period | 37 | "▲ 8 vs 29" · "Period" |
| Unassigned | 18 | "Kept apart from Pending" |
| Pending | 96 | |
| On hold | 14 | |
| Callback requests | 11 | tag "B3-Q11" (definition pending) |
| Rejected | 42 | |
| Needing corrections | 5 | "Distinct businesses with open requests" |

Optional mini horizontal bars (`‹DS: ProgressBar›` Size=XS, `color/chart/series-1`) behind values for Pending/On hold/Callback/Rejected, relative to 248. Omit if the DS has no XS bar.

### 7.2 Card "Pipeline events" — line chart (cols 5–8, 376×284)

Header: "Pipeline events · October" + meta "Cumulative, 1–20 Oct". Legend: "Accepted" (`color/chart/series-2` teal, solid) · "Closed deal" (`color/chart/series-1` navy, solid) · "Project completed" (`color/chart/series-3`, dashed). Different line styles plus end labels, so colour is not the only signal.

`‹DS: Chart/Line›` step-style cumulative lines, plot ≈ 344×180, x-axis ticks 1, 5, 10, 15, 20 Oct, y-axis 0–6 step 2. Shaded band `color/chart/highlight` over 14–20 Oct labelled "Selected period"; lighter band 7–13 Oct labelled "Comparison".

| Series | Event dates (cumulative value after the date) | End value |
|---|---|---|
| Accepted | 2 Oct → 1 · 6 Oct → 2 · 9 Oct → 3 · 13 Oct → 4 · 15 Oct → 5 · 19 Oct → 6 | 6 |
| Closed deal | 7 Oct → 1 · 12 Oct → 2 · 16 Oct → 3 | 3 |
| Project completed | 8 Oct → 1 · 16 Oct → 2 | 2 |

Consistency check: in 14–20 Oct, Accepted 2, Closed 1, Completed 1 (tiles 4–6); in 7–13 Oct, 2 / 2 / 1.

Footer: "Accepted ≠ closed ≠ completed project." and "Revenue not shown until financial fields are approved" + tag "DEC-018".

### 7.3 Card "Targets" (cols 9–12, 376×160)

Header: "Targets · today" + link "Targets & work lists ›" (→ OWN-006). Directly under the header, `‹DS: Notice/Policy pending›` compact: "**DEC-020 pending** — which actions count toward each target metric. **DEC-025 pending** — frequency (daily shown)."

Rows (`‹DS: ProgressBar›` with label left, value right):

| Employee | Assigned target (as entered by Owner) | Counted so far | Bar |
|---|---|---|---|
| Karim Saleh | Businesses added · 10 | 6 | 60 % |
| Maya Khoury | Call attempts · 40 | 22 | 55 % |
| Omar Nassar | Call attempts · 40 | 0 | 0 % + text "Not checked in yet" |

Caption: "Counted by each action's own timestamp (A2). No overall completion % until DEC-020." No company-wide completion figure is shown.

### 7.4 Card "Development workload" (cols 9–12, 376×108, 16 below Targets)

Header: "Development workload" + `‹DS: Tag/Policy›` "SB-3 · Proposed" + link "Projects ›".

Three sub-counts, never summed into one number:

| | Deals | Projects | Tasks |
|---|---|---|---|
| All Developers | **3** | **5** | **12** |
| Lina Aoun | 2 | 4 | 7 |
| Sami Fares | 1 | 1 | 5 |

Compact table `‹DS: Table/Compact›` (or three `Stat/Inline` for the total row plus two text rows). Column help (tooltip annotation): Deals = non-terminal deal records assigned; Projects = Scheduled, In progress, Waiting for client or Blocked; Tasks = open tasks assigned. Assignment events are history only.

Data behind the counts (for consistency with S3/S5, not displayed): Lina — deals Peak Fitness Gym — Member app, Lumen Yoga Studio; projects Glow Beauty Salon — Booking website (In progress), Cedar Home Realty (Waiting for client), Bloom Florist (Scheduled), Olive & Thyme Café (In progress). Sami — deal Nova Dental Clinic; project Harbor Auto Care (Blocked). Delivered (not counted): Urban Cuts Barbershop. Completed: Sunrise Bakery (16 Oct). Closed deals snapshot = 7.

## 8. Policy labels on this screen

| Label | Where | Component |
|---|---|---|
| DEC-020 target metrics (+ DEC-025 frequency) | Targets card | `Notice/Policy pending` (compact) |
| B-1 Accepted-opportunities snapshot definition | KPI tile 3 | `Tag/Policy` + tooltip `Notice/Policy pending` |
| SB-3 Development workload = three sub-counts (Proposed) | Workload card | `Tag/Policy` |
| DEC-007 · DEC-022 (absence), DEC-008 (late) | Attendance footer | `Tag/Policy`, value "Not configured — policy pending" |
| DEC-026 failed checkout | Exceptions row 1 | `Tag/Policy` |
| AR-13 Send again | Exceptions footer | caption + `Tag/Policy` |
| DEC-019 project statuses (Proposed) | KPI tile 6 | `Tag/Policy` |
| DEC-018 revenue not shown | Pipeline card footer | `Tag/Policy` |
| C-01, B3-Q11 | Businesses card | `Tag/Policy` |

Tags read as quiet labels (`color/policy/bg`, `color/policy/text`, small dashed or solid border per DS), visible in both modes. None of them selects an alternative.

## 9. Tokens used (semantic, provisional names)

Colour: `color/bg/canvas`, `color/bg/surface`, `color/bg/surface-raised`, `color/border/subtle`, `color/text/primary`, `color/text/secondary`, `color/text/muted`, `color/text/on-brand`, `color/brand/primary` (navy), `color/brand/accent` (teal), `color/nav/bg`, `color/nav/text`, `color/nav/item-active-bg`, `color/status/{success,warning,danger,info,neutral}/{bg,fg}`, `color/policy/{bg,text,border}`, `color/chart/{series-1,series-2,series-3,grid,axis,highlight}`.
Type: `text/display-sm` (KPI values), `text/heading-lg`, `text/heading-sm`, `text/label`, `text/body`, `text/body-sm`, `text/caption` (Inter Regular/Medium/Semi Bold/Bold).
Space/radius/elevation: `space/4,8,12,16,24`, `radius/sm,md,lg`, `elevation/1`.

Contrast pairs the DS must report (computed, both modes): `text/primary`, `text/secondary`, `text/muted` on `bg/surface`; `nav/text` and active item on `nav/bg`; each `status/*/fg` on its `bg`; `policy/text` on `policy/bg`; `chart/series-1..3` against `bg/surface` (≥ 3:1 for graphical objects).

## 10. States (not drawn in the sample)

The sample draws the default populated state only. Low-fi states remain the reference: Loading `24:263` (skeleton tiles), No data `24:272`, Partial data `24:282` (a tile whose source failed shows "Unavailable — retry", never 0), G1 distinctions `24:300`. Phase 6 draws them in high fidelity.

## 11. Component requests (to the Design-System Agent, via the orchestrator)

Needed for STEP 2; if any already exists under another name, just send the ID.

1. **Shell/Desktop/Owner** (or Nav/Side + Nav/Item Default/Active + TopBar) with Brand/Logo placeholder, nav count badge.
2. **Stat/Tile** with properties: label, value, comparison text, scope tag slot, State=Default/Pending ("Not configured — policy pending")/Unavailable.
3. **Chart/Bar** (grouped, 2 series, 7 categories, partial-bar style) and **Chart/Line** (3 series, solid/dashed, step, highlight band), plus **Chart/Legend** and axis/grid parts. **If the DS will not ship chart components**, please confirm screen scripts may draw chart marks (rectangles/vectors) as plain shapes bound to `color/chart/*` variables inside a DS `Card`.
4. **Tag/Policy** (inline, small) in addition to **Notice/Policy pending** (block, compact size).
5. **List/Row** with leading icon/avatar, two lines, trailing action slot; **List/KeyValue** dense.
6. **ProgressBar** (sizes S and XS), **Table/Compact**, **SegmentedControl**, **Input/DateRange**, **Toggle**, **Select**, **Button** (Primary/Secondary/Tertiary/Link, sizes S/M), **IconButton**, **Badge/Count**, **Badge/Status** (tones incl. Neutral), **Chip/Attendance**, **Avatar** (initials), **Divider** (H/V), **Card** (header slot).
7. Theme variable collection with explicit **Light** and **Dark** modes, and its collection ID for `setExplicitVariableModeForCollection`.

## 12. Build deltas in STEP 2 (script `scripts/owner/01-s2-dashboard.js`, mapped to the built DS)

Where the script differs from §2–§7, the script wins:
- **Grid:** 4 columns = 368 (DS figure; the 376 in §2 was a miscalculation). Rows: R1 48, R2 158, R3 271, R4 271, gaps 12, padding 24.
- **KPI strip:** five `Card/Metric` tiles (FILL): Call attempts 184 (Up) · Businesses contacted 97 (Up) · Accepted opportunities 3 (Pending, chip B-1) · Closed deals in period 1 (Down) · Development workload 3 · 5 · 12 (Pending, chip SB-3). The DS trend icons and colours apply (Up = success, Down = danger). "Accepted in period 2" and "Projects completed 1" move to the Pipeline card summary line. Per-developer workload (Lina 2·4·7, Sami 1·1·5) goes in annotation N4.
- **Cards:** `Card/Section` (368×271, padding 16, gap 12, native Content slot) for Attendance, Calling, Exceptions, Businesses, Pipeline and Targets. The separate Development workload card was dropped; workload is a KPI tile.
- **Calling chart:** Figma does not allow moving children of an instance, so the grouped bars are drawn as marks bound to `chart/series-1/2` and `chart/grid`, with `Chart/Legend` instances. Plot is 336 wide, x labels 14–20, y axis 0–60, no target line; Tue 20 is drawn at 50 % opacity. Series 1 (teal) = attempts, series 2 (navy) = businesses contacted per day.
- **Pipeline chart:** `Chart/Line` has only two series, so the three step series (series-1/2/3, Completed dashed) and the selected-period band are drawn as marks bound to `chart/*` / `brand/accent-subtle`, with `Chart/Legend` instances.
- **Filters:** `Tabs` Segmented (Today · 7 days · 30 days; Custom hidden; the date field covers custom ranges), `Input/Date`, `Checkbox` "Compare 7–13 Oct" (the DS has no Toggle), two `Select`s, and a `Button` Secondary "Export".
- **Policy labels:** `Notice/Policy pending` Chip throughout. The chip's "Policy pending" title is hidden only where the adjacent text already says "policy pending", or in tight cells (C-01, B3-Q11).
- **Annotations N1–N6** (`Annotation`) sit under the frames and cover both themes.

### 12.1 Repair round 2 (2026-10-21)
- **KPI text:** DS fix 12 unlinked Card/Metric Value/Caption (Pending) and Delta (Down), so the script now also sets those TEXT layers directly by name (fonts loaded first): Accepted opportunities "3" / "Snapshot · current stage", Development workload "3 · 5 · 12" / "Deals · Projects · Tasks", Closed deals "−1 vs 2 (7–13 Oct)".
- **Wrapping rows:** every chip and legend row is fill-width with `layoutWrap = WRAP` (row gap 4) instead of clipping. Exceptions: DEC-026 is an ID-only chip (tight cell). Pipeline: legend reads "Project completed" (the dashed line carries the style); the plot height shrinks by any wrapped extra height so the card never overflows.
- **Attendance stats:** fill-width row, SPACE_BETWEEN, so "Missing checkout" is never truncated.
- **Targets:** labels drawn as a fill-width row (label grows and truncates, value hugs) above a `Progress/Bar` with labels hidden, so "6 / 10" is never clipped.
- **Header:** Employee select widened to 160 so "All employees" is not truncated.
- The script warns `Card <key>: body overflows by Npx` if any card body still exceeds its card.

### 12.2 Final pass (2026-10-21, review MF-01, MF-02, MF-03)
- **MF-01 Export:** header gap 16 → 12; Date range 172 → 164, Role 116 → 108, Employee 144 (from 160). Each field still fits its value. Export (icon + label, hugging) now ends inside the 24 px right padding. The script warns `<theme>: Export passes the header edge by Npx` if it does not.
- **MF-02 Exceptions and Targets:** the Card/Section slot clips a few px inside 336, so every card body, plot and caption is built at **CW = 324** (12 px spare). The "Send again" buttons hug their label; the text column grows and truncates instead. Targets: the label grows and truncates, the value ("6 / 10", "0 / 40 (not in yet)") hugs, and the footnote is fill-width and wraps.
- **Progress bars:** no size is set on instance children. Each bar is drawn CW wide from the DS `Progress/Bar` Track and Fill paints, copied with their variable bindings, so Light and Dark both follow the tokens.
- **MF-03 Pipeline chart:** the plot is inset 16 px on the right (PW = CW − 36). "20 Oct" is end-aligned to the plot frame edge, and "1 Oct" is start-aligned to the axis. The calling chart uses PW = CW − 44.
- **Self-check:** after each card is filled, the script warns `Card <key>: "<layer>" passes the right padding by Npx` for any text, instance or mark that crosses the inner padding edge.
