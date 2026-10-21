# Phase 3 + Phase 4 Shared Brief (AUTHORITATIVE — orchestrator-owned)

Version: P34-1, 2026-10-20. **Only the orchestrator edits this file.** If an agent needs a change, it writes a "Brief change request" in its own staging file.

## 1. Status and authority
- **Phase 2 is APPROVED** (2026-10-20) as the workflow and state-model baseline. **No unresolved business-policy alternative is selected; keep them visibly pending.**
- **Phase 3 (Architecture) and Phase 4 (Low-fidelity wireframes)** are authorized and run in parallel. Their outputs go to the user for review; **never mark them approved**.
- **NOT authorized:** Phase 5 design-system production, high-fidelity screens, production application code, production SQL.
- **Authority order:** user requirements and approved decisions → approved Phase 2 baseline → FigJam representations → unapproved AI proposals.
- Where the diagram generator could not draw a Phase 2 transition (e.g. self-transitions), **the Phase 2 transition tables are authoritative**.
- Do not reopen Phase 2. If you find a genuine contradiction that blocks your work, record it as a "Blocking contradiction" in your staging file and continue with unaffected work.
- If a policy decision blocks one area, show it as a labelled placeholder/branch and continue elsewhere. Never invent an approved policy.

## 2. Sources (read; do not edit)

| What | Where |
|---|---|
| Product requirements (tier 1) | `docs/product-description.md` |
| Phase 2 baseline: rules, IDs, contracts A–G, rulings R-01..R-13, terms, Development workload definition | `docs/phase2/shared-baseline.md` (SB-3) |
| Batch 1 specs (attendance, targets) | `docs/phase_2_workflows_and_state_machines.md` §7–§13 |
| Batch 2–4 specs | `docs/phase2/batch2/batch2-spec.md`, `docs/phase2/batch3/batch3-spec.md`, `docs/phase2/batch4/batch4-spec.md` |
| Final Phase 2 check (open user decisions in section e) | `docs/phase2/reviews/batch5-integration.md` |
| Decision proposals (unapproved; never rules) | `docs/decisions.md`, `docs/artifact-register.md` |
| Board 02 (Phase 2 diagrams), **read-only** | FigJam fileKey `lwmKQNJI42na8B3SSNLQJP` |
| Board 01 (product map), **read-only** | FigJam fileKey `Ml01oLIuAs3MTzxQ7PW1L0` |

Never touch the separate `D:\udigity company\udigity platform` project. Never read credential files.

## 3. Confirmed technical direction (Phase 3 constraints)
- **Product shape:** internal tool for ~5–6 employees; one company, **no multi-tenancy**.
- **Roles:** four application roles (Owner/Admin, Data Entry, Call Center, Developer), one per employee. Infrastructure operators are not an application role. English UI; responsive desktop and mobile; light and dark themes.
- **Stack:**
  - Frontend: React/Next.js.
  - Backend: Node.js + Express, a **monolith organized in domain modules**.
  - Database: PostgreSQL.
  - Deployment: Docker on one VPS, behind a reverse proxy / TLS.
- **Security:** email/password login; mandatory Owner 2FA; password recovery plus Owner-triggered reset assistance; role-based API protection; audit logging; backups with documented recovery.
- **Do not introduce:** microservices, Kubernetes, one service per module, Redis or message brokers without a justified need, accounting or payroll, telephony, social-data scraping.
- **Background work:** a background worker may share the same codebase. PostgreSQL-backed job tables or sessions are acceptable; justify the choice.
- **API layering:** do not duplicate business APIs in Next.js and Express without justification. State which layer owns business logic and authorization (expected: Express domain modules), and whether deployment uses a shared origin.
- **Separate these concepts explicitly:**
  - Account state vs session state
  - Attendance state vs punctuality classification
  - Assignment vs call outcome vs commercial stage
  - Follow-up vs reminder delivery
  - Project vs task lifecycle
  - Visibility timer origin vs exception policy
  - Business master data vs operational history
