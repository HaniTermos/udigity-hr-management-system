# Phase 7 — Data Entry flows (page 42 `96:4`)

Author: Data Entry role agent. Version P7-DE-2, 2026-10-23. Flow map plus scripts `docs/phase7/scripts/dataentry/P42-01…06` (helpers inlined from `wiring-helpers.js`). Orchestrator decisions D1–D6 [P7-1] and `docs/policy-defaults.md` are applied; see **Decisions applied (P7-DE-2)** at the end, which overrides any earlier proposal or **default TBD** marker in this file.

Sources: `phase7/brief.md`, `phase6/interaction-spec.md` (Data Entry), `phase6/screens/dataentry-spec.md`, `phase6/screen-register.md`, and `phase6/previews/42/index.md` (frame IDs; the hotspots were read from the PNGs).

**Conventions**
- Step format: `frame name | hotspot | action | target | transition`.
- Frame names drop the common prefix where clear. Targets resolve by full frame name first; the IDs in brackets are the fallback (`previews/42/index.md`).
- `NAV` means NAVIGATE, Dissolve 200 ms, unless the step says otherwise. Drawers and dialogs use Smart Animate 250 ms ease-out from their host frame. `BACK` means Figma Back.
- `URL(id)` means OPEN_URL `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=<id with ->`, opened in a new tab.
- Only Light frames are wired. No Data Entry flow is mobile-priority, so the Dark and Mobile frames get no reactions.
- **Policies:** `docs/policy-defaults.md` does not exist yet. Every step where the frame shows alternatives is marked **default TBD**. Phase-6 labels stay as drawn.

**Shared shell hotspots** (wire them on every Light Data Entry frame below that has the DE shell; each script re-applies them for its own frames only):

