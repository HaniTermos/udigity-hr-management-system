# Production fix plan (2026-10-28), orchestrator-owned

**User decision (2026-10-28):** every user addition is intentional. That covers:
- custom/dynamic roles, including `human_resources`;
- the roles settings page;
- attendance breaks and the BreakTimer;
- target territories and the checklist;
- the new settings tabs.

**Keep them and make them safe.** The goal is a production build that the user tests before deploying.

The source of findings is `docs/review/REVIEW-SUMMARY.md` and reports 01–07. A snapshot backup was taken before any fix.

## Rules for every fix agent
- Edit **only the files you own** (below). Need a change elsewhere? Post `REQUEST` on `docs/implementation/coordination.md` to its owner.
- Never open `.env` files. Never send real email. Never deploy. No git commits.
- Migrations must be forward-only and non-destructive. New numbers: F-ACCESS 960–969, F-BE 970–989. Check that the numbers are free.
- Each agent tests on its own DB in the `udigity-test-db` container: `udigity_test_fx_<you>`.
- The existing roles' approved visibility rules must stay exactly as in `docs/security/authz-matrix.md` and `docs/phase2/shared-baseline.md`. Custom roles are additive.
- Unresolved policies stay labelled "Demonstration alternative — not approved".
- Done means: your tests are green, typecheck and lint pass in your area, and you post `[FX-<you>] DONE` with exact numbers.

## Ownership and scope

| Agent | Owns | Fixes |
|---|---|---|
| **F-ACCESS** (Fable) | `backend/src/modules/access/**`, plus the role/RBAC code wherever it lives (`modules/admin` roles endpoints, migration 014 follow-ups) | **P0** `rules.ts` data leaks: restore Developer scoping, add explicit custom-role grants only via the matrix, keep context rows out of lists. Custom roles: admin actions require 2FA and the Owner-equivalent gate; matrix validation of every granted action; role cache loaded at startup and refreshed after commit; `data_scope` enforced. Make the 13 access/businesses tests and 2 delivery tests pass **without weakening them**. Open security P2s in access. |
| **F-BE** (Opus) | All other `backend/src/**`: meetings, notifications, attendance (incl. breaks), admin settings (not roles), identity, reports, work, calls/reservation, deals, projects, db, tests, eslint | **P0** meetings authz before writes. **P1:** notification payload keys and consumers for every emitted event; settings save contracts (weekday casing, `company.name`, no field wipe); My Day work-list shape; Owner enrollment-token issue endpoint (if missing); meeting staff picker access for CC/Dev; session-cleanup and retention jobs; `runtimeRole` test; backend lint 0; open security P2s outside access (rate limits, reservation server-trusted timers, non-holder save-after-loss, follow-up date cap, send-time re-check, `send_again` bound, export GET side effects/PII); developer assign endpoint plus list (BL-11) if missing. Post every contract change. |
| **F-FE-A** (Sonnet) | `frontend/src/app/{layout,page,login,reset-password,session-ended,my-day,my-attendance,profile,notifications,attendance,employees,targets,calling-assignments,reports,audit,settings,delivery-monitor}/**`, `components/{ui,layout,states,owner,auth}/**`, `lib/**` except `lib/api/{businesses,corrections,calling,deals,meetings,projects}.ts` | **P0:** restore a working `NoticePolicy`/`PolicyPendingChip` everywhere; remove fake data on reports/targets; dashboard real data, real filters and error states. **P1:** settings save matching F-BE's contract, with no field wipe; export step-up 2FA prompt; Owner enrollment-token UI; nav hides Owner-only pages from non-Owners; shared SWR key bug; My Day work list; frontend lint 0; shell a11y label mismatch (the axe `label-content-name-mismatch` on every page); roles page and BreakTimer logic and states. |
| **F-FE-B** (Sonnet) | `frontend/src/app/{businesses,categories,corrections,search,queue,calendar,opportunities,do-not-call,deals,meetings,projects}/**`, `components/{businesses,calling,delivery}/**`, `lib/api/{businesses,corrections,calling,deals,meetings,projects}.ts` | **P1:** SCR-DEV-007 Task detail drawer; reservation release on tab close (`pagehide`/`visibilitychange` plus `fetch keepalive`); stable Idempotency-Keys on retries. **P2:** CC-005 conflict screen (Retry, Back to queue, details); follow-up filters, callback group, Responsible/Note; 409 retry uses the fresh version; schedule-meeting drawer (paging/search, staff picker); developer-assign UI once F-BE posts it; server-side deal filters once available; raw enums shown as labels. |
| **F-OPS** (Sonnet) | `devops/**`, `docker-compose*.yml`, `.github/**`, `e2e/**`, `docs/implementation/qa/**` | **P1:** the worker can reach SMTP (network); the production DB runtime role is non-superuser (owner role runs migrations; app role limited, per migration 012) with env and compose wiring; nginx `/api/auth/me` rate limit safe behind office NAT; CI runs backend lint, e2e, `check-env` and the prod smoke test; align e2e seed and personas with the current seed; fix stale selectors; write `docs/implementation/qa/e2e-run.md`. |

## Wave 2, after Wave 1 is DONE
1. **Integration verifier:** backend tests run twice; both lints; builds; e2e full run; prod smoke test.
2. **Security re-review (Fable):** confirm every P0/P1 is closed, including the custom-role design.
3. **Handover report:** rewrite it accurately.
