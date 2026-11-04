# Security controls checklist — OWASP ASVS 5.0.0 Level 2 (2026-11-04)

Defence-controls checklist for the system Owner. For each requirement it records which control protects the system and
the evidence for it (file:line, config, automated test name), or that the control is missing or weak and how to fix it.
This file has **no attack steps, payloads or reproduction recipes**. Gaps are described only as "missing/weak control,
fix, verify with".

| Item | Value |
|---|---|
| Revision reviewed | branch `review/2026-11-04-fixes`, commit `1644e29` (after fix batches 1–4: `e85cdf3`, `d1cfc15`, `25b40e2`, `8744d72`, `8089d34`, `1644e29`) |
| Standard | OWASP ASVS 5.0.0 (May 2025), Level 2, condensed by chapter (V1–V17). Cross-references: OWASP Top 10:2025 (A01–A10) and OWASP API Security Top 10 2023 (API1–API10) |
| Requirement ids | Given at ASVS 5.0 **section** level (e.g. `V6.3`) with short paraphrased text. The owasp.org sites could not be reached from this session (DNS failure), so the per-requirement wording was **not** re-checked online. Check the exact numbers against the ASVS 5.0.0 release before quoting them externally |
| Inputs | `README.md`, `FINDINGS.md`, `01-system-map.md`, `findings/E-security-rbac.md`, `findings/F-ratelimit-perf.md`, `DEPLOYMENT-CHECKLIST.md`, `H-independent-qa.md`, plus the source |
| Method | Code and config reading; existing automated suites run again; small control-verification tests written for this review (they only check that a control is present) |
| Throwaway DB | `udigity_test_ctl` in `udigity-test-db` (127.0.0.1:55432); dropped at the end. Port 55433 was not touched. No external hosts were contacted |

## Executed evidence (this review)

| Run | Result |
|---|---|
| Existing security-relevant backend suites on `udigity_test_ctl` (fresh migrate + seed): `tests/auth.api`, `tests/identity.unit`, `tests/security`, `tests/securityVerification`, `tests/config`, `tests/routeGuard`, `tests/runtimeRole`, `tests/setPasswordLinks.api`, `notifications/email`, `identity/sec3.unit`, `access/rbac.api`, `tests/opsAlert.api`, `tests/shared`, `tests/fixBeA`, `reports/reports.api`, `attendance/officeDns` | **16 files, 203 tests, all passed** (53 s) |
| Control-verification tests `CTL-*` (scratch: `C:\Users\Hani\AppData\Local\Temp\claude\a25399f2550b68da\b1ed2321-d7ef-454b-bbf7-54f33e576861\scratchpad\ctl\controls.test.ts`, config `vitest.ctl.config.ts` beside it) | **23 tests: 17 passed, 6 failed.** Each failure is a missing/weak control, listed below with its fix: CTL-VAL meetings control characters, CTL-VAL meetings date range, CTL-WEB `poweredByHeader`, CTL-OPS nginx `cap_drop`, CTL-OPS outer-proxy log redaction, CTL-OPS CI `persist-credentials` |

The `CTL-*` tests are not in the repository. To keep them, copy them to `backend/src/tests/securityControls.test.ts`
(imports become relative). That is a source change, so it needs Owner approval first.

---

## One-page summary

### Counts (81 requirement rows)

| Status | Count |
|---|---|
| Implemented | **48** |
| Partial | **24** |
| Missing | **1** |
| N/A | **8** |

No row is a release blocker on its own. Authorisation (V8), session management (V7), injection (V1), CSRF/CORS and
error handling are strong and covered by tests. The gaps are in hardening: MFA coverage, password-quality checks,
secret/key management, the supply-chain gate, the outer proxy, container and egress hardening, and monitoring.

### Gaps ranked by risk (highest first)

| # | Row | Missing/weak control | Fix (short) | Top 10 / API |
|---|---|---|---|---|
| 1 | V6.3-c | Only the Owner must use a second factor. Every other staff account, including Owner-configured custom roles without admin rows, signs in with a password only | Owner decision: require TOTP for all staff (enrolment flow already exists), or at least for every non-system role and every remote sign-in | A07 / API2 |
| 2 | V6.2-b | New passwords are not checked against a common or breached password list | Bundle a top-10k common-password list (offline) and refuse matches in `NewPasswordSchema` | A07 / API2 |
| 3 | V14.2-a | Reset and invitation tokens travel in the URL query (`/reset-password?token=`). The inner nginx redacts them, but the **outer proxy template logs them in clear** | Add a redacting `log_format` (or `access_log off` for `/reset-password`) to every `devops/proxy/*.example`; longer term move the token into the URL fragment | A04 / API8 |
| 4 | V15.2-a/b | The supply-chain gate does not run at the moment (GitHub CI blocked by account billing). Install scripts run during `npm ci`. There is no image or SBOM scan, and `apk add` is unpinned | Restore CI or run the same gate locally before each deploy; add `--ignore-scripts` plus explicit rebuilds; add a Trivy/Grype image scan and an SBOM step; `persist-credentials: false` | A03 / A08 |
| 5 | V6.3-a | Login throttling lives in process memory: it resets on restart or deploy and doubles with a second replica (F-06). A successful sign-in does not reset the (email, IP) bucket (H-02) | Keep exactly one API replica (documented) and add a deploy check; move counters to a Postgres table when convenient; clear the pair bucket on success | A07 / API4 |
| 6 | V11.1 | `SESSION_SECRET` is the single root for session-token hashing, CSRF derivation, reset-token HMAC and notification-secret encryption, and it has no rotation path. TOTP keys do rotate | Derive separate keys per purpose; support `SESSION_SECRET_PREVIOUS` for verify/decrypt during rotation; write the rotation runbook | A04 |
| 7 | V13.2-c / V12.3-a | The worker's egress network can reach any internet host, not only SMTP. Database and app-internal hops are plain TCP on the internal Docker network | Host firewall (DOCKER-USER chain) allowing the egress subnet only to the SMTP host:port; accept internal plaintext on one host as a recorded risk, or enable Postgres TLS | A02 / API7 |
| 8 | V13.2-b | Migrations run as the cluster **superuser** (`POSTGRES_USER`) | Create a non-superuser owner role for the schema and use it in `migrate.env`; keep the superuser for init only | A02 |
| 9 | V13-cont | The nginx edge container keeps default capabilities, is not read-only, and its master process runs as root | `cap_drop: [ALL]` + `cap_add: [CHOWN, SETUID, SETGID, NET_BIND_SERVICE]`, `read_only: true` with tmpfs for cache/run, or switch to `nginx-unprivileged` listening on 8080 | A02 |
| 10 | V2.2-a | Meetings free-text fields accept control characters, and meeting date-times are not range-checked like the shared validators | Use `safeString()` and `isoDateTime()` in `meetings/schemas.ts:44,72-101` (and the remaining bare strings in attendance) | A05 / API8 |
| 11 | V6.4-b / V7.5-b | No e-mail notice for password change, 2FA enrolment or recovery-code use. Users can sign out everywhere but cannot list or end a single session | Queue `security.*` notices on those events; add `GET /api/auth/sessions` + revoke-one | A07 |
| 12 | V16.3-b | Security events are audited, but nothing alerts on abuse patterns (many failed sign-ins, factor locks, repeated 403s), and 403 denials are not recorded | Raise an ops alert when failure counters cross a threshold; record denied admin-row attempts in `audit_events` | A09 |
| 13 | V14-bkp | Backups sit on the same server (Owner exception S-23); raw WAL is unencrypted for up to a minute in a volume; the restore drill has not run yet | Off-server encrypted copy (DEPLOYMENT-CHECKLIST 0.4); run restore drills (a) and (b) before go-live | A08 |
| 14 | lower | Header hygiene (Next `X-Powered-By`, duplicate app/edge headers), no `Clear-Site-Data` on logout, plain-text logs, missing data inventory, IMPL-LOCKOUT decision not recorded, TLS ciphers unverified, `page` unbounded | See the rows marked Partial below | A02 / A09 |

