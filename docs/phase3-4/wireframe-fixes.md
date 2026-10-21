# Phase 4 — Wireframe fixes after the independent review (RW-01..RW-07)

Figma Operator, 2026-10-20. Design file `GNrhb3DWa6mIhEX6F4Nmvw`. Source: `reviews/phase4-review.md` §2.
Status: Phase 4 is still "proposed — for user review". Nothing here is a decision. Every policy alternative stays labelled as pending.
Figma calls used: 17 `use_figma` calls (5 reads, 6 writes, 6 scan/screenshot calls). No `get_screenshot` calls; screenshots were taken inline with `node.screenshot()`. **No quota or rate-limit error occurred.**

## RW-01 — DEV-001 company-wide list leaked pre-closure records (page 14, `17:1231`)
- The "Closed deals — company-wide eligible" tab now lists only Closed deal rows:
  - Rows `17:1356`, `17:1366` and `17:1375` were changed from Signed and paid / Signed / Paid to Closed deal. Their cells were updated (`I…;6:45..48`), and each badge `I…;6:50` was swapped to `wf/Badge/Status/Dark` "Closed deal".
  - The rows for Atlas Auto Parts (another Developer's closed deal) and Cedar were kept. A closed deal is eligible company-wide under WF-ACCESS-001.
- Removed:
  - the unassigned "Accepted opp." row (Olive Tree Café) `17:1384`
  - the "Not proceeding" row `17:1394`
  - the "Developer not yet assigned" quick chip `17:1321`
- Chip `17:1318` "Assigned to me" was swapped from active to inactive (`wf/Chip/Filter`), so it matches the company-wide rows.
- Caption `17:1327` now reads: "Closed deals only · no pre-closure or unassigned rows · inaccessible rows omitted, not counted (WF-ACCESS-001)."
- The DEC-005 annotation text `I17:1405;7:126` now reads: "[DEC-005 pending: Alt 1 — 'Accepted opportunities' tab lists only rows assigned to you · Alt 2 — tab absent]".
- Not changed: the "Not proceeding" tab label `I17:1292;3:174` is still there. Whether a Developer sees their own not-proceeding records was not part of RW-01.

## RW-02 — Owner desktop check-in entry
- Kit master `wf/Shell/Desktop/Owner` `8:80` (page 03) has a new nav item **"My Day (check in)"** (`31:284`, an instance of `wf/Nav/Item`). It sits in Left nav `8:81` just above "My Profile". The spacer `8:142` is FILL and absorbed the height, so the nav still fits 900 px.
- The new item reaches all 12 Owner desktop shell instances on page 11 and the two new Owner frames on page 14. It routes to SCR-SHR-001, then SCR-SHR-002/003.
- Docs: `sitemap.md` §3.1 has a new row "(bottom) My Day (check in) → SCR-SHR-001 → SHR-002/003". The `screen-inventory.md` SCR-SHR-001 roles cell now names the Owner desktop nav item and the mobile My Day tab.
- Not done:
  - An Owner note or state on SHR-001 "Role variants" for R-11 (pending-2FA check-in).
  - Changing the passive top-bar "Not checked in" chip into a control.

## RW-03 — Development workload as three SB-3 §11 sub-counts
Both tiles now use the same labels.

| Tile | Label | Value | Note |
|---|---|---|---|
| OWN-001 `24:217` (in `24:5`) | "Development workload — Proposed" | "3 · 5 · 12" | "Deals · Projects · Tasks (all Developers)" |
| DEV-005 `23:7078` (in `23:6988`) | "Development workload — Proposed" | "2 · 4 · 7" | "Deals · Projects · Tasks" |

Annotations:
- OWN-001 `24:259`: "[Proposed: SB-3 §11 workload]". It was shortened after it clipped.
- DEV-005 `I23:7162;7:126`: "[Workload = SB-3 §11 three sub-counts — Proposed]".

## RW-04 — Owner side of DEC-006 Alt B and "remove fact entered in error" (page 14, DEV-002 section `19:2008`)
Two new frames were cloned from `19:2321`. They use the Owner shell, with its overrides reset and "Deals & Meetings" set as the active nav item. Section `19:2008` was widened from 7640 to 10720.

- **`30:3534`** "SCR-DEV-002 — Deal record detail — Desktop — Owner view: closure verification review (DEC-006 Alt B — not selected)", at x 7640:
  - Warning banner: "Closure verification requested by R. Haddad".
  - Actions `30:3789`: "Verify & finalize closure" and "Reject with reason…".
  - Closure card shows "Requested — awaiting your review".
  - Annotations "[DEC-006 Alt B — not selected · R-12 → USER]" and "[Owner finds review items: DEV-001 Owner filter + OWN-001 attention list — Proposed]".
- **`30:3800`** "… — Owner view: remove recorded fact (reason)", at x 9160:
  - Scrim `30:4008`.
  - Composed dialog `30:4009` containing:
    - "Remove recorded fact"
    - an explanation that the stage reverts from Signed and paid to Signed, and that the removal stays in history and audit
    - select "Fact to remove" (`30:4012`) and textarea "Reason (required)" (`30:4017`)
    - "[DEC-006 / R-12 → USER pending]"
    - buttons Cancel and Remove fact (destructive)
  - Info banner: "Owner view".
- Still open for the inventory owner: the review asked that the inventory say where the Owner finds closure review items. That line is outside my delegated edits. The proposal is shown only as an annotation in `30:3534`.

## RW-05 — DE-003 hidden match copy (page 12, `21:1854`)
- Body text `21:1935` now reads: "A matching business exists. Saving is blocked. [DEC-003 pending: what may be shown]". The words "outside your access" were removed.
- The preview placeholder ("Limited preview — pending DEC-003") and the policy annotation were kept.

## RW-06 — DE-006 redacted row (page 12, `21:2140`)
- Row `21:2267` now reads: "Business hidden by policy · — · — · —", with the badge "Owner review only". The issue type, requester and age were removed.
- Tab `I21:2204;3:170` was changed from "Open (7)" to "Open (4)". The count excludes the hidden row.
- Policy annotation `I21:2287;7:126`: "[OI-08 / DEC-002 row 6 pending → USER: redacted row vs omitted]".
- Note `21:2296`: it explains the redaction and the tab-count exclusion, and says the other alternative is to omit the row and not count it. It also says neither alternative is selected.
- Not drawn: the alternative (row omitted) as a separate side-by-side frame. It is annotated only.

## Kit — `wf/Annotation/Policy` wrap
Not done. The master `7:123` uses a HUG text. Switching it to wrap would resize about 230 instances across pages 10–15, and that cannot be done cheaply or safely. Long labels were shortened where they were edited.

## RW-07 — limited checkpoint pass
- **Programmatic overflow scan:** every `SCR-*` frame on pages 10–15 was scanned for text extending beyond its nearest clipping ancestor (2 px tolerance). Result: **0 hits** across 296 frames and 9,741 text nodes.

  | Page | Frames | Hits |
  |---|---|---|
  | 10 | 76 | 0 |
  | 11 | 74 | 0 |
  | 12 | 42 | 0 |
  | 13 | 48 | 0 |
  | 14 | 37 | 0 |
  | 15 | 19 | 0 |

  The scan does not detect overlapping siblings or wrong content. It only detects clipping.
- **Screenshot checkpoints** (inline, 0.4–0.5×):

  | Group | Frames |
  |---|---|
  | Fixed screens | DEV-001 `17:1231`, DEV-005 `23:6988`, new `30:3534` and `30:3800`, OWN-001 `24:5`, DE-003 `21:1854`, DE-006 `21:2140` |
  | Never inspected before | AUTH-001 desktop `14:5`, AUTH-001 mobile `14:34`, AUTH-004 mobile `15:252`, SHR-002 desktop `19:634`, SHR-013 Expired `27:14937`, SHR-013 In-app dialog `27:14966`, SHR-014 mobile `27:16593` |

  None of these showed misleading clipped or overlapping text.
- Clips found and fixed during the pass:
  - the DEV-001 caption, after my own edit
  - the OWN-001 workload annotation
- **Still not visually inspected at readable scale** (the scan only checked clipping on these):
  - AUTH-002 mobile `14:154`; AUTH-004 desktop `15:238`; AUTH state frames (`14:63`–`14:108`, `14:186`–`14:232`, `15:189`–`15:314`)
  - SHR-003 desktop `20:3815`; SHR-005 mobile; SHR-006 mobile
  - OWN-010 `27:2079`
  - most W1 state frames
  - SHR-013 Revoked `27:14950`, Deactivated `27:14958` and Mobile `27:15038`; SHR-015 all
  - CC-005 all states; DE-003 visible / Owner / name-only; DE-004 duplicate and conflict
  - DEV-004, DEV-006 and DEV-007 mobile
  - most W2 frames and all other W3 mobile frames

## Quota
No quota or rate-limit error occurred during Task 1.

## Task 3 — wireframe edits from brief §8 rulings (AR-12..AR-15)

Applied 2026-10-20 in file `GNrhb3DWa6mIhEX6F4Nmvw`. All changes are labelled Proposed. No quota error occurred.

- **AR-12** (page 12, DE-003 section `21:1762`):
  - The roles/states caption `21:1764` now says the dialog is shared by business create, business edit and applying a data correction (DE-004 / DE-005), including a concurrent create detected at save. It also says the hidden-match variant shows existence only (DEC-003 pending). The text was widened to 6000 px so it stays on one line.
  - The hidden-match copy `21:1935` already reveals existence only (RW-05).
- **AR-13** (page 11, OWN-012 `27:2569`):
  - The Failed reminder row `I27:2692;6:52` and the Suppressed reminder row `I27:2712;6:52` now read "Send again (creates new reminder)".
  - The Suppressed notification row `I27:2702;6:52` changed from "Mark reviewed" to "—". AR-13 covers reminders only.
  - The provisioning row keeps "Retry ›", because the J-07 / F3 retry is a separate mechanism.
  - The policy annotation `I27:2747;7:126` now reads "[AR-13: Send again = new reminder; Failed terminal]".
  - The "Mark reviewed" button `27:2780` was removed from the failed-item detail `27:2766`.
- **AR-14** (page 15, SHR-007 `26:6`):
  - Read/unread badges, the "Unread (2)" tab and "Mark all read" already existed.
  - Annotation `I26:155;7:126` now reads "[AR-14 Proposed: read flag; list re-checks access at read time — inaccessible items hidden, not counted]".
  - Removed the "no longer accessible / Hidden by policy" entries: `26:135` on desktop and `26:324` on mobile `26:243`.
  - The top-bar badge `I26:7;8:297;7:187;3:155` changed from 3 to 2, so it now matches the unread count (also clears review minor 4).
- **AR-15:**
  - **OWN-009 export state** `25:13401`: the frame is renamed "Preparing download (in-request)". The label is `25:13402`. The loading text `I25:13403;7:102` reads "Preparing download…". The body `25:13410` says the file streams directly to the browser, is never stored, and that an error shows in the same view. The ADR annotation `I25:13373;7:126` reads "[ADR-010 Proposed: synchronous, streamed, never stored]". The "Generating (if async)" state no longer exists.
  - **AUTH-004 request-sent state** `15:266`: label `15:267`, banner title `I15:268;7:55` "Reset link queued", message `I15:268;7:56`, and note `I15:275;7:130` (asynchronous; never shown as "sent"; failures reach the Owner list, D6).
  - **DEV-008 Success** `25:12443`: the F2-Automatic text `25:12551` now reads "Project provisioning pending (derived, queued)…". Button `25:12552` was swapped to `wf/Button/Disabled` with the label "Open project board (pending)".
- **Checkpoints:** inline screenshots of OWN-012 `27:2569`, OWN-009 `25:13401`, SHR-007 `26:6`, AUTH-004 `15:266`, DEV-008 `25:12443` and the DE-003 section. The OWN-012 policy row clipped after the first edit. The annotation was shortened, and a read-back confirmed it fits (1008 of 1152 px).
- **Not changed:**
  - Credential-setup "Invitation queued" wording on employee screens. It was not listed in the Task 3 request.
  - OWN-012 "Retrying" state `27:2782`. It shows automatic retries, which are still valid.
