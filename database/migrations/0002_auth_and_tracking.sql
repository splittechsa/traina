-- Auth credentials, tracking, and publication guard. No sample accounts.

CREATE TABLE user_credentials (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  purpose text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_sessions
  ADD COLUMN pauses jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_profiles
  ADD COLUMN measurement_units text NOT NULL DEFAULT 'metric' CHECK (measurement_units IN ('metric', 'imperial'));

CREATE TABLE weight_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  weight_grams integer NOT NULL CHECK (weight_grams BETWEEN 30000 AND 300000),
  recorded_on date NOT NULL,
  source text NOT NULL CHECK (source IN ('manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX weight_records_user_idx ON weight_records (user_id, recorded_on DESC);

ALTER TABLE coaching_rule_versions
  ADD COLUMN published_at timestamptz;

ALTER TABLE coaching_rule_versions
  ADD CONSTRAINT coaching_published_requires_approval
  CHECK (published_at IS NULL OR status = 'approved');

CREATE TABLE ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  provider text NOT NULL,
  tokens integer NOT NULL CHECK (tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_events
  ADD COLUMN verified boolean NOT NULL DEFAULT false;