### Residual risk (what cannot be verified locally)

- **Outer proxy and TLS.** The VPS proxy software, its TLS versions and ciphers, certificate renewal, HTTP→HTTPS redirect,
  HSTS delivery through it, its access logs and its `X-Forwarded-For` handling are unknown until the server is inspected
  (DEPLOYMENT-CHECKLIST §1). Everything in V12.1/V12.2 is verified only in templates.
- **Server hardening.** SSH configuration, firewall, OS patch level, Docker daemon settings, disk encryption of the
  `pgdata`/`backups` volumes, other tenants on the same VPS, and host log retention are outside this repository.
- **Real SMTP.** Gmail TLS, the App Password's scope, SPF/DKIM/DMARC for the sender domain and real deliverability were
  not exercised (tests use the memory/log transports).
- **Browser enforcement.** The CSP and headers were checked as emitted strings and by the earlier E review; they were not
  observed through the production nginx chain in a real browser.
- **Load-bound controls.** Rate-limit sizing behind the real office NAT and event-loop behaviour under bcrypt load (F-08)
  were not measured (the shared 512 MB tmpfs test DB cannot hold a representative dataset).
- **Policy values.** Session timeouts, lockout values and rate-limit numbers are working defaults marked "not approved"
  (IMPL-SESSION, IMPL-LOCKOUT). The controls exist; the numbers still need an Owner decision.

---

## Checklist by ASVS chapter

Legend: **Impl** = Implemented, **Part** = Partial, **Miss** = Missing, **N/A** = not applicable. Paths are relative to
the repository root; `be/` = `backend/src/`, `fe/` = `frontend/src/`. Test names are quoted from the suites.

### V1 Encoding and Sanitization

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V1.1 | Encode output for its context; no unsafe HTML sinks | Impl | React auto-escaping. The only `dangerouslySetInnerHTML` is the constant theme script (`fe/lib/theme.tsx:27,36`), nonce-covered. E-mail templates HTML-escape every variable (`be/modules/notifications/templates.ts:111`) | — | `email.test` "HTML-escapes variables and strips CR/LF from every part", "link attribute is escaped (no attribute break-out)" |
| V1.2-a | Parameterised SQL; identifiers only from whitelists | Impl | `SqlParams` placeholder collector (`be/shared/sql.ts`); column whitelists in update builders (`deals/repo.ts:146`, `projects/repo.ts:103,360`, `meetings/repo.ts:84`, `attendance/repo.ts:263`); ORDER BY from `orderByClause` whitelists (`businesses/service.ts:599`); access-engine aliases validated | Optional hardening: a lint/semgrep rule that refuses `${…}` inside `.query(` text except whitelisted helpers | `shared.test` "builds whitelisted ORDER BY and parameterised LIMIT/OFFSET"; `access.test` "rejects non-identifier alias/idColumn (no SQL injection through options)"; `fixBeA` "unknown sort is a 400"; CTL-SQL |
| V1.2-b | LIKE/ILIKE wildcards escaped | Impl | `\ % _` escaped before binding (`employees/repo.ts:57`, `calls/service.ts:1035`, `corrections/service.ts:164`, `assignment/service.ts:359`) | — | Proposed: "search for a literal `%` matches only names containing `%`" |
| V1.2-c | CSV/spreadsheet formula neutralisation | Impl | `escapeCsvField` (`reports/service.ts:206`) prefixes `= + - @ TAB CR` | — | `reports.api` "prefixes = + - @ TAB CR cells with an apostrophe, then quotes as usual"; `fixBeA` "writes a Date as plain ISO text, still escaping formulas" |
| V1.2-d | Mail header / CRLF injection | Impl | CR/LF stripped from template parts; recipient with CR/LF refused (`notifications/transport.ts`) | — | `email.test` "transport: header injection through real nodemailer", "rejects a recipient with CR/LF or an invalid address" |
| V1.2-e | OS command, LDAP, XPath, template injection | N/A | No `child_process`, LDAP, XPath or server-side template engine in the code | — | — |
| V1.3 | Sanitise untrusted HTML / rich text | N/A | No rich-text input; all text is rendered as text | — | — |
| V1.5 | Safe deserialisation | Impl | Only `express.json` (100 kb, `be/app.ts:33`) and `JSON.parse`; no object or class deserialisers | — | CTL-ERR "malformed JSON body: 400 BAD_REQUEST with a generic message" |

