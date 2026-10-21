# S5 Developer Board — High-Fidelity Sample Spec

Owner: Developer Screen Agent. Version P5-DEV-2, 2026-10-21. **Built by `scripts/developer/01-s5-board.js`; where the build differs from §3–4 below (layout fit to 1440×900 with real DS sizes), see §9.** Status: **proposed sample, for user approval.**
Target: file `GNrhb3DWa6mIhEX6F4Nmvw`, page `30 HiFi — Visual Sample` (`36:4`), section **`S5 Developer Board`**. The agent writes scripts only; the orchestrator runs them (brief §2).

## 0. Sources and baseline

| Source | Used for |
|---|---|
| SCR-DEV-006 Project board, low-fi `24:2807` (section `24:2803`) | Base layout: project-status bar with allowed next statuses, task kanban whose columns are task statuses, deal context |
| SCR-DEV-006 `24:3011` / `24:3200` | Open-task warning on Delivered/Completed (annotated only here); Completed = read-only (annotated only) |
| SCR-DEV-007 Task drawer, low-fi `25:9797` (and `25:10389` success) | Drawer preview fields; "project status unchanged" rule |
| SCR-DEV-002 `19:2012` | Four separate deal fact cards (accepted / signature / payment / closure) |
| SCR-DEV-008 `25:12443` + fix (wireframe-fixes.md) | F2 Auto vs Manual provisioning wording |
| SCR-DEV-005 `23:6988` + RW-03 fix | Breadcrumb parent; workload is not on this screen |
| WF-PROJ-001, SM-PROJECT-001, SM-TASK-001 (`docs/phase2/batch4/batch4-spec.md`) | Statuses, transitions, guards, audit events |

**Conventions carried over from low-fi:** solid/outline badge = stored state; **dashed badge = derived condition, never a state** (e.g. "Task overdue", "Delivery overdue", "Client dependency" chip on a task). Every unresolved policy is shown with `Notice/Policy pending`.

**Five dimensions never merged on this screen:** commercial stage (Closed deal), project status (In progress), task status (per card), client dependency (note/flag), meeting status (not shown). **Closed ≠ Completed (G1).**

## 1. Frames in the section

| # | Frame name | Size | Purpose |
|---|---|---|---|
| A | `S5 / Developer Board — Desktop — Light` | 1440×900 | Full board, no overlay. Primary approval frame. |
| B | `S5 / Developer Board — Desktop — Light — Task drawer` | 1440×900 | Same board under a scrim with the task drawer open on "Content upload". |

Section layout: frames side by side, A at (0, 120), B at (1520, 120) inside the section; section header text at (0, 0): H1 "S5 Developer Board" + one line "SCR-DEV-006 Project board + SCR-DEV-007 Task drawer · WF-PROJ-001 · SM-PROJECT-001 · SM-TASK-001 · Light, 1440×900". Section padding 80.

Theme: light mode only (variable mode "Light"). All fills/strokes/text bound to DS variables.

## 2. Viewer and fictional data (brief §5)

- **Signed-in user:** Sami Fares (Developer). Avatar initials "SF".
- **Today:** Tue 20 Oct 2026.
- **Project:** "Glow Beauty Salon — Booking website". Project ID `PRJ-0014`. Business: Glow Beauty Salon (Downtown branch), Salon. Website target: `glowbeauty.example.com`. Handle `@glowbeauty.demo`. Phone `+000 70 000 101`.
- **Assigned developer:** Sami Fares ("Assigned to me" derived chip).
- **Deal:** `DL-0031` "Glow Beauty Salon — Booking website", stage **Closed deal**.

| Deal fact | Value |
|---|---|
| Accepted opportunity | 2 Oct 2026 · handed off by Maya Khoury |
| Signature recorded | 9 Oct 2026 · ref AGR-0109 · by Sami Fares |
| Payment recorded | 12 Oct 2026 · ref PAY-0112 · by Sami Fares |
| Closure finalized | 13 Oct 2026, 16:40 · by Sami Fares |
| Project provisioned | 13 Oct 2026, 16:41 · created in Scheduled |

