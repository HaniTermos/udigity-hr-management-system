# Phase 5 — Visual Sample S4: Business Form (Create / Edit) — High-Fidelity Spec

Owner: Data Entry Screen Agent. Version P5-DE-1, 2026-10-20. Status: **proposed — for user approval (Phase 5 sample).**
Target: file `GNrhb3DWa6mIhEX6F4Nmvw`, page `30 HiFi — Visual Sample` (`36:4`), section **`S4 Business Form`**. Desktop 1440×900, light theme.
Authority: `docs/phase5/brief.md`. This agent never calls Figma tools; the script (`docs/phase5/scripts/dataentry/01-s4-business-form.js`) is written after the orchestrator supplies Design-System IDs.

## 1. Sources (approved baselines; nothing reopened)

| Source | Used for |
|---|---|
| SCR-DE-002 Create business, section `19:2697`: desktop `19:2700`, validation `19:2905`, success `19:3108` (`docs/phase3-4/wireframes-w2.md`) | Field set, multiple phones, 2 social accounts, Unknown checkboxes, website checkbox + URL, all-errors-together |
| SCR-DE-003 Duplicate blocked, section `21:1762`: visible `21:1765`, hidden `21:1854`, Owner `21:1937`, name-only `21:2056` | Dialog variants. Hidden-match copy per **RW-05** and **AR-12** (`wireframe-fixes.md`): existence only |
| SCR-DE-004 Edit business, section `19:3255`: desktop `19:3258`, save conflict `19:3659`, last-social validation `19:3862` | Attribution, save-conflict cue, self-excluded duplicate check |
| ICR-1 / ICR-2 (`wireframes-w2.md`) | Name-only warning branch; same dialog serves create, edit, correction apply and concurrent duplicate at save |
| Phase 2 WF-BIZ-001 / WF-BIZ-002 Part A, rules VR-1..VR-12, DR-1..DR-9 (`docs/phase2/batch2/batch2-spec.md`) | Validation rules, block-cannot-be-bypassed, no merge, version-conflict behaviour |
| Brief §5 / §6 | Fictional content; policy labels |

## 2. What is drawn in section `S4 Business Form`

Three 1440×900 frames side by side (x pitch 1540, y 0), plus one annotation card below. Section padding 100.

| # | Frame name | Purpose |
|---|---|---|
| F1 | `S4-A Create business — inline validation` | Main approval screen: full form, filled, with 3 inline errors and the error summary |
| F2 | `S4-B Create business — duplicate blocked (visible match)` | F1 dimmed behind scrim + duplicate-blocked dialog, visible-match variant |
| F3 | `S4-C Edit business — save conflict` | Edit mode with attribution filled and the save-conflict cue |
| N1 | `S4-N Hidden-match variant (annotation)` | Annotation card (1440 wide, below F2/F3): hidden-match existence-only dialog body + name-only branch note |

Persona: **Karim Saleh (Data Entry)** in all frames. Conflicting editor in F3: **Rana Haddad (Owner/Admin)**.

## 3. Layout grid (all frames)

- **Shell:** `Shell/Desktop` instance, role Data Entry: sidebar 240 px (navy), top bar 64 px (white). Sidebar items: My Day, Businesses (**active**), Correction requests, Categories `[DEC-015]`, Search. Top bar: global search field "Search businesses, phones, handles", notifications icon, avatar "KS" + "Karim Saleh · Data Entry". Logo slot: `Brand/Logo (placeholder — awaiting supplied file)`.
- **Content area:** x 240, y 64, 1200×836, background `color/bg/canvas`, padding 24 → inner width 1152.
- **Page header** (height 72): breadcrumb, H1, sub-line; actions right-aligned.
- **Body:** three columns, gap 24: **Column A 372** (Business details) · **Column B 372** (Social accounts) · **Column C 360** (Record & policy rail). Each column is a `Card` (white, radius 12, 1 px `color/border/subtle`, padding 20, vertical auto layout gap 16). Card heights hug content; max body height 652.
- **Footer action bar** (sticky, height 64, white, top border): left = save-status text; right = `Button/Secondary` "Cancel" + `Button/Primary` "Save business" (F3: "Save changes"). There is **no Delete control** (C-01) and **no override/bypass control** anywhere (DR-5).
- Spacing scale 4/8/12/16/20/24; field label above input, 6 px gap; helper/error text 4 px below input.

## 4. F1 — `S4-A Create business — inline validation`

### 4.1 Page header
- Breadcrumb: "Businesses › New business"
- H1: "New business"
- Sub-line: "All fields are checked together when you save. Duplicates are checked across every stored business."
- **Error summary** (`Banner/Error`, full width 1152, directly under header): title "3 fields need attention", list (links that focus the field):
  - "Phone 2 — incomplete number"
  - "TikTok — follower count missing"
  - "Website — address required while 'Has website' is checked"

