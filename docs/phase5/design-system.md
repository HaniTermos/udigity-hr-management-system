# Phase 5 Design System — Udigity Management System

Owner: Design-System Agent. Version DS-P5-1, 2026-10-20. Status: **scripts ready to run, not yet run in Figma**. The orchestrator runs them; node IDs come from the script return values and go in `run-log.md`.

Follows `docs/phase5/brief.md` (P5-1). Design file `GNrhb3DWa6mIhEX6F4Nmvw`. These scripts write only to page `20 DS — Foundations` (`36:2`) and page `21 DS — Components` (`36:3`). They create no screens.

## 1. Execution order

Run the scripts **one at a time, in this order**, with `use_figma`. Each script switches page once, loads Inter (Regular, Medium, Semi Bold, Bold) before writing text, and returns IDs keyed by name.

| # | Script | Page | Creates | Returns |
|---|---|---|---|---|
| 1 | `scripts/ds/01-variables.js` | 36:2 (no nodes) | Collections **Primitives** (mode `Value`) and **Semantic** (modes `Light`, `Dark`) | `collections`, `modes`, `variables.Primitives{name:id}`, `variables.Semantic{name:id}`, `counts` |
| 2 | `scripts/ds/02-styles.js` | 36:2 | 15 text styles, 5 effect styles, 3 grid styles. Board **"DS Foundations — Board"**, part A: colour, type, spacing, radius, elevation, grid | `ids.textStyles`, `ids.effectStyles`, `ids.gridStyles`, `ids.board` (section IDs), `boardId` |
| 3 | `scripts/ds/02b-foundations-board.js` | 36:2 | Board part B: icons, interaction states, chart styles, contrast table | `ids.board`, `boardId` |
| 4 | `scripts/ds/03-foundation-components.js` | 36:3 | 63 `Icon/*` components, Brand/Logo placeholder, Avatar, Divider, Placeholder/Box, Annotation, Badge/Status, Badge/Outcome, Badge/Count, Badge/Flag, Tag, Chip/Derived, Notice/Policy pending | `created{name:{id,type,props,variants}}`, `created.icons{Icon/name:id}` |
| 5 | `scripts/ds/04-controls-a.js` | 36:3 | Button, IconButton, Link, Checkbox, Radio, Input, Textarea, Field/Metric | same shape |
| 6 | `scripts/ds/05-controls-b.js` | 36:3 | Select, Input/Date, DatePicker/Day, DatePicker, Input/Search, Chip/Filter, FilterBar, RadioCard | same |
| 7 | `scripts/ds/06-navigation.js` | 36:3 | Nav/Item, Nav/SectionLabel, Nav/Sidebar, Nav/TopBar, Breadcrumb, Tabs/Item, Tabs, Shell/Mobile/Header, Shell/Mobile/Tab, Shell/Mobile/TabBar, Shell/Desktop, Shell/Mobile | same |
| 8 | `scripts/ds/07-data-display.js` | 36:3 | Table/HeaderCell, Table/Cell, Table/HeaderRow, Table/Row, Table/Pagination, Card/Surface, Card/Section, Card/Inset, Card/Metric, List/Item, List/KeyValue, Progress/Bar, Menu/Item, Menu | same + `slots` |
| 9 | `scripts/ds/08-overlays-feedback.js` | 36:3 | Overlay/Scrim, Dialog, Drawer, Banner, Banner/ErrorSummary, Toast, State, Skeleton, Notice/Access | same + `slots` |
| 10 | `scripts/ds/09-domain-a.js` | 36:3 | Calendar/Event, Calendar/Week, Calendar/Day, Card/Task, Kanban/Column, Timeline/Item, Timeline/Milestone, Timeline/Horizontal, ListItem/Note | same + `slots` |
| 11 | `scripts/ds/10-domain-b.js` | 36:3 | Attendance/Timer, Attendance/VerificationStatus, Attendance/Panel, Notice/Duplicate, Banner/Reservation, Queue/BucketHeader, Queue/Row, Row/Phone, Row/Social | same |
| 12 | `scripts/ds/11-charts.js` | 36:3 | Chart/Legend, Chart/Bar, Chart/Line | same |
| 13 | `scripts/ds/12-fixes.js` | 36:3 | Fixes the checkpoint defects in place (no rebuild, IDs unchanged): sample text-property defaults; Card/Metric per-variant text (Pending "—", Down/Flat delta) unlinked; Menu/Item Destructive icon = ban; active nav icons tinted icon/on-brand-active; Nav/Item labels wrap to 2 lines (height hugs, min 36/32) | `fixes{defaults, unlinked, menu, navTint, navWrap, missing}` |
| 14 | `scripts/ds/12b-owner-icon.js` | 36:3 | Owner sidebar active icon tint (robust lookup) | `items`, `vectors` |
| 15 | `scripts/ds/12c-duplicate-copy.js` | 36:3 | Notice/Duplicate copy per RW-05: danger tone, "This business already exists"; visible match + "Open existing business"; hidden match existence-only + DEC-003 placeholder; "No role can bypass a duplicate block." Field/Metric gains Type=Number/Date (existing variants renamed Type=Number, IDs unchanged) | `fixes{duplicate, fieldMetric, notes}` |
| 16 | `scripts/ds/12d-logo-focus.js` | 36:3 | In place, IDs unchanged. MF-16: Brand/Logo variants hug their text (padding 6/12, Large 8/16; min = old sizes) so the caption never overflows; top-level instances resized FIXED are set back to hug. MF-17: Input, Textarea, Select, Input/Date, Input/Search Focus/Open = 2 px inside `focus-ring` stroke on all sides, no outer shadow | `updated{logo, logoInstances, focus}`, `notes` |
| 17 | `scripts/ds/12e-stretchable-fields.js` | 36:3 | In place, IDs unchanged. MF-18: Input, Textarea, Select, Input/Date, Input/Search are width-agnostic — root VERTICAL auto layout (Search: horizontal control root), default 320, minWidth 200, no max; Label row / Control / Helper row FILL; Value/Placeholder FILL, icons/prefix/suffix/actions keep their size, so trailing icons stay inside at any width and Textarea text wraps inside. MF-19: Drawer Footer slot FILL, horizontal, SPACE_BETWEEN, no clip; default Cancel + Save in a FILL right-aligned "Footer actions" row; Content slot FILL width/height, padding 24 | `updated{fields, drawer}`, `skipped`, `notes` |
| 18 | `scripts/ds/13-phase6-prep.js` | 36:3 | Phase 6 prep, in place, IDs unchanged: Progress/Bar Percent axis (84 variants), overlay shadow clip fix + Dialog border, Button Large ≥ 44 check, bracket-copy scan. See §11 | `updated{progress, overlays, copy, button}`, `skipped`, `warnings`, `notes` |

**Dependencies.** 02 needs 01. 03 needs 01 and 02. Each later script needs every script before it, because it finds earlier components by exact name on page 21. If a dependency is missing, the script stops with "Component not found: … (run earlier DS scripts first)".

**Return shape (component scripts).** The scripts return `{ created, existing, rebuilt, warnings, slots? }`.
- `created[name]` gives `id` and `type`. For a component set it also gives `variants` (the count) and `props`. `props` maps variant property names to their option lists, and TEXT, BOOLEAN, INSTANCE_SWAP and SLOT properties to their real keys (for example `"Label#123:0": "TEXT"`). Screen agents pass these keys to `setProperties`, or match on the part before `#`.
- `existing[name]` lists components that were already on the page and were skipped.
- `slots` records, per component, whether a native slot (`slot`) or the INSTANCE_SWAP fallback (`instance-swap`) was used.

**Idempotency.** Every script is safe to re-run:
- Variables and styles are upserted by name.
- Components that already exist with the same name are skipped, so their IDs stay stable.
- A leftover `__ds_tmp` build frame from a failed run is removed at the start of the next run.
- The foundations board is rebuilt on each run of 02/02b. It is documentation only, and no screen depends on its IDs.

Set `const REBUILD = true` at the top of a component script to delete and rebuild that script's components. This changes their IDs. Rebuilding 03 or another early script breaks instances in later scripts and screens, so if you rebuild early, also re-run every later script with REBUILD and tell the screen agents.

