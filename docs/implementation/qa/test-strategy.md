# Test strategy — Udigity Management System

| Field | Value |
|---|---|
| Owner | QA Lead (`docs/implementation/qa/`, `e2e/`) |
| Date | 2026-10-23 |
| Contract | `acceptance.md` (criteria `AC-*`). Every test names the AC IDs it covers in its title, e.g. `AC-RES-002 concurrent Start Contact → one Active reservation` |
| Not done here | No browsers installed, nothing run that needs network. Playwright is **not installed** in this repo (checked 2026-10-23: no `@playwright/test` in `node_modules`) |

## 1. Test levels

| Level | Tool | Where | What belongs here | What does not |
|---|---|---|---|---|
| **Unit (U)** | Vitest (already in `backend/`) | `backend/src/**/*.test.ts`, later `frontend/src/**/*.test.ts(x)` | Pure rules with no I/O: phone normalisation, name normalisation and trigram threshold, 15-day boundary maths (day D+14 vs D+15 in company TZ), punctuality / grace, outcome→footer-button rule (U-01), allowed project transitions, closure guard, reminder schedule maths (−15 min, +1 h, retries 1/10/60 min), CSV-injection escaping, config flag parsing | Anything that needs SQL, HTTP or a browser |
| **API (A)** | Vitest + **supertest** against the real Express `app` | `backend/src/tests/*.api.test.ts` | Every permission cell (`acceptance.md` §2), every state-machine transition and refusal, visibility (omitted + not counted), duplicate checks incl. **concurrency** (two parallel requests), reservation races, audit row written in the same transaction, CSRF, lockout, export bytes and headers, notification/outbox rows | Layout, focus, colour |
| **E2E (E)** | Playwright (`e2e/`) | `e2e/tests/**` | The Phase 7 journeys (`docs/phase7/flows/*.md`), role landing, UI-only rules (button availability per outcome, dialogs, focus, toasts), axe accessibility, navy dark mode, visual comparison, mobile 44 px | Exhaustive permission matrices (covered at A) |

Rule of thumb: a business rule is proven at **A**; E2E proves the UI exposes it correctly and one denied path per role. Target pyramid by count: U ≈ 50 %, A ≈ 40 %, E ≈ 10 %.

### 1.1 API tests against the Docker test DB

- Database: `docker-compose.test.yml` → `postgres:17-alpine` on `127.0.0.1:55432`, tmpfs, throwaway credentials. **Never** the local PostgreSQL 17 service on 5432.
- Start: `docker compose -f docker-compose.test.yml up -d --wait`.
- Run: set `TEST_DATABASE_URL` **in the shell only** (never in a file, never in `.env*`), then `npm test --workspace=backend`. `globalSetup.ts` migrates and seeds; `NODE_ENV=test` makes config ignore `DATABASE_URL`.
- Stop/wipe: `docker compose -f docker-compose.test.yml down` (tmpfs, nothing persists).
- Isolation: each test file creates its own businesses with a unique prefix (`t-<file>-<n>`) and never deletes; tests that depend on counts filter by that prefix. Files run sequentially (`fileParallelism: false`); concurrency tests use `Promise.all` inside one test.
- Concurrency tests (DR-8, AC-RES-002, AC-ATT-008, AC-DFIX-003, AC-OUT-013) must hit the DB constraint, not only the app check: fire N=10 parallel requests and assert exactly one success.

## 2. Test data and seed

| Source | Content | Used by |
|---|---|---|
| `backend/src/db/seed.ts` (owned by backend) | 6 personas: Owner `rana.haddad@udigity.demo`; Data Entry `karim.saleh@`; Call Center `maya.khoury@`, `omar.nassar@`; Developer `lina.aoun@`, `sami.fares@` (all `@udigity.demo`). Dev seed password is defined there | A, E |
| **REQUEST → backend:** `seed:e2e` fixture set | Businesses that reproduce the Phase 6/7 sample data: Olive & Thyme Café (callback due today), Nova Dental Clinic (reserved by another agent), Lumen Yoga Studio / Urban Cuts (new, Pending), Harbor Auto Care (hidden for non-Owners: created ≥ 15 days ago), Glow Beauty Salon PRJ-0014 (In progress, 3 open tasks: Content upload, Payment page, Booking flow), one Rejected business, one deal per stage (Accepted / Signed / Paid / Signed and paid / Closed / Not proceeding), one closed deal without a project, one Failed reminder, one open data-correction request, one Open attendance session from yesterday | E (journeys), A |
| Settings fixture | Timezone `Asia/Beirut`, Mon–Fri 09:00–18:00, grace 10 min, office mode IP with `127.0.0.1` and `::1` allow-listed, holiday list empty (all marked `[NEEDS VALUE]` placeholders) | A, E |
| Owner TOTP | The seed Owner gets a **fixed test TOTP secret** stored in the seed file (test value only); E2E computes the code with `otplib`. Until then, E2E relies on the non-production dev bypass, and a test asserts the bypass is off in production (AC-AUTH-020) | E |

