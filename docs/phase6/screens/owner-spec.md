# Phase 6 — Owner/Admin screens (page 41 `96:3`): build notes

Owner Agent, 2026-10-21. Scripts: `docs/phase6/scripts/owner/C01…C12`. The single operator runs them with `use_figma`. Every script returns `{ created, updated, removed, fit, warnings }`.

## Run order and dependencies

| # | Script | Screen | Depends on |
|---|---|---|---|
| 0 | `docs/phase5/scripts/owner/01-s2-dashboard.js` (re-run on page 30) | S2 sample: P4 + P5 | DS 13 (Percent axis) |
| 1 | `C01-dashboard.js` | SCR-OWN-001 | step 0: it clones the page-30 S2 frames |
| 2 | `C02-employees.js` | SCR-OWN-002 | — |
| 3 | `C03-employee-drawer.js` | SCR-OWN-003 | C02: backdrop is a clone of OWN-002 |
| 4 | `C04-attendance-monitoring.js` | SCR-OWN-004 (preserved ID) | — |
| 5 | `C05-attendance-corrections.js` | SCR-OWN-005 | — |
| 6 | `C06-targets-worklists.js` | SCR-OWN-006 | DS 13 |
| 7 | `C07-calling-assignments.js` | SCR-OWN-007 | — |
| 8 | `C08-reassignment-impact.js` | SCR-OWN-008 | C07: backdrop is a clone of OWN-007 |
| 9 | `C09-reports-exports.js` | SCR-OWN-009 | — |
| 10 | `C10-audit-log.js` | SCR-OWN-010 | — |
| 11 | `C11-settings.js` | SCR-OWN-011 | — |
| 12 | `C12-delivery-monitor.js` | SCR-OWN-012 | — |

Scripts are 26.9k–38.6k characters each. Each one inlines only the helper-library functions it uses, so the files differ in length.

## Conventions
- **Sections.**
  - One section per screen, named `SCR-OWN-nnn — <name>`.
  - A section is created at x 0, at y = bottom of the lowest existing section + 400. Its position is set only on creation.
  - On a re-run, the section is found by name, emptied and rebuilt in place. The section ID stays stable; frame IDs change.
- **Frame names.** `SCR-OWN-nnn — <name> — Desktop|Mobile — Light|Dark[ — <state>]`.
- **Frame layout inside a section.**
  - Row 1 (y 80): Light primary at x 80, Dark primary at 1600, and (OWN-004 only) mobile Light at 3120 and mobile Dark at 3590.
  - State rows start at y 1140, with columns 1520 apart and rows 1060 apart.
  - The annotation row sits below the frames.
  - Every frame has a caption 40 px above it.
- **Shell.**
  - Desktop: `Shell/Desktop` Role=Owner. TopBar shows Rana Haddad, "Checked in · 08:52". The screen's own nav item is set to State=Active, and the Delivery Monitor badge reads 4.
  - Mobile: `Shell/Mobile` Owner with tabs Today · My Day · Alerts · More.
  - Content is a 1200×836 auto-layout frame at (240, 64) with 24 px padding, or 390×724 at y 56 on mobile.
- **Composition (DS instances only).**
  - Tables are local rows of `Table/HeaderCell` and `Table/Cell` instances. Widths are set on the cells, which are top-level instances, never on instance children. Custom cells are local frames holding DS chips and flags.
  - Card content goes into native slots, as do Drawer Content/Footer and Dialog Content.
  - Fields are set to FILL or given an explicit width of at least 120.
  - Progress uses `Progress/Bar` with Percent and FILL. If the Percent axis is missing, a flagged token-drawn fallback is used.
- **Text.** Every visible text is set explicitly.
- **Themes.** Dark frames set Semantic mode `40:2` on the frame.
- **Fit checks.**
  - `fit[<frame>]` gives `contentFree` (px left in the 836/724 viewport; negative = below the fold) and `widthOver`.
  - Drawers return `<frame> · drawer free`; dialogs return `<frame> · dialog h`.
  - The section returns its size.
  - Every overflow is also pushed to `warnings`.

## P4 / P5 (page-30 sample, `01-s2-dashboard.js`)
- **P4.**
  - Exceptions chips gap changed from 8 to 4.
  - The new `tuneExceptions()` steps the row gap 6 → 4 → 2 until the DEC-026 chip is at least 24 px above the card bottom (16 px padding + 8 px).
  - It returns `fit['Exceptions · Light|Dark']` = { chipBottomClearance, rowGap, chipLines }. It warns if the clearance is below 24 px, and again if below 16 px.
  - The stale "Card Exceptions: body overflows" warning is removed.
- **P5.** The Targets bars are now `Progress/Bar` instances: Percent rounded to 5, labels hidden (the label/value row above is unchanged), FILL. No instance child is resized.

## Per screen

