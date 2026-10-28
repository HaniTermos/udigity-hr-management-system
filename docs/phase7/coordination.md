# Phase 7 Coordination Board (append-only)

Format: `- [id] FROM → TO: TYPE — message`

## Log
- [P7-0] Orchestrator → ALL: INFO — Phase 7 has started; see brief.md. Phase 6 was approved on 2026-10-23. Accepted keeps the reservation. The logo is supplied in assets/logo/. Policy working defaults are in docs/policy-defaults.md, which is being written.
- [OP-P7-1] Operator → Orchestrator, role agents: DONE — Logo replaced (44:342; Default=navy, On brand=reversed; previews/logo/). Prototype API pilot OK; use docs/phase7/wiring-helpers.js. Action shape: `{type:'NODE', destinationId, navigation:'NAVIGATE', transition:{type:'DISSOLVE', easing:{type:'EASE_OUT'}, duration:0.2}}` (seconds, not ms); OPEN_URL = `{type:'URL', url, openInNewTab:false}`; back = `{type:'BACK'}`. Reactions accepted on FRAME, INSTANCE, and nested instance children (override). flowStartingPoints is settable; the first reaction auto-creates "Flow 1", so setFlow replaces by nodeId.
- [OP-P7-1] see run-log: logo live (Logo 44:342, Surface Default = navy, On brand = white); the pilot validated `docs/phase7/wiring-helpers.js`. **All role agents: use these helpers.**
- [P7-1] Orchestrator → ALL: DECISIONS on the flow-map gaps.
  - **D1 One hotspot, two outcomes:** wire the primary (happy) path. Each alternative outcome gets its own flow starting point, named `P7 — <Role> — <journey> (<alt>)`, that starts at the frame where the branch happens. Examples: Finalize → Success is the main flow; F3 failure is a separate flow. Create business → Save → Success is the main flow; "Duplicate found" is a separate flow whose Save opens OPEN_URL 101:5214 (blocked SCR-DE-003 sample).
  - **D2 Missing result frames:** end the step at the closest existing frame and note it in your flows file.
    - Exception: the Developer may build **connector frames for the P7 "Record delivered" warning check only** (Delivered board + toast), by cloning existing DEV-006 frames and changing status and text only, with no new components. Name them `SCR-DEV-006 — … — Desktop — Light — Delivered (P7 connector)`. No other connector frames without approval.
  - **D3 Data mismatches** (e.g., deal detail shows Cedar, not a Closed-list row; every directory row opens the single Peak detail): accept for the prototype, log them as Phase 8 items in your flows file, and don't redraw.
  - **D4 Shared buttons** (e.g., the DE-004 Save used by edit and request): wire the primary journey; the other journey ends at its own last frame.
  - **D5 "default TBD":** `docs/policy-defaults.md` now exists. Apply its working default.
  - **D6 RadioCards without outcome frames:** no reaction; note it.
- [S-P7-1] Shared → Operator: INFO — run order for the Shared scripts, one at a time:
  1. `scripts/shared/P40-01-auth-signin-2fa-reset.js` (page 96:2)
  2. `P40-02-myday-checkin-checkout.js` (96:2)
  3. `P40-03-attendance-correction-profile.js` (96:2)
  4. `P45-01-notifications-states.js` (96:7)

  Each script is idempotent and under 17k characters, with the helpers inlined. Each returns `{wired, cleared, scroll, missingTargets, missingHotspots, flows, errors}`. Please paste `missingHotspots` back to Shared; the U-3 layer-name guesses are expected there.

  The scripts set 34 flow starts. They also set vertical scroll on mobile «Content» frames, and they use whole-frame ON_CLICK on CI Verifying and on the "P7 — States — reference" chain.

  Resolutions are in `flows/shared.md`, in the section "Resolutions (P7-1) and scripts". Per-role sign-in starts on separate Login frames (Validation error, Invalid credentials and Session expired), because a frame can hold only one flow start.
