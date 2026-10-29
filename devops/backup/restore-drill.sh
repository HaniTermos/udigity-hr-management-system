#!/usr/bin/env bash
# Restore drill (policy D19: before launch, then quarterly; RTO objective 4 h). Runs on a workstation with Docker and
# the PRIVATE age key. Restores into a THROWAWAY postgres:17-alpine container with no published port, runs sanity
# checks, prints the timings and removes the container. It never touches production or any local PostgreSQL service.
#
#   (a) nightly dump:
#   AGE_IDENTITY=~/keys/udigity-backup.agekey ./restore-drill.sh backups/daily/udigity-20261023T023000Z.dump.age
#   ./restore-drill.sh backups/daily/udigity-....dump.gpg                      # gpg: uses your keyring
#
#   (b) point-in-time recovery: base backup + the WAL directory, optional target time (default: replay all WAL)
#   AGE_IDENTITY=... ./restore-drill.sh pitr backups/base/base-<stamp>.tar.gz.age backups/wal ['2026-10-29 14:05:00+03']
#
# Copy the files off the server first (they are encrypted), e.g.
#   docker run --rm -v udigity_backups:/b alpine tar -C /b -cf - . > udigity-backups.tar   (on the server), then scp.
# On Git Bash for Windows prefix with MSYS_NO_PATHCONV=1. Real restore to production: devops/DEPLOY.md section 11.
set -Eeuo pipefail

NAME="udigity-restore-drill-$$"
PW="drill_$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
log() { printf '%s [drill] %s\n' "$(date -u +%FT%TZ)" "$*"; }
cleanup() { docker rm -fv "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
SU=postgres; DB=udigity_restore
q() { docker exec "$NAME" psql -U "$SU" -d "$DB" -tAc "$1"; }
age_decrypt() { : "${AGE_IDENTITY:?set AGE_IDENTITY to the private age key file}"; age -d -i "$AGE_IDENTITY" < "$1"; }
checksum() { if [ -f "$1.sha256" ]; then (cd "$(dirname "$1")" && sha256sum -c "$(basename "$1").sha256") || { log "checksum FAILED"; exit 1; }; fi; }
sanity() {
  log "sanity checks"
  echo "  migrations applied : $(q 'select count(*) from schema_migrations')"
  echo "  latest migration   : $(q 'select max(version) from schema_migrations')"
  echo "  tables             : $(q "select count(*) from information_schema.tables where table_schema='public'")"
  for t in employees audit_log audit_events businesses; do
    if [ "$(q "select to_regclass('public.$t') is not null")" = "t" ]; then
      echo "  rows in $t: $(q "select count(*) from $t")"
    fi
  done
}
START=$(date +%s)

if [ "${1:-}" = pitr ]; then
  BASE="${2:?usage: restore-drill.sh pitr <base-*.tar.gz.age> <wal dir> [recovery_target_time]}"
  WALDIR="${3:?wal dir required}"; TARGET="${4:-}"
  checksum "$BASE"
  D=/var/lib/postgresql/data/pgdata
  SU="${PITR_DB_USER:-udigity_owner}"    # the physical copy keeps production's roles: connect as its owner (POSTGRES_USER)
  log "starting throwaway postgres:17-alpine ($NAME, no host port, server not started yet)"
  docker run -d --name "$NAME" --user postgres --entrypoint sleep postgres:17-alpine infinity >/dev/null
  log "decrypting and unpacking the base backup"
  docker exec "$NAME" sh -c "mkdir -p $D /tmp/wal && chmod 700 $D"
  age_decrypt "$BASE" | docker exec -i "$NAME" tar -xzf - -C "$D"
  FIRST="$(docker exec "$NAME" sed -n 's/^START WAL LOCATION: .*(file \([0-9A-F]*\))$/\1/p' "$D/backup_label")"
  log "base backup starts at WAL $FIRST; copying the WAL from there on"
  n=0
  for f in "$WALDIR"/*.age; do
    s="$(basename "$f" .age)"
    case "$s" in *.history) ;; *.partial|*.backup) continue ;; *) [[ "$s" < "$FIRST" ]] && continue ;; esac
    age_decrypt "$f" | docker exec -i "$NAME" sh -c "cat > /tmp/wal/$s"; n=$((n + 1))
  done
  log "$n WAL file(s) staged"
  {
    echo "restore_command = 'cp /tmp/wal/%f %p'"
    [ -n "$TARGET" ] && echo "recovery_target_time = '$TARGET'"
    echo "recovery_target_action = 'promote'"
  } | docker exec -i "$NAME" sh -c "cat >> $D/postgresql.auto.conf && touch $D/recovery.signal"
  log "replaying WAL${TARGET:+ up to $TARGET}"
  docker exec -d "$NAME" sh -c "postgres -D $D -c listen_addresses= -c archive_mode=off > /tmp/pg.log 2>&1"
  for _ in $(seq 1 600); do
    [ "$(docker exec "$NAME" psql -U "$SU" -d postgres -tAc 'select pg_is_in_recovery()' 2>/dev/null)" = f ] && break; sleep 1
  done
  if [ "$(docker exec "$NAME" psql -U "$SU" -d postgres -tAc 'select pg_is_in_recovery()' 2>/dev/null)" != f ]; then
    log "recovery did not finish (target later than the newest WAL?)"; docker exec "$NAME" tail -20 /tmp/pg.log; exit 1
  fi
  docker exec "$NAME" grep -E 'recovery stopping|archive recovery complete|redo done' /tmp/pg.log | sed 's/^/  pg: /' || true
  DB="${PITR_DB_NAME:-udigity}"
  echo "  recovered up to    : $(q "select pg_last_xact_replay_timestamp()")  (last replayed commit; empty = none after the base backup)"
  sanity
  log "PITR drill OK in $(( $(date +%s) - START ))s. Record the date, files, target and timings in the drill log."
  exit 0
fi

FILE="${1:?usage: restore-drill.sh <backup file (.dump.age|.dump.gpg)> | pitr <base> <wal dir> [time]}"
[ -f "$FILE" ] || { echo "no such file: $FILE"; exit 1; }
checksum "$FILE"
case "$FILE" in
  *.age) decrypt() { age_decrypt "$FILE"; } ;;
  *.gpg) decrypt() { gpg --batch --decrypt < "$FILE"; } ;;
  *) log "unknown extension"; exit 1 ;;
esac

log "starting throwaway postgres:17-alpine ($NAME, no host port)"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PW" -e POSTGRES_DB=udigity_restore \
  --tmpfs /var/lib/postgresql/data postgres:17-alpine >/dev/null
# Wait for the init phase to finish (the image restarts the server once), then for readiness.
for _ in $(seq 1 120); do docker logs "$NAME" 2>&1 | grep -q 'PostgreSQL init process complete' && break; sleep 1; done
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -d udigity_restore >/dev/null 2>&1 && break; sleep 1; done

log "decrypting and restoring"
decrypt | docker exec -i "$NAME" pg_restore -U postgres -d udigity_restore --no-owner --no-privileges --exit-on-error
sanity
log "drill OK in $(( $(date +%s) - START ))s. Record the date, file and timings in the drill log."
