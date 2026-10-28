#!/usr/bin/env bash
# Restore drill (policy C1: quarterly, on the operator workstation; RTO 4 h).
# Restores an encrypted backup into a THROWAWAY postgres container with no published port,
# runs sanity checks, prints the results and removes the container. It never touches production
# or any local PostgreSQL service.
#
#   AGE_IDENTITY=~/keys/udigity-backup.agekey ./restore-drill.sh /path/udigity-20261023T023000Z.dump.age
#   ./restore-drill.sh /path/udigity-....dump.gpg          # gpg: uses your keyring
#
# Real restore to production: see devops/README.md "Restore" (same decrypt step, then pg_restore
# into the stopped stack's db service).
set -Eeuo pipefail

FILE="${1:?usage: restore-drill.sh <backup file (.dump.age|.dump.gpg)>}"
[ -f "$FILE" ] || { echo "no such file: $FILE"; exit 1; }
NAME="udigity-restore-drill-$$"
PW="drill_$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
log() { printf '%s [drill] %s\n' "$(date -u +%FT%TZ)" "$*"; }
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -f "$FILE.sha256" ]; then
  (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256") || { log "checksum FAILED"; exit 1; }
fi

case "$FILE" in
  *.age) : "${AGE_IDENTITY:?set AGE_IDENTITY to the private age key file}"; decrypt() { age -d -i "$AGE_IDENTITY" < "$FILE"; } ;;
  *.gpg) decrypt() { gpg --batch --decrypt < "$FILE"; } ;;
  *) log "unknown extension"; exit 1 ;;
esac

START=$(date +%s)
log "starting throwaway postgres:17-alpine ($NAME, no host port)"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PW" -e POSTGRES_DB=udigity_restore \
  --tmpfs /var/lib/postgresql/data postgres:17-alpine >/dev/null
# Wait for the init phase to finish (the image restarts the server once), then for readiness.
for _ in $(seq 1 120); do docker logs "$NAME" 2>&1 | grep -q 'PostgreSQL init process complete' && break; sleep 1; done
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -d udigity_restore >/dev/null 2>&1 && break; sleep 1; done

log "decrypting and restoring"
decrypt | docker exec -i "$NAME" pg_restore -U postgres -d udigity_restore --no-owner --no-privileges --exit-on-error

q() { docker exec "$NAME" psql -U postgres -d udigity_restore -tAc "$1"; }
log "sanity checks"
echo "  migrations applied : $(q 'select count(*) from schema_migrations')"
echo "  latest migration   : $(q 'select max(version) from schema_migrations')"
echo "  tables             : $(q "select count(*) from information_schema.tables where table_schema='public'")"
for t in employees audit_log businesses; do
  if [ "$(q "select to_regclass('public.$t') is not null")" = "t" ]; then
    echo "  rows in $t: $(q "select count(*) from $t")"
  fi
done
log "drill OK in $(( $(date +%s) - START ))s. Record the date, file and timings in the drill log."
