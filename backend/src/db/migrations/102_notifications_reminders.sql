-- 102_notifications_reminders.sql — MOD-notifications (BE5, plan.md §7, arch-a §4.6.1).
-- Reminders table for follow-ups and meetings (J-01 dispatch).

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key VARCHAR(200) NOT NULL UNIQUE,
  source_type VARCHAR(60) NOT NULL CHECK (source_type IN ('follow_up', 'meeting')),
  source_id UUID NOT NULL,
  recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  channel VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  lead_minutes INTEGER NOT NULL DEFAULT 0,
  state VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'sent', 'cancelled', 'failed', 'suppressed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error VARCHAR(500),
  sent_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_due
  ON reminders (scheduled_for) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_source
  ON reminders (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_reminders_recipient
  ON reminders (recipient_id, created_at);
