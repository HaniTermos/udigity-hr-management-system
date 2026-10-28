# Integration report

## Backend

Integration pass INT-BE, 2026-10-26. Scope: `backend/` only. Contracts are unchanged; the only response change is additive (BL-09).

### Checks: fresh database `udigity_test_orch`, dropped and recreated

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (0 problems) |
| `npm test`, run 1 (fresh DB) | **21 files, 854 passed / 0 failed** |
| `npm test`, run 2 (same DB, reused) | **21 files, 854 passed / 0 failed** |
| `npm run build` | exit 0 |
| Startup `not_in_matrix` warnings | 0 (before this pass: 7) |
| `devops/scripts/prod-smoke.sh` | **FAILED at build (exit 2)**. The backend image built (`udigity-backend:smoke`). The frontend image failed `next build` type-check: `src/lib/actions.test.ts` and `src/lib/authRoutes.test.ts` import `vitest`, which is not resolvable in the frontend Docker build. The HTTP checks did not run. The stack was torn down and `udigity-test-db` was untouched. **Owner: FE1/DevOps.** Fix by adding `vitest` to the frontend devDependencies, or by excluding `**/*.test.ts` from `frontend/tsconfig.json`. |

The test count rose from 818 to 854 because the VT-3 harness generates 4 role cases for each new matrix row, plus the new assertions.

### Changes

| Item | Change |
|---|---|
| Test isolation, BL-14 | `calls/calling.api.test.ts` "unassign … list shows Unassigned" now walks every page of the list instead of reading only page 1. |
| Test isolation, BE1-R5 | `platform/platform.api.test.ts` relays until nothing is due (`relayAll`), so a backlog from other suites cannot push this run's event out of the relay batch. |
| BL-15 | New migration `903_access_facts_v4.sql`: the BE4-R4 delivery facts (deal, project and the developer arrays) replace the 902 placeholders. Columns are unchanged. The test-only `installDeliveryFactsView` fixture in `deals/delivery.api.test.ts` is removed, so the migration is now the source of truth. |
| BL-03 | New outbox event `contact_reservation.overridden` (payload: `businessId`, `holderId`). It is emitted by `reservation.override` in the same transaction as the audit row, and the test asserts it. No consumer yet: the event stays in the log. |
| BL-17 | New outbox events `data_correction_request.resolved`, `.rejected` and `.closed` (payload: `businessId`). They are emitted with the audit rows and the BE2 tests assert them. No consumer yet: the events stay in the log. |
| BL-06 / BE1-R4 / BE3-R5 | 9 rows added to `access/matrix.ts` and `docs/security/authz-matrix.md`, using the roles exactly as declared: `auth.session.revoke_all`, `employee.issue_2fa_enrollment_token`, `employee.manage_own_recovery_codes`, `employee.read_open_items`, `attendance.overview.read`, `attendance.remote_exception.request`, `call_attempt.list_do_not_call`, `call_attempt.list_opportunities`, `settings.read_public`. They await Security Lead review. |
| BL-07 | Fixed the one remaining lint error, in `platform.api.test.ts`. `jobFailures` is now asserted. |
| BL-09 | `versionConflict(currentVersion, current?)` takes an optional snapshot. A 409 VERSION_CONFLICT now also carries `details.current` for a business edit or archive (the access-checked detail, which is not audited), a category rename or deactivate, and settings. Calling already had it. |

### Open items

- **BE4-R2.** `deal.remove_fact`, `meeting.cancel`, `project.create_manual` and the Developer finalize under `direct` are still gated by the nearest matrix row. They are not declared actions, so the Security Lead must decide on them.
- **BL-09, not done.** Deals, meetings, projects, tasks, corrections, attendance and assignment still return `currentVersion` only.
- **BL-03 and BL-17 consumers.** The holder and requester notices have no email or in-app consumer yet; BE5 needs to add them.
