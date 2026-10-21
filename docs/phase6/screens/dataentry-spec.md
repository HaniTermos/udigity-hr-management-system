# Phase 6 — Data Entry screens (page 42 `96:4`) — build notes

Author: Data Entry Screen Agent. Version P6-DE-1, 2026-10-21. Batch B. Scripts: `docs/phase6/scripts/dataentry/B01…B08`. Visual reference: approved S4 sample (page 30, `previews/final/S4-*.png`). Nothing here is approved. Every pending policy stays labelled.

## Run order and contents

| # | Script | Sections (inventory order) | Frames |
|---|---|---|---|
| 1 | `B01-business-directory.js` | SCR-DE-001 | 6 desktop + 1 mobile |
| 2 | `B02-create-business.js` | SCR-DE-002 | 4 desktop + 1 mobile |
| 3 | `B03-duplicate-dialog.js` | SCR-DE-003 | 5 |
| 4 | `B04-edit-business.js` | SCR-DE-004 | 6 |
| 5 | `B05-corrections.js` | SCR-DE-005, then SCR-DE-006 | 5 + 3 |
| 6 | `B06-categories.js` | SCR-DE-007 | 5 |
| 7 | `B07-detail-and-correction.js` | SCR-SHR-008, then SCR-SHR-009 | 7 + 1 mobile, 4 + 1 mobile |
| 8 | `B08-search-results.js` | SCR-SHR-010 | 4 |

Total: 10 sections, 53 frames (49 desktop, 4 mobile), plus one notes column per section.

Run the scripts in this order. Each script creates its sections in a vertical stack at x 0, with y = the bottom of the lowest existing section + 400 (0 on an empty page). The position is set only when a section is first created. A re-run rebuilds the section's children and keeps its ID and position. If a section grows, the script warns `section gap under 400 px / overlap`, and the orchestrator re-flows the page. Each script stays under 45k characters (largest: B03, 43.5k). Each script was syntax-checked and dry-run against a Plugin API mock (no JS errors, no loose nodes).

**Common rules:**
- DS instances only. Nothing is detached, and no x, y or size is set on instance children.
- Every visible text is set explicitly.
- Fields are set to FILL inside auto-layout parents.
- Light frames use `40:1` and Dark frames use `40:2`. A Dark frame is a clone of the Light primary frame with the explicit mode switched.
- **Returned data:**
  - `created` and `updated` IDs, keyed by frame or section name.
  - `checks`: per-frame `content` used/available px, the form column heights, drawer `freeHeight`/`spillRight`, dialog sizes, and section bounds.
  - `overflow`: clipped children past a padding edge, and text past the frame edge.
  - `placeholderText`: DS default strings left visible.
  - `tapTargets`: mobile sizes.
  - `warnings`.

**Shell and content assembly:** `Shell/Desktop` (role) at (0,0), with a `Content` frame at (240, 64), 1200×836, padding 24/24/16/24. Mobile uses `Shell/Mobile`, with content at y 56, 390×724, and 16 margins. Tables use `Table/HeaderCell` and `Table/Cell` instances in local auto-layout rows, because `Table/Row` has a fixed 7-column business layout and its cells cannot be resized. Status cells hold `Badge/Status` or `Badge/Flag` instances.

## Per screen

**SCR-DE-001 Business directory**
- Frames:
  - Light (primary), Data Entry, Karim Saleh, 8 rows.
  - Dark.
  - Owner view: Owner shell, info banner, a "Hidden from other roles" flag on Cedar Home Realty, 7 rows.
  - Empty, Loading (skeleton rows), Error.
  - Mobile Light: Businesses tab active, 64 px rows, 44 px tap areas around the search field and chips, Large Add button.
- Search covers name, phone and social handle. Filters: category, created by, website and followers, plus quick chips. The Archived chip is disabled because C-01 is pending.
- Counts say "Showing 1–8 of 124". Hidden records are never counted.
- There are no calling-outcome or assignment columns, and no delete control.
- Chips: DEC-001, DEC-002, C-01. B2 appears as the "No phone (B2)" flag.