Rules:
- Credentials never appear in test code or reports. E2E reads `E2E_PASSWORD` (and optional `E2E_OWNER_TOTP_SECRET`) from the shell; when unset, login journeys are skipped, not failed.
- Time-based criteria (15-day rule, lease, idle, overdue, reminders, missing checkout) require a **controllable clock**. **REQUEST → backend:** in `NODE_ENV=test` only, accept a clock override (e.g. `X-Test-Now` header or a `/__test__/clock` endpoint disabled outside test) and run scheduled jobs on demand (`/__test__/jobs/:name/run`). Without it these criteria stay at U level.
- Email: **REQUEST → backend/devops:** a test mail sink (log transport readable via `/__test__/mail` in test mode, or a local Mailpit container in `docker-compose.test.yml`). No real external email, ever.

## 3. Policy flags in tests

- Flag-dependent criteria run on the demonstration default. The test title contains `[demo-default]` and the flag name.
- Each `FLAG` item (`visibility.timerBasis`, `deals.developerPreClosure`, `deals.closureMode`, `projects.autoProvision`, `attendance.employeeRequests`, `attendance.failedCheckout`, `OWNER_PENDING_2FA_SCOPE`, `DE-1|DE-2`, B3-Q05) gets at least one API test with the alternate branch switched on.
- U-01 (Accepted keeps the reservation) is the only approved rule; its test is tagged `[approved]` and is a release blocker on its own.
- A test must fail if a flag-dependent UI is shown **without** the "Demonstration alternative — not approved" label in a non-production build (AC-UI-005).

## 4. Per-increment gates

No document defines the increments yet (`status-2026-10-23.md` §2). QA uses this mapping until `plan.md` publishes one; QA will re-map on publication.

| Inc | Scope | Gate (all must pass before the next increment starts) |
|---|---|---|
| 1 | Identity: login, Owner 2FA, sessions, CSRF, reset, employees, audit writer, app shell, route guard | U+A green with the Docker DB (no skipped DB suite); AC-AUTH-001..022, PERM-01, EMP-001..004, AUD-001/002/005/006; E2E smoke (login page) green; axe clean on SCR-AUTH-001..004 in Light and Dark; navy check on the login page |
| 2 | Attendance + settings + corrections | AC-ATT-*, ACOR-*, SET-*; check-in/out journey; mobile 44 px on SHR-002/003/005 |
| 3 | Business data, duplicates, visibility engine, corrections, categories | AC-BIZ-*, DUP-*, VIS-*, DFIX-*, CAT-*; concurrency tests DR-8; "no hidden name or count anywhere" sweep (list, search, dialog, notification, export) |
| 4 | Calling: assignment, reservation/lease, outcomes, follow-ups, do-not-call | AC-CALL-*, RES-*, OUT-*, FUP-*, DNC-*; **U-01 test**; queue-to-outcome journey (F1); reservation conflict journey (F3) with fake clock |
| 5 | Deals, meetings, closure, project provisioning, projects, tasks | AC-DEAL-*, MEET-*, CLOSE-*, PROJ-*, TASK-*; Record-delivered P7 checks 1–4; F3 provisioning failure |
| 6 | Dashboard, reports, exports, audit explorer, notifications/delivery monitor | AC-RPT-*, EXP-*, AUD-003/004, NOTIF-*; synchronous export journey; G1 distinctions |
| Release | All | Full suite green; zero open ISSUE of severity high; visual diffs reviewed and signed off; every flag at its demonstration default and labelled |

Every gate also requires: `npm run typecheck`, `npm run lint`, `npm run build` green in both workspaces; no new axe serious/critical violation; no test that reads `.env*`.

## 5. Accessibility checks (axe)

