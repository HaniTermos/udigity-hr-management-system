# Phase 4 — Wireframes W1 (pages 10 and 11)

Owner: Wireframe Agent W1. Version: P4-W1-1, 2026-10-20. Status: **proposed — for user review, not approved.**
Figma design file `GNrhb3DWa6mIhEX6F4Nmvw`. W1 wrote only on page `10 Shared — Auth, Profile, Attendance, My Work` (`1:5`) and page `11 Owner/Admin` (`1:6`). Page 03 kit masters were not edited. Every component on these pages is an instance of a page 03 kit component, except for layout frames, text and one progress bar.

## 1. Conventions used

- **Rows.** Each screen gets one horizontal row with a header frame (`<SCR> — Row header`: H1 title plus a caption with roles, UC/WF IDs and Desk/Mob priority). Below the header:
  - Desktop frame at x 0.
  - Mobile frame at x 1520.
  - State frames to the right in three columns, 600 px apart.
  - Rows are spaced 240 px apart vertically.
- **Desktop frames.** 1440×900. The role's desktop shell instance sits at (0,0). The content frame sits at x 240, y 64 (1200×836, 24 px padding). The screen's own nav entry is swapped to `wf/Nav/Item/Active`, and the top-bar attendance chip is overridden for each screen.
- **Mobile frames.** 390×844. The role's mobile shell instance carries the header title and the active tab. Content sits at y 101 (390×678).
- **Signed-out screens (AUTH).** No shell: a centred card on a grey canvas on desktop, and a full-width card on mobile.
- **Shells used:**
  - Owner screens: `wf/Shell/Desktop/Owner` `8:80` and `wf/Shell/Mobile/Owner` `8:316`.
  - Shared SHR screens: the **Call Center** shells `8:217` / `8:364`, as a representative role. The SHR-001 "Role variants" state lists the DE, CC, DEV and OWN differences.
- **State frames.** Small auto-layout frames, 560 wide, captioned `STATE · …`, named `SCR-XX-nnn — <name> — Desktop — <state>`. They show the affected region only, not a whole screen.
- **Drawers.**
  - Built from `wf/Overlay/Scrim` plus `wf/Drawer` at x 960, title and footer labels overridden.
  - The drawer's three default body fields are hidden, because the instance body cannot take children. A "Drawer body" frame is overlaid at (961, 68), 479×760.
  - **Dialogs.** OWN-008 is a composed dialog: a frame built from kit instances, because `wf/Dialog` cannot hold extra content.
- **Policy annotations.**
  - Every unresolved item uses a `wf/Annotation/Policy` instance, for example `[DEC-009 pending: office check mode]`.
  - DEC alternatives are drawn side by side, each labelled "not selected": DEC-026 A/B/C, DEC-011 A/B, R-11 a/b, DEC-012 mandatory/optional.
  - Items with no DEC ID say so: `[No DEC ID: …]`, `[Impl. decision: …]`, `[Proposed: …]`.
  - Designer notes use `wf/Annotation/Note`.

## 2. Page 10 — Shared (`1:5`)

| SCR | Row header | Desktop | Mobile | State frames |
|---|---|---|---|---|
| SCR-AUTH-001 Login | `14:2` | `14:5` | `14:34` | `14:63` Validation error · `14:75` Invalid credentials · `14:86` Deactivated account · `14:97` Session expired · `14:108` Loading |
| SCR-AUTH-002 Owner 2FA challenge | `14:119` | `14:122` | `14:154` | `14:186` Wrong or expired code · `14:195` Verification failure · `14:210` R11-a reading · `14:220` R11-b reading · `14:232` Success |
| SCR-AUTH-003 Owner 2FA enrollment & recovery | `15:141` | `15:144` | — (Mob —) | `15:189` Verification failure · `15:198` Recovery (lost factor) · `15:208` Recovery used · `15:217` Recovery failed · `15:230` Success |
| SCR-AUTH-004 Forgot / reset password | `15:235` | `15:238` | `15:252` | `15:266` Request sent · `15:277` Set new password · `15:296` Link expired or used · `15:307` Password rule error · `15:314` Success |
| SCR-SHR-001 My Day | `19:234` | `19:237` | `19:432` | `19:533` Checked in · `19:549` Open session from earlier day · `19:569` Empty work list · `19:579` Insufficient work · `19:592` Role variants · `19:622` Loading |
| SCR-SHR-002 Check-in flow | `19:631` | `19:634` | `19:739` | `19:794` Verifying · `19:805` Success (+ punctuality) · `19:820` Verification failure · `19:842` Open-session block · `19:855` Remote exception recorded |
| SCR-SHR-003 Checkout + work summary | `20:3812` | `20:3815` | `20:3919` | `20:3973` Summary empty · `20:3985` Verification failure · `20:4001` DEC-026 Alt A blocked · `20:4016` DEC-026 Alt B provisional · `20:4031` DEC-026 Alt C pending review · `20:4046` Success closed |
| SCR-SHR-004 My Attendance history | `20:4057` | `20:4060` | `20:4227` | `20:4307` Empty · `20:4316` Forgotten checkout flagged · `20:4331` Correction outcomes · `20:4356` Loading |
| SCR-SHR-005 Attendance correction request (drawer) | `22:1104` | `22:1107` | `22:1267` | `22:1324` Validation error · `22:1336` Submitted pending · `22:1354` Approved or rejected |
| SCR-SHR-006 My Profile | `22:1372` | `22:1375` | `22:1504` | `22:1570` Validation error · `22:1582` Save conflict · `22:1598` Success |

