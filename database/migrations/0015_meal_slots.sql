-- Optional meal slot on a logged food row. Unassigned rows stay valid.
ALTER TABLE food_entries
  ADD COLUMN IF NOT EXISTS meal_slot text;

ALTER TABLE food_entries
  DROP CONSTRAINT IF EXISTS food_entries_meal_slot_check;

ALTER TABLE food_entries
  ADD CONSTRAINT food_entries_meal_slot_check
  CHECK (meal_slot IS NULL OR meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack'));
