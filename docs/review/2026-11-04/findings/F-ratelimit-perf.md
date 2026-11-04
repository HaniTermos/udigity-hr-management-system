# Agent F — rate limiting, resource controls, performance (2026-11-04)

Environment: Windows 10 laptop, Node 22.18, Express 4.22.3, express-rate-limit 7.5.1, pg 8.23.1, Postgres 17.11 in Docker (`udigity-test-db`, **tmpfs data dir, 512 MB**). Evidence ran in-process (supertest) with NODE_ENV=development against my own throwaway DB, so limiter numbers are exact and bcrypt is at production cost 12. Tested commit: `cab5ec9` + uncommitted Owner work (not relevant here). Scripts: `C:\Users\Hani\AppData\Local\Temp\claude\a25399f2550b68da\b1ed2321-d7ef-454b-bbf7-54f33e576861\scratchpad\agent-f\` (xff.mts, abuse2.mts, perf.mts, seed.sql).

## INCIDENT CAUSED BY THIS AGENT (read first)
My bulk seed (20k businesses, 100k call attempts, 5k deals, 3k follow-ups, 200k notification deliveries, 44 extra employees; about 330k rows plus ~11 indexes) filled the 512 MB tmpfs of `udigity-test-db` ("No space left on device", also WAL write failure). The container exited (code 1). I ran `docker start udigity-test-db` once; the data dir came back empty (initdb), so **every throwaway DB in that container, including other agents' (D, E), was lost**; only a fresh `udigity_test` exists now. I recreated and migrated `udigity_test_rev_f` (about 14 MB), then stopped on the Lead's order and dropped it. Container now: running, healthy, 62 MB used of 512 MB, databases `postgres`, `udigity_test`. The 512 MB tmpfs is shared and too small for a representative dataset. Port 55433 was never touched. C: has 5.6 GB free (Docker VM host), so the host disk was not the limit; the tmpfs was.

Consequence: **section 4 (timed hot endpoints, N+1 query counts, event-loop, export abort, worker drain) was NOT measured.** All such items below are "Not tested (test DB unavailable: disk full)" and rest on static reading only.

## Protections inventory

| Protection | Key | Window / limit | Storage | Response | Frontend message |
|---|---|---|---|---|---|
| Login, 2FA verify, recover, enroll start/confirm, recovery-codes, enrollment-tokens, password change, reset request, reset complete | **one shared limiter instance (`authLimiter`)**, key = `req.ip` | 20 per 15 min per IP, **all those routes share one counter** | process memory (MemoryStore) | 429 JSON `{code:'RATE_LIMITED'}`, `RateLimit-*` + `Retry-After` (measured 880 s) | Login shows "Email or password is incorrect" (checks `TOO_MANY_ATTEMPTS`, backend sends `RATE_LIMITED`); 2FA shows "Code is incorrect or expired"; reset page does map 429 |
| Account lockout (password) | employee | 5 failures / 15 min, lock 15 min; reset-complete clears | DB (`credentials`) — shared across replicas | generic 401 (lock invisible) | "Email or password is incorrect" |
| 2FA lockout | factor | same 5/15/15 | DB | 429 `TOO_MANY_ATTEMPTS` | login page handles |
| API reads (all GET under /api except /auth/me, /auth/2fa/status) | session-cookie hash (else IP). `req.user` is not yet set when it runs (mounted before routers), so it is **per session, not per employee** as documented | 600 / 5 min | memory | 429 RATE_LIMITED | `AsyncState` "Too many requests" |
| Search | employee (after authenticate) | 300 / 5 min | memory | 429 | same |
| Duplicate check | employee | 30 / 10 min (exact in tests) | memory | 429 | |
| Duplicate-review request | employee | 30 / 10 min | memory | 429 | |
| Reservation heartbeat | employee + reservation id | 6 / 30 s | memory | 429 | heartbeat is 60 s |
| Report export | employee | 20 / 10 min; global 5 concurrent (`activeExports`, per-process counter, released in `finally`) | memory | 429, `Retry-After: 5` on concurrency | reports page handles TOO_MANY_ATTEMPTS only |
| Export caps | — | 1000 rows, 15 s statement_timeout (SET LOCAL), TOTP step-up | — | — | |
| Auto-fill / assign / bulk writes | none (zod caps: 200 ids, autofill limit 200; `idempotent()` only) | — | — | — | |
| Invitation resend | no endpoint exists; credential setup is issued on create and on reactivation (Owner only), no limiter | — | — | — | |
| Notification retries | outbox: 10 attempts, backoff 5 s base / 3600 s cap; jobs 30 s base / 3600 s cap, dead -> ops alert | DB | | | |
| nginx `/api/auth/` | IP | 10 r/min, burst 10 nodelay | nginx shm | 429 HTML, no JSON, no Retry-After | frontend sees non-JSON 429 |
| nginx `/api/` | IP | 20 r/s, burst 40 | | 429 | |
| nginx `/api/auth/me` | session cookie | 10 r/s burst 30 | | | |
| nginx `/`, conn | IP | web 30 r/s burst 60; 200 conn per IP | | | |
| Bodies | — | express.json 100 kb (413 mapped to `BAD_REQUEST`), nginx 10 MB | | | |
| Paging | — | pageSize max 100; `page` has no upper bound; `q` max 100 chars | | | |

With 2 API replicas every memory-backed limiter (all rows above except lockout) multiplies by 2 and resets on every restart or deploy; the export concurrency slot is also per process. Lockout is DB-backed so it holds.

## Abuse test results (measured)

| Config | 30 logins, rotating `X-Forwarded-For` | Control (same XFF) |
|---|---|---|
| no trust proxy | 429 from request 21 (XFF ignored) | same |
| `TRUST_PROXY=true` (1 hop) | **no 429 at all (30 x 401)** — spoof bypasses | 429 at 21 |
| `TRUSTED_PROXY_CIDRS=loopback` | **bypass**, same | 429 at 21 |
| `TRUSTED_PROXY_CIDRS=10.0.0.0/8` (remote not trusted) | 429 at 21 (ignored) | same |
| IPv6 rotation inside one /64 (trusted proxy) | **bypass** (key is full address, no subnet mask in v7.5.1) | |
| XFF `spoof, real` (trusted) | not bypassed (rightmost used) | |

Spoofing works only if the trusted hop passes a client-supplied single XFF through. `proxy-common.inc` overwrites XFF with `$remote_addr`, so via nginx it is not exploitable; it is if the backend is reachable another way. Nginx listens on IPv4 only, so the /64 issue is latent.

Lockout abuse (TRUST_PROXY=true, 6 wrong passwords from rotating IPs): victim locked; the victim's correct password still returns generic 401; lock was not extended by further attempts; the **Owner account was locked by anonymous requests** (5 per 15 min keeps it locked forever); a password reset completion cleared the lock and login worked. Per IP the attacker can lock 4 accounts per 15 min; with rotation, unlimited.

Reset flooding for one email (60 requests, rotating IPs): all 202, 60 outbox events, 60 tokens (each supersedes the previous, only the last stays live). No per-email limit; the attacker's requests also invalidate a link the victim already holds.

NAT fairness: the shared 20 per 15 min counts successful logins and 2FA steps too (code reading + 20-then-429 measurement). An office logging in together exceeds it with about 10 enrolled-2FA users or 20 non-2FA users.

## Findings

### F-01 · High · Blocker (needs Owner/ops decision) · Confirmed
Auth limiter is one 20 per 15 min per-IP bucket shared by login, 2FA, recovery, password change and reset, and counts successes. A shared-office NAT (the stated deployment) will lock out morning log-ins; nginx adds `auth` zone 10 r/min burst 10 per IP on the same paths (including `/api/auth/logout` and `/api/auth/2fa/status`, which the app exempts or does not limit). Location: `requestGuards.ts` `createAuthRateLimiter`, `identity/routes.ts` (single `authLimiter`), `devops/nginx/nginx.conf` zones. Fix: key login by IP+account, `skipSuccessfulRequests`, separate buckets per route, exempt logout/2fa-status in nginx, raise values after Owner picks numbers (the numbers are an unapproved placeholder). Regression test: 25 valid logins from one IP.

### F-02 · High · Non-blocker-if-fixed-before-go-live · Confirmed
Frontend never recognises the backend limiter code: login page checks `TOO_MANY_ATTEMPTS`, backend returns `RATE_LIMITED`, so an IP-limited user is told "Email or password is incorrect"; the 2FA step shows "Code is incorrect"; nginx 429s are HTML with no code. No UI reads `Retry-After`. Location: `frontend/src/app/login/page.tsx` lines ~75/97/113, `lib/auth.tsx`. Fix: map `status===429 || code==='RATE_LIMITED'` to a wait message with the retry time.

### F-03 · High · Non-blocker · Confirmed (config reading), nginx runtime Not tested
Default SWR `refreshInterval: 4000` on every `useApi`/`usePage` (calling page uses up to 4 of them, plus header unread 20 s) produces roughly 1 to 1.5 GET/s per open calling tab. Against per-session 600 per 5 min (2 per s) that leaves little margin (two tabs share one session bucket), and against nginx `api` 20 r/s per IP an office of about 15 to 20 active agents saturates the burst. 429 on a poll shows "Too many requests" on the page. Fix: raise polling intervals (15 to 30 s), key nginx by session cookie as done for `/me`, or lift the per-IP zone.

### F-04 · Medium · Confirmed
Lockout is a denial-of-service lever: anonymous attacker keeps the Owner (and anyone) locked with 5 requests per 15 min, no alert, no per-IP-per-account throttling, victim sees nothing distinctive. Recovery via reset works. Fix: lock per account+IP pair or add progressive delay and an Owner/ops alert on repeated locks; keep reset as bypass.

### F-05 · Medium · Confirmed
`/password-reset/request` has no per-email cap: unlimited emails to a victim across IPs (20 per 15 min from one IP) and each request supersedes the live link. Fix: per-email limit (e.g. 3 per hour) and do not supersede when a live token is under N minutes old.

### F-06 · Medium · Confirmed (static)
All memory-backed limiters are per-process: with 2 replicas limits double, and a deploy resets them. Use a shared store (Postgres/Redis) or document single-replica as a requirement. Export slot counter has the same property.

### F-07 · Medium · Confirmed
`apiReadLimiter` runs before `authenticate`, so `req.user` is unset and the key is the session cookie hash (documented as per employee). A user with several sessions (several browsers) multiplies the budget; random cookie values create a fresh bucket each (memory growth bounded by nginx 20 r/s). Fix: mount after authenticate or key by employee.

### F-08 · Medium · Confirmed (static)
Login CPU: bcryptjs (pure JS) at cost 12 for every login, locked-account and unknown-account attempt (also `password-reset/complete` hashes the new password at cost 12 before checking the token). Measured: about 20 failed logins took about 20 s wall time in-process (about 1 s each, including DB), so attacker traffic within 20 per IP (unlimited with spoof or many IPs) competes with all other requests on the single event loop. Event-loop delay under that load Not tested (disk-full incident). Fix: validate token before hashing; consider native bcrypt/argon2 or a worker thread; tighten per-account attempts before hashing.

### F-09 · Low · Confirmed (static) · Suspected runtime
No server timeouts set in `index.ts`: Node 22 defaults (`keepAliveTimeout` 5 s) vs nginx upstream `keepalive 16` can produce intermittent 502 from idle-connection reuse. Fix: `server.keepAliveTimeout = 65_000; headersTimeout = 66_000`. Not tested (no nginx run).

### F-10 · Low · Static
No `statement_timeout` for ordinary queries, no `idle_in_transaction_session_timeout`; only exports set 15 s. A slow-client export holds a transaction and a pool connection while backpressured (bounded only by nginx 60 s send timeout; max 5 concurrent of a pool of 20). Pool `max: 20` per process, API and worker each (so up to 40 plus migrations against Postgres default 100 connections: fine). Export release on abort: code releases the slot in `finally` and rejects writes after close; behaviour on mid-stream abort Not tested.

### F-11 · Low · Static
`page` has no maximum (safe-integer only); deep `OFFSET` is allowed and totals are counted per request. Search `q` is capped at 100, body 100 kb, pageSize 100: adequate. Dashboard has no caching and runs 5+ aggregate queries per call; 30 s owner refresh plus 60 s targets page. Not measured.

### F-12 · Low · Static
Worker: one sequential loop (outbox batch of 50, then up to 20 jobs, then 2 s sleep). Drain rate is at most 50 events per iteration, so 5,000 events need at least 100 iterations (about 200 s of sleeps plus processing, not measured). One slow consumer or slow SMTP send blocks the rest of the batch and the heartbeat job (stale after 180 s); lease is 60 s, so an iteration longer than 60 s lets a second worker re-claim (idempotent via consumer runs). Not tested.

## Not tested (test DB unavailable: disk full)
Hot-endpoint p50/p95 (business list/search, calling queue, dashboard, notifications, delivery monitor, export), N+1 query counts, event-loop blocking, export abort and slot release, outbox drain timing, shared-NAT behaviour at nginx level. A perf.mts script is ready in the scratchpad; rerun on a container with a larger data volume (at least 2 GB, not tmpfs 512 MB).

## Dataset created before the incident (for disk accounting)
About 20,000 businesses, 30,000 phones, 30,000 social accounts, 20,000 calling states, 8,000 assignments, 100,000 call attempts, 5,000 deals, 3,000 follow-ups, up to 200,000 notification deliveries (insert did not complete), 44 employees. All lost with the container reset. Current DB dropped.
