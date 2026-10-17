-- Distinguish human coach messages from Yazan (AI assistant) in the chat transcript.

ALTER TABLE coach_messages DROP CONSTRAINT IF EXISTS coach_messages_role_check;
ALTER TABLE coach_messages
  ADD CONSTRAINT coach_messages_role_check
  CHECK (role IN ('member', 'assistant', 'tool', 'human_coach'));

-- Soft capacity and SLA metadata for coach ops (pilot defaults; not billing).
CREATE TABLE IF NOT EXISTS coach_capacity (
  coach_user_id uuid PRIMARY KEY REFERENCES users (id),
  max_active_members int NOT NULL DEFAULT 40 CHECK (max_active_members BETWEEN 1 AND 200),
  response_hours_target int NOT NULL DEFAULT 72 CHECK (response_hours_target BETWEEN 1 AND 336),
  available boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Follow-up actions attached to a weekly review (coach-owned).
CREATE TABLE IF NOT EXISTS coach_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES weekly_review_queue (id),
  coach_user_id uuid NOT NULL REFERENCES users (id),
  member_user_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  due_on date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS coach_follow_ups_coach_idx
  ON coach_follow_ups (coach_user_id, status, due_on);
