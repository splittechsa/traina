-- Per-athlete meal plan day: pick ready templates or custom declared macros.
-- No invented dish calculator. Energy target is stored as the member's confirmed plan.

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS nutrition_phase text
    CHECK (nutrition_phase IS NULL OR nutrition_phase IN ('cutting', 'maintain', 'gain'));

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS weekly_energy_delta_kcal integer NOT NULL DEFAULT 0
    CHECK (weekly_energy_delta_kcal BETWEEN -1000 AND 1000);

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS maintenance_kcal integer
    CHECK (maintenance_kcal IS NULL OR maintenance_kcal BETWEEN 1000 AND 8000);

CREATE TABLE IF NOT EXISTS member_meal_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  logged_on date NOT NULL,
  target_kcal integer NOT NULL CHECK (target_kcal BETWEEN 1200 AND 6000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_on)
);

CREATE TABLE IF NOT EXISTS member_meal_plan_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES member_meal_plan_days (id) ON DELETE CASCADE,
  meal_slot text NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  template_id text,
  custom_label text,
  energy_kcal integer NOT NULL CHECK (energy_kcal >= 0 AND energy_kcal <= 2500),
  protein_mg integer NOT NULL CHECK (protein_mg >= 0),
  carbohydrate_mg integer NOT NULL CHECK (carbohydrate_mg >= 0),
  fat_mg integer NOT NULL CHECK (fat_mg >= 0),
  UNIQUE (day_id, meal_slot),
  CHECK (
    (template_id IS NOT NULL AND custom_label IS NULL)
    OR (template_id IS NULL AND custom_label IS NOT NULL AND char_length(btrim(custom_label)) BETWEEN 2 AND 80)
  )
);

CREATE INDEX IF NOT EXISTS member_meal_plan_days_user_idx ON member_meal_plan_days (user_id, logged_on);
