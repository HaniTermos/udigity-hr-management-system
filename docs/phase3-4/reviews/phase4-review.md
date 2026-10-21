# Phase 4 — Independent Wireframe Review

Reviewer: Independent Wireframe Reviewer (no authorship of any reviewed artifact). Date: 2026-10-20. One pass.
Scope: Figma design file `GNrhb3DWa6mIhEX6F4Nmvw` pages 01–03 and 10–15, `screen-inventory.md`, `sitemap.md`, `wireframes-w1/-w2/-w3.md`, checked against SB-3 and the Phase 2 specs (Batch 2 Table RT and open items, Batch 4 SM-COMMERCIAL-001 / WF-DEAL-001/002).
**This review approves nothing.** Phase 4 stays "proposed — for user review".

## 0. Evidence basis (read first)

The Figma MCP quota (Education plan) was exhausted on this reviewer's **first** call. No live `get_metadata` or `get_screenshot` call succeeded in this review. The evidence therefore has three tiers:

| Tier | What | Limits |
|---|---|---|
| **A — Visually inspected (indirect)** | 74 screenshots taken by W0–W3 during authoring, pulled from their session transcripts, plus cached `get_metadata` XML for pages 01, 12 and 13 taken earlier in the session. Frames seen: AUTH-002 R11-b; SHR-001 desktop; SHR-002 mobile; SHR-003 mobile; OWN-001, -004, -008, -009 desktop; DE-001, DE-003 hidden match; SHR-008 CC and DEV variants; CC-001 desktop and Owner view; CC-003 Accepted; CC-007; DEV-001, DEV-002 Accepted (Alt 1), DEV-005, DEV-006; DEV-008 row; SHR-007 row; SHR-012 row | Some screenshots **predate later fixes** by the authors (for example the CC-001 chip row and the duplicate Back on SHR-012, both reported fixed). A finding from Tier A is kept only where no later fix in the agents' docs addresses it. |
| **A′ — Read from authoring code** | Text content of frames, read from the `use_figma` scripts in the W2 transcript (for example the DE-006 rows and the CC-004 "Reminder failed" row) | This is what the script wrote. Later edits may differ. |
| **B — Assessed from docs only, visual inspection pending quota reset** | Every other frame: frame lists, state lists and verification sections in `wireframes-w1/-w2/-w3.md` | Existence and naming only. Content is unverified. |

## 1. Verdict

**Revise before user review. 0 Blockers, 7 Major.**

The set is broadly sound:
- Inventory coverage is complete on paper: 54 screens, every P1/P2 mobile frame listed, all 23 workflows homed.
- The main role boundaries hold in what was seen:
  - Call Center is read-only on business detail with "Flag incorrect data".
  - Developer gets a context-limited view.
  - Data Entry has no commercial or deal navigation.
  - Reports, exports, audit and settings sit only in the Owner shell.
- The fidelity is low: greyscale, Inter, no brand styling.
- Policy alternatives are drawn side by side and marked "not selected".
- G1 distinctions are captioned on OWN-001 and OWN-004.

Seven issues still need fixing:
- hidden-data leakage (RW-01, RW-05, RW-06)
- a missing Owner navigation path (RW-02)
- a misrepresented single definition (RW-03)
- a missing Owner-side policy flow (RW-04)
- a visual-verification gap that this review could not close (RW-07)

## 2. Required fixes

