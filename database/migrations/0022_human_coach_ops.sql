-- P2-HUM foundation: coach assignment, weekly review queue, access audit, feedback.
-- Dashboard UI comes later; this is the authorized backend workflow.

CREATE TABLE IF NOT EXISTS coach_member_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL REFERENCES users (id),
  member_user_id uuid NOT NULL REFERENCES users (id),
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_user_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS coach_member_assignments_member_idx
  ON coach_member_assignments (member_user_id, active);

CREATE TABLE IF NOT EXISTS weekly_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_user_id uuid NOT NULL REFERENCES users (id),
  coach_user_id uuid REFERENCES users (id),
  week_of date NOT NULL,
  status text NOT NULL DEFAULT 'WEEKLY_REVIEW_DUE'
    CHECK (status IN (
      'WEEKLY_REVIEW_DUE', 'MEMBER_SUBMITTED', 'AUTO_SUMMARY_READY', 'QUEUED_FOR_HUMAN',
      'ASSIGNED', 'IN_REVIEW', 'FEEDBACK_SENT', 'ACKNOWLEDGED', 'FOLLOW_UP',
      'OVERDUE', 'REASSIGNED', 'REOPENED', 'ESCALATED'
    )),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_user_id, week_of)
);

CREATE INDEX IF NOT EXISTS weekly_review_queue_status_idx
  ON weekly_review_queue (status, updated_at);

CREATE TABLE IF NOT EXISTS coach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES weekly_review_queue (id),
  coach_user_id uuid NOT NULL REFERENCES users (id),
  member_user_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coach_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  coach_user_id uuid NOT NULL REFERENCES users (id),
  member_user_id uuid NOT NULL REFERENCES users (id),
  action text NOT NULL CHECK (action IN (
    'member_state.read', 'recommendation.approve', 'recommendation.reject', 'feedback.send', 'review.claim'
  ))
);

CREATE INDEX IF NOT EXISTS coach_access_audit_member_idx
  ON coach_access_audit (member_user_id, at DESC);
