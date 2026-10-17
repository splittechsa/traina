-- Daily living logs: water, timed activities, and body circumferences.
-- Activity rows store duration only. There is no calories-burned column.

CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  logged_on date NOT NULL,
  milliliters integer NOT NULL CHECK (milliliters BETWEEN 50 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS water_logs_user_day_idx ON water_logs (user_id, logged_on);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  logged_on date NOT NULL,
  kind text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 60 AND 28800),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_user_day_idx ON activity_logs (user_id, logged_on);

CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  recorded_on date NOT NULL,
  waist_mm integer CHECK (waist_mm IS NULL OR waist_mm BETWEEN 200 AND 2500),
  chest_mm integer CHECK (chest_mm IS NULL OR chest_mm BETWEEN 200 AND 2500),
  hip_mm integer CHECK (hip_mm IS NULL OR hip_mm BETWEEN 200 AND 2500),
  arm_mm integer CHECK (arm_mm IS NULL OR arm_mm BETWEEN 200 AND 2500),
  thigh_mm integer CHECK (thigh_mm IS NULL OR thigh_mm BETWEEN 200 AND 2500),
  neck_mm integer CHECK (neck_mm IS NULL OR neck_mm BETWEEN 200 AND 2500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    waist_mm IS NOT NULL OR chest_mm IS NOT NULL OR hip_mm IS NOT NULL
    OR arm_mm IS NOT NULL OR thigh_mm IS NOT NULL OR neck_mm IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS body_measurements_user_day_idx ON body_measurements (user_id, recorded_on);
