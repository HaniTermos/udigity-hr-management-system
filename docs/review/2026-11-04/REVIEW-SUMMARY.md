# Review summary — 2026-11-04

Branch `review/2026-11-04-fixes`, tested commit **`825dfd1`** (base `cab5ec9` + Owner WIP). Nothing pushed, merged or deployed.

## 1. Verdict

| Target | Verdict |
|---|---|
| Local demo | **Ready** — every local check is green on `825dfd1` |
| Staging | **Ready for staging**, subject to the server inspection in §6 |
| Production | **Ready for production subject to approvals** (§7). Not "Production verified": nothing ran on the server, CI did not run, and no real email was sent |

## 2. Scope reviewed

Frontend (Next.js 16, all screens, light/dark, desktop/mobile), backend (Express, every module and route), database (48 migrations,
privileges, constraints, jobs), security/RBAC (fixed and custom roles), rate limits and performance, DevOps (compose, nginx,
proxy variants, backups, monitoring), browser/a11y QA, independent QA, tool scans. Agents A–H; details in `README.md` and `findings/`.

## 3. Findings

134 findings: **0 Critical, 10 High** (all fixed), the rest Medium/Low/Info (`FINDINGS.md`). One regression from the review itself
(R-02, High) was found during verification, fixed and covered by a fail-before/pass-after test.

## 4. Open or accepted (not blockers for staging)

| Item | Why open |
|---|---|
| T-08 `next` / `nodemailer` patch updates | Not yet 2 weeks old (eligible 11-06 / 11-12); Dependabot added. Audit today: 0 vulnerabilities |
| G-09 backup copy off the server | Needs Owner approval (new external storage); same-server backups accepted by S-23 |
| Staff 2FA | Accepted risk, S-33 (Owner only) |
| Common-password list | Embedded ~450 entries; a larger list needs a download approval |
| FE Lows A-04, A-05, A-10, A-11, A-19, A-22, B-15 back navigation, contrast items in A-15 | Small polish; A-21 design deviations are report-only |
| R-01 migration numbering | `1000_*` would sort before `102_*`; convention change is a follow-up |
| New event names `password.changed`, `two_factor.enrolled`, `two_factor.recovery_codes_regenerated`, `access.denied`, `auth.failed_signin_surge` | Placeholder names (G2) — need approval |
| Custom-role 2FA harness step | Not tested by execution (tool stop); covered by code review and API tests only |

## 5. Verification on `825dfd1` (fresh throwaway test DB; working DB untouched)

| Check | Passed | Failed | Skipped | Not run |
|---|---|---|---|---|
| Backend typecheck / lint / build | ✓ | 0 | — | — |
| Backend tests, run 1 (fresh DB, 48 migrations) | 1224 | 0 | 0 | 0 |
| Backend tests, run 2 (same DB, re-run) | 1224 | 0 | 0 | 0 |
| Frontend tsc / eslint / production build | ✓ | 0 | — | — |
| Frontend unit tests | 62 | 0 | 0 | 0 |
| Playwright e2e (QA stack) | 70 | 0 | 0 | 0 |
| `npm audit --omit=dev` backend / frontend | 0 vulnerabilities | | | |
| gitleaks (full history, 34 commits) | no leaks | | | |
| Trivy image scan | | | | Not run (registry DNS) |
| `predeploy-gate.sh` end to end, `prod-smoke.sh` | | | | Not run (needs the server) |
| Caddy / Apache / OpenLiteSpeed templates | | | | Syntax not verified (nginx templates verified with `nginx -t`) |

**CI:** not run — GitHub Actions is blocked by account billing; the repository stays on the free plan. All results above are local.

**Coverage:** Chromium desktop light/dark and mobile viewport (UX agent: 37 screenshots in `evidence/ux/`); axe on sign-in;
keyboard checks on main flows. Not covered: Safari/Firefox, real phones.

**RBAC and data integrity:** role matrix tests for every fixed role and restricted custom roles (incl. a separate low-privilege DB
login in `tests/review-h`), Owner-only admin rows blocked for custom roles, self-decision guards, app DB role cannot hard-delete
or rewrite history (migration 998), paging totals, duplicate phones (S-27), export cap 10,000 (S-32).

## 6. Deployment, email, backup, recovery

- Deploy: app runs behind the VPS's existing proxy on 80/443 (S-28); inner nginx on `127.0.0.1:8080`; proxy templates in `devops/proxy/`.
  To check on the server first: which proxy software, port 8080 free, Docker subnets 172.29.10/20/30.0/24 free, RAM, mail sender.
- Email: transport `none` until SMTP is configured; nothing real was sent. One test to the approved recipient needs approval.
- Backups: same server (S-23), restore runbook in `DEPLOYMENT-CHECKLIST.md`; off-server copy pending (G-09).
- Recovery: key-rotation runbook (`SESSION_SECRET_PREVIOUS`), rollback steps, monitoring script `host-monitor.sh`.

## 7. Approvals still needed

Push to GitHub; deploy; server inspection; SMTP setup and one real test email; off-server backups; larger password list download;
G2 event names.

## 8. Next action

Owner approves the push of `review/2026-11-04-fixes`, then the server inspection in §6 before any deploy.
