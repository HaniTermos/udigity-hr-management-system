-- 330 MOD-calls: call_attempts  (owner BE3; Increment 4, activated from the Increment 2 draft)
-- Depends on: businesses, employees, contact_reservations (320).
-- Append-only (D20, B3-Q07: attempt time = server now, not editable). Every attempt records one of four outcomes (B3-Q13).
-- reservation_id is nullable only so that the B3-Q05 "keepAttemptOnly" branch can store a real call made after the lease was lost.
-- The FK from fulfils_follow_up_id to follow_ups is added in 340 (follow_ups does not exist yet).

CREATE TABLE IF NOT EXISTS call_attempts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  agent_id             UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  reservation_id       UUID REFERENCES contact_reservations(id) ON DELETE RESTRICT,
  attempted_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  channel              VARCHAR(20) NOT NULL DEFAULT 'outbound_call'
                       CHECK (channel IN ('outbound_call', 'inbound_other')),
  outcome              VARCHAR(30) NOT NULL
                       CHECK (outcome IN ('on_hold', 'needs_another_call', 'rejected', 'accepted')),
  outcome_applied      BOOLEAN NOT NULL DEFAULT true,
  reservation_held     BOOLEAN NOT NULL DEFAULT true,
  notes                VARCHAR(4000),
  rejection_reason     VARCHAR(1000),
  client_needs_note    VARCHAR(4000),
  service_interest     VARCHAR(500),
  fulfils_follow_up_id UUID,
  idempotency_key      UUID NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT call_attempts_rejected_reason CHECK (outcome <> 'rejected' OR rejection_reason IS NOT NULL),
  CONSTRAINT call_attempts_unapplied_means_lost CHECK (outcome_applied OR NOT reservation_held)
);

-- A double submit produces one attempt row (SEQ-11 retry); scoped to the agent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_attempts_agent_key ON call_attempts(agent_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_call_attempts_business ON call_attempts(business_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_attempts_agent ON call_attempts(agent_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_attempts_reservation ON call_attempts(reservation_id) WHERE reservation_id IS NOT NULL;

-- Immutability: attempts are facts. UPDATE and DELETE are rejected by the database.
CREATE OR REPLACE FUNCTION call_attempts_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'call_attempts is append-only' USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_attempts_immutable ON call_attempts;
CREATE TRIGGER trg_call_attempts_immutable
  BEFORE UPDATE OR DELETE ON call_attempts
  FOR EACH ROW EXECUTE FUNCTION call_attempts_immutable();
