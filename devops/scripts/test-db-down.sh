#!/usr/bin/env sh
# Stop and remove the isolated test PostgreSQL. Data is on tmpfs, so it is gone afterwards.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
docker compose -f "$ROOT/docker-compose.test.yml" down
