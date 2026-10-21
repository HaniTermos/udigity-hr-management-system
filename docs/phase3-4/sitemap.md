# Phase 4 — Role Sitemap and Navigation

Owner: IA Agent (W0). Version: P4-NAV-1, 2026-10-20. Status: **proposed — for user review, not approved.**
Figma: page `01 Sitemap & Navigation` (`1:2`) in file `GNrhb3DWa6mIhEX6F4Nmvw`. Screen IDs refer to [screen-inventory.md](screen-inventory.md), which is canonical.

## 1. Principles

1. **Role-specific navigation (ART-01 §18).** Each role sees only the sections relevant to its work, not one overloaded dashboard. Every role has exactly one home:
   - Owner → Dashboard (SCR-OWN-001).
   - Data Entry, Call Center and Developer → My Day (SCR-SHR-001).
2. **Navigation is not authorization.** A hidden nav item is a convenience. Every screen, list, search, calendar, notification and direct URL is still checked by WF-ACCESS-001 (contract C2, C5). A direct URL to a screen outside the role shows SCR-SHR-011 (permission denied) or SCR-SHR-012 (record hidden by policy).
3. **Owner admin access requires completed 2FA.** Until 2FA completes, the Owner session stays on SCR-AUTH-002. Whether that pending session may check in is R-11 → USER; the wireframes show both readings.
4. **No attendance gating (contract A1).** Work sections are reachable without check-in. The attendance status chip in the top bar is informational.
5. **Policy-dependent nav items stay visible and labelled.** Example: "Categories [DEC-015]" for Data Entry. Nothing is silently removed or granted.
6. **Desktop:** left nav (240 px) + top bar (global search, attendance chip, notifications, user menu). **Mobile:** bottom tab bar (4 tabs) + focused flows. Desktop-only screens stay reachable on mobile through "More", but no mobile layout is promised for them in Phase 4.

## 2. Global elements (all roles)

| Element | Contents | Screens |
|---|---|---|
| Top bar — search | Business search, scoped by access. Placeholder text varies by role | SCR-SHR-010 |
| Top bar — attendance chip | "Not checked in" / "Checked in · hh:mm" → Check-in or Checkout | SCR-SHR-002, SCR-SHR-003 |
| Top bar — notifications | Count + list | SCR-SHR-007 |
| Top bar — user menu | My Profile, My Attendance, theme (light/dark), Sign out | SCR-SHR-006, SCR-SHR-004, SCR-AUTH-001 |
| Signed-out area | Login → (Owner) 2FA challenge / enrollment; Forgot / reset password | SCR-AUTH-001..004 |
| Interrupts (any screen) | Session expired, permission denied, hidden by policy, save conflict, system states | SCR-SHR-011..015 |

## 3. Desktop left navigation by role

Order = order in the left nav. Sub-screens (drawers, dialogs, detail views) are reached from the parent screen, not from the nav.

### 3.1 Owner/Admin — `wf/Shell/Desktop/Owner` (`8:80`)

| Section | Nav item | Opens | Reached from it |
|---|---|---|---|
| OVERVIEW | **Dashboard** (home) | SCR-OWN-001 | → SCR-OWN-009 (export) |
| | Attendance | SCR-OWN-004 | tab "Corrections & review" → SCR-OWN-005 |
| PEOPLE | Employees | SCR-OWN-002 | → SCR-OWN-003 drawer |
| | Targets & Work Lists | SCR-OWN-006 | hand-off of Call Center items → SCR-OWN-007 (B8) |
| BUSINESSES | Businesses | SCR-DE-001 | → SCR-SHR-008, SCR-DE-002, SCR-DE-004, SCR-DE-003 |
| | Correction Requests | SCR-DE-006 | → SCR-DE-005 |
| | Categories | SCR-DE-007 | — |
| CALLING | Calling Assignments | SCR-OWN-007 | → SCR-OWN-008; agent queue → SCR-CC-001 (Owner view) → SCR-CC-002/003/005; tab "Do-not-call" → SCR-CC-008; tab "Opportunities" → SCR-CC-007 |
| | Follow-ups & Calendar | SCR-CC-004 (all agents) | → SCR-CC-006 |
| DELIVERY | Deals & Meetings | SCR-DEV-001 | → SCR-DEV-002, SCR-DEV-008; tab "Meetings" → SCR-DEV-003 → SCR-DEV-004 |
| | Projects | SCR-DEV-005 | → SCR-DEV-006 → SCR-DEV-007 |
| ADMIN | Reports & Exports | SCR-OWN-009 | — |
| | Audit Log | SCR-OWN-010 | — |
| | Delivery Monitor | SCR-OWN-012 | — |
| | Settings | SCR-OWN-011 | — |
| (bottom) | **My Day (check in)** | SCR-SHR-001 | Owner's own check-in / check-out → SCR-SHR-002/003 (RW-02 fix, 2026-10-20; nav item in `8:80`) |
| (bottom) | My Profile | SCR-SHR-006 | Owner's own attendance through the user menu → SCR-SHR-004 |