**SCR-DE-002 Create business**
- Reuses the approved S4 three-column form (270 | 270 | 564).
- Frames:
  - Light (Bloom Florist, ready to save).
  - Dark.
  - Validation errors (S4-F1 content, all errors listed together).
  - Success: footer "Saved · …" and a success toast; the user then lands on SCR-SHR-008.
  - Mobile Light: full-screen form with Back and the tab bar hidden; Business details and Phone numbers cards; scroll cue; sticky 76 px footer with 48 px Cancel and Save buttons.
- Labels: B2 (no asterisk on phones), DEC-013, DEC-014/023, DEC-015, DEC-003.

**SCR-DE-003 Duplicate blocked (dialog)**
- Frames:
  - Visible match Light (S4-F2), and Dark.
  - Hidden match — existence only:
    - Description: "A matching business exists, so saving is blocked. What else can be shown is a pending policy decision (DEC-003)."
    - Content: a `Notice/Access` Inline "Details are not shown" notice, a DEC-003 notice and a no-bypass caption.
    - No primary action. No name, phone or matched field is shown.
  - Owner full match: Owner shell; the record carries "Hidden from other roles"; caption "block still applies".
  - Name-only warning: a DEC-013 Alt NM-C/SN-1 policy branch with the badge "Policy branch — not selected".
- No frame shows a bypass or merge control.

**SCR-DE-004 Edit business**
- Peak Fitness Gym.
- Frames:
  - Light (Phone 2 edited) and Dark.
  - Duplicate blocked (self-excluded):
    - Error banner naming Glow Beauty Salon, which is visible to Data Entry.
    - Inline error on Phone 2.
    - The banner's action is "Open existing business".
  - Save conflict: S4-F3 content.
  - Validation error: the last social account's handle is emptied, the remove control is disabled, and the error summary has one item.
  - Success: toast, and attribution updated to Karim Saleh 11:05.
- Header chips: DEC-003 and C-01. There is no delete control.

**SCR-DE-005 Resolve correction (drawer)**
- Drawer 480 over the scrim, on a copy of the queue with the Peak row selected.
- Content:
  - Status badge.
  - Request inset: Phone 2 now, Suggested, Explanation, and a link to detail.
  - Three outcome RadioCards: Apply changes, No change needed, Reject request.
  - Resolution note.
  - A notice that "who resolves / who is notified" has no DEC ID.
- Frames:
  - In review Light (with Release) and Dark.
  - Already resolved by Rana Haddad: read-only, options disabled.
  - Duplicate blocked on apply: existence-only copy, DEC-003 chip; the request stays In review.
  - Success: queue with Open (3) and a toast.

**SCR-DE-006 Correction-request queue** (preserved ID)
- Tabs: Open (4), Resolved, Closed / rejected, Withdrawn. Filters: status, requester, age.
- Four requests from Maya Khoury, Omar Nassar, Lina Aoun and Sami Fares.
- The redacted row reads "Business hidden by policy · Details not shown" with the badge "Owner review only". It has no issue, requester, age or action.
- The redacted row is not counted in Open (4). A caption and the DEC-002 chip say that omitting the row is the unselected alternative.
- Frames: Light, Dark, Empty (Open (0)).

**SCR-DE-007 Categories** (Owner primary)
- Table of 7 categories: count, status, last changed, and Rename / Remove… links.
- Side column:
  - Add category card.
  - DEC-015 block (Alt CA-A/B/C).
  - Removal block, no DEC ID (Alt CR-1 / CR-2; C-01 may influence it).
- Frames:
  - Light and Dark.
  - Name exists: inline error, Add disabled.
  - In use — cannot remove:
    - Dialog for Shop (18 businesses).
    - The removal rule is shown as pending.
    - No Remove action.
  - Permission denied (Data Entry): `Notice/Access` Page notice and a DEC-015 chip.

