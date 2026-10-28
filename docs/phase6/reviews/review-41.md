# Review 41: Owner/Admin (page 41 `96:3`) + S2 sample

Independent UI reviewer, 2026-10-22. Sources: brief §1/§3/§6, inventory SCR-OWN rows, owner-spec, interaction-spec (Owner), architecture-a §4.5/§4.7/§5A, coordination board (O-2, X-3, DE-7). I reviewed previews only and made no Figma calls. **Nothing is approved.**

**What I looked at:** all 28 primary frames (12 Light, 12 Dark, OWN-004 mobile Light and Dark, S2 Light and Dark) and 40 of the 50 state frames. Three OWN-012 frames are **STALE** (Light 127:21844, Dark 127:22210, Retrying 127:22962). They show the dead gap between filters and table that dates from before the spacer fix. I reviewed their content, but they must be re-taken.

## Coverage vs inventory

| Screen | Frames present | States the inventory requires | Gaps / not viewed |
|---|---|---|---|
| OWN-001 Dashboard | L, D, Loading, No data, Partial (+S2 L/D) | Loading, no data, partial, G1 labelled | No "Custom" range segment. Development workload is not shown per Developer (M-04) |
| OWN-002 Employees | L, D, Deactivated, Empty, Loading | Empty, active/deactivated, assignee-inactive | Loading not viewed |
| OWN-003 Employee drawer | Edit L/D, Create, Dup email, Conflict, Deactivate, Change role, Success | Validation, conflict, deactivate impact, success | No Reactivate frame (the action is in the inventory) |
| OWN-004 Attendance monitoring | Desktop L/D, Mobile L/D, Empty, Not configured, Alert failed, Exception detail | Empty, not configured, alert failed, G1; mobile P1 | Mobile has no day/employee filter |
| OWN-005 Corrections & review | L, D, Alt A, Alt B, Validation, Conflict, Success, Empty | Empty, validation, conflict, success; DEC-011 A/B; DEC-026 | Conflict and Empty not viewed |
| OWN-006 Targets & work lists | L, D, Shortfall, Ineligible, Empty | Shortfall, ineligible + reason, empty | No Set-target form or Manual method frame. Empty not viewed |
| OWN-007 Calling assignments | L, D, Ineligible, Needs decision, Reserved, Conflict | All 5 listed | — |
| OWN-008 Reassignment impact | L, D, All choices, Override, Conflict, Success | Reservation, follow-ups, callback marker, **developer not yet assigned**, conflict | "Developer not yet assigned" not drawn. Conflict not viewed |
| OWN-009 Reports & exports | L, D, Unauthorized, No data, Preparing, Failure, Success | Unauthorized, no data, failure, generating → in-request (ADR-010), audit notice | — |
| OWN-010 Audit log | L, D, Event detail, Empty, Loading | Empty, loading, detail, G3 | Empty and Loading not viewed |
| OWN-011 Settings | L, D, Not configured, Validation, Test, Conflict, Success, Security | Not configured, validation, conflict, success | **Company** tab not drawn. Not configured, Conflict and Success not viewed |
| OWN-012 Delivery monitor | L*, D*, Failed detail, Retrying*, Empty (*STALE) | Empty, failed, suppressed, retrying; "mark reviewed" | "Mark reviewed" was removed under AR-13. That departs from the inventory, so record it in the screen register |

**Checks with no defect found:**
- Reports, exports and audit are Owner-only. The non-Owner case uses the Call Center shell with a denied page.
- Export is synchronous and in-request ("Preparing download…"). There is no "ready later" list, and failure is shown in place (ADR-010 / §4.7).
- The O-2 outcome labels, the Reserved / B7 / Assignee-inactive flags, and the override "overridden by Owner" notice are consistent.
- G1 distinctions are shown: attempts ≠ contacted (with a daily-distinct note), accepted ≠ closed, closed ≠ completed, not checked in ≠ absent.
- The three-part workload (3·5·12) matches the Employees totals (Lina 2·4·7 plus Sami 1·1·5).
- Calling report totals reconcile with the dashboard (184 / 97 / 2).
- Harbor Auto Care (the hidden record, DE-7) appears only in Owner views. No redacted rows are counted on page 41.
- Mobile list rows and tabs are at least 44 px.

## MUST-FIX

