# S3 Call Center Workspace — High-Fidelity Sample Spec

Version P5-CC-1, 2026-10-20. Author: Call Center Screen Agent. Governs `docs/phase5/scripts/callcenter/01-s3-workspace.js` (STEP 2, written after the orchestrator supplies DS IDs).

- **Target:** file `GNrhb3DWa6mIhEX6F4Nmvw`, page `30 HiFi — Visual Sample` (`36:4`), section **`S3 Call Center Workspace`** (exact name).
- **Frames:** `S3 / Call Center Workspace — Desktop Light` (1440×900, main) and `S3 / Outcome branches — panel detail` (companion annotation frame, 1040×560, see §8). Light theme only.
- **Rule:** instances of DS components and DS variables only (brief §3). Nothing is drawn as a competing component. Where a DS name below is not yet in `docs/phase5/design-system.md` (file not yet published at writing time), it is listed in §10 as a Component request; names are provisional until the DS IDs arrive.

## 1. Sources (approved baselines; not reopened)

| Source | Used for |
|---|---|
| SCR-CC-001 Calling queue `25:10629` (7 derived buckets) | Queue column, bucket rules, row content (previous outcome + last attempt) |
| SCR-CC-002 Contact workspace `25:11352` | Business detail, read-only master data, "flag incorrect data" → SCR-SHR-009 |
| SCR-CC-003 Active contact — log attempt `26:12808` (Needs another call), `26:12951` (Rejected), `26:13096` (Accepted) | Log-attempt panel, outcome-specific fields |
| SCR-CC-005 Contact reservation `26:13670` and states `26:13673`…`26:14317` | Reservation indicator ("Reserved by you", lease, expiry), conflict states referenced in annotations |
| SCR-CC-006 Follow-up drawer `27:15695` | Inline follow-up fields (date, time, purpose) |
| WF-CALL-001 Part 2 | Derived buckets (a business may appear in several; buckets are classifications, not states) |
| WF-CALL-002 | Reservation acquire/renew/release; release only after a successful save |
| WF-CALL-003 + §2.3.1 | Four outcomes, never merged, non-sequential; single all-or-nothing save; Accepted creates one deal record in stage "Accepted opportunity" (E5), never a closed deal |
| WF-FOLLOW-001 | Follow-up schedule rules; D2 marker ("callback to be scheduled") |

## 2. Scenario shown (fictional, brief §5)

- **User:** Maya Khoury, Call Center. Today **Tue 20 Oct 2026, 10:32** (company timezone).
- **Selected business:** **Olive & Thyme Café** (Café). Current outcome **Needs another call** (from 13 Oct). Follow-up due today 10:30 (purpose: "Owner back from supplier visit — discuss menu website").
- **Mode:** Maya has selected **Start Contact** → reservation Active, "Reserved by you". The Log attempt panel is open. The four outcome cards are equal in weight with no system default; Maya's current selection is **Needs another call**, with the follow-up fields filled in, so scheduling is shown in context. The other three branches are shown in the companion frame (§9).

## 3. Frame layout (1440×900)

Frame `S3 / Call Center Workspace — Desktop Light`, fill `color/bg/canvas`, clip content. Vertical Auto Layout is not used at root; root = horizontal: Sidebar + Main column.

| Region | x | y | w | h | Contents |
|---|---|---|---|---|---|
| R0 Sidebar | 0 | 0 | 240 | 900 | `Nav/Sidebar` instance, role = Call Center |
| R1 Top bar | 240 | 0 | 1200 | 64 | `Nav/TopBar` instance |
| R2 Page header | 240 | 64 | 1200 | 72 | Breadcrumb, title, header actions |
| R3 Queue column | 264 | 136 | 320 | 740 | Calling queue (buckets + rows) |
| R4 Business detail | 600 | 136 | 488 | 740 | Reservation bar, business header, contact info, master data, history |
| R5 Contact panel | 1104 | 136 | 312 | 740 | Log attempt & outcome, follow-up, save |

Gutters 16, outer padding 24 (right edge 1416), bottom padding 24. R3–R5 are `Card/Surface` containers (fill `color/bg/surface`, stroke `color/border/subtle` 1px, radius `radius/md` 8, no shadow or `shadow/sm`). R3 and R4 scroll internally (indicate with a thin `Scrollbar` hint only if DS provides; otherwise content is cropped by clipping).