Page 10 totals: 10 screens, 10 desktop, 9 mobile, 47 state frames (66 frames plus 10 row headers).

## 3. Page 11 — Owner/Admin (`1:6`)

| SCR | Row header | Desktop | Mobile | State frames |
|---|---|---|---|---|
| SCR-OWN-001 Owner dashboard | `24:2` | `24:5` | — | `24:263` Loading · `24:272` No data · `24:282` Partial data · `24:300` G1 distinctions |
| SCR-OWN-002 Employees | `24:331` | `24:334` | — | `24:520` Empty · `24:529` Assigned-to-inactive flag · `24:541` Loading |
| SCR-OWN-003 Employee create / edit (drawer) | `24:550` | `24:553` | — | `24:799` Create new · `24:819` Validation error duplicate email · `24:826` Save conflict · `24:840` Deactivate impact · `24:877` Success (+ reset-email failure) |
| SCR-OWN-004 Attendance monitoring & exception alerts | `25:721` | `25:724` | `25:955` | `25:1048` Empty · `25:1057` Schedule not configured · `25:1072` Alert delivery failed · `25:1083` Exception detail |
| SCR-OWN-005 Corrections & review queue | `25:1097` | `25:1100` | — | `25:1279` Empty queue · `25:1288` Validation error · `25:1300` Save conflict · `25:1314` Success · `25:1323` DEC-011 Alt A reading · `25:1330` DEC-011 Alt B request review |
| SCR-OWN-006 Targets & work lists | `25:1348` | `25:1351` | — | `25:1552` Insufficient work · `25:1565` Ineligible items · `25:1599` Empty |
| SCR-OWN-007 Calling assignments | `25:12568` | `25:12571` | — | `25:12787` Ineligible excluded · `25:12828` Assigned but inaccessible (B7) · `25:12846` Assigned to inactive agent · `25:12857` Reserved by another agent · `25:12872` Save conflict |
| SCR-OWN-008 Reassignment impact (dialog) | `25:12883` | `25:12886` | — | `25:13144` Override confirm · `25:13162` Save conflict · `25:13173` Success |
| SCR-OWN-009 Reports & exports | `25:13182` | `25:13185` | — | `25:13381` Unauthorized · `25:13390` No data · `25:13401` Generating · `25:13411` Export failure · `25:13422` Success |
| SCR-OWN-010 Audit log explorer | `27:2076` | `27:2079` | — | `27:2258` Event detail · `27:2279` Empty · `27:2288` Loading |
| SCR-OWN-011 Settings | `27:2297` | `27:2300` | — | `27:2509` Not configured · `27:2518` Validation error · `27:2530` Test office check · `27:2546` Save conflict · `27:2557` Success |
| SCR-OWN-012 Delivery & exception monitor | `27:2566` | `27:2569` | — | `27:2757` Empty · `27:2766` Failed item detail · `27:2782` Retrying |

Page 11 totals: 12 screens, 12 desktop, 1 mobile (only OWN-004 is marked Mob P1), 49 state frames (62 frames plus 12 row headers).

**W1 total: 22 screens · 22 desktop · 10 mobile · 96 state frames = 128 frames.**

## 4. Policy placeholders shown (none decided)

- **Attendance:**
  - DEC-007 (schedule, 9 h/day), DEC-008 (grace), DEC-009 (office check mode IP / location / OR / AND), DEC-010 (remote work and fallback), DEC-022 (rest days).
  - DEC-011: SHR-005 is labelled "exists only under Alt B". OWN-005 has Alt A and Alt B state frames.
  - DEC-012: SHR-003 shows both readings, summary mandatory and summary optional.
  - DEC-026: SHR-003 has three frames, Alt A blocked / Alt B provisional / Alt C pending review, each marked "not selected". SHR-004 and OWN-005 carry provisional/review rows labelled "if adopted".
  - F-01 (may a pending correction block the next check-in) appears on SHR-005.
  - Contract A1 "attendance gating not adopted" is a note on SHR-001: the work list stays usable without check-in.
- **Auth:**
  - R-11 → USER: AUTH-002 has R11-a and R11-b state frames.
  - Implementation decisions: 2FA method, recovery channel, password rules, lockout wording, attempt threshold.
  - OQ-12 (operational recovery) on AUTH-003.
- **Targets and work:** DEC-020 (metrics), DEC-021 (Proposed allocation and shortfall), DEC-025 (frequency), R-03/B8 hand-off on OWN-006.
- **Calling assignment:**
  - DEC-001/002 (B7 assigned but inaccessible), DEC-017 (B6 open deal), C-01 (B4 archived), phone mandatory (B2, no DEC ID), DEC-004 (Proposed override).
  - B3-Q03: follow-up handling on reassignment has no default. OWN-008 makes the Owner choose for each follow-up, and Confirm stays disabled until every follow-up has a choice.
