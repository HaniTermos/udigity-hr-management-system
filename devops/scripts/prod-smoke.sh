#!/usr/bin/env bash
# Production-stack smoke test (local only). Brings up docker-compose.prod.yml under its OWN compose project
# ("udigity-smoke") on an alternate loopback port and alternate subnets with dummy secrets, checks the edge as the host's
# outer proxy would see it (plain HTTP on 127.0.0.1, X-Forwarded-For set by the "proxy"), runs the backup service with a
# throwaway age key (dump, base backup, WAL encryption), then tears
# everything down (containers, network, volumes of THAT project only). It never touches udigity-test-db or any
# real devops/env/*.env file: dummy env files and the certificate live in a temp directory.
#
#   devops/scripts/prod-smoke.sh            # HTTP_PORT=18080 by default
#   KEEP=1 devops/scripts/prod-smoke.sh     # leave the stack up for inspection (tear down yourself)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export MSYS_NO_PATHCONV=1
command -v cygpath >/dev/null 2>&1 && ROOT="$(cygpath -m "$ROOT")"
PROJECT=udigity-smoke
export HTTP_PORT="${HTTP_PORT:-18080}"
# Own subnets so the smoke run can sit next to a real stack (which pins 172.29.10-30.0/24).
export UDIGITY_SUBNET_INTERNAL=172.29.110.0/24 UDIGITY_SUBNET_PUBLIC=172.29.120.0/24 UDIGITY_SUBNET_EGRESS=172.29.130.0/24 NGINX_INTERNAL_IP=172.29.110.10
HOST=hrsystem.udigity.com
TMP="$(mktemp -d)"
# Git Bash on Windows: native openssl/docker need a mixed (C:/...) path.
command -v cygpath >/dev/null 2>&1 && TMP="$(cygpath -m "$TMP")"
mkdir -p "$TMP/env"
export UDIGITY_ENV_DIR="$TMP/env" UDIGITY_TAG=smoke
DC=(docker compose -p "$PROJECT" -f "$ROOT/docker-compose.prod.yml")
FAILS=0

pass() { echo "  PASS  $*"; }
fail() { echo "  FAIL  $*"; FAILS=$((FAILS + 1)); }
cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then echo "KEEP=1: stack left running (project $PROJECT)."; return; fi
  echo "== teardown =="
  "${DC[@]}" down -v --remove-orphans >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "== dummy secrets (temp dir, not the repo) =="
DBPW="smoke$(openssl rand -hex 8)"      # owner (migrations)
APPPW="smoke$(openssl rand -hex 8)"     # limited runtime role
cat > "$TMP/env/postgres.env" <<E
POSTGRES_DB=udigity
POSTGRES_USER=udigity_owner
POSTGRES_PASSWORD=$DBPW
APP_DB_USER=udigity_api
APP_DB_PASSWORD=$APPPW
E
cat > "$TMP/env/migrate.env" <<E
MIGRATION_DATABASE_URL=postgres://udigity_owner:$DBPW@db:5432/udigity
E
cat > "$TMP/env/backend.env" <<E
NODE_ENV=production
PORT=5000
TRUST_PROXY=true
TRUSTED_PROXY_CIDRS=172.29.110.10/32
DATABASE_URL=postgres://udigity_api:$APPPW@db:5432/udigity
SESSION_SECRET=$(openssl rand -hex 32)
TOTP_ENC_KEY=$(openssl rand -hex 32)
APP_ORIGIN=https://$HOST
PUBLIC_APP_URL=https://$HOST
POLICY_COMPANY_TIMEZONE=Asia/Beirut
COMPANY_TIMEZONE=Asia/Beirut
SMTP_HOST=
EMAIL_ALLOW_REAL_SEND=false
E
cat > "$TMP/env/frontend.env" <<E
NODE_ENV=production
INTERNAL_API_URL=http://backend:5000
E
# Backup service: a throwaway age key is generated INSIDE the backup image (age-keygen); only the public key is used.
echo "# placeholder until the key exists" > "$TMP/env/backup.env"   # compose parses every env_file before building
echo "== build =="
"${DC[@]}" build || { echo "build failed"; exit 2; }
AGEPUB="$(docker run --rm --entrypoint sh "udigity-backup:smoke" -c 'age-keygen 2>&1 >/dev/null' | sed -n 's/^Public key: //p' | tr -d '\r')"
case "$AGEPUB" in age1*) ;; *) echo "could not generate a throwaway age key"; exit 2;; esac
BKPW="smoke$(openssl rand -hex 8)"
cat > "$TMP/env/backup.env" <<E
BACKUP_DB_USER=udigity_backup
BACKUP_DB_PASSWORD=$BKPW
BACKUP_DB_NAME=udigity
TZ=UTC
BACKUP_TIME=02:30
AGE_RECIPIENT=$AGEPUB
E
echo "== db + migrate =="
"${DC[@]}" up -d --wait db || { echo "db failed"; exit 2; }
"${DC[@]}" --profile tools run --rm migrate || { echo "migrate failed"; exit 2; }
"${DC[@]}" exec -T db sh /docker-entrypoint-initdb.d/20-backup-role.sh >/dev/null 2>&1 || { echo "backup role script failed"; exit 2; }
echo "== up (waits for healthy; backup is checked separately: its healthcheck first runs after 5 min) =="
"${DC[@]}" up -d --wait --wait-timeout 240 --scale backup=0 || { echo "stack did not become healthy"; "${DC[@]}" ps; "${DC[@]}" logs --tail=40 backend worker frontend nginx; exit 2; }
"${DC[@]}" ps