### 4.2 Column A — Card "Business details"

| Order | Component | Label | Value / state | Helper / error |
|---|---|---|---|---|
| 1 | `Input/Text` (required) | Business name * | "Bloom Florist" | Helper: "Name and phones are used to detect duplicates." + `Notice/Policy pending` **DEC-013** "Name / branch matching pending" (compact) |
| 2 | `Select` (required) | Category * | "Shop" | Link-button below: "Suggest a new category" + `Notice/Policy pending` **DEC-015** "Category authority pending" |
| 3 | Group "Phone numbers" | Phone numbers `[B2]` | Label carries an inline `Notice/Policy pending` **B2** "Phone mandatory? pending" — **no asterisk** (neither alternative selected) | — |
| 3a | `Input/Phone` + `IconButton/Remove` | Phone 1 | "+000 70 000 131" | valid |
| 3b | `Input/Phone` + `IconButton/Remove` | Phone 2 | "+000 70 000 1" — **error state** (red border `color/border/danger`, error icon) | Error: "Enter a complete phone number, e.g. +000 70 000 132." |
| 3c | `Button/Ghost` + plus icon | — | "Add phone" | Helper: "The same number entered twice is merged automatically." |
| 4 | `Checkbox` | Has website | **checked** | — |
| 4a | `Input/URL` | Website address * | empty — **error state**, placeholder "https://name.example.com" | Error: "Enter the website address, or uncheck 'Has website'." |
| 5 | `Textarea` | Notes (optional) | "Prefers calls after 11:00. Runs a second stall at the Saturday market." | Counter "71 / 2000" |

### 4.3 Column B — Card "Social accounts"
- Card header: title "Social accounts", meta "At least 1 required", right: `Button/Ghost` "Add account".
- Inline `Notice/Policy pending` **DEC-014 / DEC-023** "How 'Unknown' is stored and whether follower history is kept are pending." Optional small tag **DEC-024** "Platform priority pending".
- Each account is a nested `Card/Inset` (bg `color/bg/subtle`, radius 8, padding 12) with a header row (platform + remove icon) and two metric rows.

**Account 1 — valid**

| Component | Label | Value |
|---|---|---|
| `Select` | Platform | "Instagram" |
| `Input/Text` | Handle or link | "@bloomflorist.demo" |
| `Input/Number` + `Checkbox` "Unknown" | Followers | "2,480"; Unknown unchecked |
| `Input/Date` + `Checkbox` "Unknown" | Last post | "14 Oct 2026"; Unknown unchecked |

**Account 2 — error + explicit Unknown**

| Component | Label | Value |
|---|---|---|
| `Select` | Platform | "TikTok" |
| `Input/Text` | Handle or link | "@bloomflorist.demo" |
| `Input/Number` + `Checkbox` "Unknown" | Followers | **empty, error state**; Unknown unchecked. Error: "Enter a follower count or mark it Unknown. It is never assumed to be 0." |
| `Input/Date` (disabled, shows text "Unknown") + `Checkbox` "Unknown" | Last post | Unknown **checked**; date field disabled and reads "Unknown" in `color/text/muted` italic-free regular. Badge `Badge/Neutral` "Unknown" beside the label |

Rules visualised: Unknown is an explicit checkbox per metric, never a 0 or blank placeholder (VR-9/VR-10). Remove icon on an account is enabled while ≥2 accounts exist; on the last account it is disabled with tooltip "At least one social account is required" (VR-7; shown in F3).

### 4.4 Column C — Rail
1. Card "Record" (attribution, create mode):
   - "Created by — set when saved"
   - "Created at — set when saved"
   - "Last updated by — set when saved"
   - "Last updated at — set when saved"
   - Text style `body/sm`, values `color/text/muted`. Caption: "Attribution is set by the system, not editable."
2. Card "Pending policies on this form" — stacked `Notice/Policy pending` instances (full):
   - **DEC-013** — "Name / branch matching: whether a name-only match blocks, warns, or is not checked is not decided."
   - **B2** — "Phone mandatory at creation is not decided. Without a phone a business would not be eligible for calling."
   - **DEC-014 / DEC-023** — "Storage of 'Unknown' metrics and follower history are not decided."
   - **DEC-015** — "Who may add categories is not decided."
   - **DEC-003** — "What a blocked user may see about a match they cannot open is not decided."
3. Small `Notice/Info`: "Saving is never blocked by attendance." (contract A1).

### 4.5 Footer
Left status text (`color/text/danger`): "Not saved — fix 3 fields". Right: "Cancel" (secondary), "Save business" (primary, enabled; re-validates on click).

## 5. F2 — `S4-B Create business — duplicate blocked (visible match)`

