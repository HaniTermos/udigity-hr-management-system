-- 103_reports_export_records.sql — MOD-reports (BE5, plan.md §3.1, §4.1).
-- Export records table (metadata only; no transient files).

CREATE TABLE IF NOT EXISTS export_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  report_type VARCHAR(60) NOT NULL,
  format VARCHAR(20) NOT NULL CHECK (format IN ('csv', 'json', 'excel', 'pdf')),
  row_count INTEGER NOT NULL DEFAULT 0,
  filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_export_records_requested_by
  ON export_records (requested_by, created_at);