### V2 Validation and Business Logic

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V2.2-a | Server-side positive validation of all input (type, length, range, charset) | Part | Zod `.strict()` schemas in every module; shared `safeString`, `isoDate`, `isoDateTime`, `boundedInt` (`be/shared/validation.ts`); DB data errors mapped to 400 as a backstop (`be/middleware/errorHandler.ts:16,57`). **Weak:** `meetings/schemas.ts` free text (title, location, agenda, discoveryNotes, reason, note) uses bare `z.string()` (control characters accepted), and `IsoDateTime` (`:44`) has no year range; 11 bare strings remain in `attendance/schemas.ts`; login/reset bodies are not `.strict()` (`identity/routes.ts:87,118,120`) | Use `safeString()` / `isoDateTime()` for those fields; `.strict()` on identity bodies | **CTL-VAL (failing now):** "meetings free text (agenda) rejects control characters like the shared validator", "meetings date-times are range-checked like the shared isoDateTime"; existing `fixBeA` "C-01 / C-10 / C-11: bad dates, NUL, unknown sort, bad ids are 400 with a requestId" |
| V2.3 | Business-logic order, limits and integrity | Impl | Optimistic versions (409 `VERSION_CONFLICT`), state machines (`projects/service.ts:598`), `Idempotency-Key` (`platform/idempotency.ts`), self-decision guards (E-03 fixed), queue cap under concurrency (C-03), future-date refusals (C-07) | — | `reviewFixBeb.api` "E-03: the Owner cannot adjust, resolve the review of, or create a retroactive session for themselves"; `fixBeA` "C-03: parallel auto-fill never pushes a queue past the cap"; `rbac.api` "IC-16: every committed change bumps version" |
| V2.4 | Anti-automation on sensitive business flows | Part | Per-employee limiters for duplicate check, duplicate review, search, reservation renew, export (`be/shared/rateLimit.ts:46`, `reports/routes.ts:54`). **Weak:** counters in process memory (F-06); bulk commands (assign, autofill) have zod caps and idempotency but no rate limit | Shared store or a recorded single-replica constraint; add a per-Owner limiter on autofill/assign | `reports.api` "R2-02: exports are rate-limited per Owner (429 RATE_LIMITED after 20 in 10 min)"; proposed: "autofill beyond N per minute answers 429" |

