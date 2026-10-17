-- P2-HUM security: assignment lifecycle audit, coach-share consent, review status expansion.

-- Append-only assignment events (tamper-evident operational log; no UPDATEs from app code).
CREATE TABLE IF NOT EXISTS coach_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL REFERENCES users (id),
  coach_user_id uuid NOT NULL REFERENCES users (id),
  member_user_id uuid NOT NULL REFERENCES users (id),
  action text NOT NULL CHECK (action IN ('assign', 'revoke', 'reassign')),
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  previous_coach_user_id uuid REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS coach_assignment_events_member_idx
  ON coach_assignment_events (member_user_id, at DESC);

-- Member acknowledgement that an assigned human coach may access coaching packet data.
-- P0-PRIV legal basis still pending counsel; this is the runtime consent ledger only.
CREATE TABLE IF NOT EXISTS member_coach_share_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_user_id uuid NOT NULL REFERENCES users (id),
  purpose text NOT NULL DEFAULT 'human_weekly_coaching_review',
  policy_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'withdrawn')),
  granted_at timestamptz,
  withdrawn_at timestamptz,
  evidence_reference text NOT NULL DEFAULT 'in_app_acknowledgement',
  UNIQUE (member_user_id, purpose)
);

-- Expand weekly review statuses for completed/failed terminals.
ALTER TABLE weekly_review_queue DROP CONSTRAINT IF EXISTS weekly_review_queue_status_check;
ALTER TABLE weekly_review_queue
  ADD CONSTRAINT weekly_review_queue_status_check CHECK (status IN (
    'WEEKLY_REVIEW_DUE', 'MEMBER_SUBMITTED', 'AUTO_SUMMARY_READY', 'QUEUED_FOR_HUMAN',
    'ASSIGNED', 'IN_REVIEW', 'FEEDBACK_SENT', 'ACKNOWLEDGED', 'FOLLOW_UP',
    'OVERDUE', 'REASSIGNED', 'REOPENED', 'ESCALATED', 'COMPLETED', 'FAILED'
  ));

-- Structured packet snapshot for authorized coach view (facts only; no invented values).
ALTER TABLE weekly_review_queue
  ADD COLUMN IF NOT EXISTS packet jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Append-only review status transitions.
CREATE TABLE IF NOT EXISTS weekly_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES weekly_review_queue (id),
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL REFERENCES users (id),
  from_status text,
  to_status text NOT NULL,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500)
);

CREATE INDEX IF NOT EXISTS weekly_review_events_review_idx
  ON weekly_review_events (review_id, at DESC);

-- Internal coach notes (not member-visible).
CREATE TABLE IF NOT EXISTS coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL REFERENCES users (id),
  member_user_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_notes_member_idx
  ON coach_notes (member_user_id, created_at DESC);

ALTER TABLE coach_access_audit DROP CONSTRAINT IF EXISTS coach_access_audit_action_check;
ALTER TABLE coach_access_audit
  ADD CONSTRAINT coach_access_audit_action_check CHECK (action IN (
    'member_state.read', 'recommendation.approve', 'recommendation.reject',
    'feedback.send', 'review.claim', 'assignment.write', 'packet.read'
  ));