- Background: F1 content with errors corrected (Phone 2 "+000 70 000 132", TikTok followers "Unknown" checked, website "https://bloom.example.com"), but the **name changed to "Glow Beauty Salon"** and Phone 1 "+000 70 000 101" to make the match. Overlaid by `Overlay/Scrim` (navy 48 % opacity).
- Footer status (under scrim): "Checking for duplicates…" not shown; dialog is the result.
- **Dialog** `Dialog` (width 560, centred, radius 16, padding 24):
  - Header icon: blocked/shield icon `color/icon/danger`. Title: "This business already exists"
  - Body: "Saving is blocked. A stored business has the same phone number. Duplicates cannot be saved or merged."
  - Match block (`Card/Inset`) — "Matched on: Phone +000 70 000 101" (`Badge/Danger` "Phone match"):
    - Name: "Glow Beauty Salon (Downtown branch)"
    - Category: "Salon"
    - Phones: "+000 70 000 101 · +000 70 000 102"
    - Social: "@glowbeauty.demo (Instagram)"
    - Website: "https://glow.example.com"
  - `Notice/Policy pending` **DEC-013** (compact): "Name matching rule pending — this match is by phone."
  - Footer: `Button/Secondary` "Back to form" · `Button/Primary` "Open existing business". **No "Save anyway" / override control** (DR-5) — caption under buttons, `body/xs` muted: "No role can bypass a duplicate block."
- Annotation strip under the frame (outside, 1440 wide, `Annotation` style if DS provides one): "Same dialog serves Edit business (self-excluded check), applying a data correction, and a concurrent duplicate detected at save (DR-8). Owner sees the full match and is still blocked."

## 6. N1 — `S4-N Hidden-match variant (annotation)`
Annotation card (not a full frame) showing the **dialog body only** at 560 wide, plus notes:
- Title: "This business already exists"
- Body (exact, RW-05): "A matching business exists. Saving is blocked. [DEC-003 pending: what may be shown]"
- Placeholder box (dashed `color/border/subtle`, 120 high): "Limited preview — pending DEC-003"
- Footer: only "Back to form". No "Open existing business". No "Request escalation" (shown only if DEC-003 adopts escalation — **not adopted**).
- `Notice/Policy pending` **DEC-003** full.
- Side note 2: "Name-only / similar-name warning (DEC-013 Alt NM-C / SN-1) would be a non-blocking warning with 'Different business, continue' / 'Cancel'. Drawn only as a policy branch in low-fi `21:2056`; not selected."
- Note: "The duplicate check covers every stored business, including records hidden from the user (DR-2). The variant reveals existence only."

## 7. F3 — `S4-C Edit business — save conflict`

- Breadcrumb "Businesses › Glow Beauty Salon (Downtown branch) › Edit"; H1 "Edit business"; sub-line "Changes are checked for duplicates against every other stored business."
- **Conflict banner** (`Banner/Warning`, full width, under header):
  - Title: "Rana Haddad saved changes to this business while you were editing"
  - Body: "Nothing was overwritten. The form now shows the latest values. Re-apply your changes below and save again."
  - Actions: `Button/Ghost` "Show what changed" · `Button/Ghost` "Discard my changes"
- Field-level conflict cue (one field): **Notes** — input shows latest value "Closed on Mondays. Ask for Nadia at the front desk." with a `Badge/Warning` "Changed by Rana Haddad · 09:40" above, and beneath it a `Card/Inset` "Your unsaved text: 'Closed on Mondays.'" + `Button/Link` "Re-apply mine".
- Column A values: Name "Glow Beauty Salon (Downtown branch)"; Category "Salon"; Phones "+000 70 000 101", "+000 70 000 102"; Has website ✓; URL "https://glow.example.com".
- Column B: one account only — Instagram "@glowbeauty.demo", followers "12,350", last post "18 Oct 2026". Remove icon **disabled**, tooltip/helper "At least one social account is required." Add account button present.
- Column C Record card (filled):
  - Created by: "Karim Saleh"
  - Created at: "6 Oct 2026, 10:12"
  - Last updated by: "Rana Haddad"
  - Last updated at: "21 Oct 2026, 09:40"
  - `Button/Link` "View edit history"
  - Policy card as F1 (same five notices).
- Footer: left status `color/text/warning` "Not saved — review latest values"; right "Cancel", "Save changes" (primary).

## 8. Interactions (annotated only; no prototype)
- Save: validate all (VR-1..12) → all errors at once (summary + inline) → duplicate check (DR) → dialog or success toast "Business saved" (create) / "Changes saved" (edit).
- Error summary items focus their field. Focus ring `color/focus` 2 px.
- Unknown checkbox toggles the metric input to disabled "Unknown"; unchecking restores an empty required input.
- Has website unchecked → URL field hidden and cleared (VR-11).
- Save conflict: nothing overwritten; user re-applies; save re-validates and re-checks duplicates.

