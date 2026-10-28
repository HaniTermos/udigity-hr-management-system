-- 202_corrections_requests.sql — MOD-corrections (BE2). Increment 3.
-- SM-DATAFIX-001 (Demonstration alternative — not approved, OI-19): Submitted → In review → Resolved /
-- Closed (no change needed) / Rejected (request) / Withdrawn. In review → Submitted on release or reviewer
-- deactivation (N-4). Terminal states never reopen. Forward-only, FKs RESTRICT.

CREATE TABLE IF NOT EXISTS data_correction_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  requested_by      UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  issue_type        VARCHAR(60) NOT NULL,
  field             VARCHAR(120),
  description       VARCHAR(2000) NOT NULL,
  suggested_value   VARCHAR(1000),
  status            VARCHAR(20) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'in_review', 'resolved', 'closed', 'rejected', 'withdrawn')),
  reviewer_id       UUID REFERENCES employees(id) ON DELETE RESTRICT,
  review_started_at TIMESTAMPTZ,
  resolution_note   VARCHAR(2000),
  resolved_by       UUID REFERENCES employees(id) ON DELETE RESTRICT,
  resolved_at       TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dcr_in_review_has_reviewer CHECK (status <> 'in_review' OR reviewer_id IS NOT NULL),
  CONSTRAINT dcr_terminal_has_resolver CHECK (status NOT IN ('resolved', 'closed', 'rejected') OR resolved_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_dcr_business_open ON data_correction_requests(business_id) WHERE status IN ('submitted', 'in_review');
CREATE INDEX IF NOT EXISTS idx_dcr_requested_by ON data_correction_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_dcr_status ON data_correction_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dcr_reviewer_open ON data_correction_requests(reviewer_id) WHERE status = 'in_review';
