# Start the isolated test PostgreSQL (host port 55432) and wait until it is healthy.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
docker compose -f (Join-Path $root 'docker-compose.test.yml') up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'test DB failed to start' }
Write-Host 'Test DB ready.'
Write-Host 'TEST_DATABASE_URL=postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test'
