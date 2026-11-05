# Phase 6 — Call Center screens (page 43 `96:5`) — build notes

Author: Call Center Screen Agent · Batch B · 2026-10-21. Scripts: `docs/phase6/scripts/callcenter/`. Visual reference: approved S3 (page 30). DS instances and Semantic variables only. Dark frames use `setExplicitVariableModeForCollection(Semantic, '40:2')`.

## Run order (one script at a time; sections stack in inventory order)
1. `B01-cc001-calling-queue.js`
2. `B02-cc002-contact-workspace.js`
3. `B03a-cc003-active-contact-primary.js`
4. `B03b-cc003-active-contact-states.js` (adds to the CC-003 section)
5. `B04-cc004-followups-calendar.js`
6. `B05a-cc005-reservation-conflicts.js`
7. `B05b-cc005-reservation-recovery.js` (adds to the CC-005 section)
8. `B06-cc006-followup-drawer.js`
9. `B07-cc007-cc008-opportunities-dnc.js` (two sections)

All scripts are under 45k characters and pass a syntax check.

## Script conventions
- **New section:** it is placed at x 0 and y = (lowest existing section bottom + 400), or y 0 when the page has none. It is never moved on a re-run.
- **Re-runs:** a script removes only its own frames, then rebuilds them. A shared section uses the plugin data `ccPart` = a/b to tell the two scripts' frames apart.
- **Frame layout:** frames sit in rows inside the section (4 desktop or 6 mobile per row). The annotations frame comes last.
- **Returned data:** `OUT.created` holds the frame and section IDs (keyed by screen prefix + frame suffix) plus key regions. `OUT.fit` holds per-frame sizes and overflow lists, and the scroll-viewport hidden items. `OUT.warnings` lists overflow and missing layers or props.
- **Scrolling regions:** they use the approved S3 pattern. The viewport is clipped and a "More below" strip sits in reserved space beneath it, naming the items that are hidden. Nothing overlaps content.
- **Instances:** no x, y or size is set on any instance child. The only overrides are text, props, variant and visibility. Calendar events for the week view are separate instances placed in a plain wrapper frame above the `Calendar/Week` instance, whose own events are hidden.
- **Mobile tap targets:** 44 px hit-area wrappers around chips, tabs and links; Large (48 px) footer buttons. Mobile states use the Inline `State` component, because the Page variant is 480 px wide.

## Scenario
- **Date and user:** Tue 20 Oct 2026 10:32, Maya Khoury.
- **Queue:** 7 businesses, as in S3.
- **Rejected / do-not-call:** Harbor Auto Care.
- **Reservation collision:** Nova Dental Clinic, held by Omar Nassar. He was the previous assignee; the business was reassigned to Maya at 09:15.
- **Owner queue view:** Mon 2 Nov. Cedar Home Realty is "assigned but inaccessible" (B7).
- **CC-007:** dated Thu 22 Oct. Olive & Thyme Café was accepted at the 22 Oct 11:00 follow-up, so the developer is not yet assigned.

## Frames per screen
| Screen | Frames |
|---|---|
| SCR-CC-001 Calling queue | Desktop Light, Desktop Dark, Owner view (B7), Empty, Loading, Error, Mobile Light, Mobile Dark, Mobile Empty |
| SCR-CC-002 Contact workspace | Desktop Light, Desktop Dark (read mode), Start Contact disabled (Rejected), Start Contact disabled (not assignee), Hidden by policy, Mobile Light, Mobile Dark, Mobile Rejected |
| SCR-CC-003 Active contact | a: Desktop Light, Desktop Dark (reserved by me, Needs another call), Mobile Light, Mobile Dark, Mobile Success · b: On hold, Rejected, Accepted (developer deferred), Save failed, Save conflict |
| SCR-CC-004 Follow-ups & calendar | Desktop Light, Desktop Dark (list + reminder failed + today agenda), Week calendar, Empty, Cancel with reason (D2 guard dialog), Mobile Light, Mobile Dark, Mobile Empty |
| SCR-CC-005 Reservation & concurrency | a: Reserved by another agent (Light, Dark), Owner force override (dialog), Overridden by Owner (notice to holder) · b: Expiring, Reservation expired, Network loss, Stale client, Mobile Reserved by another agent, Mobile Reservation expired |
| SCR-CC-006 Follow-up drawer | Create (Light, Dark), Reschedule (reason + history), Past time rejected, Save conflict, Success (toast), Mobile Create, Mobile Past time rejected |
| SCR-CC-007 Opportunities & handoff | Desktop Light, Desktop Dark, Developer assigned, Empty, Owner view |
| SCR-CC-008 Do-not-call & reopening | Desktop Light, Desktop Dark (CC: reopen not permitted), Owner reopen (reason dialog), Reopened |

