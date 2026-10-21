# Phase 4 — Wireframes W2: Data Entry (page 12) and Call Center (page 13)

Owner: Wireframe Agent W2. Version: P4-W2-1, 2026-10-20. Status: **proposed — for user review, not approved.**
Figma design file `GNrhb3DWa6mIhEX6F4Nmvw`. W2 wrote only on page `12 Data Entry` (`1:7`) and page `13 Call Center` (`1:8`). Kit components on page `03` (`1:4`) were only instantiated, never edited.

## 1. How the pages are built

- **One Figma section per screen** (a "row"), stacked vertically (1200 px pitch). Each section has a header: the SCR ID and name, then roles, UC/WF, priority and the list of states drawn.
- **Desktop frames** are 1440×900: a `wf/Shell/Desktop/<Role>` instance at (0,0) plus a `Content` auto-layout frame at (240, 64), 1200×836, 24 px padding (inventory §10 assembly rule). The screen's own nav item is swapped to `wf/Nav/Item/Active`.
- **Mobile frames** are 390×844: a `wf/Shell/Mobile/<Role>` instance plus `Content` at (1, 101), 388×678. Header title and active tab are set on the shell instance.
- **Drawers**: `wf/Overlay/Scrim` + `wf/Drawer` at x 960. The drawer's sample body inputs are hidden (instance override) and a `Drawer body content` frame is laid over the body area. Title and footer buttons are set on the drawer instance. On mobile the drawer becomes a bottom sheet (390×720 at y 124).
- **Dialogs**: `wf/Dialog` has no content slot. Dialogs that need inputs, cards or annotations are composed frames named `Dialog (composed from kit parts)`: a white panel holding kit instances (buttons, inputs, cards, badges, policy tags). See change request K-1.
- Everything else is a kit instance: page header, filter bar, table header/rows, list items, inputs, selects, date, textarea, checkboxes, chips, tabs, badges (derived = dashed), cards, banners, toasts, empty/loading/error/restricted states, calendar week, policy and note annotations. Plain text nodes use the `wf/*` text styles. Greyscale only.
- Frame names follow `SCR-XX-nnn — <name> — Desktop|Mobile[ — <state>]`. Some long names are shortened (see §5, N-1).

Totals: **90 frames** — page 12: 42 (38 desktop, 4 mobile); page 13: 48 (36 desktop, 12 mobile). 18 inventory screens, all covered. Every screen marked P1/P2 in the Mob column has at least one mobile frame.

## 2. Screen → frames (node IDs)

### Page 12 Data Entry (`1:7`)

| SCR | Section | Frames |
|---|---|---|
| SCR-DE-001 Business directory | `17:284` | Desktop `17:287` · Owner view (hidden-for-others marker) `17:447` · Empty `17:643` · Loading `17:732` · Error `17:826` · **Mobile** `17:913` |
| SCR-DE-002 Create business | `19:2697` | Desktop `19:2700` (multiple phones, 2 social accounts, Unknown followers/last post with checkbox, website checkbox + URL) · Validation errors (all listed together) `19:2905` · Success `19:3108` · **Mobile** `19:3187` |
| SCR-DE-003 Duplicate blocked (dialog) | `21:1762` | Visible match `21:1765` · Hidden match (limited-preview placeholder) `21:1854` · Owner full match, still blocked `21:1937` · Name-only warning (DEC-013 branch) `21:2056` |
| SCR-DE-004 Edit business | `19:3255` | Desktop `19:3258` · Duplicate blocked (self-excluded) `19:3456` · Save conflict `19:3659` · Validation error (last social account) `19:3862` · Success + edit history `19:4010` |
| SCR-DE-005 Resolve correction (drawer) | `21:2378` | In review `21:2381` · Already resolved by someone else `21:2617` · Duplicate blocked on apply `21:2820` · Success `21:3027` |
| SCR-DE-006 Correction-request queue | `21:2137` | Desktop (incl. redacted row for a hidden business) `21:2140` · Empty `21:2298` |
| SCR-DE-007 Categories | `23:2873` | Desktop (Owner) `23:2876` · Name exists `23:3044` · In use — cannot remove `23:3225` · Permission denied (Data Entry) `23:3406` |
| SCR-SHR-008 Business detail | `24:8578` | Desktop (DE) `24:8581` · Call Center read-only `24:8704` · Developer context-limited `24:8834` · Hidden by policy `24:8958` · Permission denied `24:9044` · **Mobile** `24:9116` |
| SCR-SHR-009 Submit data correction (drawer) | `24:9178` | Desktop (with "open request exists" warning) `24:9181` · Validation error `24:9306` · Submitted `24:9438` · **Mobile** (sheet) `24:9519` |
| SCR-SHR-010 Search results | `23:3484` | Desktop (DE) `23:3487` · Owner view `23:3613` · Empty, no hint of hidden matches (CC scope) `23:3784` |

