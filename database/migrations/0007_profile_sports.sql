-- Additional sports chosen during setup. The existing discipline column stays the primary stored discipline.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}';
