# Review 43 — HiFi Call Center (page 43 `96:5`)

Independent UI reviewer · 2026-10-22 · Sources: `previews/43/index.md` (33 of 62 PNGs), `screens/callcenter-spec.md`, the Call Center section of `interaction-spec.md`, `coordination.md` (O-2, X-3, CC-1…CC-7, OP-1…OP-4), and `run-log.md` (OP-3/OP-4 B03a–B05b). **Nothing is approved here.**

Note: the CC-001 and CC-002 PNGs were taken before the OP-1, OP-3 and OP-4 page-43 re-layout passes (78 FILL toggles each time, plus the Touch icons). B01 and B02 were not re-run, so the risk is low. Still, re-take them together with the missing previews.

## 1. Coverage

| Screen | Frames in spec | PNGs in index | Reviewed here | Status |
|---|---|---|---|---|
| SCR-CC-001 Calling queue | 9 | 9 (D-L, D-D, Owner view, Empty, Loading, Error, M-L, M-D, M-Empty) | All 9 (primary L/D/mobile L/D + 5 of 5 states) | Reviewed. Minors only |
| SCR-CC-002 Contact workspace | 8 | 8 (D-L, D-D, Rejected, Not assignee, Hidden, M-L, M-D, M-Rejected) | All 8 (primary L/D/mobile L/D + 4 of 4 states) | Reviewed. R43-01…04 |
| SCR-CC-003 Active contact | 10 | 10, **all STALE** (B03a re-ran in OP-1 and OP-3, and B03b in OP-3, both after the previews) | Coverage only | **Awaiting fresh previews** |
| SCR-CC-004 Follow-ups & calendar | 8 | 5, **all STALE** (B04 re-ran in OP-1 and OP-3). Not taken: Cancel D2 142:52749, M-D, M-Empty | Coverage only | **Awaiting fresh previews** |
| SCR-CC-005 Reservation & concurrency | 10 | 0 (B05a/B05b re-ran in OP-3 and OP-4) | Coverage only | **Awaiting fresh previews** |
| SCR-CC-006 Follow-up drawer | 8 | **0** | Not reviewable | Blocked: no previews (R43-05) |
| SCR-CC-007 Opportunities & handoff | 5 | 1 (Owner view, 10-22). Not taken: D-L, D-D, Developer assigned, Empty | Owner view only. No Light/Dark primary | Partial: no primary L/D (R43-05) |
| SCR-CC-008 Do-not-call & reopening | 4 | **0** | Not reviewable | Blocked: no previews (R43-05) |
| **Total** | **62** | **33** (15 of them stale or out of scope) | 18 | — |

Rule checks on the 18 reviewed frames:

| Check | Result |
|---|---|
| Required actions and fields | CC-001: buckets, open business, Owner agent switch and the Reassign/Unassign/Keep choice are present. CC-002: Start Contact, history, outcome, follow-up and note are present on desktop. The mobile frames lack a history and notes route (R43-04). |
| No master-data editing | Passes. Every business card is read-only with "Request correction". The CC-002 annotation text names SCR-SHR-009, but no frame ID is given (minor 9). |
| Rejected = do-not-call | Passes. Harbor Auto Care is kept out of the buckets, Start Contact is disabled with a reason, follow-ups are blocked and the list is view-only. |
| O-2 facts | Outcome labels match. The "Reserved" and "Assignee inactive" flags never appear on CC-001 (minor 7). The override and the "overridden" notice are on CC-005, which has no previews. |
| Hidden records | The CC-002 hidden frame shows no name or fields and has no breadcrumb name. It is a new drawing rather than a link to X-3 113:992 (minor 8). |
| Light/Dark | Dark frames are readable. Dark Start Contact uses dark text on teal, measured at 7.1:1. |
| Mobile and 44 px taps | CC-1 is still open on CC-002 mobile (R43-03). The CC-001 mobile chips and links use hit44 wrappers in the script, which a PNG cannot confirm. |
| Pending policies | DEC-001, -002, -004, -005, -016, -017, D4 and "No DEC ID" are all labelled. None is decided. |

## 2. MUST-FIX

