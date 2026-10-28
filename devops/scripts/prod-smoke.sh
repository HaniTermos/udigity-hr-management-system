#!/usr/bin/env bash
# Production-stack smoke test (local only). Brings up docker-compose.prod.yml under its OWN compose project
# ("udigity-smoke") on alternate ports with dummy secrets and a self-signed certificate, checks the edge, then tears
# everything down (containers, network, volumes of THAT project only). It never touches udigity-test-db or any
# real devops/env/*.env file: dummy env files and the certificate live in a temp directory.
#
#   devops/scripts/prod-smoke.sh            # HTTP_PORT=18080 HTTPS_PORT=18443 by default
#   KEEP=1 devops/scripts/prod-smoke.sh     # leave the stack up for inspection (tear down yourself)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export MSYS_NO_PATHCONV=1
command -v cygpath >/dev/null 2>&1 && ROOT="$(cygpath -m "$ROOT")"
PROJECT=udigity-smoke
export HTTP_PORT="${HTTP_PORT:-18080}" HTTPS_PORT="${HTTPS_PORT:-18443}"
HOST=app.example.com
TMP="$(mktemp -d)"
# Git Bash on Windows: native openssl/docker need a mixed (C:/...) path.
command -v cygpath >/dev/null 2>&1 && TMP="$(cygpath -m "$TMP")"
mkdir -p "$TMP/env" "$TMP/certs"
export UDIGITY_ENV_DIR="$TMP/env" NGINX_CERTS_DIR="$TMP/certs" UDIGITY_TAG=smoke
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
DATABASE_URL=postgres://udigity_api:$APPPW@db:5432/udigity
SESSION_SECRET=$(openssl rand -hex 32)
TOTP_ENC_KEY=$(openssl rand -hex 32)
APP_ORIGIN=https://$HOST:$HTTPS_PORT
PUBLIC_APP_URL=https://$HOST:$HTTPS_PORT
POLICY_COMPANY_TIMEZONE=Asia/Beirut
COMPANY_TIMEZONE=Asia/Beirut
SMTP_HOST=
EMAIL_ALLOW_REAL_SEND=false
E
cat > "$TMP/env/frontend.env" <<E
NODE_ENV=production
INTERNAL_API_URL=http://backend:5000
E
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$HOST" \
  -keyout "$TMP/certs/privkey.pem" -out "$TMP/certs/fullchain.pem" >/dev/null 2>&1 || { echo "openssl failed"; exit 2; }

echo "== build =="
"${DC[@]}" build || { echo "build failed"; exit 2; }
echo "== db + migrate =="
"${DC[@]}" up -d --wait db || { echo "db failed"; exit 2; }
"${DC[@]}" --profile tools run --rm migrate || { echo "migrate failed"; exit 2; }
echo "== up (waits for healthy) =="
"${DC[@]}" up -d --wait --wait-timeout 240 || { echo "stack did not become healthy"; "${DC[@]}" ps; "${DC[@]}" logs --tail=40 backend worker frontend nginx; exit 2; }
"${DC[@]}" ps

internal() { "${DC[@]}" exec -T backend node -e "fetch('http://127.0.0.1:5000$1').then(async r=>{console.log(r.status);process.exit(0)}).catch(()=>{console.log(0)})"; }
curlk() { curl -sk --resolve "$HOST:$HTTPS_PORT:127.0.0.1" "$@"; }
URL="https://$HOST:$HTTPS_PORT"

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
c="$(curlk -o /dev/null -w '%{http_code}' "$URL/login")"; [ "$c" = 200 ] && pass "/login 200 via nginx TLS" || fail "/login = $c"
c="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$HTTP_PORT/login" -H "Host: $HOST")"; [ "$c" = 301 ] && pass "http -> https redirect (301)" || fail "http redirect = $c"
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

echo
[ "$FAILS" = 0 ] && echo "SMOKE TEST PASSED" || echo "SMOKE TEST FAILED ($FAILS)"
exit "$FAILS"
