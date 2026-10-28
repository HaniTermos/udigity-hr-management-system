-- 101_notifications_deliveries.sql — MOD-notifications (BE5, plan.md §7, arch-a §4.6.1).
-- NotificationDelivery rows (email + in-app), created by outbox consumers; dispatched by J-02.
-- Content is built at SEND time (HR-7/C6); no rendered body is stored.
-- Reminder rows (J-01) arrive in Increment 6 in their own migration.

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Consumer idempotency: e.g. 'e03:<securityTokenId>'. One delivery per key.
  dedupe_key VARCHAR(200) NOT NULL UNIQUE,
  event_id UUID REFERENCES outbox_events(id) ON DELETE RESTRICT,
  family VARCHAR(20) NOT NULL CHECK (family IN ('security', 'business')),
  template VARCHAR(80) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'in_app')),
  recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  source_type VARCHAR(60),
  source_id VARCHAR(64),
  state VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'retry_pending', 'sent', 'failed', 'suppressed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TIMESTAMPTZ,
  last_error VARCHAR(500),
  provider_message_id VARCHAR(200),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_due
  ON notification_deliveries (next_attempt_at) WHERE state IN ('pending', 'retry_pending');
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON notification_deliveries (recipient_id, created_at);

-- One-time secrets needed at send time (raw reset / setup token). Stored encrypted
-- (AES-256-GCM, key derived from SESSION_SECRET), never in the outbox payload, logs or audit.
-- The ciphertext is cleared once the email is sent, failed or suppressed.
CREATE TABLE IF NOT EXISTS notification_secrets (
  ref_id UUID PRIMARY KEY,
  ciphertext TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