- **Schedule:** Start 14 Oct 2026 · Target delivery 20 Nov 2026.
- **Milestones:** Wireframes approved (17 Oct, achieved) · Content received from client (28 Oct, due) · Booking flow ready (3 Nov) · Delivery (20 Nov).
- **Project status:** In progress (since 15 Oct 2026, by Sami Fares).

## 3. Frame A — layout (desktop 1440×900)

Grid: Shell sidebar 240 wide (x 0); top bar 64 high (x 240); content frame at (240, 64), 1200×836, padding 24 all sides, vertical Auto Layout, gap 16. Inner width 1152.

```
┌ Sidebar 240 ┬ TopBar ──────────────────────────────────────────────────────────────┐
│ Logo ph.    │ Breadcrumb / search / bell / avatar                                   │
│ Nav         ├────────────────────────────────────────────────────────────────────────┤
│  My Day     │ R1 Page header: title, meta chips, actions                (h ≈ 72)     │
│  Deals      │ R2 Project status bar: current status + allowed next      (h ≈ 56)     │
│  Meetings   │ R3 Schedule & milestones strip                            (h ≈ 76)     │
│ >Projects   │ R4 Main split ─────────────────────────────┬ R5 Right rail 360 ───────│
│             │   Kanban: To do | In progress | Done |      │ Deal context card        │
│             │   Cancelled  (4 columns, 184 each)          │ Client dependencies/notes│
│             │                                             │ Activity timeline        │
└─────────────┴─────────────────────────────────────────────┴──────────────────────────┘
```

R4 = horizontal Auto Layout, gap 16: Kanban area 776 wide (fill) + right rail 360 fixed. Height fills remaining (≈ 568). Columns and rail cards clip and scroll internally (annotate "scrolls" on overflow; no content may be cut mid-text in the sample — sizes below are chosen to fit).

### 3.1 Shell (instance)

- `Shell/Desktop` (Developer role variant) — sidebar on surface navy.
  - Top: `Brand/Logo (placeholder — awaiting supplied file)`; never draw a logo.
  - Nav groups (`Nav/Item`): **MY WORK** — My Day. **DELIVERY** — Deals, Meetings & Calendar, **Projects (active)**. Footer: Help, Settings.
- `TopBar`: left `Breadcrumb` "Projects / Glow Beauty Salon — Booking website"; right: `Input/Search` placeholder "Search projects, tasks…", `IconButton/Notifications` (no count badge), `Avatar` "SF" + "Sami Fares · Developer".

### 3.2 R1 — Page header (`PageHeader`)

- Row 1 (left): H1 **"Glow Beauty Salon — Booking website"** (Heading/H1, Semi Bold 24). Right: actions — `Button/Secondary` "Edit schedule", `Button/Primary` "+ Add task", `IconButton/More` (menu annotated: "Copy link · View audit history · Assign developer (Owner only)").
- Row 2 meta (horizontal, gap 12, Body/Small, text secondary):
  - `Badge/Status` (stored, teal) **"Project: In progress"**
  - `Badge/Status` (stored, navy outline) **"Deal: Closed deal"**
  - `Chip/Derived` (dashed) "Assigned to me"
  - Text "PRJ-0014 · Glow Beauty Salon (Downtown branch) · Salon"
  - `Avatar/Small` "SF" + "Developer: Sami Fares"
- Under row 2, Caption tertiary: "Closed deal ≠ Completed project. Commercial stage and project status are tracked separately."

### 3.3 R2 — Project status bar (`Card/Toolbar`, height 56, surface subtle, radius md)

The project-status control is visually distinct from task status (it lives here only, never on task cards; uses the larger `SegmentedStatus`/`Select` with "Project status" label).

