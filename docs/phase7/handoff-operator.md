# Phase 7 operator handoff (facts only), 2026-10-23

## Task and approved scope
- **Task:** wire the approved Phase 6 hi-fi frames into a clickable Figma prototype, as set out in `docs/phase7/brief.md`.
- **Scope:** add prototype reactions and flow starting points only.
- **Not allowed:** redesign, production code, detaching instances, setting x/y/size on instance children, and deleting files.
- **Resumption authority:** the user authorized resuming via the new-session recovery path after a model safeguard stop on 2026-10-23. If a safeguard rejects anything again, stop that work, report the exact error and the last verified checkpoint, and do not retry.

## References
- **Figma file:** `GNrhb3DWa6mIhEX6F4Nmvw`.
- **Pages:** 40 `96:2`, 41 `96:3`, 42 `96:4`, 43 `96:5`, 44 `96:6`, 45 `96:7`.
- **Docs and code:**
  - Board: `docs/phase7/coordination.md` (append-only).
  - Run log: `docs/phase7/run-log.md`.
  - Script results: `docs/phase7/ids/`.
  - Helpers: `docs/phase7/wiring-helpers.js`.
  - Flow maps: `docs/phase7/flows/*.md`.
- **Reaction shape (validated by the pilot):**
  - Navigate: `{type:'NODE', destinationId, navigation:'NAVIGATE', transition:{type:'DISSOLVE', easing:{type:'EASE_OUT'}, duration:0.2}}`
  - Open URL: `{type:'URL', url, openInNewTab:false}`
- **Flow starting points:** each frame holds at most one. Replace an existing start by node ID.

## Confirmed completed writes
| Script | Result |
|---|---|
| Logo component 44:342 | Done. Surface Default = navy, On brand = white |
| Pilot on page 44 | Done. DEV-001 → DEV-002 and a URL link; flow "P7 — Developer — Deal to project" |
| shared/P40-01 | 51 wired, 10 flows |
| shared/P40-02 | 107 wired, 10 flows, 1 missing hotspot |
| shared/P40-03 | 116 wired, 6 flows |
| shared/P45-01 | 52 wired, 8 flows |
| callcenter/P43-01-shell-nav | 167 wired, 0 flows, 1 missing hotspot. **This is the last verified checkpoint.** |

## Uncertain
- `callcenter/P43-02-queue-to-outcome.js` may or may not have been sent before the stop. It has no run-log row and no ids JSON.
- **Next step:** do a read-only check of the P43-02 hotspots and flows listed in that script, and classify it as applied fully, partially, or not at all.

## Prepared scripts not yet run
Each script is idempotent: it clears and re-applies only its own reactions. Run them in this order:

| Role | Folder | Scripts |
|---|---|---|
| Call Center | `docs/phase7/scripts/callcenter/` | P43-02, P43-03, P43-04, P43-05, P43-06 |
| Data Entry | `docs/phase7/scripts/dataentry/` | P42-01 … P42-06 |
| Developer | `docs/phase7/scripts/developer/` | P44-00 (connector frame clone), then P44-01 … P44-04 |
| Owner | `docs/phase7/scripts/owner/` | P41-01 … P41-07 |

## Labels still required
1. Every step that depends on `docs/policy-defaults.md` must be labelled **"Demonstration alternative — not approved"**. The only exception is "Accepted keeps reservation", which the user explicitly approved.
2. The Owner export Preparing → Success click-to-advance step must be annotated **"Prototype simplification — real export is synchronous"**.
3. Add these as Figma annotations, or as a small text note beside the affected frames inside each section, without moving any section. List each affected frame.
