-- FX-BE (review 01 F-21): attendance_breaks is history. Forward-only, non-destructive:
--   * session FK: ON DELETE CASCADE -> RESTRICT (A9: no CASCADE on history);
--   * optimistic-concurrency columns `version` and `updated_at`;
--   * break notes length bounded like every other free-text field (500).
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT c.conname INTO fk_name
    FROM pg_constraint c
   WHERE c.conrelid = 'attendance_breaks'::regclass AND c.contype = 'f'
     AND c.confrelid = 'attendance_sessions'::regclass AND c.confdeltype = 'c';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE attendance_breaks DROP CONSTRAINT %I', fk_name);
    ALTER TABLE attendance_breaks
      ADD CONSTRAINT attendance_breaks_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE attendance_breaks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE attendance_breaks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_breaks_notes_len') THEN
    ALTER TABLE attendance_breaks ADD CONSTRAINT attendance_breaks_notes_len CHECK (notes IS NULL OR char_length(notes) <= 500) NOT VALID;
  END IF;
END $$;