Spacing tokens: `space/4, 8, 12, 16, 24`. Typography (Inter): `type/heading/lg` 20 Semi Bold, `type/heading/md` 16 Semi Bold, `type/heading/sm` 14 Semi Bold, `type/body/md` 14 Regular, `type/body/sm` 13 Regular, `type/label/sm` 12 Medium, `type/caption` 12 Regular, `type/mono/sm` (if DS has none, use `type/body/sm` with tabular figures not required).

## 4. R0 Sidebar and R1 Top bar

**R0 `Nav/Sidebar`** (navy surface `color/bg/nav`):
- Top: `Brand/Logo (placeholder — awaiting supplied file)` instance (never drawn).
- Items (`Nav/Item`, icon + label): My Day · **Calling queue (active, badge "7")** · Follow-ups & calendar (badge "3") · Opportunities · Do-not-call list · Businesses · Notifications.
- Bottom: `Avatar` "MK" + "Maya Khoury" / "Call Center".

**R1 `Nav/TopBar`**: global search placeholder "Search businesses you can access…"; right: `Badge/Status` "Checked in 08:58" (neutral/teal), `IconButton` bell with dot, `Avatar` "MK".

## 5. R2 Page header

- `Breadcrumb`: "Calling queue / Olive & Thyme Café".
- Title (`type/heading/lg`): "Contact workspace".
- Subtitle (`type/body/sm`, `color/text/secondary`): "Tue 20 Oct 2026 · Calls are placed outside the app; this workspace coordinates and records them."
- Right actions: `Button/Secondary` "Follow-ups & calendar"; `Button/Ghost` "Do-not-call list (1)".

## 6. R3 Queue column (SCR-CC-001, WF-CALL-001 Part 2)

Header row: title "My calling queue" (`type/heading/md`) + `Badge/Count` "9 businesses". Below: `Input/Search` placeholder "Filter queue", then `Chip/Filter` row: "All" (selected) · "Today".

Caption under chips (`type/caption`, secondary): "Buckets are derived; a business can appear in more than one."

Buckets = `Queue/BucketHeader` (label + count, collapsible chevron) followed by `Queue/Row` items. Row content: business name (`type/heading/sm`), category `Tag`, right-aligned outcome `Badge/Outcome`, second line `type/caption`: last attempt + flags. Selected row: `state=selected` (teal left bar 3px `color/accent/primary`, fill `color/bg/selected`).

| # | Bucket header (exact) | Count | Rows (name · category · outcome badge · line 2) |
|---|---|---|---|
| 1 | Callbacks due today | 2 | **Olive & Thyme Café** · Café · `Needs another call` · "Due 10:30 · last attempt 13 Oct 15:10" **(selected)** — Nova Dental Clinic · Clinic · `Needs another call` · "Due 14:00 · last attempt 16 Oct 11:45" |
| 2 | Overdue follow-ups | 1 | Sunrise Bakery · Shop · `On hold` · "Was due 19 Oct 16:00 · last attempt 15 Oct 09:20" (row line 2 in `color/text/danger`, `Badge/Status` "Overdue") |
| 3 | New assignments | 2 | Lumen Yoga Studio · Gym · `Pending` · "Assigned 19 Oct by Rana Haddad · no attempts yet" — Urban Cuts Barbershop · Salon · `Pending` · "Assigned 19 Oct by Rana Haddad · no attempts yet" |
| 4 | Callback to be scheduled | 1 | Cedar Home Realty · Real estate · `Needs another call` · "No follow-up yet — schedule a time · last attempt 16 Oct 10:05" |
| 5 | Requires contact | 1 | Bloom Florist · Shop · `On hold` · "Last attempt 14 Oct 12:30" + `Badge/Flag` "Correction requested" |
| 6 | Data correction requested | 1 | Bloom Florist · Shop · `On hold` · `Badge/Flag` "Correction requested 14 Oct" |

Distinct businesses: Olive & Thyme, Nova Dental, Sunrise Bakery, Lumen Yoga, Urban Cuts, Cedar Home, Bloom Florist = **7**. The header badge reads **"7 businesses"** and the sidebar "Calling queue" badge reads **"7"**. Bloom Florist appears in two buckets on purpose, to show that buckets are derived.

Rejected handling (excluded from the callable queue): no "Rejected" bucket in the list. Footer of R3, separated by divider: `Link` "Rejected: do not call (1) — view only in Do-not-call list" with `Icon` "ban", `type/caption`. Tooltip annotation: "Rejected businesses never appear in callable buckets; Start Contact is disabled (WF-REJECT-001). Reopening: DEC-016." + `Notice/Policy pending` (compact) "DEC-016 — reopen rule pending".

