-- 013_identity_session_step_up.sql — MOD-identity (BE-LEAD for BE1, plan.md §3.1 range 010–099).
-- R2-02 / EX-2: report export needs a step-up TOTP within the last 10 minutes. The time of the last
-- successful step-up is kept on the session (forward-only, nullable, no backfill).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS step_up_at TIMESTAMPTZ;