- [CC-P7-1] Call Center → Operator, Orchestrator: READY — page 43 wiring scripted (0 Figma calls). **Run order:** `scripts/callcenter/P43-01-shell-nav.js` → `P43-02-queue-to-outcome.js` → `P43-03-mobile-queue-contact.js` → `P43-04-reservation-recovery.js` → `P43-05-followups-calendar.js` → `P43-06-opps-dnc-correction.js`. Each one is idempotent, uses wiring-helpers inlined, 13.7k–14.8k chars, `node --check` OK (async-wrapped), and returns `{wired, missingTargets, missingHotspots, flows}` (+errors, notes). Hotspot ownership is disjoint. 23 flows, all prefixed `P7 — Call Center — `. Decisions are applied in `flows/callcenter.md` (P7-CC-2): Pending is skipped (no frame); saves with no success frame end at the closest frame, and self-targets get no reaction; timer states are separate flows (the helper has no AFTER_TIMEOUT); SHR-008/009 use 310:*; D4, B3-Q05 Alt B and DEC-016 follow policy-defaults; the D2 guard keeps the drawn option 1 (no policy row). Please return missingHotspots for any layer-name misses.
- [DE-P7-1] Data Entry → Operator, Orchestrator: READY — run order: P42-01-directory-detail-search → P42-02-create-business → P42-03-edit-business → P42-04-correction-queue → P42-05-submit-correction → P42-06-categories (`docs/phase7/scripts/dataentry/`, page 42 96:4; each <14k, helpers inlined, idempotent, `node --check` OK in async wrapper). Run P42-03 after P42-01 (both touch SHR-008 Light: 01 = shell/tabs/breadcrumb, 03 = "Edit business" + flow start). D1–D6 + policy defaults applied; see flows/dataentry.md "Decisions applied (P7-DE-2)". 9 flows. D1 alt "Duplicate found" starts on DE-002 Validation errors (Save → OPEN_URL 101:5214) because DE-002 Light Save holds the happy path. Please report missingHotspots for breadcrumb TEXT overrides and toasts if refused.
- [D-P7-1] Developer → Operator, Orchestrator: READY — Developer wiring scripts and **run order** for page 44 (`96:6`), in `docs/phase7/scripts/developer/`:
  1. `P44-00-connectors.js` — builds the D2-exception frame `SCR-DEV-006 — Project board — Desktop — Light — Delivered (P7 connector)`. It clones 228:13090 and changes only status and text, plus one DS Toast instance. It does not detach or delete anything, and it does not move the section (it widens it only if needed).
  2. `P44-01-deals-closure.js`
  3. `P44-02-meetings.js`
  4. `P44-03-project-delivery.js` (needs step 1)
  5. `P44-04-sidebar-correction.js` (run last)

  All five are idempotent, 7–10k characters, and pass `node --check` (async-wrapped). Each returns `{wired, missingTargets, missingHotspots, flows, errors}`; please paste `missingHotspots`. Together they set 10 flow starts.
  - DEC-006 Alt B is the main closure path. `Finalize closure…` (Alt A) and the F2-Manual `Create project board` are deliberately left unwired.
  - F3, Success (F2 automatic) and Verification rejected are separate D1 flows.
  - P7 checks 1, 3 and 4 are clickable. Check 2 is not verifiable because no zero-open-task frame exists (Phase 8).

  Details: `flows/developer.md` § "Resolutions (P7-1) and scripts".

- [OP-P7-2] Operator → Shared/ALL: Shared scripts run, one at a time, with no quota errors and no safety blocks. JSON is in `ids/P40-01..03.json` and `ids/P45-01.json`; rows OP-P7-2a–d are in run-log.
  - **P40-01** (96:2): 51 wired, 0 cleared. 10 flows. 0 missingTargets, 0 missingHotspots, 0 errors.
  - **P40-02** (96:2): 107 wired, scroll 6. 10 flows. 0 errors.
    - One missingHotspot: `SHR-001 — My Day Desktop — Light — Empty work list :: Open queue → SCR-CC-001`, where `['My work list','Action']` is not found on the Empty-work-list frame. Shared, please check.
  - **P40-03** (96:2): 116 wired, scroll 3. 6 flows. 0 missing, 0 errors.
  - **P45-01** (96:7): 52 wired, scroll 2. 8 flows. 0 missing, 0 errors.
  - All four scripts: 326 reactions wired, 34 flows set.
  - flowStartingPoints, read back after the runs:
    - Page 40 (96:2), 26 starts:
      - Owner — Sign in with 2FA @169:10438
      - Call Center — Sign in @169:10912
      - Data Entry — Sign in @169:10681
      - Developer — Sign in @169:10751
      - Owner — Sign in with 2FA (mobile) @169:10607
      - Owner — Sign in with 2FA (wrong code) @169:11310
      - Owner — 2FA enrollment & recovery @170:81934
      - Owner — 2FA enrollment & recovery (recovery failed) @170:82467
      - All roles — Forgot / reset password @170:82569
      - All roles — Forgot / reset password (link expired) @170:82836
      - CC — My Day (desktop) @303:10513
      - CC — My Day (mobile, Light) @303:11195
      - CC — My Day (mobile, Dark) @303:11447
      - CC — Check in → check out (desktop) @303:11699
      - CC — check-in verification failure @186:11473
      - CC — Owner-granted remote exception @186:11990
      - CC — checkout verification failure @187:11591
      - CC — summary empty @187:11267
      - CC — check in → out (mobile, Light) @186:11076
      - CC — check in → out (mobile, Dark) @186:11147
      - CC — My Attendance → correction request @303:12029
      - CC — My Attendance @188:10468
      - CC — correction request (approved) @118:58222
      - CC — correction request (rejected) @118:58633
      - CC — Profile and session @189:10468
      - CC — Profile and session (save conflict) @189:11584
    - Page 45 (96:7), 8 starts:
      - Developer — Notifications @165:2880
      - Developer — Notifications (mobile) @165:3285
      - All roles — Permission denied @165:3781
      - Owner — Permission denied (2FA not completed) @165:4032
      - Call Center — Hidden record @269:2916
      - Call Center — Session ended @269:3652
      - All roles — Save conflict (field-level diff) @270:2918
      - States — reference @270:3509
  - Every start name above carries the `P7 — ` prefix. "CC" stands for "Call Center".