- **Visibility:** a company-wide view does not imply permanent visibility; read ≠ edit; Owner access never bypasses authentication or audit. WF-ACCESS-001 / SM-VISIBILITY-001 (Batch 2, Table RT) is the single access definition.
- **Artifacts:** no production SQL, no backend or frontend code. A conceptual ERD and textual constraint descriptions are fine.

## 4. Destinations and write leases (one writer per section or page)

**Architecture board (FigJam)** `YKQi8IAz6sOGoLqwolHKPk`: https://www.figma.com/board/YKQi8IAz6sOGoLqwolHKPk

| Section | Node | Writer |
|---|---|---|
| 00 — Index, Legend & Decisions | `1:2` | Orchestrator |
| 01 — System Context | `1:5` | Architecture Agent A |
| 02 — Containers & Trust Boundaries | `1:8` | Architecture Agent A |
| 03 — Modular Monolith | `1:11` | Architecture Agent A |
| 04 — Conceptual ERD | `1:14` | Architecture Agent B |
| 05 — Authorization & Visibility | `1:17` | Architecture Agent B |
| 06 — Sequences & Transactions | `1:20` | Architecture Agent B |
| 07 — Jobs, Notifications & Audit | `1:23` | Architecture Agent A |
| 08 — Deployment & Recovery | `1:26` | Architecture Agent A |
| 09 — Traceability & Risks | `1:29` | Architecture Agent A |

**Wireframe file (Figma Design)** `GNrhb3DWa6mIhEX6F4Nmvw`: https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw

| Page | Page id | Writer |
|---|---|---|
| 00 Cover & Index | `0:1` | Orchestrator |
| 01 Sitemap & Navigation | `1:2` | IA Agent (W0) |
| 02 Screen Inventory | `1:3` | IA Agent (W0) |
| 03 Wireframe Kit | `1:4` | IA Agent (W0) — others may only *instantiate* its components |
| 10 Shared — Auth, Profile, Attendance, My Work | `1:5` | Wireframe Agent W1 |
| 11 Owner/Admin | `1:6` | Wireframe Agent W1 |
| 12 Data Entry | `1:7` | Wireframe Agent W2 |
| 13 Call Center | `1:8` | Wireframe Agent W2 |
| 14 Developer | `1:9` | Wireframe Agent W3 |
| 15 Cross-cutting States | `1:10` | Wireframe Agent W3 |

**Lock for the architecture board** (Agents A and B both use `generate_diagram`, which drops loose top-level nodes):
1. Before each `generate_diagram`, create the directory `C:/Users/Hani/AppData/Local/Temp/claude/D--udigity-company-udigity-hr-system/afffccab-67aa-402b-a6ff-b54731f49d96/scratchpad/arch-board.lock`, and write an `owner` file inside it with your name and the time.
2. If the directory already exists, do other work and retry later.
3. While holding the lock: snapshot the top-level node IDs, generate, diff to find **your** new nodes, wrap them **in place** in a new section (absolute positions preserved; never reposition loose connectors), then move that section into your leased section.
4. Release the lock (`rmdir`) immediately afterwards.
5. Filesystem calls on that path are slow; use a 300000 ms timeout.
6. Never delete another agent's lock; report a lock held for more than 15 minutes to the orchestrator.

The wireframe file needs no lock: each agent writes only on its own pages through `use_figma`.

**Figma skills (mandatory):**
- FigJam diagrams: `figma:figma-generate-diagram` (+ its `references/` for flowchart, sequence, erd, state, architecture), `figma:figma-use`, `figma:figma-use-figjam`.
- Design-file wireframes: `figma:figma-use` and `figma:figma-generate-design`.
- Load the MCP tool schemas through ToolSearch.
- Read back with `get_figjam` (FigJam) or `get_metadata` (design), and inspect with `get_screenshot` (`enableBase64Response: true`).
- If the same rendering defect survives 2 repair attempts, record it and move on.

