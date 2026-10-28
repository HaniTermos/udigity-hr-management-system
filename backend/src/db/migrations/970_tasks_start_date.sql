-- FX-BE-C6: SCR-DEV-007 Task detail drawer shows a "Start date" next to "Due date"
-- (docs/implementation/figma-specs/page-44.md). Forward-only, additive, nullable.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_start_before_due') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_start_before_due
      CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date);
  END IF;
END $$;
