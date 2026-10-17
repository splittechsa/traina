-- Adaptive AI nutrition: athlete-chosen pace + optional horizon weeks.
-- sprint = short aggressive window; steady = natural; gentle = slow.

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS nutrition_pace text
    CHECK (nutrition_pace IS NULL OR nutrition_pace IN ('sprint', 'steady', 'gentle'));

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS horizon_weeks integer
    CHECK (horizon_weeks IS NULL OR (horizon_weeks BETWEEN 1 AND 52));

-- Allow fitness phase (general health / endurance intent).
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'programs'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%nutrition_phase%'
  LOOP
    EXECUTE format('ALTER TABLE programs DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE programs
  ADD CONSTRAINT programs_nutrition_phase_check
  CHECK (nutrition_phase IS NULL OR nutrition_phase IN ('cutting', 'maintain', 'gain', 'fitness'));