## 5. Canonical IDs
- **Keep all Phase 2 IDs:** UC-, WF-, SM-, DEC-, REQ ranges, contracts, R- rulings.
- **New IDs:**
  - Architecture decisions: `ADR-001..`, written as Proposed ADRs.
  - Modules: `MOD-<name>`.
  - Entities: plain PascalCase names in the ERD.
  - Sequences: `SEQ-01..15`, matching the list in §6.
  - Risks: `RISK-01..`.
  - Screens: `SCR-<ROLE>-nnn`, where ROLE ∈ {AUTH, SHR, OWN, DE, CC, DEV}. The IA Agent owns this inventory.
  - **Keep the three screen IDs Board 01 already references, with their meanings:**
    - `SCR-OWN-004`: Owner attendance monitoring and exception alerts.
    - `SCR-CC-005`: Call Center contact reservation and concurrency block.
    - `SCR-DE-006`: Data Entry correction-request queue.
  - The original screen inventory (ART-07) is unavailable. The new inventory becomes canonical and states that.

## 6. Deliverables

**Architecture Agent A** — sections 01, 02, 03, 07, 08, 09; doc `docs/phase3-4/architecture-a.md`:
- **System context:** four roles, the system, email service, backup destination; operators shown separately.
- **Container view:**
  - Browser, Next.js, Express API, PostgreSQL, background worker, reverse proxy/TLS, email provider, backup storage.
  - Attachment storage only if justified (deal attachments are unresolved; DEC-018).
  - Who owns business logic and authorization; same-origin decision; how authenticated requests and sessions work.
- **Modular-monolith map:** modules for identity, employees, attendance, targets/work, businesses, duplicates, corrections, calling assignments, reservations, calls/follow-ups, deals, meetings, projects/tasks, notifications, reports/exports, audit/admin. For each module:
  - Responsibility and owned entities
  - Public operations and dependencies
  - Events and jobs produced
  - Authorization duties and transaction boundaries
  - What it must not own

  No cross-module table writes.
- **Background processing:**
  - Reminder scheduling, rescheduling and cancellation; retry; visibility of failed jobs.
  - Job time vs business-event time.
  - Re-checking recipient account status and access at send time (C6, D5, D6).
  - Export generation (choose synchronous or asynchronous and justify).
  - Scheduled attendance checks (WF-ATT-003); backup scheduling.
- **Audit design:** append-only; event catalogue from the Phase 2 G2 tables.
- **Deployment and recovery:**
  - Docker/VPS topology, public vs private services, TLS, secrets (never in labels or committed config).
  - Persistence, logs, health checks, restart policy, migrations.
  - Backup scope, off-server destination proposal, restore verification.
  - RPO/RTO pending user approval.
- **ADR register:** the decisions you propose.
- **Traceability and risks:** architecture → workflow traceability; risk register; implementation-readiness checklist.

**Architecture Agent B** — sections 04, 05, 06; doc `docs/phase3-4/architecture-b.md`:
- **Conceptual ERD and entity catalogue:**
  - Consolidation and separation decisions, cardinality, ownership, required/optional, retention and deletion implications.
  - Pending policies stay visible: one vs many deals per business (DEC-017) and archiving (C-01) must **not** be silently decided.
  - Do not duplicate task and work-item tables without a reason.
- **Integrity constraints**, each tagged Confirmed, Proposed or Pending policy:
  - One role per employee; no second open attendance session.
  - Duplicate blocking, self-exclusion and concurrent creation.
  - One active reservation per business, with token/version validation.
  - Concurrent edits (version or optimistic locking).
  - Outcome/follow-up consistency; closure → project provisioning.
  - Idempotent retries; audit attribution; social account and website validation.