**Layout on page 21.** Each script owns one top-level frame:
- The frames are named `DS 03 — …` through `DS 11 — …`.
- Each frame is placed below the previous one.
- Inside a frame, each component sits in a group named `doc · <Component>`, with a title and a usage note.
- Every frame ends with a `preview · …` row that shows instances in the **Light** and **Dark** modes side by side. The dark side sets the Semantic collection to Dark on that frame.

**Local verification.** Every script was run against a strict local mock of the Plugin API, twice for idempotency and once with REBUILD=true. The mock covers syntax, unknown properties, HUG/FILL rules, font loading, variable binding, and component-property owner rules. It cannot prove rendering, so take the checkpoint screenshots as usual.

## 2. Token architecture

- **Primitives**: 1 mode (`Value`). Contents:
  - colour ramps: navy, teal, grey, success, warning, danger, info, violet, orange, magenta
  - `base/white`, `base/black`, and alpha colours
  - `space/*`, `radius/*` and `border-width/*` numbers

  Colour primitives have `scopes = []`, so they are hidden from pickers. Spacing is scoped to GAP, radius to CORNER_RADIUS, and border width to STROKE_FLOAT.
- **Semantic**: modes `Light` and `Dark`. Every token aliases a primitive in both modes, and every token has explicit scopes. WEB code syntax is `var(--color-<token>)`, with slashes replaced by hyphens.
- Components bind fills, strokes and text colours to **Semantic** tokens only. Padding, gaps and radii bind to Primitives (`space/*`, `radius/*`). Light and dark switch by mode alone: set `setExplicitVariableModeForCollection(Semantic, Dark)` on a screen frame.
- Fixed geometry is deliberately not bound: icon sizes, 1–3 px indicator bars, the chart plot geometry and the bar top radii.

### 2.1 Primitives (hex)

| Scale | Steps |
|---|---|
| navy | 50 #EEF2F8 · 100 #D9E1EE · 200 #B3C2DB · 300 #8399BF · 400 #5571A0 · 500 #2F4F82 · 600 #1F3D6E · 700 #17305A · 800 #112447 · 900 #0B1A35 · 950 #071226 |
| teal | 50 #E6F7F7 · 100 #C2EDED · 200 #8EDDDE · 300 #52C9CB · 400 #22B3B6 · 500 #0E9CA0 · 600 #0B8084 · 700 #0A6669 · 800 #0A5052 · 900 #083E40 · 950 #052A2B |
| grey | 50 #F5F7FA · 100 #EDF0F4 · 200 #DFE4EA · 300 #C9D1DA · 400 #A1ACB9 · 500 #778395 · 600 #586476 · 700 #414B5A · 800 #2A323E · 850 #222932 · 900 #1A2029 · 950 #11151B |
| success | 50 #E7F6ED · 100 #C4E8D2 · 300 #69C493 · 400 #3DAF73 · 500 #1E9A58 · 600 #167E47 · 700 #116338 · 800 #0D4C2B · 900 #0A3A21 |
| warning | 50 #FFF5E1 · 100 #FFE6B3 · 300 #F5BF55 · 400 #EBA82B · 500 #D48A06 · 600 #AD6F00 · 700 #855500 · 800 #664100 · 900 #4A2F00 |
| danger | 50 #FDECEC · 100 #F8CDCD · 300 #EC8888 · 400 #E36060 · 500 #D63A3A · 600 #B52A2A · 700 #8F2020 · 800 #6E1919 · 900 #4F1212 |
| info | 50 #E8F1FC · 100 #C6DBF8 · 300 #79A9EC · 400 #5390E0 · 500 #2F72CF · 600 #245EAF · 700 #1C4A8B · 800 #16396B · 900 #0F2A50 |
| violet | 50 #F1EDFB · 100 #DED5F5 · 300 #A994E3 · 500 #7357C2 · 700 #523C93 · 900 #2C2052 |
| orange | 300 #F2AE7E · 500 #DB6E2C · 700 #A24E1A |
| magenta | 300 #E58DB8 · 500 #C23F7E · 700 #8F2B5B |
| base | white #FFFFFF · black #000000 |
| alpha | navy-56 = #071226 @ 56% · black-64 = #000000 @ 64% · black-8 · white-8 |

Other primitives:
- **Spacing** `space/*`: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64.
- **Radius** `radius/*`: none 0, xs 2, sm 4, md 6, lg 8, xl 12, 2xl 16, full 999.
- **Border width**: `border-width/1`, `border-width/2`.

### 2.2 Semantic tokens (Light / Dark)

