#!/usr/bin/env bash
# Deploy or roll back the production stack on the server (G-10, G-18). Run from /opt/udigity as the deploy user.
#
#   devops/scripts/deploy.sh              build the checked-out commit and start it (backup -> build -> migrate -> up)
#   devops/scripts/deploy.sh rollback     start the previously recorded image tag (see the rollback note in DEPLOY.md 12)
#   devops/scripts/deploy.sh --skip-gate "reason"   deploy WITHOUT the CODE gate (gap 4). Only with an explicit reason (for example
#                                         "gate passed on the workstation at <sha>" when the server has no Node); the reason, date and
#                                         user are appended to /opt/udigity/gate-skips.log. The image scan below still runs.
#
# A deploy first runs devops/scripts/predeploy-gate.sh (typecheck, lint, tests, npm audit, gitleaks, config checks) and, after the
# build, predeploy-gate.sh images (Trivy; warns instead of failing when the scanner image cannot be pulled). A failing gate stops
# the deploy before the running stack is touched.
#
# The running tag is persisted in /opt/udigity/.env (UDIGITY_TAG=...), which compose reads on every command, so a reboot or a
# plain `docker compose up -d` can never fall back to another image. The previous tag is kept in .previous-tag; old images are
# never pruned here. Needs the env files from DEPLOY.md section 7. Never prints secret values.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
DC=(docker compose -f docker-compose.prod.yml)
ENVF="$ROOT/.env"

current_tag() { sed -n 's/^UDIGITY_TAG=//p' "$ENVF" 2>/dev/null | tail -n1; }
write_tag() { # tag
  touch "$ENVF"; chmod 600 "$ENVF"
  if grep -q '^UDIGITY_TAG=' "$ENVF"; then sed -i "s/^UDIGITY_TAG=.*/UDIGITY_TAG=$1/" "$ENVF"; else echo "UDIGITY_TAG=$1" >> "$ENVF"; fi
}

SKIP_REASON=""; ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-gate) shift; SKIP_REASON="${1:-}"; [ -n "$SKIP_REASON" ] || { echo "--skip-gate needs a written reason: --skip-gate \"why\"" >&2; exit 2; }; shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

case "${1:-deploy}" in
  rollback)
    PREV="$(cat "$ROOT/.previous-tag" 2>/dev/null || true)"; [ -n "$PREV" ] || { echo "no .previous-tag recorded" >&2; exit 1; }
    for i in udigity-backend udigity-frontend udigity-backup; do
      docker image inspect "$i:$PREV" >/dev/null 2>&1 || { echo "image $i:$PREV is gone (pruned?): rebuild that commit or restore from backup" >&2; exit 1; }
    done
    echo "NOTE: image rollback is safe only if the release you are leaving ran no non-additive migration (DEPLOY.md 12)."
    cur="$(current_tag)"; write_tag "$PREV"; [ -z "$cur" ] || echo "$cur" > "$ROOT/.previous-tag"
    "${DC[@]}" up -d --wait --wait-timeout 240 --scale backup=1
    "${DC[@]}" ps; exit 0 ;;
  deploy) ;;
  *) echo "usage: deploy.sh [deploy|rollback]" >&2; exit 2 ;;
esac

TAG="$(git rev-parse --short=12 HEAD)"
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "working tree has local changes: deploy a clean commit" >&2; exit 1; }
echo "== check-env =="; devops/scripts/check-env.sh
if [ -n "$SKIP_REASON" ]; then
  echo "WARNING: pre-deploy CODE gate SKIPPED. Reason: $SKIP_REASON" >&2
  printf '%s %s skipped the gate for %s: %s
' "$(date -u +%FT%TZ)" "$(id -un)" "$TAG" "$SKIP_REASON" >> "$ROOT/gate-skips.log"
else
  echo "== pre-deploy gate (code) =="; devops/scripts/predeploy-gate.sh code || { echo "gate failed: nothing was changed on the server. Fix it, or (with a reason) use --skip-gate" >&2; exit 1; }
fi
echo "== backup before the update (skipped on a first install) =="
if [ -n "$(current_tag)" ] && [ -n "$("${DC[@]}" ps -q backup 2>/dev/null)" ]; then
  "${DC[@]}" exec -T backup backupd nightly
  [ "$(current_tag)" = "$TAG" ] || current_tag > "$ROOT/.previous-tag"
fi
export UDIGITY_TAG="$TAG"
echo "== build $TAG =="; "${DC[@]}" build
echo "== pre-deploy gate (images) =="; devops/scripts/predeploy-gate.sh images || { echo "image scan failed: the new images are built but NOT started (the running stack is untouched)" >&2; exit 1; }
echo "== db + migrate =="
"${DC[@]}" up -d --wait db
"${DC[@]}" --profile tools run --rm migrate
# G-18: the backup role's ops_alerts grant needs the migrations and is lost after a restore: re-apply it every deploy (idempotent).
"${DC[@]}" exec -T db sh /docker-entrypoint-initdb.d/20-backup-role.sh
write_tag "$TAG"        # persist only after the migration succeeded
echo "== up =="
"${DC[@]}" up -d --wait --wait-timeout 240 --scale backup=1 || { "${DC[@]}" ps; echo "stack did not become healthy; rollback: devops/scripts/deploy.sh rollback" >&2; exit 1; }
"${DC[@]}" ps
echo "deployed $TAG (previous: $(cat "$ROOT/.previous-tag" 2>/dev/null || echo none))"