- [O-P7-1] Owner → Operator, Orchestrator: READY — Owner wiring scripts for page 41 (96:3) are in docs/phase7/scripts/owner/. Each is under 20k chars, passes node --check, and returns {wired, missingTargets, missingHotspots, flows}. **Run order:** P41-01-shell-nav → P41-02-dashboard → P41-03-employees → P41-04-attendance → P41-05-targets-assignments → P41-06-reports-audit → P41-07-settings-delivery (any order after 01; re-runs are safe). There are 13 flow starts, including D1 alts: Partial data retry, Reject, Export failure, Not configured. DEC-011 = Alt B. Export Preparing→Success uses ON_CLICK (the helper has no AFTER_TIMEOUT). Gaps end at the closest frames (F3 → OWN-012 Empty; OWN-008 Cancel → All choices made; OWN-006 Manual/Adjust); Omar/Maya and Retrying are left for Phase 8. Details are in flows/owner.md.
- [P7-2] Orchestrator → ALL: HOLD on Figma writes. The operator session ended on an Anthropic model safeguard ("Opus 5.5's safeguards flagged this message … [reasoning_extraction]") after P43-01. The user has asked for a report before any resumption, so **no new operator may start until the user resolves it**. Also from the user:
  - The policy defaults are **demonstration alternatives**, not approved policies. Label every dependent prototype step that way.
  - The click-to-advance export is a prototype simplification and must be annotated.
  - Syntax checks and dry runs do not mean the wiring is complete.
- [OP-P7-4] Operator → ALL: Batch 1 DONE — page 43 (96:5) Call Center.
  - P43-02 check (OP-P7-4-CHECK): NOT APPLIED before the stop (0/27 hotspots had reactions, 0/6 flows), so it ran once (OP-P7-4a).
  - Runs: P43-02 wired 27 / flows 6; P43-03 wired 20 / flows 2; P43-04 wired 14 / flows 7; P43-05 wired 20 / flows 4; P43-06 wired 23 / flows 4. All: missingTargets 0, missingHotspots 0, errors 0. JSON in ids/P43-02…06.json.
  - Read-back: 23 named P7 flow starts on page 43, 0 auto "Flow N". 269 reactive nodes on 42 of 72 frames (script sum 271; 2 hotspots re-targeted by a later script, e.g. rsOverridden Breadcrumb 314:15367 now → CC-001 from P43-04).
  - Reactions per frame: CC-001 D-L 8, M-L 5, M-D 3 · CC-002 D-L 11, D-L Rejected 7, M-L 6, M-D 6, M-L Rejected 4 · CC-003 D-L 14, On hold 14, Rejected 14, Accepted 14, Save failed 11, Save conflict 10, M-L 7, M-D 7, M-L Success 6 · CC-004 D-L 9, Week 6, Cancel D2 2, M-L 3, M-D 2 · CC-005 Expiring 12, Expired 11, Network loss 10, Stale 10, Reserved 11, Override 1, Overridden 2, M Reserved 5, M Expired 6 · CC-006 Create 2, Reschedule 2, Past 1, Conflict 2, Success 1, M Create 2, M Past 1 · CC-007 D-L 6, Dev assigned 7 · CC-008 D-L 7, Owner reopen 1.
  - Hotspot notes: Request correction landed on the "Action"/"Action touch" child instance; dialog confirms on "Primary action"/"Secondary action"; List/Week on "Tab 1/2".
  - Labels ("Demonstration alternative — not approved") are NOT yet added; still open per handoff. Next: Batch 2 (Data Entry P42-01…06) on orchestrator go.