**SCR-SHR-008 Business detail**
- Header: category tag, attribution, "Correction requested (n)" flag.
- Tabs: Overview, Edit history, Related.
- Body:
  - Main column: Contact, Social accounts (Unknown is shown as "Unknown", never 0) and Notes cards.
  - Side column: Correction requests, Record and the DEC-001/002 notice.
- Frames:
  - Data Entry Light (Edit business) and Dark.
  - Edit history: 4 `Timeline/Item` entries; the audit trail is noted as Owner-only.
  - Call Center read-only: info banner, Flag incorrect data, no Edit.
  - Developer context-limited:
    - Breadcrumb: Deals › deal › Business.
    - Context-limited notice with DEC-005.
    - Social accounts and notes read "not shown in this context".
  - Hidden by policy (Call Center): no business name anywhere; chips DEC-001, DEC-002, DEC-003.
  - Permission denied (Developer).
  - Mobile Light.

**SCR-SHR-009 Submit data correction (drawer)**
- Hosted on the SCR-SHR-008 Call Center frame (a clone).
- Content:
  - "1 open request already exists" warning, which warns and does not block.
  - Issue type (required), Field, "What is wrong?" (required), and Suggested value (optional).
  - A notice that recipients have no DEC ID.
- Frames:
  - Light and Dark.
  - Validation error: Issue type and description show errors.
  - Submitted: flag shows (2), and a toast.
  - Mobile sheet: drawer resized to 390×720 at y 124, top radius 16, 48 px buttons.

**SCR-SHR-010 Search results**
- Phone query "70 000 15" in the top-bar search, with match-type chips.
- Frames:
  - Data Entry Light, 3 results.
  - Dark.
  - Owner view: 4 results, including Harbor Auto Care flagged "Hidden from others".
  - Empty (Call Center scope): the query is the number of a hidden business. The empty state gives no hint that it exists.

## P2 / P3 on the approved sample (`docs/phase5/scripts/dataentry/01-s4-business-form.js`)
- **P2:** the N1 hidden-match dialog description now reads "A matching business exists, so saving is blocked. What else can be shown is a pending policy decision (DEC-003)." The placeholder reads "Details are not shown / You cannot open the matching business". No policy is selected, and the bracket text is gone. DS copy was not the source: the DS 13-phase6-prep result confirms that Notice/Duplicate and Dialog contain no brackets.
- **P3:** the artifact came from the screen, not the DS Dialog component. The dialog sat in the hugging column `Hidden-match dialog`, and that column clipped its content. Its bottom edge cut the dialog's `ds/Elevation/3` shadow, which left grey wedges at the rounded bottom corners. The fix:
  - The column and the N1 frame no longer clip.
  - The dialog sits on a `Dialog stage` frame (surface/sunken, radius 16, padding 32/32/48/32, no clip).
  - A new check, `checks.N1dialog`, returns the clipping ancestors (expected `[]`) and `shadowInsideStage`.
- The section is now positioned only when first created (lesson 3).

## Component requests (non-blocking; through the orchestrator to the DS Maintainer)
- **CR-DE-1:** the `Shell/Mobile/Header` Back button and the Drawer Close button are Medium IconButtons (40 px), below the 44 px mobile minimum. The scripts report their measured sizes in `tapTargets` as "(DS)". Request: give these a hit area of at least 44 px inside the component.
- **CR-DE-2:** `Table/Row` is a fixed 7-column business row. Screens compose rows from `Table/Cell` instances instead. No change is needed unless the DS wants a configurable row.

## Known limits
- Heights of DS internals (KeyValue, RadioCard, Timeline/Item) were estimated. Trust the returned `content`, `freeHeight` and `overflow` values. The tightest frames are: SCR-SHR-008 Call Center (banner plus three cards), the SCR-DE-005 drawers, and SCR-SHR-009 with the banner.
- After running, re-lay-out field instances nested in slots (FIXED→FILL toggle), per lesson 5.
- DEC-024 (platform priority) has no defined scope, so it is not drawn.
