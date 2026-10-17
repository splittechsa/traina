-- In-app coaching notifications (not push). Synthetic/content-safe; no health payload dumps.

CREATE TABLE IF NOT EXISTS member_in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'human_coach_feedback',
    'weekly_review_status',
    'recommendation_update',
    'system'
  )),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  href text NULL CHECK (href IS NULL OR char_length(href) <= 200),
  related_id uuid NULL,
  author_kind text NOT NULL DEFAULT 'system'
    CHECK (author_kind IN ('system', 'human_coach', 'yazan')),
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_in_app_notifications_user_created_idx
  ON member_in_app_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS member_in_app_notifications_user_unread_idx
  ON member_in_app_notifications (user_id)
  WHERE read_at IS NULL;
