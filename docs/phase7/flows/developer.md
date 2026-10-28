# Phase 7 — Developer flows (page 44 `96:6`)

Developer role agent, 2026-10-23. Updated for coordination [P7-1] D1–D6 and `docs/policy-defaults.md`. Scripts: `docs/phase7/scripts/developer/P44-00…04`. Where this differs from the tables below, **Resolutions (P7-1) and scripts** at the end takes precedence. Sources: `docs/phase7/brief.md`, `docs/phase6/interaction-spec.md` (Developer + P7), `docs/phase6/screens/developer-spec.md`, SCR-DEV rows of `docs/phase6/screen-register.md`, `docs/phase6/previews/44/index.md` + PNGs.

**Policy defaults (D5, `docs/policy-defaults.md`):**
- DEC-006 = **Alt B Owner verification**.
- F2 = **Automatic** provisioning at verified closure.
- F3 = the closure stays committed and the failure is shown to the Owner.
- DEC-005 = **Alt 1** assigned scoping access.

Every **default TBD** below is resolved in the Resolutions section.

## Conventions

- **Targets are frame names** (brief rule 2). IDs from `previews/44/index.md` are the fallback only.
- **Hotspot** = the visible label on the real button/link/row/tab. "row: X" means the table row (or its `Open` link) whose title starts with X.
- **Light frames only** (rule 4). No Dark frame is wired; no Developer flow is in the mobile-priority list, but the meeting journey has a mobile variant because desktop has no "saved" frame (see U-4).
- **Dialogs and drawers** are drawn as full-screen frames (board/detail behind the scrim), so they are wired as NAVIGATE, not overlays. Close / Cancel / × = BACK.
- **Transitions:** page → page `NAVIGATE · Dissolve 200 ms`; open dialog/drawer `NAVIGATE · Dissolve 150 ms`; close `BACK`; cross-page `OPEN_URL` (new tab off).
- Frame-name prefix abbreviations used in the tables below (expand to the full name when scripting):
  - `DEV-001 L` = `SCR-DEV-001 — Deals — Desktop — Light`
  - `DEV-002 L` = `SCR-DEV-002 — Deal record detail — Desktop — Light`
  - `DEV-003 L` = `SCR-DEV-003 — Meetings & calendar — Desktop — Light`; `DEV-003 M` = `… — Mobile — Light`
  - `DEV-004 Outcome` = `SCR-DEV-004 — Meeting schedule / record — Desktop — Light — Record outcome`; `DEV-004 M Outcome` = `… — Mobile — Light — Record outcome`; `DEV-004 M Saved` = `… — Mobile — Light — Outcome saved (agenda + toast)`; `DEV-004 Reschedule` = `… — Desktop — Light — Reschedule`; `DEV-004 M Reschedule` = `… — Mobile — Light — Reschedule`
  - `DEV-005 L` = `SCR-DEV-005 — Projects — Desktop — Light`
  - `DEV-006 L` = `SCR-DEV-006 — Project board — Desktop — Light`; `DEV-006 P7` = `… — Light — Record delivered: open-task warning`; `DEV-006 Waiting` = `… — Light — Waiting for client (note required)`; `DEV-006 Blocked` = `… — Light — Blocked (reason required)`; `DEV-006 Completed` = `… — Light — Completed (read-only)`; `DEV-006 M` = `… — Mobile — Light`
  - `DEV-007 L` = `SCR-DEV-007 — Task detail — Desktop — Light`; `DEV-007 Error` = `… — Light — Validation error`; `DEV-007 Conflict` = `… — Light — Save conflict`; `DEV-007 Success` = `… — Light — Success`
  - `DEV-008 Confirm` = `SCR-DEV-008 — Finalize closure — Desktop — Light — Confirm (DEC-006 Alt A, not selected)`; `DEV-008 F3` = `… — Light — Closed, provisioning failed (F3)`; `DEV-008 Success` = `… — Light — Success (F2 Automatic vs Manual)`; `DEV-008 AltB` = `… — Light — Request verification (DEC-006 Alt B, not selected)`

## Shared sidebar (every desktop Light frame wired below)