### V3 Web Frontend Security

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V3.2 | Correct content interpretation | Impl | `nosniff` (helmet, nginx `security-headers.inc`, `fe/lib/csp.ts:52`); exports sent as `attachment` with server-built filenames (`reports/routes.ts:77-79`, `reports/service.ts:433`) | — | CTL-HDR; `reports.api` "Catalogue list and export CSV/JSON" |
| V3.3 | Cookie attributes | Impl | Session cookie HttpOnly, SameSite=Lax, Path=/, Secure and `__Host-` prefix in production (`identity/sessions.ts:120-136`, `be/config/index.ts:340-342`). The CSRF cookie is readable on purpose (double submit plus server-side HMAC) | — | `config.test` "production config is strict: Secure host-only cookies, missing Origin rejected"; `securityVerification` "evaluates __Host- prefix and Secure flag in production configuration"; CTL-SESS "login sets an HttpOnly SameSite=Lax session cookie…" |
| V3.4-a | Content Security Policy | Impl | Per-request 128-bit nonce + `strict-dynamic`, no script `unsafe-inline`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action 'self'` (`fe/lib/csp.ts:25-43`, `fe/proxy.ts:57-66`); helmet CSP on the API; edge adds only non-conflicting directives (`devops/nginx/conf.d/security-headers.inc`). `style-src 'unsafe-inline'` is a documented trade-off (style attributes) | Optional: drop the stale "Google Fonts" note in `csp.ts:9-10`; add `report-to` once a collector exists | CTL-WEB "nonce CSP: no unsafe-inline/unsafe-eval for scripts in production…", "nonce has at least 128 bits and differs per call" |
| V3.4-b | Other browser security headers, no technology banners | Part | HSTS 1 y + includeSubDomains, XFO DENY, Referrer-Policy (single source; `no-referrer` on reset pages), Permissions-Policy, COOP (`security-headers.inc`, `fe/lib/csp.ts:48-58`); API `x-powered-by` disabled (`be/app.ts:21`); `server_tokens off`. **Weak:** Next.js sends `X-Powered-By` (no `poweredByHeader: false` in `frontend/next.config.mjs`); app and edge both send XFO/nosniff/Permissions-Policy, and the two Permissions-Policy values differ (`geolocation=(self)` vs `geolocation=()`) | `poweredByHeader: false`; `proxy_hide_header` for the app copies (as for Referrer-Policy) so one source decides each header | **CTL-WEB (failing now):** "Next.js does not advertise itself (poweredByHeader: false)"; proposed: prod-smoke "each security header appears exactly once" |
| V3.5-a | CSRF and cross-origin controls; CORS allowlist | Impl | Origin/Referer check on every mutation (`be/middleware/requestGuards.ts:17-28`, `identity/security.ts:167-183`); per-session HMAC CSRF token on authenticated mutations (`be/middleware/auth.ts:163-168`); missing Origin refused in production (`config/index.ts:326`); CORS only for the configured origin (`be/app.ts:26-31`) | — | `securityVerification` "rejects mutating requests with missing or mismatched Origin/Referer", "…mismatched CSRF token"; `identity.unit` "requires the CSRF token on mutations"; CTL-CSRF; CTL-SESS "a mutation with a valid session but without X-CSRF-Token is refused" |
| V3.5-b | No state change through GET | Impl | Mutations are POST/PATCH/PUT/DELETE; `GET /api/reports/export` returns 405 and changes nothing (`reports/routes.ts:42-44`) | — | `reports.api` "R2-02: GET export is 405 and changes nothing" |
| V3.6 | Subresource integrity for third-party assets | N/A | No third-party scripts or styles; fonts bundled (`font-src 'self'`) | — | — |
| V3.7 | Open-redirect protection; safe external links | Impl | `safeRedirectTarget` (`fe/lib/authRoutes.ts:44-…`): same-origin relative paths only, control characters and backslashes refused, also after decoding; the one `target="_blank"` link has `rel="noreferrer"` | — | `authRoutes.test`; CTL-WEB "post-login redirect accepts only same-origin relative paths" |

### V4 API and Web Service

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V4.1 | Content type and methods enforced | Impl | JSON-only parser; unknown `/api` paths give a JSON 404 (`be/app.ts:86-88`); unsupported methods give 405 (`errorHandler.ts:82`) | — | `shared.test` "answers unknown API paths with the JSON error shape and no-store"; CTL-ERR |
| V4.2 | HTTP message framing and timeouts | Impl (edge unverified) | nginx in front with HTTP/1.1 upstream; Node `keepAliveTimeout` 75 s / `headersTimeout` 76 s (`be/index.ts:21-22`); nginx header/body timeouts 15 s (`devops/nginx/nginx.conf`) | Verify after deploy through the outer proxy (residual) | Proposed: prod-smoke "idle upstream reuse gives no 502 over 5 min" |
| V4.3-a | Resource consumption limits (API4) | Part | 100 kb JSON body (413), pageSize ≤ 100, `q` ≤ 100, export 1000 rows / 15 s / 5 concurrent, DB `statement_timeout` 30 s, `lock_timeout` 5 s, `idle_in_transaction` 60 s (`be/db/pool.ts:17-28`); nginx zones (`nginx.conf`); container memory/pid caps. **Weak:** `page` has no upper bound (deep OFFSET, F-11); limiters are per process (F-06) | Cap `page` (e.g. 10 000) or move lists to keyset paging; shared limiter store or one-replica check | CTL-ERR "body above 100 kb: 413 PAYLOAD_TOO_LARGE"; `shared.test` "caps pageSize at 100"; proposed: "page above the cap is 400" |
| V4.3-b | API inventory; no unguarded or shadow routes (API9) | Impl | `enforceRouteGuards` refuses to start in production with an unguarded route (`be/shared/routeGuard.ts`, `modules/index.ts`); test-support mounts only when `NODE_ENV=test` | — | `routeGuard.test` "every mounted /api route of the real module registry has requireAction (or is allowlisted)", "every allowlist entry still matches a real route (no stale exceptions)" |

### V5 File Handling

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V5.2/5.3 | Upload limits, type checks, storage outside web root | N/A | No file upload exists (no multer/busboy; JSON only) | — | — |
| V5.4 | Safe downloads | Impl | Export filename built from the validated report key and a timestamp (`reports/service.ts:433`); `Content-Disposition: attachment`, `no-store` (`reports/routes.ts:77-79`); Owner only + TOTP step-up | — | `reports.api` "R2-02 step-up: no code → 403 STEP_UP_REQUIRED; wrong code → 400; good code works for 10 min; all denials audited" |

### V6 Authentication

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V6.1 | Authentication controls and their values are documented | Part | Limiter design documented in `identity/limits.ts:1-36`. **Weak:** the IMPL-LOCKOUT change (sign-in no longer sets the account lock) has no decision record, and the config comment is stale (`be/config/index.ts:354-355`, H-05) | Record the Owner decision on lockout and limiter values in `docs/decisions.md`; update the comment | Doc check only |
| V6.2-a | Password length ≥ 12 (≥ 8 allowed); long passwords allowed; no composition rules; no silent truncation | Impl | `NewPasswordSchema` min 12, ≤ 72 UTF-8 bytes refused rather than truncated (`identity/routes.ts:77-85`); no composition rules | — | `securityVerification` "rejects passwords exceeding 72 UTF-8 bytes to guard against silent bcrypt truncation", "correctly handles multibyte UTF-8 input based on byte length" |
| V6.2-b | Refuse common or breached passwords | **Miss** | No list check anywhere (searched `backend/src`, `frontend/src`) | Ship an offline top-10k common-password list; refuse matches (case-insensitive) in `NewPasswordSchema` with a clear message; mirror the rule in `fe/lib/passwordPolicy.ts` | Proposed: "password change to a top-list password answers 400 VALIDATION_ERROR" |
| V6.2-c | Changing a password needs the current password | Impl | `verifyCurrentPassword` counts toward the re-authentication lock (`identity/routes.ts:930-934`) | — | `auth.api` "E-05: wrong current passwords on /password/change count toward the lockout (429 RATE_LIMITED once locked)" |
| V6.3-a | Brute-force and credential-stuffing controls | Part | Failures-only buckets per (email, IP), per IP, plus a per-account progressive delay (never a refusal) (`identity/limits.ts:106-188`, `routes.ts:144-152`); TOTP factor lock; nginx `auth` zone. **Weak:** memory store (restart, deploy or a second replica resets/doubles it, F-06); a success does not reset the pair bucket (H-02) | One-replica deploy check; Postgres-backed counters later; clear the pair key on success | `auth.api` "E-01/F-04: failures from one address never lock the account…", "F-01: successful sign-ins never count toward the per-IP limit"; `identity.unit` "auth buckets" group; proposed: "a success clears the (email, IP) failure count" |
| V6.3-b | No account enumeration through login or reset | Impl | Identical 401 body for unknown, wrong and deactivated accounts; dummy bcrypt compare (`routes.ts:73,193-226`); reset answers 202 after a fixed minimum time on both paths (`limits.ts:48,194`) | — | `auth.api` "generic failure for unknown email, wrong password and deactivated account", "F-05 + E-06: reset requests are capped per email silently and answer known and unknown emails alike"; CTL-SESS "unknown account and wrong password get the same status and body" |
| V6.3-c | Multi-factor (or equivalent) authentication for L2 access | Part | Owner: mandatory TOTP; pending-2FA sessions confined (`identity/security.ts:131-157`); custom roles holding admin rows need a verified second factor (`middleware/auth.ts:85-87`). **Weak:** Data Entry, Call Center, Developer and custom roles without admin rows use a password only | Owner decision: require TOTP enrolment for every account (the `two_factor_enrollment` flow exists); at minimum record the decision as an accepted risk | `auth.api` "Owner: pending 2FA is restricted…"; proposed: "a non-Owner account with no factor is put into pending_2fa_enrollment" |
| V6.3-d | No default or shared accounts in production | Impl | Seeds refuse production and an unset `NODE_ENV` (`assertSeedAllowed`); the first Owner is created by the bootstrap CLI; dev personas refused by `check-env.sh` | — | `sec3.unit` "SE-4 seed production guard" group |
| V6.4-a | Secure reset, invitation and recovery | Impl | 256-bit tokens, only HMAC stored, 30 min reset / 72 h invite, single use with row lock, earlier links superseded; reset ends all sessions; a password change revokes open links (`identity/routes.ts:951-957,1040-1068`); per-email reset cap; links built from `PUBLIC_APP_URL`, never from Host | — | `setPasswordLinks.api` (7 tests incl. "the raw token is never in logs (log transport), audit rows or outbox payloads"); `auth.api` "E-04 + E-09…", "F-08: an invalid reset link is refused without hashing" |
| V6.4-b | Notify the user when authentication details change | Part | Only "password reset completed" sends a notice (`notifications/templates.ts:49`). **Missing** for an in-session password change, 2FA enrolment, recovery-code use or regeneration | Queue `security.password_changed`, `security.2fa_enrolled`, `security.recovery_code_used` e-mails through the existing outbox | Proposed: "password change queues one security notice to the account address" |
| V6.5-a | TOTP: secret protection, replay prevention, failure lock | Impl | Secret AES-256-GCM encrypted with employee-id AAD (`identity/secretBox.ts`, `twoFactor.ts:31-51`); one use per time step (`security.ts:189-195`, `routes.ts:343-356`); 5 failures lock the factor and end the pending session | — | `identity.unit` "rejects a replayed code (time step already used)", "locks the factor and ends the pending session at the 5th failure"; `sec3.unit` "binds the ciphertext to the employee id (AAD) and detects tampering" |
| V6.5-b | Recovery codes: high entropy, hashed, single use | Impl | 10 characters from a 31-symbol alphabet (~49 bits), `crypto.randomInt`, bcrypt cost 10, consumed under `FOR UPDATE` (`twoFactor.ts:168-234`) | — | `sec3.unit` "codes are 10 unambiguous characters, grouped, and normalise case/dash/space" |
| V6.8 | Federated identity provider | N/A | No SSO/IdP | — | — |

### V7 Session Management

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V7.2-a | Random tokens; server-side validation per request | Impl | 256-bit token, only HMAC stored, looked up on every request; account status re-read each time; cookie-only transport (`identity/sessions.ts:36-66`, `middleware/auth.ts:74-133`) | — | `security.test` "stores only a keyed hash, and CSRF tokens differ per session and nonce"; `identity.unit` "ignores the Authorization: Bearer header (cookie-only transport)" |
| V7.2-b | New token on authentication and on privilege change | Impl | Fresh session at login; rotation after 2FA (`sessions.ts:103-118`); token rotated on password change (`routes.ts:958-964`); a role change ends sessions | — | `identity.unit` "rotates the session on success: old session ended, new cookie, no token in the body"; `auth.api` "E-04 + E-09…" |
| V7.3 | Idle and absolute timeouts | Impl | Idle 2 h, absolute 12 h, pending-2FA 10 min (`config/index.ts:345-347`, `security.ts:66-87`); values are working defaults awaiting Owner approval | Record approval of IMPL-SESSION values | `security.test` "session expiry (idle + absolute + pending window)" group |
| V7.4 | Termination: logout, sign out everywhere, deactivation, credential change | Impl | Logout ends the server session; revoke-all; deactivation ends sessions on the next request; reset ends all; password change ends the others | — | `identity.unit` "denies a deactivated account on its next request and ends the session"; `auth.api` "non-owner login: cookie only, CSRF required for logout, session ends" |
| V7.5-a | Re-authentication before sensitive actions | Impl | Current password for 2FA enrolment, enrolment-token issuance and password change; TOTP step-up ≤ 10 min for report export (`reports/service.ts`, `identity/routes.ts:365`) | — | `reports.api` "R2-02 step-up…" |
| V7.5-b | Users can view and end individual active sessions | Part | `POST /api/auth/sessions/revoke-all` only (keep-current option) | `GET /api/auth/sessions` (created, last active, user agent) and revoke-one, Profile UI | Proposed: "a user lists own sessions only and ends one; that cookie then answers 401" |

### V8 Authorization

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V8.1 | Authorisation rules documented | Impl | `docs/security/authz-matrix.md` mirrored by `be/modules/access/matrix.ts`; role catalogue endpoint | — | `rbac.api` "catalog: Owner only; every matrix action with its grantability" |
| V8.2-a | Function-level authorisation (API5) | Impl | `requireAction` on every route, enforced at start-up (`be/shared/access.ts`, `shared/routeGuard.ts`); 0 mismatches over 74 executed probes (E review) | — | `routeGuard.test`; `securityVerification` "rejects requests with wrong role"; `rbac.api` "a holder gets exactly its grants…" |
| V8.2-b | Object-level authorisation (API1, IDOR) | Impl | Access engine + `access_facts` view: 15-day windows, assignment scope, D15 confinement, archived hidden (`access/rules.ts`, `access/service.ts:325`) | — | `access.api` (D9/D15 groups); `access.test` "E-08 / D15…"; `review-h/h-fixes.api` "E-08 / D15: a custom role with deal.read at global scope does not see an unassigned accepted opportunity" |
| V8.2-c | Field-level authorisation and mass assignment (API3) | Impl | `.strict()` bodies refuse unknown or protected keys; `PATCH /employees/me` strips role; limited DTOs for non-Owners (E-07 attendee options) | — | `securityVerification` "rejects forged/untyped policy fields with strict Zod validation errors"; `attendeeOptions.api.test` |
| V8.3-a | Server-side enforcement; admin rows need 2FA; custom roles never hold Owner-only rows | Impl | Admin rows refused while 2FA is pending; S-26 grant refusal (`access/matrix.ts`, `dynamicService`) | — | `rbac.api` "S-26 (E-02): an Owner-only admin row is refused on create (400), whatever the scope", "the four system roles are never widened by role_permissions" |
| V8.3-b | Segregation of duties (no self-approval) | Impl | Self-decision guards on correction approve, remote grant/decide, attendance adjust/retroactive/review (E-03 fixed). H-01 (single-Owner company) is an Owner policy question | Owner decision on H-01 | `reviewFixBeb.api` "E-03…" |

### V9 Self-contained Tokens · V10 OAuth/OIDC

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V9 | JWT/self-contained token validation | N/A | Opaque server-side sessions only; no JWT | — | — |
| V10 | OAuth client/server, OIDC | N/A | Not used | — | — |

### V11 Cryptography

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V11.1 | Key inventory, purpose separation and rotation | Part | TOTP key: id-tagged, previous keys accepted, re-encrypt on read (`config/index.ts:77-110`, `twoFactor.ts:31-42`). **Weak:** `SESSION_SECRET` is the root for session hashing, CSRF, reset-token HMAC and the notification-secret key (HKDF, `notifications/secrets.ts:11-17`), with no rotation path; the TOTP key loader is duplicated (`identity/env.ts` and `config/index.ts`) | Separate HKDF subkeys per purpose; `SESSION_SECRET_PREVIOUS` for verify/decrypt during rotation; rotation runbook in `devops/DEPLOY.md`; one key loader | `sec3.unit` "keyring with previous keys for rotation"; proposed: "after rotation a pending reset link issued under the previous secret still sends, and sessions under it are ended" |
| V11.2/11.3 | Vetted AEAD with unique IVs and integrity | Impl | AES-256-GCM, random 96-bit IV, auth tag, AAD bound to row/employee (`identity/secretBox.ts`, `notifications/secrets.ts`) | — | `sec3.unit` "uses a fresh IV each time", "binds the ciphertext…"; `email.test` "notification secrets: round-trips and is bound to its row id" |
| V11.4 | Password and secret hashing | Impl | bcrypt cost 12 (passwords), 10 (recovery codes), lowered only under `NODE_ENV=test`; HMAC-SHA256 for tokens. Note: bcryptjs is pure JS (CPU on the event loop, F-08), partly mitigated by refusing invalid reset tokens before hashing | Optional: native bcrypt/argon2 or a worker thread | `config.test` "V-02: bcrypt cost can be lowered only under NODE_ENV=test" |
| V11.5 | CSPRNG for all secrets | Impl | `crypto.randomBytes` (sessions, tokens, IVs), `crypto.randomInt` (recovery codes), `crypto.getRandomValues` (CSP nonce) | — | CTL-WEB "nonce has at least 128 bits and differs per call" |
| V11.6 | Public-key encryption of backups | Impl | `age` with the Owner's public key only; private key never on the server (`devops/backup/backupd.sh:13-17,48`) | — | `prod-smoke.sh` backup checks (throwaway key) |

### V12 Secure Communication

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V12.1 | TLS 1.2+ only, strong ciphers, valid certificate | Part | Outer-proxy templates set `ssl_protocols TLSv1.2 TLSv1.3` (`devops/proxy/nginx-outer.conf.example`); certificate from the proxy's own tool. **Unverified:** the real proxy, cipher order and renewal | Apply the Mozilla "intermediate" profile to the vhost; scan after deploy | Post-deploy: external TLS scan grade; `host-monitor.sh` certificate expiry |
| V12.2 | HTTPS only; HSTS; https links | Impl (code) | HSTS 1 y (`security-headers.inc`, helmet); http→https redirect in the template; Secure cookies; `PUBLIC_APP_URL` and `APP_ORIGIN` must be https in production (`config/index.ts:132-151,195-221`) | Verify through the real proxy (residual) | `config.test` "FX-MAIL: PUBLIC_APP_URL…", "C-14: production APP_ORIGIN / CORS_ORIGIN must be canonical https origins" |
| V12.3-a | TLS on internal service connections | Part | DB and nginx→app hops are plain TCP on the `internal: true` Docker network on one host (`docker-compose.prod.yml` networks) | Record as an accepted single-host risk, or enable Postgres `ssl=on` with `sslmode=verify-full` | Proposed: runtime check "`pg_stat_ssl.ssl` is true for the app connection" if TLS is chosen |
| V12.3-b | Outbound TLS with certificate validation | Impl | SMTP `secure` or `requireTLS`, no `rejectUnauthorized: false` anywhere (`notifications/transport.ts:169-179`) | — | `email.test` "email config: no real send" group |

### V13 Configuration

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V13.2-a | Least-privilege database runtime account | Impl | `udigity_api` is a member of `udigity_app`: no DELETE on business/history tables, append-only audit (migration `998_review_integrity.sql`, `devops/postgres/init/10-app-role.sh`); start-up and `/readyz` refuse an owner/superuser role (`be/shared/runtimeRole.ts`, `be/index.ts:9`) | — | `runtimeRole.test` "review D-01/D-02 (D20): udigity_app cannot hard-delete business/history rows…", "UDI-6 guard…", "…prohibited from ALTER, DROP, or disabling triggers" |
| V13.2-b | Least privilege for migration/admin accounts | Part | Migrations use separate credentials (`migrate.env`, only in the migrate job), but that account is the cluster superuser `POSTGRES_USER` | Non-superuser schema-owner role for migrations; superuser only for init | Proposed: `check-env-selftest.sh` case "MIGRATION_DATABASE_URL user is not a superuser" |
| V13.2-c | Outbound connections restricted (API7 / SSRF) | Part | Only the worker has an egress network (`docker-compose.prod.yml` `egress`); the office DNS resolver only resolves names and never returns results (E-10, `attendance/officeDns.ts`). **Weak:** egress is not limited to the SMTP host and port | Host firewall rule (DOCKER-USER) allowing only the SMTP destination from 172.29.30.0/24; optional: refuse private/loopback DNS results | `officeDns.test` "validates hostname syntax"; proposed post-deploy: "from the worker, a non-SMTP destination is refused" |
| V13.3 | Secrets management | Part | Secrets only in `*.env` files (mode 600 checked, `devops/scripts/check-env.sh:46`); placeholders and weak values refused (`check-env.sh:94-102`, `config/index.ts:153,276-281`); not in images (`.dockerignore`); gitleaks in CI; history clean (E-12). **Weak for L2:** no vault; plain files on a shared VPS | Docker secrets/root-owned files mounted read-only; record "files on host" as accepted residual; keep offline copies (DEPLOYMENT-CHECKLIST §5) | `config.test` "rejects the example placeholder secret in production"; `check-env-selftest.sh` (CI) |
| V13.4 | No debug features or internal details exposed | Impl | `NODE_ENV` fails closed to production (`config/index.ts:247-250`); stacks only in development logs; health endpoints 404 at the edge; `/readyz` body generic; test-support routes only under test; personas blocked in production | (Next banner: see V3.4-b) | CTL-ERR "/readyz body is generic (status only)"; `config.test` "treats an unset or unknown NODE_ENV as production" |
| V13-cont | Container hardening (non-root, read-only, no capabilities) | Part | backend, worker, frontend, migrate, backup: non-root, `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, memory/CPU/pid caps; images pinned by digest; only nginx publishes a port, on 127.0.0.1. **Weak:** the nginx service has no `cap_drop`/`read_only` and runs its master as root; `db` keeps default capabilities | nginx: `cap_drop: [ALL]` + minimal `cap_add`, `read_only: true` + tmpfs (`/var/cache/nginx`, `/var/run`), or `nginx-unprivileged`; db: drop unneeded capabilities after testing | CTL-OPS "app containers run as non-root, read-only…" (passes), "only nginx publishes a port, on loopback by default" (passes), **"the nginx edge container drops capabilities too" (failing now)** |