| Screen | Frames | Notes / policy labels |
|---|---|---|
| OWN-001 Dashboard | Light, Dark (clones of approved S2) · Loading · No data · Partial data | **G1 distinctions:** in the primary frames (annotation O2). **No data:** Custom range 3–4 Oct; period tiles read "—" / "No data for this period"; snapshot tiles are unchanged. **Partial:** Calling source failed ("Unavailable", Retry). **Labels:** B-1, SB-3, DEC-007/008/022, DEC-020/025, DEC-019, DEC-018, AR-13, DEC-026. |
| OWN-002 Employees | Light, Dark · Deactivated + assignee-inactive · Empty (no matches) · Loading | Account ≠ session ≠ attendance. Omar shows a "Missing checkout" flag. No-DEC-ID notice: open work of a deactivated employee is handled by Owner decision. No delete action. |
| OWN-003 Employee drawer | Edit L/D · Create new · Duplicate email · Save conflict · Deactivate impact · Change role · Success | **Edit:** role and status are read-only in the edit path (RV4-04). Change role… and Deactivate… open dialogs that list the impact and say sessions are revoked. **Reset link:** "queued" (AR-15). **Labels:** credential setup = Implementation decision; open work = no DEC ID; role-change revocation = Proposed. |
| OWN-004 Attendance monitoring | Desktop L/D, Mobile L/D · Empty · Schedule not configured · Alert delivery failed · Exception detail (drawer) | **Content:** "Not checked in yet ≠ absent"; punctuality is a derived "Unclassified" chip; a missing checkout is never auto-closed. **Labels:** DEC-007/008/022, DEC-009, DEC-010, DEC-011; alert recipients/timing (no DEC ID). **Mobile:** Owner "Today" tab, rows are full-width List/Items. |
| OWN-005 Corrections & review | Light, Dark (policy-neutral) · DEC-011 Alt A reading · DEC-011 Alt B reading · Validation error · Save conflict · Success · Empty | **Primary:** facts plus a DEC-011 block only; no alternative is selected. Each reading frame carries a chip "Alt A/B reading — not selected". The "Employee requests" tab appears only in the Alt B frame. **Queue:** DEC-026 rows are labelled "Alt B/C, if adopted". |
| OWN-006 Targets & work lists | Light, Dark · Shortfall · Ineligible items · Empty | **Labels:** DEC-020 (metric names are placeholders, no overall %), DEC-021 (Proposed rule), DEC-025. **Hand-off:** "Hand off … to assignments" goes to WF-CALL-001 (B8). **Ineligible reasons:** B1, B2 (no DEC ID), B6/DEC-017, B4/C-01. |
| OWN-007 Calling assignments | Light, Dark (3 selected) · Ineligible excluded · Needs decision (B7 + inactive agent) · Reserved by another agent · Save conflict | **Flags:** Reserved, B7 and assignee inactive are derived. No automatic reassignment. **Labels:** DEC-021, DEC-017, C-01, DEC-001/002. **Tabs:** link to CC-007 and CC-008 (page 43). |
| OWN-008 Reassignment impact | Light, Dark (nothing chosen, Reassign disabled) · All choices made · Override confirm · Save conflict · Success | **Choices:** no default for follow-ups (B3-Q03); Wait saves nothing. **Labels:** DEC-004 (Proposed); "previous agent informed?" (no DEC ID). **Deal:** Peak Fitness keeps Developer Lina Aoun. |
| OWN-009 Reports & exports | Light, Dark · Unauthorized (Call Center shell) · No data · Preparing download (in-request) · Export failure · Success | **Export:** synchronous and streamed (ADR-010); there is no "generating later" state. **No data:** Export is disabled. **Audit:** report.exported / export_failed / export_denied. **Labels:** DEC-018, DEC-002. |
| OWN-010 Audit log | Light, Dark · Event detail (before/after drawer) · Empty · Loading | **G3:** there is no edit, delete or hide control. **Open items:** OQ-18 (export) and OQ-19 (retention) chips. Placeholder event names are noted. |
| OWN-011 Settings | Light, Dark · Not configured · Validation error · Test office check · Save conflict · Success · Security tab | **Nothing preselected:** no DEC-009 mode (four RadioCards, all unselected), no working days, shift start or grace. **Confirmed:** 9 h workday. **Not a setting:** Owner 2FA. The IP is in the documentation range 203.0.113.0/24. |
| OWN-012 Delivery monitor | Light, Dark · Failed item detail · Retrying · Empty | **Send again:** reminders only, creates a new reminder (AR-13). Notifications have View only. There is no "Mark reviewed" (removed under AR-13). **Provisioning:** 0 items; the type is kept (F2/F3). **Badge:** 4 = 4 items. |

## Known limits / for review
- **OWN-001 depends on page 30.** The bars come from the sample, so re-run C01 after any change to `01-s2-dashboard.js`. On the No data and Partial tiles the Flat trend icon is hidden on a best-effort basis (layer name `Icon*`); check it in the preview.
- **Viewport overflow.** OWN-003 drawer bodies and OWN-007/008 frames are the most likely places for content to run past the viewport. Read `fit` and `warnings`.
- **Security-email failures** (reset link, invitation) are described in OWN-012 Empty copy and annotations, not as rows. That keeps the nav badge consistent with the dashboard (4).
- **No Component requests.**