| frame | hotspot | action | target | transition |
|---|---|---|---|---|
| any wired DEV desktop Light frame | sidebar `Deals` | NAVIGATE | DEV-001 L | Dissolve 200 ms |
| same | sidebar `Meetings & Calendar` | NAVIGATE | DEV-003 L | Dissolve 200 ms |
| same | sidebar `Projects` | NAVIGATE | DEV-005 L | Dissolve 200 ms |

`My Day`, `My Attendance`, `My Profile` (page 40) are owned by the Shared flows; if wired, they are OPEN_URL to the SHR frames. Not in this file's scope.

---

## Flow 1 — `P7 — Developer — Deals and closure`

**Start frame:** DEV-001 L (`171:11591`).

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DEV-001 L | tab `Closed deals 5` (active) | none — already shown; list holds closed deals only (RW-01) | — | — |
| 2 | DEV-001 L | row `Nova Dental Clinic` / `Open` (and any other row's `Open`) | NAVIGATE | DEV-002 L | Dissolve 200 ms — **see U-1** |
| 3 | DEV-002 L | breadcrumb `Deals` | NAVIGATE | DEV-001 L | Dissolve 200 ms |
| 4 | DEV-002 L | `Finalize closure…` (Closure card) | NAVIGATE | DEV-008 Confirm | Dissolve 150 ms — **default TBD (DEC-006 Alt A vs Alt B)** |
| 4b | DEV-002 L | `Request closure verification` | NAVIGATE | DEV-008 AltB | Dissolve 150 ms — **default TBD (DEC-006)**; wire only if the default is Alt B, else leave unwired |
| 5 | DEV-008 Confirm | `Cancel` / `×` | BACK | (DEV-002 L) | — |
| 6 | DEV-008 Confirm | `Finalize closure` (primary) | NAVIGATE | DEV-008 Success | Dissolve 150 ms — happy path; F3 is Flow 1b (**U-2**) |
| 7 | DEV-008 Success | `Create project board` (If F2 Manual card) | NAVIGATE | DEV-006 L | Dissolve 200 ms — **default TBD (F2)**; leave unwired if F2 default is Automatic |
| 8 | DEV-008 Success | `Open project board (pending)` | none — disabled by design | — | — |
| 9 | DEV-008 Success | `Close` / `×` | NAVIGATE | DEV-001 L | Dissolve 200 ms — **U-3** (no closed-detail frame without a dialog) |
| 10 | DEV-008 Success (background) | closure actions | verify: none offered on the closed deal (Closure card shows "Closed 20 Oct 2026, 09:42", only a disabled "Open project board (pending)"); `Mark not proceeding…` absent | — | check only |

### Flow 1b — `P7 — Developer — Finalize closure (F3 failure)`

**Start frame:** DEV-008 Confirm (`321:13122`) — second flow start on the same frame is not possible in Figma for the same hotspot, so this flow **starts at DEV-008 F3** (`321:14318`) and is reviewed as the failure branch (**U-2**).

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DEV-008 F3 | (verify) green "Closure saved…" + red "project board could not be created" banners; `F3 Proposed` chip; text points to SCR-OWN-012 | check only | — | — |
| 2 | DEV-008 F3 | `Back to deal` | NAVIGATE | DEV-001 L | Dissolve 200 ms — **U-3** |
| 3 | DEV-008 F3 | `×` | NAVIGATE | DEV-001 L | Dissolve 200 ms — **U-3** |
| 4 | DEV-008 F3 (background) | closure actions | verify: none offered; Closed deal badge; no `Mark not proceeding…` | — | check only |

---

## Flow 2 — `P7 — Developer — Record meeting outcome`

**Start frame:** DEV-003 L (`233:13090`).

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DEV-003 L | week event `11:00 Outcome due · Sunrise Bakery` (Mon 19) | NAVIGATE | DEV-004 Outcome | Dissolve 150 ms |
| 2 | DEV-003 L | week event `Peak Fitness` (Wed 21, Scheduled) | NAVIGATE | DEV-004 Reschedule | Dissolve 150 ms (optional branch) |
| 3 | DEV-003 L | `Schedule meeting` | none — **default TBD (DEC-005 Alt 1 only)**; no Schedule-new frame drawn (D-3) | — | — |
| 4 | DEV-004 Outcome | `Held` / `Missed (no-show)` radio cards | none — Held is pre-selected; no Missed-selected frame | — | — |
| 5 | DEV-004 Outcome | `Close` / `×` | BACK | (DEV-003 L) | — |
| 6 | DEV-004 Outcome | `Save outcome` | NAVIGATE | DEV-003 L | Dissolve 200 ms — **U-4** (no desktop saved/toast frame; event still reads "Outcome due") |
| 7 | DEV-004 Reschedule | `Close` / `×` | BACK | (DEV-003 L) | — |
| 8 | DEV-004 Reschedule | `Save` (primary) | NAVIGATE | `SCR-DEV-004 — … — Desktop — Light — Validation error` | Dissolve 150 ms — optional, shows the error state |

### Flow 2m — `P7 — Developer — Record meeting outcome (mobile)`

**Start frame:** DEV-003 M (`233:13882`). This is the only path that ends on a saved state.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DEV-003 M | row `Sunrise Bakery — scope call` (Needs an outcome) | NAVIGATE | DEV-004 M Outcome | Dissolve 200 ms |
| 2 | DEV-003 M | row `Peak Fitness Gym — Member app kickoff` | NAVIGATE | DEV-004 M Reschedule | Dissolve 200 ms (optional) |
| 3 | DEV-004 M Outcome | header Back `<` | BACK | (DEV-003 M) | — |
| 4 | DEV-004 M Outcome | `Save outcome` (sticky) | NAVIGATE | DEV-004 M Saved | Dissolve 200 ms |
| 5 | DEV-004 M Saved | toast `×` | NAVIGATE | DEV-003 M | Dissolve 200 ms — **U-5** (DEV-003 M still lists Sunrise under "Needs an outcome") |

---

## Flow 3 — `P7 — Developer — Project delivery`

**Start frame:** DEV-005 L (`235:13090`).

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DEV-005 L | row `Glow Beauty Salon` / `Open board` | NAVIGATE | DEV-006 L | Dissolve 200 ms |
| 2 | DEV-005 L | row `Urban Cuts Barbershop` / `Open board` | NAVIGATE | DEV-006 Completed | Dissolve 200 ms (read-only check) |
| 3 | DEV-005 L | rows `Harbor Auto Care`, `Lumen Yoga Studio` / `Open board` | none — no desktop board drawn for them (**U-6**) | — | — |
| 4 | DEV-005 L | info banner (Nova Dental) | NAVIGATE | DEV-002 L | Dissolve 200 ms — **U-1** (banner deal is Nova; DEV-002 L shows Cedar) |
| 5 | DEV-006 L | breadcrumb `Projects` | NAVIGATE | DEV-005 L | Dissolve 200 ms |
| 6 | DEV-006 L | card `Content upload` (To do) | NAVIGATE | DEV-007 L | Dissolve 150 ms |
| 7 | DEV-007 L | `Close` / `×` | BACK | (DEV-006 L) | — |
| 8 | DEV-007 L | `Save changes` | NAVIGATE | DEV-007 Success | Dissolve 150 ms (card due 30 Oct, toast "Project status unchanged") |
| 9 | DEV-007 L | `Cancel task…` | NAVIGATE | DEV-007 Error | Dissolve 150 ms — shows "Cancelled needs a reason" (**U-7**) |
| 10 | DEV-007 Error | `Close` / `×` | BACK | (DEV-007 L) | — |
| 11 | DEV-007 Success | toast `×` | NAVIGATE | DEV-006 L | Dissolve 150 ms |
| 12 | DEV-007 Success | card `Content upload` | NAVIGATE | DEV-007 L | Dissolve 150 ms |
| 13 | DEV-006 L | `Waiting for client…` | NAVIGATE | DEV-006 Waiting | Dissolve 150 ms |
| 14 | DEV-006 Waiting | `Cancel` / `×` | BACK | (DEV-006 L) | — |
| 15 | DEV-006 Waiting | `Set Waiting for client` | NAVIGATE | DEV-006 L | Dissolve 150 ms — **U-8** (no "Waiting for client" board frame) |
| 16 | DEV-006 L | `Blocked…` | NAVIGATE | DEV-006 Blocked | Dissolve 150 ms |
| 17 | DEV-006 Blocked | `Cancel` / `×` | BACK | (DEV-006 L) | — |
| 18 | DEV-006 Blocked | `Set Blocked` | NAVIGATE | DEV-006 L | Dissolve 150 ms — **U-8** |
| 19 | DEV-006 L | `Back to Scheduled` | none — applies directly; no Scheduled board frame | — | — |
| 20 | DEV-006 L | `Record delivered` | NAVIGATE | DEV-006 P7 | Dissolve 150 ms — **P7 check 1** (3 open tasks → dialog appears) |
| 21 | DEV-006 P7 | `Cancel` / `×` | BACK | (DEV-006 L) | — **P7 check 3**: status stays In progress |
| 22 | DEV-006 P7 | `Review open tasks` | NAVIGATE | DEV-006 L | Dissolve 150 ms — **U-9** (no filtered board frame) |
| 23 | DEV-006 P7 | `Record delivered` (primary) | NAVIGATE | DEV-006 L | Dissolve 150 ms — **U-9 / P7 check 4 blocked** (no Delivered board + toast frame) |
| 24 | DEV-006 L | rail `Open deal DL-0031` | NAVIGATE | DEV-002 L | Dissolve 200 ms — **U-1** (DL-0031 Glow vs DL-0033 Cedar) |
| 25 | DEV-006 L | `Edit schedule` | none — drawer not drawn (D-3) | — | — |
| 26 | DEV-006 Completed | `Move project to` buttons | verify all disabled; no reactions | — | check only |

### P7 verification matrix (interaction-spec "Phase 7 checks")

| check | how in prototype | status |
|---|---|---|
| 1. Open tasks → dialog appears | step 20 | verifiable |
| 2. No open tasks → no dialog, toast | no frame with a zero-open-task board or "Project delivered" toast | **not verifiable — U-9** |
| 3. Cancel → stays In progress | step 21 (BACK to DEV-006 L, badge In progress) | verifiable |
| 4. Confirm changes only project status; tasks keep columns | needs a Delivered board frame (same kanban, badge Delivered, toast "Project delivered · 3 tasks still open") | **not verifiable — U-9**; needs a connector frame (orchestrator approval, brief §Scope) |

---

## Flow 4 — `P7 — Developer — Request correction`

Cross-page: OPEN_URL to page 42. Desktop target `SCR-SHR-009 — Submit data correction (drawer) — Desktop — Light — Open request warning` (`310:13530`): `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=310-13530`. Mobile target `SCR-SHR-009 — … — Mobile — Light — Sheet` (`310:14186`): `…?node-id=310-14186`.

**Start frame:** DEV-002 L (`263:13122`).

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DEV-002 L | `Request correction` (Business context head) | OPEN_URL | SHR-009 desktop (310-13530) | — |
| 2 | DEV-006 L | rail `Request correction` ("Business details wrong?") | OPEN_URL | SHR-009 desktop (310-13530) | — |
| 3 | DEV-004 Reschedule | `Request correction` link row | OPEN_URL | SHR-009 desktop (310-13530) | — |
| 4 | DEV-006 M | `Request correction` (48 px button) | OPEN_URL | SHR-009 mobile (310-14186) | — |
| 5 | DEV-004 M Reschedule | `Request correction` (48 px Ghost) | OPEN_URL | SHR-009 mobile (310-14186) | — |
| 6 | DEV-008 F3 / Success (background) | `Request correction` | none — behind the dialog scrim | — | — |

SCR-SHR-008 (`Business detail — Desktop — Light — Developer context-limited`, `310:12724`) has no Developer hotspot in the spec; not wired (**U-10**).

---

## Unclear hotspots / gaps (for orchestrator)

- **U-1** No closed-deal detail frame exists. DEV-002 L is Cedar (DL-0033, "Signed and paid · awaiting closure"), which is not in the Closed deals list, and rows/`Open deal DL-0031`/the Nova banner all point at different deals. Proposed: wire every `Open` to DEV-002 L and accept the data mismatch, or approve one connector frame.
- **U-2** One `Finalize closure` button cannot branch to both Success and F3. Proposed: button → Success; F3 shown as its own flow start (Flow 1b). Which outcome the button simulates is **default TBD** (F2/F3).
- **U-3** After closure, `Close` / `Back to deal` has no closed-detail frame without a dialog. Proposed: NAVIGATE to DEV-001 L (Cedar not listed there either).
- **U-4** No desktop "Outcome saved" frame (D-3). Desktop Save outcome → DEV-003 L, which still shows "Outcome due". Mobile Flow 2m covers the saved state.
- **U-5** DEV-003 M still shows Sunrise under "Needs an outcome" after save; toast `×` target may be better left unwired.
- **U-6** No desktop boards for Harbor / Lumen; their `Open board` stays unwired (DEV-006 M is Harbor-like mobile only — confirm).
- **U-7** `Cancel task…` → Validation error is a stretch; the error frame shows Cancelled without reason. Confirm or leave unwired.
- **U-8** No board frames for Waiting for client / Blocked after confirm; returns to In progress board. Blocked primary is `Set Blocked` (checked).
- **U-9** P7 checks 2 and 4 need a Delivered board + toast frame (and a zero-open-task board). Needs orchestrator-approved connector frame(s).
- **U-10** SCR-SHR-009 desktop target is the "Open request warning" state, not a clean drawer; confirm acceptable. SHR-008 not used.
- Policy: `docs/policy-defaults.md` missing → DEC-006 (step 1.4/4b), F2 (1.7), DEC-005 (2.3) are **default TBD**.

---

## Resolutions (P7-1) and scripts

Applied 2026-10-23 by the Developer role agent. The decisions come from coordination [P7-1] D1–D6, and the policy working defaults come from D5. Phase 6 labels such as "(DEC-006 Alt B, not selected)" stay as drawn (brief rule 6); correcting them is Phase 8 work.

### Policy-driven changes to the tables

**Flow 1 follows DEC-006 Alt B.** The main path is:
1. DEV-001 L → tab `Accepted opportunities` (DEC-005 Alt 1)
2. → row `Cedar Home Realty` → DEV-002 L
3. → `Request closure verification` → DEV-008 AltB
4. → `Send for verification` → DEV-002 L. Under D2 there is no "verification requested" frame, and the stage correctly stays Signed and paid.

`Cancel` / `×` = BACK. Under D3, the Closed-tab rows (Nova, Glow, …) also open DEV-002 L.

**Not wired:**
- Steps 1.4–1.6 (`Finalize closure…` → DEV-008 Confirm). This is the Alt A dialog, and Alt A is not the working default. Under Alt B the Owner finalizes, which is the Owner flow.
- Step 1.7 `Create project board` (the F2 Manual card), because F2 is Automatic.

**D1 alternative flows.** Each one starts where its branch happens:
- `P7 — Developer — Deals and closure (verification rejected)` starts at DEV-002 Verification rejected (263:13954). `Request closure verification` → DEV-008 AltB; breadcrumb `Deals` → DEV-001 L.
- `P7 — Developer — Deals and closure (closed, F2 automatic)` starts at DEV-008 Success (321:14696). `Close` / `×` → DEV-001 L (U-3).
- `P7 — Developer — Deals and closure (F3 failure)` starts at DEV-008 F3 (321:14318). `Back to deal` / `×` → DEV-001 L (U-3). This replaces the start note for Flow 1b.

**DEC-005 Alt 1:**
- On DEV-001 Accepted opportunities (171:11998), tab `Closed deals` → DEV-001 L.
- Row `Peak Fitness Gym` → DEV-002 Accepted opportunity (263:13597). Its breadcrumb `Deals` goes back.
- Step 2.3 `Schedule meeting` is shown under Alt 1 but has no schedule-new frame, so it stays **unwired**. Under D2 the only nearby frame is the Peak Reschedule drawer, which would be misleading. Logged as a Phase 8 item.

### Gap decisions (U-1…U-10)

| U | decision | result |
|---|---|---|
| U-1 | D3 | Every deal link opens DEV-002 L (Cedar). Phase 8 item: data mismatch (Nova/Glow rows, `Open deal DL-0031`, Nova banner). |
| U-2 | D1 | `Finalize closure` is not wired (Alt A). Success and F3 are separate flows. |
| U-3 | D2 | Close / Back to deal → DEV-001 L. |
| U-4 | D2 | Desktop `Save outcome` → DEV-003 L. The mobile flow shows the saved state. |
| U-5 | D2 | Toast `×` → DEV-003 M (wired). Phase 8 item: the agenda still lists Sunrise under "Needs an outcome". |
| U-6 | D2 | Harbor / Lumen `Open board` stay unwired. |
| U-7 | D2 | `Cancel task…` → DEV-007 Validation error. It is the closest frame and shows the reason-required error. |
| U-8 | D2 | `Set Waiting for client` / `Set Blocked` → DEV-006 L. |
| U-9 | D2 exception | Connector frame `SCR-DEV-006 — Project board — Desktop — Light — Delivered (P7 connector)`, built by P44-00. P7 `Record delivered` → connector. `Review open tasks` → DEV-006 L (there is no filtered board). |
| U-10 | D4 | Desktop Request correction → SHR-009 Open request warning (310:13530) via OPEN_URL; mobile → 310:14186. SHR-008 is not used. |
| RadioCards (Held/Missed) | D6 | No reaction. |

### P7 verification matrix (updated)

| check | prototype path | status |
|---|---|---|
| 1 open tasks → dialog | DEV-006 L `Record delivered` → P7 frame | verifiable |
| 2 no open tasks → no dialog | There is no zero-open-task board, and D2 allows only the Delivered connector. | **not verifiable**. The reviewer reads the I2 annotation; Phase 8 item. |
| 3 Cancel → stays In progress | P7 `Cancel` / `×` = BACK → DEV-006 L (badge In progress) | verifiable |
| 4 confirm → status only | P7 `Record delivered` → connector: badge Delivered, toast "Project delivered · 3 tasks still open", kanban identical to DEV-006 L | verifiable after P44-00 runs |

**Connector content (P44-00).** The frame is a clone of DEV-006 L (228:13090), placed at the right end of the SCR-DEV-006 section. The section is never moved; it is widened only if needed. Changes from the source:
- Badges are set to Delivered (Tone Info, as on SCR-DEV-005).
- The since caption reads 23 Oct 2026.
- Waiting / Blocked / Back to Scheduled are hidden.
- `Record delivered` is relabelled `Record completed`.
- The rule caption is updated.
- A DS Toast (Success) instance is added.

No instance-child geometry is changed, nothing is detached, and no new components are created. A re-run reuses the frame and deletes nothing.

### Scripts and run order (page 44, `96:6`)

| order | script | content | flows |
|---|---|---|---|
| 1 | `P44-00-connectors.js` | Delivered (P7 connector) frame | — |
| 2 | `P44-01-deals-closure.js` | Flow 1 + 3 alternative flows | Deals and closure; (verification rejected); (closed, F2 automatic); (F3 failure) |
| 3 | `P44-02-meetings.js` | Flow 2, 2m | Record meeting outcome; (mobile) |
| 4 | `P44-03-project-delivery.js` | Flow 3 + P7 | Project delivery; (P7 Record delivered check) |
| 5 | `P44-04-sidebar-correction.js` | Sidebar on 10 desktop Light frames + Flow 4 | Request correction; (mobile) |

What every script does:
- inlines `wiring-helpers.js` and sets the page once;
- finds frames by name, falling back to the Phase 6 ID;
- scopes dialog and drawer hotspots to the overlay instance, so the cloned board behind it is never wired;
- removes auto "Flow N" starts, but only on frames it touched;
- returns `{wired, missingTargets, missingHotspots, flows, errors}`.

Hotspot sets do not overlap between scripts.

Checks: all five pass `node --check` (async-wrapped), and a run against a stub `figma` raised no errors. Each script is 7–10k characters.

The scripts assume these layer names from the Phase 6 builders:
- `Row · …`, `Event · …`, `Agenda row · …`
- `Button · <label>`, `Link · <label>`
- `Card/Task · …`, `Nav/Item · …`, `Breadcrumb`
- dialog `Primary action` / `Secondary action`
- the overlay or toast close instance (`/close/i`, excluding `Button · …`)

A missing layer is reported in `missingHotspots` and not worked around.
