-- 400 MOD-deals (owner BE4; Increment 5, promoted from the Increment 2 draft after ORCH-2).
-- Range 400-499 (BE4). Forward-only, non-destructive. FKs RESTRICT.
-- Depends on: employees (001), businesses (BE2, 2xx), call_attempts (BE3, 3xx).
-- Policies: DEC-017 (one open deal per business), DEC-018 (agreement ref + payment date, optional amount/currency,
-- no attachments), DEC-006 (closure_reviews only used in ownerVerify mode), OQ-15.
-- All of these are "Demonstration alternative - not approved" (docs/policy-defaults.md).

CREATE SEQUENCE IF NOT EXISTS deal_code_seq START 1;

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE DEFAULT ('DL-' || lpad(nextval('deal_code_seq')::text, 4, '0')),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  -- E5: exactly one deal per accepted attempt (also makes a replayed call save idempotent)
  accepted_attempt_id UUID NOT NULL UNIQUE REFERENCES call_attempts(id) ON DELETE RESTRICT,
  accepted_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  stage VARCHAR(30) NOT NULL DEFAULT 'accepted_opportunity'
    CHECK (stage IN ('accepted_opportunity','signed','paid','signed_and_paid','closed','not_proceeding')),
  client_needs_note TEXT NOT NULL,
  -- current Developer (NULL = "Developer not yet assigned", E3 derived). History: deal_developer_assignments
  assigned_developer_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  -- commercial facts (DEC-018). Order-independent (OQ-05). Evidence = reference + date, no attachments (ADR-012)
  signature_date DATE,
  signature_reference VARCHAR(200),
  signature_recorded_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  signature_recorded_at TIMESTAMPTZ,
  payment_date DATE,
  payment_reference VARCHAR(200),
  payment_amount NUMERIC(14,2) CHECK (payment_amount IS NULL OR payment_amount >= 0),
  payment_currency VARCHAR(3),            -- validated in service against setting deals.currencies (NEEDS VALUE)
  payment_recorded_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  payment_recorded_at TIMESTAMPTZ,
  -- closure
  closed_at TIMESTAMPTZ,
  closed_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  closure_mode VARCHAR(20) CHECK (closure_mode IS NULL OR closure_mode IN ('ownerVerify','direct')), -- flag value in force at closure
  -- not proceeding
  not_proceeding_reason TEXT,
  not_proceeding_at TIMESTAMPTZ,
  not_proceeding_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- stage <-> facts invariants (guards at the database level)
  CONSTRAINT deals_signed_has_fact CHECK (stage NOT IN ('signed','signed_and_paid') OR signature_date IS NOT NULL),
  CONSTRAINT deals_paid_has_fact CHECK (stage NOT IN ('paid','signed_and_paid') OR payment_date IS NOT NULL),
  CONSTRAINT deals_closed_needs_both CHECK (
    stage <> 'closed' OR (signature_date IS NOT NULL AND payment_date IS NOT NULL AND closed_at IS NOT NULL AND closed_by_id IS NOT NULL)),
  CONSTRAINT deals_np_has_reason CHECK (stage <> 'not_proceeding' OR (not_proceeding_reason IS NOT NULL AND not_proceeding_at IS NOT NULL)),
  CONSTRAINT deals_amount_needs_currency CHECK (payment_amount IS NULL OR payment_currency IS NOT NULL)
);
-- DEC-017: one OPEN deal per business, many over time
CREATE UNIQUE INDEX IF NOT EXISTS uq_deals_one_open_per_business
  ON deals (business_id) WHERE stage NOT IN ('closed','not_proceeding');
CREATE INDEX IF NOT EXISTS idx_deals_business ON deals (business_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals (stage);
CREATE INDEX IF NOT EXISTS idx_deals_developer ON deals (assigned_developer_id) WHERE assigned_developer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_closed_at ON deals (closed_at) WHERE closed_at IS NOT NULL;

-- Developer attribution history (E2/E3). Current developer is denormalised on deals.assigned_developer_id.
CREATE TABLE IF NOT EXISTS deal_developer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  developer_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigned_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dda_one_current ON deal_developer_assignments (deal_id) WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dda_developer ON deal_developer_assignments (developer_id);

-- DEC-006 Alt B review items (a review item on Signed and paid, not a stage). Unused in 'direct' mode.
CREATE TABLE IF NOT EXISTS closure_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','verified','rejected')),
  requested_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_note TEXT,
  decided_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT closure_reviews_decided CHECK (
    (status = 'requested' AND decided_at IS NULL) OR
    (status = 'verified' AND decided_at IS NOT NULL AND decided_by_id IS NOT NULL) OR
    (status = 'rejected' AND decided_at IS NOT NULL AND decided_by_id IS NOT NULL AND reject_reason IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_closure_reviews_one_open ON closure_reviews (deal_id) WHERE status = 'requested';
CREATE INDEX IF NOT EXISTS idx_closure_reviews_deal ON closure_reviews (deal_id, requested_at DESC);

-- Append-only commercial history: fact removal, not-proceeding reopen, handoff updates (original values kept).
-- Deviation from ERD-4 (which has no deal history table): needed because "recorded fact removed" and
-- "Not proceeding -> Accepted" must keep prior values, and audit payloads are not queryable by screens. Flagged for review.
CREATE TABLE IF NOT EXISTS deal_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  change_type VARCHAR(40) NOT NULL CHECK (change_type IN
    ('signature_recorded','payment_recorded','fact_removed','handoff_updated','not_proceeding','reopened','closed')),
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  actor_id UUID REFERENCES employees(id) ON DELETE RESTRICT,   -- NULL = System
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_changes_deal ON deal_changes (deal_id, created_at);
