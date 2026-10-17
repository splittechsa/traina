-- Real training adaptations: one recommendation → at most one program version bump.

CREATE TABLE IF NOT EXISTS program_adaptation_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL UNIQUE REFERENCES coaching_recommendations (id),
  program_id uuid NOT NULL REFERENCES programs (id),
  from_version integer NOT NULL CHECK (from_version > 0),
  to_version integer NOT NULL CHECK (to_version > from_version),
  from_version_id uuid NOT NULL REFERENCES program_versions (id),
  to_version_id uuid NOT NULL REFERENCES program_versions (id),
  kind text NOT NULL,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS program_adaptation_applications_program_idx
  ON program_adaptation_applications (program_id, created_at DESC);
