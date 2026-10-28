#!/usr/bin/env bash
# Self-test for check-env.sh (used by CI). Builds a valid dummy env set in a temp dir (random throwaway secrets, never
# real ones), expects PASS, then expects FAIL for the unedited examples and for the DB-role mistakes (DEV-R5).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK="$HERE/check-env.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export STRICT_PERMS=0
OWN="own$(openssl rand -hex 12)"; APP="app$(openssl rand -hex 12)"
cat > "$T/postgres.env" <<E
POSTGRES_DB=udigity
POSTGRES_USER=udigity_owner
POSTGRES_PASSWORD=$OWN
APP_DB_USER=udigity_api
APP_DB_PASSWORD=$APP
E
echo "MIGRATION_DATABASE_URL=postgres://udigity_owner:$OWN@db:5432/udigity" > "$T/migrate.env"
cat > "$T/backend.env" <<E
NODE_ENV=production
TRUST_PROXY=true
DATABASE_URL=postgres://udigity_api:$APP@db:5432/udigity
SESSION_SECRET=$(openssl rand -hex 32)
TOTP_ENC_KEY=$(openssl rand -hex 32)
APP_ORIGIN=https://app.udigity.test
PUBLIC_APP_URL=https://app.udigity.test
POLICY_COMPANY_TIMEZONE=Asia/Beirut
COMPANY_TIMEZONE=Asia/Beirut
E
printf 'NODE_ENV=production\nINTERNAL_API_URL=http://backend:5000\n' > "$T/frontend.env"

FAILS=0
expect() { # want(0|1) label dir
  "$CHECK" "$3" >/dev/null 2>&1; local rc=$?
  if [ "$rc" = "$1" ]; then echo "  ok    $2"; else echo "  FAIL  $2 (exit $rc, wanted $1)"; FAILS=$((FAILS+1)); fi
}
expect 0 "valid dummy env set passes" "$T"
expect 1 "unedited examples are rejected" "$HERE/../env"

mut() { rm -rf "$T.m"; cp -r "$T" "$T.m"; "$@"; }
mut sed -i "s#udigity_api:$APP@#udigity_owner:$OWN@#" "$T.m/backend.env"; expect 1 "DATABASE_URL as the owner role is rejected" "$T.m"
mut sed -i "s#udigity_api:$APP@#udigity_api:wrong@#" "$T.m/backend.env"; expect 1 "DATABASE_URL password mismatch is rejected" "$T.m"
mut sed -i "s#^APP_DB_USER=.*#APP_DB_USER=udigity_owner#" "$T.m/postgres.env"; expect 1 "APP_DB_USER equal to POSTGRES_USER is rejected" "$T.m"
mut sed -i "s#^APP_DB_PASSWORD=.*#APP_DB_PASSWORD=$OWN#" "$T.m/postgres.env"; expect 1 "same password for both roles is rejected" "$T.m"
mut rm "$T.m/migrate.env"; expect 1 "missing migrate.env is rejected" "$T.m"
mut bash -c "echo MIGRATION_DATABASE_URL=postgres://x:y@db/z >> '$T.m/backend.env'"; expect 1 "MIGRATION_DATABASE_URL in backend.env is rejected" "$T.m"
rm -rf "$T.m"
[ "$FAILS" = 0 ] && echo "check-env self-test PASSED" || { echo "check-env self-test FAILED ($FAILS)"; exit 1; }