| Token | Light | Dark | Scopes |
|---|---|---|---|
| `surface/page` | grey/50 #F5F7FA | grey/950 #11151B | fill |
| `surface/default` | base/white #FFFFFF | grey/900 #1A2029 | fill, effect |
| `surface/raised` | base/white #FFFFFF | grey/850 #222932 | fill |
| `surface/subtle` | grey/50 #F5F7FA | grey/850 #222932 | fill |
| `surface/sunken` | grey/100 #EDF0F4 | grey/950 #11151B | fill |
| `surface/hover` | grey/100 #EDF0F4 | grey/800 #2A323E | fill |
| `surface/pressed` | grey/200 #DFE4EA | grey/700 #414B5A | fill |
| `surface/selected` | teal/50 #E6F7F7 | teal/950 #052A2B | fill |
| `surface/disabled` | grey/100 #EDF0F4 | grey/800 #2A323E | fill |
| `surface/inverse` | navy/900 #0B1A35 | grey/100 #EDF0F4 | fill |
| `surface/brand` | navy/900 #0B1A35 | navy/950 #071226 | fill |
| `surface/brand-hover` | navy/800 #112447 | navy/900 #0B1A35 | fill |
| `surface/brand-active` | navy/700 #17305A | navy/800 #112447 | fill |
| `surface/skeleton` | grey/200 #DFE4EA | grey/800 #2A323E | fill |
| `border/default` | grey/200 #DFE4EA | grey/700 #414B5A | stroke, fill |
| `border/subtle` | grey/100 #EDF0F4 | grey/800 #2A323E | stroke, fill |
| `border/strong` | grey/300 #C9D1DA | grey/600 #586476 | stroke, fill |
| `border/input` | grey/500 #778395 | grey/500 #778395 | stroke, fill |
| `border/brand` | navy/700 #17305A | navy/800 #112447 | stroke, fill |
| `border/selected` | teal/600 #0B8084 | teal/400 #22B3B6 | stroke, fill |
| `text/primary` | grey/900 #1A2029 | grey/50 #F5F7FA | text |
| `text/secondary` | grey/700 #414B5A | grey/300 #C9D1DA | text |
| `text/muted` | grey/600 #586476 | grey/400 #A1ACB9 | text |
| `text/placeholder` | grey/600 #586476 | grey/400 #A1ACB9 | text |
| `text/disabled` | grey/400 #A1ACB9 | grey/600 #586476 | text |
| `text/inverse` | base/white #FFFFFF | grey/950 #11151B | text |
| `text/on-brand` | base/white #FFFFFF | base/white #FFFFFF | text |
| `text/on-brand-muted` | navy/200 #B3C2DB | navy/200 #B3C2DB | text |
| `text/on-primary` | base/white #FFFFFF | grey/950 #11151B | text |
| `text/on-danger` | base/white #FFFFFF | grey/950 #11151B | text |
| `text/link` | teal/700 #0A6669 | teal/300 #52C9CB | text |
| `icon/default` | grey/700 #414B5A | grey/300 #C9D1DA | stroke, shape fill |
| `icon/muted` | grey/500 #778395 | grey/500 #778395 | stroke, shape fill |
| `icon/on-brand` | navy/200 #B3C2DB | navy/200 #B3C2DB | stroke, shape fill |
| `icon/on-brand-active` | base/white #FFFFFF | base/white #FFFFFF | stroke, shape fill |
| `icon/accent` | teal/600 #0B8084 | teal/400 #22B3B6 | stroke, shape fill |
| `icon/strong` | grey/900 #1A2029 | grey/50 #F5F7FA | stroke, shape fill |
| `icon/on-primary` | base/white #FFFFFF | grey/950 #11151B | stroke, shape fill |
| `icon/disabled` | grey/400 #A1ACB9 | grey/600 #586476 | stroke, shape fill |
| `brand/primary` | navy/700 #17305A | teal/400 #22B3B6 | fill |
| `brand/primary-hover` | navy/800 #112447 | teal/300 #52C9CB | fill |
| `brand/primary-pressed` | navy/900 #0B1A35 | teal/200 #8EDDDE | fill |
| `brand/accent` | teal/600 #0B8084 | teal/400 #22B3B6 | fill, stroke, text, effect |
| `brand/accent-strong` | teal/700 #0A6669 | teal/300 #52C9CB | fill, stroke, text, effect |
| `brand/accent-subtle` | teal/50 #E6F7F7 | teal/950 #052A2B | fill |
| `focus-ring` | teal/500 #0E9CA0 | teal/300 #52C9CB | stroke, effect |
| `overlay/scrim` | alpha/navy-56 #071226 @56.00000000000001% | alpha/black-64 #000000 @64% | fill |
| `status/success/fg` | success/700 #116338 | success/300 #69C493 | text, stroke, shape fill |
| `status/success/bg` | success/50 #E7F6ED | success/900 #0A3A21 | fill |
| `status/success/border` | success/300 #69C493 | success/700 #116338 | stroke, fill |
| `status/success/solid` | success/600 #167E47 | success/400 #3DAF73 | fill, stroke, text, effect |
| `status/warning/fg` | warning/700 #855500 | warning/300 #F5BF55 | text, stroke, shape fill |
| `status/warning/bg` | warning/50 #FFF5E1 | warning/900 #4A2F00 | fill |
| `status/warning/border` | warning/300 #F5BF55 | warning/700 #855500 | stroke, fill |
| `status/warning/solid` | warning/600 #AD6F00 | warning/400 #EBA82B | fill, stroke, text, effect |
| `status/danger/fg` | danger/700 #8F2020 | danger/300 #EC8888 | text, stroke, shape fill |
| `status/danger/bg` | danger/50 #FDECEC | danger/900 #4F1212 | fill |
| `status/danger/border` | danger/300 #EC8888 | danger/700 #8F2020 | stroke, fill |
| `status/danger/solid` | danger/600 #B52A2A | danger/400 #E36060 | fill, stroke, text, effect |
| `status/info/fg` | info/700 #1C4A8B | info/300 #79A9EC | text, stroke, shape fill |
| `status/info/bg` | info/50 #E8F1FC | info/900 #0F2A50 | fill |
| `status/info/border` | info/300 #79A9EC | info/700 #1C4A8B | stroke, fill |
| `status/info/solid` | info/600 #245EAF | info/400 #5390E0 | fill, stroke, text, effect |
| `status/neutral/fg` | grey/700 #414B5A | grey/300 #C9D1DA | text, stroke, shape fill |
| `status/neutral/bg` | grey/100 #EDF0F4 | grey/800 #2A323E | fill |
| `status/neutral/border` | grey/300 #C9D1DA | grey/600 #586476 | stroke, fill |
| `status/neutral/solid` | grey/600 #586476 | grey/400 #A1ACB9 | fill, stroke, text, effect |
| `status/brand/fg` | teal/700 #0A6669 | teal/300 #52C9CB | text, stroke, shape fill |
| `status/brand/bg` | teal/50 #E6F7F7 | teal/950 #052A2B | fill |
| `status/brand/border` | teal/300 #52C9CB | teal/700 #0A6669 | stroke, fill |
| `status/brand/solid` | teal/600 #0B8084 | teal/400 #22B3B6 | fill, stroke, text, effect |
| `status/policy/fg` | violet/700 #523C93 | violet/300 #A994E3 | text, stroke, shape fill |
| `status/policy/bg` | violet/50 #F1EDFB | violet/900 #2C2052 | fill |
| `status/policy/border` | violet/300 #A994E3 | violet/700 #523C93 | stroke, fill |
| `status/policy/solid` | violet/500 #7357C2 | violet/300 #A994E3 | fill, stroke, text, effect |
| `status/decision/fg` | navy/600 #1F3D6E | navy/200 #B3C2DB | text, stroke, shape fill |
| `status/decision/bg` | navy/50 #EEF2F8 | navy/900 #0B1A35 | fill |
| `status/decision/border` | navy/300 #8399BF | navy/700 #17305A | stroke, fill |
| `status/decision/solid` | navy/500 #2F4F82 | navy/300 #8399BF | fill, stroke, text, effect |
| `chart/series-1` | teal/500 #0E9CA0 | teal/300 #52C9CB | fill, stroke |
| `chart/series-2` | navy/500 #2F4F82 | navy/300 #8399BF | fill, stroke |
| `chart/series-3` | violet/500 #7357C2 | violet/300 #A994E3 | fill, stroke |
| `chart/series-4` | orange/500 #DB6E2C | orange/300 #F2AE7E | fill, stroke |
| `chart/series-5` | magenta/500 #C23F7E | magenta/300 #E58DB8 | fill, stroke |
| `chart/series-6` | grey/500 #778395 | grey/400 #A1ACB9 | fill, stroke |
| `chart/grid` | grey/200 #DFE4EA | grey/700 #414B5A | fill, stroke |
| `chart/axis` | grey/600 #586476 | grey/400 #A1ACB9 | fill, stroke |
| `chart/target` | warning/600 #AD6F00 | warning/300 #F5BF55 | fill, stroke |

How to use the tokens:
- The **sidebar is navy in both modes**: `surface/brand` is navy/900 in Light and navy/950 in Dark.
- `brand/primary` is navy in Light and **teal** in Dark, because navy on a dark surface fails contrast. The text on it switches through `text/on-primary`: white in Light, grey/950 in Dark.
- `status/<tone>/*` covers the tones success, warning, danger, info, neutral, brand (teal), **policy** (violet, used only for Notice/Policy pending) and **decision** (navy, for "Implementation decision").
- `status/warning/solid` is **for non-text marks only**. White text on it is 4.16:1 in Light.

## 3. Typography

All text uses Inter. The styles are local text styles prefixed `ds/`.

| Style | Font | Size/line | Tracking | Use |
|---|---|---|---|---|
| ds/Display | Bold | 32/40 | −1% | Dashboard titles, hero numbers |
| ds/H1 | Semi Bold | 24/32 | −0.5% | Screen title |
| ds/H2 | Semi Bold | 20/28 | −0.5% | Section and dialog titles |
| ds/H3 | Semi Bold | 16/24 | 0 | Card and drawer section titles |
| ds/H4 | Semi Bold | 14/20 | 0 | Sub-sections, column and group headers |
| ds/Body | Regular | 14/20 | 0 | Default text |
| ds/Body Strong | Medium | 14/20 | 0 | Primary table cell, emphasis |
| ds/Body Small | Regular | 13/18 | 0 | Helper text, meta, secondary |
| ds/Label | Medium | 14/20 | 0 | Buttons, labels, nav, tabs |
| ds/Label Small | Medium | 12/16 | 0 | Small buttons, badges, chips |
| ds/Caption | Regular | 12/16 | 0 | Timestamps, axis labels |
| ds/Overline | Semi Bold | 11/16 | +6%, UPPER | Nav section labels, table headers |
| ds/Number | Medium | 14/20 | 0 | Table numbers |
| ds/Number Large | Semi Bold | 28/36 | −0.5% | Metric values |
| ds/Number XL | Semi Bold | 40/48 | −1% | Attendance timer |

The Plugin API cannot set OpenType features on a text style, so tabular figures are a **code rule**: `font-variant-numeric: tabular-nums` for ds/Number*, tables and timers.

## 4. Effects, grid and layout

**Effect styles:**
- `ds/Elevation/1`: cards, if a shadow is needed at all. Prefer the 1px border.
- `ds/Elevation/2`: menus, popovers, toasts.
- `ds/Elevation/3`: dialogs and drawers.

All three shadows are navy-tinted and low opacity.

