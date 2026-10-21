# Phase 2 Task Register (orchestrator-owned)

**Phase 2 APPROVED by the user on 2026-10-20 (baseline). Register closed; Phase 3/4 work is tracked in `docs/phase3-4/task-register.md`.**

Execution model: **real subagents** launched with the Agent tool from the orchestrator session (Claude Code). Each has its own context and receives `shared-baseline.md` (SB-1 at launch; SB-2 from the Batch 2 repair onward). Agents cannot see each other's work except through the files listed here.

Board 02 section nodes: 04 = `30:1421`, 05 = `30:1424` (created by the orchestrator, empty, leased to Agent 2).

| ID | Agent | Task | Depends on | Output | Reviewer | Status | Open issues |
|---|---|---|---|---|---|---|---|
| T1 | Agent 1 — Attendance & Work | Track Batch 1 findings F-01..F-10; assess Contract A; note any Batch 1 updates needed from contracts (docs only, no board writes) | SB-1 | `docs/phase2/batch1-maintenance.md` | Orchestrator | Done (docs). Repairs not executed | 10 non-policy defects (N-1..N-10) proposed; top decisions DEC-011 (F-01), DEC-026+DEC-012 (F-02), alert thresholds (F-05) |
| T2a | Agent 2 — Business Data & Visibility | Draft Batch 2 specs, Mermaid, transition/decision tables, scenarios | SB-1 | `docs/phase2/batch2/` | Independent Reviewer | Draft done | 10 diagrams proposed; 3 BCRs, answered in SB-2 §10 (R-01, R-02, R-04) |
| T2b | Independent Reviewer | Review Batch 2 draft (logic, coverage, contracts) | T2a, SB-2 | `docs/phase2/reviews/batch2-spec-review.md` | — | Done: **Not ready** | 1 Blocker (RV2-01 R-06 resource list), 11 Major, 12 Minor; 12 user questions. Root cause: draft built on SB-1 |
| T2b-fix | Agent 2 | Repair attempt 1 of the Batch 2 draft (no drawing) | T2b | `docs/phase2/batch2/repair-log.md` | Independent Reviewer (re-review) | Done. Re-review r2: all 23 fixed; 5 new Minors (RV2-24..28) | — |
| T2c | Agent 2 | Fix RV2-24..28; draw Batch 2 on sections 04/05; read back + inspect | r2 review, orchestrator integration check OK | Board 02 sections 04/05; `docs/phase2/batch2/verification.md` | Independent Reviewer | Done: 11 diagrams + 5 tables drawn; 9 render defects fixed | Escalated after 2 attempts: WF-BIZ-001 P2 edge label overlaps `canRead` |
| T0-nav | Orchestrator | Lease notes, Batch status, legend edge-colour row, Batch 2 coverage table in section 12 | T2c | Board 02 sections 00 and 12 | — | Done (no overlaps) | — |
| T2d | Independent Reviewer | Review drawn Batch 2 artifacts with evidence | T2c | `docs/phase2/reviews/batch2-artifact-review.md` | — | Done: no Defective artifact, no Blocker/Major | Minors RV2A-01 (label overlap; manual nudge), RV2A-02 (red "No" on normal paths), RV2A-03 (SM-DATAFIX crowding), RV2A-07 (3 header lines incomplete), RV2A-08 (VT-2/VT-7 not drawn) |
| T3 | Agent 3 — Calling & Follow-ups | Draft Batch 3 specs + dependencies (NO board writes) | SB-1 | `docs/phase2/batch3/` | (later) | Draft done (not reviewed, not drawn) | 7 BCRs (B3-01 calling-outcome model has no ID; B3-02 reminder scope); T-8 two workflows create calling assignments (WF-WORK-001 vs WF-CALL-001) |
| T4 | Agent 4 — Deals, Delivery & Remaining Ops | Draft Batch 4 specs + dependencies (NO board writes) | SB-1 | `docs/phase2/batch4/` | (later) | Draft done (not reviewed, not drawn) | 8 BCRs (folded into SB-2 R-04..R-13); tension DEC-005 vs DEC-006 (R-12, user decision); needs board sections 01 and 08–10 plus a state-model location |
| T3r | Independent Reviewer | One review of Batch 3 | T3 | `docs/phase2/reviews/batch3-review.md` | — | Done: ready after 11 Major fixes (mostly SB-2 alignment) | — |
| T4r | Independent Reviewer | One review of Batch 4 | T4 | `docs/phase2/reviews/batch4-review.md` | — | Done: ready after 6 Major fixes | — |
| T3d | Agent 3 | Fix RV3-01..11; draw in 06/07 under the board lock | T3r | Board 02 06/07; `docs/phase2/batch3/verification.md` | Integration Reviewer | Done: 11 fixes; 14 diagrams + 6 tables drawn (resumed once after a rate limit) | State diagrams omit self-transitions (generator limitation); tables are authoritative |
| T4d | Agent 4 | Fix RV4-01..06; draw in 01/08/09/10 under the board lock | T4r | Board 02 01/08/09/10; `docs/phase2/batch4/verification.md` | Integration Reviewer | Done: 6 fixes; 16 diagrams + 7 tables drawn (resumed once after a rate limit) | Cosmetic only: long edge loops, stacked labels; SM-COMMERCIAL/SM-PROJECT carry some edges in their tables only |
| T5 | Integration Reviewer | Batch 5 cross-batch QA | Batches 2–4 drawn | `docs/phase2/reviews/batch5-integration.md` | — | Done: one pass. 1 blocking issue (B-1) found; orchestrator fixed it in the Batch 3/4 specs and the board G1 table (`93:4914`) | Non-blocking N-1..N-9 recorded in the review |