### 3.2 Data Entry — `wf/Shell/Desktop/DataEntry` (`8:166`)

| Section | Nav item | Opens | Reached from it |
|---|---|---|---|
| MY WORK | **My Day** (home) | SCR-SHR-001 | → SCR-SHR-002/003 |
| | My Attendance | SCR-SHR-004 | → SCR-SHR-005 (DEC-011 Alt B only) |
| BUSINESSES | Businesses | SCR-DE-001 | → SCR-SHR-008 → SCR-DE-004 |
| | Add Business | SCR-DE-002 | → SCR-DE-003 |
| | Correction Requests | SCR-DE-006 | → SCR-DE-005 |
| | Categories [DEC-015] | SCR-DE-007 | shown only if DEC-015 grants Data Entry access; label kept visible in wireframes |
| (bottom) | My Profile | SCR-SHR-006 | — |

### 3.3 Call Center — `wf/Shell/Desktop/CallCenter` (`8:217`)

| Section | Nav item | Opens | Reached from it |
|---|---|---|---|
| MY WORK | **My Day** (home) | SCR-SHR-001 | → SCR-SHR-002/003; work items → SCR-CC-002 |
| | My Attendance | SCR-SHR-004 | → SCR-SHR-005 (Alt B) |
| CALLING | Calling Queue | SCR-CC-001 | → SCR-CC-002 → Start Contact → SCR-CC-003 (or SCR-CC-005 on conflict) → SCR-CC-006 / SCR-CC-007; flag → SCR-SHR-009 |
| | Follow-ups & Calendar | SCR-CC-004 | → SCR-CC-006; open business → SCR-CC-002 |
| | Opportunities & Handoffs | SCR-CC-007 | → SCR-DEV-004 (schedule meeting); → SCR-DEV-003 (read meetings) |
| | Do-not-call List | SCR-CC-008 | view only; reopen per DEC-016 |
| (bottom) | My Profile | SCR-SHR-006 | — |

The Call Center top-bar search covers assigned businesses only (WF-ACCESS-001).

### 3.4 Developer — `wf/Shell/Desktop/Developer` (`8:268`)

| Section | Nav item | Opens | Reached from it |
|---|---|---|---|
| MY WORK | **My Day** (home) | SCR-SHR-001 (tasks, meetings today) | → SCR-SHR-002/003; → SCR-DEV-007 |
| | My Attendance | SCR-SHR-004 | → SCR-SHR-005 (Alt B) |
| DELIVERY | Deals | SCR-DEV-001 | → SCR-DEV-002 → SCR-DEV-008; business context (ctx) → SCR-SHR-008; flag → SCR-SHR-009 |
| | Meetings & Calendar | SCR-DEV-003 | → SCR-DEV-004 |
| | Projects | SCR-DEV-005 | → SCR-DEV-006 → SCR-DEV-007 |
| (bottom) | My Profile | SCR-SHR-006 | — |

Developers have no business-directory nav item. They reach business data only through deal or project context (context-limited access, SB-3 §11; DEC-005).

## 4. Mobile navigation and focused flows

Each mobile shell (`wf/Shell/Mobile/<Role>`) has 4 bottom tabs. "More" lists the remaining nav items of that role; desktop-only screens open their responsive layout.

| Role | Tab 1 | Tab 2 | Tab 3 | Tab 4 |
|---|---|---|---|---|
| Owner (`8:316`) | **Today** → SCR-OWN-004 (attendance and exception alerts) | My Day → SCR-SHR-001 (own check-in/out) | Alerts → SCR-SHR-007 | More |
| Data Entry (`8:340`) | **My Day** → SCR-SHR-001 | Businesses → SCR-DE-001 (P2) | Alerts → SCR-SHR-007 | More |
| Call Center (`8:364`) | **My Day** → SCR-SHR-001 | Queue → SCR-CC-001 | Follow-ups → SCR-CC-004 | More |
| Developer (`8:388`) | **My Day** → SCR-SHR-001 | Tasks → SCR-DEV-006 / SCR-DEV-007 | Meetings → SCR-DEV-003 | More |

### Focused mobile flows (mobile frames required; see inventory Mob column)

| Flow | Steps (screens) | Roles |
|---|---|---|
| **M1 Check-in / check-out** | My Day (SHR-001) → Check in (SHR-002: verifying → success / verification failure / open-session block) → … → Check out (SHR-003: summary [DEC-012] → closed / DEC-026 branch) | ALL |
| **M2 Calling queue + contact** | Queue (CC-001, buckets) → Contact workspace (CC-002) → Start Contact → Active contact (CC-003: notes, outcome) → follow-up drawer (CC-006) when "Needs another call" (D2) → back to Queue. Conflict at any step → CC-005 (reserved by another agent / expired / network loss) | CC (OWN read) |
| **M3 Follow-ups** | Follow-ups (CC-004, list default on mobile) → open → reschedule / complete / cancel (CC-006) → contact (CC-002) | CC |
| **M4 My work list** | My Day (SHR-001): targets and work items → open item (business, follow-up or task by role) | DE, CC, DEV |
| **M5 Project task updates** | Tasks tab → Project board (DEV-006, mobile = column list) → Task drawer (DEV-007: status, owner, dates) → saved / save conflict (SHR-014) | DEV (OWN) |
| M6 Owner on the move | Today (OWN-004) → exception detail → Alerts (SHR-007) | OWN |
| Sign-in | Login (AUTH-001) → 2FA (AUTH-002, Owner) / reset (AUTH-004) | ALL |