## 7. R4 Business detail (SCR-CC-002 in reserved mode)

Vertical Auto Layout, padding 20, gap 16.

### 7.1 Reservation bar (top, full width) — SCR-CC-005 / WF-CALL-002
`Banner/Reservation` instance, variant `state=reserved-by-me`, fill `color/bg/info-subtle` (teal-tinted), stroke `color/accent/primary`, radius 6, height 56.
- Left `Icon` "lock" + title (`type/heading/sm`): "Reserved by you"
- Line 2 (`type/caption`): "Since 10:31 · Lease renews while this workspace is open · Expires 10:41 if not renewed"
- Right: `Badge/Status` "Active" (success) and `Button/Ghost` small "Cancel contact" (releases without logging; warns if notes unsaved).
- Directly below, `Notice/Policy pending` (inline, compact): **"DEC-004 pending — lease duration, idle rule and Owner override are not decided. Times shown are illustrative."**
- Annotation (outside frame, connector to bar): "Release happens only after a successful save. Switching tabs is not a release. Other states (reserved by another agent, expired, network loss, stale client, overridden) per SCR-CC-005 `26:13673`–`26:14317`."

### 7.2 Business header
- Name (`type/heading/lg`): "Olive & Thyme Café"
- Row: `Tag` "Café" · `Badge/Outcome` "Needs another call" · `type/caption` "Assigned to Maya Khoury since 6 Oct 2026"
- Right: `Button/Secondary` icon "flag" **"Request correction"** (opens SCR-SHR-009 drawer; annotation: "Master data is read-only for Call Center; corrections go to Data Entry via WF-BIZ-002").

### 7.3 Contact info (`Card/Section` titled "Contact")
Two-column `DescriptionList`:
| Label | Value |
|---|---|
| Phones | `PhoneRow`: "+000 70 000 106" · `Tag` "Main" · `IconButton` copy — `PhoneRow`: "+000 70 000 116" · `Tag` "Owner mobile" · `IconButton` copy |
| Website | Link "oliveandthyme.example.com" (Has website: Yes) |
| Social accounts | `SocialRow` Instagram "@oliveandthyme.demo" · "2,140 followers · last post 11 Oct 2026" — `SocialRow` Facebook "@oliveandthyme.demo" · "Followers: Not recorded · last post: Not recorded" (unknown shown explicitly, never fabricated) |

Caption under phones: "Copy the number and call outside the app."

### 7.4 Master data (`Card/Section` "Business details", read-only)
Section header right: `Badge/Neutral` with `Icon` "lock" "Read-only".
`DescriptionList` (label/value, `color/text/secondary` labels):
- Category: Café
- Extra notes: "Family-run, two branches planned. Prefers calls after 10:00."
- Created by: Karim Saleh · 2 Oct 2026 09:14
- Last updated by: Karim Saleh · 5 Oct 2026 16:40
Footer link: "View edit history".

### 7.5 Call history (`Card/Section` "Call history", `Timeline` component)
Header right: `type/caption` "3 attempts · newest first". `Timeline/Item` each with dot coloured by outcome token, title line, meta line, note:
1. **Upcoming** item (dashed dot, `color/accent/primary`): "Follow-up due today 10:30 — Owner back from supplier visit — discuss menu website" · "Scheduled by Maya Khoury on 13 Oct" · `Badge/Status` "Due now".
2. "13 Oct 2026 15:10 · Maya Khoury" · `Badge/Outcome` "Needs another call" · note: "Spoke to manager. Owner decides; call back 20 Oct morning."
3. "9 Oct 2026 11:02 · Maya Khoury" · `Badge/Outcome` "On hold" · note: "No answer on main line."
4. "7 Oct 2026 14:25 · Maya Khoury" · `Badge/Outcome` "On hold" · note: "No answer; voicemail full."
Footer caption: "Each attempt is its own record. Past attempts are never changed by a later outcome."

## 8. R5 Contact panel — Log attempt & outcome (SCR-CC-003, WF-CALL-003)

Vertical Auto Layout, padding 20, gap 16. Header: "Log call attempt" (`type/heading/md`) + caption "Saved in one step with outcome and follow-up."

