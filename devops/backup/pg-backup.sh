#!/usr/bin/env bash
# Nightly encrypted PostgreSQL backup for the production compose stack.
#
#   Cron (02:30 server time):  30 2 * * * /opt/udigity/devops/backup/pg-backup.sh >> /var/log/udigity-backup.log 2>&1
#
# Retention (policy C1): 14 daily / 8 weekly (Sunday) / 6 monthly (1st of month).
# The dump is piped straight into the encryptor: no plaintext dump ever touches the disk.
# Config: devops/env/backup.env (see backup.env.example). Only the PUBLIC age/gpg key is on the server.
set -Eeuo pipefail
umask 077

HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-$HERE/../env/backup.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/udigity}"
COMPOSE_FILE="${COMPOSE_FILE:-$HERE/../../docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"
BACKUP_ENCRYPTION="${BACKUP_ENCRYPTION:-age}"

log() { printf '%s [backup] %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

case "$BACKUP_ENCRYPTION" in
  age)
    command -v age >/dev/null || die "age not installed (apt install age)"
    [[ "${AGE_RECIPIENT:-}" == age1* && "${AGE_RECIPIENT}" != age1CHANGE_ME ]] || die "AGE_RECIPIENT not set"
    EXT="dump.age"; encrypt() { age -r "$AGE_RECIPIENT"; } ;;
  gpg)
    command -v gpg >/dev/null || die "gpg not installed"
    [ -n "${GPG_RECIPIENT:-}" ] || die "GPG_RECIPIENT not set"
    EXT="dump.gpg"; encrypt() { gpg --batch --yes --trust-model always --encrypt --recipient "$GPG_RECIPIENT"; } ;;
  *) die "BACKUP_ENCRYPTION must be age or gpg" ;;
esac

mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/daily/udigity-$STAMP.$EXT"
TMP="$OUT.partial"
trap 'rm -f "$TMP"; log "FAILED at line $LINENO"' ERR

log "dumping database from service '$DB_SERVICE'"
# -Fc: compressed custom format (pg_restore-able, selective restore). Credentials come from the container env.
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges' \
  | encrypt > "$TMP"

[ -s "$TMP" ] || die "empty backup"
mv "$TMP" "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
log "wrote $OUT ($(du -h "$OUT" | cut -f1))"

# Promote copies (hard links: no extra space).
if [ "$(date -u +%u)" = "7" ]; then ln -f "$OUT" "$BACKUP_DIR/weekly/";  ln -f "$OUT.sha256" "$BACKUP_DIR/weekly/";  fi
if [ "$(date -u +%d)" = "01" ]; then ln -f "$OUT" "$BACKUP_DIR/monthly/"; ln -f "$OUT.sha256" "$BACKUP_DIR/monthly/"; fi

prune() { # dir keep
  local dir="$1" keep="$2"
  { ls -1t "$dir"/udigity-*."$EXT" 2>/dev/null || true; } | tail -n +"$((keep + 1))" | while read -r f; do
    rm -f -- "$f" "$f.sha256"; log "pruned $f"
  done
}
prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"

# Optional off-site copy (provider NEEDS VALUE). Files are already encrypted.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  command -v rclone >/dev/null || die "RCLONE_REMOTE set but rclone not installed"
  rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --include 'udigity-*' && log "synced to $RCLONE_REMOTE"
fi
log "done"