- Left: Label/Overline "PROJECT STATUS" · `Badge/Status/Large` "In progress" · Caption "since 15 Oct 2026 · Sami Fares".
- Middle: Label "Move to:" + `Button/Tertiary` chips (allowed next, SM-PROJECT-001 from In progress):
  1. "Waiting for client…" (opens note field — client-dependency note required, Proposed)
  2. "Blocked…" (blocker reason required, Proposed)
  3. "Back to Scheduled"
  4. "Record delivered" (`Button/Secondary`, teal outline) — annotation: "Open tasks → warning only, not blocked (Proposed, OQ-10)".
- Not listed: "Completed" (only from Delivered). Caption after chips: "Non-linear: no step requires Waiting for client or Blocked."
- Right: `Notice/Policy pending` (compact) **"DEC-019 · Project statuses proposed"**.

### 3.4 R3 — Schedule & milestones strip (`Card`, height 76)

- Left block (width 240): Label "SCHEDULE"; Body "Start 14 Oct 2026 → Target delivery 20 Nov 2026"; Caption "31 days left" (derived). No "Delivery overdue" chip (not overdue).
- Right: `Timeline/Horizontal` (milestone track) with 4 markers on a line spanning 14 Oct–20 Nov, today marker "Today · 20 Oct":
  - ● filled teal "Wireframes approved · 17 Oct" + check "Achieved"
  - ○ "Content received · 28 Oct" + `Chip/Derived` "Client dependency"
  - ○ "Booking flow ready · 3 Nov"
  - ◇ "Delivery · 20 Nov"
- Caption at far right: "Milestone model: task attribute vs entity — OQ-09 (Phase 3 data choice)". (Plain caption, not a policy notice; not in §6 list.)

### 3.5 R4 — Task kanban (columns = task statuses, SM-TASK-001)

Header row above columns: Label "TASKS" · Caption "4 tasks · 1 done" · right: `Select` "Owner: All" · `Select` "Group: Status" · `Notice/Policy pending` (compact) is **not** used here because task statuses have no DEC ID; instead Caption "Task statuses proposed (no DEC ID). Task status never changes project status."

Four `Kanban/Column` instances, each 184 wide, gap 8; column header = title + count badge.

**Column "To do" (2)**
1. `Card/Task` **"Content upload"**
   - Line: Avatar "SF" Sami Fares · Due 28 Oct 2026
   - `Chip/Derived` (dashed, amber) **"Client dependency"** — tooltip/annotation: "Client content pending; not a status. Task stays To do."
   - Caption: "Client to send logo, price list, 12 photos"
2. `Card/Task` **"Payment page"**
   - Line: Avatar "SF" · Due 7 Nov 2026
   - `Notice/Policy pending` (inline, small) **"DEC-018 pending — payment fields, deposit & evidence"**
   - Caption: "Scope held until financial-field policy is decided"

**Column "In progress" (1)**
3. `Card/Task` **"Booking flow"**
   - Line: Avatar "SF" · Start 19 Oct · Due 3 Nov 2026
   - Caption: "Service list → time slot → confirmation"
   - Small meta: "Linked milestone: Booking flow ready"

**Column "Done" (1)**
4. `Card/Task` (done variant, muted, check icon) **"Wireframes approved"**
   - Line: Avatar "SF" · Done 17 Oct 2026 by Sami Fares
   - Small meta: "Milestone achieved"

**Column "Cancelled" (0)**
- `EmptyState/Inline` "No cancelled tasks" · Caption "Cancelling needs a reason (Proposed)."

Card interaction annotations (no prototype): click card → Frame B drawer; drag between columns = task status change (To do ↔ In progress, → Done, → Cancelled needs reason); "Done → In progress" = reopen (Proposed, blocked when project Completed).

### 3.6 R5 — Right rail (360 wide, vertical, gap 12)