| ID | Preview file | Frame | What you see | Fix |
|---|---|---|---|---|
| M-01 | SCR-OWN-001 … Light — Partial data.png | 113:27313 | The Calling source is "Unavailable", yet the Targets card still shows call-attempt progress (Maya 22/40, Omar 0/40). Both come from the source that failed. | Show the call-attempt target rows as "Unavailable · Retry". Keep the businesses-added row. |
| M-02 | SCR-OWN-001 … Light — No data.png | 113:26542 | The range is 3–4 Oct, but Businesses · now still reads "Added 14–20 Oct · 37 +8 vs 29". This is a period metric that ignored the filter. | Change it to "Added 3–4 Oct · —" (No data for this period). |
| M-03 | SCR-OWN-001 … Light.png / Dark.png (+S2 L/D, all states) | 113:25280 / 113:25502 | The Accepted opportunities tile carries the chip "B-1 Policy pending". B-1 is the agreed snapshot definition (§5A). The item that is actually pending is the stage names (no DEC ID). | Keep "Snapshot · current stage (B-1)" as the definition, and relabel the chip "Stage names · No DEC ID". |
| M-04 | SCR-OWN-001 … Light.png / Dark.png | 113:25280 / 113:25502 | Development workload appears only as a company total, 3·5·12. §5A defines it **per Developer** (three sub-counts each). | Add a per-Developer breakdown (Lina 2·4·7, Sami 1·1·5), or label the tile "All developers" and give it a per-Developer drill-down. |
| M-05 | SCR-OWN-004 … Desktop — Light.png / Dark.png (and all desktop states) | 131:34290 / 131:34815 | Employee names are truncated ("Rana Hadd…", "Maya Khou…", "Omar Nass…"). Omar's verification reads "Check-in bloc…", so the key effect is cut off. | Widen the Employee and Verification columns (narrow IN/OUT), or let the cells wrap to two lines. |
| M-06 | SCR-OWN-004 … Light.png ↔ SCR-OWN-011 … Light.png | 131:34290 ↔ 134:82442 | Attendance shows "Office check · Passed" for four people, but Settings shows the verification mode as "DEC-009 none selected". A pass/fail result implies that a pending mode is already in force. | On OWN-004, show the check result as "Recorded · mode pending (DEC-009)" (or similar). Never imply a decided mode. Apply the same to the OWN-004 drawer and the OWN-005 "office check passed" text. |
| M-07 | SCR-OWN-005 … Light.png / Dark.png (+ every OWN-005 state) | 135:22943 / 135:23262 | The tab "Review queue · 3" and the heading "Needs review · 3" count two rows that "exist only if DEC-026 Alt B or Alt C is adopted". Hypothetical policy rows are counted as real work. | Count 1, and show the conditional rows as "+2 if DEC-026 Alt B/C adopted", outside the count. |
| M-08 | SCR-OWN-005 … Light — DEC-011 Alt B reading.png | 135:23873 | The "Employee requests · 1" tab is active, but the left list is still the review queue ("Needs review · 3" with the DEC-026 rows). | Show the employee-request list (1 item, Omar 19 Oct) when that tab is active. |
| M-09 | SCR-OWN-005 … Light — Success.png | 135:24823 | The toast covers the Cancel / Save buttons, which render as blank boxes. Omar's item is still selected in the queue and the count stays 3. The spec says the item leaves the queue. | Remove the item from the queue (count 2, or 0 + conditional), clear or close the form, and place the toast clear of the actions. |
| M-10 | SCR-OWN-006 … Light — Insufficient work.png | 133:35084 | The panel shows "Shortfall: 18 eligible of 40", but Maya's table row still reads "Automatic proposal · 40 items". | Change the row to "Automatic proposal · 18 of 40 (shortfall)". |
| M-11 | SCR-OWN-007 … Light.png / Dark.png (+ every OWN-007 frame and the OWN-008 backdrops) | 119:60707 / 119:61253 | The assign-to select shows the avatar "LA" (Lina Aoun) next to the name "Omar Nassar". | Change the avatar initials to ON. |
| M-12 | SCR-OWN-007 … Light — Reserved by another agent.png; … — Ineligible excluded.png | 119:62615; 119:61768 | The bulk bar reads "3 selected" while no row is checked. In Ineligible, the banner says "2 of 5 selected … 3 businesses were assigned to Omar Nassar", but the bar says 3 selected and Olive & Thyme and Sunrise still show Unassigned. The header counts are unchanged. | Reserved: hide the bulk bar, or check the rows. Ineligible: show the post-assign result (3 rows now Omar, counts updated, selection cleared). |
| M-13 | SCR-OWN-008 … Light — Success.png | 120:14665 | The toast reads "Peak Fitness Gym reassigned to Omar Nassar", but the table still shows Peak with Maya Khoury and the Reserved flag. The header counts are unchanged. | Update the row (Omar Nassar, no Reserved flag) and the header counts. |
| M-14 | SCR-OWN-009 … Light.png / Dark.png (+ every OWN-009 state) | 121:71294 / 121:71791 | Report names are truncated ("Projects & wor…") and every subtitle is cut ("Attempts, busine…", "Target vs counte…"). | Widen the Reports list, or wrap titles and subtitles to two lines. |
| M-15 | SCR-OWN-010 … Light.png / Dark.png | 123:75308 / 123:75720 | An enabled Export button sits beside the "OQ-18 audit export open" chip. The spec says Export is shown only if OQ-18 is adopted, so an active control effectively decides it. | Remove Export, or show it disabled with the caption "Only if OQ-18 is adopted". |
| M-16 | SCR-OWN-011 … Light — Test office check.png | 134:84084 | The result notice text is clipped: "Location not te". | Let the notice body fill the width and wrap (textAutoResize HEIGHT). |
| M-17 | SCR-OWN-012 … Light — Empty.png | 127:23295 | The nav badge "Delivery Monitor 4" is still shown while the list reads "All · 0 · Nothing needs attention". | Hide the badge (or set it to 0) in the Empty frame. |