- [OP-P7-5] Operator → ALL: Batch 2 DONE — page 42 (96:4) Data Entry.
  - Pre-check (OP-P7-5-CHECK): clean. There were 0 flows and 0 reactions on 68 frames.
  - Runs: P42-01 wired 51 / flows 2; P42-02 wired 31 / flows 2; P42-03 wired 41 / flows 1; P42-04 wired 47 / flows 1; P42-05 wired 9 / flows 1; P42-06 wired 20 / flows 2. missingTargets 0. JSON in ids/P42-01…06.json.
  - Figma refused 8 self-target reactions (`destinations must be a different top-level frame`), all harmless: active sidebar items, the active queue tab, and SHR-010 search to itself.
  - Real gaps for the DE role agent:
    - SHR-010 "Clear search" hotspot not found.
    - The DE-007 Permission-denied notice has no "Go to My Day" or "Back/Go to Businesses" action, so it is unwired. The sidebar still provides exits.
  - Read-back: 9 named P7 flow starts, 0 auto. 199 reactive nodes on 27/68 frames, which matches the script sum.
  - Per frame: DE-001 16 · DE-002 10 / Validation 11 / Success 10 · DE-004 13 / Dup blocked 1 / Conflict 15 / Success 11 · DE-005 In review 5 / Already resolved 2 / Dup on apply 3 / Success 4 · DE-006 13 / Resolved 10 / Closed 10 · DE-007 9 / Name exists 3 / In use 1 / PD 7 · SHR-010 10 / Owner 4 · SHR-008 12 / History 10 / CC read-only 2 · SHR-009 Warning 3 / Validation 3 / Submitted 1.
  - Blocked-screen check: in Duplicate found, DE-002 Validation errors "Save business" (170:10091) opens OPEN_URL node-id=101-5214, which is the page-30 frame "S4-B Create business — duplicate blocked (visible match)". Confirmed. No script links to 101:6168.
  - Labels are still not added. Next: Batch 3 (Developer, P44-00 connector clone) when the orchestrator says go.
- [OP-P7-6] Operator → ALL: Batch 3 DONE — page 44 (96:6) Developer.
  - **Pre-check (OP-P7-6-CHECK):** only the pilot was present (1 flow, 3 reactions). The P44 scripts replace reactions by node and flows by nodeId, so the pilot was replaced, not duplicated.
  - **P44-00 connector:** new frame **389:13120** "SCR-DEV-006 — Project board — Desktop — Light — Delivered (P7 connector)".
    - Placement: inside section 118:59065 at (13070,200), 1440×900.
    - Section: stays at (0,9192); width grew 13030 → 14590 to the right only.
    - Checks: no overlap; 0 inherited reactions. Re-run reused the frame (created:false, 1 copy).
    - Link: https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=389-13120
  - **Runs:** P44-01 wired 20 / flows 4 (1 missing: Verification rejected "Request closure verification" button); P44-02 16 / 2; P44-03 30 / 2; P44-04 33 / 2.
    - Errors: only 3 harmless self-targets (Figma rejects a link to the frame you are already on): the active sidebar items on DEV-001, DEV-003 and DEV-005.
  - **Read-back:** 10 P7 flows, 0 auto. 100 reactive nodes on 27/68 frames (99 from scripts + leftover pilot TD 171:11776 → DEV-002, same target as its row). The pilot Request correction now → 310-13530; no stale 175:* URLs.
  - Per frame: DEV-001 9 / Accepted 6 · DEV-002 6 / Accepted 1 / Rejected 5 · DEV-003 D 4 / M 2 · DEV-004 Resched 4 / Val 2 / Outcome 3 / M Resched 2 / M Outcome 2 / M Saved 1 · DEV-005 5 · DEV-006 10 / Completed 4 / M 1 / P7 warning 4 / Waiting 3 / Blocked 3 / Connector 4 · DEV-007 4 / Val 2 / Success 6 · DEV-008 AltB 3 / F3 2 / Success 2.
  - **P7 "Record delivered" path verified:**
    1. Board 228:13090: card Content upload → task drawer DEV-007 267:13129 (Close → BACK).
    2. Board "Record delivered" 228:13255 → open-task warning 266:13124.
    3. Warning "Primary action" → connector 389:13120. Cancel → BACK.
  - **Still open:** the labels are not added.
  - **Next:** Batch 4 (Owner P41-01…07) when the orchestrator says go.
- [P7-3] Orchestrator → ALL: HOLD. A safety classifier interrupted the operator during owner/P41-05-targets-assignments.js. The message was: "Interrupted: the response that made this tool call was stopped by a safety classifier while the call was running; it may have partially or fully completed." The last verified checkpoint is OP-P7-7d (P41-04). P41-05's state is unknown. Not done: P41-06, P41-07, the page-41 read-back and Batch 5 (labels). No retry. Waiting for the user.
- [P7-CLOSE] Orchestrator → ALL: Phase 7 CLOSED as partially complete on the user's instruction. The last verified Owner checkpoint is P41-04. P41-05 is UNCERTAIN. P41-06 and P41-07 were NOT EXECUTED. Labels were not applied in Figma. See closeout.md. No further Figma writes.
