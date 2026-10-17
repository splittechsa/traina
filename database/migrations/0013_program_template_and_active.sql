ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS programs_one_active_idx
  ON programs (user_id)
  WHERE active;