### Page 13 Call Center (`1:8`)

| SCR | Section | Frames |
|---|---|---|
| SCR-CC-001 Calling queue | `25:10626` | Desktop (7 derived buckets) `25:10629` · Owner view (agent switch, B7 "assigned but inaccessible") `25:10793` · Empty `25:10987` · Loading `25:11080` · Error `25:11158` · **Mobile** `25:11229` · **Mobile — Empty** `25:11314` |
| SCR-CC-002 Contact workspace | `25:11349` | Desktop (read mode) `25:11352` · Start Contact disabled — Rejected `25:11478` · Start Contact disabled — not assignee `25:11614` · Hidden by policy `25:11748` · **Mobile** `25:11830` · **Mobile — Rejected** `25:11896` |
| SCR-CC-003 Active contact — log attempt & outcome | `26:12805` | Needs another call (follow-up in same save or marker, D2) `26:12808` · Rejected `26:12951` · Accepted (handoff, developer optional, E5) `26:13096` · Save failed `26:13255` · Save conflict `26:13398` · **Mobile** `26:13541` · **Mobile — Success** `26:13608` |
| **SCR-CC-005** Contact reservation & concurrency block | `26:13670` | Reserved by another agent `26:13673` · Owner force override (reason) `26:13756` · Reservation expired `26:13879` · Network loss `26:14027` · Stale client `26:14170` · Overridden by Owner (notice to holder) `26:14317` · **Mobile — Reserved by another agent** `26:14464` · **Mobile — Reservation expired** `26:14507` |
| SCR-CC-004 Follow-ups & calendar | `27:15050` | List `27:15053` · Week calendar `27:15213` · Empty `27:15320` · Cancel with reason (D2 guard) `27:15400` · **Mobile** (list default) `27:15577` · **Mobile — Empty** `27:15657` |
| SCR-CC-006 Follow-up create / reschedule (drawer) | `27:15692` | Create `27:15695` · Reschedule (reason + history) `27:15812` · Past time rejected `27:15933` · Save conflict `27:16050` · Success `27:16155` · **Mobile — Create** `27:16318` · **Mobile — Past time rejected** `27:16393` |
| SCR-CC-007 Opportunities & developer handoff | `27:16886` | Desktop (developer not yet assigned, meeting not yet arranged) `27:16889` · Developer assigned `27:17041` · Empty `27:17198` · Owner view `27:17269` |
| SCR-CC-008 Do-not-call list & reopening | `27:17458` | Desktop (CC: reopen not permitted) `27:17461` · Owner reopen (reason) `27:17591` · Reopened `27:17781` |

States from brief §6 that are relevant here and where they appear: empty, loading, error (DE-001, CC-001, plus empty on most lists); permission denied (DE-007, SHR-008); duplicate blocked — active and hidden (DE-003, DE-004, DE-005); hidden-by-policy (SHR-008, CC-002, redacted row DE-006); reserved-by-another-agent (CC-005); save conflict (DE-004, DE-005, CC-003, CC-006); success (DE-002, DE-004, DE-005, SHR-009, CC-003, CC-006, CC-007, CC-008); verification failure and session expired are not used on these screens (owned by W1 / W3 page 15).