internal() { "${DC[@]}" exec -T backend node -e "fetch('http://127.0.0.1:5000$1').then(async r=>{console.log(r.status);process.exit(0)}).catch(()=>{console.log(0)})"; }
# The "outer proxy": plain HTTP to the loopback port with the public Host and the visitor address in X-Forwarded-For.
# Docker Desktop NATs the peer address outside 172.16.0.0/12, so the client-address checks run on Linux/CI only.
curlk() { curl -s -H "Host: $HOST" -H "X-Forwarded-For: 203.0.113.9" "$@"; }
URL="http://127.0.0.1:$HTTP_PORT"

echo "== checks =="
# DEV-R5: the app role is not a superuser/owner and cannot modify audit_events; the worker has an egress route.
psqlq() { "${DC[@]}" exec -T db psql -U udigity_api -d udigity -Atc "$1" 2>&1; }
[ "$(psqlq "select rolsuper from pg_roles where rolname=current_user")" = f ] && pass "runtime DB role is not a superuser" || fail "runtime DB role is a superuser"
DEL="$(psqlq "delete from audit_events where false")"
echo "$DEL" | grep -qi "permission denied" && pass "runtime role cannot DELETE from audit_events" || fail "runtime role can DELETE from audit_events (psql said: $DEL)"
[ "$(psqlq "select has_table_privilege(current_user,'audit_events','INSERT') and has_table_privilege(current_user,'audit_events','SELECT')")" = t ] && pass "runtime role has INSERT+SELECT on audit_events" || fail "audit_events INSERT/SELECT grant missing"
"${DC[@]}" exec -T worker node -e "require('dns').lookup('example.com',e=>process.exit(e?1:0))" >/dev/null 2>&1 && pass "worker resolves external hosts (egress)" || fail "worker has no external DNS/egress"
"${DC[@]}" exec -T backend node -e "require('dns').lookup('example.com',e=>process.exit(e?0:1))" >/dev/null 2>&1 && pass "backend has no external egress" || fail "backend can reach the internet"
[ "$(internal /healthz | tr -d '\r\n')" = 200 ] && pass "/healthz 200 (internal)" || fail "/healthz internal"
[ "$(internal /readyz | tr -d '\r\n')" = 200 ] && pass "/readyz 200 (internal, DB connected)" || fail "/readyz internal"
W=0; for _ in $(seq 1 12); do W="$("${DC[@]}" exec -T backend node -e "fetch('http://127.0.0.1:5000/health/worker').then(r=>{console.log(r.status)}).catch(()=>console.log(0))" | tr -d '\r\n')"; [ "$W" = 200 ] && break; sleep 5; done
[ "$W" = 200 ] && pass "/health/worker 200 (internal, heartbeat fresh)" || fail "/health/worker = $W"
for p in /healthz /readyz /health/worker; do
  c="$(curlk -o /dev/null -w '%{http_code}' "$URL$p")"; [ "$c" = 404 ] && pass "edge hides $p (404)" || fail "edge exposes $p ($c)"
done
c="$(curlk -o /dev/null -w '%{http_code}' "$URL/login")"; [ "$c" = 200 ] && pass "/login 200 via the bundled nginx (behind-proxy mode)" || fail "/login = $c"
c="$(curl -s -o /dev/null -w '%{http_code}' "$URL/login" -H "Host: evil.example.net")"; [ "$c" = 000 ] && pass "unknown Host gets no answer (444)" || fail "unknown Host answered $c"
# G-02: the visitor address from the proxy must reach nginx's log as $remote_addr (real-ip), and the backend must see it.
if [ "$(uname -s)" = Linux ]; then
  curlk -o /dev/null "$URL/api/auth/me" >/dev/null
  sleep 1
  "${DC[@]}" logs --no-log-prefix nginx 2>/dev/null | grep -q '^203\.0\.113\.9 ' && pass "nginx logs the visitor address from X-Forwarded-For (real-ip)" || fail "real-ip: visitor address not seen by nginx"
