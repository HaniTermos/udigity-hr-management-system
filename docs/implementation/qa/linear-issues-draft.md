# Linear issues: draft for approval (2026-10-28)

Target: workspace **Udigity**, team **UDI**, new project **"HR System — Launch readiness"**. Nothing has been created yet.
Labels: existing `Bug` / `Feature` / `Improvement`. Priority: 1 Urgent · 2 High · 3 Medium · 4 Low.
Figma findings reference `docs/implementation/qa/figma-diff/page-<n>.md` (finding IDs in brackets).

## A. Release / ops (9)

| # | Title | Pri | Label |
|---|---|---|---|
| A1 | CI: clear `npm audit` high advisories (body-parser < 1.20.9 via audit fix; zod < 4.6.6 major bump) | 2 | Bug |
| A2 | Prod startup/readiness guard: runtime DB role must not be superuser/createrole and must have only the permissions it needs (review F-04) | 2 | Improvement |
| A3 | `/readyz` ignores `POLICY_COMPANY_TIMEZONE`, so a deploy that sets only that stays 503 (`backend/src/app.ts:44`) | 2 | Bug |
| A4 | Push `.github/workflows/ci.yml` to GitHub and get the first green run | 3 | Improvement |
| A5 | e2e seed: create the Owner persona (Rana Haddad) directly, so `db.mjs align` becomes a no-op | 4 | Improvement |
| A6 | Verify `rbac.api.test.ts:227` passes when the suite runs twice on the same database | 4 | Bug |
| A7 | SCR-DE-003: no Figma frame and no extracted spec; design it or drop it | 3 | Feature |
| A8 | SCR-OWN-011 Settings design partial (M-16 open) | 4 | Improvement |
| A9 | Leadership sign-off on 10 policy defaults (DEC-007/008/015/018/020/025/026, ADR-008/010, B3-Q11), as a checklist in one issue | 3 | Feature |

## B. Figma QA: functional bugs (high priority)

| # | Title | Pri | Label |
|---|---|---|---|
| B1 | Owner hard-load/refresh of `/` always redirects to `/my-day`; the redirect runs before the session loads (`app/page.tsx`) [41 OWN-001] | 2 | Bug |
| B2 | Opportunities lists a Closed deal and shows contradictory copy (`Opportunities.tsx:116`) [43 CC-007 #2] | 2 | Bug |
| B3 | Employee create pre-fills role "Call Center Specialist"; it should be empty and required [41] | 2 | Bug |
| B4 | Session-expired in-app dialog (`SessionEndedDialog`) never wired, so a 401 loses unsaved input [45 SHR-013] | 2 | Bug |
| B5 | `OfflineBanner` never wired; going offline shows "Something went wrong" [45 SHR-015] | 3 | Bug |
| B6 | Delivery monitor shows the internal "SCR-OWN-012" badge to users [41 OWN-012] | 2 | Bug |
| B7 | Denied pages still show the page's own controls (Reports as non-Owner; Employees as Data Entry shows "Add employee"); use the shared full-page denied state [41 OWN-009, 45 SHR-011] | 2 | Bug |
| B8 | Business hidden/denied uses the old `AsyncState`: no Back or breadcrumb, wrong copy [42 SHR-008 #1-2, DE-007] | 3 | Bug |
| B9 | Audit log filter row overflows past the page edge; columns wrap, raw IDs shown [41 OWN-010] | 3 | Bug |

## C. Figma QA: design-fidelity gaps (Major)

| # | Title | Pri |
|---|---|---|
| C1 | App shell: sidebar 240 px, top bar 64 px, search 40 px with icon, role line in user menu, green status pill when checked in [40 S-1/S-2] | 3 |
| C2 | My Day: fixed 368 px left column, gap 24 [40 D1-1] | 3 |
| C3 | Forgot/reset password: "Check your email" and "Link expired" states per Figma [40 A4-1/2] | 3 |
| C4 | My Attendance: KPI set (Average day vs 9 h) and chip-style period filter [40 D4-1/2] | 3 |
| C5 | My Profile: Change photo, phone country code, mobile list layout [40 D6-1..3] | 4 |
| C6 | Owner dashboard: date range, compare, role/employee filters, calling and pipeline charts [41 OWN-001] | 3 |
| C7 | Attendance monitor mobile card layout [41 OWN-004] | 3 |
| C8 | Calling assignments: 3 tabs, search and filter chips, Phone and Last-attempt columns [41 OWN-007] | 3 |
| C9 | Reports & exports: report list, filters, totals, preview table [41 OWN-009] | 3 |
| C10 | Delivery monitor filter chips and copy [41 OWN-012] | 4 |
| C11 | Owner views on Calling queue, Opportunities and Deals (agent picker, Owner-only column, All/Not proceeding tabs) [43 CC-001/007, 44 DEV-001] | 3 |
| C12 | Contact workspace mobile: sticky Start Contact bar [43 CC-002] | 3 |
| C13 | Meetings List view as a table with row actions [44 DEV-003] | 3 |
| C14 | Projects: filters on one row [44 DEV-005] | 4 |
| C15 | Project board task cards: actions move to the drawer, compact card [44 DEV-006] | 3 |
| C16 | Business directory and Create business mobile layouts [42 DE-001/002] | 3 |
| C17 | Edit business save-conflict pattern (changed-by badges, Re-apply mine) [42 DE-004] | 3 |
| C18 | Developer business view "Deal context" card and breadcrumb [42 SHR-008 #3] | 4 |
| C19 | Notifications: titles with context and a link, filter chips, policy notices; needs backend payload [45 SHR-007] | 3 |
| C20 | Mobile header (title, subtitle, back) and per-role tab bar; title shown twice on mobile [42 X-2, 40] | 3 |
| C21 | Policy chips: show the topic, not "Demonstration alternative — not approved" (wrapping) [43/44 X, 42] | 4 |

## D. Needs a product decision first (one issue each, label Feature)

| # | Decision |
|---|---|
| D1 | Dark mode: keep the saturated navy (your directive) or match Figma's near-black frames |
| D2 | Navigation: permission-driven menu (fits custom roles; shows some links that open "no access") or Figma's fixed per-role menu |
| D3 | Targets and Settings: your added features (territories, extra tabs) replaced the Figma layouts; sit beside them or keep replacing |
| D4 | My Day Check in fires immediately with no confirm step; confirm that's intended |

## E. Minor / cosmetic rollups (one issue per page, Pri 4, label Improvement)

E40 (21 Minor, 6 Cosmetic) · E41 (30, 8) · E42 (32, 7) · E43 (24, 3) · E44 (14, 2) · E45 (15, 2), each linking its report.

## F. QA data

| # | Title | Pri |
|---|---|---|
| F1 | Enrich the QA/e2e seed (signed+paid deal, follow-ups, corrections, notifications, second agent session, non-Owner 2FA) so blocked states can be checked | 4 |

**Total: 9 + 9 + 21 + 4 + 6 + 1 = 50 issues + 1 project.**