| ID | Preview file | Frame | What you see | Fix |
|---|---|---|---|---|
| R43-01 | SCR-CC-002 - Desktop - Light.png; - Dark.png; - Light - Start Contact disabled (not assignee).png | Contact panel › Next follow-up | The row reads "Follow-up due today · 10:…" and "Owner back from supplier visi…", so the time of the commitment is cut off. | Let the title and subtitle wrap to 2 lines (textAutoResize HEIGHT), or shorten the title to "Due today · 10:30" so that the time always shows. |
| R43-02 | SCR-CC-002 - Desktop - Light - Start Contact disabled (Rejected).png | Business card subtitle | "Services · Assigned to you · Do not" is clipped mid-word. | Shorten `bizSub` to "Services · Do not call", or let it wrap. Re-check the fit. |
| R43-03 | SCR-CC-002 - Mobile - Light.png; - Mobile - Dark.png; - Mobile - Light - Rejected.png | Contact details card | The "Request correction" header link is about 16 px tall and the phone Copy IconButtons are 32 px. Both are under 44 px. This is CC-1, still open. | DS Maintainer: add a Touch size or a 44 px hit area to the Card/Section header Action and to the Row/Phone Copy. Then re-lay-out page 43 and re-take the previews. |
| R43-04 | SCR-CC-002 - Mobile - Light.png; - Mobile - Dark.png; - Mobile - Light - Rejected.png | Below the latest call attempt | Only one attempt is shown. There is no "Open full history" link and no latest-note row. Mobile CC-002 is P1 and the inventory requires "view history, outcome, follow-ups, notes". | Add an "Open full history (n)" link with a 44 px hit area and the latest-note row, matching the desktop. |
| R43-05 | (none) | CC-005 (10 frames), CC-006 (8), CC-007 D-L, D-D, Developer assigned and Empty, CC-008 (4) | There are no previews. This leaves unchecked the do-not-call list, the Owner reopen dialog, the DEC-016 disabled state for Call Center, the follow-up drawer states, the reservation override against O-2, and the CC-007 primary Light/Dark frames. | Take the 29 missing previews, re-take the 15 stale ones (CC-003 and CC-004), then run review 43b. |

## 3. Minor items

1. **CC-001 Owner view (count).** The header reads "5 businesses visible to Maya", but only 4 distinct visible businesses are shown (Nova, Sunrise, Bloom, Urban Cuts). If Harbor (do-not-call) is counted, say so ("4 in buckets · 1 do-not-call"); otherwise use 4.
2. **CC-001 Loading and Error.** The tabs still show "Due today (2)" and "Overdue (1)", and the nav badge shows 7 while the data has not loaded. Drop the counts, as R42-01 did on page 42.
3. **CC-001 Empty (desktop and mobile).** The Follow-ups nav badge reads 3 while "no businesses are assigned". Also, the desktop header drops the "Do-not-call list" button.
4. **CC-001 desktop filter.** It only offers All, Due today and Overdue, while mobile offers chips for every bucket. Align the two, or note that the desktop bucket headers act as the filter.
5. **CC-001 Light vs Dark.** The bucket header counts are plain digits in Light but circled badges in Dark. Use one treatment.
6. **CC-001/002 filter field.** The placeholder is truncated: "Filter by name, phone or h…". Shorten it to "Filter by name or phone".
7. **O-2 flags.** The Nova Dental collision (held by Omar) shows no amber "Reserved" flag in Maya's queue on CC-001 or CC-002. Confirm whether the reservation exists at 10:32. If it does, show the derived flag, as SCR-OWN-007 does.
8. **CC-002 Hidden by policy.** X-3 asks pages to link to 113:992 instead of drawing new hidden states. Add the reference in the annotation. The copy "It exists" is acceptable (existence only).
9. **Request correction target.** The annotations name SCR-SHR-009 but not frame 175:10802 (OP-1). Add the ID to the B02, B03a, B03b, B05a, B05b and B07 notes.
10. **Correction chip wording.** CC-001 reads "Correction submitted · 14 Oct", while B02, B03 and B05 read "Correction requested 14 Oct". Use the DE-006 state name "Submitted" everywhere.
11. **CC-002 Rejected history.** "Outcome set to Rejected · Maya…" is truncated. Wrap it or drop the name.
12. **CC-002 Mobile Rejected.** The tab bar highlights "Queue", although the record comes from the do-not-call list. Consider a neutral tab state or a back label.
13. **CC-007 Owner view.** "Schedule first meeting" is enabled while the developer is "Not yet assigned". Confirm that this is intended, or disable it with a reason until a developer is assigned. The nav highlights "Deals & Meetings" and has no "Opportunities" entry. Check this against the Owner nav.
14. **CC-002 not assignee.** Omar's nav badge reuses 7 (a known limit in the spec). Set his own count.