**Focus ring:** `ds/Focus ring` is a 2px `surface/default` gap plus a 2px `focus-ring` (teal). `ds/Focus ring/Danger` is the same with the danger colour. The ring colours are bound to Semantic variables, so the ring follows the mode. **Fields (after 12d):** text fields, selects, date and search inputs do not use the outer shadow (it was clipped at the sides by full-width layouts); their Focus/Open state is a 2px `focus-ring` stroke inside the control, even on all sides. Buttons, links, checkboxes and radios keep `ds/Focus ring`.

**Grid styles:**
- `ds/Grid/Desktop content 12-col`: 12 columns, 24 gutter, 24 margin. Apply it to the 1200×836 content frame.
- `ds/Grid/Mobile 4-col`: 4 columns, 16 gutter, 16 margin.
- `ds/Grid/Baseline 8`: hidden by default.

**Desktop (1440×900):**
- Sidebar 240 (navy) and top bar 64.
- Content frame 1200×836 at x240 y64, padding 24, so the content column is 1152 wide.
- Column spans: 3 col = 270, 4 col = 368, 6 col = 564, 12 col = 1152.
- Drawer 480 at x960 over the scrim. Dialogs are 400, 520 or 720 wide, centred.

**Mobile (390×844):**
- Header 56 at the top and tab bar 64 at y780.
- The content area is 390×724, with 16 margins and 4 columns.

**Breakpoints (code):** mobile < 768, tablet 768–1279 (collapsible nav), desktop ≥ 1280.

## 5. Icons

The icons are an in-house set of **simple line icons drawn as native vectors** from SVG path data written by this agent:
- 24-unit grid, 1.75 stroke, round caps and joins, no fills.
- Each icon is a component `Icon/<name>` (63 icons), 20×20 by default. Resize instances to 16 or 24.
- Each icon has one vector layer named **`Glyph`** with its stroke bound to `icon/default`. To tint an icon, override the Glyph stroke with `icon/*` or `status/*/fg`. Because every icon uses the same layer name, the override survives an INSTANCE_SWAP.
- Icons are swapped with INSTANCE_SWAP properties (`Icon`), never with variants.
- No external assets are imported, and no third-party logos are used. Social platforms are shown by name plus a generic icon.
- An icon never carries meaning on its own: status icons always come with a text label.

Icon list: search, calendar, clock, chevron-down/up/left/right, check, x, plus, minus, filter, bell, user, users, home, building, phone, briefcase, folder, board, list, chart, settings, lock, eye, eye-off, alert-triangle, alert-circle, info, check-circle, x-circle, ban, menu, more, more-vertical, map-pin, wifi, copy, flag, shield, mail, arrow-up/down/right, trend-up/down, spinner, log-out, download, edit, trash, link, globe, at-sign, file-text, refresh, target, hourglass, pause-circle, play, note, grip.

## 6. Component inventory

Notation: **V:** variant properties (options). **P:** other properties (TEXT / BOOL / SWAP / SLOT). Property keys get a `#id` suffix; the scripts return them.