## Minor

- **OWN-001**
  - The segmented control has no "Custom" option, although the spec lists Today / 7 / 30 / Custom.
  - The Loading frame already shows "Exceptions · 4".
  - Exceptions "Review" / "View" are plain black text, while "Send again" is a button. Use one link style (the same applies to OWN-004 and OWN-012).
  - Partial data: "Unavailable" uses the display size, "Retry" is grey text rather than a link, and "Source failed · never shown as 0" touches the card edge.
  - "Exceptions · 4" (which includes an attendance item) and the nav badge 4 (delivery items) count different sets with the same number.
  - Dark: the segmented control has no visible track.
- **OWN-002**
  - Session and open-work sublines are truncated ("since 08…", "1 open se…").
  - The "+" icon on the light primary buttons has low contrast (also on OWN-006).
  - The deactivated banner points to "Follow-ups", but follow-up reassignment goes through OWN-008.
- **OWN-003**
  - Save conflict: the notice text column is about 250 px with empty space to its right, and "re-apply" breaks across lines.
  - Dark: check the contrast of white text on the coral "Deactivate…" button.
  - Change role: the subtitle states session revocation as fact. Mention "(Proposed)" next to it too.
- **OWN-004**
  - The KPI tiles have uneven heights.
  - The DEC-008 chip is stretched to the full tile width.
  - The primary frame is already "not configured" but has no banner, so it is almost identical to the "Schedule not configured" frame.
  - Empty: the body text touches the right edge of the box.
  - Mobile:
    - Exceptions shows 2 where desktop shows 3.
    - There is no Late arrivals tile.
    - Sublines are truncated ("blocks check…", "18:…").
    - The header avatar is under 44 px if it is tappable.
- **OWN-006**
  - The B8 notice uses the pending (hourglass) style, but B8 is a rule.
  - Sample data conflicts: Cedar Home Realty is "Open deal (B6)" here but "Pending · B7" on OWN-007; Bloom Florist has "No phone (B2)" yet has an assignment and a follow-up.
- **OWN-007**
  - Light: the bulk bar has no fill (the Dark one does).
  - "Keep" is plain text next to buttons.
  - Reconcile the header counts: 248 vs 18 unassigned + 79 assigned, with 121 non-terminal on the dashboard.
  - Audit (11:05) and the Delivery monitor say Lumen Yoga Studio was reassigned to Omar, but OWN-007 still shows Maya.
- **OWN-008**
  - The reservation lock icon sits alone in the label column with a gap.
  - The backdrop selection (Olive, Lumen, Sunrise) does not include Peak.
  - In "All choices made", the second follow-up label is misaligned with its select.
- **OWN-009**
  - The Unauthorized page shows an audit event name to a non-Owner. Align it with the X-3 permission-denied reference 165:3781.
  - "Contacted = distinct, not a sum", but 58 + 39 = 97 equals the sum. Use sample data with an overlap.
- **OWN-010**
  - "attendance.missing_checkout_…" is truncated.
  - The placeholder event names (settings.updated, §5) are not marked as placeholders.
- **OWN-011**
  - The Security tab keeps "Save attendance settings" / Discard, although nothing on it is editable.
  - The Grace field has a "Minutes" placeholder plus a "min" suffix.
  - The RadioCard grid does not fill the card.
  - "Add IP" sits below the input baseline.