**Card 1 — Deal context** (`Card`, title "Deal context", link `Button/Link` "Open deal DL-0031 →")
- `Badge/Status` "Closed deal" + Caption "Commercial lifecycle ended 13 Oct 2026. Delivery continues here."
- Fact list (`List/KeyValue`, four separate rows, each with check icon — facts, not steps):
  - "Accepted — 2 Oct 2026 · Maya Khoury (handoff)"
  - "Signed — 9 Oct 2026 · AGR-0109"
  - "Paid — 12 Oct 2026 · PAY-0112"
  - "Closed — 13 Oct 2026 · Sami Fares"
- `Notice/Policy pending` (compact) **"DEC-006 / R-12 · Closure authority pending — who may finalize (Developer vs Owner verification) is not decided"**
- Row "Project provisioned — 13 Oct 2026, 16:41" + `Notice/Policy pending` (compact) **"F2 · Provisioning trigger pending (automatic at closure vs manual)"**. Neutral wording: "Created in Scheduled" — do not say "automatically" or "manually".
- Caption: "Signature and payment accepted without attachments while DEC-018 is unresolved." (plain caption; DEC-018 notice already on the task card)

**Card 2 — Client dependencies & notes** (`Card`, title "Client dependencies & notes", action `Button/Link` "+ Add note")
- Item (`ListItem/Note`, amber left accent): `Chip/Derived` "Open" · **"Waiting for content from client"** · Body "Logo (SVG), price list and 12 salon photos needed for Content upload." · Caption "Raised 20 Oct 2026 · Sami Fares · linked task: Content upload" · `Button/Tertiary` "Mark resolved".
- Caption under item: "Project status stays In progress; move to 'Waiting for client' only if the whole project is waiting."
- Item (neutral): **"Kick-off note"** · Body "Client prefers Arabic + English pages; bookings by WhatsApp later (out of scope)." · Caption "15 Oct 2026 · Sami Fares".

**Card 3 — Activity** (`Card`, title "Activity", link "View all"; `Timeline/Vertical` with `Timeline/Item`, newest first)
- "20 Oct · 10:12 — Sami Fares added client dependency on **Content upload**"
- "19 Oct · 09:30 — Sami Fares moved **Booking flow** To do → In progress"
- "17 Oct · 15:05 — Sami Fares completed **Wireframes approved** · milestone achieved"
- "15 Oct · 11:00 — Sami Fares changed project status Scheduled → In progress"
- "14 Oct · 09:15 — Sami Fares set schedule: 14 Oct → 20 Nov 2026"
- "13 Oct · 16:41 — Project provisioned from deal DL-0031 (Scheduled)"
- Caption footer: "Audited events (Proposed names): project.status_changed, project.schedule_changed, task.*"

Height fit: Card 1 ≈ 236, Card 2 ≈ 168, Card 3 ≈ 140 visible (first 3–4 items; rest scroll). Designer may collapse Card 3 to the first 4 items to fit 568.

## 4. Frame B — Task drawer preview

Base: duplicate of Frame A content, with `Overlay/Scrim` over x 240–1440 (sidebar and top bar also dimmed is acceptable; follow DS Drawer pattern). `Drawer` (right, 480 wide, full height 900, x 960).

- **Header:** Overline "TASK · PRJ-0014" · H2 **"Content upload"** · `IconButton/Close`.
- **Status row:** Field label "Task status" · `Select` value **"To do"** (options: To do, In progress, Done, Cancelled). Caption "Task status (proposed, no DEC ID). Changing it does not change project status (In progress)."
- `Chip/Derived` "Client dependency" + caption "Client content pending on this task — not a task status."
- **Fields** (`Field/*`, two-column where noted):
  - Owner: `Select` with avatar "Sami Fares"
  - Start date: `Field/Date` "21 Oct 2026" | Due date: `Field/Date` "28 Oct 2026"
  - Linked milestone: `Select` "Content received · 28 Oct"
  - Description: `Textarea` "Upload logo, price list and 12 photos once received from the client. Optimise images for web."
  - Client dependency: `ListItem/Note` "Waiting for content from client — raised 20 Oct 2026" with "Mark resolved".
