# Independent verification of `production-readiness-and-handover-report.md` (2026-10-26)

**Method:** every check below was run against the repository on a **fresh test database** (`udigity_test_verify`). The test database was the only database touched, and nothing was changed.

## 1. What is confirmed

- **Increment 6 files exist:**
  - migrations `030_work_targets_items`, `102_notifications_reminders`, `103_reports_export_records`;
  - modules `work` and `reports`;
  - pages `notifications`, `delivery-monitor`, `targets`, `reports`, and the dashboard.
- **Increment 7 endpoints exist:** `PATCH /api/employees/me` and `POST /api/auth/password/change`.
- **Frontend:** `tsc` 0 errors; lint 0 errors / 4 warnings; `npm run build` OK, **34/34 pages**.
- **Backend:** `tsc` 0 errors; **856/860 tests pass**.

## 2. Blocking problems (must fix before any deployment)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| V-01 | **P0** | `POST /api/auth/password/change` has **no `requireAction` guard**. Because of the SEC-R2 startup check, **the backend refuses to start in production** (`enforceRouteGuards(..., {strict: isProduction})` throws). The earlier smoke test passed only because it ran before this route was added. | `routeGuard.test.ts` fails: `POST /api/auth/password/change … expected [] `; `modules/index.ts:72` | Add `requireAction('auth.password.change')` (or the matrix name). Add the matrix row plus per-role tests. Re-run the prod smoke test. |
| V-02 | P1 | 3 tests time out after 5 s: Owner pending-2FA/verify rotation, password reset via outbox, and `GET /api/employees` role matrix. These may be regressions from the new password-change/session-revocation code, or slowness. They need investigating, not just a longer timeout. | `auth.api.test.ts`, `be1.api.test.ts` | Reproduce each in isolation and fix the root cause. |
| V-03 | P2 | Backend lint fails: 3 `any` in `work/work.api.test.ts:110,115,141`. CI's lint gate would fail. | `npm run lint` | Type the test helpers. |

## 3. Inaccurate statements in the handover report (do not rely on them)

| Report says | Actual state |
|---|---|
| "26/26 tests passing" | 860 tests; 856 pass, 4 fail (above). |
| "Increment 7 hardened", "production ready", "100% fidelity to Figma" | Not yet. The Increment 3–6 code has had **no security review**. No screen has been checked in a browser against the Figma specs (desktop or mobile, light or dark). No Playwright end-to-end run. The production smoke test has not been re-run since Increment 6/7. |
| Argon2id hashing | Not used. Passwords are bcrypt (`bcryptjs`); no argon2 found in the code. |
| Device fingerprinting | Not found in the code. |
| Deduplication by tax ID | Not in the design or the code. Duplicates are phone, plus name/branch (DEC-013), plus the similar-name warning. |
| 15-day rule: "new records remain unassigned for 15 days before entering the public pool" | Wrong. The rule (DEC-001/002, demonstration default) hides records from other roles once the 15-day window passes, with exceptions for active work. The Owner is exempt. |
| Reservations use "optimistic locks" | They use leases with a heartbeat and idle/max-total timers, plus a unique active-reservation index. |
| Task statuses `todo / in_progress / done` | The real transition table includes Waiting for client, Blocked, Cancelled and others (`delivery-design.md`). |
| Recommended nginx CSP `script-src 'self'` | **Do not apply.** It would break the app's nonce-based CSP. Browsers enforce every CSP header they receive. The existing `devops/nginx/conf.d/security-headers.inc` is correct and passed the smoke test. |
| Env variables `TOKEN_ENCRYPTION_KEY`, `OFFICE_CIDR_WHITELIST`, `SMTP_PASSWORD`, `FRONTEND_URL`… | Names differ from the code. The source of truth is `devops/env/*.env.example`: `TOTP_ENC_KEY`, `OFFICE_IP_ALLOWLIST`, `SMTP_PASS`, `APP_ORIGIN`, `EMAIL_ALLOW_REAL_SEND`, … |
| `npm run migrate:prod`, `devops/scripts/verify-restore.sh` | They don't exist. Use `npm run migrate` and `devops/backup/restore-drill.sh`. |
| Postgres 16+ | The stack and tests use Postgres 17. |
| Policy table: "DEC-026 = outbox backoff, *Approved*", "DEC-008 payroll deduction", "ADR-010 Approved" | The IDs and meanings are wrong (for example, DEC-026 is the attendance-preview rule, and payroll is out of scope). **Nothing in the table is approved**: the only user-approved rule is "Accepted keeps reservation". Every other policy is a demonstration default. See `docs/policy-defaults.md`. |

## 4. Next steps, in order (each waits for user approval)

1. **Fix V-01 to V-03.** Then re-run the full backend suite twice, the frontend build, and the **production smoke test**.
2. **Correct the handover report**, or replace it with an accurate one, and **commit everything to a new git branch** (secrets excluded; `.gitignore` is in place).
3. **Security review of Increments 3–6:** attendance, businesses, calling, delivery, work, reports/exports, notifications.
4. **Increment 7 hardening:**
   - the open backlog items;
   - a browser fidelity check of every screen against `docs/implementation/figma-specs/` (desktop/mobile, light/navy dark);
   - accessibility, performance, retention;
   - a restore drill and a CI run on GitHub.
5. **Phase 8:** Playwright end-to-end journeys for every role; user acceptance testing; Figma dark mode updated to navy, with the Phase 7 labels; final runbook.
6. **Production inputs from the user:** server and domain, SMTP plus approval for real email, office IPs and schedule values, policy decisions, backup storage and key, and deployment approval.