| Component | V: variants | P: properties | Notes |
|---|---|---|---|
| Brand/Logo (placeholder — awaiting supplied file) | Size: Small, Medium, Large × Surface: Default, On brand | — | Neutral dashed box that hugs its text (min 132×32 / 168×40 / 220×56, after 12d). **Never draw the logo**; replace the inner content when the file arrives, and keep the name and ID |
| Icon/<name> (63) | — | — | See §5 |
| Avatar | Size: Small 24, Medium 32, Large 40 × Tone: Brand, Neutral | Initials TEXT | Initials only |
| Divider | Orientation: Horizontal, Vertical | — | border/default |
| Placeholder/Box | — | Label, Hint TEXT | Dashed box. Default content of every slot; also used for "Limited preview — pending DEC-003" |
| Annotation | Type: Note, Interaction, Implementation | Title, Body TEXT | Designer annotation, not product UI. Interaction = intended-interaction note (no prototype in this phase) |
| Badge/Status | Tone: Neutral, Info, Success, Warning, Danger, Brand × Size: Small, Large | Label TEXT, Show dot BOOL | Stored status. Always has a text label |
| Badge/Outcome | Outcome: Pending, On hold, Needs another call, Rejected, Accepted | — | Each outcome has its own icon and label |
| Badge/Count | Tone: Neutral, Brand, Danger, On brand | Count TEXT | |
| Badge/Flag | Tone: Warning, Danger, Info, Neutral | Label TEXT | "Correction requested 14 Oct", "Changed by Karim Saleh" |
| Tag | Tone: Neutral, Brand, Outline | Label TEXT | Category, phone label, platform |
| Chip/Derived | Tone: Neutral, Amber | Label TEXT | Dashed = derived (not stored) |
| **Notice/Policy pending** | Size: Block, Inline, Chip × Tone: Policy pending, Implementation decision | DEC TEXT, Body TEXT | Block 360 (wrapping body, resize width), Inline 320 (one wrapping line), Chip (single line, hug). Violet policy tone |
| Button | Variant: Primary, Secondary, Ghost, Destructive × Size: Small 32, Medium 40, Large 48 × State: Default, Hover, Focus, Disabled, Loading | Label TEXT, Show icon BOOL, Icon SWAP | 60 variants in one set (deliberate, see §8). Full width = FILL on the instance |
| IconButton | Variant: Ghost, Secondary, Primary × Size: Small, Medium × State: Default, Hover, Focus, Disabled | Icon SWAP, Show dot BOOL | Needs an accessible name in code |
| Link | Size: Medium, Small × State: Default, Hover, Focus, Disabled | Label TEXT, Show icon BOOL, Icon SWAP | Also covers the "Button/Link" and "Tertiary" requests |
| Checkbox | Checked: False, True, Indeterminate × State: Default, Hover, Focus, Disabled | Label TEXT, Show label BOOL | |
| Radio | Selected: False, True × State: Default, Focus, Disabled | Label TEXT | Stack Radios to form a RadioGroup |
| Input | Type: Text, Phone, URL, Number, Password × State: Default, Filled, Focus, Error, Disabled | Label, Value, Placeholder, Helper, Error message, Country code, Suffix TEXT; Show label, Required, Show helper, Show icon BOOL; Icon SWAP | Placeholder shows in Default; Value in the other states. Error = danger border + icon + message |
| Textarea | State: Default, Filled, Focus, Error, Disabled | as Input + Counter | 96 high; width-agnostic (12e) |
| Field/Metric | Type: Number, Date (after 12c) × State: Value, Empty error, Unknown | as Input | Input plus an "Unknown" checkbox. Whether Unknown is allowed is pending DEC-014/023 |
| Select | Type: Select, Combobox, Person × State: Default, Filled, Focus, Open, Error, Disabled | as Input | Person shows an avatar. For Open, pair with a Menu |
| Input/Date | Type: Date, Time, Date and time × State: Default, Filled, Focus, Error, Disabled | as Input | 24-hour time |
| DatePicker/Day | State: Default, Hover, Today, Selected, Outside, Disabled | Day TEXT | |
| DatePicker | — | — | October 2026, today 20 Oct, selected 22 Oct |
| Input/Search | Size: Small 32, Medium 40 × State: Default, Filled, Focus | Placeholder, Value TEXT | Call Center scope: "Search assigned businesses" |
| Chip/Filter | State: Default, Hover, Active, Disabled | Label TEXT | Active = applied value + remove (x) |
| FilterBar | — | — | Search, 3 chips, Clear, Sort (1152) |
| RadioCard | State: Default, Hover, Selected, Disabled | Title, Description TEXT; Show status dot BOOL | Selected = 2px teal border + filled radio |
| Nav/Item | Density: Default 36, Compact 32 × State: Default, Hover, Active, Disabled | Label TEXT, Icon SWAP, Show badge BOOL (Badge exposed) | Active = brand-active surface + teal bar |
| Nav/SectionLabel | — | Label TEXT | |
| Nav/Sidebar | Role: Owner, Data Entry, Call Center, Developer | — | 240×900, items per sitemap P4-NAV-1. The home item is active; switch by setting a nested Nav/Item State |
| Nav/TopBar | — | Name, Role TEXT; Show attendance, Show search BOOL | Search, attendance badge, avatar and bell are exposed |
| Breadcrumb | — | Level 1, Level 2, Current TEXT; Show level 2 BOOL | |
| Tabs/Item | Style: Underline, Segmented × State: Default, Hover, Active, Disabled | Label TEXT, Show count BOOL | Segmented also covers SegmentedControl |
| Tabs | Style: Underline, Segmented × **Active: 1, 2, 3, 4** | — | The active-tab property |
| Shell/Mobile/Header | Back: False, True | Title, Subtitle TEXT; Show subtitle BOOL | 390×56 |
| Shell/Mobile/Tab | State: Default, Active | Label TEXT, Icon SWAP | |
| Shell/Mobile/TabBar | Role (4) × Active: 1–4 | — | Tab sets per sitemap §4 (Call Center: My Day · Queue · Follow-ups · More) |
| Shell/Desktop | Role (4) | — | 1440×900: sidebar plus top bar with the role's person (Rana Haddad, Karim Saleh, Maya Khoury, Lina Aoun) |
| Shell/Mobile | Role (4) | — | 390×844: header plus tab bar |
| Table/HeaderCell | Align: Left, Right × Sort: None, Ascending, Descending | Label TEXT | |
| Table/Cell | Type: Text, Text with meta, Number, Status, Link, Avatar, Checkbox, Actions | Text, Meta TEXT | Status cell = Badge/Status |
| Table/HeaderRow | — | — | Columns match Table/Row (1152) |
| Table/Row | State: Default, Hover, Selected | — | Example business row |
| Table/Pagination | — | Range TEXT | |
| Card/Surface | — | **Content SLOT** | radius 12, border, padding 20 |
| Card/Section | — | Title, Subtitle TEXT; Show subtitle, Show action BOOL; **Content SLOT** | |
| Card/Inset | — | **Content SLOT** | surface/subtle |
| Card/Metric | Trend: Up, Down, Flat, Pending, Loading | Label, Value, Delta, Caption TEXT; Show caption BOOL | Pending = "—" plus a DEC-020 chip |
| List/Item | State: Default, Hover | Title, Meta TEXT; Icon SWAP; Show leading, Show badge, Show chevron BOOL | |
| List/KeyValue | Type: Default, Check, Not recorded | Key, Value TEXT | Also covers DescriptionList |
| Progress/Bar | Tone: Brand, Success, Warning, Danger; **Percent: 0, 5, …, 100** (since 13) | Label, Value TEXT; Show labels BOOL | Value-driven: set `Percent`; instance FILL / any width ≥ 80. Never resize the nested "Fill" |
| Menu/Item | Type: Default, Icon, Avatar, Destructive × State: Default, Hover, Selected, Disabled | Label TEXT, Icon SWAP | |
| Menu | — | — | 240 wide, Elevation/2 |
| Overlay/Scrim | Size: Desktop, Mobile | — | overlay/scrim |
| **Dialog** | — | Title, Description TEXT; Show description, Show footer, Show close BOOL; **Content SLOT** | 520. Footer buttons are exposed |
| **Drawer** | — | Title, Subtitle TEXT; Show subtitle BOOL; **Content SLOT**, **Footer SLOT** | 480×900 |
| Banner | Tone: Info, Success, Warning, Error × Size: Default 720, Inline 360 | Title, Body TEXT; Show title, Show action, Show close BOOL | Also covers Alert/Inline |
| Banner/ErrorSummary | — | Title TEXT; **Errors SLOT** (linked items) | |
| Toast | Tone: Info, Success, Warning, Error | Title, Body TEXT; Show body BOOL | |
| State | Type: Empty, No results, Loading, Error, Session expired, Save conflict × Size: Page, Inline | Show action BOOL | Standard copy per type; override the text layers if needed |
| Skeleton | Type: Text line, Avatar, Table row, Card | — | |
| Notice/Access | Type: Permission denied, Hidden by policy, Context-limited × Size: Page, Inline | — | Context-limited carries the DEC-005 chip. Never reveals hidden data |
| Calendar/Event | Kind: Follow-up, Meeting, Task, Overdue, Done | Time, Title TEXT | 60 px per hour |
| Calendar/Week | — | — | 1148×528, Mon 19 – Sun 25 Oct 2026, 09–17 |
| Calendar/Day | — | Date TEXT | 358 wide |
| Card/Task | State: Default, Done | Title, Project, Due TEXT; Show chip, Show notice BOOL | Chip "Waiting for client"; notice DEC-018 |
| Kanban/Column | — | Title TEXT, Show add BOOL; **Cards SLOT** | Column statuses pending DEC-019 |
| Timeline/Item | Type: Call attempt, Follow-up, Status change, Note, Upcoming | Title, Time, Body TEXT; Show connector BOOL | Timeline/Vertical = stacked items |
| Timeline/Milestone | State: Achieved, Current, Upcoming, Final | Label, Date TEXT | |
| Timeline/Horizontal | — | — | Milestone track with a "Today · 20 Oct" marker |
| ListItem/Note | Accent: Neutral, Amber | Author, Time, Body TEXT | |
| Attendance/Timer | State: Not checked in, Checked in, Closed | — | Override the Elapsed and Caption layers |
| Attendance/VerificationStatus | State: Verifying, Passed, Failed, Remote exception | — | DEC-009 |
| **Attendance/Panel** | State: Not checked in, Verifying, Checked in, Verification failed, Checked out | — | Timer, 9h progress, verification, action, DEC-009 chip |
| **Notice/Duplicate** | Match: Visible match, Hidden match | — | Hard block (danger tone). Hidden = existence only ("A matching business exists. Saving is blocked.") + DEC-003 placeholder; no reveal, no escalation (RW-05, after 12c) |
| **Banner/Reservation** | State: Reserved by me, Reserved by other, Expiring, Expired, Override, Offline × Size: Banner, Chip | Show policy BOOL | DEC-004 chip on the banner |
| Queue/BucketHeader | Expanded: True, False | Label TEXT | |
| Queue/Row | State: Default, Hover, Selected | Name, Meta TEXT; Show flag BOOL | |
| Row/Phone | — | Number TEXT, Show copy BOOL | +000 70 000 1xx |
| Row/Social | Metrics: Recorded, Not recorded | Platform, Handle TEXT | `.demo` handles |
| Chart/Legend | Series: 1–6 | Label TEXT | |
| Chart/Bar | Type: Single, Grouped | — | Dashed target line, "Target 150 · DEC-020 pending" |
| Chart/Line | — | — | Two series, native vector lines |

## 7. Usage rules

1. **Instances only.** Screen agents use instances of these components and bind only to these variables. Missing pieces go to the orchestrator as a "Component request". Never build a competing component.
2. **Dark mode.** Call `frame.setExplicitVariableModeForCollection(<Semantic collection>, <Dark modeId>)` on the screen frame. Both IDs come from the 01 return value. Never recolour instances by hand.
3. **Assembly.**
   - Desktop: a `Shell/Desktop` instance at (0,0), with the content frame (1200×836) above it at x240 y64. Apply `ds/Grid/Desktop content 12-col`.
   - Mobile: a `Shell/Mobile` instance, with content at y56 (390×724).
   - To mark the screen's own nav item active, set that nested `Nav/Item` State to Active and set the home item to Default.
4. **Slots.** Dialog, Drawer, Card/Surface, Card/Section, Card/Inset, Banner/ErrorSummary and Kanban/Column use **native slots** (`createSlot`). To fill one, find the `SLOT` node in the instance and append content. Each slot's default content is a `Placeholder/Box`, which you remove or replace.

   If the file does not support slots, the scripts fall back to an **INSTANCE_SWAP** property with the same name, pointing at `Placeholder/Box`, and report `instance-swap` in `slots`. In that case, swap to another DS component.
