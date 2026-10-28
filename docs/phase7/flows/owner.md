# Phase 7 — Owner/Admin flow map (page 41 `96:3`)

Owner role agent, 2026-10-23 (rev. 2, after P7-1 and the orchestrator's answers). The wiring scripts are written; see **Scripts and run order** at the end. No Figma calls were made. Hotspots come from the OP-13/OP-14 previews in `docs/phase6/previews/41/` and from the layer names used by the Phase 6 builders (`Button · X`, `Item · X`, `Filter · X`, `Banner · X` › `Action`, `Toast · X`, `Dialog · X`, `Drawer · X`, and `Nav/Item · X` in `Shell/Desktop · Owner`).

Sources: `docs/phase7/brief.md` (P7-1), `docs/phase6/interaction-spec.md` (Owner + Shared), `docs/phase6/screens/owner-spec.md`, SCR-OWN rows of `docs/phase6/screen-register.md`, `docs/phase6/previews/41/index.md`, `docs/phase3-4/sitemap.md` §3.1.

## Conventions

- **Targets are frame names.** The scripts look them up by name on page 41. The ID in brackets is a fallback only, from the previews index (2026-10-22/23). Note that the OWN-003 frames are named `Employee create / edit` (with spaces around the slash); the PNG files say `create-edit`.
- **Prefix.** `OWN-nnn` below is short for `SCR-OWN-nnn — <screen name> — Desktop — Light`. A suffix such as `· Edit` stands for `— Edit`. Full names are in the frame index at the end.
- **Actions.**
  - Drawers, dialogs and toasts are drawn as full frames (each one is a clone of its backdrop screen). So every move between them is a **NAVIGATE**, not an overlay. SWAP is not used.
  - **BACK** is used for Close, Cancel and ✕ where the previous frame is the natural return.
  - **OPEN_URL** is used for any target that is not on page 41. The URL is `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=<id with ->`.
- **Transitions.**
  - `Instant`: sidebar and tab navigation.
  - `Dissolve 200ms`: opening or closing a drawer or dialog, and moving to a result state (toast, banner).
  - `Smart animate 250ms`: in-place state changes on the same layout, such as the radio and select choices on OWN-008.
  - OPEN_URL has no transition.
- **Theme.** Light frames only (brief rule 4). Page 41 has no mobile-priority dark flow, and the OWN-004 mobile frames are out of the desktop journeys.
- **Policy defaults.** `docs/policy-defaults.md` now exists (P7-1 D5). **DEC-011 → Alt B**: the employee requests, and the Owner approves or rejects (the Owner may also adjust directly). DEC-009 stays unwired, because there is no selected-state frame (D6).
- **Flow names** use `P7 — Owner — <journey>`. Each alternative outcome gets its own start, `P7 — Owner — <journey> (<alt>)` (D1).

### Cross-page URLs used (OPEN_URL)

| Target | Frame | id |
|---|---|---|
| Businesses | SCR-DE-001 — Business directory — Desktop — Light | 165:81145 |
| Correction Requests | SCR-DE-006 — Correction-request queue — Desktop — Light | 308:13955 |
| Categories | SCR-DE-007 — Categories — Desktop — Light | 178:11715 |
| Follow-ups & Calendar | SCR-CC-004 — Follow-ups & calendar — Desktop — Light | 285:13809 |
| Open agent queue | SCR-CC-001 — Calling queue — Desktop — Light | 311:13767 |
| Opportunities & handoffs tab | SCR-CC-007 — Opportunities & developer handoff — Desktop — Light | 316:13709 |
| Do-not-call list tab | SCR-CC-008 — Do-not-call list & reopening — Desktop — Light | 316:15211 |
| Deals & Meetings | SCR-DEV-001 — Deals — Desktop — Light | 171:11591 |
| Projects | SCR-DEV-005 — Projects — Desktop — Light | 235:13090 |
| Deal record (F3 retry target) | SCR-DEV-002 — Deal record detail — Desktop — Light | 263:13122 |
| My Day (check in) | SCR-SHR-001 — My Day — Desktop — Light | 303:10513 |
| My Profile | SCR-SHR-006 — My Profile — Desktop — Light | 189:10468 |
| Notifications bell | SCR-SHR-007 — Notifications — Desktop — Light | 165:2880 |

IDs re-checked on 2026-10-23 against the current `docs/phase6/previews/{40,42,43,44,45}/index.md`: all unchanged (SHR-007 is on page 45). OPEN_URL needs an ID, so these are hard-coded in each script's `XP` table.

## Global — shell navigation (applies to every Light frame on page 41)

The hotspots are the `Shell/Desktop` Owner nav items (instance children; reactions are set as overrides) and the TopBar. Every Light frame in the index gets these. The active item on its own screen may keep its reaction; that is harmless.

| Hotspot | Action | Target | Transition |
|---|---|---|---|
| Dashboard | NAVIGATE | OWN-001 Owner dashboard | Instant |
| Attendance | NAVIGATE | OWN-004 Attendance monitoring & exception alerts | Instant |
| Employees | NAVIGATE | OWN-002 Employees | Instant |
| Targets & Work Lists | NAVIGATE | OWN-006 Targets & work lists | Instant |
| Businesses | OPEN_URL | SCR-DE-001 (165-81145) | — |
| Correction Requests | OPEN_URL | SCR-DE-006 (308-13955) | — |
| Categories | OPEN_URL | SCR-DE-007 (178-11715) | — |
| Calling Assignments | NAVIGATE | OWN-007 Calling assignments | Instant |
| Follow-ups & Calendar | OPEN_URL | SCR-CC-004 (285-13809) | — |
| Deals & Meetings | OPEN_URL | SCR-DEV-001 (171-11591) | — |
| Projects | OPEN_URL | SCR-DEV-005 (235-13090) | — |
| Reports & Exports | NAVIGATE | OWN-009 Reports & exports | Instant |
| Audit Log | NAVIGATE | OWN-010 Audit log explorer | Instant |
| Delivery Monitor | NAVIGATE | OWN-012 Delivery & exception monitor | Instant |
| Settings | NAVIGATE | OWN-011 Settings | Instant |
| My Day (check in) | OPEN_URL | SCR-SHR-001 (303-10513) | — |
| My Profile | OPEN_URL | SCR-SHR-006 (189-10468) | — |
| TopBar bell | OPEN_URL | SCR-SHR-007 (165-2880) | — |
| TopBar "Checked in · 08:52" chip | OPEN_URL | SCR-SHR-001 (303-10513) | — |

---

## 1. P7 — Owner — Dashboard drill-downs

**Start:** `SCR-OWN-001 — Owner dashboard — Desktop — Light` (200:22902). This is a hub: every step starts from OWN-001, and the Global nav returns to it.

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 1.1 | OWN-001 | "Open attendance" (Attendance today card) | NAVIGATE | OWN-004 Attendance monitoring & exception alerts | Dissolve 200ms |
| 1.2 | OWN-001 | "Open report" (Calling activity card) | NAVIGATE | OWN-009 Reports & exports | Dissolve 200ms |
| 1.3 | OWN-001 | "Delivery monitor" (Exceptions card) | NAVIGATE | OWN-012 Delivery & exception monitor | Dissolve 200ms |
| 1.4 | OWN-001 | Exceptions › Missing checkout "Review" | NAVIGATE | OWN-004 · Exception detail | Dissolve 200ms |
| 1.5 | OWN-001 | Exceptions › Reminder failed "Send again" | NAVIGATE | OWN-012 · Failed item detail | Dissolve 200ms |
| 1.6 | OWN-001 | Exceptions › Reminder suppressed "Send again" | NAVIGATE | OWN-012 Delivery & exception monitor | Dissolve 200ms |
| 1.7 | OWN-001 | Exceptions › Notification failed "View" | NAVIGATE | OWN-012 Delivery & exception monitor | Dissolve 200ms |
| 1.8 | OWN-001 | "Open list" (Businesses · now card) | OPEN_URL | SCR-DE-001 (165-81145) | — |
| 1.9 | OWN-001 | "Deals & meetings" (Pipeline events card) | OPEN_URL | SCR-DEV-001 (171-11591) | — |
| 1.10 | OWN-001 | "Targets & work lists" (Targets · today card) | NAVIGATE | OWN-006 Targets & work lists | Dissolve 200ms |
| 1.11 | OWN-001 | "Export" (header button) | NAVIGATE | OWN-009 Reports & exports | Dissolve 200ms |
| 1.12 | OWN-001 · Partial data | "Retry" (Calling card) | NAVIGATE | OWN-001 | Dissolve 200ms |

Alt flow (D1): `P7 — Owner — Dashboard drill-downs (Partial data retry)` starts at OWN-001 · Partial data.

Notes:
- Step 1.5 has no "reminder re-sent" toast frame. The interaction spec says Send again "creates a new reminder", so the step lands on the detail drawer, whose primary action is "Send again (new reminder)".
- The period segmented control, the date range, Compare, and the Role/Employee filters are not wired. There is no per-filter frame.
- Loading, No data and Partial data are reference states. Only the Retry in 1.12 is wired, so that the reviewer can see a failed card recover.

## 2. P7 — Owner — Employees: add/edit drawer → deactivate

**Start:** `SCR-OWN-002 — Employees — Desktop — Light` (201:22895).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 2.1 | OWN-002 | "Add employee" | NAVIGATE | OWN-003 Employee create / edit · Create new | Dissolve 200ms |
| 2.2 | OWN-003 · Create new | "Create employee" | NAVIGATE | OWN-003 · Validation error, duplicate email | Dissolve 200ms |
| 2.3 | OWN-003 · Validation error, duplicate email | "Cancel" / ✕ | NAVIGATE | OWN-002 | Dissolve 200ms |
| 2.4 | OWN-003 · Create new | "Cancel" / ✕ | BACK | (OWN-002) | Dissolve 200ms |
| 2.5 | OWN-002 | Maya Khoury row (or its ⋯) | NAVIGATE | OWN-003 · Edit | Dissolve 200ms |
| 2.6 | OWN-003 · Edit | "Save changes" | NAVIGATE | OWN-003 · Success | Dissolve 200ms |
| 2.7 | OWN-003 · Edit | "Send reset link" | NAVIGATE | OWN-003 · Success | Dissolve 200ms |
| 2.8 | OWN-003 · Edit | "Change role…" | NAVIGATE | OWN-003 · Change role | Dissolve 200ms |
| 2.9 | OWN-003 · Change role | Cancel / ✕ | BACK | (OWN-003 · Edit) | Dissolve 200ms |
| 2.10 | OWN-003 · Edit | "Deactivate…" | NAVIGATE | OWN-003 · Deactivate impact | Dissolve 200ms |
| 2.11 | OWN-003 · Deactivate impact | "Cancel" / ✕ | BACK | (previous) | Dissolve 200ms |
| 2.12 | OWN-003 · Deactivate impact | "Deactivate and revoke sessions" | NAVIGATE | OWN-002 · Deactivated, assignee inactive | Dissolve 200ms |
| 2.13 | OWN-002 · Deactivated, assignee inactive | "Open calling assignments" (warning banner) | NAVIGATE | OWN-007 · Needs decision, B7 and inactive agent | Dissolve 200ms |
| 2.14 | OWN-002 | Omar Nassar row ⋯ | NAVIGATE | OWN-003 · Deactivate impact | Dissolve 200ms |
| 2.15 | OWN-003 · Edit | "Cancel" / ✕ | BACK | (OWN-002) | Dissolve 200ms |
| 2.16 | OWN-003 · Success | toast ✕ (either toast) | NAVIGATE | OWN-002 | Dissolve 200ms |
| 2.9b | OWN-003 · Change role | confirm ("Change role") | NAVIGATE | OWN-002 (closest frame, D2) | Dissolve 200ms |
| 2.17 | OWN-003 · Save conflict | "Review changes" | NAVIGATE | OWN-003 · Edit | Dissolve 200ms |

Notes:
- **Subject mismatch (Phase 8 item, left as is).** The Edit drawer shows Maya Khoury, but the Deactivate-impact dialog shows Omar Nassar. Step 2.10 still goes there, and step 2.14 gives a direct path for Omar.
- The ✕ icons are not wired on their own; Cancel carries the close action.
- **Change role.** The Change role frame was not inspected in detail. Its confirm button label is to be checked by the script (`missingHotspots` if it is not found). The confirm returns to OWN-002, because there is no role-changed frame.
- **Save conflict.** "OWN-003 · Save conflict" is a reference state. It is not on the main path. Optionally, its "Review changes" can NAVIGATE to OWN-003 · Edit.

## 3. P7 — Owner — Attendance exception → correction review

**Start:** `SCR-OWN-004 — Attendance monitoring & exception alerts — Desktop — Light` (287:22811).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 3.1 | OWN-004 | Exceptions › Missing checkout "Review" | NAVIGATE | OWN-004 · Exception detail | Dissolve 200ms |
| 3.2 | OWN-004 | Omar Nassar table row | NAVIGATE | OWN-004 · Exception detail | Dissolve 200ms |
| 3.3 | OWN-004 | Exceptions › Alert not delivered "View" | NAVIGATE | OWN-012 Delivery & exception monitor | Dissolve 200ms |
| 3.4 | OWN-004 | "Corrections & review" (header button) | NAVIGATE | OWN-005 Attendance corrections & review queue | Instant |
| 3.5 | OWN-004 · Exception detail | "Close" / ✕ | BACK | (OWN-004) | Dissolve 200ms |
| 3.6 | OWN-004 · Exception detail | "Correct session" | NAVIGATE | OWN-005 Attendance corrections & review queue | Dissolve 200ms |
| 3.7 | OWN-005 | Missing checkout queue item (Omar) | NAVIGATE | OWN-005 · DEC-011 Alt B reading (**DEC-011 working default = Alt B**) | Smart animate 250ms |
| 3.8a | OWN-005 · DEC-011 Alt A reading | "Save correction" | NAVIGATE | OWN-005 · Success | Dissolve 200ms |
| 3.9a | OWN-005 · DEC-011 Alt A reading | "Cancel" | NAVIGATE | OWN-005 | Dissolve 200ms |
| 3.8b | OWN-005 · DEC-011 Alt B reading | "Approve and apply" | NAVIGATE | OWN-005 · Success | Dissolve 200ms |
| 3.9b | OWN-005 · DEC-011 Alt B reading | "Reject…" | NAVIGATE | OWN-005 · Validation error *(to verify: is this the reason-required state?)* | Dissolve 200ms |
| 3.10 | OWN-005 / Success / Alt A / Alt B | "Open attendance" | NAVIGATE | OWN-004 | Instant |
| 3.11 | OWN-004 · Schedule not configured | "Open settings" (banner) | NAVIGATE | OWN-011 Settings | Dissolve 200ms |
| 3.12 | OWN-004 · Alert delivery failed | banner action "Open delivery monitor" | NAVIGATE | OWN-012 Delivery & exception monitor | Dissolve 200ms |
| 3.13 | OWN-005 · Save conflict | "Review latest" | NAVIGATE | OWN-005 · DEC-011 Alt B reading | Dissolve 200ms |
| 3.14 | OWN-005 · Validation error | "Cancel" | NAVIGATE | OWN-005 · DEC-011 Alt B reading | Dissolve 200ms |

Alt flow (D1): `P7 — Owner — Attendance exception → correction review (Reject)` starts at OWN-005 · DEC-011 Alt B reading (3.9b).

Notes:
- **DEC-011 resolved:** Alt B, per `docs/policy-defaults.md`. The Alt A frame keeps its own buttons (3.8a/3.9a) as a policy reference, with no flow start. The Alt A/Alt B labels drawn in Phase 6 are not changed (Phase 8).
- **Unexplored hotspot.** In the Alt B frame, the "Employee requests · 1" tab is the natural hotspot from OWN-005 if Alt B is the default.

## 4. P7 — Owner — Targets & work lists

**Start:** `SCR-OWN-006 — Targets & work lists — Desktop — Light` (206:22844).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 4.1 | OWN-006 | "+ 37 more · 4 excluded (reasons)" | NAVIGATE | OWN-006 · Ineligible items | Smart animate 250ms |
| 4.2 | OWN-006 · Ineligible items | Maya Khoury row (re-select) | NAVIGATE | OWN-006 | Smart animate 250ms |
| 4.3 | OWN-006 | Omar Nassar row ("Manual · 12 items") | NAVIGATE | OWN-006 · Insufficient work *(to verify which employee this frame shows)* | Smart animate 250ms |
| 4.4 | OWN-006 / · Ineligible items | "Hand off 40 to assignments" | NAVIGATE | OWN-007 Calling assignments (3 selected = items preselected) | Dissolve 200ms |
| 4.5 | OWN-007 | "Assign" (bulk bar) | NAVIGATE | OWN-007 · Ineligible excluded | Dissolve 200ms |
| 4.6 | OWN-007 · Ineligible excluded | "Show excluded" | NAVIGATE | OWN-006 · Ineligible items | Dissolve 200ms |
| 4.3b | OWN-006 | "Manual" method radio | NAVIGATE | OWN-006 · Insufficient work (closest frame) | Smart animate 250ms |
| 4.3c | OWN-006 | "Adjust" | NAVIGATE | OWN-006 · Ineligible items (closest frame) | Smart animate 250ms |

Notes:
- **OWN-006 states (orchestrator: end at the closest existing frame).** Manual → Insufficient work, and Adjust → Ineligible items (4.3b/4.3c). "Set target" (×2) and "Target only" have no frame closer than OWN-006 itself, so they stay unwired.
- **Hand-off count.** OWN-007 shows "3 selected", not 40. It is the closest frame for the B8 hand-off.

## 5. P7 — Owner — Calling assignments → reassignment impact

**Start:** `SCR-OWN-007 — Calling assignments — Desktop — Light` (237:22788).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 5.1 | OWN-007 | Peak Fitness Gym row ⋯ (Reserved) | NAVIGATE | OWN-007 · Reserved by another agent | Dissolve 200ms |
| 5.2 | OWN-007 · Reserved by another agent | "Reassign…" (info banner) | NAVIGATE | OWN-008 Reassignment impact (nothing chosen; Reassign disabled) | Dissolve 200ms |
| 5.3 | OWN-008 | "Override the reservation (reason next)" radio | NAVIGATE | OWN-008 · All choices made | Smart animate 250ms |
| 5.4 | OWN-008 | follow-up "Choose…" select (either) | NAVIGATE | OWN-008 · All choices made | Smart animate 250ms |
| 5.5 | OWN-008 | "Wait — save nothing now" radio | NAVIGATE | OWN-007 | Dissolve 200ms |
| 5.6 | OWN-008 / · All choices made | "Cancel" / ✕ | NAVIGATE | OWN-007 | Dissolve 200ms |
| 5.7 | OWN-008 · All choices made | "Reassign…" | NAVIGATE | OWN-008 · Override confirm | Dissolve 200ms |
| 5.8 | OWN-008 · Override confirm | "Back" / ✕ | BACK | (OWN-008 · All choices made) | Dissolve 200ms |
| 5.9 | OWN-008 · Override confirm | "Override and reassign" | NAVIGATE | OWN-008 · Success | Dissolve 200ms |
| 5.10 | OWN-008 · Success | toast ✕ | NAVIGATE | OWN-007 | Dissolve 200ms |
| 5.11 | OWN-007 | "Needs decision · 3" filter chip | NAVIGATE | OWN-007 · Needs decision, B7 and inactive agent | Instant |
| 5.12 | OWN-007 · Needs decision… | any row "Reassign…" | NAVIGATE | OWN-008 Reassignment impact | Dissolve 200ms |
| 5.13 | OWN-007 · Needs decision… | "All" chip | NAVIGATE | OWN-007 | Instant |
| 5.14 | OWN-007 (all variants) | "Open agent queue" | OPEN_URL | SCR-CC-001 (311-13767) | — |
| 5.15 | OWN-007 (all variants) | "Opportunities & handoffs" tab | OPEN_URL | SCR-CC-007 (316-13709) | — |
| 5.16 | OWN-007 (all variants) | "Do-not-call list" tab | OPEN_URL | SCR-CC-008 (316-15211) | — |
| 5.17 | OWN-007 · Save conflict | "Reload list" (banner) | NAVIGATE | OWN-007 | Dissolve 200ms |
| 5.18 | OWN-008 · Save conflict | "Review again" | NAVIGATE | OWN-008 | Dissolve 200ms |

How the follow-up choices (Transfer / Cancel / Keep) appear:
- The **All choices made** frame shows Transfer for the first follow-up and Keep for the second, with the Keep warning. Transfer and Keep are therefore demonstrated in one state.
- **Cancel (reason required)** has no drawn frame. Per the orchestrator, the select (5.4) ends on the closest frame, All choices made.
- There is no default for follow-ups (B3-Q03). The prototype picks no default; the reviewer clicks a select and sees the "all chosen" state.
- **Policy (DEC-004).** Override is Proposed. The Wait/Override radio is a user choice and not a policy alternative, so no default is needed.

## 6. P7 — Owner — Reports → synchronous export

**Start:** `SCR-OWN-009 — Reports & exports — Desktop — Light` (289:22805).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 6.1 | OWN-009 | "Export" | NAVIGATE | OWN-009 · Preparing download | Dissolve 200ms |
| 6.2 | OWN-009 · Preparing download | "Preparing download…" button (click to continue) | NAVIGATE | OWN-009 · Success | Dissolve 200ms |
| 6.3 | OWN-009 · Success | toast ✕ | NAVIGATE | OWN-009 | Dissolve 200ms |
| 6.4 | OWN-009 · Export failure | "Try again" (banner) | NAVIGATE | OWN-009 · Preparing download | Dissolve 200ms |
| 6.5 | OWN-009 · Export failure | "Export" | NAVIGATE | OWN-009 · Preparing download | Dissolve 200ms |
| 6.6 | OWN-009 · Unauthorized, non-Owner | "Go to My Day" | OPEN_URL | SCR-SHR-001 (303-10513) | — |
| 6.7 | OWN-001 | "Export" | NAVIGATE | OWN-009 | Dissolve 200ms (= 1.11) |

Notes:
- The export is synchronous (ADR-010), so there is no "generating later" state.
- Preparing → Success: the orchestrator allowed AFTER_TIMEOUT only if the helper supports it. `wiring-helpers.js` has `onClick` only, so 6.2 is **ON_CLICK** on the loading button.
- Alt flow (D1): `P7 — Owner — Reports → synchronous export (Export failure)` starts at OWN-009 · Export failure.
- Export failure is reachable only as a reference state. A "fail" branch would need a second trigger, which is not wired.
- The report list items (Businesses, Attendance, …) have no per-report frames and are not wired.

## 7. P7 — Owner — Audit log

**Start:** `SCR-OWN-010 — Audit log explorer — Desktop — Light` (210:22783).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 7.1 | OWN-010 | Row "20 Oct 11:05 · calling_assignment.reassigned" (or its ›) | NAVIGATE | OWN-010 · Event detail | Dissolve 200ms |
| 7.2 | OWN-010 · Event detail | "Close" / ✕ | BACK | (OWN-010) | Dissolve 200ms |
| 7.3 | OWN-012 (all variants) | "Open audit log" | NAVIGATE | OWN-010 | Instant |

Notes:
- The other rows' › have no own detail frames. Optionally they can point to the same Event detail; the recommendation is no, to avoid mismatched content.
- Export is disabled (OQ-18) and is not wired.
- Empty and Loading are reference states.

## 8. P7 — Owner — Settings (current SCR-OWN-011 frames, as they are)

**Start:** `SCR-OWN-011 — Settings — Desktop — Light` (275:22810).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 8.1 | OWN-011 | "Test office check" | NAVIGATE | OWN-011 · Test office check | Smart animate 250ms |
| 8.2 | OWN-011 / · Test office check | "Save attendance settings" | NAVIGATE | OWN-011 · Success | Dissolve 200ms |
| 8.3 | OWN-011 · Not configured | "Save attendance settings" | NAVIGATE | OWN-011 · Validation error | Dissolve 200ms |
| 8.4 | OWN-011 · Validation error | "Discard" | NAVIGATE | OWN-011 | Dissolve 200ms |
| 8.5 | OWN-011 (all Attendance-tab variants) | "Security" tab | NAVIGATE | OWN-011 · Security tab | Instant |
| 8.6 | OWN-011 · Security tab | "Attendance & office check" tab | NAVIGATE | OWN-011 | Instant |
| 8.7 | OWN-011 · Save conflict | "Review latest" | NAVIGATE | OWN-011 | Dissolve 200ms |
| 8.8 | OWN-011 · Success | toast ✕ | NAVIGATE | OWN-011 | Dissolve 200ms |
| 8.9 | OWN-011 | "Discard" | NAVIGATE | OWN-011 | Instant (no-op) |

Alt flow (D1): `P7 — Owner — Settings (Not configured)` starts at OWN-011 · Not configured (8.3 → Validation error).

Notes:
- **DEC-009** (verification mode): four RadioCards, none selected. Under "frames as they are" they are **not wired**; the default is TBD and no "mode selected" frame exists.
- **Not wired:** the DEC-007/008/022 fields (shift start, grace, working days) and the "Company" tab (not drawn).
- **Brittleness.** C11 is blocked, so the frame IDs (275:*) must not change. The script should still resolve by name.
- Labels and button text on the Not configured, Validation error and Save conflict frames were not inspected in detail. The script reports `missingHotspots` if "Review latest" or "Save attendance settings" is not found.

## 9. P7 — Owner — Delivery monitor → send again

**Start:** `SCR-OWN-012 — Delivery & exception monitor — Desktop — Light` (212:22791).

| # | Frame | Hotspot | Action | Target | Transition |
|---|---|---|---|---|---|
| 9.1 | OWN-012 | Row "Meeting reminder · Peak Fitness Gym" | NAVIGATE | OWN-012 · Failed item detail | Dissolve 200ms |
| 9.2 | OWN-012 | Row 1 "Send again" | NAVIGATE | OWN-012 · Failed item detail | Dissolve 200ms |
| 9.3 | OWN-012 · Failed item detail | "Close" / ✕ | BACK | (OWN-012) | Dissolve 200ms |
| 9.4 | OWN-012 · Failed item detail | "Send again (new reminder)" | NAVIGATE | OWN-012 · Retrying | Dissolve 200ms |
| 9.5 | OWN-012 | Row 3 "View" (Assignment changed · Lumen Yoga) | NAVIGATE | OWN-012 · Retrying | Dissolve 200ms |
| 9.6 | OWN-012 | "Project provisioning · 0" chip | NAVIGATE | OWN-012 · Empty | Instant |
| 9.7 | OWN-012 · Empty | "All · 0" chip ✕ | NAVIGATE | OWN-012 | Instant |
| 9.8 | **F3 retry** | "Retry ›" on a provisioning row | — | Not drawn. Per the orchestrator, the journey ends at the closest frame: the "Project provisioning · 0" chip → OWN-012 · Empty (9.6). | — |
| 9.9 | OWN-012 (all variants) | "Open audit log" | NAVIGATE | OWN-010 | Instant (= 7.3) |

Notes:
- **9.4 kept (Phase 8 item, left as is).** The Retrying frame shows the *notification* row (Lumen Yoga) as "Retrying · 2 of 3 / Automatic retry". It does not show a new reminder for Peak Fitness, and AR-13 says Send again creates a new reminder while the failed one stays. There is no "new reminder created" toast frame, so 9.4 lands on Retrying as the closest frame.
- **F3.** The provisioning count is 0 by design (owner-spec: "the type is kept"). There is no Retry › hotspot on page 41. To show F3, the reviewer can follow the DEV page reference `SCR-DEV-008 — Finalize closure — Desktop — Light — Closed, provisioning failed (F3)` (321:14318, page 44), but the OWN-012 side cannot be clicked. A row would need a connector frame (orchestrator approval, brief §Scope).

---

## Unclear or missing hotspots

| # | Where | Issue | Proposed handling |
|---|---|---|---|
| M1 | OWN-012 (F3) | No project-provisioning row, so no "Retry ›" to DEV-002. | **Decided:** end at OWN-012 · Empty (9.6); noted. |
| M2 | OWN-012 · Failed item detail → Retrying | Retrying shows a notification auto-retry, not the new reminder from Send again; there is no "new reminder" toast. | **Decided:** keep 9.4; Phase 8 item. |
| M3 | OWN-005 (DEC-011) | Policy alternative; `docs/policy-defaults.md` is missing. | **Decided:** Alt B (policy-defaults). |
| M4 | OWN-011 (DEC-009) | RadioCards have no selected-state frame. | Not wired (frames as they are). |
| M5 | OWN-008 | "Cancel (reason required)" follow-up choice has no frame; the select dropdown has no open state. | **Decided:** select → All choices made (closest frame). |
| M6 | OWN-006 | Set target (×2), Manual / Target-only radios and Adjust have no target frames. | **Decided:** Manual → Insufficient work, Adjust → Ineligible items; Set target / Target only unwired. |
| M7 | OWN-003 | The Deactivate dialog is for Omar while the Edit drawer is for Maya; there is no Reactivate (register: Partial); Change role has no done-state frame. | Wire as listed; flag to the reviewer. |
| M8 | OWN-002 / OWN-007 | Row ⋯ menus have no open-menu frames (Send reset link, Change role…, Deactivate…, Reassign…). | The ⋯ goes straight to the drawer, dialog or reserved state. |
| M9 | OWN-009 | Preparing → Success needs a timer; the brief allows ON_CLICK only. | **Decided:** the helper has no AFTER_TIMEOUT, so ON_CLICK. |
| M10 | OWN-001 | The Exceptions "Send again" toast does not exist; filters have no frames. | Route to the OWN-012 detail; filters not wired. |
| M11 | OWN-005 | Label of the "Reject…" result frame not confirmed (Validation error?). | The script reports `missingTargets` if it is wrong. |
| M12 | OWN-006 · Insufficient work | Which employee or row leads there was not confirmed from the preview. | The script finds the row by name; it reports `missingHotspots` if it is absent. |
| M13 | All | Hotspots inside `Shell/Desktop` and DS instances are instance children. | Reaction as an override; report it if one is refused (brief rule 3). |
| M14 | Cross-page IDs | IDs for pages 42–44 may be stale after later re-runs. | **Re-checked** against the current previews indexes; unchanged. |

## Frame index (page 41 Light frames used)

| Short | Full frame name | Fallback id |
|---|---|---|
| OWN-001 | SCR-OWN-001 — Owner dashboard — Desktop — Light | 200:22902 |
| OWN-001 · Partial data | … — Light — Partial data | 200:24943 |
| OWN-002 | SCR-OWN-002 — Employees — Desktop — Light | 201:22895 |
| OWN-002 · Deactivated, assignee inactive | … — Light — Deactivated, assignee inactive | 201:23714 |
| OWN-003 · Edit | SCR-OWN-003 — Employee create / edit — Desktop — Light — Edit | 202:22895 |
| OWN-003 · Create new | … — Create new | 202:23396 |
| OWN-003 · Validation error, duplicate email | … — Validation error, duplicate email | 202:23622 |
| OWN-003 · Save conflict | … — Save conflict | 202:23857 |
| OWN-003 · Deactivate impact | … — Deactivate impact | 202:24085 |
| OWN-003 · Change role | … — Change role | 202:24260 |
| OWN-003 · Success | … — Success | 202:24415 |
| OWN-004 | SCR-OWN-004 — Attendance monitoring & exception alerts — Desktop — Light | 287:22811 |
| OWN-004 · Schedule not configured | … — Schedule not configured | 287:24817 |
| OWN-004 · Alert delivery failed | … — Alert delivery failed | 287:25375 |
| OWN-004 · Exception detail | … — Exception detail | 287:25933 |
| OWN-005 | SCR-OWN-005 — Attendance corrections & review queue — Desktop — Light | 205:22895 |
| OWN-005 · DEC-011 Alt A reading | … — DEC-011 Alt A reading | 205:23504 |
| OWN-005 · DEC-011 Alt B reading | … — DEC-011 Alt B reading | 205:23837 |
| OWN-005 · Validation error | … — Validation error | 205:24133 |
| OWN-005 · Success | … — Success | 205:24768 |
| OWN-006 | SCR-OWN-006 — Targets & work lists — Desktop — Light | 206:22844 |
| OWN-006 · Insufficient work | … — Insufficient work | 206:23695 |
| OWN-006 · Ineligible items | … — Ineligible items | 206:24095 |
| OWN-007 | SCR-OWN-007 — Calling assignments — Desktop — Light | 237:22788 |
| OWN-007 · Ineligible excluded | … — Ineligible excluded | 237:23854 |
| OWN-007 · Needs decision, B7 and inactive agent | … — Needs decision, B7 and inactive agent | 237:24357 |
| OWN-007 · Reserved by another agent | … — Reserved by another agent | 237:24685 |
| OWN-007 · Save conflict | … — Save conflict | 237:25183 |
| OWN-008 | SCR-OWN-008 — Reassignment impact — Desktop — Light | 302:22859 |
| OWN-008 · All choices made | … — All choices made | 302:23346 |
| OWN-008 · Override confirm | … — Override confirm | 302:23584 |
| OWN-008 · Save conflict | … — Save conflict | 302:23742 |
| OWN-008 · Success | … — Success | 302:23900 |
| OWN-009 | SCR-OWN-009 — Reports & exports — Desktop — Light | 289:22805 |
| OWN-009 · Unauthorized, non-Owner | … — Unauthorized, non-Owner | 289:23899 |
| OWN-009 · Preparing download | … — Preparing download | 289:24492 |
| OWN-009 · Export failure | … — Export failure | 289:25034 |
| OWN-009 · Success | … — Success | 289:25577 |
| OWN-010 | SCR-OWN-010 — Audit log explorer — Desktop — Light | 210:22783 |
| OWN-010 · Event detail | … — Event detail | 210:23641 |
| OWN-011 | SCR-OWN-011 — Settings — Desktop — Light | 275:22810 |
| OWN-011 · Not configured | … — Not configured | 275:23706 |
| OWN-011 · Validation error | … — Validation error | 275:24147 |
| OWN-011 · Test office check | … — Test office check | 275:24593 |
| OWN-011 · Save conflict | … — Save conflict | 275:25028 |
| OWN-011 · Success | … — Success | 275:25468 |
| OWN-011 · Security tab | … — Security tab | 275:25905 |
| OWN-012 | SCR-OWN-012 — Delivery & exception monitor — Desktop — Light | 212:22791 |
| OWN-012 · Failed item detail | … — Failed item detail | 212:23487 |
| OWN-012 · Retrying | … — Retrying | 212:23907 |
| OWN-012 · Empty | … — Empty | 212:24236 |

## Scripts and run order (O-P7-1)

All scripts are in `docs/phase7/scripts/owner/`. Each one:
- inlines `wiring-helpers.js` plus the Owner extensions, and sets page 41 (`96:3`) once;
- looks frames up by name, with an ID fallback;
- touches only its own hotspots and flow starts, and removes Figma's auto-created `Flow N` entries on the frames it touched;
- returns `{wired, missingTargets, missingHotspots, flows}`, plus `wiredSteps` and `errors`.

The flow scripts skip `Shell/*` layers, so P41-01 and the flow scripts never overwrite each other. All scripts are under 20k characters and pass `node --check` (wrapped in async) and a mock-Figma smoke run.

| Order | Script | Covers | Flow starts |
|---|---|---|---|
| 1 | P41-01-shell-nav.js | Global sidebar `Nav/Item · *` plus the TopBar bell and attendance chip, on every SCR-OWN Desktop Light frame | — |
| 2 | P41-02-dashboard.js | §1 (1.1–1.12) | Dashboard drill-downs; (Partial data retry) |
| 3 | P41-03-employees.js | §2 (2.1–2.17) | Employees: add/edit drawer → deactivate |
| 4 | P41-04-attendance.js | §3 (3.1–3.14, DEC-011 Alt B) | Attendance exception → correction review; (Reject) |
| 5 | P41-05-targets-assignments.js | §4, §5 | Targets & work lists; Calling assignments → reassignment impact |
| 6 | P41-06-reports-audit.js | §6, §7 | Reports → synchronous export; (Export failure); Audit log |
| 7 | P41-07-settings-delivery.js | §8, §9 | Settings; (Not configured); Delivery monitor → send again |

Any order works after P41-01, and re-running a script is safe. Hotspots matched by visible text, where no `Button · X` layer exists, are the most likely `missingHotspots`. Report those; do not work around them (brief rule 3).

## Prototype accuracy notes (user instruction 2026-10-23)
- **DEC-011** (attendance correction: employee requests → Owner decides): this is a **demonstration alternative, not an approved policy**. The prototype shows Alt B only to demonstrate the flow. The policy stays open until the user explicitly approves it.
- **Export Preparing → Success on click:** this is a **prototype simplification**. The real export is synchronous and server-generated, so the user does not click to advance it. Annotate the frame and do not copy this behaviour into implementation.
- **Verification state:** the P41 scripts passed `node --check` and a mock dry run only. **They have not run in Figma**, so the Owner wiring is **not complete** until the operator run and its read-back confirm it.