## Recheck + CC-003/004 review 2026-10-22

Independent UI reviewer · Sources: the fresh PNGs in `previews/43/index.new.md` (the em-dash file names; the old `index.md` set was not used), the SCR-CC rows of `phase3-4/screen-inventory.md`, `screens/callcenter-spec.md`, and `coordination.md` O-2, CC-8 and CC-9. **Nothing is approved here.**

### 1. Recheck of R43-01…R43-04 (fresh CC-002 previews)

| ID | Verdict | Evidence |
|---|---|---|
| R43-01 | **Verified fixed** | `SCR-CC-002 — Contact workspace — Desktop — Light.png`, `— Desktop — Dark.png` and `— Desktop — Light — Start Contact disabled (not assignee).png`: the Next follow-up row reads "Due today · 10:30" / "Discuss menu website" in full. |
| R43-02 | **Verified fixed** | `SCR-CC-002 — Contact workspace — Desktop — Light — Start Contact disabled (Rejected).png`: the subtitle reads "Services · Do not call" with no clipping. |
| R43-03 | **Fixed but new problem** | `— Mobile — Light.png`, `— Mobile — Dark.png` and `— Mobile — Light — Rejected.png`: the touch variants appear to be in place, although a PNG cannot confirm the 44 px hit area. Each phone row is now about 120 px tall with a large empty band under it, which pushes the rest of the card down. See N43-1. |
| R43-04 | **Fixed but new problem** | Same three mobile files. The "History & notes" label is present, but on Mobile Light and Dark the content beneath it is an empty band: the latest attempt, the "Open full history & notes (3)" link and the latest note are all below the fold ("More below · Latest attempt · Full history link +3"). On Rejected, the link and the note are hidden. See N43-1. |

### 2. Coverage, first review of SCR-CC-003 and SCR-CC-004

| Screen | Primary frames looked at | State frames looked at |
|---|---|---|
| SCR-CC-003 | Desktop Light, Desktop Dark, Mobile Light, Mobile Dark | Rejected, Accepted (developer deferred), Save failed, Save conflict, Mobile Success (5 of 6; On hold not opened) |
| SCR-CC-004 | Desktop Light, Desktop Dark, Mobile Light, Mobile Dark | Week calendar, Empty, Cancel with reason (D2 guard) (3 of 4; Mobile Empty not opened) |

| Check | Result |
|---|---|
| Required actions and states | CC-003 desktop: the four outcomes are distinct with no default, the D2 "Set now / Set later" choice is present, the reservation timer shows, and Save failed and Save conflict exist. Accepted creates an opportunity with "Decide later" and no developer stored (E3). CC-003 mobile has no release or cancel action (N43-3). CC-004: there is a list/week switch, and Reschedule, Complete and Cancel are present; the reminder-failed notice keeps the follow-up unaffected (D5). |
| No master-data editing | Passes on CC-003 desktop: the business card is read-only with "Request correction", and the B03a/B03b notes cite SCR-SHR-009 175:10802. Mobile CC-003 has no route to the business or to Request correction (N43-3). |
| Rejected = do-not-call | The copy is right ("Removes from calling… Start Contact and new follow-ups are blocked"), but the footer still offers "Save, keep reservation" (N43-5). |
| O-2 | Outcome labels match (they carry suffixes such as "On hold — no answer"). Pending is not an option to choose, which is consistent with "no default". The Save-conflict frame contradicts itself (N43-4). |
| Readability / overflow | The Cancel dialog shows the known 320 px field bug (N43-2). On CC-004 desktop the "Recently closed" card is cut off at the bottom of the frame with no "More below" cue (part of N43-6). |
| Mobile and 44 px taps | The CC-003 and CC-004 mobile rows, the chips and the footer buttons look at least 44 px tall. The List/Week segment and the filter chips are about 36–40 px visually; the script wraps them in `hit44`, which a PNG cannot confirm. |
| Light/Dark | All four CC-003 and CC-004 Dark frames are readable. Teal primaries use dark text, and the warning and reminder notices keep their contrast. |
| Pending policies | CC-003: DEC-004, D4 and DEC-005 are labelled and nothing is decided. The D4 open-follow-up radios are disabled and unselected (correct), but their D4 label sits below the fold. CC-004 has gaps (N43-6). |
| Fields full width in dialogs | Fails on CC-004 Cancel (N43-2). The CC-003 panel fields are full width. |

### 3. MUST-FIX