- **OWN-012**
  - Re-take the 3 STALE frames (dead gap above the table).
  - Retrying shows an empty grey button; the spec says these rows have no action.
  - "Lumen Yoga Stu…" is truncated.
  - The dashboard Exceptions list omits the missing-checkout alert row that is listed here.

## Recheck 2026-10-22 (fresh previews)

This is a recheck against the OP-5-41 previews (78 frames, all marked new in `previews/41/index.md`). It checks the O-5 and O-6 fixes and the OP-2 to OP-6 runs. I reviewed previews only and made no Figma calls. **Nothing is approved.**

Drawer and dialog fields: the OWN-003 Edit, Create and Save conflict drawers, the OWN-004, OWN-010 and OWN-012 detail drawers, and the OWN-003 Change role / Deactivate dialogs plus the OWN-008 Reassign / Override dialogs all lay out at full slot width. **Page 41 does not have the page-44 320 px bug.** One leftover remains: the OWN-003 Save-conflict notice text column is still about 250 px (the existing minor).

Pending policies: DEC-009, DEC-026 and OQ-18 now read as pending everywhere I checked.
- **DEC-009:** "Recorded · Mode pending" on OWN-004, its drawer and OWN-005; Settings shows "none selected".
- **DEC-026:** the rows sit in a dashed "not counted" preview.
- **OQ-18:** Export is disabled with the caption "Only if OQ-18 is adopted".

| M-id | status | preview | note |
|---|---|---|---|
| M-01 | Verified fixed | SCR-OWN-001 … Light — Partial data.png | Maya and Omar call-attempt rows show "Unavailable · Retry". The businesses-added row (6/10) is kept. |
| M-02 | Verified fixed | SCR-OWN-001 … Light — No data.png | Reads "Added 3–4 Oct · — No data for period". |
| M-03 | Verified fixed | SCR-OWN-001 … Light.png; S2 … Light.png | Chip reads "No DEC ID · Stage names". Caption reads "Snapshot · current stage (B-1)". |
| M-04 | Verified fixed | SCR-OWN-001 … Light.png; S2 … Light.png | Shows the per-Developer split "Lina 2·4·7 · Sami 1·1·5" under 3·5·12, with a DEC-019 chip. |
| M-05 | Verified fixed | SCR-OWN-004 … Desktop — Light.png | Names and "Check-in blocked" are shown in full. New truncation elsewhere: see N41-2. |
| M-06 | Verified fixed | SCR-OWN-004 … Light.png; … Exception detail.png; SCR-OWN-005 … Light.png; SCR-OWN-011 … Light — Test office check.png | Shows "Recorded · Mode pending · DEC-009" and "recorded (mode: DEC-009 pending)". "Passed" no longer appears as a result. |
| M-07 | Verified fixed | SCR-OWN-005 … Light.png | Tab and heading count 1. The DEC-026 rows are in a dashed "+2 if … adopted (not counted)" preview. |
| M-08 | Verified fixed | SCR-OWN-005 … DEC-011 Alt B reading.png | "Employee requests · 1" lists Omar's checkout request. |
| M-09 | Verified fixed | SCR-OWN-005 … Light — Success.png | Queue is 0, the form is closed, the session is closed and unblocked, and the toast is clear of the actions. |
| M-10 | Verified fixed | SCR-OWN-006 … Insufficient work.png | Row reads "Automatic proposal · 18 of 40 (shortfall)". |
| M-11 | Verified fixed | SCR-OWN-007 … Light.png; SCR-OWN-008 backdrops | The assign-to select shows ON next to Omar Nassar. |
| M-12 | Verified fixed | SCR-OWN-007 … Reserved by another agent.png; … Ineligible excluded.png | Reserved shows "No businesses selected". Ineligible shows Olive, Lumen and Sunrise with Omar, the header reads 16 / 41 / 40, and the selection is cleared. |
| M-13 | Fixed but new problem | SCR-OWN-008 … Light — Success.png | The Peak row is Omar/ON with no Reserved flag, and the header reads Maya 41 / Omar 38. New problems: see N41-1. |
| M-14 | Not fixed (partial) | SCR-OWN-009 … Light.png | Titles are now complete, but the Calling activity subtitle is still cut ("Attempts, contacted, outcom…"). |
| M-15 | Verified fixed | SCR-OWN-010 … Light.png | Export is disabled with the caption "Only if OQ-18 is adopted". |
| M-16 | Not fixed | SCR-OWN-011 … Light — Test office check.png | The notice body still clips ("Location not test"). The OP-3 report of "no clip warning" does not match the preview. |
| M-17 | Verified fixed | SCR-OWN-012 … Light — Empty.png | The nav has no Delivery Monitor badge, and the list reads All · 0. |