- **Mini history** (`Timeline/Vertical`, 2 items): "20 Oct · Sami Fares added client dependency" · "16 Oct · Sami Fares created task".
- **Footer** (sticky, divider top): left `Button/Ghost` "Cancel task…" (annotation: reason required, Proposed); right `Button/Secondary` "Close", `Button/Primary` "Save changes".
- Annotation (outside frame or small caption): "Save conflict → reload/retry; nothing changes (SCR-DEV-007 `25:10190`). Success toast: 'Task saved. Project status unchanged.'"

## 5. Visual tokens (map to DS variables when `design-system.md` lands)

| Use | Intended token (provisional name) |
|---|---|
| Page background | `color/bg/canvas` (near-white cool grey) |
| Cards, columns | `color/bg/surface` (white), border `color/border/subtle`, radius `radius/md` (8), shadow none or `elevation/1` |
| Kanban column bg | `color/bg/subtle` |
| Sidebar | `color/brand/navy` surface, text `color/text/on-brand` |
| Primary button, "In progress" project badge | `color/brand/teal` / `color/action/primary` |
| Stored-status badges | `Badge/Status` variants: neutral, info(navy), success(teal/green for Done), warning |
| Derived chips | `Chip/Derived` dashed border, `color/text/secondary`; amber variant for client dependency |
| Policy notices | `Notice/Policy pending` (DS-owned look) |
| Text | `color/text/primary`, `/secondary`, `/tertiary` |
| Spacing | 4-pt scale; content padding 24, card padding 16, gaps 8/12/16 |
| Type (Inter) | H1 24 Semi Bold; H2 18 Semi Bold; card title 14 Semi Bold; body 14 Regular; small 13; caption 12; overline 11 Medium caps +4% |

Contrast to be computed by the DS agent on actual pairs (brief §4); this spec makes no compliance claim.

## 6. Policy labels on this screen (brief §6 — complete list)

| Label (exact copy for `Notice/Policy pending`) | Where |
|---|---|
| "DEC-019 · Project statuses proposed" | R2 status bar (right) |
| "DEC-018 pending — payment fields, deposit & evidence" | Task card "Payment page" |
| "DEC-006 / R-12 · Closure authority pending — who may finalize (Developer vs Owner verification) is not decided" | Deal context card |
| "F2 · Provisioning trigger pending (automatic at closure vs manual)" | Deal context card, provisioned row |

Plain captions (not notices): task statuses proposed (no DEC ID); OQ-09 milestone model; OQ-10 open-task warning; DEC-018 no-attachment note. No pending policy is resolved or implied by the design (e.g. "Closed by Sami Fares" is a recorded fact, not an endorsement of DEC-006 Alt A).

## 7. Explicitly out of scope / not shown
- Owner-only actions drawn as separate views (assign developer) — menu annotation only.
- Delivered warning dialog, Completed read-only, Hidden-by-policy (DEC-002) and Mobile variants — exist in low-fi; Phase 6.
- Development workload (DEV-005 / SB-3) — not on this screen.
- Revenue/amounts — excluded until DEC-018.

## 8. Component requests (to Design-System Agent via orchestrator)