| ID | Preview file | What you see | Fix |
|---|---|---|---|
| N43-1 | `SCR-CC-002 — Contact workspace — Mobile — Light.png`, `— Mobile — Dark.png`, `— Mobile — Light — Rejected.png` | The Row/Phone touch variant makes each phone row about 120 px tall, mostly empty space. On Light and Dark, "History & notes" is followed by an empty band and every R43-04 item is below the fold. This undoes R43-04 in practice. | Row/Phone (Show copy (touch)) should hug its content at 44–56 px; check the 13e variant and the instance's FILL/FIXED height after the page-43 re-layout. Then confirm that the latest attempt and the "Open full history & notes (3)" link show above the footer, and re-take the three previews. |
| N43-2 | `SCR-CC-004 — Follow-ups & calendar — Desktop — Light — Cancel with reason (D2 guard).png` | The Reason textarea is a fixed ~320 px inside a ~470 px dialog body, and the text runs past its border ("confirm a new time."). The "Last open follow-up" notice is clipped mid-word ("Add a r…"). This is the known 320 px bug from page 44. | Set the textarea and the Notice to FILL horizontally (body text `textAutoResize` HEIGHT), re-lay-out and re-take the preview. |
| N43-3 | `SCR-CC-003 — Active contact — log attempt & outcome — Mobile — Light.png`, `— Mobile — Dark.png` | The footer offers only "Keep reserved" and "Save attempt". There is no "Cancel contact" / release action (the inventory requires release, and desktop has it). There is also no route to the business details or to Request correction (SCR-SHR-009) during the call. | Add "Cancel contact" (release, 44 px) to the mobile header or footer, and a "Business details · Request correction" row or link that opens a read-only sheet. |
| N43-4 | `SCR-CC-003 — … — Desktop — Light — Save conflict.png` | The banner says Rana Haddad moved the follow-up to Wed 21 Oct 09:00 at 10:36. Yet the call history still shows "Follow-up due today · 10:30 · Due now", and the queue still lists Olive & Thyme under "Callbacks due today". The draft's "Set now" 22 Oct 11:00 follow-up is hidden below the fold, so "Save again" could create a second open follow-up without the agent seeing it. | Refresh the history and the queue to the latest values in this state. Show "Latest: Wed 21 Oct 09:00" against "Your draft: Thu 22 Oct 11:00" above the fold, with an explicit choice between keeping the latest and replacing it with the draft. |
| N43-5 | `SCR-CC-003 — … — Desktop — Light — Rejected.png` (also `— Accepted (developer deferred).png`) | With Rejected selected, the footer still offers "Save, keep reservation". Holding a reservation on a do-not-call business contradicts Rejected = do-not-call and "Start Contact blocked". The D4 label for the disabled "Open follow-ups" group is below the fold ("More below · D4 label"). | For Rejected (and, unless policy says otherwise, Accepted), hide or disable "Save, keep reservation" with a reason, and keep "Save attempt" (which releases). Move the D4 pending label beside the disabled group. |
| N43-6 | `SCR-CC-004 — Follow-ups & calendar — Desktop — Light.png`, `— Desktop — Dark.png`, `— Mobile — Light.png`, `— Mobile — Dark.png` | The inventory's pending policy DEC-002 Alt B (callback + 48 h) is not labelled on any CC-004 frame; B04 has no "DEC-002" string. The mobile frames show "(DERIVED)" but no "No DEC ID · overdue threshold / reminder timing" label. On desktop, the "Recently closed" card is cut off at the bottom of the frame with no "More below" cue, contrary to the S3 scroll pattern. | Add a DEC-002 Alt B pending chip (never decided) near the Overdue group on desktop and mobile, add the No DEC ID label to mobile, and wrap the desktop list in the scroll viewport with a "More below · Recently closed (n)" strip. |

Not counted (minor): the mobile CC-002 next follow-up meta reads "Owner back from supplier visit", while desktop reads "Discuss menu website"; the mobile CC-004 list shows "Recently closed" items under the "Open · 3" filter; CC-004 desktop has no explicit "Open" action other than the row itself.


## Recheck + CC-005..008 review 2026-10-23

Independent UI reviewer · Sources: the 62 fresh PNGs in `previews/43/index.md`, the SCR-CC rows of `phase3-4/screen-inventory.md`, `screens/callcenter-spec.md`, and `coordination.md` O-2, CC-10 and CC-11. File names below are short forms of the PNGs in `previews/43/`. **Nothing is approved here.**

### 1. Recheck

