-- 100_platform_core.sql — MOD-platform (BE5, plan.md §7/§8, arch-a §4.1-§4.6, ADR-019).
-- Technical tables only: transactional outbox, per-consumer completion, background jobs,
-- idempotency records, worker heartbeats. No business data. Forward-only, non-destructive.

-- ---------------------------------------------------------------------------
-- Outbox (ADR-007). Payload = ids and small scalars only (never secrets / free text).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  aggregate_type VARCHAR(60) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  state VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'done', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TIMESTAMPTZ,
  last_error VARCHAR(500),
  relayed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_due ON outbox_events (next_attempt_at, created_at) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate ON outbox_events (aggregate_type, aggregate_id);

-- Per-consumer completion: a consumer runs at most once per event (idempotency by event id + name).
CREATE TABLE IF NOT EXISTS outbox_consumer_runs (
  event_id UUID NOT NULL REFERENCES outbox_events(id) ON DELETE RESTRICT,
  consumer VARCHAR(100) NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, consumer)
);

-- ---------------------------------------------------------------------------
-- Background jobs (ADR-004/005). Claimed with FOR UPDATE SKIP LOCKED + lease.
-- dedupe_key = slot for recurring jobs, caller key for enqueued jobs; unique per kind.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(60) NOT NULL,
  dedupe_key VARCHAR(200) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  state VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'done', 'dead')),
  run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  lease_until TIMESTAMPTZ,
  last_error VARCHAR(500),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_background_jobs_kind_dedupe UNIQUE (kind, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_due ON background_jobs (run_at) WHERE state = 'queued';

-- ---------------------------------------------------------------------------
-- Idempotency records (IC-23, plan §4.7). status 0 = request in progress (claim).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_records (
  actor_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  operation VARCHAR(100) NOT NULL,
  idem_key VARCHAR(100) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (actor_id, operation, idem_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires ON idempotency_records (expires_at);

-- ---------------------------------------------------------------------------
-- Worker heartbeats (J-09, /health/worker).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id VARCHAR(120) PRIMARY KEY,
  pid INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_beat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
