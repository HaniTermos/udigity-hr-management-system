# Phase 3 — System Architecture and Data Design

**Status: submitted for user review, NOT approved (2026-10-20).** Every element is Proposed unless marked Confirmed. No unresolved business policy is selected.

Board: [Udigity Management System — Architecture & Data Model](https://www.figma.com/board/YKQi8IAz6sOGoLqwolHKPk) (FigJam, aap047 team).

## Section index

| Board section | Node | Content | Detail document |
|---|---|---|---|
| 00 Index, Legend & Decisions | `1:2` | Section index, legend, open decisions | this file |
| 01 System Context | `1:5` | Four roles, the system, email service, backup destination; operators shown separately | [architecture-a.md](phase3-4/architecture-a.md) |
| 02 Containers & Trust Boundaries | `1:8` | Browser, Next.js (UI only), Express API (business logic + authorization), PostgreSQL (private), worker, proxy/TLS, email, backup storage; request path | architecture-a.md |
| 03 Modular Monolith | `1:11` | Domain and platform modules, dependency graph (acyclic), module catalogue | architecture-a.md |
| 04 Conceptual ERD | `1:14` | Five domain ERDs, entity catalogue (one owner per entity), integrity constraints IC-01..28 | [architecture-b.md](phase3-4/architecture-b.md) |
| 05 Authorization & Visibility | `1:17` | Access decision flow (MOD-access, single WF-ACCESS-001 implementation), visibility integration, leakage controls | architecture-b.md |
| 06 Sequences & Transactions | `1:20` | SEQ-01..15, transaction/concurrency matrix | architecture-b.md |
| 07 Jobs, Notifications & Audit | `1:23` | Reminder pipeline, scheduled jobs, single event/job catalogue (E-01..17, J-01..12), audit catalogue, async-state table | architecture-a.md |
| 08 Deployment & Recovery | `1:26` | Docker Compose on one VPS, release/migration, backup/restore (off-VPS drill) | architecture-a.md |
| 09 Traceability & Risks | `1:29` | ADR register (ADR-001..019), traceability, risks, readiness checklist, metric catalogue | architecture-a.md |

## Key proposals
- **Shape:** a modular monolith built as one Docker image, run as both the API and the worker.
- **Layering:** Express owns all business logic and authorization; Next.js is UI only; one origin behind the reverse proxy.
- **State:** server-side sessions in PostgreSQL. Jobs, outbox and reminders are also PostgreSQL tables (no Redis, no broker).
- **Module rules:** each module writes only its own tables, with one transaction per command. The only cross-module read is MOD-access's read-only access-facts view (AR-06).
- **Integrity in the database:** unique normalized phone, one open attendance session, one active reservation (with a lease token), one current assignment. Version numbers on editable records; idempotency keys on writes.
- **Audit:** append-only, committed in the same transaction as the change.
- **Exports:** synchronous and streamed, never stored.
- **Deployment and backups:** only the proxy is public. Migrations are forward-only. Backups are encrypted and kept off the server; restore drills run off the VPS. RPO/RTO await user approval.

## Reviews and repairs
- **Independent review** ([phase3-review.md](phase3-4/reviews/phase3-review.md)): 1 Blocker and 9 Major findings, all inconsistencies between Agent A's and Agent B's documents. Resolved through orchestrator rulings AR-01..AR-10 ([brief §8](phase3-4/brief.md)).
- **Reconciliation with the wireframes** ([reconciliation.md](phase3-4/reviews/reconciliation.md)): resolved through AR-11..AR-16.
- **Board updates:** [architecture-board-updates.md](phase3-4/architecture-board-updates.md).