### V14 Data Protection

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V14.1 | Sensitive data identified and classified | Part | Threat model (`docs/security/threat-model.md`) covers secrets and tokens; there is no inventory of personal data (employee e-mail/phone, business contacts, call notes, attendance IPs) with retention | Add a data inventory table (field, class, retention, who can read) | Doc check |
| V14.2-a | Sensitive data not in URLs or logs | Part | Reset/invite token in the query string, mitigated by inner-nginx log redaction (`nginx.conf:29-40`), `no-referrer` on reset pages, single use, 30 min, and log-transport redaction. **Weak:** `devops/proxy/*.example` define no redaction, so the outer proxy logs the token | Redacting `log_format` (or `access_log off` for `/reset-password`) in every outer template; longer term carry the token in the URL fragment | **CTL-OPS (failing now):** "outer-proxy template keeps reset tokens out of its access log"; `prod-smoke.sh` "access log redacts ?token=" (inner) |
| V14.2-b | No caching of sensitive responses | Impl | `Cache-Control: no-store` on every `/api` response (`be/app.ts:77-80`) and on exports | — | CTL-HDR; `shared.test` "answers unknown API paths with the JSON error shape and no-store" |
| V14.3 | Client-side data minimised and cleared on logout | Part | Nothing sensitive in local storage (theme only, `fe/lib/theme.tsx`); session cookie HttpOnly. **Weak:** no `Clear-Site-Data` on logout, so the browser cache and in-memory state rely on the SPA's own clean-up | Send `Clear-Site-Data: "cache", "storage"` on logout and revoke-all | Proposed: "logout response carries Clear-Site-Data" |
| V14-bkp | Backups confidential, available and restorable | Part | Encrypted dumps, base backups and WAL (age); read-only backup role (`20-backup-role.sh`); growth guards. **Weak:** same-server storage (S-23 accepted); raw WAL waits up to a minute unencrypted in the `wal_archive` volume; restore drill not yet done | Off-server encrypted copy; run drills (a) dump and (b) PITR before go-live (DEPLOYMENT-CHECKLIST §7) | Drill log in `devops/DEPLOY.md` |