| hotspot | action | target |
|---|---|---|
| Sidebar "Businesses" | NAV | SCR-DE-001 — Business directory — Desktop — Light [165:81145] |
| Sidebar "Add Business" | NAV | SCR-DE-002 — Create business — Desktop — Light [170:9047] |
| Sidebar "Correction Requests" | NAV | SCR-DE-006 — Correction-request queue — Desktop — Light [308:13955] |
| Sidebar "Categories" | NAV | SCR-DE-007 — Categories — Desktop — Light — Permission denied (Data Entry) [178:13085] — **default TBD** (DEC-015 Alt CA-A/B/C) |
| Sidebar "My Day" / "My Attendance" / "My Profile" | URL | SCR-SHR-001 / 004 / 006 Light on page 40 (IDs from the Shared role agent's map) |
| Top-bar search field | NAV | SCR-SHR-010 — Search results — Desktop — Light [179:11715] |

---

## 1. P7 — Data Entry — Directory to business detail

Start: `SCR-DE-001 — Business directory — Desktop — Light` [165:81145]

1. SCR-DE-001 Light | top-bar search field | click | SCR-SHR-010 — Search results — Desktop — Light [179:11715] | Dissolve
2. SCR-SHR-010 Light | sidebar "Businesses" | click | SCR-DE-001 Light | Dissolve
3. SCR-DE-001 Light | table row "Peak Fitness Gym" | click | SCR-SHR-008 — Business detail — Desktop — Light [310:11808] | Dissolve
4. SCR-SHR-008 Light | tab "Edit history" | click | SCR-SHR-008 — Business detail — Desktop — Light — Edit history [310:12151] | Dissolve
5. SCR-SHR-008 Edit history | tab "Overview" | click | SCR-SHR-008 Light | Dissolve
6. SCR-SHR-008 Light | breadcrumb "Businesses" | click | SCR-DE-001 Light | Dissolve

Extra hotspots (not on the main path):
- SCR-DE-001 Light | the 7 other table rows | click | SCR-SHR-008 Light | Dissolve. This is the only detail frame, and it shows Peak Fitness Gym (see U-2).
- SCR-DE-001 Light | "Add business" | click | SCR-DE-002 Light | Dissolve
- SCR-DE-001 Light | quick chip "Archived · C-01 pending" | none: it is disabled (C-01).
- SCR-SHR-008 Light | "Correction requests" card link "Open queue" | click | SCR-DE-006 Light | Dissolve
- SCR-SHR-008 Light | tab "Related" | none: no frame was drawn (U-6).

## 2. P7 — Data Entry — Create business with duplicate check

Start: `SCR-DE-001 — Business directory — Desktop — Light` [165:81145]

1. SCR-DE-001 Light | "Add business" (page header) | click | SCR-DE-002 — Create business — Desktop — Light [170:9047] | Dissolve
2. SCR-DE-002 Light | footer "Save business" | click | **SCR-DE-003 is BLOCKED.** Action 1: `URL(101:5214)`, page-30 sample F2 (visible match). Action 2, in the same reaction: NAV SCR-DE-002 — Create business — Desktop — Light — Success [170:10095] | Dissolve. See U-1.
3. SCR-DE-002 Success | (toast; per the spec the user lands on SCR-SHR-008) | click on the toast or the "View business" link if one exists, else the breadcrumb "Businesses" | SCR-SHR-008 Light (toast) / SCR-DE-001 Light (breadcrumb) | Dissolve. See U-3.

Branch hotspots:
- SCR-DE-002 Light | footer "Cancel" | click | SCR-DE-001 Light | Dissolve
- SCR-DE-002 Light | DEC-003 policy chip | click | `URL(101:6168)`, page-30 sample N1 (hidden match, existence only) | new tab | **default TBD** (DEC-003). See U-1.
- SCR-DE-002 — Validation errors [170:9600] | footer "Save business" | click | SCR-DE-002 Success | Dissolve
- SCR-DE-002 — Validation errors | error-summary links | none: same-frame field focus cannot be prototyped (U-4).
- The S4 sample dialog's "Open existing business" and "Back to form" are on page 30. They are not wired by this role (U-1).

## 3. P7 — Data Entry — Edit business with save conflict

Start: `SCR-SHR-008 — Business detail — Desktop — Light` [310:11808]

1. SCR-SHR-008 Light | header "Edit business" | click | SCR-DE-004 — Edit business — Desktop — Light [172:9047] | Dissolve
2. SCR-DE-004 Light | footer "Save changes" | click | SCR-DE-004 — Edit business — Desktop — Light — Save conflict [172:10101] | Dissolve
3. SCR-DE-004 Save conflict | banner link "Show what changed" | click | `URL(270:2918)`, SCR-SHR-014 — Save conflict — Desktop — Light (page 45) | new tab
4. SCR-DE-004 Save conflict | Notes card link "Re-apply mine" | click | SCR-DE-004 Light, the restored draft | Dissolve
5. SCR-DE-004 Light | footer "Save changes" | — | Step 2 takes this hotspot, so the save succeeds from the conflict frame instead: SCR-DE-004 Save conflict | footer "Save changes" | click | SCR-DE-004 — Edit business — Desktop — Light — Success [172:10944] | Dissolve. See U-5.
6. SCR-DE-004 Success | "View edit history" | click | SCR-SHR-008 — Edit history [310:12151] | Dissolve

Branch hotspots:
- SCR-DE-004 Save conflict | footer "Discard my changes" | click | SCR-DE-004 Light, as a "reload latest" stand-in (no reloaded frame exists; U-5) | Dissolve
- SCR-DE-004 Light / Save conflict | footer "Cancel" | click | SCR-SHR-008 Light | Dissolve
- SCR-DE-004 Light | "View edit history" | click | SCR-SHR-008 Edit history | Dissolve
- SCR-DE-004 Light / Save conflict | breadcrumb "Peak Fitness Gym" | click | SCR-SHR-008 Light | Dissolve
- SCR-DE-004 — Duplicate blocked [172:9614] | banner "Open existing business" | click | SCR-SHR-008 Light | Dissolve. The frame is reachable only as a state reference (U-5).
- SCR-DE-004 — Validation error [172:10518] | none. It is a state reference.

## 4. P7 — Data Entry — Correction queue review

Start: `SCR-DE-006 — Correction-request queue — Desktop — Light` [308:13955]

1. SCR-DE-006 Light | Peak Fitness Gym row "Open" | click | SCR-DE-005 — Resolve correction (drawer) — Desktop — Light — In review [308:11804] | Smart Animate 250 ms
2. SCR-DE-005 In review | footer "Edit business" (outcome Apply changes is preselected) | click | SCR-DE-004 Light [172:9047]; per the spec, that save resolves the request | Dissolve. See U-7.
3. SCR-DE-004 Light | footer "Save changes" | — | Flow 3 already uses this hotspot (to Save conflict), so the request-context save cannot also land on DE-005 Success. See U-7.
4. *(Resolve path as wired)* SCR-DE-005 In review | RadioCard "No change needed" | click | SCR-DE-005 — Light — Success [308:13309] | Dissolve. See U-8.
5. *(Reject path)* SCR-DE-005 In review | RadioCard "Reject request" | click | SCR-DE-005 Success | Dissolve. See U-8.
6. *(Close path)* SCR-DE-005 In review | footer "Close" / header × | click | SCR-DE-006 Light | Smart Animate (drawer out)
7. SCR-DE-005 In review | footer "Release request" | click | SCR-DE-006 Light (back to Submitted) | Smart Animate
8. SCR-DE-005 Success | tab "Resolved" | click | SCR-DE-006 — Light — Resolved [308:14538] | Dissolve
9. SCR-DE-006 Resolved | tab "Closed / rejected" | click | SCR-DE-006 — Light — Closed and rejected [308:14791] | Dissolve
10. SCR-DE-006 Closed and rejected | tab "Open (4)" | click | SCR-DE-006 Light | Dissolve

Branch hotspots:
- SCR-DE-005 In review | link "Open business detail" | click | SCR-SHR-008 Light | Dissolve
- SCR-DE-006 Light / Resolved / Closed and rejected | tabs "Open", "Resolved", "Closed / rejected" | click | the matching frame | Dissolve
- SCR-DE-006 any | tab "Withdrawn" | none: no frame was drawn (known Phase-6 gap).
- SCR-DE-006 Light | rows Olive, Glow, Lumen "Open" | click | SCR-DE-005 In review (Peak content; U-2) | Smart Animate
- SCR-DE-006 Light | redacted row "Business hidden by policy" | none. It must stay unclickable (DEC-002 row 6).
- SCR-DE-005 — Already resolved [308:12398] and — Duplicate blocked on apply [308:12845] | Close / × | click | SCR-DE-006 Light | Smart Animate. Both are reachable only as state references (U-9).
- SCR-DE-005 Success | toast × | click | SCR-DE-006 Light | Dissolve. The toast shows "Open (3)" and the queue shows "Open (4)", which is accepted as a stand-in.
- DE-005 copy "who resolves / who is notified" has no DEC ID: **default TBD**.

## 5. P7 — Data Entry — Submit data correction (SHR-009)

The Flag action belongs to Call Center, Developer and Owner. Data Entry edits instead. This flow is therefore hosted on the Call Center frame on page 42 (U-10).

Start: `SCR-SHR-008 — Business detail — Desktop — Light — Call Center read-only` [310:12415]

1. SCR-SHR-008 Call Center read-only | header "Flag incorrect data" | click | SCR-SHR-009 — Submit data correction (drawer) — Desktop — Light — Open request warning [310:13530] | Smart Animate 250 ms
2. SCR-SHR-009 Open request warning | footer "Submit request" | click | SCR-SHR-009 — Desktop — Light — Submitted [310:13874] | Smart Animate (the drawer closes, toast, flag (2))
3. SCR-SHR-009 Submitted | toast × | click | SCR-SHR-008 Call Center read-only | Dissolve. A count of (1) is accepted as the "before" stand-in.

Branch hotspots:
- SCR-SHR-009 Open request warning | footer "Cancel" / header × | click | SCR-SHR-008 Call Center read-only | Smart Animate
- SCR-SHR-009 — Validation error [310:13731] | footer "Submit request" | click | SCR-SHR-009 Submitted | Smart Animate. It is reachable only as a state reference (the happy path takes step 2's hotspot).
- SCR-SHR-009 recipients notice (No DEC ID): **default TBD**.
- SCR-SHR-008 Call Center read-only | breadcrumb "Calling Queue" | click | `URL(SCR-CC-001 Light)` on page 43 (ID from the Call Center agent's map) | new tab

## 6. P7 — Data Entry — Categories (DE-007)

DE-007 is Owner-primary. Data Entry sees Permission denied while DEC-015 is pending: **default TBD**.

Start: `SCR-DE-007 — Categories — Desktop — Light` [178:11715] (Owner shell)

1. SCR-DE-007 Light | "Add category" | click | SCR-DE-007 — Light — Name exists [178:12245] | Dissolve. This stands in for adding a duplicate name; no "added" success frame exists (U-11).
2. SCR-DE-007 Name exists | Category name field / "Clear" | click | SCR-DE-007 Light | Dissolve
3. SCR-DE-007 Light | Shop row "Remove…" | click | SCR-DE-007 — Light — In use (cannot remove) [178:12646] | Smart Animate (dialog)
4. SCR-DE-007 In use | "Close" / × | click | SCR-DE-007 Light | Smart Animate
5. SCR-DE-007 Light | sidebar "Businesses" (Owner) | click | SCR-DE-001 — Light — Owner view [165:81643] | Dissolve

Data Entry entry: SCR-DE-001 Light | sidebar "Categories" | click | SCR-DE-007 — Permission denied (Data Entry) [178:13085] | Dissolve | **default TBD** (DEC-015). The notice's back or "Go to My Day" action → SCR-DE-001 Light, if the frame has one (U-12).

Branch hotspots:
- SCR-DE-007 Light | the other rows' "Remove…" | click | In use (Shop content) | Smart Animate | U-11.
- SCR-DE-007 Light | "Rename" | none: inline rename has no frame (U-11).
- Removal rule CR-1/CR-2 (No DEC ID): **default TBD**. The dialog stays without a Remove action.

## 7. P7 — Data Entry — Search results (SHR-010)

Start: `SCR-SHR-010 — Search results — Desktop — Light` [179:11715]

1. SCR-SHR-010 Light | row "Open" (Olive & Thyme Café) | click | SCR-SHR-008 Light [310:11808] | Dissolve. U-2: the detail frame shows Peak.
2. SCR-SHR-008 Light | top-bar search field | click | SCR-SHR-010 Light | Dissolve
3. SCR-SHR-010 Light | search field clear (×) | click | SCR-DE-001 Light | Dissolve

Branch hotspots:
- SCR-SHR-010 Light | rows Sunrise, Lumen "Open" | click | SCR-SHR-008 Light | Dissolve
- SCR-SHR-010 Light | match-type chips (All / Name / Phone / Social handle) | none: no filtered frames exist.
- SCR-SHR-010 — Owner view [179:11997] | row "Open" | click | SCR-SHR-008 Light | Dissolve. The Owner state is a reference.
- SCR-SHR-010 — Empty (Call Center scope) [179:12358] | none. Phase-7 check: it gives no hint of a hidden match.

---

## Unclear hotspots and decisions needed

- **U-1 (SCR-DE-003 blocked):** a single "Save business" click cannot both stop on a duplicate and save. Proposal: one reaction with two actions, OPEN_URL F2 (101:5214) in a new tab, then NAV to Success. Alternative: Save → OPEN_URL only, with Success reached from Validation errors → Save. The hidden-match sample N1 (101:6168) has no real page-42 button; it is proposed on the DEC-003 chip, which is not a real button. The page-30 sample buttons ("Back to form", "Open existing business") are not wired. The orchestrator should decide.
- **U-2:** there is a single detail frame (Peak Fitness Gym) and a single drawer (Peak). Rows for other businesses lead to Peak content. Accept as a stand-in?
- **U-3:** check on the PNG whether SCR-DE-002 Success has a clickable "view business" control. If not, there is no hotspot to land on SCR-SHR-008.
- **U-4:** error-summary links that focus fields cannot be prototyped.
- **U-5:** DE-004 Light "Save changes" can lead to only one target. The proposal is Save conflict; Success is reached from the conflict frame's Save. Duplicate blocked and Validation error are state references only. There is no "reloaded latest" frame for Discard.
- **U-7:** Apply changes → DE-004 is the right target, but the request-context save cannot also lead to DE-005 Success, because the Light Save hotspot is used by flow 3. A context-specific edit frame would need a connector frame, which needs approval.
- **U-8:** RadioCard selection has no "selected" frames, and the drawer has no "Close request" or "Reject" submit button for those outcomes. The proposal wires the RadioCard click straight to Success, which skips the required note. The radio cards are instance children; confirm they accept reactions.
- **U-9:** the DE-005 Already resolved and Duplicate blocked on apply frames have no entry hotspot.
- **U-10:** SHR-009 is a Call Center / Developer / Owner action. Its start frame is the Call Center clone on page 42; Data Entry has no Flag button.
- **U-11:** DE-007 has no "category added" frame and no inline-rename frame. "Add category" goes to Name exists. The In use dialog only has Shop content.
- **U-12:** confirm which action the DE-007 Permission denied frame has (only the notice was inspected in the spec).
- **U-6:** SHR-008 "Related" tab: no frame.
- The shared shell targets (My Day, Attendance, Profile, SCR-CC-001) need IDs from the other role maps or `phase6/ids/*.json`.
- `docs/policy-defaults.md` was missing at writing time. All steps marked **default TBD** must be revisited when it lands.

---

## Decisions applied (P7-DE-2, 2026-10-23)

This section overrides the earlier proposals and every **default TBD** marker above.

### Flow starting points

Figma allows one starting point per frame, so each flow starts on a different frame.

| Flow | Start frame | Script |
|---|---|---|
| P7 — Data Entry — Directory to business detail | SCR-DE-001 Light [165:81145] | P42-01 |
| P7 — Data Entry — Search results | SCR-SHR-010 Light [179:11715] | P42-01 |
| P7 — Data Entry — Create business | SCR-DE-002 Light [170:9047] (it was DE-001; DE-001 already starts flow 1) | P42-02 |
| P7 — Data Entry — Create business (Duplicate found) | SCR-DE-002 — Validation errors [170:9600] | P42-02 |
| P7 — Data Entry — Edit business with save conflict | SCR-SHR-008 Light [310:11808] | P42-03 |
| P7 — Data Entry — Correction queue review | SCR-DE-006 Light [308:13955] | P42-04 |
| P7 — Data Entry — Submit data correction (Call Center host) | SCR-SHR-008 — Call Center read-only [310:12415] | P42-05 |
| P7 — Data Entry — Categories (Owner) | SCR-DE-007 Light [178:11715] | P42-06 |
| P7 — Data Entry — Categories (Data Entry permission denied) | SCR-DE-007 — Permission denied (Data Entry) [178:13085] | P42-06 |

### How each U-item was resolved

- **U-1 → D1.** On SCR-DE-002 Light, "Save business" navigates to Success; that is the main flow, and the reaction has a single action, not two. "Duplicate found" is a separate flow. The same button can't hold two outcomes, so this flow starts on SCR-DE-002 — Validation errors, whose "Save business" runs OPEN_URL 101:5214 (page-30 sample F2; brief rule 8). The Validation errors → Success step from the old map is dropped.
  - DEC-003 working default (i), existence only: sample N1 101:6168 is the reference. SCR-DE-002 has no DEC-003 chip, so there is no page-42 hotspot for it and nothing is wired. The page-30 sample buttons are not wired.
- **U-2 → D3.** Accepted. Every directory row, search "Open" link and queue "Open" link leads to the single Peak detail or the Peak drawer. **Phase 8 item:** per-business detail content.
- **U-3 → D2.** The Success toast ("Toast · Business saved") opens SCR-SHR-008 Light, and the breadcrumb "Businesses" opens SCR-DE-001. If the toast cannot take a reaction, it is reported, and the flow ends on Success.
- **U-4.** Error-summary links are not wired: focusing a field on the same frame can't be prototyped.
- **U-5 → D4/D2.** On SCR-DE-004 Light, Save goes to Save conflict, and Save on the Save conflict frame goes to Success. "Discard my changes" goes to SCR-DE-004 Light (D2: there is no "reloaded" frame). Duplicate blocked and Validation error are state references. Only Duplicate blocked's "Open existing business" is wired, to SHR-008.
- **U-6 → D2.** The "Related" tab is not wired.
- **U-7 → D4.** In DE-005 In review, "Edit business" (Apply changes) goes to SCR-DE-004 Light, and the correction journey ends there. The DE-004 Save belongs to flow 3. **Phase 8 item:** a request-context edit frame.
- **U-8 → D6.** The RadioCards "No change needed" and "Reject request" get no reaction. DE-005 Success is a state reference; its tabs and toast are wired.
- **U-9.** DE-005 Already resolved and Duplicate blocked on apply remain state references. Their Close goes to DE-006, and Duplicate blocked's "Back to Edit business" goes to DE-004.
- **U-10 → OI-24.** The working default is that Data Entry does not submit correction requests. Flow 5 therefore stays hosted on the Call Center read-only clone. Its breadcrumb "Calling Queue" opens OPEN_URL 311:13767 (SCR-CC-001 Light, page 43).
- **U-11 → D2 and C-01 CR-1** (categories are deactivated, not removed):
  - "Add category" goes to Name exists.
  - Every "Remove…" opens In use, as a Smart Animate dialog.
  - "Rename" is not wired.
  - The In use dialog keeps no Remove action.
  - **Phase 8 item:** the "Remove…" label should become "Deactivate" (CR-1).
- **U-12.** P42-06 first tries the notice action "Go to My Day" (OPEN_URL 303:10513). If that is absent, it tries "Back to / Go to Businesses" (SCR-DE-001). If neither exists, the hotspot is reported missing.

### Policy working defaults applied (D5, `docs/policy-defaults.md`)

- **DEC-015, CA-A (Owner only):** in every Data Entry shell, the sidebar item "Categories" goes to SCR-DE-007 — Permission denied (Data Entry).
- **DEC-003 (i):** existence only (see U-1).
- **DEC-002, row 6:** the redacted queue row stays unclickable.
- **OI-19 / OI-20:** the "who resolves / who is notified" copy on DE-005 and SHR-009 is accepted as the default (Data Entry shared queue + Owner; the requester gets an in-app notice). No wiring change. The Phase-6 labels stay as drawn.

### Shared shell

The shell is wired by the script that owns each frame. The cross-page targets are:

| Sidebar item | Target |
|---|---|
| My Day | OPEN_URL 303:10513 |
| My Attendance | OPEN_URL 188:10468 |
| My Profile | OPEN_URL 189:10468 |

OPEN_URL uses `openInNewTab:false`, the operator helper's default.

The shell is not wired on these frames: drawer and dialog frames, Owner-shell frames, and the Call Center clone.

### Hotspot ownership

- SCR-SHR-008 Light: "Edit business" is wired by P42-03. Every other hotspot on that frame is wired by P42-01.
- SCR-DE-004 Light: wired only by P42-03. P42-04 only points to it.

### Phase 8 items (D3)

- Detail and drawer content per business (U-2).
- The DE-005 Success toast says "Open (3)" while the queue shows "Open (4)".
- The SHR-009 Submitted flag shows (2), against the "before" value of (1).
- "Remove…" should be relabelled "Deactivate" (CR-1).
- The Withdrawn tab has no frame.
- There is no category-added frame and no rename frame.
