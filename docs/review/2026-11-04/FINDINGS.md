# Findings register (deduplicated by root cause)

Sources: `findings/B-frontend.md` (34), `C-backend.md` (21), `D-database.md` (13), `E-security-rbac.md` (12),
`F-ratelimit-perf.md` (12), `G-devops.md` (19), system map `01-system-map.md`. Full reproduction, evidence and
location for every ID are in those files; this register groups them by root cause and tracks status.
Discovery on local `cab5ec9` (+ Owner WIP). **0 Critical. 10 High — all 10 fixed and verified on `825dfd1`.** Medium: all fixed except the items listed in `REVIEW-SUMMARY.md` §4. Status column: Open → Fixing → Fixed (verified
on commit) / Decision / Accepted.

## Release blockers and High

| Root cause | IDs | Severity | Blocker | Batch | Status |
|---|---|---|---|---|---|
| Auth rate limit is one per-IP bucket for login/2FA/recovery/reset, counts successes; office NAT locks everyone out at morning login; nginx 10 r/min zone on all `/api/auth/*` | F-01 | High | Yes | 1 | **Fixed** (verified on 825dfd1) |
| Account lockout is an anonymous DoS lever (5 wrong passwords / 15 min keep any account, incl. Owner, locked) | E-01, F-04 | Medium | Yes (Owner availability) | 1 | **Fixed** (verified on 825dfd1) |
| Rate-limited users are told "password incorrect" / "code incorrect"; nginx 429 is HTML; no `Retry-After` use | F-02, B-13 | High | Yes | 1 | **Fixed** (verified on 825dfd1) |
| Every page polls every 4 s (and keeps polling after 403/404); ~15–20 agents behind one IP saturate per-IP/per-session read limits | F-03, B-07 | High | Yes (under real office load) | 3 | **Fixed** (verified on 825dfd1) |
| Stack assumes it owns ports 80/443 (certbot standalone, stop-nginx renew hooks); the VPS already runs other sites/a proxy (S-28) | G-01 | High | Yes (deploy) | 4 | **Fixed** (verified on 825dfd1) |
| Behind the existing outer proxy (S-28) nginx overwrites `X-Forwarded-For` → office-IP check broken + all users in one rate-limit bucket | G-02 | High | Yes | 4 | **Fixed** (verified on 825dfd1) |
| Frontend lint fails on the Owner's uncommitted "Assign developers" work (`ProjectBoard.tsx:798, 815`) + 6 smaller issues in that change | B-01, B-19 | High | Yes (CI) | 3 | **Fixed** (verified on 825dfd1) |
| Owner has no screen to grant / approve / revoke remote exceptions (approved D3; backend routes exist) | B-02 | High | Yes (policy D3 unusable) | 3 | **Fixed** (verified on 825dfd1) |
| Assigned Developer has no list of open deals (Deals list is closed-only; Accepted tab disabled) | B-03 | High | Candidate | 3 | **Fixed** (S-29: Accepted tab for the assigned Developer; verified on 825dfd1) |

## Medium (grouped)

| Root cause | IDs | Batch |
|---|---|---|
| Custom roles can be granted 9 Owner-only admin rows (contradicts S-26); `deal.read` at global scope bypasses D15 | E-02, E-08 | 1 |
| No self-decision guard on attendance adjust / retroactive create / review resolve | E-03 | 2 |
| App DB role can hard-delete/rewrite business and history tables; default privileges widen 980/981/997 grants (D20) | D-01, D-02 | 1 |
| Ops alerts emailed twice by concurrent dispatchers; job completion ignores lease; network I/O inside tx/locks | D-03, D-07, D-08, C-09 | 2 |
| Bad input (impossible dates, NUL, huge numbers) returns 500 and raises ops-alert emails | C-01 | 2 |
| Offset paging loses/repeats rows (targets, work items, deals, projects); `total` 0 past last page | C-02, C-06 | 2 |
| Parallel auto-fill exceeds queue cap 40 (D8) | C-03 | 2 |
| CSV dates wrapped in literal quotes; export cap truncates silently; catalogue promises absent columns | C-04, C-05 | 2 |
| Future payment/signature dates accepted | C-07 | 2 |
| Poison job / email delivery can loop forever (no attempt cap on claim) | C-08 | 2 |
| Reset request floods (no per-email cap); limiters per process; read limiter keyed before auth; bcrypt cost on every attempt | F-05, F-06, F-07, F-08 | 1 |
| Frontend: list search filters only the loaded page; task save ignores concurrent version; missing idempotency keys; logout ignores failure; SWR cache survives user switch; Delivery uses browser time; custom-role checks by role name; mobile nav reach; offline/unsaved-input gaps; session-expiry routing; meeting drawer uses Owner-only employee list; delivery monitor paging | B-04…B-12, B-14…B-18 | 3 |
| DevOps: placeholder hostname (`app.example.com`) everywhere — must become `hrsystem.udigity.com` (K-1); proxy CIDR depends on dynamic subnet; unpinned images; no resource limits/stop grace; unbounded WAL/backup volumes; monitoring blind spots; recovery capability (S-23); rollback depends on shell var; CI gaps | G-03…G-11 | 4 |

## Low / Info

B-20…B-34, C-10…C-21, D-04…D-13, E-04…E-12, F-09…F-12, G-12…G-19 — see the area files; each is assigned to the
batch owning its files (backend → 2, frontend → 3, devops/config → 4, identity/limits → 1).

## Needs an Owner decision or input

| ID | Question |
|---|---|
| B-01/B-19 | **Answered 2026-11-04: fix it and include it.** |
| D-11 | **Answered 2026-11-04 (S-27): removed phones are kept and still block duplicates.** |
| G-01/G-02 | **Answered 2026-11-04 (S-28): Hostinger VPS that already has other sites/a proxy on 80/443 → app runs behind it.** Exact proxy software still to inspect on the server. |
| B-03, B-12 | Verify against the approved design snapshot (`docs/phase6/previews`) — done by the UX agent, Owner only if the snapshot is unclear |

## Found during final verification

| ID | Finding | Severity | Status |
|---|---|---|---|
| R-02 | The C-06 fix (real `total` on an empty page) built its count query with `params.values.slice(0, -2)`, assuming LIMIT/OFFSET are the last two parameters. Access filters for scoped roles (Developer, Call Center) add parameters after them → `GET /api/projects` / `/api/deals` answered **500** "bind message supplies 3 parameters, but prepared statement requires 4" whenever the page was empty. Seen as an intermittent role-matrix failure (run 1 of 2) | High (regression from the review) | **Fixed**: `keepPagePlaceholders(page)` in `shared/pagination.ts` keeps the page placeholders referenced; both repos pass the full parameter list. Regression test `delivery.api.test.ts` "C-06: a page past the end answers 200…" — **fails with the old code (500), passes with the fix** |

## Process note

Migration files are applied in plain lexical order (`migrate.ts` `.sort()`), so `1000_*` would run before `102_*`. Only `998_*` and `999_*` remain safe in the current scheme; a numbering convention change is a follow-up (review finding R-01, Low).

## Batches

1. Security and integrity: identity, rate limits, lockout, custom-role guard, DB privileges.
2. Backend correctness and reliability: validation, paging, exports, jobs/alerts, attendance guards, timeouts.
3. Frontend: remote-exception screen, limits/polling, wiring and state fixes, UX/a11y (then browser QA, agent A).
4. DevOps and configuration: hostname, proxy topology variants, image pinning, limits, monitoring, check-env.
5. Independent final QA (agent H) and full verification on the final revision.
