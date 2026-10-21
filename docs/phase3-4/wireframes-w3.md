# Phase 4 — Wireframes W3: Developer (page 14) and Cross-cutting States (page 15)

Owner: Wireframe Agent W3. Version: P4-W3-1, 2026-10-20. Status: **proposed, for user review. Not approved.**
Figma design file `GNrhb3DWa6mIhEX6F4Nmvw`. W3 wrote only on page `14 Developer` (`1:9`) and page `15 Cross-cutting States` (`1:10`). Kit masters on page 03 were not edited. Every frame is built from kit instances (shells, page header, tables, cards, kanban, calendar, drawer, dialog, banners, states, annotations), plus plain auto-layout containers and text.

## 1. Conventions used

- **One Figma Section per screen.** Each section is named `SCR-XX-nnn — <name>`. It holds a small header (H1 name plus a one-line purpose with UC/WF/SM refs) and then the frames in a row.
- **Frame names** follow `SCR-XX-nnn — <name> — Desktop|Mobile[ — <state>]`.
- **Desktop frames** are 1440×900. Each holds a `wf/Shell/Desktop/Developer` instance with the screen's own nav item swapped to `wf/Nav/Item/Active`, and a content frame at (240, 64), 1200×836.
- **Mobile frames** are 390×844. Each holds a `wf/Shell/Mobile/Developer` instance with the header title overridden and the right tab active, and content at y 101.
- **Drawers** are a `wf/Drawer` at x 960 over `wf/Overlay/Scrim`. The drawer's sample body fields are hidden (instance override), and the screen's own fields sit in a "Drawer content" frame at (961, 68). **Dialogs** are a `wf/Dialog` centred over the scrim.
- **Badges:** solid or outline = stored state. **Dashed (`wf/Badge/Status/Derived`) = derived condition, never a state.** Examples: Developer not yet assigned, Meeting not yet arranged, Upcoming, Awaiting outcome, Delivery overdue, Task overdue, Project provisioning pending.
- **Every unresolved policy** is shown with `wf/Annotation/Policy`: 65 instances on page 14 and 15 on page 15.
- **Demo user:** "R. Haddad (Developer)". All data is fictional.

## 2. Page 14 — Developer (`1:9`): 8 screens, 35 frames (29 desktop + 6 mobile)

| Screen | Section | Frames (node ID — state) |
|---|---|---|
| SCR-DEV-001 Deals | `17:1227` | `17:1231` Desktop (closed deals company-wide eligible + accepted-opportunity tab; Assigned to me; stage badges; derived Developer-not-yet-assigned / provisioning-pending) · `17:1422` Empty · `17:1531` Loading |
| SCR-DEV-002 Deal record detail | `19:2008` | `19:2012` Desktop (Signed and paid; four separate fact cards: accepted / signature / payment / closure) · `19:2166` Accepted opportunity (DEC-005 Alt 1) · `19:2321` Verification rejected (DEC-006 Alt B) · `19:2470` Hidden by policy · `19:2547` Save conflict |
| SCR-DEV-003 Meetings & calendar | `20:893` | `20:897` Desktop (week calendar + legend) · `20:1028` List with states (Upcoming/Awaiting outcome derived; Scheduled; Missed Proposed; Cancelled; Held; reminder-failed banner) · `20:1188` Empty · `20:1256` Mobile |
| SCR-DEV-004 Meeting schedule / record (drawer) | `21:5535` | `21:5539` Reschedule (previous values kept, Missed → Scheduled) · `21:5704` Validation error (past time, no attendee) · `21:5862` Record outcome (Held + discovery notes / Missed) · `21:6017` Mobile Reschedule · `21:6078` Mobile Record outcome (+ success toast) |
| SCR-DEV-005 Projects | `23:6984` | `23:6988` Desktop (stats incl. Development workload; project-status table) · `23:7170` Empty |
| SCR-DEV-006 Project board | `24:2803` | `24:2807` Desktop (project-status bar with allowed next statuses + task kanban whose columns are task statuses) · `24:3011` Delivered with open tasks (warning dialog) · `24:3200` Completed (read-only) · `24:3387` Hidden by policy · `24:3460` Mobile (column list, flow M5) |
| SCR-DEV-007 Task detail (drawer) | `25:9793` | `25:9797` Desktop (status, owner, dates, overdue derived) · `25:9991` Validation error (cancel reason, due before start) · `25:10190` Save conflict · `25:10389` Success (toast; project status unchanged) · `25:10527` Mobile · `25:10584` Mobile Save conflict |
| SCR-DEV-008 Finalize closure & provision project (dialog) | `25:11967` | `25:11971` Confirm (DEC-006 Alt A) · `25:12095` Request verification (DEC-006 Alt B) · `25:12211` Not allowed (missing fact) · `25:12327` Closed, provisioning failed (F3) · `25:12443` Success (F2 Auto vs Manual shown side by side) |