## Rules kept
- **Rejected businesses:** excluded from callable buckets; reached only through the view-only list.
- **Outcomes:** the four outcomes stay distinct, equal-weight RadioCards with no default.
- **Accepted:** creates an "Accepted opportunity", never a closed deal. Developer assignment can be deferred, and deferring stores no developer and shows no avatar (E3).
- **Needs another call:** always saves with a follow-up or the D2 marker.
- **Reservation release:** only after a successful save.
- **Master data:** read-only. "Request correction" leads to SCR-SHR-009, with no editing on these screens.
- **Follow-up states:** Scheduled, Completed and Cancelled. Due today and Overdue are derived (dashed chips).

## Pending policy labels (never selected)
- **Reservation:** DEC-004; Owner override · DEC-004 (Proposed), one label in every frame (O-2); derived amber "Reserved" queue flag (O-2); B3-Q05 late save (Alt A and Alt B both shown).
- **Outcomes and reopening:** D4, DEC-005, DEC-016, DEC-017.
- **Visibility:** DEC-001 and DEC-002 (Owner view and hidden state).
- **No DEC ID:** overdue threshold and reminder timing.
- **Request-and-approve reopening:** B3-Q09 / ICR-4, noted only.

## Known limits / for the operator
- `Table/Row` cell widths are fixed in the DS. The checkbox cell is hidden, so tables are 1104 px wide.
- Two DS layers are looked up by heuristic and give a warning if not found:
  - the `Calendar/Day` event instances, found by their `Time` property;
  - the dialog footer buttons `Secondary action` / `Primary action`.
- If CC-007 grows when B07 is re-run, it may come to overlap CC-008, which is not moved. The orchestrator may re-space the sections.
- Omar Nassar's nav badges on CC-002 "not assignee" are his own (Queue 5, Follow-ups 2).

## Review 43 fixes (CC-8, scripted, not run)
- **R43-01** (B02): the next follow-up title is now "Due today · 10:30" (meta "Discuss menu website") on desktop and mobile, so the time always shows.
- **R43-02** (B02): the Rejected business subtitle is "Services · Do not call".
- **R43-03** (B02 mobile): this needs DS-13e (CC-1). Card/Section uses "Show action (touch)" on with "Show action" off. Row/Phone uses "Show copy (touch)" on with "Show copy" off. The old fixed 44 px phone-row workaround is gone. If DS-13e has not run, the script warns.
- **R43-04** (B02 mobile): the inventory lists "view history, outcome, follow-ups, notes" for SCR-CC-002 on mobile (P1). So the mobile frames now show a "History & notes" label, the latest attempt, an "Open full history & notes (3)" link in a 44 px hit area, and the latest note. The full-history screen is not drawn; it has the same content as the desktop Call history card.
- **Minor items done:** 1 (Owner view count), 2 and 3 (no counts or nav badges on Empty/Loading/Error; Empty keeps the Do-not-call button), 6 (placeholder), 8 (X-3 113:992 reference), 9 (SCR-SHR-009 frame 175:10802 in B02, B03a, B03b, B05a, B05b, B07), 10 ("Correction submitted · 14 Oct" everywhere), 11 (Rejected history title), 14 (Omar's badges).
- **Not done:** 4, 5, 7 (O-2 reservation flag at 10:32 needs confirmation), 12, 13 (needs an Owner and policy confirmation).

## Review 43 recheck fixes (CC-10, scripted, not run)
- N43-1 (B02), N43-2 and N43-6 (B04), N43-3 (B03a), N43-4 and N43-5 (B03b): see run-log CC-10.
- N43-3: on mobile, "Details · Request correction" routes to the existing SCR-SHR-008 Business detail (page 42, section 175:9043; Mobile Light 175:10448) and the SCR-SHR-009 drawer (175:10802; mobile 175:11442). No new sheet is drawn.
- N43-5: only Rejected hides "Save, keep reservation". Accepted keeps it, as approved.

## Open questions for the Owner
- **Accepted keeps reservation?** Should "Save, keep reservation" stay on the Accepted outcome? It is unchanged until the Owner answers (no DEC ID).
