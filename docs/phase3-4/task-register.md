# Phase 3 + 4 Task Register (orchestrator-owned)

Real subagents launched with the Agent tool from the orchestrator session. Shared rules: [brief.md](brief.md) (P34-1).

**Files (aap047 team):**
- Architecture board (FigJam): https://www.figma.com/board/YKQi8IAz6sOGoLqwolHKPk
- Wireframes (Figma Design): https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw

| ID | Agent | Task | Depends on | Output | Reviewer | Status |
|---|---|---|---|---|---|---|
| H0 | Orchestrator | Phase 2 housekeeping (WF-WORK-001 → WF-CALL-001; Development workload definition; stale status wording; B-1 reporting definition kept) | — | Board 02, SB-3, docs | — | Done |
| H1 | Orchestrator | Create architecture board sections 00–09 and wireframe pages 00–15; write the brief | H0 | Both files | — | Done |
| A | Architecture Agent A | Context, containers, modules, jobs, audit, deployment/recovery, ADRs, traceability, risks | H1 | Sections 01/02/03/07/08/09; `architecture-a.md` | Architecture Reviewer | Done: 10 diagrams, 9 tables, ADR-001..018 (Proposed); adds MOD-access |
| B | Architecture Agent B | ERD, integrity, authorization/visibility, SEQ-01..15, transaction matrix | H1 | Sections 04/05/06; `architecture-b.md` | Architecture Reviewer | Partly done: doc complete; board has 5 ERDs, auth flow, visibility, matrix, SEQ-01..11. **Blocked by Figma MCP quota:** SEQ-12..15 drawing, section resizing, read-back |
| W0 | IA Agent | Sitemap, canonical screen inventory, wireframe kit | H1 | Pages 01/02/03; `screen-inventory.md`, `sitemap.md` | Wireframe Reviewer | Done: 54 screens, 68 kit components, full WF/UC coverage |
| W1 | Wireframe Agent W1 | Shared + Owner screens | W0 | Pages 10/11; `wireframes-w1.md` | Wireframe Reviewer | Done: 22 screens, 128 frames; 5 open-question labels to confirm |
| W2 | Wireframe Agent W2 | Data Entry + Call Center screens | W0 | Pages 12/13; `wireframes-w2.md` | Wireframe Reviewer | Done: 18 screens, 90 frames; 6 inventory + 5 kit change requests |
| W3 | Wireframe Agent W3 | Developer screens + cross-cutting states | W0 | Pages 14/15; `wireframes-w3.md` | Wireframe Reviewer | Done: 14 screens, 54 frames; 4 inventory change requests |
| RA | Architecture Reviewer | One independent review of Phase 3 | A, B | `reviews/phase3-review.md` | — | Done (docs only): 1 Blocker + 9 Major, all A↔B consistency; rulings AR-01..10 in brief §8; A and B fixing docs |
| RW | Wireframe Reviewer | One independent review of Phase 4 | W1–W3 | `reviews/phase4-review.md` | — | Done (indirect evidence; no live Figma): 7 Major (RW-01..07), all need Figma edits → pending quota |
| RX | Reconciliation Reviewer | Architecture ↔ wireframes reconciliation | RA, RW | `reviews/reconciliation.md` | — | Waiting |


**Blocker (external, 2026-10-20):** Figma MCP Education-plan tool-call limit reached on account aap047. All Figma reads and writes fail until the quota resets or the plan changes. Pending Figma work: SEQ-12..15, resizing sections 04–06, architecture-board index (section 00), wireframe cover index, read-backs and screenshots for the reviews.

**Pending wireframe fixes (need Figma):** RW-01 DEV-001 company-wide list must show only eligible closed deals; RW-02 Owner check-in entry on desktop shell (+ sitemap/inventory); RW-03 Development workload as SB-3 three sub-counts on OWN-001 and DEV-005; RW-04 Owner verify/reject closure and remove-fact frames (DEC-006 Alt B); RW-05 DE-003 hidden-match text reveal nothing beyond the DEC-003 placeholder; RW-06 DE-006 redacted row without issue type/requester and excluded from counts; RW-07 screenshot pass of uninspected frames. Kit: dialog/drawer content slot, active-tab property, wrapping policy annotation.

**Resumed after session rate limit:** Agents A and B resumed doc-only AR fixes. Figma quota probe succeeded (architecture-board section bounds read). **Single Figma Operator** now holds all Figma access: Task 1 wireframe fixes RW-01..07 (running); Task 2 architecture-board updates (waits for A/B docs). Quota rules: cached IDs, targeted reads, batched edits, checkpoint screenshots only, stop on any quota error with the exact message.

**Completion (2026-10-20):**
- **Figma Operator:** finished Tasks 1–3 with no quota errors (`wireframe-fixes.md`, `architecture-board-updates.md`).
- **Docs:** Agent A is at rev A-3 (AR-11..16); Agent B absorbed AR-01..09.
- **Reconciliation:** its blocking items RW-01/05/06 are fixed in Figma.
- **Orchestrator spot check:** screenshot of architecture section 00; stale lease note fixed.
- **Merged Phase 3 doc:** `docs/phase_3_system_architecture_and_data_design.md`.

Phases 3 and 4 are **submitted for user review — NOT approved**.