5. **Text properties.** Use `setProperties` with the returned keys. A TEXT property has one default for the whole set. After 12-fixes, these Card/Metric layers are no longer linked to properties, so override the text layer directly: Pending → Value and Caption; Down and Flat → Delta. Where a component deliberately has no TEXT property, override the named text layer directly. This applies to standard copy in State, Notice/Access, Attendance/Timer and Notice/Duplicate. The property-managed defaults are generic, for example "Label" and "Status".
6. **Nested instances** (badges inside nav items, cells inside rows, buttons in dialogs) are exposed with `isExposedInstance` where possible. Otherwise reach them with `findAllWithCriteria({types:['INSTANCE']})` and match by layer name, for example `Badge`, `Status`, `Avatar`, `Search`, `Policy`, `Action`, `Primary action`.
7. **Never colour-only.** Every status, outcome, reservation state, verification state, event kind, trend and milestone has an icon or shape and a text label.
8. **Pending policies** always use `Notice/Policy pending`:
   - Chip under field labels and on cards.
   - Inline in forms.
   - Block for screen-level notes.

   Write the exact ID in DEC, for example `DEC-020`, `R-11`, `B-1`, `SB-3`, `F2`. Never resolve a policy to simplify a design.
9. **Fictional content only** (brief §5): phones `+000 70 000 1xx`, `.demo` handles, `example.com` sites, dates in October–November 2026.
10. **Focus.** Interactive components have a Focus variant that uses `ds/Focus ring`. Show it in samples where keyboard use matters.
11. **Fields are width-agnostic (after 12e).** Input, Textarea, Select, Input/Date and Input/Search have no fixed 320 box: set the instance to `layoutSizingHorizontal = 'FILL'` (or any width ≥ 200) and the label, control, trailing icon and helper follow. Never resize the inner Control or text layers. Drawer: fill the Footer slot with one FILL row (or a left destructive/secondary item plus a right group); the slot is SPACE_BETWEEN and never clips. Children of the Content slot should FILL.

## 8. Decisions and assumptions

- **Button has 60 variants in one set** (4 variants × 3 sizes × 5 states). This goes beyond the 30-combination guideline on purpose, so instances can switch size and state without swapping components.
- **Charts** are static, illustrative components. Values change by resizing the named bar rectangles or points, not by data binding.
- The **Owner sidebar** uses Compact items (32) so its 16 items fit. The nav list clips (scrolls) above the fixed bottom block.
- **Tabular figures** cannot be set through the Plugin API, so they are a code rule (§3).
- **Interactions** are annotated with `Annotation` Type=Interaction. No prototype links are made.
- **Logo:** `Brand/Logo (placeholder — awaiting supplied file)` is a neutral dashed box with text. When the file is supplied, the DS agent replaces the placeholder's inner content in place, keeping the name and ID, so every instance updates. Nobody else draws a logo.

## 9. Component-request mapping (screen specs, 2026-10-20)

