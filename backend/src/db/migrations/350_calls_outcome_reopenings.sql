-- 350 MOD-calls: outcome_reopenings  (owner BE3; Increment 4, activated from the Increment 2 draft)
-- Depends on: businesses (BE2, 200), employees (001).
-- DEC-016: Owner-only reopen of a Rejected business with a reason -> Pending.
-- B3-Q12: Owner re-queue after a deal Not proceeding (outcome stays Accepted until then; re-queue -> Pending, history kept, reason required).

CREATE TABLE IF NOT EXISTS outcome_reopenings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  kind             VARCHAR(10) NOT NULL CHECK (kind IN ('reopen', 'requeue')),
  previous_outcome VARCHAR(30) NOT NULL
                   CHECK (previous_outcome IN ('pending', 'on_hold', 'needs_another_call', 'rejected', 'accepted')),
  new_outcome      VARCHAR(30) NOT NULL DEFAULT 'pending'
                   CHECK (new_outcome IN ('pending', 'on_hold', 'needs_another_call', 'rejected', 'accepted')),
  reason           VARCHAR(1000) NOT NULL,
  performed_by     UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  performed_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT outcome_reopenings_kind_from CHECK (
    (kind = 'reopen' AND previous_outcome = 'rejected') OR (kind = 'requeue' AND previous_outcome = 'accepted'))
);
CREATE INDEX IF NOT EXISTS idx_outcome_reopenings_business ON outcome_reopenings(business_id, performed_at DESC);