Needed instances; request any that the DS does not already provide:
1. `Shell/Desktop` with Developer nav variant; `TopBar`; `Breadcrumb`; `Brand/Logo (placeholder — awaiting supplied file)`.
2. `Badge/Status` (stored; sizes S and L; tones neutral/info/success/warning/teal) and **`Chip/Derived`** (dashed; neutral + amber).
3. **`Kanban/Column`** with header (title + count) and a slot/auto-layout body (not fixed 3 cards).
4. **`Card/Task`** with variants: default, done (muted + check); slots for chip/notice; owner avatar + date line.
5. **Project status bar** pattern — can be composed from `Card` + `Badge/Status/Large` + `Button/Tertiary`; request a `Button` size S "chip" style if absent.
6. **`Timeline/Horizontal`** (milestone track: achieved / upcoming / final markers, today marker) and **`Timeline/Vertical` + `Timeline/Item`** (activity).
7. `List/KeyValue` (fact rows with check icon); `ListItem/Note` (accent variants neutral/amber).
8. `Drawer` (right, 480) with header/body/footer slots; `Overlay/Scrim`.
9. Form: `Select` (with avatar option), `Field/Date`, `Textarea`, field label + helper.
10. `Notice/Policy pending` with a **compact single-line** and an **inline small (in-card)** size, text wrapping allowed.
11. `EmptyState/Inline`, `Avatar` (S/M, initials), `IconButton` (close, more, notifications), `Button/Link`, `Input/Search`.

## 9. Build notes (P5-DEV-2, script 01-s5-board.js)

- **Layout as built:** page header full width; below it a split: left column 800 (project status bar → schedule & milestones card → tasks header → 4 kanban columns ≈194 each) and right rail 336 (one `Card/Surface`: Deal context · Client dependencies & notes · Activity, separated by `Divider`). The status bar moved into the left column so the rail gets the full height.
- **Milestones:** `Timeline/Horizontal` is fixed at 1152 wide with built-in sample milestones, so the track is assembled from four `Timeline/Milestone` instances on a token-bound track rectangle with a "Today · 20 Oct" marker (760 wide).
- **Policy labels:** DEC-019 = Notice chip in the status bar; DEC-018 = Notice chip on the "Payment page" card; DEC-006 / R-12 and F2 = Notice Inline in Deal context. Task columns carry no DEC-019 label: task statuses have no DEC ID (SM-TASK-001); DEC-019 is project statuses.
- **Task card sub-line:** the `Card/Task` "Project" text property carries a short task description (the project is implicit on the board).
- **Shell:** `Shell/Desktop` Developer defaults to Lina Aoun; overridden to Sami Fares (SF), Projects nav item Active.
- **Refs shortened:** AGR-0109, PAY-0112.
- **Annotations A1–A5** (`Annotation` Interaction/Note) sit under the frames.

## 10. Final pass (P5-DEV-3, 2026-10-21 — review MF-08 to MF-12)

- **MF-08:** The rule caption "Non-linear · Completed only from Delivered" takes the rest of the "Move project to" row and wraps (2 lines fit the 32 px row). It is never cut.
- **MF-09:** The DS `Kanban/Column` header has an empty "Spacer" auto-layout about 100 px tall. That caused the roughly 60 px gap above "To do". The script hides it with a visibility override and turns the column "+" off ("Add task" in the page header is the single add action). It does not set x/y/size on instance children. **DS follow-up:** fix that Spacer in `Kanban/Column` (it should grow horizontally and hug vertically). Cards hug. The sub-line has a `maxLines = 2` override. If the override is refused, the card uses a shorter one-line copy. The script measures every sub-line and reports it in `OUT.fit`. The policy chip on "Payment page" reads "DEC-018 pending" and is width-checked against the card. Any column whose cards pass its bottom moves the trailing cards into a "+n more" link. A hidden card's DEC chip stays visible under that link. Trailing activity items that would be cut at the bottom of the right rail are dropped ("View all" covers them).
- **MF-10:** The drawer body FILLs the slot's inner width (no fixed 432), and every field FILLs the body, so all fields share one width. The dates sit in a 2-column grid. If a date control would spill (a DS minimum width), the dates stack at full width instead. Spills and body height are reported (`fit_drawer_*`).
- **MF-11:** "Record delivered" is `Button/Secondary`. "Add task" is the only primary on the board. The open-task warning stays in annotation A1 (OQ-10).
- **MF-12:** The task chip (card and drawer) reads **"Client dependency"**. "Waiting for client" appears only as the project status ("Move project to" option, annotation A1/A3). The rail note now reads "Client content needed (…)".