- **Authorization decision flow:** account → authentication/2FA → role → action → scope → assignment → 15-day timer → exceptions → resource state → Owner path (R-01). Integrate WF-ACCESS-001, covering lists, search, detail, calendars, project context, notifications, exports, duplicate previews and direct URLs, and how related entities avoid leaking hidden data.
- **Transaction/concurrency matrix.**
- **Critical sequences** SEQ-01..15, one readable diagram each:
  1. Login + Owner 2FA
  2. Password reset
  3. Deactivation + session revocation
  4. Check-in with office verification
  5. Checkout, including the DEC-026 branches
  6. Business creation with duplicate block
  7. Concurrent business edit
  8. Hidden-duplicate preview
  9. Assignment / reassignment
  10. Reservation acquire, renew and release
  11. Outcome + follow-up
  12. Reminder dispatch + retry
  13. Accepted-opportunity handoff
  14. Closure + project provisioning
  15. Authorized export

  Each sequence states its authorization check, transaction boundary, concurrency protection, failure path, audit event, and retry/idempotency behaviour.

**IA Agent (W0)** — pages 01, 02, 03; doc `docs/phase3-4/screen-inventory.md` (canonical) and `docs/phase3-4/sitemap.md`:
- Role-specific sitemap and navigation: desktop left nav; mobile focused flows.
- Canonical screen inventory:
  - Columns: SCR ID, name, role(s), purpose, UC/WF IDs served, key actions, key states, desktop/mobile priority, policy-dependent elements.
  - Coverage: every Phase 2 workflow needs a home screen.
- A **low-fi wireframe kit** on page 03, built as native editable Figma components: greyscale boxes, nav, buttons, inputs, select, table, card, tabs, drawer, dialog, calendar block, kanban column/card, status badge (text label + grey shade), toast/banner, empty/loading/error placeholders.
  - Desktop frame 1440×900; mobile 390×844.
  - Inter font; greyscale only, plus one accent for focus. No brand colours: this is not Phase 5.

**Wireframe Agents W1/W2/W3** — their pages; docs `docs/phase3-4/wireframes-w1.md` / `-w2.md` / `-w3.md`:
- Native editable low-fi frames built from kit instances.
- For every inventory screen in their pages: a desktop frame, plus a mobile frame where the inventory marks mobile priority.
- Include main actions, forms, tables, calendars and project boards as relevant.
- **Relevant states:** empty, loading, error, permission denied, duplicate blocked, hidden-by-policy, reserved-by-another-agent, verification failure, session expired, save conflict, success.
- Label every unresolved policy element visibly, e.g. "[DEC-012 pending: summary mandatory?]".
- Frame naming: `SCR-XX-nnn — <name> — Desktop|Mobile[ — <state>]`.

## 7. Documentation locations

| Path | Writer |
|---|---|
| `docs/phase3-4/brief.md`, `docs/phase3-4/task-register.md` | Orchestrator |
| `docs/phase3-4/architecture-a.md` | Architecture Agent A |
| `docs/phase3-4/architecture-b.md` | Architecture Agent B |
| `docs/phase3-4/screen-inventory.md`, `docs/phase3-4/sitemap.md` | IA Agent |
| `docs/phase3-4/wireframes-w1.md` | W1 |
| `docs/phase3-4/wireframes-w2.md` | W2 |
| `docs/phase3-4/wireframes-w3.md` | W3 |
| `docs/phase3-4/reviews/` | Reviewers |
| `docs/phase_3_system_architecture_and_data_design.md` | Orchestrator merges A + B at the end |

Each agent's doc ends with a "Verification" section: created; read back; visually inspected; not inspected.

## 8. P34-2 orchestrator rulings after the architecture review (Proposed; the user may overturn)
Source: `reviews/phase3-review.md`. **The Figma MCP quota is exhausted**, so these fixes are made in the documents only. Board labels are updated once the quota resets.

