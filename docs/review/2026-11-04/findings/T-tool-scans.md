# T: Automated tool scans (SAST, dependencies, secrets, containers, CI, headers) — 2026-11-04

Agent T (security tooling). Discovery only: no source file, config or branch was changed. Tested commit `1644e29` on `review/2026-11-04-fixes`, working tree clean for source (other agents' review files untracked).
Raw outputs are in the scratch dir `C:\Users\Hani\AppData\Local\Temp\claude\a25399f2550b68da\b1ed2321-d7ef-454b-bbf7-54f33e576861\scratchpad\scan\` (`semgrep.json`, `audit-*.json`, `osv-api.json`, `gitleaks-*.json`). No secret values appear in this file. Nothing was suppressed in any config; every result is triaged below.

## Summary

| Area | Tool | Raw result | True positives |
|---|---|---|---|
| SAST | Semgrep 1.183.0 (pip, Windows wheel) | 9 results (3 `tainted-sql-string`, 2 `gcm-no-tag-length`, 4 `request-host-used`), 7 partial-parse notices | 1 Low (T-01, 2 locations); 8 false positive / accepted |
| Dependencies (prod) | `npm audit --omit=dev` root + e2e | **0** vulnerabilities (root 211 prod deps; e2e 1) | 0 |
| Dependencies (dev) | `npm audit` root + e2e | root **16 moderate** (all one root cause: `minimatch` ReDoS GHSA-g3hv-75wg-m249 via the eslint toolchain); e2e 0 | 0 reachable at runtime (dev only) |
| Dependencies (cross-check) | OSV.dev API `querybatch`, all 757 lockfile packages | root: 2 packages (minimatch 10.2.6, 3.1.5; same advisory); e2e: 0 | same as above |
| Secrets | gitleaks 8.21.2: full history (30 commits), working tree (tracked+untracked, with and without `.gitleaks.toml`), built artifacts | **0 leaks** in all four runs; no server env name or value in client bundles | 0 |
| Containers/config | Trivy NOT available (see Limitations); manual review of 3 Dockerfiles, 3 compose files, nginx | n/a | 2 Low, 2 Info (T-02, T-03, T-05, T-06) |
| GitHub Actions | actionlint (latest image), zizmor 1.32.0 (offline mode) | actionlint 0; zizmor 5 `artipacked` (medium, confidence low) | 1 Low (T-04) |
| Headers/CSP | manual (CSP Evaluator rules) | strong; 3 minor gaps | 2 Info/Low (T-05, T-07) |

Overall: no Critical, High or Medium finding from tooling. 1 Low defence-in-depth issue in crypto code, a handful of hygiene items. The supply chain, secrets hygiene and CSP are in good shape.

## Tools, versions, exact commands

| Tool | Version | Command (cwd = repo root unless noted) |
|---|---|---|
| Semgrep | 1.183.0 (`pip install semgrep` into a venv in the scratch dir; Docker image pull failed, see Limitations) | `cd <scratch>/scan/tree && PYTHONUTF8=1 semgrep scan --config p/owasp-top-ten --config p/javascript --config p/typescript --config p/nodejs --config p/react --config p/expressjs --config p/secrets --config p/sql-injection --config p/xss --config p/command-injection --config p/jwt --config p/dockerfile --config p/github-actions --metrics=off --json -o semgrep.json --exclude node_modules --exclude .next --exclude dist --exclude docs --exclude .agents --exclude .claude --exclude .codestudio --exclude .hermes --exclude assets .` — the `tree` dir is a copy of `git ls-files -co --exclude-standard` (515 files scanned, 605 community rules). Pack note: the requested `p/express` does not exist; the registry name is `p/expressjs` (used). All other 12 packs resolved. |
| npm audit | npm 10.4.0 | `npm audit --omit=dev --json`, `npm audit --json` at root and in `e2e/` (first attempt hit a transient DNS failure `EAI_AGAIN`; retried, all four succeeded) |
| OSV | OSV.dev REST API (`https://api.osv.dev/v1/querybatch`) over every non-root entry of both lockfiles (script `scan/osv.mjs`) — substitute for osv-scanner, whose image could not be pulled |
| Lockfile checks | node script over `package-lock.json` / `e2e/package-lock.json`: `integrity`, `resolved` host, `hasInstallScript`; `npm view <pkg> version` for latest versions |
| gitleaks | zricethezav/gitleaks:v8.21.2 (already local) | history: `docker run --rm -v <repo>:/repo:ro -v <scratch>:/out zricethezav/gitleaks:v8.21.2 git /repo --config /repo/.gitleaks.toml --redact --no-banner -r /out/gitleaks-history.json`; tree: same image, `dir /s/tree --config /s/gitleaks.toml` and again with no config (default rules only, no allowlist) |
| Built-artifact grep | grep | `grep -rlE "SESSION_SECRET|TOTP_ENC_KEY|DATABASE_URL|SMTP_PASS|postgres://|INTERNAL_API_URL|SESSION_COOKIE_NAME" frontend/.next/static` and the same inside image `udigity-frontend:latest` (`/app/frontend/.next/static`, via `docker run --entrypoint sh`, nothing started on a port) |
| actionlint | rhysd/actionlint:latest | `docker run --rm -v <repo>/.github:/repo/.github:ro rhysd/actionlint -color=false /repo/.github/workflows/ci.yml` |
| zizmor | 1.32.0 (pip, scratch venv) | `zizmor --no-progress .github/workflows/ci.yml` (offline mode: online audits such as known-vulnerable actions and impostor-commit checks did not run) |

## Limitations (what did not run)

- **Docker Hub / ghcr.io pulls failed twice** (`lookup registry-1.docker.io: no such host`, `context deadline exceeded`; Docker Desktop's DNS, while the host's DNS worked). Not run: `semgrep/semgrep` image (replaced by the pip wheel), `aquasec/trivy` (config and image scan), `ghcr.io/google/osv-scanner` (replaced by the OSV API), `ghcr.io/woodruffw/zizmor` (replaced by the pip wheel). **Trivy config/image scanning therefore did not run**; section "Container and config review" is a manual review against the same check families (root user, healthcheck, privileges, pinning). Existing local images (`udigity-backend:latest`, `udigity-frontend:latest`, ...) were not image-scanned.
- Semgrep could not fully parse 7 files (`devops/frontend.Dockerfile`, and 6 TSX pages with a bare `&` in JSX text: `delivery-monitor/page.tsx:129`, `reports/page.tsx:94`, `settings/page.tsx:258`, `settings/roles/page.tsx:150`, `targets/page.tsx:217`, `ProjectBoard.tsx:376`). Those are valid TSX/Dockerfile (a Semgrep grammar limitation); the unparsed region of those files was covered by the manual greps below, not by rules. Semgrep scanned the repo copy without `docs/` (docs hold only markdown/scripts for design export, out of scope per the brief).
- `docs/design-exports` and `docs/phase6` were excluded as instructed. Semgrep was not authenticated (`semgrep login` would add Pro/extra registry rules).
- The `frontend/.next` found locally is a build from another agent; the grep of it and of the image's `.next/static` are the artifact checks. `backend/dist` was inspected for env names (server-side only, expected).

## Triage tables

### Semgrep (9 results)

| Rule | Location | Verdict | Reason | Fix |
|---|---|---|---|---|
| `javascript.node-crypto.security.gcm-no-tag-length` | `backend/src/modules/identity/secretBox.ts:34` | **True positive (Low)** → T-01 | `setAuthTag(...)` on a decipher created without `authTagLength`; Node then accepts truncated tags (4 to 16 bytes) | see T-01 |
| `javascript.node-crypto.security.gcm-no-tag-length` | `backend/src/modules/notifications/secrets.ts:34` | **True positive (Low)** → T-01 | same pattern (SMTP password decrypt) | see T-01 |
| `...tainted-sql-string` | `backend/src/modules/businesses/repo.ts:591` (`mPhone`), `:594` (`mSocial`), `:598` (the count query) | **False positive** | The interpolated parts are (a) placeholders `$n` returned by `SqlParams.add()` (`shared/sql.ts`), whose values go in `p.values`; (b) the constant `LIKE_ESCAPE = '\'` (repo.ts:499); (c) `q.scope`, assembled in `businesses/service.ts:629` from the access-scope filter that also uses `SqlParams`. User text (`q.name`, phone, handle) is passed through `escapeLike()` and bound as a parameter | none; keep the "identifiers come from whitelists" rule in `shared/sql.ts` |
| `...request-host-used` | `devops/nginx/conf.d/proxy-common.inc:2` (`proxy_set_header Host $host`) and `:10` (`X-Forwarded-Host $host`) | **Accepted risk / false positive** | `$host` is only ever the value matched by `server_name hrsystem.udigity.com` in `devops/nginx/conf.d/udigity.conf`; the default server returns 444 for any other Host (`udigity.conf:8-13`), so a spoofed Host cannot reach the app | none |
| `...request-host-used` | `devops/proxy/nginx-outer.conf.example:13` (`return 301 https://$host$request_uri`) and `:31` (`proxy_set_header Host $host`) | **Accepted risk** | Example for the host's outer proxy; its `server_name` is `hrsystem.udigity.com` (a catch-all vhost on the VPS could still redirect with a foreign Host; that is a property of the existing server, see T-06) | optional: use the literal `hrsystem.udigity.com` in the 301 |

Semgrep rules found nothing on: command injection (no `child_process` use in `backend/src` or `frontend/src`), `eval`/`new Function`, `innerHTML`, `jwt` (the app uses opaque server sessions, no JWT), CORS, open redirects, hard-coded secrets, XSS in React (the single `dangerouslySetInnerHTML`, `frontend/src/lib/theme.tsx:36`, injects a constant script that carries the CSP nonce: not exploitable), path traversal (`fs.readFileSync` only reads migration files by listing the migrations dir), insecure cookies, and Dockerfile/GitHub-Actions packs (0 findings).

Supplementary manual greps backing the Semgrep run (same scope): no `Math.random` for secrets (the only use is the non-secure-context fallback of `newIdempotencyKey()`, `frontend/src/lib/api/client.ts:109`, false positive: it is an idempotency key, not a credential); all secret/token material uses `crypto.randomBytes`; no MD5/SHA-1; no `rejectUnauthorized: false`; dynamic SQL is limited to the `SqlParams` builder with whitelisted sort columns (`orderByClause(..., WHITELIST, default)`) and whitelisted `SET` columns (`attendance/repo.ts:258-270` throws on unknown fields); `SET LOCAL statement_timeout = ${Number(...)}` (`reports/service.ts:379`) is numeric-coerced. `backend/src/db/seed.ts` contains the dev password `Password123!` but refuses to run unless `NODE_ENV` is development or test (`seed.ts:20-25`): false positive for production.

### Dependencies

| Advisory | Package (installed) | Prod/dev | Verdict | Reason | Fix |
|---|---|---|---|---|---|
| GHSA-g3hv-75wg-m249 (minimatch ReDoS via globparts amplification) | `minimatch` 3.1.5 and 10.2.6 → 15 dependents (eslint, @eslint/*, @typescript-eslint/*, eslint-plugin-import/react/jsx-a11y, eslint-config-next, typescript-eslint) = the **16 moderate** | dev only (lint toolchain) | **Accepted risk** | Not in the production dependency graph (`npm audit --omit=dev` = 0) and not in any image: both Dockerfiles run `npm ci --omit=dev` for the runtime stage; patterns come from the repo's own eslint config, not from users. CI runs `npm audit --audit-level=high` (blocking), which passes | upgrade `eslint`/`eslint-config-next` when a release depends on a patched minimatch; `npm audit fix --force` proposes semver-major downgrades (eslint 4, eslint-config-next 0.2.4) and must NOT be run |
| none | e2e (26 packages) | dev | 0 vulnerabilities | | |

Supply-chain checks:
- Lockfiles are v3; every package entry has `integrity` (the only two "missing" entries are the workspace roots `backend`/`frontend`, which are links). All `resolved` URLs are `https://registry.npmjs.org/`. No git/tarball/http dependencies. No `.npmrc` overrides. No typosquat-looking names among the 9 backend and 15 frontend direct dependencies (all well-known packages; `otplib`, `bcryptjs`, `nodemailer` are the real maintainers' packages by name and version history).
- Install scripts (`hasInstallScript`): only `esbuild@0.28.2`, `fsevents@2.3.3`, `unrs-resolver@1.12.2`, all **dev** transitive (tooling/test); none in production. e2e: none. Dockerfiles install with `--omit=dev` for the runtime stage; CI runs `npm ci` (scripts enabled) for the dev toolchain only. Consider `--ignore-scripts` for the production `npm ci` (it has no needed scripts) as hardening: see T-04's note.
- Security-relevant versions vs npm "latest" today:

| Package | Locked | Latest | Verdict |
|---|---|---|---|
| express | 4.22.3 | 5.3.0 | one major behind; 4.x still receives fixes and has no open advisory. Info: plan the 5.x move after launch |
| helmet | 8.3.0 | 8.3.0 | current |
| cookie-parser | 1.4.7 | 1.4.7 | current |
| pg | 8.23.1 | 8.23.1 | current |
| bcryptjs | 3.0.3 | 3.0.3 | current |
| zod | 4.6.7 | 4.6.7 | current |
| next | 16.4.2 | 16.4.5 | 3 patch releases behind (`^16.4.2` allows it; lockfile pins 16.4.2). No OSV advisory for 16.4.2, but security-sensitive framework: bump (T-08) |
| react / react-dom | 19.3.1 | 19.3.1 | current |
| nodemailer | 10.2.1 | 10.3.1 | minor behind; no advisory; bump with next lockfile refresh (T-08) |
| otplib | 12.0.1 | 13.6.0 | one major behind; no advisory; v12 is the long-stable API. Info |
| express-rate-limit / cors / dotenv | 7.5.1 / 2.8.6 / 16.6.1 | not checked for latest | no advisories |

### Secrets

| Scan | Result |
|---|---|
| gitleaks, full git history, repo config (`.gitleaks.toml`: default rules + 5 reviewed allowlisted literals: a Figma file key, two Figma example keys, a fixed test UUID, a dummy sequential TOTP key) | 30 commits scanned, **no leaks**, report `[]` |
| gitleaks, working tree (tracked + untracked, excluding ignored/`node_modules`) with repo config | no leaks |
| same, **default rules, no allowlist** | no leaks (so the allowlist hides nothing; the five values are not detected by default rules anyway) |
| Tracked env files | only `*.env.example` and `backend/.env.example`; `frontend/.env.local` is ignored by `.gitignore:7 **/.env.*`; `.dockerignore` excludes `**/.env*`, `devops/env/*.env`, `.git`, `docs`, `e2e` from the build context |
| Client bundle (`frontend/.next/static` local build, and `/app/frontend/.next/static` in image `udigity-frontend:latest`) | **no** `SESSION_SECRET`, `TOTP_ENC_KEY`, `DATABASE_URL`, `SMTP_PASS`, `postgres://`, `INTERNAL_API_URL` or `SESSION_COOKIE_NAME`. Only `NEXT_PUBLIC_CSRF_COOKIE_NAME` / `NEXT_PUBLIC_PASSWORD_MIN_LENGTH` are inlined by design; the image has no secret env vars baked in |
| `backend/dist` | contains the env var names (`DATABASE_URL`, `SESSION_SECRET`, `TOTP_ENC_KEY`, `SMTP_PASS` ...) only as `process.env.X` lookups in server code: expected, false positive |

### Containers and configuration (manual, Trivy did not run)

| Check family | Location | Verdict | Reason | Fix |
|---|---|---|---|---|
| Image pinned by digest | all Dockerfiles, compose, CI | Pass | node, postgres, nginx all `@sha256:` | none |
| Non-root user | `backend.Dockerfile:46`, `frontend.Dockerfile:56` (`USER node`), `backup.Dockerfile` (`USER postgres`); compose `user: "1000:1000"` | Pass | | none |
| Healthcheck | backend, frontend, db, backup, nginx, worker | Pass | | none |
| Read-only root FS, `cap_drop: [ALL]`, `no-new-privileges`, mem/cpu/pids limits | backend, worker, migrate, frontend, backup | Pass | | none |
| Same hardening on `db` and `nginx` | `docker-compose.prod.yml` db, nginx | Low / accepted | `db` keeps default capabilities and a writable FS (required by the postgres entrypoint, which `chown`s `/wal`); `nginx` runs its master as root without `cap_drop`/`read_only` (stock nginx image; bound to 127.0.0.1 only) | optional: `cap_drop: [ALL]` + `cap_add: [CHOWN, SETUID, SETGID, NET_BIND_SERVICE]` and `read_only` + tmpfs for nginx → T-02 |
| Secrets in image / build args | Dockerfiles | Pass | only `INTERNAL_API_URL`, `NEXT_PUBLIC_CSRF_COOKIE_NAME`, `NEXT_PUBLIC_PASSWORD_MIN_LENGTH` as ARG (non-secret); `.dockerignore` strips env files | none |
| Network exposure | `docker-compose.prod.yml` | Pass | only nginx publishes a port, bound to `127.0.0.1:${HTTP_PORT}`; `internal: true` network for db/backend/frontend; worker has an egress-only network for SMTP; DB has no published port | none |
| `apk add --no-cache tini` unpinned (hadolint DL3018 style) | `backend.Dockerfile:40`, `frontend.Dockerfile:51` | Info | package index version drifts with rebuilds; base image is digest-pinned | none required |
| Dev compose files | `docker-compose.yml`, `docker-compose.test.yml` | Info | local use; test DB bound to 127.0.0.1:55432 with a throwaway password; not part of production | none |
| `tmpfs: /tmp` without `noexec,nosuid` | prod compose | Info | | add `noexec,nosuid` options |
| nginx | `devops/nginx/**` | Pass with notes | `server_tokens off`; unknown Host → 444; `real_ip` trusts only loopback + RFC1918 172.16/12 (the outer proxy overwrites `X-Forwarded-For`, nginx then overwrites it again with `$remote_addr`); rate limits per IP/session; token values redacted in access logs; health endpoints 404 at the edge; `client_max_body_size 10m`. Gaps: no `proxy_hide_header X-Powered-By` (T-05); HSTS lacks `preload` (fine) | see T-05 |
| Outer-proxy examples | `devops/proxy/*.example` | Pass | TLS 1.2/1.3 only; XFF overwritten with `$remote_addr`; no duplicate security headers | none |

### GitHub Actions (`.github/workflows/ci.yml`, single workflow)

| Check | Result |
|---|---|
| actionlint | no findings |
| Triggers | `push` (main), `pull_request` (not `pull_request_target`), `workflow_dispatch`: Pass. Fork PRs get a read-only token and no secrets; the workflow uses no secrets |
| Untrusted input in `run:` | none; the only `${{ }}` in `run:`/env context are `env.NODE_VERSION` and `runner.temp`; `github.event.label.name` appears only in `if:` | Pass |
| Permissions | top-level `permissions: contents: read`; no job widens it | Pass |
| Action pinning | every action pinned to a full commit SHA with a version comment; service images and the gitleaks image pinned by digest | Pass |
| zizmor `artipacked` x5 (medium, confidence Low) | `ci.yml:32, 62, 123, 179, 226`: `actions/checkout` without `persist-credentials: false` | **True positive, Low** → T-04: the `GITHUB_TOKEN` (read-only) stays in `.git/config` on the runner. Only the `e2e-report` upload step publishes files and it uploads `e2e/playwright-report`, `e2e/test-results` and logs, not `.git`, so there is no leak path today |
| Other | `concurrency` with cancel-in-progress, job timeouts set: Pass. No Dependabot/Renovate config (`.github/` holds only `workflows/`) → part of T-08. CI `npm audit --audit-level=high` is blocking and covers dev deps: Pass |

### Headers and CSP (static evaluation, Google CSP Evaluator rules)

Effective policy on page responses (`frontend/src/lib/csp.ts` via `src/proxy.ts`) plus the edge CSP (`devops/nginx/conf.d/security-headers.inc`); the browser enforces both, so the result is the intersection.

| Directive / header | Value | Evaluator verdict |
|---|---|---|
| `script-src` | `'self' 'nonce-<128-bit per request>' 'strict-dynamic'`, no `unsafe-inline`; `unsafe-eval` only when `NODE_ENV=development` | **Strong** (nonce + strict-dynamic is the recommended pattern; `'self'` and host sources are ignored by CSP3 browsers; nonce is 16 random bytes from Web Crypto, per request). Layout reads it from `x-nonce` and pages render dynamically so the nonce is never cached |
| `object-src` | `'none'` (app and edge) | Pass |
| `base-uri` | `'self'` (app and edge) | Pass (Evaluator would also accept `'none'`) |
| `frame-ancestors` | `'none'` (app and edge) plus `X-Frame-Options: DENY` | Pass |
| `default-src` | `'self'` | Pass |
| `style-src` | `'self' 'unsafe-inline'` | Evaluator does not rate style `unsafe-inline` as a script-execution risk; documented as deliberate (inline `style` attributes for chart sizes). Accepted. Hardening only: move to classes/CSS variables and drop it |
| `img-src` | `'self' data: blob:` | Pass (`data:` images cannot execute script) |
| `connect-src`, `font-src`, `form-action` | `'self'` (+ `data:` for fonts) | Pass |
| `upgrade-insecure-requests` | absent | Info: HSTS (`max-age=31536000; includeSubDomains`, sent by the edge on all locations incl. error responses) covers it |
| `report-uri` / `report-to` | absent | Info: no CSP violation telemetry; add if monitoring is wanted |
| `require-trusted-types-for 'script'` | absent | Optional hardening |
| Other headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy` (no-referrer on `/reset-password`, `/session-ended`; single source at the edge), `Cross-Origin-Opener-Policy: same-origin`, helmet defaults on the API (`app.ts:23`), `x-powered-by` disabled on Express | Pass. Missing: `Cross-Origin-Resource-Policy`/COEP (not needed for this app) |
| Duplicate/conflicting headers | `Permissions-Policy` is sent by both Next (`geolocation=(self)`) and nginx (`geolocation=()`); `X-Frame-Options` and `X-Content-Type-Options` are sent twice | → T-07 |
| `X-Powered-By: Next.js` | `frontend/.next/required-server-files.json` has `"poweredByHeader": true`; nginx does not hide it | → T-05 |

## Findings (README format)

### T-01 · Low · Non-blocker · Confirmed (tool + code read): AES-256-GCM decryption does not pin the authentication tag length

- **Requirement / role:** confidentiality and integrity of stored secrets (2FA TOTP secrets, SMTP password in settings). Applies to any attacker able to alter database rows (or a stolen DB copy being re-written), not to anonymous users.
- **Location:** `backend/src/modules/identity/secretBox.ts:30-37` (`openSecret`, `createDecipheriv('aes-256-gcm', key, iv)` then `setAuthTag`), `backend/src/modules/notifications/secrets.ts:31-38` (`decryptSecret`, same). Encryption side is correct (12-byte random IV, AAD bound to the row, 16-byte tag).
- **Preconditions:** ability to write a ciphertext value into the database and observe whether decryption succeeds; the keys stay secret. Realistic probability is very low.
- **Reproduction:** `semgrep` rule `javascript.node-crypto.security.gcm-no-tag-length` on both files. In Node, when `authTagLength` is not passed to `createDecipheriv`, `setAuthTag` accepts any tag length from 4 to 16 bytes, so a stored value with a 4-byte tag is authenticated with a 2^-32 forgery chance per try instead of 2^-128.
- **Expected vs actual:** the decrypt path should reject any tag that is not 16 bytes; it currently accepts shorter ones.
- **Evidence:** Semgrep output (scratch `semgrep.json`); code excerpts above; no `authTagLength` anywhere in `backend/src` (`git grep authTagLength` returns nothing).
- **Root cause:** Node's default GCM tag-length handling.
- **Proposed fix:** `crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })` in both places, and reject when the decoded tag is not 16 bytes before calling `setAuthTag`. Format `v1.iv.tag.ct` stays unchanged, so existing rows still decrypt.
- **Regression test:** a unit test that seals a value, truncates the tag segment to 4 bytes (valid base64url), and expects `SecretBoxError` / `null`.
- **Verification command and result:** not run (read-only review). After the fix: `npx semgrep scan --config p/javascript backend/src/modules` → 0 `gcm-no-tag-length`.
- **Tested commit:** `1644e29`. **Limitations:** exploitation also needs an oracle; severity kept at Low as hardening.

### T-02 · Low · Non-blocker · Confirmed (manual): `nginx` and `db` containers lack the privilege hardening applied to every other service

- **Location:** `docker-compose.prod.yml` services `nginx` and `db` (no `cap_drop`, no `read_only`; nginx master runs as root).
- **Preconditions:** a remote-code-execution bug in nginx or Postgres (none known in the pinned `nginx:1.27-alpine` / `postgres:17-alpine`).
- **Expected vs actual:** consistent defence in depth. Actual: `no-new-privileges`, memory and pid limits are set, but capabilities are not dropped.
- **Proposed fix:** nginx: `cap_drop: [ALL]`, `cap_add: [CHOWN, SETGID, SETUID, NET_BIND_SERVICE]`, `read_only: true` with tmpfs for `/var/cache/nginx`, `/var/run`, `/tmp` (verify with `devops/scripts/prod-smoke.sh`). db: `cap_drop: [ALL]` + `cap_add: [CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID]` (the entrypoint chowns `/wal`). Test in the smoke stack first.
- **Regression test:** `prod-smoke.sh` passes with the new settings. **Tested commit:** `1644e29`. **Limitations:** Trivy did not run; derived from compose reading.

### T-03 · Info · Non-blocker · Confirmed: production `npm ci` still allows install scripts; `tmpfs` mounts without `noexec,nosuid`

- **Location:** `devops/backend.Dockerfile:25-28` (`npm ci ... --omit=dev`), `devops/frontend.Dockerfile` deps stage; compose `tmpfs: - /tmp`.
- **Detail:** none of the production dependencies has an install script (only dev packages esbuild, fsevents, unrs-resolver do), so `--ignore-scripts` on the prod-deps stage costs nothing and removes the class of "malicious postinstall in a future transitive bump". `/tmp` as `tmpfs` allows exec by default.
- **Proposed fix:** add `--ignore-scripts` to the prod-deps `npm ci`; use `tmpfs: ["/tmp:rw,noexec,nosuid,size=64m"]` (check the app writes no executables there).
- **Tested commit:** `1644e29`.

### T-04 · Low · Non-blocker · Confirmed (zizmor): `actions/checkout` persists the GITHUB_TOKEN in `.git/config`

- **Location:** `.github/workflows/ci.yml:32, 62, 123, 179, 226` (zizmor `artipacked`, 5 results).
- **Preconditions:** a later step (or a compromised dev dependency running during `npm ci`/tests) reading `.git/config`, or someone adding an artifact upload of the workspace root. Token is read-only (`contents: read`).
- **Proposed fix:** add `persist-credentials: false` to each `actions/checkout` `with:` block (the gitleaks job needs only the local clone; nothing pushes).
- **Regression test:** `zizmor .github/workflows/ci.yml` → 0 `artipacked`. **Tested commit:** `1644e29`. **Limitations:** zizmor ran offline (online audits skipped).

### T-05 · Low · Non-blocker · Confirmed (config read): `X-Powered-By: Next.js` is sent to the public

- **Location:** `frontend/next.config.mjs` (no `poweredByHeader: false`; `required-server-files.json` shows `"poweredByHeader": true`); `devops/nginx/conf.d/proxy-common.inc` does not hide it. The Express API already disables it (`backend/src/app.ts:21`).
- **Impact:** discloses the framework to scanners; negligible beyond fingerprinting.
- **Proposed fix:** `poweredByHeader: false` in `nextConfig` (and/or `proxy_hide_header X-Powered-By;` in `proxy-common.inc`).
- **Regression test:** `curl -sI https://hrsystem.udigity.com/login | grep -i x-powered-by` returns nothing (check on the smoke stack). **Tested commit:** `1644e29`. **Limitations:** not tested against a running server (ports 3000/3100/3200 were off-limits); read from the build manifest.

### T-06 · Info · Non-blocker · Confirmed: outer-proxy example redirects to `$host`

- **Location:** `devops/proxy/nginx-outer.conf.example:13` (`return 301 https://$host$request_uri`) and `:31` (Semgrep `request-host-used`; the Apache/Caddy/OpenLiteSpeed examples were not reviewed for this).
- **Detail:** harmless while the vhost's `server_name` is the exact hostname; if an operator turns it into a `default_server` on the shared VPS the 301 would echo a foreign Host.
- **Proposed fix:** write the literal `https://hrsystem.udigity.com$request_uri`.

### T-07 · Info · Non-blocker · Confirmed (config read): duplicate and diverging security headers between Next and nginx

- **Location:** `frontend/src/lib/csp.ts:55-59` (`Permissions-Policy: ... geolocation=(self) ...`, `X-Frame-Options`, `X-Content-Type-Options`) vs `devops/nginx/conf.d/security-headers.inc:5-9` (`geolocation=()`, same XFO/XCTO).
- **Detail:** nginx `add_header` does not replace upstream headers, so the browser gets two `Permissions-Policy` headers (policies are intersected: geolocation ends up disabled; no code uses `navigator.geolocation`, `git grep geolocation` hits only the headers) and doubled XFO/XCTO (`DENY, DENY` is accepted). Not a vulnerability, but two sources of truth.
- **Proposed fix:** drop `geolocation=(self)` to `geolocation=()` in `csp.ts` and keep one source for XFO/XCTO/Permissions-Policy (follow the Referrer-Policy pattern: `proxy_hide_header` the upstream copy). Add `report-to`/`report-uri` if CSP telemetry is wanted.

### T-08 · Info · Non-blocker · Confirmed: dependency freshness and no automated update/alert channel

- **Detail:** `next` 16.4.2 locked vs 16.4.5 latest, `nodemailer` 10.2.1 vs 10.3.1; `express` 4.22.3 (latest major is 5), `otplib` 12 (latest 13). No advisory affects the locked versions today (npm audit prod = 0, OSV = 0 for prod packages). There is no Dependabot/Renovate config, so a future advisory is noticed only when someone runs `npm audit` or CI runs.
- **Proposed fix:** `npm update next nodemailer` (re-run build + tests); add `.github/dependabot.yml` for npm and GitHub Actions (weekly, grouped), or a scheduled `npm audit` workflow. Do not run `npm audit fix --force` (it proposes downgrading eslint to v4).

## Not findings (checked, held up)

Gitleaks clean on history and tree; no server env in client bundles or the frontend image; CSP is nonce-based with `strict-dynamic`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; workflow has least-privilege token, SHA-pinned actions, no `pull_request_target`, no expression injection; production dependency tree has 0 known vulnerabilities (npm audit and OSV agree); lockfile integrity complete, registry-only sources, no production install scripts; dynamic SQL is confined to a parameter builder with whitelisted identifiers; seed with a default password refuses to run in production; containers run non-root with `cap_drop`, read-only FS, limits and digest-pinned images (except as noted in T-02).

## Housekeeping from this run

- Scratch artefacts are under the scratch dir above (including a Python venv with semgrep and zizmor, and a copy of the tracked tree in `scan/tree`). Delete the `scan` folder when the review closes.
- A stray log `D:\semgrep-tmp.log` (one error line from the failed Docker pull) was created outside the scratch dir by mistake and could not be removed by this agent (deletion was blocked by a safety check): please delete it.
- Docker images pulled during the run: `rhysd/actionlint:latest` (small). Container `tender_golick` (gitleaks full-tree scan, now finished) is gone.
