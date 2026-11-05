# Phase 0 — baseline (before any fix)

Tested revision: local `cab5ec9` + uncommitted Owner work (`frontend/src/components/delivery/ProjectBoard.tsx`,
`frontend/src/lib/api/projects.ts`). Environment: Windows 10 laptop, Node 22.18.0, Docker 29.6.1, throwaway
Postgres 17 (`udigity-test-db`, fresh DB `udigity_test_baseline`). Run 2026-11-04 while four review agents were also
running database tests on the same Postgres container (load).

| Check | Result |
|---|---|
| Backend typecheck / lint / build | pass / pass / pass |
| Migrations on a fresh DB | 45 applied |
| Backend tests (vitest, full suite) | **1124 passed, 7 failed, 0 skipped** (1131) |
| Frontend typecheck | pass |
| Frontend lint | **2 errors**, both in the uncommitted Owner change `ProjectBoard.tsx` (798 `react-hooks/set-state-in-effect`; 815 `no-explicit-any`) |
| Frontend unit tests | 35 passed, 0 failed |
| `npm audit --omit=dev` | **not run**: "npm ERR! audit endpoint returned an error" (registry/network) |
| Playwright (desktop-light, production build, QA stack :3100/:5100) | **70 passed, 0 failed, 0 skipped** |
| GitHub CI on PR #1 (`03d6352`) | jobs not started (account billing message); heavy jobs show "skipping" as dependents |

## Backend failures at baseline

6 are `Test timed out in 5000ms`; 1 is `expected 409 to be 200`:

- `tests/fxbe.api.test.ts` — attendance PUT keeps omitted fields; company.name PATCH; task startDate (FX-BE-C6)
- `modules/calls/calling.api.test.ts` — reservations max-total (timeout); Owner override (409, runs right after the timed-out max-total test that leaves a reservation held)
- `modules/deals/delivery.api.test.ts` — projects/tasks assignment and transitions
- `modules/identity/be1.api.test.ts` — D20 reactivation issues a new setup invitation

Assessment: consistent with load-induced timeouts (the same suite passed 1131/1131 twice on 2026-10-29 on a quiet
machine), but **not yet proven**. Status: to be re-run on a quiet machine before any claim; until then counted as
failures.