| ID | Verdict | Evidence |
|---|---|---|
| R43-03 | **Verified fixed** | `SCR-CC-002 — Contact workspace — Mobile — Light.png`, `— Mobile — Dark.png`, `— Mobile — Light — Rejected.png`: the Copy control and the "Request correction" header action are touch-sized. The phone row hugs at about 56 px. |
| R43-04 | **Verified fixed** | Same three files: "History & notes", the latest attempt and "Open full history & notes (3)" are above the fold. The latest note is named in the "More below" strip. |
| R43-05 | **Verified fixed** | All 62 frames are in `index.md`, including CC-005 (10), CC-006 (8), CC-007 (5) and CC-008 (4). |
| N43-1 | **Verified fixed** | CC-002 mobile ×3 (see R43-03/04). |
| N43-2 | **Verified fixed** | `SCR-CC-004 — … — Desktop — Light — Cancel with reason (D2 guard).png`: the Reason textarea and the "Last open follow-up" notice fill the dialog body, with no clipping. |
| N43-3 | **Verified fixed** | `SCR-CC-003 — … — Mobile — Light.png` (and Dark): "Cancel contact" and "Details · Request correction" are in the header row. |
| N43-4 | **Fixed but new problem** | `SCR-CC-003 — … — Desktop — Light — Save conflict.png`: the history and queue are reloaded, the Keep latest / Replace with my draft choice is inline and above the fold, and both save buttons are disabled until a choice is made. However, the "Keep latest" option text is cut off at the panel edge. See N43-12. |
| N43-5 | **Verified fixed** | `SCR-CC-003 — … — Desktop — Light — Rejected.png`: only "Save attempt" is offered, with the caption "Rejected = do not call…". The D4 chip sits beside the disabled Open follow-ups group. |
| N43-6 | **Verified fixed** | `SCR-CC-004 — … — Desktop — Light.png` (also Dark): the DEC-002 Alt B chip is in the Overdue group and the strip reads "More below · Recently closed (2)". `— Mobile — Light.png`: the No DEC ID and DEC-002 chips are present. |

Still open from §3 (minor): 4, 5, 7 (now covered by N43-11), 12 and 13. In `SCR-CC-007 … — Light.png`, "Schedule first meeting" is still enabled with no developer, and the Owner nav still highlights Deals & Meetings.

### 2. Coverage, first review of SCR-CC-005…008

| Screen | Primary frames looked at | State frames looked at |
|---|---|---|
| SCR-CC-005 | Reserved by another agent: Light, Dark, Mobile Light | Owner force override, Overridden by Owner, Expiring, Reservation expired, Network loss, Stale client, Mobile expired (7 of 7) |
| SCR-CC-006 | Create: Light, Dark, Mobile Light | Reschedule, Save conflict, Mobile Past time rejected (3 of 5) |
| SCR-CC-007 | Desktop Light, Desktop Dark (mobile is "—" in the inventory) | Developer assigned, Empty, Owner view (3 of 3) |
| SCR-CC-008 | Desktop Light, Desktop Dark (mobile is "—") | Owner reopen (reason), Reopened (2 of 2) |

| Check | Result |
|---|---|
| Required actions and states | CC-005: all five inventory states are present, plus Expiring, together with Wait / Back to queue, Retry, and an Owner override that needs a reason. CC-006: date/time, responsible user, purpose, note and save are present, with Past time rejected, Save conflict and Success; validation is shown through Past time rejected. CC-007: Assign/Reassign, Edit handoff context and Schedule first meeting are present; Developer not yet assigned (E3) shows on the Owner view; meeting not yet arranged is derived. CC-008: view, the reopen-not-permitted state for the CC role, the Owner reopen with a reason, and Reopened → back to eligibility are all present. |
| No master-data editing | Passes. Each business card is read-only with "Request correction" (CC-005 and CC-008 detail). "Edit handoff context" edits opportunity data, not master data. |
| Rejected = do-not-call | Passes. In CC-008, Start Contact is disabled, Reopen is disabled for the CC role with a reason, and the list is view-only. |
| O-2 | Outcome labels match. The override ends the holder's contact, and the holder sees "Reservation ended by Rana Haddad (Owner)" with nothing saved and the notes kept. The amber "Reserved" queue flag is missing, and the labelling of the override's pending status is inconsistent (N43-11). |
| Readability and overflow | Fails for the drawer and dialog fields and for one detail card (N43-7…N43-10). |
| Mobile 44 px | The CC-005 and CC-006 mobile footers use Large buttons and full-width rows, and every control looks at least 44 px tall. |
| Light/Dark | The CC-005, CC-007 and CC-008 Dark frames are readable. In CC-006 Dark, the field bug is easier to see (N43-7). |
| Pending policies | DEC-004, Owner override (Proposed), B3-Q05 (Alt A and Alt B, neither selected), DEC-005, DEC-017, DEC-016, D4 and No DEC ID are all labelled. In the Owner reopen dialog the outcome is shown as "Set by DEC-016 (undecided)". Nothing is decided. |
| Fields full width | Fails in the CC-006 drawer, the CC-005 override dialog and the CC-008 reopen dialog (N43-7…N43-9). |

