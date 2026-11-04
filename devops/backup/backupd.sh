#!/usr/bin/env bash
# Backup daemon for the "backup" compose service (devops/backup.Dockerfile). Policy D19.
#
#   backupd loop       default: every minute encrypt new WAL segments; nightly dump at BACKUP_TIME (TZ);
#                      weekly base backup on BASE_BACKUP_DAY (1=Mon .. 7=Sun)
#   backupd nightly    run the nightly dump now        docker compose -f docker-compose.prod.yml exec backup backupd nightly
#   backupd base       take a base backup now
#   backupd wal        encrypt archived WAL now
#   backupd health     healthcheck: last successful nightly dump younger than 26 h
#   backupd guards     growth guards now (WAL backlog, volume usage, stale base backup): raise ops_alerts rows
#
# Storage (Owner-approved exception, 2026-10-29): volume "backups" on the SAME server as the database.
#   /backups/{daily,weekly,monthly}/udigity-<stamp>.dump.age   nightly logical dumps (pg-backup.sh, 14/8/6)
#   /backups/base/base-<stamp>.tar.gz.age                      weekly physical base backups (KEEP_BASE kept)
#   /backups/wal/<segment>.age                                 WAL since the oldest kept base backup
# The db service writes raw WAL to the shared "wal_archive" volume (/wal); this job encrypts each segment with the
# age PUBLIC key within a minute and deletes the raw copy. The private key is never on the server.
# Failures are recorded in ops_alerts (best effort); the worker emails them to ALERT_EMAIL_TO.
set -uo pipefail
umask 077

B=/backups; W=/wal
BACKUP_TIME="${BACKUP_TIME:-02:30}"
BASE_BACKUP_DAY="${BASE_BACKUP_DAY:-7}"
KEEP_BASE="${KEEP_BASE:-2}"
WAL_BACKLOG_MAX="${WAL_BACKLOG_MAX:-20}"   # G-07: raw WAL files waiting for encryption before an alert is raised
DISK_ALERT_PCT="${DISK_ALERT_PCT:-80}"     # G-07: volume usage (percent) at which an alert is raised
export PGHOST="${PGHOST:-db}" PGPORT="${PGPORT:-5432}" PGUSER="${BACKUP_DB_USER:-udigity_backup}" \
       PGDATABASE="${BACKUP_DB_NAME:-udigity}" PGPASSWORD="${BACKUP_DB_PASSWORD:-}" PGCONNECT_TIMEOUT=10 \
       BACKUP_DIR="$B" BACKUP_ENV_FILE=/dev/null BACKUP_ENCRYPTION=age

log() { printf '%s [backupd] %s\n' "$(date +%FT%T%z)" "$*"; }

# alert KIND DETAIL: one ops_alerts row per kind per 15-minute window (same dedupe key as backend/src/shared/opsAlert.ts).
# DETAIL is a short fixed label: never secrets, paths with credentials, or command output.
alert() {
  local kind="backup.$1" key out
  key="$kind:$(( $(date +%s) / 900 ))"
  log "ALERT $kind: $2"
  out="$(psql -X -q -v ON_ERROR_STOP=1 -v kind="$kind" -v detail="$2" -v key="$key" 2>&1 <<'SQL'
INSERT INTO ops_alerts (kind, detail, dedupe_key) VALUES (:'kind', :'detail', :'key')
ON CONFLICT (dedupe_key) DO UPDATE SET occurrences = ops_alerts.occurrences + 1;
SQL
)" || log "WARN: could not record the alert in ops_alerts: ${out//$'\n'/ }"
}

check_config() {
  [[ "${AGE_RECIPIENT:-}" == age1* && "$AGE_RECIPIENT" != age1CHANGE_ME ]] || { alert config "AGE_RECIPIENT is not set in backup.env"; return 1; }
  [ -n "$PGPASSWORD" ] || { alert config "BACKUP_DB_PASSWORD is not set in backup.env"; return 1; }
  [ -z "${RCLONE_REMOTE:-}" ] || log "note: RCLONE_REMOTE is ignored in the container (no rclone, no internet route); sync the backups volume from the host"
  export RCLONE_REMOTE=
}

# Serialise dump/base runs between the loop and `docker compose exec backup backupd ...`.
locked() { ( flock 9 || exit 75; "$@" ) 9>/tmp/backupd.lock; }

nightly() {
  log "nightly dump"
  if /opt/backup/pg-backup.sh; then touch "$B/.last-success"; else
    local rc=$?; alert nightly_failed "nightly pg_dump failed (exit $rc); see: docker compose logs backup"; return "$rc"
  fi
}

