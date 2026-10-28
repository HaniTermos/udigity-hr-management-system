# Phase 6 — Full High-Fidelity UI: submission for user review (2026-10-23)

**Status:** submitted for review. **Not approved.** No business policy is selected by this submission. Phase 7 has not been started.

**Figma file:** [Udigity Management System](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw)

| Page | Content |
|---|---|
| [40 Auth, Shared & Employees](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=96-2) | SCR-AUTH-001..004, SCR-SHR-001..006 |
| [41 Owner/Admin](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=96-3) | SCR-OWN-001..012 |
| [42 Data Entry](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=96-4) | SCR-DE-001..007, SCR-SHR-008..010 |
| [43 Call Center](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=96-5) | SCR-CC-001..008 |
| [44 Developer](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=96-6) | SCR-DEV-001..008 |
| [45 Cross-cutting States](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=96-7) | SCR-SHR-007, SCR-SHR-011..015 |

Pages 20/21 (design system) and 30 (approved visual sample) are preserved. Per-screen frame links are in [screen-register.md](screen-register.md) and [handoff-ready.md](handoff-ready.md). Fresh previews and their indexes are in `previews/40–45/`.

## Status of the 54 screens

The inventory has 51 rows plus 3 preserved IDs, which makes 54 screens.

| Status | Count | Notes |
|---|---|---|
| Built | 53 / 54 | SCR-DE-003 is not built on page 42 (blocked). It is covered by the approved sample frames 101:5214 and 101:6168. |
| Fresh-preview checked | 53 / 54 | Previews postdate each screen's last script run. |
| Independently reviewed | 53 / 54 | Reviews and rechecks are in `reviews/`. |
| Ready for implementation (pending your approval) | 52 / 54 | 40 clean, plus 12 with recorded gaps (missing or deferred states, listed per screen). |
| Partial | 1 | SCR-OWN-011 Settings. Its fix script C11 was blocked by the safety filter, and you chose not to re-attempt it. |
| Blocked | 1 | SCR-DE-003 duplicate dialog (safety filter; sample frames stand in). |
| Not visually re-verified | 4 | SCR-CC-001, SCR-CC-002, SCR-CC-007 and SCR-DE-006 were re-run after their last recheck. Fresh previews exist, but no reviewer has looked at them again. |

## Safety-filter blocks and how each was handled

| Script / screen | Outcome |
|---|---|
| B07 SCR-SHR-008/009 (Business detail, Submit correction) | Earlier block. Re-run once on your instruction and **built**. Later re-runs were not blocked. |
| C03 SCR-DEV-003, C04 SCR-OWN-004, C08 SCR-OWN-008 | Each blocked once. You authorized one re-attempt each, and all three **succeeded**. |
| C11 SCR-OWN-011 | Blocked. Not re-attempted, by your choice. The earlier frames (275:*) remain. |
| B03 SCR-DE-003 | Blocked early. Never re-run. Covered by the sample frames. |

No block was bypassed through another agent or tool.

## Remaining meaningful issues

**SCR-OWN-011 Settings:**
- The RadioCard grid stops about 23 px short of the card's right padding.
- The C11 fixes (fit check, wrap) are not applied. The location notice (M-16) now reads in full in the current frames.

**SCR-DE-005 drawer (N42-02):** option descriptions wrap at about 210 px inside the 430 px cards. They are readable; accepted as minor.

**Not drawn or deferred:**
- The Withdrawn correction state.
- The D-3 deferred items: Edit schedule drawer, Owner assign developer, DEV-004 schedule-new mode and desktop success, DEV-005 Scheduled/Delivered rows.

**Component limit:** the Notice/Access Context-limited variant needs a container at least 234 px wide.

**Cosmetic (fit-check reports):**
- Developer drawers: 2 px width mismatches.
- SCR-OWN-004 mobile: 6 px below the fold.

**Process incident:** all page-43 preview PNGs were deleted by an operator cleanup bug on 2026-10-22. The design was unaffected, and all 62 previews were retaken. Operators may no longer delete files.

## Open decisions for you

- **Pending policies** (DEC-001…026 and others) stay visibly pending on every screen. None was selected.
- **"Accepted keeps reservation?"** (SCR-CC-003): an Owner question. The current design keeps "Save, keep reservation" on Accepted; only Rejected (do-not-call) releases.
- **"Mark reviewed"** (SCR-OWN-012) depends on the AR-13 departure.
- **Logo:** not supplied, so the placeholder stays.
- **SCR-DE-003 and SCR-OWN-011:** leave them as they are, or authorize a re-attempt.

## Verification limits

- Verification is based on PNG previews (desktop up to 1600 px, mobile up to 900 px). Reviewers did not inspect the canvas directly. Tap sizes and overflows come from the script fit checks plus visual review.
- Review agents and the orchestrator are part of the same system as the builders. "Independent" means a reviewer that did not build that page.
- 4 screens (listed above) were re-run after their last recheck.
- Interactions are annotated only. Prototype wiring is Phase 7.

## Roadmap

1. **Phase 7:** clickable prototype. Waits for your authorization.
2. **Implementation:** Next.js/TypeScript/Tailwind plus Express/PostgreSQL. It reuses the existing project code after an inspection, and starts when you authorize it.
3. **Phase 8:** final design QA and handoff. This does not block implementation.

## User decision (2026-10-23)
1. **Phase 6 APPROVED** by the user.
2. "Accepted keeps reservation?" → **Yes.** Accepted keeps "Save, keep reservation"; only Rejected (do-not-call) releases.
3. SCR-DE-003 and SCR-OWN-011 stay as they are (blocked / partial). No re-attempt.
4. **Logo supplied.** Source: `assets/logo/udigity-logo-original.jpg`. Derived transparent, reversed and horizontal-lockup PNGs are in `assets/logo/`.
5. **Pending business policies:** the user said "do it as it suits u". The Owner delegated the choice. Working defaults are recorded in `docs/policy-defaults.md`. They can be changed later.
6. Phase 7 is authorized; multi-agent execution is allowed.
