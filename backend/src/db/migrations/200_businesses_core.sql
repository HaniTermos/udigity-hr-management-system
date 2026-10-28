-- 200_businesses_core.sql — MOD-business (BE2). Increment 2.
-- Minimal business aggregate: only the columns the access-facts view (900) needs. Increment 3 adds
-- the directory columns (phones, socials, categories, notes, calling status) with new migrations.
-- Forward-only, non-destructive. FKs to employees are RESTRICT (arch-b §4).

CREATE TABLE IF NOT EXISTS businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  created_by    UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  archived_at   TIMESTAMPTZ,
  archived_by   UUID REFERENCES employees(id) ON DELETE RESTRICT,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_businesses_created_by ON businesses(created_by);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at);
