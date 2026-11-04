#!/usr/bin/env bash
# Validate the production env files against devops/env/*.env.example.
#
#   devops/scripts/check-env.sh [ENV_DIR]        (default: UDIGITY_ENV_DIR, else devops/env)
#   STRICT_PERMS=0 skips the file-mode check (use it on Windows or in CI).
#
# Checks (values are NEVER printed, only key names):
#   backend.env   required keys present and valid (mirrors backend/src/config/index.ts, emailConfig.ts and
#                 shared/flags.ts), placeholders replaced, unknown keys flagged, real-email safety switch
#   postgres.env  bootstrap superuser (POSTGRES_USER), schema owner (OWNER_DB_USER) and limited runtime role (APP_DB_USER)
#                 with different passwords; backend.env DATABASE_URL must use the runtime role, migrate.env the owner (DEV-R5, gap 8)
#   migrate.env   owner credentials for the one-shot migrate job; must NOT be in backend.env
#   frontend.env  required keys present, cookie names match the backend
#   backup.env    optional; validated when present
# Exit 0 = no errors (warnings allowed), 1 = at least one error.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
EX_DIR="$HERE/../env"
ENV_DIR="${1:-${UDIGITY_ENV_DIR:-$EX_DIR}}"
ERR=0; WARN=0
err()  { printf 'ERROR  %s\n' "$*"; ERR=$((ERR+1)); }
warn() { printf 'warn   %s\n' "$*"; WARN=$((WARN+1)); }

# get FILE KEY -> last uncommented KEY=value (surrounding quotes stripped); empty when absent.
get() {
  local line
  line="$(grep -E "^[[:space:]]*$2=" "$1" | tail -n1)" || true
  line="${line#*=}"; line="${line%$'\r'}"
  line="${line#\"}"; line="${line%\"}"; line="${line#\'}"; line="${line%\'}"
  printf '%s' "$line"
}
has() { grep -qE "^[[:space:]]*$2=" "$1"; }
is_int() { [[ "$1" =~ ^[0-9]+$ ]]; }
is_placeholder() { case "$1" in ''|*CHANGE_ME*) return 0;; esac; return 1; }

require() { # file key
  local v; v="$(get "$1" "$2")"
  if is_placeholder "$v"; then err "$(basename "$1"): $2 is required (empty or still the placeholder)"; return 1; fi
  return 0
}

check_perms() {
  [ "${STRICT_PERMS:-1}" = "1" ] || return 0
  local m; m="$(stat -c '%a' "$1" 2>/dev/null || echo '')"
  case "$m" in ''|600|400) ;; *) err "$(basename "$1"): mode is $m, run chmod 600 on it";; esac
}