| Requested name | DS answer |
|---|---|
| Input/* phone, URL, number, date + helper/error slot | `Input` Type Phone/URL/Number/Password with Helper and Error message properties; `Input/Date` |
| Field/Metric with Unknown | `Field/Metric` |
| Card/Inset, Card/Surface, Card/Section | Same names, with slots |
| Banner/Error with list slot | `Banner/ErrorSummary` (Errors slot) |
| Dialog with content slot | `Dialog` (Content slot) |
| Notice/Policy pending compact / inline / chip / block | `Notice/Policy pending` Size Chip, Inline, Block; Tone Implementation decision |
| Placeholder box (dashed) | `Placeholder/Box` |
| Annotation card | `Annotation` |
| Badge/Warning "changed by" | `Badge/Flag` Tone Warning, Label "Changed by …" |
| Queue/BucketHeader, Queue/Row | Same names |
| Badge/Outcome (5) | `Badge/Outcome` |
| Banner/Reservation (by me, by other, expired, offline, overridden) | `Banner/Reservation`, which also has Expiring and a Chip size |
| RadioCard, RadioGroup | `RadioCard`; `Radio` stacked |
| SegmentedControl | `Tabs` / `Tabs/Item` Style Segmented |
| Timeline/Item, Timeline/Vertical, Timeline/Horizontal | `Timeline/Item` (stack = vertical), `Timeline/Horizontal` + `Timeline/Milestone` |
| DescriptionList, List/KeyValue | `List/KeyValue` |
| PhoneRow, SocialRow | `Row/Phone`, `Row/Social` |
| Kanban/Column with slot body; Card/Task default/done | `Kanban/Column` (Cards slot); `Card/Task` |
| Chip/Derived (neutral, amber) | `Chip/Derived` |
| Badge/Status sizes S/L, tones incl. teal | `Badge/Status` Size Small/Large, Tone Brand = teal |
| Button size S "chip" style, Button/Link, Button/Tertiary | `Button` Size Small; `Link` |
| ListItem/Note neutral/amber | `ListItem/Note` |
| Drawer header/body/footer slots | `Drawer` (Content + Footer slots) |
| Select with avatar option | `Select` Type Person; `Menu/Item` Type Avatar |
| EmptyState/Inline | `State` Size Inline |
| Shell/Mobile/TabBar role tab sets + active tab; Shell/Mobile/Header | `Shell/Mobile/TabBar` (Role × Active); `Shell/Mobile/Header` (Back, Title, Subtitle) |
| Attendance/Timer, Attendance/VerificationStatus | Same names |
| Input/Password | `Input` Type Password |
| Progress/Bar label/value, brand/warning | `Progress/Bar` |
| Alert/Inline | `Banner` Size Inline |
| Divider, Avatar, IconButton, Link, Breadcrumb, Tag, Badge/Count/Flag | Same names |
| Variable names used provisionally in specs (`bg/canvas`, `bg/surface`, `status/success`, `focus/ring`…) | Use the Semantic names in §2.2: `surface/page`, `surface/default`, `surface/subtle`, `status/<tone>/fg\|bg\|border\|solid`, `focus-ring`, `brand/primary`, `brand/accent` |

## 10. Contrast (computed)

Each ratio is calculated with the WCAG 2.x relative-luminance formula from the hex values of the actual foreground/background token pair, in each mode. The table was generated from the token source.

Thresholds:
- Text: 4.5:1.
- UI and graphics (input borders, focus ring, icons, chart marks, solid status marks): 3:1.
- Disabled text: exempt.
- `border/strong`: decorative only, never the sole boundary of an input.

**Result: no pair is below its threshold.**

The tightest pairs are `focus-ring` on `surface/page` (Light 3.11), `chart/series-1` and `chart/series-4` (Light 3.34), and `brand/accent` on `surface/brand` (Light 3.66). All of these are UI pairs at 3:1.

The same table is drawn on the foundations board (02b), with live Light and Dark samples.

| Foreground | Background | Use | Need | Light (hex) | Light ratio | Dark (hex) | Dark ratio | Result |
|---|---|---|---|---|---|---|---|---|
| `text/primary` | `surface/default` | text | 4.5:1 | #1A2029 / #FFFFFF | 16.37 | #F5F7FA / #1A2029 | 15.26 | PASS |
| `text/primary` | `surface/page` | text | 4.5:1 | #1A2029 / #F5F7FA | 15.26 | #F5F7FA / #11151B | 17.06 | PASS |
| `text/primary` | `surface/sunken` | text | 4.5:1 | #1A2029 / #EDF0F4 | 14.32 | #F5F7FA / #11151B | 17.06 | PASS |
| `text/primary` | `surface/raised` | text | 4.5:1 | #1A2029 / #FFFFFF | 16.37 | #F5F7FA / #222932 | 13.67 | PASS |
| `text/primary` | `surface/selected` | text | 4.5:1 | #1A2029 / #E6F7F7 | 14.82 | #F5F7FA / #052A2B | 14.26 | PASS |
| `text/primary` | `surface/hover` | text | 4.5:1 | #1A2029 / #EDF0F4 | 14.32 | #F5F7FA / #2A323E | 12.05 | PASS |
| `text/secondary` | `surface/default` | text | 4.5:1 | #414B5A / #FFFFFF | 8.83 | #C9D1DA / #1A2029 | 10.62 | PASS |
| `text/secondary` | `surface/page` | text | 4.5:1 | #414B5A / #F5F7FA | 8.23 | #C9D1DA / #11151B | 11.87 | PASS |
| `text/secondary` | `surface/sunken` | text | 4.5:1 | #414B5A / #EDF0F4 | 7.72 | #C9D1DA / #11151B | 11.87 | PASS |
| `text/muted` | `surface/default` | text | 4.5:1 | #586476 / #FFFFFF | 6.00 | #A1ACB9 / #1A2029 | 7.11 | PASS |
| `text/muted` | `surface/page` | text | 4.5:1 | #586476 / #F5F7FA | 5.59 | #A1ACB9 / #11151B | 7.95 | PASS |
| `text/muted` | `surface/sunken` | text | 4.5:1 | #586476 / #EDF0F4 | 5.25 | #A1ACB9 / #11151B | 7.95 | PASS |
| `text/muted` | `surface/hover` | text | 4.5:1 | #586476 / #EDF0F4 | 5.25 | #A1ACB9 / #2A323E | 5.61 | PASS |
| `text/placeholder` | `surface/default` | text | 4.5:1 | #586476 / #FFFFFF | 6.00 | #A1ACB9 / #1A2029 | 7.11 | PASS |
| `text/link` | `surface/default` | text | 4.5:1 | #0A6669 / #FFFFFF | 6.74 | #52C9CB / #1A2029 | 8.25 | PASS |
| `text/link` | `surface/page` | text | 4.5:1 | #0A6669 / #F5F7FA | 6.28 | #52C9CB / #11151B | 9.22 | PASS |
| `text/on-brand` | `surface/brand` | text | 4.5:1 | #FFFFFF / #0B1A35 | 17.31 | #FFFFFF / #071226 | 18.69 | PASS |
| `text/on-brand` | `surface/brand-active` | text | 4.5:1 | #FFFFFF / #17305A | 13.07 | #FFFFFF / #112447 | 15.36 | PASS |
| `text/on-brand-muted` | `surface/brand` | text | 4.5:1 | #B3C2DB / #0B1A35 | 9.61 | #B3C2DB / #071226 | 10.37 | PASS |
| `text/on-brand-muted` | `surface/brand-hover` | text | 4.5:1 | #B3C2DB / #112447 | 8.53 | #B3C2DB / #0B1A35 | 9.61 | PASS |
| `text/on-primary` | `brand/primary` | text | 4.5:1 | #FFFFFF / #17305A | 13.07 | #11151B / #22B3B6 | 7.14 | PASS |
| `text/on-primary` | `brand/primary-hover` | text | 4.5:1 | #FFFFFF / #112447 | 15.36 | #11151B / #52C9CB | 9.22 | PASS |
| `text/on-danger` | `status/danger/solid` | text | 4.5:1 | #FFFFFF / #B52A2A | 6.31 | #11151B / #E36060 | 5.33 | PASS |
| `text/inverse` | `surface/inverse` | text | 4.5:1 | #FFFFFF / #0B1A35 | 17.31 | #11151B / #EDF0F4 | 16.02 | PASS |
| `text/on-primary` | `brand/accent` | text | 4.5:1 | #FFFFFF / #0B8084 | 4.73 | #11151B / #22B3B6 | 7.14 | PASS |
| `status/success/fg` | `status/success/bg` | text | 4.5:1 | #116338 / #E7F6ED | 6.56 | #69C493 / #0A3A21 | 6.05 | PASS |
| `status/warning/fg` | `status/warning/bg` | text | 4.5:1 | #855500 / #FFF5E1 | 5.88 | #F5BF55 / #4A2F00 | 7.34 | PASS |
| `status/danger/fg` | `status/danger/bg` | text | 4.5:1 | #8F2020 / #FDECEC | 7.68 | #EC8888 / #4F1212 | 5.91 | PASS |
| `status/info/fg` | `status/info/bg` | text | 4.5:1 | #1C4A8B / #E8F1FC | 7.67 | #79A9EC / #0F2A50 | 5.93 | PASS |
| `status/neutral/fg` | `status/neutral/bg` | text | 4.5:1 | #414B5A / #EDF0F4 | 7.72 | #C9D1DA / #2A323E | 8.38 | PASS |
| `status/brand/fg` | `status/brand/bg` | text | 4.5:1 | #0A6669 / #E6F7F7 | 6.10 | #52C9CB / #052A2B | 7.71 | PASS |
| `status/policy/fg` | `status/policy/bg` | text | 4.5:1 | #523C93 / #F1EDFB | 7.52 | #A994E3 / #2C2052 | 5.60 | PASS |
| `status/decision/fg` | `status/decision/bg` | text | 4.5:1 | #1F3D6E / #EEF2F8 | 9.58 | #B3C2DB / #0B1A35 | 9.61 | PASS |
| `status/success/fg` | `surface/default` | text | 4.5:1 | #116338 / #FFFFFF | 7.33 | #69C493 / #1A2029 | 7.73 | PASS |
| `status/warning/fg` | `surface/default` | text | 4.5:1 | #855500 / #FFFFFF | 6.37 | #F5BF55 / #1A2029 | 9.72 | PASS |
| `status/danger/fg` | `surface/default` | text | 4.5:1 | #8F2020 / #FFFFFF | 8.77 | #EC8888 / #1A2029 | 6.58 | PASS |
| `status/info/fg` | `surface/default` | text | 4.5:1 | #1C4A8B / #FFFFFF | 8.74 | #79A9EC / #1A2029 | 6.78 | PASS |
| `status/neutral/fg` | `surface/default` | text | 4.5:1 | #414B5A / #FFFFFF | 8.83 | #C9D1DA / #1A2029 | 10.62 | PASS |
| `status/brand/fg` | `surface/default` | text | 4.5:1 | #0A6669 / #FFFFFF | 6.74 | #52C9CB / #1A2029 | 8.25 | PASS |
| `status/policy/fg` | `surface/default` | text | 4.5:1 | #523C93 / #FFFFFF | 8.65 | #A994E3 / #1A2029 | 6.26 | PASS |
| `status/decision/fg` | `surface/default` | text | 4.5:1 | #1F3D6E / #FFFFFF | 10.76 | #B3C2DB / #1A2029 | 9.09 | PASS |
| `text/primary` | `status/success/bg` | text | 4.5:1 | #1A2029 / #E7F6ED | 14.66 | #F5F7FA / #0A3A21 | 11.93 | PASS |
| `text/primary` | `status/warning/bg` | text | 4.5:1 | #1A2029 / #FFF5E1 | 15.13 | #F5F7FA / #4A2F00 | 11.53 | PASS |
| `text/primary` | `status/danger/bg` | text | 4.5:1 | #1A2029 / #FDECEC | 14.34 | #F5F7FA / #4F1212 | 13.71 | PASS |
| `text/primary` | `status/info/bg` | text | 4.5:1 | #1A2029 / #E8F1FC | 14.36 | #F5F7FA / #0F2A50 | 13.34 | PASS |
| `text/primary` | `status/neutral/bg` | text | 4.5:1 | #1A2029 / #EDF0F4 | 14.32 | #F5F7FA / #2A323E | 12.05 | PASS |
| `text/primary` | `status/brand/bg` | text | 4.5:1 | #1A2029 / #E6F7F7 | 14.82 | #F5F7FA / #052A2B | 14.26 | PASS |
| `text/primary` | `status/policy/bg` | text | 4.5:1 | #1A2029 / #F1EDFB | 14.23 | #F5F7FA / #2C2052 | 13.63 | PASS |
| `text/primary` | `status/decision/bg` | text | 4.5:1 | #1A2029 / #EEF2F8 | 14.57 | #F5F7FA / #0B1A35 | 16.13 | PASS |
| `text/secondary` | `status/success/bg` | text | 4.5:1 | #414B5A / #E7F6ED | 7.90 | #C9D1DA / #0A3A21 | 8.30 | PASS |
| `text/secondary` | `status/warning/bg` | text | 4.5:1 | #414B5A / #FFF5E1 | 8.16 | #C9D1DA / #4A2F00 | 8.02 | PASS |
| `text/secondary` | `status/danger/bg` | text | 4.5:1 | #414B5A / #FDECEC | 7.73 | #C9D1DA / #4F1212 | 9.54 | PASS |
| `text/secondary` | `status/info/bg` | text | 4.5:1 | #414B5A / #E8F1FC | 7.74 | #C9D1DA / #0F2A50 | 9.28 | PASS |
| `text/muted` | `surface/subtle` | text | 4.5:1 | #586476 / #F5F7FA | 5.59 | #A1ACB9 / #222932 | 6.37 | PASS |
| `text/secondary` | `surface/subtle` | text | 4.5:1 | #414B5A / #F5F7FA | 8.23 | #C9D1DA / #222932 | 9.51 | PASS |
| `text/muted` | `surface/raised` | text | 4.5:1 | #586476 / #FFFFFF | 6.00 | #A1ACB9 / #222932 | 6.37 | PASS |
| `text/muted` | `surface/selected` | text | 4.5:1 | #586476 / #E6F7F7 | 5.43 | #A1ACB9 / #052A2B | 6.64 | PASS |
| `status/brand/fg` | `surface/selected` | text | 4.5:1 | #0A6669 / #E6F7F7 | 6.10 | #52C9CB / #052A2B | 7.71 | PASS |
| `text/disabled` | `surface/disabled` | exempt | — | #A1ACB9 / #EDF0F4 | 2.02 | #586476 / #2A323E | 2.15 | exempt/decorative |
| `border/input` | `surface/default` | ui | 3:1 | #778395 / #FFFFFF | 3.84 | #778395 / #1A2029 | 4.26 | PASS |
| `border/strong` | `surface/default` | decor | — | #C9D1DA / #FFFFFF | 1.54 | #586476 / #1A2029 | 2.73 | exempt/decorative |
| `focus-ring` | `surface/default` | ui | 3:1 | #0E9CA0 / #FFFFFF | 3.34 | #52C9CB / #1A2029 | 8.25 | PASS |
| `focus-ring` | `surface/page` | ui | 3:1 | #0E9CA0 / #F5F7FA | 3.11 | #52C9CB / #11151B | 9.22 | PASS |
| `focus-ring` | `surface/brand` | ui | 3:1 | #0E9CA0 / #0B1A35 | 5.18 | #52C9CB / #071226 | 9.41 | PASS |
| `brand/accent` | `surface/default` | ui | 3:1 | #0B8084 / #FFFFFF | 4.73 | #22B3B6 / #1A2029 | 6.39 | PASS |
| `icon/default` | `surface/default` | ui | 3:1 | #414B5A / #FFFFFF | 8.83 | #C9D1DA / #1A2029 | 10.62 | PASS |
| `icon/muted` | `surface/default` | ui | 3:1 | #778395 / #FFFFFF | 3.84 | #778395 / #1A2029 | 4.26 | PASS |
| `icon/on-brand` | `surface/brand` | ui | 3:1 | #B3C2DB / #0B1A35 | 9.61 | #B3C2DB / #071226 | 10.37 | PASS |
| `icon/accent` | `surface/default` | ui | 3:1 | #0B8084 / #FFFFFF | 4.73 | #22B3B6 / #1A2029 | 6.39 | PASS |
| `icon/on-primary` | `brand/primary` | ui | 3:1 | #FFFFFF / #17305A | 13.07 | #11151B / #22B3B6 | 7.14 | PASS |
| `border/selected` | `surface/default` | ui | 3:1 | #0B8084 / #FFFFFF | 4.73 | #22B3B6 / #1A2029 | 6.39 | PASS |
| `brand/accent` | `surface/brand` | ui | 3:1 | #0B8084 / #0B1A35 | 3.66 | #22B3B6 / #071226 | 7.29 | PASS |
| `chart/series-1` | `surface/default` | ui | 3:1 | #0E9CA0 / #FFFFFF | 3.34 | #52C9CB / #1A2029 | 8.25 | PASS |
| `chart/series-2` | `surface/default` | ui | 3:1 | #2F4F82 / #FFFFFF | 8.20 | #8399BF / #1A2029 | 5.67 | PASS |
| `chart/series-3` | `surface/default` | ui | 3:1 | #7357C2 / #FFFFFF | 5.42 | #A994E3 / #1A2029 | 6.26 | PASS |
| `chart/series-4` | `surface/default` | ui | 3:1 | #DB6E2C / #FFFFFF | 3.34 | #F2AE7E / #1A2029 | 8.68 | PASS |
| `chart/series-5` | `surface/default` | ui | 3:1 | #C23F7E / #FFFFFF | 4.88 | #E58DB8 / #1A2029 | 6.89 | PASS |
| `chart/series-6` | `surface/default` | ui | 3:1 | #778395 / #FFFFFF | 3.84 | #A1ACB9 / #1A2029 | 7.11 | PASS |
| `chart/target` | `surface/default` | ui | 3:1 | #AD6F00 / #FFFFFF | 4.16 | #F5BF55 / #1A2029 | 9.72 | PASS |
| `status/success/solid` | `surface/default` | ui | 3:1 | #167E47 / #FFFFFF | 5.11 | #3DAF73 / #1A2029 | 5.91 | PASS |
| `status/warning/solid` | `surface/default` | ui | 3:1 | #AD6F00 / #FFFFFF | 4.16 | #EBA82B / #1A2029 | 7.93 | PASS |
| `status/danger/solid` | `surface/default` | ui | 3:1 | #B52A2A / #FFFFFF | 6.31 | #E36060 / #1A2029 | 4.76 | PASS |
| `status/info/solid` | `surface/default` | ui | 3:1 | #245EAF / #FFFFFF | 6.37 | #5390E0 / #1A2029 | 5.02 | PASS |
| `status/neutral/solid` | `surface/default` | ui | 3:1 | #586476 / #FFFFFF | 6.00 | #A1ACB9 / #1A2029 | 7.11 | PASS |
| `status/brand/solid` | `surface/default` | ui | 3:1 | #0B8084 / #FFFFFF | 4.73 | #22B3B6 / #1A2029 | 6.39 | PASS |
| `status/policy/solid` | `surface/default` | ui | 3:1 | #7357C2 / #FFFFFF | 5.42 | #A994E3 / #1A2029 | 6.26 | PASS |
| `status/decision/solid` | `surface/default` | ui | 3:1 | #2F4F82 / #FFFFFF | 8.20 | #8399BF / #1A2029 | 5.67 | PASS |

## 11. Phase 6 maintenance (DS Maintainer, 2026-10-21)

Script `scripts/ds/13-phase6-prep.js` (page 36:3; idempotent; no rebuild; no detaching; existing IDs kept).

| Item | Component | Change |
|---|---|---|
| P5 | Progress/Bar `51:1916` | New VARIANT axis **Percent** = 0, 5, …, 100 (Tone × Percent = 84). The 4 existing variants become `Percent=60` (IDs unchanged; legacy fill was ≈62 %). Root VERTICAL auto layout, default 320, `minWidth` 80; Labels row FILL (Label truncates to 1 line, Value hugs); Track FILL, 8 px, clips; Fill = Percent % of the track with constraint SCALE, so it keeps its ratio at any instance width. 0 % hides the Fill. The script returns a fit check (instance at 600 px, 45 % → Fill ≈ 270; switch to 80 %). |
| P3 | Dialog `53:1818` (+ Menu `51:1988`, Toast `53:2032`, Drawer `53:1846`) | `ds/Elevation/*` shadows use a negative spread, which Figma honours only with a visible fill **and** `clipsContent = true`; without clipping the shadow rendered as notches at the bottom corners. Elevated overlays now clip. Dialog also gets a 1 px `border/subtle` stroke so its edge reads on white. |
| P2 | Notice/Duplicate `55:2439`, Dialog | Scan for raw `[…]` copy, replaced with "What else may be shown is a pending policy decision (DEC-003)." if found. Expected result: none in components. The S4-N1 bracket text is **screen-level** (Dialog Description set in `dataentry/01-s4-business-form.js`); the Data Entry Agent fixes it. |
| P6 | Button `45:305` Size=Large | Every state checked ≥ 44 px (FIXED 48, `minHeight` 44). Medium = 40 and Small = 32, so use **Large** for mobile full-width actions (e.g. My Day Cancel). |
| P8 | Brand/Logo `44:342` | No `assets/` folder in the working directory, so the placeholder stays. |

**Screen usage after 13:**
- Progress: `setProperties({ Percent: '45' })`, then set Label and Value text and `layoutSizingHorizontal = 'FILL'`. Round to the nearest 5 %; the Value text states the exact figure. Owner dashboard bars use this instead of token-drawn rectangles.
- Re-lay-out existing instances (FIXED→FILL). Placed Progress/Bar instances now report `Percent=60` until set.

