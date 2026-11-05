# Stop and remove the isolated test PostgreSQL. Data is on tmpfs, so it is gone afterwards.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
docker compose -f (Join-Path $root 'docker-compose.test.yml') down
