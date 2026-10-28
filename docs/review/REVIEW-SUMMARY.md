# Full-System Review: Consolidated Summary (2026-10-28)

**Method.** Seven read-only reviewers ran on matched models. Each read its own slice of the code, then the orchestrator ran automated checks on a fresh database.

| Report | Slice | Model |
|---|---|---|
| [01-backend-core.md](01-backend-core.md) | Server, config, middleware, migrations, identity, employees, admin, platform, email | Opus |
| [02-backend-access-business.md](02-backend-access-business.md) | Access engine, businesses, duplicates, corrections, attendance, work, reports | Fable |
| [03-backend-calling-delivery.md](03-backend-calling-delivery.md) | Assignment, reservation, calls, deals, meetings, projects | Opus |
| [04-integration-contracts.md](04-integration-contracts.md) | 162 backend routes against every frontend call, plus a live role check | Opus |
| [05-frontend-shell-owner.md](05-frontend-shell-owner.md) | Shell, shared screens, Owner screens | Sonnet |
| [06-frontend-de-cc-dev.md](06-frontend-de-cc-dev.md) | Data Entry, Call Center, Developer screens | Sonnet |
| [07-devops-e2e-docs.md](07-devops-e2e-docs.md) | Docker, nginx, CI, backups, e2e, docs | Sonnet |

**Coverage limits:**
- Reviewers 2, 3, 4, 6 and 7 report reading their slices in full.
- Reviewer 1 lists every file it reviewed.
- Reviewer 5 confirms a full read only for the 9 files it re-read; the rest of its slice was reviewed but not individually confirmed.
- Figma was not reopened. Fidelity was checked against the extracted specs in `docs/implementation/figma-specs/`.

## 1. Automated baseline

| Check | Result |
|---|---|
| Backend typecheck / build | ✅ / ✅ |
| Backend tests | ❌ 15 failed / 943 passed (958). The 26 Oct state was 854/854. |
| Backend lint | ❌ 7 `no-explicit-any` errors. The config is fine; the earlier "config failed to load" message came from running at the repo root. |
| Frontend tsc / unit tests / build | ✅ / ✅ 11 of 11 / ✅ 36 pages |
| Frontend lint | ❌ 9 errors: 7 `set-state-in-effect`, 2 `any` |
| E2E (Playwright, 70 tests) | ❌ Doesn't start: the seed's Owner email ≠ the e2e persona. After a manual rename: 20 pass, 42 fail, 7 not run, 1 skipped. 34 failures are one shared-shell a11y label issue. |
| Git | ❌ Nothing committed since the first 2 commits; 149 changed or untracked paths |

## 2. Root cause of the regressions

**46 source files** changed after the 26 Oct verified state; they are listed in the conversation and their mtimes are in reviewer 5's §7. The changes added:
- dynamic or custom roles (`human_resources`, free-text roles, migration 014);
- a rewrite of `access/rules.ts`;
- attendance breaks with a `BreakTimer`;
- a `settings/roles` page and Company/Access settings tabs;
- a targets checklist and territories;
- a stubbed `NoticePolicy.tsx`;
- changes to meetings, reports, notifications and the dashboard.

**None of these are in the approved design or the screen inventory.** They account for most of the P0/P1 findings and all 15 failing tests. One of those tests, `runtimeRole`, fails because the test itself is wrong, not the app.

## 3. Findings by severity

| Report | P0 | P1 (High) | P2 (Med) | P3 (Low) |
|---|---|---|---|---|
| 01 Backend core | 0 | 4 | 11 | 14 |
| 02 Access and business | 1 | 2 | 7 | 10 |
| 03 Calling and delivery | 1 | 2 | 8 | 18 |
| 04 Integration | — | 7 High | ~14 Medium/Low | — |
| 05 Shell and Owner | 3 | 8 | 21 | 11 |
| 06 Data Entry, Call Center, Developer | 0 | 2 | 13 | 21 |
| 07 DevOps, e2e, docs | 0 | 4 | 8 | 7 |
| **Total (approx.)** | **5** | **29** | **~80** | **~81** |

## 4. P0: must fix before anything else