base() {
  mkdir -p "$B/base" "$B/wal"
  local stamp out; stamp="$(date -u +%Y%m%dT%H%M%SZ)"; out="$B/base/base-$stamp.tar.gz.age"
  log "base backup"
  # -X fetch puts the WAL needed for consistency inside the tar, so each base backup restores on its own.
  if ! pg_basebackup -D - -Ft -z -X fetch -c fast -l "udigity-$stamp" | age -r "$AGE_RECIPIENT" > "$out.partial" \
     || [ ! -s "$out.partial" ]; then
    rm -f "$out.partial"; alert basebackup_failed "weekly pg_basebackup failed; see: docker compose logs backup"; return 1
  fi
  mv "$out.partial" "$out" && (cd "$B/base" && sha256sum "$(basename "$out")" > "$(basename "$out").sha256")
  log "wrote $out ($(du -h "$out" | cut -f1))"
  # Keep KEEP_BASE base backups, then drop WAL segments older than the oldest kept one (not needed for any restore).
  ls -1t "$B"/base/base-*.tar.gz.age | tail -n +"$((KEEP_BASE + 1))" | while read -r f; do rm -f -- "$f" "$f.sha256"; log "pruned $f"; done
  local oldest; oldest="$(ls -1t "$B"/base/base-*.tar.gz.age | tail -n 1)"
  if ! find "$B/wal" -maxdepth 1 -type f -name '????????????????????????*.age' ! -newer "$oldest" -delete; then
    alert wal_prune_failed "pruning WAL older than the oldest base backup failed"; return 1
  fi
}

# Encrypt completed WAL segments (and .history/.backup files) from /wal into /backups/wal, then delete the raw copy.
wal() {
  mkdir -p "$B/wal"
  local f n fails=0
  for f in "$W"/*; do
    [ -f "$f" ] || continue
    n="$(basename "$f")"; [[ "$n" == *.tmp ]] && continue          # still being copied by archive_command
    if age -r "$AGE_RECIPIENT" < "$f" > "$B/wal/$n.age.partial" && mv "$B/wal/$n.age.partial" "$B/wal/$n.age"; then
      rm -f -- "$f"
    else
      rm -f "$B/wal/$n.age.partial"; fails=$((fails + 1))
    fi
  done
  [ "$fails" = 0 ] || { alert wal_encrypt_failed "could not encrypt $fails archived WAL file(s)"; return 1; }
  # archive_command failing on the db side (disk full, permissions): Postgres keeps retrying and WAL piles up.
  if [ "$(psql -X -Atc "select coalesce(last_failed_time > coalesce(last_archived_time, '-infinity'), false) from pg_stat_archiver" 2>/dev/null)" = t ]; then
    alert wal_archive_failing "PostgreSQL archive_command is failing (see: docker compose logs db)"
  fi
}

# G-07: growth guards, run hourly from the loop. Everything here only raises ops_alerts rows (best effort); the host monitor
# (devops/scripts/host-monitor.sh) checks the same things from outside, because this container is what is down in the worst case.
guards() {
  local n d pct
  n="$(find "$W" -maxdepth 1 -type f ! -name '*.tmp' 2>/dev/null | wc -l)"
  [ "$n" -le "$WAL_BACKLOG_MAX" ] || alert wal_backlog "raw WAL waiting for encryption: $n files (limit $WAL_BACKLOG_MAX)"
  for d in "$B" "$W"; do
    pct="$(df -P "$d" 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')"
    [[ "$pct" =~ ^[0-9]+$ ]] && [ "$pct" -ge "$DISK_ALERT_PCT" ] && alert disk_high "volume of $d is ${pct}% full (limit ${DISK_ALERT_PCT}%)"
  done
  # The weekly base backup also prunes old WAL; if it keeps failing, WAL in /backups/wal grows without bound.
  if ls "$B"/base/base-*.tar.gz.age >/dev/null 2>&1 && [ -z "$(find "$B/base" -maxdepth 1 -name 'base-*.tar.gz.age' -mtime -10 2>/dev/null)" ]; then
    alert base_stale "no base backup newer than 10 days: WAL in /backups/wal is not being pruned"
  fi
  return 0
}

health() { [ -n "$(find "$B/.last-success" -mmin -1560 2>/dev/null)" ]; }

loop() {
  log "started: nightly at $BACKUP_TIME (TZ=${TZ:-UTC}), base backup on day $BASE_BACKUP_DAY, keep $KEEP_BASE base backups"
  trap 'log "stopping"; exit 0' TERM INT
  until pg_isready -q; do sleep 5; done
  find "$B" -name '*.partial' -type f -delete 2>/dev/null   # left over by a run that was killed
  local ok=1; check_config || ok=0
  # First start, or the container was down for more than a day: back up now instead of waiting for BACKUP_TIME.
  if [ "$ok" = 1 ] && ! health; then locked nightly; date +%F > "$B/.nightly-day"; fi
  if [ "$ok" = 1 ] && ! ls "$B"/base/base-*.tar.gz.age >/dev/null 2>&1; then locked base; fi
  local tick=0
  while :; do
    [ $((tick % 60)) -ne 0 ] || guards
    tick=$((tick + 1))
    if [ "$ok" = 1 ] || check_config; then
      ok=1
      wal
      if [[ ! "$(date +%H:%M)" < "$BACKUP_TIME" ]] && [ "$(cat "$B/.nightly-day" 2>/dev/null)" != "$(date +%F)" ]; then
        date +%F > "$B/.nightly-day"          # one attempt per day; a failure alerts, an operator re-runs it by hand
        locked nightly
        [ "$(date +%u)" = "$BASE_BACKUP_DAY" ] && locked base
      fi
    fi
    sleep 60 & wait $!
  done
}

cmd="${1:-loop}"
case "$cmd" in
  loop) loop ;;
  nightly|base|wal) check_config || exit 1; locked "$cmd" ;;
  health) health ;;
  guards) guards ;;
  *) echo "usage: backupd [loop|nightly|base|wal|health|guards]" >&2; exit 2 ;;
esac
