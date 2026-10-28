# Phase 7 Brief: Clickable Prototype (orchestrator-owned)

Version P7-1, 2026-10-23. Phase 6 was approved by the user on 2026-10-23, and Phase 7 is authorized. Multi-agent work is allowed.

## Goal
Turn the approved hi-fi frames on pages 40–45 of `GNrhb3DWa6mIhEX6F4Nmvw` into a clickable Figma prototype. A reviewer should be able to click through each role's main journeys end to end, on desktop. Mobile-priority journeys get their own flows: My Day, check-in/out, the calling queue and the contact.

## Scope
- **In scope:** prototype reactions (ON_CLICK → NAVIGATE / SWAP / BACK / OPEN_URL), flow starting points, simple Smart-Animate or Dissolve transitions, and scroll behaviour where a frame scrolls. Also: the logo replacement (P8 carried over) and verification of the P7 "Record delivered" open-task warning.
- **Out of scope:** new screens, redesigns, workflow changes, and production code.
  - Exception: tiny connector frames, only if a flow cannot be clicked without one. Each needs orchestrator approval.

## Prototype rules
1. **Same page only.** Figma prototypes can only navigate within a page.
   - Within a page, use NAVIGATE.
   - Across pages, use **OPEN_URL** to the target frame's link: `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=<id with ->`. Examples: login → role home, Request correction → SCR-SHR-008/009 on page 42, links to the page-45 state references.
2. **Look up targets by frame name**, not by hard-coded ID, wherever possible. Frame names follow the brief-6 pattern `SCR-XX-nnn — name — Desktop|Mobile — Light|Dark[ — state]`. Fall back to IDs from `docs/phase6/ids/*.json` and the previews indexes.
3. **Hotspots** are the real buttons, links, rows and tabs on the frame. They are usually instance children; prototype reactions on them are allowed as overrides.
   - Never set x/y/size on instance children, and never detach.
   - If a hotspot can't take a reaction, report it. Do not work around it.
4. **Theme:** wire the Light frames. Dark frames get reactions only where the inventory marks dark for a mobile-priority flow.
5. **One flow starting point per journey**, named `Px — <Role> — <journey>`.
6. **Policies:** the Owner delegated pending-policy choices (`docs/policy-defaults.md`). Where a frame shows alternatives, the prototype follows the working default. Labels drawn in Phase 6 are not changed in Phase 7; that is Phase 8 QA/handoff.
7. **User decision 2026-10-23:** Accepted keeps the reservation.
8. **Blocked screens:**
   - SCR-DE-003 uses the page-30 sample frames (101:5214, 101:6168) via OPEN_URL.
   - SCR-OWN-011 uses its current frames as they are.

## Execution model (same as Phase 6)
- **Role agents** write idempotent Plugin API wiring scripts under `docs/phase7/scripts/<role>/`. Each script:
  - stays under 45k characters;
  - sets the page once;
  - clears and re-applies only its own reactions, so it is idempotent;
  - returns `{wired, missingTargets, missingHotspots, flows}`.

  Role agents never call Figma.
- **One Figma operator** runs scripts one at a time. On a quota error it stops and reports; the orchestrator waits 2 minutes and resumes. A safety-classifier block is recorded and never retried another way. No file deletions.
- **The DS Maintainer** alone changes the Logo component on page 21.
- **Verification:** for each flow, the operator returns a click-path report (frame → hotspot → target) and screenshots of key frames when needed. An independent reviewer checks each flow against `docs/phase6/interaction-spec.md` and the approved workflows.

## Docs

| File | Purpose |
|---|---|
| `docs/phase7/flows.md` | The flow map: journeys, steps, hotspot → target. Each role agent writes its own section. |
| `docs/phase7/run-log.md` | Operator runs |
| `docs/phase7/coordination.md` | Shared board, append-only |
| `docs/phase7/reviews/` | Reviewer findings |
| `docs/policy-defaults.md` | The Owner-delegated working defaults for pending policies |

## Done when
- Every role's main journeys are wired and reviewed.
- The logo is in place.
- The P7 warning is verified.
- A report with flow links goes to the user for review.

Phase 7 is then submitted for review; it is not self-approved.