Mobile frames follow the inventory's Mob column: DEV-003 and DEV-004 are P2; DEV-006 and DEV-007 are P1. The other DEV screens are "—" on mobile.

Distinctions shown on the frames:
- **Commercial stages:** accepted ≠ signed ≠ paid ≠ closed. Signature and payment are separate facts that can be recorded in either order (Proposed).
- **Closed deal ≠ completed project** (G1 caption on DEV-001, DEV-006 and DEV-008).
- **Project status vs task status:** project status is a separate control with an "allowed next" list (non-linear). Kanban columns are task statuses. Task edits state "project unchanged".
- **Meeting history:** Rescheduled is an event, with previous values kept (R-13).
- **Closure and provisioning:** closure stays committed when provisioning fails (F3).

## 3. Page 15 — Cross-cutting States (`1:10`): 6 screens, 19 frames (13 desktop + 6 mobile)

| Screen | Section | Frames (node ID — state) |
|---|---|---|
| SCR-SHR-007 Notifications | `26:2` | `26:6` Desktop (incl. "no longer accessible → hidden by policy" entry) · `26:167` Empty · `26:243` Mobile |
| SCR-SHR-011 Permission denied | `26:339` | `26:343` Role denied · `26:417` Owner 2FA incomplete (→ SCR-AUTH-002) · `26:495` Mobile |
| SCR-SHR-012 Record hidden by policy | `27:14719` | `27:14723` Direct URL (generic title, no data) · `27:14813` Stale link from notification · `27:14895` Mobile |
| SCR-SHR-013 Session expired / signed out | `27:14933` | `27:14937` Expired · `27:14950` Revoked by Owner · `27:14958` Account deactivated · `27:14966` In-app dialog (unsaved input not saved) · `27:15038` Mobile |
| SCR-SHR-014 Save conflict | `27:16468` | `27:16472` Desktop (field-level diff: opened / theirs / mine; re-apply or reload; nothing overwritten) · `27:16593` Mobile |
| SCR-SHR-015 System state patterns | `27:16640` | `27:16644` Reference sheet (1440×1014: loading, empty, load error, validation error, save failed, offline, success, restricted, state vs derived badges) · `27:16746` Offline in context · `27:16836` Mobile |

Page-15 frames use the Developer shell as a neutral reference. The layout is identical in every role shell, and each section header says so. Signed-out frames (SHR-013) have no shell.

## 4. Policy placeholders shown (all visibly pending)