## 5. Screen ownership by wireframe page

| Page | Agent | Screens |
|---|---|---|
| 10 Shared — Auth, Profile, Attendance, My Work (`1:5`) | W1 | AUTH-001..004, SHR-001..006 |
| 11 Owner/Admin (`1:6`) | W1 | OWN-001..012 |
| 12 Data Entry (`1:7`) | W2 | DE-001..007, SHR-008, SHR-009, SHR-010 |
| 13 Call Center (`1:8`) | W2 | CC-001..008 |
| 14 Developer (`1:9`) | W3 | DEV-001..008 |
| 15 Cross-cutting States (`1:10`) | W3 | SHR-007, SHR-011..015 |

## 6. Open points for the user (no decision taken)
- Owner home: Dashboard (proposed) vs a combined "Today" view. Mobile uses "Today" (OWN-004) because the Owner's mobile need is attendance exceptions.
- Data Entry "Categories" item depends on DEC-015.
- Call Center access to Developer meetings (read / schedule) depends on DEC-005 and the SM-MEETING-001 actor list (Proposed).
- Whether Call Center sees the do-not-call list as its own nav item, or only as a queue bucket. Proposed: both. Reopening follows DEC-016.

## 7. Verification (IA Agent W0, 2026-10-20)

This section covers both W0 docs (sitemap.md and screen-inventory.md) and pages 01–03.

**Created**
- `docs/phase3-4/screen-inventory.md`: 54 screens, WF → SCR coverage table, kit reference with node IDs.
- `docs/phase3-4/sitemap.md`: this file.
- Page 01 `1:2`: one root frame `10:2` (2535×2985). Contents:
  - Global entry, top bar and interrupt chains.
  - Four role trees (left nav → reached screens).
  - Mobile tabs per role and focused flows M1–M6.
- Page 02 `1:3`: one root frame `11:2` (2078×3006). Seven role-grouped tables (54 rows) and the coverage block.
- Page 03 `1:4`: 8 category frames holding **68 components**, plus header frame `3:2`. The header has the rules, a type ramp and greyscale swatches.
  - 5 local text styles: `wf/H1`, `wf/H2`, `wf/H3`, `wf/Body`, `wf/Caption`.
  - All components are auto-layout, Inter only, greyscale, with one blue focus accent (used only in `wf/Button/Focused` and `wf/Input/Focused`).
  - Text is overridable through component properties.
  - 83 nested instances are exposed (buttons, badges, inputs, tabs, nav items).

**Read back**
- `get_metadata` on page `1:4`: all components present with expected names and sizes. Shells are 1440×900 and 390×844; drawer 480×900; scrim 1440×900.
- `get_metadata` on pages `1:2` and `1:3`: outputs too large for inline display, so they were saved to file and checked with grep. **Each page contains all 54 distinct SCR IDs.** A `use_figma` read confirmed one root frame per page.

**Visually inspected (`get_screenshot`)**
- Page 01 root (all of it).
- Page 02 root (all of it).
- Page 03:
  - Header, Actions & Inputs, Status/Chips/Tabs, Navigation Atoms.
  - Layout & Data Display, Calendar & Project Board (before the fix), Feedback/States/Annotations, Overlays & Bars.
  - Shells (all 8 shells at reduced scale).
  - `wf/Calendar/Week` after the fix.
- Fixes applied (one attempt each, both successful):
  1. Calendar view tabs were in reverse order. Fixed to Week · Day · Month · List.
  2. Category description texts overflowed their frames. Each is now 1700 px wide and wraps.

**Not inspected / known limits**
- Shell screenshots were taken at about 28% scale. Nav labels were legible, but small type detail was not checked at 1:1.
- One nav label wraps to two lines: "Opportunities & Handoffs" (Call Center shell). Left as is.
- Glyph rendering was checked only on screenshots. The kit avoids non-Latin symbols and uses text tokens such as `[q]` and `[cal]` as icon placeholders.
- Dark theme is not represented. Low-fi is greyscale and light only; dark mode is a Phase 5 concern.
- No W1–W3 frames exist yet. Instancing the kit on pages 10–15 has not been tested by this agent.
- The whole-page get_metadata XML for pages 01/02 was grepped, not read line by line.
- None of this is approved. Policy items stay pending with DEC IDs.