### V15 Secure Coding and Architecture

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V15.2-a | Dependencies pinned and checked for known vulnerabilities | Part | `package-lock.json` + `npm ci`; `npm audit --audit-level=high` blocking in CI (`.github/workflows/ci.yml`); 0 vulnerabilities at `cab5ec9` (E-12); base images pinned by digest. **Weak:** CI jobs do not start (account billing), so the gate does not run today; no image or SBOM scan; `apk add` unpinned in Dockerfiles | Restore CI or run the same gate locally on the exact deploy commit; add a Trivy/Grype scan of the three images and an SBOM step; pin `apk` packages | CI `verify` job "Security audit (high and critical, all dependencies) - blocking" |
| V15.2-b | Build and CI supply-chain hardening | Part | Workflow `permissions: contents: read`; every action pinned by SHA; gitleaks image pinned by digest. **Weak:** `npm ci` runs install scripts (Dockerfiles, CI); `actions/checkout` keeps the token in `.git/config` | `npm ci --ignore-scripts` then `npm rebuild` only for the packages that need it; `persist-credentials: false` on every checkout | **CTL-OPS (failing now):** "CI checkout does not persist the GitHub token"; proposed: "Docker build succeeds with --ignore-scripts" |
| V15.3 | Defensive coding (mass assignment, prototype safety) | Impl | Strict schemas (see V8.2-c); no dynamic object merging of request bodies into SQL; column whitelists | — | `rbac.api` "grants are validated against the matrix…" |
| V15.4 | Safe concurrency (TOCTOU, races) | Impl | `FOR UPDATE` on tokens, factors and recovery codes; advisory locks; unique partial indexes; idempotency records; lease-owned job completion | — | E review: 6 parallel completions of one reset token give exactly one 200; `reviewFixBeb.api` "D-07: completion only applies while the claim lease is still ours" |