1. **Attempt time** — `Input/DateTime` read-only-looking default "Tue 20 Oct 2026 · 10:32 (now)". Helper: "Editing the time is not decided (B3-Q07)."
2. **Link to follow-up** — `Checkbox` checked: "This attempt completes the follow-up due 10:30".
3. **Outcome** (required) — `RadioCardGroup` of **four separate cards**, vertical stack, equal size (272×52), none visually merged, each with title + one-line meaning; colour dot from outcome token:
   - **On hold** — "No answer. Business returns to the queue."
   - **Needs another call** — "Client asked to be called later." **(selected; `state=selected`, teal border 2px)**
   - **Rejected** — "Do not call. Removes from calling."
   - **Accepted** — "Interested. Creates an accepted opportunity."
   Caption: "Outcomes are not sequential; any of the four can be chosen."
4. **Outcome fields (Needs another call)** — `Card/Inset` (fill `color/bg/subtle`):
   - `SegmentedControl`: "Schedule follow-up now" (selected) | "Schedule later (mark as callback to be scheduled)"
   - `Input/Date` "Thu 22 Oct 2026" · `Input/Time` "11:00"; helper "Company timezone. Must be in the future."
   - `Input/Text` Purpose: "Owner back — present menu website options"
   - Responsible: `Select` "Maya Khoury" (default current assignee)
   - Caption: "A Needs another call outcome always has a follow-up or a ‘callback to be scheduled’ marker (D2)."
5. **Notes** — `Textarea` (3 lines): "Owner not in yet; manager asked for Thursday 11:00. Interested in online menu and table booking."
6. **Footer** (sticky, divider above): `Button/Primary` full width "Save attempt"; below, `Button/Ghost` "Save and keep reservation" (try another number); caption: "Reservation is released only after the save succeeds."

## 9. Companion frame `S3 / Outcome branches — panel detail` (1040×560)

Placed 80 px to the right of the main frame inside the section. Purpose: show the other three outcome branches of R5 so reviewers see they are distinct. Three `Card/Surface` columns (312 wide, gap 16, padding 24), each a cropped copy of R5 fields (instances only), title in `type/label/sm` caps "BRANCH — <outcome>":

**A. On hold (no answer)**
- Selected card "On hold". Optional: `Checkbox` "Add a follow-up" (unchecked). Caption: "Optional follow-up (D3). Business returns to ‘Requires contact’."

**B. Rejected (do not call)**
- Selected card "Rejected" (danger accent `color/status/danger`).
- `Select` Rejection reason: "Not interested — asked not to be called again" (proposed field).
- `Banner/Warning`: "Saving removes this business from all calling buckets. Start Contact and new follow-ups will be blocked."
- Open follow-ups handling: `RadioGroup` disabled, three options shown, **none selected**: "Cancel open follow-ups (system reason)" · "Keep open follow-ups" · "Agent chooses" + `Notice/Policy pending` **"D4 pending — handling of open follow-ups on Rejected is not decided."**
- Caption: "Any ‘callback to be scheduled’ marker is cleared in the same save."
- `Notice/Policy pending` **"DEC-016 pending — who may reopen a Rejected business, and to which outcome."**

**C. Accepted (creates accepted opportunity)**
- Selected card "Accepted" (success accent).
- `Input/Text` Client needs: "Menu website with table booking"; `Select` Service interest: "Website + booking".
- Developer: `SegmentedControl` "Assign now" | **"Decide later" (selected)**; when "Decide later": caption "Shows as ‘Developer not yet assigned’ to the Owner." Disabled `Select` placeholder "Choose developer (Lina Aoun, Sami Fares)".
- `Checkbox` "Arrange meeting now" (unchecked) — caption "A meeting time is not required to accept."
- Result preview `Card/Inset`: "Creates: Olive & Thyme Café — Accepted opportunity (not a closed deal)."
- `Notice/Policy pending` **"DEC-005 pending — whether the assigned developer can open this opportunity before closure."**
- `Notice/Policy pending` **"D4 pending — open follow-ups and callback marker on Accepted."**
- Small caption: "If an open deal already exists: DEC-017 (not decided)."

## 10. Policy labels (brief §6) — placement summary

| Label | Where | Copy |
|---|---|---|
| DEC-004 | R4 reservation bar (inline notice) | "DEC-004 pending — lease duration, idle rule and Owner override are not decided. Times shown are illustrative." |
| DEC-016 | R3 footer (Rejected link) and companion branch B | "DEC-016 pending — who may reopen a Rejected business, and to which outcome." |
| D4 | Companion branches B and C; also a compact chip on R5 outcome group caption: "Rejected/Accepted follow-up handling: D4 pending" | "D4 pending — handling of open follow-ups on Rejected/Accepted is not decided." |
| DEC-005 | Companion branch C; compact chip on the Accepted card in R5: "DEC-005" | "DEC-005 pending — whether the assigned developer can open this opportunity before closure." |

