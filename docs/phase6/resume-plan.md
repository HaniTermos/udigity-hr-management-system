# Phase 6 — Resume plan (orchestrator) — updated 2026-10-22

**Status:** stopped at the Figma quota during OP-8, at developer/C02. The exact text was "You've reached the Figma MCP tool call limit on the Education plan. Upgrade your plan for more tool calls".
- Phase 6 is **not** approved.
- Only ONE Figma operator at a time.
- Use curl with `--max-time 60` for preview downloads.
- Never touch `backend/` or other implementation work.

## Figma work remaining, in order
1. **Call Center (page 43):** DONE in OP-7/OP-8 (B01–B07). CC-9 only renamed the scroll area, with no visual change, so do NOT re-run B02 (saves quota).
2. **Developer (page 44):** C02, C02b, C04, C06b, C07, C08. Report the stale-layer check (N44-1/N44-2).
3. **Cross-cutting (page 45):** D02, then D03 (X-10).
4. **DS:** 13f ran in OP-8 with 0 changes (Icon/copy was already set; the glyph warning is likely a false positive).
5. **Owner (page 41):** the scripts listed in [O-7], for M-14, M-16, N41-1 and N41-2. C04 and C08 each had one safety-classifier interruption earlier and then ran fine. Any new block → record the message and do not retry.
6. **Re-layout, Touch icons and overlap check** on pages 41, 43, 44 and 45.
7. **Previews,** changed frames only:
   - page 43: all frames, since everything re-ran or was never taken;
   - page 44: the frames from C02, C02b, C04, C06b, C07 and C08;
   - page 45: the D02 and D03 frames;
   - page 41: the frames from the O-7 scripts;
   - page 40: A01–A06 and A08 frames (STALE since the R40 runs);
   - page 42: B01, B02, B04, B05, B06, B08 frames, plus the Dark, mobile and state frames of SHR-008/009.

## Non-Figma work after the previews
- Rechecks of pages 40, 42, 43 and 45 against the fresh previews.
- Page 43 review of SCR-CC-003…008.
- Rechecks of N44-1/2 and N41-1/2.
- Reconcile `screen-register.md` and `handoff-ready.md` into these statuses: Built / Fresh-preview checked / Independently reviewed / Ready for implementation / Partial or Blocked.
- Final report, then wait for the user's approval before Phase 7.

## Done since the last plan
- SHR-008/009 built (175:9048, 175:10802).
- OWN-004 and DEV-003 re-attempts OK.
- C08 re-attempt OK (M-13 fixed).
- 13e run.
- Fresh previews:
  - page 44: 57 previews (OP-5-44);
  - page 41: 78 previews (OP-5-41).
- Rechecks of 44 and 41 done.
- Page 43 review partial (R43-01..05).