### V16 Security Logging and Error Handling

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V16.2 | Structured logs with time, source and correlation id | Part | Request id on every response and log line (`requestGuards.ts:8-14`); Docker json-file adds timestamps. **Weak:** free-text `console.*` lines, no log inventory | Structured JSON logger (e.g. pino) with UTC time, request id, event name; list log sources in `devops/README.md` | Proposed: "an API error log line parses as JSON with requestId and time" |
| V16.3-a | Security events recorded in a tamper-resistant audit trail | Impl | `audit_events` for sign-in success/failure, session creation/rotation/revocation, 2FA failures, password change/reset, role/permission and status changes, step-up denials, hidden-record reads; append-only trigger, no UPDATE/DELETE grant | — | `auth.api` "audit rows cannot be updated or deleted"; `runtimeRole.test` "…UPDATE, DELETE, and TRUNCATE are prohibited" |
| V16.3-b | Alerting on abuse; authorisation failures recorded | Part | Ops alerts for 500s and crashes (`errorHandler.ts:96-99`, `shared/crash.ts`); `host-monitor.sh`. **Weak:** no alert on failed-sign-in or factor-lock surges; generic 403 denials are not recorded | Ops alert when per-IP/per-account failure counters or factor locks cross a threshold; audit denied admin-row and step-up attempts | `opsAlert.api` "one row per kind per window…"; proposed: "N failed sign-ins in a window raise one auth.abuse ops alert" |
| V16.4 | Logs protected; no secrets or tokens logged | Impl | Tokens redacted in log transport and nginx; ops alerts carry the route pattern only, never the query string (`errorHandler.ts:28-29`); log rotation 10 MB × 5 | Off-host log copy (residual, optional) | `setPasswordLinks.api` "the raw token is never in logs…"; `opsAlert.api` "an unexpected API error records api.error:<route> with the route pattern, not the query string"; `email.test` "log transport writes one redacted line…" |
| V16.5 | Generic errors; fail closed on exceptions | Impl | Shared error contract; DB input errors → 400, timeouts → 503 `BUSY_TRY_AGAIN`, no stack to clients (`errorHandler.ts`); process exits and restarts on an unhandled error (`shared/crash.ts`); access engine denies by default | — | `fixBeA` "maps client-input data errors to 400 and lock/statement timeouts to 503 BUSY_TRY_AGAIN"; `shared.test` "default engine denies every resource and scopes lists to FALSE"; CTL-ERR (3 tests) |