## 3. Policy placeholders shown (all via `wf/Annotation/Policy`, none decided)

| Policy item | Where |
|---|---|
| DEC-001 15-day timer basis | DE-001, DE-004 success, SHR-008, SHR-010, CC-001, CC-002 hidden |
| DEC-002 active-work exceptions (incl. row 6 correction requests; Alt B callback + 48 h) | DE-001, DE-006, SHR-008, SHR-010, CC-001, CC-002 hidden, CC-004 |
| DEC-003 hidden-match revelation / no leakage | DE-003 hidden match (labelled empty preview box), DE-005 dup-on-apply, SHR-008 hidden, SHR-010 |
| DEC-004 lease duration & idle rule | CC-002, CC-003, CC-005 |
| DEC-005 Developer access before closure | SHR-008 (DEV), CC-003 Accepted, CC-007 |
| DEC-013 name / branch matching; name-only block vs warn | DE-002, DE-003 visible + name-only branch, DE-004 |
| DEC-014 Unknown storage · DEC-023 follower history · DEC-024 platform priority | DE-002, DE-004 forms |
| DEC-015 category authority | DE-002 ("Suggest / add category"), DE-007, nav label "Categories [DEC-015]" |
| DEC-016 who may reopen; outcome after reopening | CC-002 mobile Rejected, CC-008 |
| DEC-017 several deals per business / open deal exists | CC-003 Accepted, CC-007 |
| R-10 → USER outcome state model · C-02 "attempt only" option | CC-003 |
| C-01 archive vs delete (no delete control drawn) | DE-001, DE-004, DE-007 |
| B2 phone mandatory (no DEC ID) | DE-002, DE-004 |
| D4 open follow-ups on Rejected/Accepted (no DEC ID) | CC-002 Rejected, CC-003 Rejected/Accepted |
| B3-Q05 late save after reservation loss (no DEC ID) | CC-005 stale client, overridden |
| B3-Q09 request-and-approve reopening (no ID) | CC-008 |
| Owner override rules [Proposed, no DEC ID] | CC-005 Owner override |
| No DEC ID: attempt backdating; overdue threshold; reminder timing/lead time/escalation; several open follow-ups; who resolves corrections; requester / reviewer notification; deactivate vs delete-if-unused categories; handoff notification channel | CC-003, CC-001, CC-004, CC-006, DE-005, SHR-009, DE-007, CC-007 |
| Contract A1 (no attendance gating) | Noted on DE-002 and CC-001 |

## 4. Inventory change requests (not applied — for W0 / orchestrator)

- **ICR-1** SCR-DE-003: add "Name-only / similar-name warning (DEC-013 Alt NM-C / SN-1)" to Key states. It is drawn as a labelled policy branch (`21:2056`).
- **ICR-2** SCR-DE-003: state that the same dialog also serves SCR-DE-004 and SCR-DE-005 apply (self-excluded check) and the concurrent-duplicate-at-save case (DR-8). W2 shows DE-004/DE-005 variants inline as banners plus inline field errors.
- **ICR-3** SCR-CC-003: add "Accepted while an open deal already exists (DEC-017 step 5a)" as a policy branch state. W2 shows only the annotation; no separate frame.
- **ICR-4** SCR-CC-008: if DEC-016 selects request-and-approve, a reopen-request screen/state is needed (B3-Q09 has no ID).
- **ICR-5** SCR-CC-001 Owner view is reached from SCR-OWN-007; consider listing "Owner view" explicitly in Key states (it is listed for B7 only).
- **ICR-6** SCR-SHR-009 lives on page 12 but is used mainly from Call Center / Developer contexts; consider noting the host contexts (CC-002, DEV-002, SHR-008) in the row.