| ID | Severity | Page + frame | What I saw | Fix |
|---|---|---|---|---|
| RW-01 | Major | 14 Developer · SCR-DEV-001 Desktop `17:1231` (Tier A) | **The Developer's default deals list leaks pre-closure records and presents DEC-005 as decided.** The active tab is "Closed deals — company-wide eligible" with the "Assigned to me" chip on. The table still lists:<br>• Signed, Paid and Signed-and-paid rows<br>• an **unassigned** "Accepted opp." (Olive Tree Café, "Developer not yet assigned")<br>• a "Not proceeding" row with its reason<br>• another Developer's closed deal (L. Saab)<br>Under DEC-005 Alt 1, only the *assigned* Developer may see an accepted opportunity. Under Alt 2, no Developer may see it. Neither alternative lets a Developer see an unassigned one. E3 also says "developer not yet assigned" is visible to the **Owner**. | Closed tab: only Closed deal rows (DEC-002 closed-deal row label). "Accepted opportunities — assigned to me" tab: only rows assigned to the viewer, with a DEC-005 Alt 1 tag; the tab is absent under Alt 2. Remove the unassigned row and the "Developer not yet assigned" chip from the Developer view, or move them to an Owner-view state frame. Make the chip state consistent with the rows. |
| RW-02 | Major | 11 Owner/Admin · all desktop frames (`wf/Shell/Desktop/Owner`); `sitemap.md` §3.1; inventory SCR-SHR-001 "OWN via My Day" (Tier A on OWN-001/004/008/009) | **The Owner has no visible desktop entry to their own check-in.** The Owner must check in (SHR-002 roles = ALL). The Owner desktop nav has no My Day or My Attendance. The top bar shows a passive "Not checked in" chip. The sitemap routes Owner attendance history through the user menu, but no check-in path exists on desktop. Owner mobile does have My Day. No Owner variant of SHR-001/002 is drawn (W1 used the Call Center shell). | Add a desktop entry: a "My Day" nav item, or a top-bar attendance control annotated as an action that opens SHR-002/003. Add an Owner note or state to SHR-001 "Role variants" covering R-11 (pending-2FA check-in). |
| RW-03 | Major | 11 · SCR-OWN-001 `24:5`; 14 · SCR-DEV-005 `23:6988` (Tier A) | **"Development workload" misstates the single SB-3 §11 definition, and differently on each screen.** OWN-001 shows "5 open projects"; DEV-005 shows "7 open tasks". SB-3 §11 defines one derived snapshot with three sub-counts: non-terminal deal records assigned, active projects assigned, and open tasks assigned. Both tiles carry the "Proposed" tag but display a different single metric. | Show the three sub-counts on both tiles (for example "Deals 2 · Projects 4 · Tasks 7"), keep the "Proposed (SB-3 §11)" tag, and use the same labels on both screens. |
| RW-04 | Major | 14 · SCR-DEV-002 / SCR-DEV-008 (Tier B; W3 change request 4) | **The Owner's half of two Phase 2 paths has no frame anywhere.**<br>• DEC-006 Alt B: the Owner reviews a closure verification request, then verifies and finalizes, or rejects it with a reason (WF-DEAL-002 B4; `deal.closure_rejected`).<br>• B3: the Owner removes a fact entered in error, with a reason, and the stage reverts.<br>The Developer side is drawn ("Request verification", "Verification rejected"). The only Owner review step exists as an annotation. | Add a DEV-002 "Owner view — Alt B review item" state frame (Verify & finalize / Reject with reason, labelled "[DEC-006 Alt B — not selected]") and a "Remove recorded fact (reason)" state frame. Record in the inventory where the Owner finds closure review items (DEV-001 Owner filter, or OWN-001). |
| RW-05 | Major | 12 · SCR-DE-003 Hidden match `21:1854` (Tier A) | **The hidden-match copy goes beyond the DEC-003 placeholder.** The preview box is correctly empty and labelled "pending DEC-003". The body text, however, says "It is outside your access, so its details are not shown". That confirms the match is a *hidden* record. Whether to confirm hidden status is itself open: DEC-003, and OI-10 for the parallel "hidden by policy" wording. | Use neutral copy that reveals only what duplicate blocking already implies (Confirmed): "A business with this phone already exists. Saving is blocked." Move any "outside your access" wording into a labelled DEC-003 alternative. |
| RW-06 | Major | 12 · SCR-DE-006 Desktop `21:2140` (Tier A′) | **The redacted queue row for a hidden business shows content.** The row reads: "(business hidden for you) · No longer operating · Omar H. (Call Center) · 9 days · Owner only". The issue type "No longer operating" is information about the hidden business. OI-08 (Proposed → USER) allows *at most* a redacted row. Table RT rule 3 limits redaction to items the viewer **owns**; this Data Entry viewer is not the requester. The "Open (7)" tab count may include the hidden item. | Under the OI-08 alternative, show only "Business hidden by policy · Owner review only", with no issue type or requester. Label the row "[OI-08 / DEC-002 row 6 pending → USER]". Draw the alternative (row omitted and not counted) side by side. State whether tab counts exclude the hidden row. |
| RW-07 | Major | All pages (Tier B) | **Roughly half of all frames were never seen at readable scale by anyone.** By the agents' own verification sections, the following were checked only by structural scans, or only in row screenshots at about 0.3–0.5×:<br>• AUTH-001 desktop and mobile; AUTH-002 mobile; AUTH-004 desktop and mobile<br>• SHR-002 desktop; SHR-003 desktop; SHR-005 mobile; SHR-006 mobile<br>• OWN-010<br>• almost all W1 state frames (95 of 96)<br>• 68 of W2's 90 frames<br>• all W3 mobile frames<br>This review could not close the gap because of the quota. These frames hold the session-expired, verification-failure, duplicate and save-conflict states. | When the quota resets, run a screenshot pass on every Tier B frame before the user review, specifically: AUTH-001..004, SHR-002/003 desktop, SHR-013 all, SHR-014, SHR-015, CC-005 all, DE-003 visible/Owner/name-only, DE-004 duplicate/conflict, and DEV-004/006/007 mobile. Record the results in each W doc's Verification section. |

