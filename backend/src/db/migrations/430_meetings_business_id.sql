-- 430 MOD-meetings (owner BE4; Increment 5). Denormalise the deal's business onto the meeting so the
-- calendar list applies access.scopeFilter on its own table (ADR-006: no read of another module's
-- table; same pattern as projects.business_id). Forward-only: nullable add, lossless backfill, then NOT NULL.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE RESTRICT;
UPDATE meetings m SET business_id = d.business_id FROM deals d WHERE d.id = m.deal_id AND m.business_id IS NULL;
ALTER TABLE meetings ALTER COLUMN business_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_business ON meetings (business_id);