- **Reporting:** DEC-002 (export scope), DEC-018 (revenue not shown), the sync/async export ADR, and the Development workload definition (Proposed, SB-3 §11). The G1 distinctions are labelled in OWN-001 and OWN-004: attempts ≠ businesses contacted, accepted ≠ closed, closed ≠ completed project, not checked in ≠ absent.
- **Admin and monitoring:**
  - Audit retention (no DEC ID).
  - Alert and notification timing, recipients and escalation (no DEC ID).
  - Retry policy (Phase 3).
  - F2 provisioning trigger.
  - "Owner 2FA mandatory (Confirmed), not a setting" on OWN-011.

## 5. Inventory change requests (inventory not edited)

1. **New open questions added on canvas without a DEC ID.** Please confirm or remove each:
   - OWN-008 "undo after reassignment?"
   - OWN-008 "is the previous agent informed?" (already in the inventory)
   - OWN-011 "effective date of settings changes"
   - SHR-006 "revoke other sessions on password change" (implementation decision)
   - SHR-006 "sign out of all sessions" offered to employees (the inventory says "all sessions?" but does not classify it)

   Proposal: list them in the policy column of these screens.
2. **SCR-SHR-001 / 002 / 003 / 004 / 005 / 006 shell choice.** The inventory does not say which role shell represents a shared screen. W1 used the Call Center shell and added a "Role variants" state on SHR-001. Proposal: add a note to inventory §10.
3. **SCR-OWN-004 exception detail (flow M6).** The sitemap flow M6 has an exception-detail step, but there is no SCR ID for it. W1 drew it as a state frame of OWN-004. Proposal: state that it is part of OWN-004.
4. **SCR-OWN-007 tabs.** "Opportunities" (SCR-CC-007) and "Do-not-call" (SCR-CC-008) appear as tabs on OWN-007, but W2 draws those screens. No change needed; this records the cross-page link.
5. **Kit limitations (for W0, page 03):**
   - `wf/Tabs` has a fixed active Tab 1. W1 reordered labels so the active tab comes first (OWN-005 starts with "Corrections & review").
   - `wf/Drawer` and `wf/Dialog` bodies cannot take extra content. W1 used the overlay workaround and a composed dialog.
   - `wf/Table/Row` status cell is 140 px wide, so long badge labels truncate. The OWN-007/008 badge was renamed "Inaccessible (B7)".

   Proposal: add an active-tab variant or property, and an exposed body slot.

No blocking contradiction was found.

## 6. Verification

**Created**
- 128 frames and 22 row headers on pages `1:5` and `1:6`, all listed above.
- Only kit instances, layout frames and text were used: 460 instances on page 10 and 806 on page 11. Every instance has a main component (count of instances without a main component = 0).

**Read back**
- `use_figma` read of both pages:
  - Page 10 has 76 top-level nodes; page 11 has 74.
  - Top-level frame overlaps: 0 on both pages.
  - Desktop and mobile content frames: none overflow their 836 / 678 px height.
  - An overflow scan of children against their auto-layout parents found 5 policy annotations and 1 toast exceeding parent width. All were shortened, and the re-scan returned 0 on page 10. The single page 11 hit (the toast) was fixed after its scan.
- `get_metadata` on `14:34` (Login mobile) found the overflowing annotation, which was then fixed.

**Visually inspected (`get_screenshot`)**
- Desktop: AUTH-002, AUTH-003 (before and after the fix), SHR-001, SHR-004, SHR-005, SHR-006, OWN-001, OWN-002, OWN-003, OWN-004, OWN-005, OWN-006, OWN-007, OWN-008, OWN-009, OWN-011, OWN-012.
- Mobile: SHR-001, SHR-002 (before and after the fix), SHR-003, SHR-004, OWN-004.
- State: AUTH-002 R11-b.
- Whole page 10 at thumbnail scale (row layout).
- Fixes applied, each in 1–2 attempts:
  - AUTH-003 step boxes overflowing: boxes set to fill, card widened to 960.
  - Clipped annotations on SHR-002 mobile, OWN-004 desktop and OWN-011 (that policy row now wraps).
  - OWN-005 active tab.
  - The truncated B7 badge.
  - Login: the "Keep me signed in" checkbox was removed, because it was not in the spec and would have implied a session-lifetime decision.

**Not inspected / known limits**
- Not screenshotted after creation; covered by the structural scans only:
  - AUTH-001 desktop and mobile, AUTH-002 mobile, AUTH-004 desktop and mobile, SHR-002 desktop, SHR-003 desktop, SHR-005 mobile, SHR-006 mobile, OWN-010 desktop.
  - All state frames except one.
- The overflow scan does not cover the absolutely positioned drawer-body and dialog overlays. Those were checked by screenshot (SHR-005, OWN-003, OWN-008).
- Text inside kit instances (for example table cells that wrap to two lines) was not checked one by one.
- Low-fi only: greyscale, light theme, no dark mode, no brand styling, no prototype links.
- Nothing here is approved. All DEC items stay pending.
