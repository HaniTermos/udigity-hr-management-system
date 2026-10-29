-- Operator failure alerts (2026-10-29 request: "log alerts on email for any failure").
-- Any process records an alert here; the worker emails unsent rows to ALERT_EMAIL_TO (J-14).
-- dedupe_key = kind + 15-minute bucket, so a repeating fault sends one email per window.
-- Additive only.

CREATE TABLE IF NOT EXISTS ops_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 100),
  detail TEXT NOT NULL CHECK (char_length(detail) BETWEEN 1 AND 500),
  dedupe_key TEXT NOT NULL UNIQUE,
  occurrences INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_unsent ON ops_alerts(created_at) WHERE sent_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') THEN
    GRANT SELECT, INSERT, UPDATE ON ops_alerts TO udigity_app;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'skipping ops_alerts grant (insufficient privilege)';
END $$;