**Kit requests (page 03, W0):**
- **K-1** `wf/Dialog` has no content slot. W2 composed dialogs from kit parts (`Dialog (composed from kit parts)`). A dialog with a slot (or a body frame) would keep dialogs as instances.
- **K-2** `wf/Table/Row` status cell is 140 px; badges longer than ~18 characters truncate. W2 shortened labels (e.g. "Needs correction", "No phone (derived)").
- **K-3** `wf/Placeholder/Box` label does not wrap; long labels overflow. W2 used short labels.
- **K-4** `wf/Tabs` has no "selected tab" property (tab 1 is always active). In CC-004 Week the calendar's own tabs were relabelled so "Week" is first.
- **K-5** `wf/Calendar/Week` events sit at fixed days (Tue, Thu ×2); labels were chosen to match those days.

## 5. Known deviations and limits

- **N-1 Shortened frame names:** DE-003 frames use "Duplicate blocked", DE-005 "Resolve correction", SHR-009 "Submit data correction", CC-003 "Active contact", CC-006 "Follow-up create / reschedule" (the "(dialog)/(drawer)" suffix and part of the CC-003 name are dropped). Section names keep the full inventory names.
- Background screens under dialogs/drawers are sometimes simplified to a labelled `wf/Placeholder/Box` (e.g. "Contact workspace (SCR-CC-002)").
- CC-001 mobile chip row intentionally runs past the right edge (horizontal scroll).
- SHR-008 uses the Developer shell for the context-limited and permission-denied variants; these screens are still W2's (inventory puts SHR-008 on page 12).
- Desktop forms are fitted into 1440×900 with a three-column layout; no scrolling long-form frame was drawn.
- Destructive buttons render in the kit's destructive style (outlined, heavy border); not changed.

## 6. Verification (2026-10-20)

**Created**
- Page 12: 10 sections, 42 frames. Page 13: 8 sections, 48 frames. 1,354 + 1,385 instances of kit components; no kit master was edited or detached.

**Read back**
- `get_metadata` on page `1:7` and page `1:8` (outputs saved to file and grepped): 42 and 48 `SCR-…` frames with the expected names and IDs listed in §2.
- `use_figma` structural audit on both pages: section/frame counts, and an overflow check of every instance/text in each `Content` and `Drawer body content` frame against its bounds. Result: 0 overflow on page 12; 1 on page 13 (CC-001 mobile chip row, intentional).

**Visually inspected (`get_screenshot`)** — 22 frames: `17:287`, `17:913`, `19:2700`, `19:2905`, `19:3659`, `21:1854`, `21:2381`, `23:3044`, `24:8704`, `24:8834`, `24:9519`, `25:10629`, `25:10793`, `25:11478`, `26:13096`, `26:13541`, `26:13879`, `27:15213`, `27:15400`, `27:15812`, `27:16889`, `27:17591`.
- Fixes applied (one attempt each, all successful by read-back):
  1. DE-001 status badges truncated → shorter labels (7 badges).
  2. DE-002/DE-004 social column overflowed below the frame → DEC-014/023/024 tags moved to column C (6 frames); TikTok followers value in the error variant set to "Unknown".
  3. DEC-024 tag clipped → shortened label (6 instances).
  4. DE-003 hidden-match preview label overflowed → shorter label.
  5. CC-001 wrapped bucket chips did not grow (fixed height) → auto height (3 frames); re-inspected `25:10793`.
  6. CC-003 Accepted policy row clipped → wrap enabled.
  7. CC-004 Week: event on Thu labelled for a Wednesday item → relabelled.
  8. CC-005 frame names shortened → renamed to the full screen name (8 frames).

**Not inspected / limits**
- The remaining 68 frames were checked only by the structural/overflow audit, not by screenshot. Text truncation inside kit instances (fixed-width cells, chips) is not detected by that audit.
- Fixes 2–4, 6 and 7 were verified by read-back, not by a fresh screenshot (except 5).
- Dark theme, real data volumes, long names and localisation are not represented (low-fi, light only).
- Prototype links between frames are not drawn.
- Nothing here is approved; every policy element stays pending with its DEC / contract ID.
