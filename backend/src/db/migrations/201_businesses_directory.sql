-- 201_businesses_directory.sql — MOD-business (BE2). Increment 3.
-- Directory columns from the approved Data Entry forms (SCR-DE-002/004): name, branch, category,
-- phones, social accounts, website, notes; categories (WF-BIZ-003); field-level edit history.
-- Duplicate keys (DR-3, DR-8): global UNIQUE normalized phone; UNIQUE (normalized name, branch) key for
-- DEC-013 NM-B (Demonstration alternative — not approved). Both make concurrent saves race-safe at DB level.
-- Forward-only, non-destructive. FKs RESTRICT (arch-b §4). Every new column on `businesses` is nullable or
-- defaulted, so rows written by earlier increments (and other modules' tests) keep inserting.

-- Trigram similarity for DEC-013 SN-1 (similar-name warning). Trusted extension (PG13+).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------------------------
-- Categories (WF-BIZ-003). Normalized name unique among ALL categories, including inactive.
-- Removal = deactivate (CR-1, Demonstration alternative — not approved). "Other" always exists (OI-21).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(80) NOT NULL,
  normalized_name  VARCHAR(80) NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_system        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by       UUID REFERENCES employees(id) ON DELETE RESTRICT,
  updated_by       UUID REFERENCES employees(id) ON DELETE RESTRICT,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT categories_system_active CHECK (NOT is_system OR is_active)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_normalized_name ON categories(normalized_name);

INSERT INTO categories (name, normalized_name, is_system)
VALUES ('Other', 'other', TRUE)
ON CONFLICT (normalized_name) DO NOTHING;

-- Default category for rows inserted without one (older increments, other modules' fixtures).
CREATE OR REPLACE FUNCTION businesses_default_category() RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT id FROM categories WHERE is_system ORDER BY created_at LIMIT 1 $$;

-- ---------------------------------------------------------------------------------------------
-- Business directory columns.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS branch            VARCHAR(120);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS normalized_name   VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS normalized_branch VARCHAR(120) NOT NULL DEFAULT '';
-- DEC-013 NM-B key = normalized name + '|' + normalized branch. Set by the API on every create/edit;
-- NULL on rows written before Increment 3 (they are still matched by the application check).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS name_key          VARCHAR(400);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS category_id       UUID REFERENCES categories(id) ON DELETE RESTRICT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS website           VARCHAR(2048);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notes             VARCHAR(4000);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS updated_by        UUID REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE businesses ALTER COLUMN category_id SET DEFAULT businesses_default_category();

-- Lossless backfill of the derived columns for rows that predate this migration.
UPDATE businesses SET category_id = businesses_default_category() WHERE category_id IS NULL;
UPDATE businesses
   SET normalized_name = btrim(regexp_replace(lower(name), '[^[:alnum:]]+', ' ', 'g'))
 WHERE normalized_name IS NULL;

ALTER TABLE businesses ALTER COLUMN category_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_name_key ON businesses(name_key);
CREATE INDEX IF NOT EXISTS idx_businesses_normalized_name ON businesses(normalized_name);
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_archived ON businesses(archived_at);

-- ---------------------------------------------------------------------------------------------
-- Phones (VR-3/4/6). Global uniqueness of the normalized phone = DR-3 + DR-8 (archived included, OI-26).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_phones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  country_code      VARCHAR(8) NOT NULL,
  number            VARCHAR(32) NOT NULL,
  normalized_phone  VARCHAR(20) NOT NULL,
  position          SMALLINT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_phones_normalized ON business_phones(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_business_phones_business ON business_phones(business_id);
CREATE INDEX IF NOT EXISTS idx_business_phones_trgm ON business_phones USING gin (normalized_phone gin_trgm_ops);

-- ---------------------------------------------------------------------------------------------
-- Social accounts (VR-7..10). Followers / last post nullable = "Unknown", never 0 (DEC-014/023,
-- Demonstration alternative — not approved). Latest value only; metrics_recorded_at kept.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  platform             VARCHAR(30) NOT NULL,
  handle               VARCHAR(255) NOT NULL,
  normalized_handle    VARCHAR(255) NOT NULL,
  followers            INTEGER CHECK (followers IS NULL OR followers >= 0),
  last_post_date       DATE,
  metrics_recorded_at  TIMESTAMPTZ,
  position             SMALLINT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_business ON social_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_handle_trgm ON social_accounts USING gin (normalized_handle gin_trgm_ops);

-- ---------------------------------------------------------------------------------------------
-- Edit history (AC-BIZ-008): one row per changed field (who, when, before, after). Append-only.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_edit_history (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  change_kind            VARCHAR(20) NOT NULL CHECK (change_kind IN ('created', 'updated', 'archived', 'restored')),
  field                  VARCHAR(40),
  before_value           JSONB,
  after_value            JSONB,
  changed_by             UUID REFERENCES employees(id) ON DELETE RESTRICT,
  changed_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  correction_request_id  UUID,
  request_id             VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_business_edit_history_business ON business_edit_history(business_id, changed_at DESC);

CREATE OR REPLACE FUNCTION business_edit_history_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'business_edit_history is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_business_edit_history_append_only ON business_edit_history;
CREATE TRIGGER trg_business_edit_history_append_only
  BEFORE UPDATE OR DELETE ON business_edit_history
  FOR EACH ROW EXECUTE FUNCTION business_edit_history_append_only();