All use `Notice/Policy pending` (variants `size=inline` / `size=chip`). No policy option is pre-selected anywhere.

## 11. Colour/state semantics (tokens; DS supplies values)

Outcome badges (`Badge/Outcome` variant `outcome=`): Pending → neutral; On hold → `status/warning` (amber subtle); Needs another call → `status/info` (teal subtle); Rejected → `status/danger`; Accepted → `status/success`. Each badge always carries the text label (colour is never the only cue). Contrast to be computed by the DS Agent on the actual badge fg/bg pairs; this screen reuses them unchanged.

## 12. Intended interactions (annotations only; no prototype)

- Click queue row → loads R4 in read mode; Start Contact (primary, R4 header) acquires the reservation; the sample shows the post-acquire state, so "Start Contact" is replaced by the reservation bar.
- "Request correction" → SCR-SHR-009 drawer. "Cancel contact" → warn if notes unsaved → release.
- "Save attempt" → validate → single save → release → row moves to buckets by new outcome (Olive & Thyme leaves "Callbacks due today"; follow-up 22 Oct appears in Follow-ups & calendar).

## 13. Component requests (to Design-System Agent via orchestrator)

Needed if not already in the DS (names provisional):
1. `Queue/BucketHeader` (label, count, collapsed/expanded) and `Queue/Row` (default/hover/selected; slots: name, tag, outcome badge, meta line, flag badge).
2. `Badge/Outcome` with 5 variants: Pending, On hold, Needs another call, Rejected, Accepted.
3. `Banner/Reservation` variants: reserved-by-me, reserved-by-other, expired, offline, overridden.
4. `RadioCard` (title + description + status dot; default/hover/selected/disabled).
5. `Timeline/Item` (variants: past attempt, upcoming follow-up).
6. `DescriptionList` row, `PhoneRow` (number + label tag + copy), `SocialRow` (platform icon, handle, metrics incl. "Not recorded").
7. `Notice/Policy pending` with `size=inline` and `size=chip`.
8. Base: `Nav/Sidebar`, `Nav/Item`, `Nav/TopBar`, `Breadcrumb`, `Card/Surface`, `Card/Section`, `Card/Inset`, `Button/Primary|Secondary|Ghost`, `IconButton`, `Input/Text|Date|Time|DateTime|Search`, `Select`, `Textarea`, `Checkbox`, `RadioGroup`, `SegmentedControl`, `Chip/Filter`, `Tag`, `Badge/Status|Count|Flag|Neutral`, `Banner/Warning`, `Link`, `Avatar`, `Icon` (lock, flag, ban, copy, bell, chevron, phone), `Brand/Logo (placeholder — awaiting supplied file)`.

## 14. Build notes for script 01 (P5-CC-2, 2026-10-21; these override §3–§9 where they differ)

- Script: `docs/phase5/scripts/callcenter/01-s3-workspace.js`. Section at x=0, y=2400; main frame at (80,80) inside the section; companion and `S3 / Annotations` frames at x=1600.
- The shell is a `Shell/Desktop` (Call Center) instance. Nav labels come from the DS sitemap (Calling Queue is active with badge 7; Follow-ups & Calendar has badge 3). The content frame is 1200×836 and uses `ds/Grid/Desktop content 12-col`.
- Column widths: queue 352 (the DS `Queue/Row` is built for 360), detail 408, panel 360. Column height is 724, and every column scrolls (content is clipped).
- **Queue.** "New assignments" and "Requires contact" are collapsed so the main buckets fit. The view switch is a `Tabs` Segmented control, and the derived-bucket note is a `Chip/Derived`.
- **Detail column, top to bottom:**
  - `Banner/Reservation` "Reserved by me", with Show policy off, plus an inline DEC-004 notice.
  - The business `Card/Section`, which holds the "Request correction" action, the phones, the website and the social accounts.
  - Call history.
  - Business details (read-only), below the fold.
- **Panel.**
  - The outcome `RadioCard` descriptions are hidden. Each meaning is carried in the card title instead, for example "On hold — no answer".
  - D4 and DEC-005 appear as chips beside the Outcome label.
  - The attempt-completes-follow-up checkbox was dropped for space.
  - "Schedule now / Schedule later" is a `Tabs` Segmented control.
  - The footer stays fixed and holds "Save and keep" and "Save attempt".