| Placeholder | Where |
|---|---|
| DEC-005 pending: pre-closure developer access (Alt 1 / Alt 2) | DEV-001, DEV-002 (Alt 1 frame + banner), DEV-003, DEV-004, DEV-002 hidden |
| DEC-006 / R-12 → USER: who records closure (Alt A Developer / Alt B Owner verifies) | DEV-002, DEV-008 (Alt A and Alt B frames) |
| R-12 → USER: DEC-005 Alt 2 × DEC-006 | DEV-002 Alt 1 frame, DEV-008 Not allowed |
| F2 pending: auto vs manual project provisioning | DEV-005, DEV-008 (Confirm, F3, Success) |
| F3: provisioning failure visible to Owner (Proposed) | DEV-008 |
| DEC-019 proposed project statuses; OQ-11 cancelled project; OQ-15 reopen; OQ-10 open tasks warn only; OQ-06/07/08/09 | DEV-005, DEV-006 |
| Task statuses Proposed (no DEC ID); DEC-020 task counting | DEV-006, DEV-007 |
| DEC-017 one vs many deals / projects per deal | DEV-001, DEV-008 |
| DEC-018 evidence, deposit, amounts | DEV-002, DEV-008, SHR-015 |
| DEC-002 15-day visibility (closed deals, projects); DEC-001; DEC-003 | DEV-001, DEV-002, DEV-006, SHR-012 |
| R-13 "Missed" Proposed; meeting validation rules Proposed; reminder timing (no DEC ID) | DEV-003, DEV-004 |
| Commercial stage names / transitions Proposed (no DEC ID); signature/payment order OQ-05 | DEV-001, DEV-002 |
| Workload definition SB-3 §11 (Proposed) | DEV-005 |
| Notification presentation / timing / recipients (no DEC ID); C6 re-check; suppress vs redact | SHR-007, SHR-012 |
| R-11 → USER: pending-2FA Owner in non-admin workflows | SHR-011 |
| Session lifetime (implementation decision) | SHR-013 |
| Request-access button only if adopted (no DEC ID) | SHR-012 |

## 5. Inventory change requests (not applied; for W0 / orchestrator)

1. **SCR-SHR-015:** the reference sheet is 1440×1014, not 1440×900. Proposed rule: reference sheets may exceed 900 px in height.
2. **SCR-SHR-007 on mobile:** the sitemap's Developer mobile tabs (My Day, Tasks, Meetings, More) have no notifications entry. Please state where mobile reaches notifications: a header bell or More.
3. **SCR-SHR-011, "Owner 2FA incomplete" frame:** drawn in the Developer shell to keep page 15 role-neutral; in build it appears in the Owner shell. The inventory could say which shell page-15 references use.
4. **SCR-DEV-002 / DEV-006:** the Owner-only actions ("remove fact entered in error", "assign developer") are annotated but not drawn as separate Owner-view frames. Please confirm Owner variants of DEV screens are out of scope for W3.
5. **Kit change requests (page 03, W0).** None of these blocked the work; workarounds were used.
   - `wf/Drawer` and `wf/Dialog` have fixed sample bodies and no slot. Bodies were hidden and content overlaid.
   - `wf/Kanban/Column` has exactly 3 card instances.
   - `wf/Calendar/Week` places events only on Tue and Thu.
   - `wf/Table/Row` has one badge cell, so derived conditions go into a text column.
   - `wf/Annotation/Policy` does not wrap, so long labels were shortened inside 480-px drawers.

No blocking contradiction found.

## 6. Verification

- **Created.** 14 sections, 54 frames:
  - Page 14: 8 sections, 35 frames (29 desktop 1440×900, 6 mobile 390×844).
  - Page 15: 6 sections, 19 frames (13 desktop, 6 mobile).
  - All built from kit instances. Read-back found 0 instances without a main component and no leftover kit placeholder text ("Primary value", "Card title", "Drawer title" and similar) on page 14.
- **Read back.**
  - `use_figma` structural read-back of both pages: section and frame IDs, names and sizes as listed above. An overflow check on every Content and Drawer-content frame found none.
  - `get_metadata` on `27:14895` confirmed the shell + content + annotation hierarchy.
- **Visually inspected** (get_screenshot):
  - Every section row on both pages, plus close-ups of `17:1231`, `19:2166`, `19:2547`, `23:6988`, `24:2807`, `25:9991`, `25:11971`, `27:16472`.
  - Fixes applied, each within 2 attempts:
    - DEV-001 facts column shortened so the G1 caption fits.
    - Two over-long policy labels in DEV-004 drawers shortened.
    - DEV-007 due-date helper text shortened.
    - DEV-008 annotation strips over the scrim were clipped and are now auto-height.
    - Duplicate Back buttons removed on SHR-011 and SHR-012.
    - SHR-015 sheet height fitted to content.
- **Not inspected or limits.**
  - The mobile frames and most state frames were seen only in row-level screenshots (≈0.3–0.5× scale), so small-text clipping there may be missed.
  - Dark theme is not drawn (out of scope for low-fi).
  - Prototype links between frames are not created.
  - Badge text longer than the table status column was abbreviated ("Accepted opp.").