| ID | Issue | Ruling |
|---|---|---|
| AR-01 | RA-02 module names | **Agent A's module names are canonical:** MOD-work, MOD-business, MOD-assignment, MOD-reservation, MOD-admin (which hosts audit), and the rest as in A's catalogue. Access operations are named `check` / `scopeFilter`. B renames to match. |
| AR-02 | RA-01 orphan / double-owned entities | BackgroundJob and Outbox: owned by A's platform jobs module (A names it in the catalogue and adds both to the catalogue; B adds Outbox to the cross-cutting ERD). IdempotencyRecord: owned by the platform request layer (A names the owner). ExportRecord (metadata/audit only; no file, see AR-05): MOD-reports. AttendanceSettingsVersion: **MOD-attendance** (MOD-admin only provides the screen and calls MOD-attendance). Duplicate match keys: **MOD-business** owns them as part of master data, written in the business save transaction. MOD-duplicates is a read-only matching service that owns the matching rules (DEC-013) and writes nothing. |
| AR-03 | RA-03 reservation release | Follow Phase 2. The reservation is released in a **separate step after** the call save commits (WF-CALL-003). If release fails, the reservation expires on its own. On reassignment, an active reservation means Wait or Owner override (WF-CALL-001); the save never releases it implicitly. A fixes its examples. |
| AR-04 | RA-04 deactivation | Follow A: MOD-employees commits the account status change and an outbox event, and MOD-identity revokes sessions asynchronously. **Access ends at once anyway**, because every request re-checks account status (step 1 of the access evaluation). B updates SEQ-03. |
| AR-05 | RA-05 exports | Follow A's ADR: exports are generated synchronously, streamed, and never stored. Only an ExportRecord audit row is kept. B removes the 24-hour file. |
| AR-06 | RA-06 access implementation | MOD-access is the only implementation. It reads a **read-only "access facts" database view that MOD-access owns** (created by migration), and that view is the source for `scopeFilter` list filtering. This is the one documented exception to the no-cross-module-reads rule: read-only, view-based, owned by MOD-access. A records it as an ADR amendment; B aligns its wording. |
| AR-07 | RA-07 dependency cycle | MOD-calls never calls MOD-assignment. Assignment-relevant outcomes are published as outbox events, and MOD-assignment consumes them. A adds an explicit module dependency list (adjacency table) showing no cycles. |
| AR-08 | RA-08 restore drill | The restore drill runs **off the VPS**, on a separate restore environment that holds the private decryption key, which never sits on the VPS. A updates the design. |
| AR-09 | RA-09 event/job catalogue | **One catalogue, owned by A** (section 07 job catalogue + outbox events). B references its names. |
| AR-11 | Reconciliation: AR-02 settings wording | The settings **screen** calls the MOD-attendance operation directly. MOD-admin has **no code dependency** on MOD-attendance (keeps the graph acyclic, ADR-002). This replaces the "MOD-admin calls MOD-attendance" wording in AR-02. |
| AR-12 | Reconciliation ICR-2 (duplicate dialog scope) | One shared "duplicate blocked" dialog (DE-003 pattern) serves business create, business edit and applying a data correction. A concurrent-create race surfaces the same dialog when saving. The hidden-match variant shows existence only (DEC-003 pending). |
| AR-13 | OWN-012 retry semantics | SM-REMINDER-001 keeps Failed terminal. The monitor action becomes **"Send again"**, which creates a new reminder instance (Proposed; Owner only; audited). "Mark reviewed" is removed (no backing field). |
| AR-14 | SHR-007 notifications | Proposed: a Notification has a read flag. MOD-notifications exposes list, mark-read and mark-all-read. **The list re-checks access at read time** through MOD-access `check`, so notifications for records the user can no longer access are hidden (not counted). |
| AR-15 | Async UI states | Exports are synchronous and streamed (ADR-010): no "generating" state; long exports show an in-request progress state only. Reset-email sending and project provisioning are asynchronous: the UI shows "queued/pending" plus the later failure surface (D6/F3), never immediate "sent" / "provisioned". |
| AR-16 | Metric catalogue | A adds a dashboard metric catalogue: the B-1 Accepted-opportunities snapshot, Development workload (three sub-counts), and the G1 pairs, each with source entity/event and owning module (MOD-reports reads only). |
| AR-10 | RA-10 board gaps | Pending until the Figma quota resets: draw SEQ-12..15, screenshot SEQ-11, resize sections 04–06, read back. |