- Containers use DS `Card/Section` and `Card/Inset` with native slots. If a slot cannot be filled, the script falls back to a frame bound to the same tokens and reports a warning.
- **Repair round 1 (2026-10-21):**
  - Column widths are now 344 / 400 / 376.
  - The Spacer inside each `Row/Phone` is flattened, and the rows now hug their content.
  - The follow-up box is now a token-bound frame with 12 px padding (same tokens as `Card/Inset`). This keeps DS inputs at their 320 minimum width.
  - The title sits above the Segmented control.
  - Date and time are now one `Input/Date` field ("Date and time") with helper text.
  - Copy is shorter in four places: the business card subtitle, the social metrics, the attempt-time line and the Outcome label row.
- **Repair round 2 (2026-10-21; supersedes the round-1 Spacer and follow-up-title notes):**
  - **Queue rows.** The Category tag is hidden, and the category now leads the meta line (for example "Café · Due 10:30 · …"). Full business names fit, and Name and Meta may wrap to 2 lines.
  - **Phone rows.** Each `Row/Phone` instance is fixed at 40 px and clips the empty DS Spacer. The script no longer sets size on any child of an instance.
  - **Business card.** The subtitle now reads "Café · Assigned to you". The Business details subtitle is shorter.
  - **Notes.** The Notes field fits above the fixed footer. Changes that make room:
    - The Follow-up title and the Segmented control ("Set now / Set later") share one row.
    - The date label now reads "Date and time (company timezone)" and its helper is hidden. The future-date rule is noted in the annotation.
    - The attempt line fits on one line, the RadioCard vertical padding is 8, and the panel padding is 12/8.
    - The script measures any remaining overflow and trims in this order: the Notes counter row, then the outcome gap, then the Purpose label folded into its value. The result is returned in `fit.panel`.
  - **Call history.** The content padding is 20/16 and the gap is 12, so the Call history header and the latest entry sit above the fold. Floating "More below" pills mark clipped content in the queue and detail columns. If the latest entry still does not fit, the DEC-004 inline notice moves into the policy chip of `Banner/Reservation`. The result is returned in `fit.detail`.
  - **Unchanged.** All policy labels (DEC-004, DEC-016, D4, DEC-005) and the four distinct outcomes are kept.

## 15. Final pass (P5-CC-3, 2026-10-21; closes sample-review MF-04, MF-05, MF-06, MF-07; overrides §14 where they differ)

- **Scroll cues (MF-04, MF-05).** The floating "More below" pills are gone. Each scroll region now ends in a scroll-cue strip that sits in its own reserved space and never covers content. The viewport above the strip shrinks by the strip's height.
  - **Queue.** The strip sits between the queue list and the queue footer: a full-width `surface/subtle` band with a top rule. The script builds its label from what is actually clipped, for example "↓ More below · Bloom Florist · Requires contact (1)". The result is returned in `fit.queue`.
  - **Detail column.** `R4 Business detail` now holds two parts: a clipped `Detail scroll area` that fills the column, and a boxed strip below it ("↓ Scroll for N earlier attempts and business details").
  - **Latest attempt above the fold.** The social accounts (Instagram, Facebook) move from the business card to Business details, so the latest call attempt (13 Oct, 15:10) is fully visible. The script checks this. If it still does not fit, the existing DEC-004 fallback applies. The result is returned in `fit.detail`.
- **Footer (MF-06).** The footer has exactly one primary, `Button` Primary "Save attempt", which saves the attempt and then releases the reservation. Beside it sits `Button` Ghost **"Save, keep reservation"**, which logs the same attempt and keeps the business reserved so the agent can try another number. The ghost button hugs its label and the primary fills the remaining width. If the primary would be narrower than 128 px, the two buttons stack with the primary first. The caption **"Reservation is released only after the save succeeds."** (§8.6) is restored under the buttons. The result is returned in `fit.footer`.
- **Decide later (MF-07, contract E3).** A deferred developer assignment stores no assignee. The disabled Developer field is now a plain `Select` (Type=Select, not Person) that reads "Not yet assigned". Any Avatar instance inside it is hidden through a visibility override, and no initials or names are shown. A matching annotation was added.
- **Unchanged.** The four outcomes stay distinct and non-sequential. All policy labels stay: DEC-004, DEC-016, D4 and DEC-005. No x, y or size is set on any child of an instance. The only overrides on instances are visibility, properties and text.
