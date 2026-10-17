-- Yazan coach spine: daily proactive check-in + weekly human-coach survey file.
-- Logging tables remain the input infrastructure the coach reads.

CREATE TABLE IF NOT EXISTS coach_daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  logged_on date NOT NULL,
  focus text NOT NULL
    CHECK (focus IN ('water', 'meals', 'training', 'nutrition_plan', 'stable')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 8 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_on)
);

CREATE INDEX IF NOT EXISTS coach_daily_checkins_user_idx
  ON coach_daily_checkins (user_id, logged_on DESC);

CREATE TABLE IF NOT EXISTS coach_weekly_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  week_of date NOT NULL,
  survey jsonb NOT NULL,
  packet jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued_for_human'
    CHECK (status IN ('queued_for_human', 'seen_by_human', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_of)
);

CREATE INDEX IF NOT EXISTS coach_weekly_briefs_user_idx
  ON coach_weekly_briefs (user_id, week_of DESC);