### 3. MUST-FIX

| ID | Preview file | What you see | Fix |
|---|---|---|---|
| N43-7 | `SCR-CC-006 — Follow-up create - reschedule (drawer) — Desktop — Light — Create.png`, `— Desktop — Dark — Create.png`, `— Desktop — Light — Reschedule.png`, `— Desktop — Light — Save conflict.png` | In a drawer about 430 px wide, every field (Date and time, Responsible, Purpose, Note, Reason) is a fixed ~320 px. The calendar and chevron icons sit ~90 px away, outside the field. Note text runs past the border ("listing pages.", "morning."), and the helper text is cut off ("…Call Center agent"). In Dark, the field's detached background band is visible. In Save conflict, the warning is clipped ("…while you were editing", "(Maya…", "Nothing…"), and the Date and Reason fields stay editable although the follow-up is Completed and final. | Set the drawer body fields, Notices and helper text to FILL (staged at slot width, as for N43-2), re-lay-out, and re-take the previews. In Save conflict, make the stale fields read-only or hide them. |
| N43-8 | `SCR-CC-005 — … — Desktop — Light — Owner force override.png` | The Reason textarea is ~320 px in a ~470 px dialog body, and its text overruns the border. The key O-2 warning is clipped: "…he is told", "…stale-client rule (". The Owner therefore cannot read what the override does to Omar's draft. | Set the textarea and the Notice to FILL, with notice body text `textAutoResize` HEIGHT, and re-take the preview. |
| N43-9 | `SCR-CC-008 — Do-not-call list & reopening — Desktop — Light — Owner reopen (reason).png` | The Reason textarea is ~320 px. The disabled "Outcome after reopening" select is split into a 320 px field and a detached chevron segment. | Set both fields to FILL in the dialog body and re-take the preview. |
| N43-10 | `SCR-CC-008 — … — Desktop — Light — Reopened.png` | The "Recently reopened" card cuts off its values: "Tue 20 Oct 20", "Owner emailed asking for a w", "Rejected (15 Oct, Maya Khour". This is the audit record of the reopening. The value column looks fixed at ~200 px inside a ~1100 px card. | Set the value texts to FILL with `textAutoResize` HEIGHT, and re-take the preview. |
| N43-11 | `SCR-CC-005 — … — Desktop — Light — Reserved by another agent.png`, `— Desktop — Dark — Reserved by another agent.png` | The frame confirms that Omar has held Nova Dental since 10:24 (so minor 7 is answered). Yet Maya's queue row for Nova Dental shows no amber "Reserved" derived flag, which O-2 requires. Also, the right panel labels the override "Proposed… with no DEC ID", while the Owner dialog and O-2 tie it to DEC-004 (Proposed). | Add the derived "Reserved" chip to the Nova row in these frames and in the CC-001/CC-002 queue at 10:32. Use one label, "Owner override · DEC-004 (Proposed)", in every CC-005 frame. |
| N43-12 | `SCR-CC-003 — Active contact — log attempt & outcome — Desktop — Light — Save conflict.png` | In the new N43-4 choice, the "Keep latest" option reads "Keep latest · Wed 21 Oct 09:00 (Rana Haddad" and is cut at the panel edge. The history subtitle is cut too: "…newest fir:". The agent's deciding option must be readable in full. | Let the radio labels wrap (FILL + HEIGHT), or shorten them to "Keep latest · Wed 21 Oct 09:00 (Rana)". Shorten the subtitle to "Reloaded 10:36 · 3 attempts". Re-take the preview. |

Not counted (minor): Omar's nav badge on "Overridden by Owner" shows Maya's 7. CC-005 and CC-006 have no Mobile Dark frame (none is listed in the spec). On "Reopened", the table does not switch to the "Reopened" filter.
