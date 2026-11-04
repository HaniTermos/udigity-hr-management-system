#!/usr/bin/env bash
# Host-side watchdog for the Udigity stack (G-07, G-08). No new service: run it from the deploy user's cron every 10 minutes.
#
#   */10 * * * *  cd /opt/udigity && devops/scripts/host-monitor.sh >> /var/log/udigity-monitor.log 2>&1
#
# Checks (any failure = one alert): public /login over HTTPS, host disk usage, containers not running or unhealthy, raw WAL
# backlog, last successful nightly dump age, certificate expiry of the public host, worker heartbeat.
# Alert channel: e-mail to ALERT_EMAIL_TO through the host's `mail`/`sendmail` if installed, always the log, and a state file so
# the same problem mails at most once per 6 hours. This runs OUTSIDE the stack on purpose: if db/backup/worker/SMTP are down,
# the in-app alerts (ops_alerts) are silent too. It is read-only: it never restarts or changes anything.
#
# Settings (environment or devops/env/monitor.env, optional): HOST (default hrsystem.udigity.com), DISK_WARN_PCT (80),
# WAL_MAX (20), DUMP_MAX_HOURS (26), CERT_MIN_DAYS (14), MAIL_TO (default: first ALERT_EMAIL_TO of backend.env), PING_URL
# (optional dead-man URL, e.g. healthchecks.io, called only when every check passed).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
if [ -f devops/env/monitor.env ]; then . devops/env/monitor.env; fi
HOST="${HOST:-hrsystem.udigity.com}"; DISK_WARN_PCT="${DISK_WARN_PCT:-80}"; WAL_MAX="${WAL_MAX:-20}"
DUMP_MAX_HOURS="${DUMP_MAX_HOURS:-26}"; CERT_MIN_DAYS="${CERT_MIN_DAYS:-14}"
MAIL_TO="${MAIL_TO:-$(sed -n 's/^ALERT_EMAIL_TO=//p' devops/env/backend.env 2>/dev/null | tail -n1 | tr -d '"\r' | cut -d, -f1)}"
STATE="${MONITOR_STATE:-$HOME/.udigity-monitor-state}"; mkdir -p "$STATE"
DC=(docker compose -f docker-compose.prod.yml)
PROBLEMS=()
bad() { PROBLEMS+=("$1"); }

# 1. public site (through the host proxy and TLS)
code="$(curl -sS -o /dev/null -m 15 -w '%{http_code}' "https://$HOST/login" 2>/dev/null || echo 000)"
[ "$code" = 200 ] || bad "public https://$HOST/login answered $code"
# 2. host disk (root and the Docker data directory, where the volumes live)
for d in / "$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"; do
  pct="$(df -P "$d" 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')"
  if [[ "$pct" =~ ^[0-9]+$ ]] && [ "$pct" -ge "$DISK_WARN_PCT" ]; then bad "disk $d is ${pct}% full"; fi
done
# 3. containers
ps_out="$("${DC[@]}" ps -a --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null)"
[ -n "$ps_out" ] || bad "docker compose ps returned nothing (Docker down or wrong directory)"
while read -r svc st hl; do
  [ -n "$svc" ] || continue
  [ "$svc" = migrate ] && continue
  [ "$st" = running ] || bad "service $svc is $st"
  [ "$hl" != unhealthy ] || bad "service $svc is unhealthy"
done <<< "$ps_out"
# 4. WAL backlog and backup age (read inside the backup container; if it is down, check 3 already complained)
n="$("${DC[@]}" exec -T backup sh -c 'ls -1 /wal 2>/dev/null | grep -vc "[.]tmp$"' 2>/dev/null | tr -d '\r\n')"
if [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -gt "$WAL_MAX" ]; then bad "raw WAL backlog is $n files (limit $WAL_MAX): archive/encryption stalled, the disk will fill"; fi
fresh="$("${DC[@]}" exec -T backup sh -c "find /backups/.last-success -mmin -$((DUMP_MAX_HOURS * 60)) 2>/dev/null | wc -l" 2>/dev/null | tr -d '\r\n')"
[ "$fresh" = 1 ] || bad "no successful nightly dump in the last $DUMP_MAX_HOURS h"
# 5. certificate served on the public port
exp="$(echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
if [ -n "$exp" ]; then
  days=$(( ($(date -d "$exp" +%s) - $(date +%s)) / 86400 ))
  [ "$days" -ge "$CERT_MIN_DAYS" ] || bad "certificate for $HOST expires in $days days"
else
  bad "could not read the certificate of $HOST:443"
fi
# 6. worker heartbeat
w="$("${DC[@]}" exec -T backend node -e "fetch('http://127.0.0.1:5000/health/worker').then(r=>console.log(r.status)).catch(()=>console.log(0))" 2>/dev/null | tr -d '\r\n')"
[ "$w" = 200 ] || bad "worker heartbeat check answered ${w:-none}"

if [ "${#PROBLEMS[@]}" -eq 0 ]; then
  rm -f "$STATE"/* 2>/dev/null
  if [ -n "${PING_URL:-}" ]; then curl -fsS -m 10 -o /dev/null "$PING_URL" || true; fi
  exit 0
fi
body="$(printf '%s\n' "${PROBLEMS[@]}")"
echo "$(date -Is) ALERT: $(printf '%s; ' "${PROBLEMS[@]}")"
key="$(printf '%s' "$body" | sha256sum | cut -c1-16)"
if [ ! -f "$STATE/$key" ] || [ -n "$(find "$STATE/$key" -mmin +360)" ]; then
  touch "$STATE/$key"
  if [ -n "$MAIL_TO" ]; then
    if command -v mail >/dev/null 2>&1; then
      printf '%s\n' "$body" | mail -s "[Udigity] $HOST needs attention" "$MAIL_TO"
    elif command -v sendmail >/dev/null 2>&1; then
      printf 'To: %s\nSubject: [Udigity] %s needs attention\n\n%s\n' "$MAIL_TO" "$HOST" "$body" | sendmail -t
    else
      echo "no mail/sendmail on this host: install msmtp, or rely on PING_URL / the external uptime monitor"
    fi
  fi
fi
exit 1