### V17 WebRTC

| Id | Requirement (short) | Status | Control & evidence | Fix | Verifying test |
|---|---|---|---|---|---|
| V17 | WebRTC / TURN security | N/A | Not used | — | — |

---

## Cross-reference: OWASP Top 10:2025 and API Security Top 10 2023

| Category | Rows | Overall |
|---|---|---|
| A01 Broken Access Control / API1 BOLA, API3 BOPLA, API5 BFLA | V8.*, V3.5-a, V4.3-b | Strong (executed matrix, route guard at start-up) |
| A02 Security Misconfiguration / API8 | V3.4-b, V13.2-b, V13-cont, V13.4, V12.3-a | Partial: nginx container, migration superuser, banners |
| A03 Software Supply Chain Failures | V15.2-a/b | Partial: gate not running, install scripts, no image scan |
| A04 Cryptographic Failures | V11.*, V12.*, V14.2-a | Mostly strong; key separation/rotation and outer log are gaps |
| A05 Injection | V1.* , V2.2-a | Strong; meetings validation gap |
| A06 Insecure Design / API6 | V2.3, V2.4, V8.3-b | Strong; bulk-command limiter missing |
| A07 Authentication Failures / API2 | V6.*, V7.* | Partial: MFA for staff, breached-password check, memory-backed throttling |
| A08 Software or Data Integrity Failures | V15.2-b, V14-bkp | Partial |
| A09 Security Logging and Alerting Failures | V16.* | Partial: no abuse alerting, unstructured logs |
| A10 Mishandling of Exceptional Conditions | V16.5, V4.1 | Strong |
| API4 Unrestricted Resource Consumption | V4.3-a, V2.4, V6.3-a | Partial (`page` unbounded, memory limiters) |
| API7 SSRF | V13.2-c | Low exposure (DNS only); egress not restricted |
| API9 Improper Inventory Management | V4.3-b | Strong |
| API10 Unsafe Consumption of APIs | V12.3-b (SMTP only) | Strong (no other third-party APIs) |

## Housekeeping noted during the review (not scored)

- Stray encrypted backup drill folder `CUsersHaniAppDataLocalTemp/` in the working tree (E-11): ignored by git and not
  copied into images (the Dockerfiles copy only `backend/` and `frontend/`). Delete it locally once confirmed as drill output.
- `devops/nginx/nginx.conf` comment "the backend locks an account after 5 failures anyway" is out of date since E-01
  (same root cause as H-05).