## 3. Recommended handling of change requests

| Request | Matters? | Recommendation |
|---|---|---|
| W1-1 New open questions (undo after reassignment, settings effective date, revoke sessions on password change, employee "sign out all") | Yes, low | Accept. Add them to the inventory policy column as "(no DEC ID)" or "implementation decision". They must stay labelled, never presented as decided. |
| W1-2 Representative shell for SHR screens | Yes, ties to RW-02 | Accept. Add an inventory §10 note, plus an Owner variant note (RW-02). |
| W1-3 OWN-004 exception detail is part of OWN-004 | Low | Accept. One line in the inventory. |
| W1-4 OWN-007 tabs → CC-007 / CC-008 | No change | Record only. Also add the tabs to the sitemap Owner nav: the Owner nav has no Opportunities or Do-not-call entry, and the tabs are the only route. |
| W2 ICR-1 DEC-013 name-only warning state on DE-003 | Yes | Accept. It is already drawn as a labelled branch. |
| W2 ICR-2 DE-003 also serves DE-004 / DE-005 and concurrent create (DR-8) | **Yes** | Accept. Without it, edit-time and race-time blocking have no canonical home. |
| W2 ICR-3 Accepted while an open deal exists (DEC-017 5a) | Yes | Accept as a key state. Drawing a labelled branch frame on CC-003 is recommended. |
| W2 ICR-4 Reopen-request state if DEC-016 picks request-and-approve | Conditional | Accept as a conditional note. No frame until DEC-016 is decided. |
| W2 ICR-5 / ICR-6 Owner view on CC-001; host contexts for SHR-009 | Low | Accept (documentation). |
| W3-1 Reference sheets may exceed 900 px | Low | Accept. |
| W3-2 Mobile route to notifications | **Yes** | Accept. CC and DEV mobile tab bars have no Alerts entry; Owner and DE do. Add a header bell to every mobile shell, or "More → Notifications", in the sitemap. |
| W3-3 "Owner 2FA incomplete" frame drawn in the Developer shell | Yes, low | Accept. Note that a pending-2FA Owner stays on AUTH-002 (sitemap rule 3), so this frame must not suggest a Developer shell or role. Redraw it in the Owner shell or without a shell. |
| W3-4 Owner variants of DEV screens out of scope? | **Yes** | Reject "out of scope" for DEV-002. See RW-04. Other Owner variants can stay as annotations. |
| Kit: `wf/Dialog` / `wf/Drawer` content slot (W1, W2 K-1, W3) | **Yes** | Do it first. Every agent built composed dialogs and overlay bodies as workarounds, so dialogs and drawers are no longer kit instances and will drift. |
| Kit: `wf/Tabs` active-tab property (W1, W2 K-4) | Yes | Accept. Agents **reordered tab labels** to fake the active tab (OWN-005 "Corrections & review" first, CC-004 "Week" first), which misstates tab order in the IA. |
| Kit: `wf/Annotation/Policy` wrap (W3) and `wf/Placeholder/Box` wrap (K-3) | Yes | Accept. Policy labels were shortened or clipped to fit (for example the DEC-009 tag on SHR-002 mobile), which risks losing policy meaning. |
| Kit: Table status cell width (K-2), Calendar fixed days (K-5), Kanban 3 cards, one badge cell | Low | Optional. Abbreviations are acceptable at low fidelity. |