1. **Access rules leak data.** In `access/rules.ts`, every Developer gets full access to every business inside the 15-day window. Any custom or unknown role gets scope access. Context-limited rows appear in directory lists. This breaks the approved visibility rules. (02, 03)
2. **Meetings bypass authorization.** `meetings/service.ts:277-315` writes `deals` and `call_attempts` before calling `authorize()`. A Developer can attach to any deal, or create an accepted deal for any business. (03)
3. **No policy labels render.** `components/ui/NoticePolicy.tsx` is stubbed, so no "Demonstration alternative — not approved" chip shows in any of the 57 files that use it. Every pending policy looks decided. (05 F-01)
4. **Reports page shows fake reports** when the API is empty or fails. (05 F-02)
5. **Targets page shows fake data** and hard-coded status. (05 F-03)

## 5. P1 / High: main items

**Security and data:**
- Custom roles can run Owner-only admin actions without 2FA. The role cache is never loaded after a restart. Changes apply before commit. (01, 02)
- The production env runs the API as the Postgres superuser `udigity_app`, which defeats the append-only audit. (01)
- Notification payload keys don't match, so assignment, override and correction notices are never created. (01, 03)

**Broken user flows:**
- Saving attendance settings fails (`mon` vs `MON`) and would wipe holidays and the summary policy. (04)
- Saving company settings fails with "Unknown setting". (04)
- Settings save overwrites holidays and other fields with hard-coded values. (05)
- The My Day work list shape doesn't match, so labels are blank. (04)
- Report export fails because the UI never asks for the step-up 2FA code. (04)
- There is no UI to issue a new Owner's 2FA enrollment token. (04)
- Call Center and Developer users can't schedule meetings: the staff picker returns 403. (04)
- The dashboard shows fabricated charts, its filters are dead, and failures show as zeros. (05)

**Missing or incomplete features:**
- The SCR-DEV-007 Task detail drawer is missing, so tasks can't be edited. (06)
- Closing the tab doesn't release the reservation. (06)

**Ops:**
- Production compose: the worker sits on an internal-only network, so real SMTP can't connect. (07)
- E2E can't start. (07)
- CI runs no e2e, env check or smoke test, and its lint step fails. (07)
- The handover report is still inaccurate. (07)

## 6. Verified correct

- Every frontend call has a matching backend route (no 404s). Methods, paths, CSRF and idempotency keys match. In a live check, 4 roles × 37 GETs gave the expected 200/403 results. (04)
- State machines match the approved design: reservation, outcomes ("Accepted keeps reservation"), follow-ups, deals, projects, tasks and the Record-delivered warning. (03, 06)
- The duplicate flow keeps a hidden match existence-only. Closed deals hide closure actions. (06)
- CSP nonce, auth guard and open-redirect protection work. There are no hard-coded colours, and navy dark tokens are used throughout, apart from one missing token. (05, 06)
- Dockerfiles, nginx, backup/restore scripts and runbook commands are valid. No secrets are in the tree. (07)
- Security fixes from the earlier review are in place: CSV formula injection, export step-up and audit, and the work-item IDOR. (02)

## 7. Decision needed from the user

Were the **custom roles / `human_resources`, the roles settings page, attendance breaks, targets territories and the new settings tabs added on purpose?**
- **If not:** restore the approved 4-role design and remove the additions. This is the fastest route to green.
- **If yes:** keep them, but redesign them safely. That means adding them to the authz matrix and the design, putting admin actions behind 2FA, persisting the role cache transactionally, and writing tests. Recorded as new decisions.

## 8. Recommended fix order (after the decision)

1. **Commit** the current state to a new branch now, as a safety snapshot with secrets excluded.
2. **P0 fixes:** access rules, meetings auth, policy chip, fake reports/targets data.
3. **P1 fixes:** settings saves, My Day, export 2FA prompt, Owner enrollment token UI, meeting staff picker, notifications payloads, DB role in prod, worker network, Task drawer, tab-close release.
4. **Tests and lint green:** backend 958/958, lint on both sides, and e2e seed/persona aligned so the suite runs.
5. **P2 batch:** the 13 open security P2s, dashboard real data, the Call Center conflict screen, follow-up filters, mobile layouts.
6. **Re-verify:** full tests twice, build, prod smoke test, e2e. Then rewrite the handover report accurately.
