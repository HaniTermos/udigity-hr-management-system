# Full-system review — 2026-11-04

Scope: full engineering, QA, security and release-readiness review of the Udigity Management System
(brief pasted by the Owner on 2026-11-04). This folder is the review's record; it holds no secrets.

## Baseline (Phase 0)

| Item | Value |
|---|---|
| Repository | HaniTermos/udigity-hr-management-system |
| Branch | `feat/launch-readiness` |
| Local HEAD | `cab5ec9` + uncommitted Owner work: `frontend/src/components/delivery/ProjectBoard.tsx`, `frontend/src/lib/api/projects.ts` ("Assign developers" on a project; backend route already exists) |
| GitHub head (PR #1) | `03d6352` (same code; local also holds image-only commits) |
| PR #1 | open, mergeable, label `full-ci` |
| CI | jobs not started by GitHub: "recent account payments have failed or your spending limit needs to be increased" (account billing, not code) |
| Toolchain | Node 22.18.0, npm 10.4.0, Docker 29.6.1, git 2.43 (Windows 10, Git Bash) |
| Local infra | Docker Desktop; throwaway test Postgres `udigity-test-db` (127.0.0.1:55432). The working/demo DB (`udigity-db`, 55433) is **not** touched by this review |
| Deployment | not deployed; Hostinger server not accessible from this session (no SSH host configured) |
| Models available to sub-agents | Opus, Sonnet, Haiku, Fable (exposed by the Agent tool; Fable's capabilities are not documented to us, so it gets no critical work) |
| Baseline results | see `00-baseline.md` |

## Source of truth (highest first)

1. Explicit current Owner decisions (chat, recorded in `docs/decisions.md`: supersession log S-01…S-26, "Approved as built").
2. Approved policy baseline `docs/policy-baseline-2026-10-29.md` and the DEC register (DEC-001…DEC-034).
3. Approved Figma work (ART-16; snapshot `docs/phase6/previews/`).
4. Implementation and tests — evidence of behaviour, not policy.
5. Older proposals and agent summaries (incl. `docs/review/*.md` from 2026-10-28).

## Known source conflicts (not silently resolved)

| # | Conflict | Sources | Handling |
|---|---|---|---|
| K-1 | Public hostname | Brief 2026-11-04: `https://systemmanagement.udigity.com`; Owner chat 2026-10-29 and **2026-11-04 (confirmed)**: `hrsystem.udigity.com` | **Resolved 2026-11-04 by the Owner: `https://hrsystem.udigity.com`.** The repository still uses the `app.example.com` placeholder everywhere (G-03) |
| K-2 | Custom roles and break tracking | Brief: "out of scope unless a later explicit approval supersedes"; Owner decisions S-25 (breaks on) and S-26 (custom roles on), 2026-10-29 | S-25/S-26 are later explicit approvals → features stay; reviewed for safety; listed for Owner confirmation |
| K-3 | Same-server backups | Baseline D19 "storage outside the application server"; Owner exception S-23 | Exception recorded; recovery capability reported as weaker |

## Findings format

Each finding: ID · Severity (Critical/High/Medium/Low) · Release impact (Blocker/Non-blocker) · Confidence
(Confirmed/Suspected/Not tested) · Requirement and role · Location · Preconditions · Reproduction · Expected vs
actual · Evidence · Root cause · Proposed/final fix · Regression test · Verification command and result ·
Tested commit · Limitations. Findings live in `findings/<area>.md`; the deduplicated register is `FINDINGS.md`.

## Agents

| Agent | Area | Model | Mode |
|---|---|---|---|
| Inventory | system map: screens, API, DB, jobs, env (Phase 1) | Haiku | read-only |
| B | frontend engineering and wiring | Sonnet | read-only (discovery) |
| C | backend and API correctness | Sonnet | read-only (discovery) |
| D | database integrity, runtime roles, concurrency | Opus | read-only + throwaway DB |
| E | security, RBAC, abuse | Opus | read-only + throwaway DB |
| F | rate limiting and performance | Sonnet | read-only + throwaway DB (bounded) |
| G | DevOps, deployment, recovery | Sonnet | read-only |
| A | product, UX, accessibility (browser) | Sonnet | after baseline (needs the QA stack) |
| H | independent integration and release QA | Opus | after fixes |