## 9. Tokens and type (provisional names — will be mapped to `docs/phase5/design-system.md` IDs)
- Colours: `color/bg/canvas`, `color/bg/surface`, `color/bg/subtle`, `color/border/subtle`, `color/border/strong`, `color/border/danger`, `color/text/primary`, `color/text/secondary`, `color/text/muted`, `color/text/danger`, `color/text/warning`, `color/brand/navy`, `color/brand/teal` (primary action), `color/focus`, status danger/warning/info/neutral sets.
- Type (Inter): H1 24/32 Semi Bold; card title 16/24 Semi Bold; label 13/18 Medium; input 14/20 Regular; helper/error 12/16 Regular; breadcrumb 13/18 Regular.
- Radius: inputs 8, cards 12, dialog 16. Elevation: dialog shadow only; cards border-only.
- Contrast is to be reported by the DS agent from computed ratios; this screen uses only DS token pairs.

## 10. Components needed (instances only; requests where DS may lack them)
Expected from DS: `Shell/Desktop`, `Brand/Logo (placeholder — awaiting supplied file)`, `Nav/Item`, `Breadcrumb`, `Button/Primary|Secondary|Ghost|Link`, `IconButton`, `Input/Text` (states default/filled/error/disabled), `Select`, `Textarea`, `Checkbox`, `Badge/*`, `Banner/Error|Warning|Info`, `Card`, `Overlay/Scrim`, `Dialog`, `Notice/Policy pending` (compact + full), `Toast`.

**Component requests (to Design-System Agent via orchestrator), if not already planned:**
1. `Input/*` variants with a **helper/error text slot** and `type` = phone / URL / number / date.
2. **`Field/Metric with Unknown`** — input + "Unknown" checkbox, states: value, empty-error, Unknown-checked (input disabled, reads "Unknown").
3. **`Card/Inset`** (subtle background nested card).
4. **`Banner/Error` with a list slot** (error summary with linked items).
5. **`Dialog` with a content slot** (low-fi had none; kit change request K-1).
6. `Notice/Policy pending` **compact (inline tag) size** in addition to the full notice.
7. `Badge/Warning` "changed by" usage and a dashed **Placeholder box** (for "Limited preview — pending DEC-003"), or approval to draw it as a plain frame bound to DS tokens.
8. `Annotation` card style for N1 and the F2 strip.

## 11. Revision P5-DE-2 (2026-10-21): changes made while writing the script
These changes override §3–§7 where they differ. They were needed to fit a 1440×900 frame with real DS component sizes.
- **Columns** are now 270 | 270 | 564: A "Business details" (name, category, website), B "Phone numbers" plus "Notes", C "Social accounts". The record/policy rail is removed.
- **Attribution** moved to the left side of the footer action bar. F1/F2 read "Created by and last updated by are set by the system when you save." F3 reads "Created by Karim Saleh · 6 Oct 2026, 10:12 · Last updated by Rana Haddad · 21 Oct 2026, 09:40" on two caption lines; "View edit history" is a link at the top right of the F3 page header.
- **Policy labels** sit inline as `Notice/Policy pending` chips: DEC-013 (name), DEC-015 (category), B2 (phones), DEC-014/023 (social), DEC-003 (header). The full explanations are Block notices in N1. DEC-024 was dropped because it is not in brief §6.
- **Error summary** (`Banner/ErrorSummary`, 564 wide) sits at the top right of the F1 header.
- **"Add phone" / "Add account"** are the Card/Section header actions.
- **Social account rows:** platform + handle + remove icon on the first row; followers (`Field/Metric`) and last post (`Input/Date` + "Unknown" checkbox) on the second.
- **Phones** use the Input Phone type: country code "+000" + value "70 000 1xx".
- **F2** background is a filled create form for "Glow Beauty Salon" (phone 70 000 101 matches "Glow Beauty Salon (Downtown branch)").
- **F3** edits **Peak Fitness Gym** instead, so the name fits the 270 column. The conflict cue is a warning `Banner` with a "Show what changed" action, a `Badge/Flag` "Changed by Rana Haddad · 09:40" on Notes, the Notes action "Re-apply mine", the helper "Draft: “Closed on Mondays.”" and a footer "Discard my changes" ghost button.
- **Duplicate dialog** match details are composed from `Card/Inset` + `List/KeyValue` instead of `Notice/Duplicate`. That component's copy ("Possible duplicate — may already exist"; the hidden copy "It is not visible to you…") conflicts with the block semantics and with RW-05.

- **Repair round 2 (2026-10-21):** website values shortened to fit the 270 column without truncation: F3 "peak.example.com", F2 "glow.example.com" (matches the duplicate dialog).