check_unknown() { # file example
  local k
  while IFS= read -r k; do
    grep -qE "^[#[:space:]]*$k=" "$2" || warn "$(basename "$1"): unknown key $k (typo? the code does not read it)"
  done < <(grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$1" | tr -d ' \t=')
}

B="$ENV_DIR/backend.env"; P="$ENV_DIR/postgres.env"; M="$ENV_DIR/migrate.env"; F="$ENV_DIR/frontend.env"; K="$ENV_DIR/backup.env"
echo "Checking env files in $ENV_DIR"

enum() { # key allowed...
  local k="$1"; shift; local v; v="$(get "$B" "$k")"; [ -z "$v" ] && return 0
  local a; for a in "$@"; do [ "$v" = "$a" ] && return 0; done
  err "backend.env: $k must be one of: $*"
}

if [ ! -f "$B" ]; then err "backend.env not found (copy backend.env.example)"; else
  check_perms "$B"; check_unknown "$B" "$EX_DIR/backend.env.example"

  [ "$(get "$B" NODE_ENV)" = "production" ] || err "backend.env: NODE_ENV must be production"
  # D2: forwarding headers are trusted only from explicitly listed proxies (the nginx container network).
  TPC="$(get "$B" TRUSTED_PROXY_CIDRS)"
  if [ -z "$TPC" ]; then err "backend.env: TRUSTED_PROXY_CIDRS is required (the nginx proxy IP/CIDR; needed for the office-IP check)"
  else
    IFS=',' read -ra parts <<< "$TPC"
    for p in "${parts[@]}"; do
      p="${p// /}"
      case "$p" in 0.0.0.0/0|::/0|*/0|*/1|*/2|*/3|*/4|*/5|*/6|*/7|*/8) err "backend.env: TRUSTED_PROXY_CIDRS entry $p is far too wide: any host in it could set the client address";; esac
      case "$p" in loopback|linklocal|uniquelocal) warn "backend.env: TRUSTED_PROXY_CIDRS=$p trusts a whole range; behind the bundled nginx use its pinned address (172.29.10.10/32, see docker-compose.prod.yml)";; esac
      [[ "$p" =~ ^(loopback|linklocal|uniquelocal)$ || "$p" =~ ^[0-9.]+(/[0-9]{1,2})?$ || "$p" =~ ^[0-9A-Fa-f:]+(/[0-9]{1,3})?$ ]] \
        || err "backend.env: TRUSTED_PROXY_CIDRS entries must be IPs, CIDR ranges or loopback/linklocal/uniquelocal"
    done
  fi

  DBURL="$(get "$B" DATABASE_URL)"
  if is_placeholder "$DBURL"; then
    if ! { has "$B" DB_HOST && has "$B" DB_NAME && has "$B" DB_USER && ! is_placeholder "$(get "$B" DB_PASSWORD)"; }; then
      err "backend.env: set DATABASE_URL (or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD) without placeholders"
    fi
  fi

  has "$B" MIGRATION_DATABASE_URL && err "backend.env: MIGRATION_DATABASE_URL belongs in migrate.env only (the API/worker must not hold the owner credentials)"

  S="$(get "$B" SESSION_SECRET)"
  if is_placeholder "$S" || [ "${#S}" -lt 32 ] || [ "$S" = "udigity_dev_session_secret_change_me_in_production_32chars" ]; then
    err "backend.env: SESSION_SECRET must be >= 32 random characters (openssl rand -hex 32)"
  elif [ "$(printf '%s' "$S" | fold -w1 | sort -u | wc -l)" -lt 10 ]; then
    err "backend.env: SESSION_SECRET has too few distinct characters (not random; openssl rand -hex 32)"
  fi

  SP="$(get "$B" SESSION_SECRET_PREVIOUS)"
  if [ -n "$SP" ]; then
    { [ "${#SP}" -lt 32 ] || [ "$SP" = "$S" ]; } && err "backend.env: SESSION_SECRET_PREVIOUS must be the previous SESSION_SECRET (>= 32 characters) and differ from SESSION_SECRET"
    warn "backend.env: SESSION_SECRET_PREVIOUS is set (secret rotation window): remove it after the window and restart (DEPLOY.md, key rotation)"
  fi

  T="$(get "$B" TOTP_ENC_KEY)"
  if is_placeholder "$T"; then err "backend.env: TOTP_ENC_KEY is required (openssl rand -hex 32)"
  elif ! [[ "$T" =~ ^[0-9a-fA-F]{64}$ || "$T" =~ ^[A-Za-z0-9+/_-]{43,44}=?$ ]]; then
    err "backend.env: TOTP_ENC_KEY must be 32 random bytes as 64 hex characters or base64"
  fi
  [[ "$(get "$B" TOTP_ENC_KEY_ID)" =~ ^([A-Za-z0-9_-]{1,40})?$ ]] || err "backend.env: TOTP_ENC_KEY_ID must be 1-40 characters [A-Za-z0-9_-]"

  for k in APP_ORIGIN PUBLIC_APP_URL; do
    if require "$B" $k; then
      IFS=',' read -ra parts <<< "$(get "$B" $k)"
      for o in "${parts[@]}"; do
        o="${o// /}"
        [[ "$o" =~ ^https://[^/]+$ ]] || err "backend.env: $k entries must be https origins without a path or trailing slash"
        [[ "$o" == "$(printf '%s' "$o" | tr 'A-Z' 'a-z')" ]] || err "backend.env: $k must be lower case (the origin check is an exact string match)"
        [[ "$o" == *example.com* ]] && err "backend.env: $k still contains example.com"
        [[ "$o" =~ ^https://(localhost|127\.|\[::1\]) ]] && err "backend.env: $k must be the public host name, not a local address"
      done
    fi
  done
  # The API refuses to start unless these agree (C-14); catch it here with a clear message.
  AO="$(get "$B" APP_ORIGIN)"; PU="$(get "$B" PUBLIC_APP_URL)"
  if ! is_placeholder "$AO" && ! is_placeholder "$PU"; then
    [[ ",${AO// /}," == *",${PU// /},"* ]] || err "backend.env: PUBLIC_APP_URL must equal the public origin in APP_ORIGIN"
  fi
  CO="$(get "$B" CORS_ORIGIN)"
  [ -z "$CO" ] || [[ ",${AO// /}," == *",${CO// /},"* ]] || err "backend.env: CORS_ORIGIN must equal APP_ORIGIN"

  # Company timezone (BL-16): required, must be an IANA zone.
  TZV="$(get "$B" POLICY_COMPANY_TIMEZONE)"
  [ -z "$TZV" ] && TZV="$(get "$B" COMPANY_TIMEZONE)"
  if [ -z "$TZV" ]; then err "backend.env: POLICY_COMPANY_TIMEZONE is required (BL-16): the company-confirmed IANA zone"
  elif command -v node >/dev/null 2>&1; then
    node -e "try{new Intl.DateTimeFormat('en-US',{timeZone:process.argv[1]})}catch(e){process.exit(1)}" "$TZV" \
      || err "backend.env: POLICY_COMPANY_TIMEZONE is not an IANA time zone"
  elif ! [[ "$TZV" =~ ^[A-Za-z_]+/[A-Za-z_+-]+(/[A-Za-z_+-]+)?$ || "$TZV" == UTC ]]; then
    err "backend.env: POLICY_COMPANY_TIMEZONE does not look like an IANA time zone"
  fi

  enum OWNER_PENDING_2FA_SCOPE R11-a R11-b
  enum POLICY_ATTENDANCE_VERIFICATION_MODE ip
  enum EMAIL_TRANSPORT log smtp
  enum POLICY_ATTENDANCE_FAILED_CHECKOUT provisional
  enum POLICY_VISIBILITY_TIMER_BASIS creation
  enum POLICY_ACCESS_DATA_ENTRY_SCOPE DE-1 DE-2
  enum POLICY_DEALS_DEVELOPER_PRE_CLOSURE assigned closedOnly
  enum POLICY_DEALS_CLOSURE_MODE ownerVerify direct
  enum POLICY_DEALS_REOPEN_TARGET accepted_opportunity previous_stage
  enum POLICY_CALLS_SAVE_AFTER_RESERVATION_LOSS keepAttemptOnly reject
  enum POLICY_NOTIFICATIONS_LATE_REMINDER sendIfEventFuture skip

  for k in POLICY_ATTENDANCE_REMOTE_SELF_REQUEST POLICY_ATTENDANCE_EMPLOYEE_REQUESTS POLICY_ATTENDANCE_BREAKS_ENABLED \
           POLICY_WORK_AUTOFILL_SCHEDULED POLICY_ACCESS_AUDIT_OWNER_HIDDEN_READS \
           POLICY_RESERVATION_OWNER_OVERRIDE POLICY_PROJECTS_AUTO_PROVISION POLICY_NOTIFICATIONS_IN_APP \
           POLICY_NOTIFICATIONS_NOTIFY_PREVIOUS_ASSIGNEE POLICY_AUDIT_EXPORT_ENABLED SMTP_SECURE EMAIL_ALLOW_REAL_SEND \
           ALLOW_MISSING_ORIGIN COOKIE_SECURE; do
    v="$(get "$B" $k)"; [ -z "$v" ] || [ "$v" = true ] || [ "$v" = false ] || err "backend.env: $k must be true or false"
  done
  [ "$(get "$B" ALLOW_MISSING_ORIGIN)" = "true" ] && warn "backend.env: ALLOW_MISSING_ORIGIN=true weakens CSRF protection; keep false in production"

  for k in PORT DB_PORT SESSION_IDLE_MINUTES SESSION_ABSOLUTE_HOURS SESSION_PENDING_2FA_MINUTES LOCKOUT_MAX_FAILURES \
           LOCKOUT_WINDOW_MINUTES LOCKOUT_DURATION_MINUTES AUTH_RATE_LIMIT_MAX AUTH_RATE_LIMIT_WINDOW_MINUTES \
           PASSWORD_MIN_LENGTH PASSWORD_RESET_TTL_MINUTES POLICY_AUTH_RECOVERY_CODE_COUNT \
           POLICY_RETENTION_SESSIONS_DAYS POLICY_RETENTION_RESERVATIONS_DAYS POLICY_RETENTION_NOTIFICATIONS_DAYS \
           POLICY_RETENTION_JOBS_DAYS POLICY_RETENTION_TOKENS_DAYS POLICY_RETENTION_IDEMPOTENCY_HOURS \
           POLICY_ATTENDANCE_GRACE_MINUTES POLICY_ATTENDANCE_MISSING_CHECKOUT_FLAG_HOURS \
           POLICY_WORK_AUTOFILL_PER_AGENT_PER_DAY POLICY_RESERVATION_LEASE_SECONDS POLICY_RESERVATION_HEARTBEAT_SECONDS \
           POLICY_RESERVATION_IDLE_MINUTES POLICY_RESERVATION_IDLE_WARNING_MINUTES POLICY_RESERVATION_MAX_TOTAL_MINUTES \
           POLICY_CALLS_ACCEPTED_NOTE_MIN_LENGTH POLICY_FOLLOWUPS_OVERDUE_MINUTES POLICY_VISIBILITY_CALLBACK_GRACE_HOURS \
           POLICY_VISIBILITY_COMPLETED_PROJECT_DAYS POLICY_NOTIFICATIONS_FOLLOWUP_LEAD_MINUTES \
           POLICY_NOTIFICATIONS_FOLLOWUP_OVERDUE_ALERT_MINUTES POLICY_NOTIFICATIONS_MISSING_CHECKIN_AFTER_GRACE_MINUTES \
           POLICY_NOTIFICATIONS_MISSING_CHECKOUT_AFTER_SHIFT_MINUTES; do
    v="$(get "$B" $k)"; [ -z "$v" ] || { is_int "$v" && [ "$v" -gt 0 ]; } || err "backend.env: $k must be a positive integer"
  done
  for k in POLICY_NOTIFICATIONS_MEETING_LEAD_MINUTES POLICY_NOTIFICATIONS_EMAIL_RETRY_SECONDS; do
    v="$(get "$B" $k)"; [ -z "$v" ] || [[ "$v" =~ ^[0-9]+(,[0-9]+)*$ ]] || err "backend.env: $k must be a comma-separated list of integers"
  done

  # Email safety (emailConfig.ts): a real SMTP host needs the explicit switch, a valid sender and a valid port.
  SH="$(get "$B" SMTP_HOST)"; FROM="$(get "$B" SMTP_FROM)"; [ -z "$FROM" ] && FROM="$(get "$B" EMAIL_FROM)"
  if [ -n "$FROM" ] && ! [[ "$FROM" =~ ^[^[:space:]@\<\>,\;\"]+@[^[:space:]@\<\>,\;\"]+\.[^[:space:]@\<\>,\;\"]+$ ]]; then
    err "backend.env: SMTP_FROM must be a plain email address (no display name)"
  fi
  if [ -n "$SH" ] && [ "$(get "$B" EMAIL_TRANSPORT)" != "log" ]; then
    [[ "$FROM" == *example.com || "$FROM" == *.invalid ]] && err "backend.env: SMTP_FROM still uses a placeholder domain"
    [ -n "$(get "$B" ALERT_EMAIL_TO)" ] || warn "backend.env: ALERT_EMAIL_TO is empty while real email is on: failure alerts are only stored in ops_alerts (set an operator address)"
    if [ "$(get "$B" EMAIL_ALLOW_REAL_SEND)" != "true" ]; then
      err "backend.env: SMTP_HOST is set but EMAIL_ALLOW_REAL_SEND is not true; the worker will refuse to start"
    else
      warn "backend.env: REAL EMAIL IS ENABLED (needs the Owner's go-ahead)"
    fi
    pt="$(get "$B" SMTP_PORT)"; [ -z "$pt" ] || { is_int "$pt" && [ "$pt" -le 65535 ]; } || err "backend.env: SMTP_PORT must be a valid port"
    if [ -n "$(get "$B" SMTP_USER)" ] && [ -z "$(get "$B" SMTP_PASS)" ]; then err "backend.env: SMTP_USER is set but SMTP_PASS is empty"; fi
  else
    [ "$(get "$B" EMAIL_ALLOW_REAL_SEND)" = "true" ] && warn "backend.env: EMAIL_ALLOW_REAL_SEND=true but no SMTP_HOST: no email is sent; every invitation/reset email is recorded as failed on the Delivery monitor"
  fi

  if [ -z "$(get "$B" POLICY_ATTENDANCE_OFFICE_IPS)$(get "$B" OFFICE_IP_ALLOWLIST)" ]; then
    warn "backend.env: POLICY_ATTENDANCE_OFFICE_IPS is empty (VAL-IP): attendance stays 'Not configured' until the Owner saves the office IPs"
  fi
fi

if [ ! -f "$P" ]; then err "postgres.env not found (copy postgres.env.example)"; else
  check_perms "$P"; check_unknown "$P" "$EX_DIR/postgres.env.example"
  for k in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD OWNER_DB_USER OWNER_DB_PASSWORD APP_DB_USER APP_DB_PASSWORD; do require "$P" $k; done
  PW="$(get "$P" POSTGRES_PASSWORD)"; OU="$(get "$P" POSTGRES_USER)"
  OWU="$(get "$P" OWNER_DB_USER)"; OWP="$(get "$P" OWNER_DB_PASSWORD)"
  [ -n "$OWU" ] && { [ "$OWU" = "$OU" ] && err "postgres.env: OWNER_DB_USER must differ from POSTGRES_USER (migrations must not run as the superuser, gap 8)";     [ "$OWU" = "$(get "$P" APP_DB_USER)" ] && err "postgres.env: OWNER_DB_USER must differ from APP_DB_USER";     case "$OWU" in udigity_app|postgres) err "postgres.env: OWNER_DB_USER must not be $OWU";; esac; }
  [ -n "$OWP" ] && [ "$OWP" = "$PW" ] && err "postgres.env: OWNER_DB_PASSWORD must differ from POSTGRES_PASSWORD"
  [ -n "$OWP" ] && [ "$OWP" = "$(get "$P" APP_DB_PASSWORD)" ] && err "postgres.env: OWNER_DB_PASSWORD must differ from APP_DB_PASSWORD"
  is_placeholder "$OWP" || [ "${#OWP}" -ge 20 ] || warn "postgres.env: OWNER_DB_PASSWORD is short (< 20 chars)"
  APW="$(get "$P" APP_DB_PASSWORD)"; AU="$(get "$P" APP_DB_USER)"
  [ -n "$AU" ] && [ "$AU" = "$OU" ] && err "postgres.env: APP_DB_USER must differ from POSTGRES_USER (the app must not run as the owner/superuser)"
  [ "$AU" = "udigity_app" ] && err "postgres.env: APP_DB_USER must not be udigity_app (that is the NOLOGIN group role of migration 012)"
  [ -n "$APW" ] && [ "$APW" = "$PW" ] && err "postgres.env: APP_DB_PASSWORD must differ from POSTGRES_PASSWORD"
  is_placeholder "$PW" || [ "${#PW}" -ge 20 ] || warn "postgres.env: POSTGRES_PASSWORD is short (< 20 chars); use openssl rand -base64 32 | tr -d '/+='"
  is_placeholder "$APW" || [ "${#APW}" -ge 20 ] || warn "postgres.env: APP_DB_PASSWORD is short (< 20 chars)"
  if [ -f "$B" ] && ! is_placeholder "$APW"; then
    URL="$(get "$B" DATABASE_URL)"
    if ! is_placeholder "$URL"; then
      rest="${URL#*://}"; cred="${rest%%@*}"; upw="${cred#*:}"; uuser="${cred%%:*}"
      [ "$upw" = "$APW" ] || err "backend.env DATABASE_URL password differs from APP_DB_PASSWORD (or needs URL-encoding)"
      [ "$uuser" = "$AU" ] || err "backend.env DATABASE_URL user must be APP_DB_USER (the limited runtime role), not the owner"
      host="${rest#*@}"; [ "${host%%[:/]*}" = "db" ] || warn "backend.env: DATABASE_URL host is not the compose service 'db'"
    elif [ -n "$(get "$B" DB_PASSWORD)" ]; then
      [ "$(get "$B" DB_PASSWORD)" = "$APW" ] || err "backend.env DB_PASSWORD differs from APP_DB_PASSWORD"
      [ "$(get "$B" DB_USER)" = "$AU" ] || err "backend.env DB_USER must be APP_DB_USER (the limited runtime role)"
    fi
  fi
fi

if [ ! -f "$M" ]; then err "migrate.env not found (copy migrate.env.example; owner credentials for the migrate job)"; else
  check_perms "$M"; check_unknown "$M" "$EX_DIR/migrate.env.example"
  MU="$(get "$M" MIGRATION_DATABASE_URL)"
  if is_placeholder "$MU"; then err "migrate.env: MIGRATION_DATABASE_URL is required (empty or still the placeholder)"
  elif [ -f "$P" ]; then
    rest="${MU#*://}"; cred="${rest%%@*}"; mpw="${cred#*:}"; muser="${cred%%:*}"
    [ "$muser" = "$(get "$P" OWNER_DB_USER)" ] || err "migrate.env: MIGRATION_DATABASE_URL user must be OWNER_DB_USER (the non-superuser schema owner), not the superuser"
    [ "$mpw" = "$(get "$P" OWNER_DB_PASSWORD)" ] || err "migrate.env: MIGRATION_DATABASE_URL password differs from OWNER_DB_PASSWORD (or needs URL-encoding)"
  fi
fi

# nginx server_name must be the host of APP_ORIGIN, otherwise the inner nginx answers 444 to every request (G-12a).
NGX="$HERE/../nginx/conf.d/udigity.conf"
if [ -f "$NGX" ] && [ -f "$B" ]; then
  AOH="$(get "$B" APP_ORIGIN)"; AOH="${AOH%%,*}"; AOH="${AOH#https://}"; AOH="${AOH%%:*}"
  if [ -n "$AOH" ] && ! grep -qE "^[[:space:]]*server_name[[:space:]]+([^;]*[[:space:]])?${AOH//./\.}([[:space:]][^;]*)?;" "$NGX"; then
    err "nginx/conf.d/udigity.conf: no server_name equals the APP_ORIGIN host ($AOH); every request would get no answer"
  fi
fi

if [ ! -f "$F" ]; then err "frontend.env not found (copy frontend.env.example)"; else
  check_perms "$F"; check_unknown "$F" "$EX_DIR/frontend.env.example"
  [ "$(get "$F" NODE_ENV)" = "production" ] || err "frontend.env: NODE_ENV must be production"
  require "$F" INTERNAL_API_URL
  for k in NEXT_PUBLIC_CSRF_COOKIE_NAME NEXT_PUBLIC_PASSWORD_MIN_LENGTH; do
    [ -z "$(get "$F" $k)" ] || warn "frontend.env: $k has no effect at run time (inlined at image build); set it in /opt/udigity/.env and rebuild, equal to the backend value"
  done
  [ "$(get "$F" NEXT_PUBLIC_ENABLE_DEV_PERSONAS)" = "true" ] && err "frontend.env: NEXT_PUBLIC_ENABLE_DEV_PERSONAS must be false in production"
  if [ -f "$B" ]; then
    bs="$(get "$B" SESSION_COOKIE_NAME)"; fs="$(get "$F" SESSION_COOKIE_NAME)"
    [ "${bs:-__Host-udigity_session}" = "${fs:-__Host-udigity_session}" ] || err "SESSION_COOKIE_NAME differs between backend.env and frontend.env"
    bc="$(get "$B" CSRF_COOKIE_NAME)"; fc="$(get "$F" NEXT_PUBLIC_CSRF_COOKIE_NAME)"
    [ "${bc:-__Host-udigity_csrf}" = "${fc:-__Host-udigity_csrf}" ] || err "CSRF cookie name differs (backend CSRF_COOKIE_NAME vs frontend NEXT_PUBLIC_CSRF_COOKIE_NAME)"
    bp="$(get "$B" PASSWORD_MIN_LENGTH)"; fp="$(get "$F" NEXT_PUBLIC_PASSWORD_MIN_LENGTH)"
    [ "${bp:-12}" = "${fp:-12}" ] || warn "PASSWORD_MIN_LENGTH differs between backend.env and frontend.env"
  fi
fi

if [ -f "$K" ]; then
  check_perms "$K"; check_unknown "$K" "$EX_DIR/backup.env.example"
  case "$(get "$K" BACKUP_ENCRYPTION)" in
    gpg) require "$K" GPG_RECIPIENT;;
    age|'') v="$(get "$K" AGE_RECIPIENT)"; [[ "$v" =~ ^age1[02-9ac-hj-np-z]{58}$ ]] || err "backup.env: AGE_RECIPIENT must be a real age public key (age1 + 58 lower-case bech32 characters)";;
    *) err "backup.env: BACKUP_ENCRYPTION must be age or gpg";;
  esac
  # Backup container (policy D19): its own read-only DB role, never the owner or the app role.
  require "$K" BACKUP_DB_PASSWORD
  BU="$(get "$K" BACKUP_DB_USER)"; BU="${BU:-udigity_backup}"; BPW="$(get "$K" BACKUP_DB_PASSWORD)"
  if [ -f "$P" ]; then
    case "$BU" in "$(get "$P" POSTGRES_USER)"|"$(get "$P" OWNER_DB_USER)"|"$(get "$P" APP_DB_USER)"|udigity_app) err "backup.env: BACKUP_DB_USER must be its own role (not the owner or the app role)";; esac
    [ -n "$BPW" ] && { [ "$BPW" = "$(get "$P" POSTGRES_PASSWORD)" ] || [ "$BPW" = "$(get "$P" OWNER_DB_PASSWORD)" ] || [ "$BPW" = "$(get "$P" APP_DB_PASSWORD)" ]; } \
      && err "backup.env: BACKUP_DB_PASSWORD must differ from the owner and app passwords"
  fi
  bt="$(get "$K" BACKUP_TIME)"; [ -z "$bt" ] || [[ "$bt" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || err "backup.env: BACKUP_TIME must be HH:MM (24 h)"
  bd="$(get "$K" BASE_BACKUP_DAY)"; [ -z "$bd" ] || [[ "$bd" =~ ^[1-7]$ ]] || err "backup.env: BASE_BACKUP_DAY must be 1..7"
  for k in KEEP_DAILY KEEP_WEEKLY KEEP_MONTHLY KEEP_BASE; do
    v="$(get "$K" $k)"; [ -z "$v" ] || { is_int "$v" && [ "$v" -gt 0 ]; } || err "backup.env: $k must be a positive integer"
  done
  if [ -f "$B" ]; then
    ctz="$(get "$B" POLICY_COMPANY_TIMEZONE)"; btz="$(get "$K" TZ)"
    [ -n "$ctz" ] && [ "${btz:-UTC}" != "$ctz" ] && warn "backup.env: TZ (${btz:-UTC}) differs from POLICY_COMPANY_TIMEZONE: BACKUP_TIME is read in TZ"
  fi
  for k in WAL_BACKLOG_MAX DISK_ALERT_PCT; do
    v="$(get "$K" $k)"; [ -z "$v" ] || { is_int "$v" && [ "$v" -gt 0 ]; } || err "backup.env: $k must be a positive integer"
  done
  warn "backup.env: backups are stored on this server only (Owner-approved exception): copy them off-server when possible (devops/DEPLOY.md section 11)"
else
  err "backup.env not found: the backup service needs it (copy backup.env.example; devops/DEPLOY.md section 11)"
fi

echo
if [ "$ERR" -gt 0 ]; then echo "FAILED: $ERR error(s), $WARN warning(s)"; exit 1; fi
echo "PASSED: 0 errors, $WARN warning(s)"
