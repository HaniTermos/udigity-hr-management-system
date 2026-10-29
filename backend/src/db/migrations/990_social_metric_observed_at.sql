-- 990_social_metric_observed_at.sql — policy baseline 2026-10-29 §D13 (additive only).
-- Store when each social metric was observed: one timestamp per metric, set only when that value is
-- entered or changed (latest values only; full history is deferred). NULL = the value is Unknown.
-- metrics_recorded_at stays (latest of the two) for existing readers.

ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS followers_observed_at TIMESTAMPTZ;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS last_post_observed_at TIMESTAMPTZ;

-- Backfill: a known value recorded before this migration was observed at metrics_recorded_at.
UPDATE social_accounts
   SET followers_observed_at = metrics_recorded_at
 WHERE followers IS NOT NULL AND followers_observed_at IS NULL AND metrics_recorded_at IS NOT NULL;
UPDATE social_accounts
   SET last_post_observed_at = metrics_recorded_at
 WHERE last_post_date IS NOT NULL AND last_post_observed_at IS NULL AND metrics_recorded_at IS NOT NULL;
