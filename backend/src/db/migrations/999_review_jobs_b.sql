-- Review fix (H-06): operator alerts track delivery per recipient, and an alert that used every attempt is
-- marked failed (visible on the Owner dashboard) instead of silently never being claimed again.
--   delivered_to  recipients that already accepted this alert (never emailed again)
--   failed_at     set when MAX_ATTEMPTS is reached with recipients still missing
-- Additive only. Table-level grants (997) cover the new columns.
ALTER TABLE ops_alerts ADD COLUMN IF NOT EXISTS delivered_to TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE ops_alerts ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_ops_alerts_failed ON ops_alerts(failed_at) WHERE failed_at IS NOT NULL;