- Library: `@axe-core/playwright`. Helper: `e2e/helpers/a11y.ts` → `expectNoA11yViolations(page, { include?, disableRules? })`.
- Rules: WCAG 2.0/2.1 A and AA tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`). **Fail on `serious` and `critical`**; `moderate`/`minor` are attached to the report and tracked.
- Run on every screen state reached by an E2E test, in Light **and** Dark (projects `desktop-light`, `desktop-dark`), and on mobile for screens with a mobile frame.
- Rule exceptions require a REQUEST on the board with a reason and an expiry; no blanket `disableRules`.
- Manual (per release): keyboard-only pass of each journey; focus order and focus return for drawers/dialogs (AC-UI-008); screen-reader spot check (NVDA) of login, check-in, duplicate dialog, outcome panel.

## 6. Visual checks against `docs/phase6/previews`

- Previews are Figma exports: desktop **1440×900**, mobile **390×844**, named `SCR-XXX-nnn — <Name> — <Desktop|Mobile> — <Light|Dark>[ — <State>].png`, in folders `40`–`45` (+ `30-sample` for SCR-DE-003).
- Two layers:
  1. **Design comparison (advisory, human-reviewed).** `e2e/helpers/visual.ts` captures the page at the preview size and computes a pixel diff against the preview with `pixelmatch`; it writes `actual`, `expected`, `diff` images and the mismatch ratio into the HTML report. It does **not** fail the build (fonts and anti-aliasing differ between Figma and Chromium); the gate is "diff reviewed and accepted" per screen at each increment. Ratio above 15 % is flagged for review.
  2. **Regression (gating).** Once a screen is accepted, `expect(page).toHaveScreenshot()` baselines (stored in `e2e/tests/**/__screenshots__`) gate later changes (`maxDiffPixelRatio: 0.01`, animations disabled, dynamic text masked: clocks, timers, dates).
- Only screens with a Ready / Ready-with-gaps status in `phase6/handoff-ready.md` are compared. SCR-DE-003 uses `30-sample` 101:5214 / 101:6168. SCR-OWN-011 (Partial, C11) is compared for layout only.

## 7. Navy dark mode check (contrast)

User directive 2026-10-23: dark mode is **navy, not black**. Helper `e2e/helpers/theme.ts`:

1. Switch to dark (the app stores `udigity-theme=dark` in `localStorage` and sets `class="dark"` on `<html>`; the project `desktop-dark` also sets `colorScheme: 'dark'`).
2. **Hue check:** read the computed `background-color` of `body`, the main content region and a card. Each must be navy: HSL hue 205°–235°, saturation ≥ 25 %, lightness ≤ 30 %. Pure greys/blacks (saturation < 10 %) fail. The sidebar (`surface/brand`) must be navy in both modes.
3. **Contrast check:** for every visible text node, compute the WCAG ratio between its colour and the effective background (walks up until an opaque background). Need ≥ 4.5:1 (≥ 3:1 for ≥ 24 px or ≥ 18.66 px bold). axe `color-contrast` runs as a second opinion.
4. Report the offending selector, colours and ratio.

**Pre-existing finding (2026-10-23):** `frontend/src/app/globals.css` `.dark` sets `--surface-page: #11151B`, `--surface-default: #1A2029` (grey/950, grey/900 — the Phase 5 design-system Dark values), which are near-black, saturation < 25 %. The navy check will **fail** until the frontend adopts navy dark surfaces (and the design-system Dark mode is updated to match the directive). Posted as an ISSUE on the board.

## 8. E2E scaffold (`e2e/`)

| Path | Purpose |
|---|---|
| `e2e/package.json` | Standalone package (not a root workspace, so the root lockfile is untouched): `@playwright/test`, `@axe-core/playwright`, `pixelmatch`, `pngjs`, `otplib` |
| `e2e/playwright.config.ts` | Projects `desktop-light`, `desktop-dark` (1440×900), `mobile-light` (390×844, touch); `baseURL` from `E2E_BASE_URL` (default `http://localhost:3000`); optional `webServer` when `E2E_START_SERVERS=1` |
| `e2e/fixtures/` | Personas (seed emails; password from env), extended `test` with page objects |
| `e2e/pages/` | Page objects: `LoginPage`, `TwoFactorPage`, `AppShell`, `MyDayPage`, `AttendancePage` (check-in/out), `BusinessDirectoryPage`, `CreateBusinessPage` (+ duplicate dialog), `CallingQueuePage`, `ContactWorkspacePage` (reservation + outcome), `DealDetailPage`, `ProjectBoardPage` (Record delivered dialog), `ReportsPage` (export), `AuditLogPage` |
| `e2e/helpers/` | `a11y.ts`, `theme.ts` (navy + contrast), `visual.ts` (preview diff) |
| `e2e/tests/smoke/login.spec.ts` | Smoke: login page renders, validation, forgot-password link, axe, navy dark |
| `e2e/tests/journeys/*.spec.ts` | Phase 7 journeys; skipped unless `E2E_JOURNEYS=1` (modules are still mocked) |

### Install and run (not done here; needs network)

```bash
cd e2e
npm install                          # @playwright/test, axe, pixelmatch, pngjs, otplib
npx playwright install chromium      # browser download (~150 MB)
# start the app separately (npm run dev at the repo root), or set E2E_START_SERVERS=1
npx playwright test --project=desktop-light tests/smoke
E2E_PASSWORD=… E2E_JOURNEYS=1 npx playwright test
npx playwright show-report
```

`E2E_PASSWORD` is the dev seed password from `backend/src/db/seed.ts`; set it in the shell, never in a file.

## 9. Reporting and defects

- Each run produces the Playwright HTML report (`e2e/playwright-report/`) and JUnit (`e2e/test-results/junit.xml`) for CI.
- Defects are posted on the coordination board as `ISSUE` with the AC ID, severity (high = rule broken / data leak / security; medium = wrong state or copy; low = cosmetic), reproduction and owner folder.
- A hidden-record leak (name, id or count of a hidden business in any payload, list, dialog, email or export) is always **high**.
