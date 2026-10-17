-- Member-owned supplement names and a daily tick. Not a catalog and not a recommendation.

CREATE TABLE IF NOT EXISTS member_supplements (
  user_id uuid NOT NULL REFERENCES users (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, name),
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 40)
);

CREATE TABLE IF NOT EXISTS supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  name text NOT NULL,
  logged_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, logged_on),
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 40)
);

CREATE INDEX IF NOT EXISTS supplement_logs_user_day_idx ON supplement_logs (user_id, logged_on);