else
  echo "  skip  real-ip check (not Linux)"
fi
# G-13: the single-use token must not reach the access log.
curlk -o /dev/null "$URL/reset-password?token=SMOKESECRETTOKEN123&x=1" >/dev/null; sleep 1
LOGS="$("${DC[@]}" logs --no-log-prefix nginx 2>/dev/null)"
echo "$LOGS" | grep -q 'reset-password?token=\[redacted\]' && ! echo "$LOGS" | grep -q SMOKESECRETTOKEN123 && pass "access log redacts ?token=" || fail "access log leaks or lacks the redacted token"
# F-01: logout/2fa-status/me are not in the strict credential zone (25 quick calls, more than the old 10/min zone allowed, must not 429).
n429=0; for _ in $(seq 1 25); do c="$(curlk -o /dev/null -w '%{http_code}' -X POST "$URL/api/auth/logout" -H "Origin: https://$HOST")"; [ "$c" = 429 ] && n429=$((n429+1)); done
[ "$n429" = 0 ] && pass "25 quick /api/auth/logout calls: no nginx 429 (not in the credential zone)" || fail "logout throttled by nginx ($n429 x 429)"
H="$(curlk -D - -o /dev/null "$URL/login" | tr -d '\r')"
CSPS="$(echo "$H" | grep -i '^content-security-policy:')"
[ "$(echo "$CSPS" | wc -l)" -ge 1 ] && pass "CSP present ($(echo "$CSPS" | wc -l) header(s))" || fail "no CSP"
echo "$CSPS" | grep -qi "script-src[^;]*'nonce-" && pass "app CSP: nonce-based script-src" || fail "no nonce script-src"
echo "$CSPS" | grep -qi "'strict-dynamic'" && pass "app CSP: strict-dynamic" || fail "no strict-dynamic"
if echo "$CSPS" | grep -i "default-src 'self'" | grep -qiv "nonce"; then fail "edge CSP still carries a conflicting default-src"; else pass "no conflicting edge default-src/script-src"; fi
echo "$H" | grep -qi '^strict-transport-security:' && pass "HSTS" || fail "HSTS missing"
echo "$H" | grep -qi '^x-content-type-options: nosniff' && pass "nosniff" || fail "nosniff missing"
n="$(echo "$H" | grep -ic '^referrer-policy:')"; [ "$n" = 1 ] && pass "/login: exactly one Referrer-Policy" || fail "/login Referrer-Policy count = $n"
R="$(curlk -D - -o /dev/null "$URL/reset-password" | tr -d '\r')"
n="$(echo "$R" | grep -ic '^referrer-policy:')"; v="$(echo "$R" | grep -i '^referrer-policy:' | head -1 | cut -d: -f2 | tr -d ' ')"
[ "$n" = 1 ] && [ "$v" = no-referrer ] && pass "/reset-password: single Referrer-Policy: no-referrer" || fail "/reset-password Referrer-Policy n=$n v=$v"

echo "== backup service (throwaway age key) =="
"${DC[@]}" up -d backup >/dev/null 2>&1
B=0; for _ in $(seq 1 36); do "${DC[@]}" exec -T backup sh -c 'test -f /backups/.last-success && ls /backups/base/base-*.tar.gz.age >/dev/null 2>&1' && { B=1; break; }; sleep 5; done
[ "$B" = 1 ] && pass "backup: nightly dump and base backup written" || { fail "backup: no dump/base backup within 3 min"; "${DC[@]}" logs --tail=30 backup; }
"${DC[@]}" exec -T db psql -U udigity_owner -d udigity -Atc "select pg_switch_wal()" >/dev/null 2>&1
W=0; for _ in $(seq 1 24); do "${DC[@]}" exec -T backup sh -c 'ls /backups/wal/*.age >/dev/null 2>&1' && { W=1; break; }; sleep 5; done
[ "$W" = 1 ] && pass "backup: WAL segment encrypted into /backups/wal" || fail "backup: no encrypted WAL file"
"${DC[@]}" exec -T backup sh -c 'cd /backups/daily && sha256sum -c ./*.sha256 >/dev/null 2>&1' && pass "backup: dump checksum verifies" || fail "backup: dump checksum"
"${DC[@]}" exec -T backup backupd guards >/dev/null 2>&1 && pass "backup: growth guards run" || fail "backup: guards failed"

echo
[ "$FAILS" = 0 ] && echo "SMOKE TEST PASSED" || echo "SMOKE TEST FAILED ($FAILS)"
exit "$FAILS"
