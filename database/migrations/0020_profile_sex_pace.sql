-- Athlete sex + coaching pace collected once in onboarding (not a second macros form).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sex text
    CHECK (sex IS NULL OR sex IN ('male', 'female'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS nutrition_pace text
    CHECK (nutrition_pace IS NULL OR nutrition_pace IN ('sprint', 'steady', 'gentle'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS horizon_weeks integer
    CHECK (horizon_weeks IS NULL OR (horizon_weeks BETWEEN 1 AND 52));
