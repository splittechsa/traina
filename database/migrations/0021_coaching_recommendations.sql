-- P1-REC-01: versioned coaching recommendations (propose → approve → apply).
-- Nutrition APPLIED remains blocked in domain until ENERGY_POLICY is professionally approved.

CREATE TABLE IF NOT EXISTS coaching_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  category text NOT NULL CHECK (category IN ('daily_guidance', 'training', 'nutrition', 'human_required')),
  status text NOT NULL CHECK (status IN (
    'DRAFT', 'VALIDATED', 'REVIEW_REQUIRED', 'MEMBER_CONFIRMATION_REQUIRED',
    'APPROVED', 'APPLIED', 'MONITORED', 'SUPERSEDED', 'REVERTED', 'REJECTED'
  )),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  rationale text NOT NULL DEFAULT '' CHECK (char_length(rationale) <= 2000),
  confidence text NOT NULL DEFAULT 'insufficient'
    CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
  missing_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_version text NOT NULL DEFAULT 'rec_policy_v1_unapproved_nutrition',
  expires_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_human_review boolean NOT NULL DEFAULT false,
  requires_member_confirmation boolean NOT NULL DEFAULT true,
  audit jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coaching_recommendations_user_status_idx
  ON coaching_recommendations (user_id, status, updated_at DESC);