### New must-fix

- **N41-1 (OWN-008 Success, 249:23829):** after a single-row reassignment of Peak, two things are wrong.
  - The backdrop still shows the earlier bulk state: "3 selected", Olive, Lumen and Sunrise checked, and the Assign bar active. Those rows are unrelated to the action that just finished, so the screen reads as if a second assignment is still pending. **Fix:** clear the selection and show "No businesses selected", as in the other OWN-007 result frames.
  - The toast covers the Harbor Auto Care row's Last attempt and DNC flag. **Fix:** move the toast clear of the table, or shorten it.
- **N41-2 (OWN-004 Desktop Light/Dark and all desktop states, 236:*):** two pieces of text are cut off.
  - The right card heading is cut to "Exceptions & aler…".
  - Omar's IN cell reads "19 Oct 09…", which hides the check-in time of the only exception row. This is the same class of defect as M-05.
  - **Fix:** let the heading wrap, or shorten it to "Exceptions & alerts" with a narrower link. Widen IN, or show the time on two lines ("19 Oct" / "09:04").

## Recheck 2026-10-23

This recheck uses the OP-13-41 previews: 21 frames re-taken for C04, C08 and C09 (IDs 287:\*, 288:\*, 289:\*, dated 2026-10-23 in `previews/41/index.md`). It checks the O-7, O-8 and O-9 fixes against OP-11 and OP-12b. I reviewed previews only and made no Figma calls. **Nothing is approved.**

| ID | Status | Preview | Note |
|---|---|---|---|
| N41-1 | Fixed but new problem | SCR-OWN-008 … Light — Success.png (288:23852) | The backdrop reads "No businesses selected" and the toast sits below the table. But four rows are now drawn as solid black bars with near-invisible text: see N41-3. |
| N41-2 | Verified fixed | SCR-OWN-004 … Desktop — Light.png / Dark.png (287:22811 / 287:23393); … Empty.png | The heading reads "Exceptions & alerts · 2" in full, the link is "Review all", and Omar's IN cell is "09:04" over "Mon 19 Oct". |
| M-14 | Verified fixed | SCR-OWN-009 … Light.png / Dark.png / Success.png (289:\*) | Every report title and subtitle is complete; Calling activity now reads "Attempts and outcomes". |
| M-16 | **Open — blocked (C11 not re-run)** | SCR-OWN-011 … Light — Test office check.png | The notice body is still cut: "Location not test" runs into the right edge, and the line "DEC-009 pending." wraps oddly. |
| RadioCard cut (O-8) | **Open — blocked (C11 not re-run)** | SCR-OWN-011 … Light.png (and every OWN-011 state) | The card texts are not cut in this frame. However, the 2×2 grid stops about 23 px short of the card's right padding. The fix has not been verified because the C11 script never ran. |

**What remains on OWN-011, and what it affects.** The current OWN-011 frames were not re-taken; the old ones are kept. These Owner actions are affected:
- **Test office check:** the result notice is clipped, so the Owner cannot read what was and was not tested (M-16).
- **Choose verification mode:** the RadioCard grid does not fill the card. DEC-009 is still correctly shown as "none selected".
- **Add IP:** the button still sits below the input baseline (minor).
- **Set grace period:** the field still shows "Not set" next to a "min" suffix (minor).
- **Security tab:** "Save attendance settings" / Discard are still shown there (minor).

### New must-fix

- **N41-3 (OWN-008 Success, 288:23852):** the Peak Fitness Gym, Nova Dental Clinic, Cedar Home Realty and Harbor Auto Care rows have a solid black fill, with dark-grey text and black checkboxes. Only the status chips, avatars and flags can be read, so the Owner cannot confirm the result on the row that was just reassigned (Peak → Omar).
  - **Likely cause:** clearBulk() matched these rows with `/^Row \d/` and replaced the row fill instead of only clearing the selection fill.
  - **Fix:** restore the default row surface token and unchecked checkboxes on all 7 rows, then re-take Success.
  - **Also check:** OWN-007 and every other frame cloned with clearBulk().
- **N41-4 (`previews/41/index.md`, OWN-011 rows):** the header says C11 "keeps its OP-9 frames (275:\*)", but the eight OWN-011 rows list IDs 211:\* and the date 2026-10-22. It is unclear which frames these PNGs show, so the M-16 and RadioCard status above cannot be traced to a frame.
  - **Fix:** correct the OWN-011 row IDs, or re-take those frames from the 275:\* nodes.

Minor (no ID): the OWN-004 Omar "Missing checkout" punctuality chip runs flush to the table's right edge (Light and Dark).
