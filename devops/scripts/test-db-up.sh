#!/usr/bin/env sh
# Start the isolated test PostgreSQL (host port 55432) and wait until it is healthy.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
docker compose -f "$ROOT/docker-compose.test.yml" up -d --wait
echo "Test DB ready."
echo "TEST_DATABASE_URL=postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test"
