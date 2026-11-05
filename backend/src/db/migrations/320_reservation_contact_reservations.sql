-- 320 MOD-reservation: contact_reservations  (owner BE3; Increment 4, activated from the Increment 2 draft)
-- Depends on: businesses (BE2, 200), employees (001).
-- SM-RESERVATION-001. One row per acquire. At most one Active row per business (IC-15).
-- Timing values are policy SETs (DEC-004 demonstration default: lease 300 s, heartbeat 60 s, idle 15 min, warning 13 min, max 60 min).
-- Correctness uses the timestamps in the row (lazy evaluation); the J-05 sweep is housekeeping only.
-- lease_token is a random UUID returned to the holder only and compared on renew/release/save. It is not a credential on its own
-- (the session cookie is still required). It is never logged or put in audit/outbox payloads.

CREATE TABLE IF NOT EXISTS contact_reservations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  holder_id             UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  lease_token           UUID NOT NULL DEFAULT gen_random_uuid(),
  state                 VARCHAR(12) NOT NULL DEFAULT 'active'
                        CHECK (state IN ('active', 'released', 'expired', 'overridden')),
  acquired_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_renewed_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_expires_at      TIMESTAMPTZ NOT NULL,
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  max_window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at              TIMESTAMPTZ,
  end_reason            VARCHAR(20)
                        CHECK (end_reason IN ('released', 'call_saved', 'lease_elapsed', 'idle', 'max_total', 'access_denied', 'overridden')),
  ended_by              UUID REFERENCES employees(id) ON DELETE RESTRICT,
  override_reason       VARCHAR(500),
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT contact_reservations_end_consistent
    CHECK ((state = 'active' AND ended_at IS NULL AND end_reason IS NULL)
        OR (state <> 'active' AND ended_at IS NOT NULL AND end_reason IS NOT NULL)),
  CONSTRAINT contact_reservations_override_reason
    CHECK (state <> 'overridden' OR (override_reason IS NOT NULL AND ended_by IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_reservations_active_business
  ON contact_reservations(business_id) WHERE state = 'active';
CREATE INDEX IF NOT EXISTS idx_contact_reservations_active_expiry
  ON contact_reservations(lease_expires_at) WHERE state = 'active';
CREATE INDEX IF NOT EXISTS idx_contact_reservations_holder
  ON contact_reservations(holder_id, acquired_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_reservations_business_history
  ON contact_reservations(business_id, acquired_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_reservations_ended
  ON contact_reservations(ended_at) WHERE ended_at IS NOT NULL;