## 4. Optional minors (not required)

1. **SHR-002 mobile `19:739`:** "I am working remotely today" is a live checkbox while DEC-010 is pending. Tag the control itself as "[DEC-010 — exists only if adopted]", not just a tag below it.
2. **OWN-004 `25:724`:** "Remote" appears as a solid (stored-state) Status badge. Remote is not an attendance state (DEC-010). Make it a dashed or derived tag, or a separate column.
3. **OWN-009 `25:13185`:** the attendance report shows "Late (derived)" and "Days present" with no DEC-007/008/022 tag on this screen, unlike OWN-001. Add the tag. Also consider a "Not checked in (≠ absent)" column so the G1 distinction appears in reports too.
4. **SHR-007 `26:6`:** the top-bar badge says 3 while the list shows "Unread (2)". Align them so the badge cannot be read as counting hidden items.
5. **W2 N-1:** several frame names are shortened (DE-003, DE-005, SHR-009, CC-003, CC-006), which breaks the brief §6 naming rule. Rename them to the full inventory names.
6. **CC-001 Owner view `25:10793`:** "Reassign selected…" appears with no row selection control.
7. **OWN-008 `25:12886`:** the "Developer not yet assigned" badge in a calling-reassignment dialog is out of context. Check that it is intended.
8. **SHR-012 `27:14723`:** the body says "If you still need it, ask the Owner." Keep escalation wording only inside the "if adopted" label.

## 5. Checks that passed (in what was seen)

- **Role boundaries:**
  - CC/DEV get "Flag incorrect data" (SHR-009) and no edit control on SHR-008.
  - DE has no deal or commercial navigation.
  - Exports and audit appear only in the Owner shell, and exports carry an "audited" notice.
  - The Owner duplicate match is still blocked with no override (DE-003 `21:1937`, from code).
- **Calling:**
  - CC-001 buckets are derived (dashed).
  - Start Contact is disabled for Rejected and for a non-assignee.
  - The CC-003 Accepted path creates an "Accepted opportunity" with an optional developer (E5/E3).
  - CC-004 has a "Reminder failed" row (D5, from code).
  - OWN-008 forces a per-follow-up choice (B3-Q03, no default) and offers wait/override on the reservation.
- **Commercial:** DEV-002 shows signature, payment and closure as separate facts, with closure locked until signed and paid. DEV-008 keeps closure committed when provisioning fails (F3). Closed ≠ completed is captioned.
- **Hidden-by-policy:** SHR-012 uses a generic title and no data. The notification entry for an inaccessible target carries no business data.
- **Attendance:** the A1 "no attendance gating" note is on SHR-001. The DEC-026 A/B/C and DEC-011 A/B alternatives are drawn side by side (per the W1 doc; spot-checked on SHR-003 mobile).

## 6. Could not inspect

- **Page 03 kit** (live), **page 02** (live), and pages 10, 11, 14 and 15 live metadata: no successful MCP call. Kit observations come from the agents' change requests and the W0 authoring screenshots only.
- **All Tier B frames** listed in RW-07. That includes every session-expired (SHR-013), save-conflict (SHR-014) and AUTH verification-failure frame, and most CC-005 reservation states other than their names.
- **Whether author fixes landed** after the Tier A screenshots. RW-01, RW-03, RW-05 and RW-06 are not addressed by any fix listed in the W docs.
- Dark theme, prototype links and real data volume: not drawn, and out of scope at low fidelity.
