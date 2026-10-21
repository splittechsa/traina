-- Stable keyset order; existing account queries remain supported. No customer rows are changed.
CREATE INDEX IF NOT EXISTS workout_sessions_user_history_cursor_idx ON workout_sessions (user_id, scheduled_for DESC, id DESC);
CREATE INDEX IF NOT EXISTS workout_sessions_user_active_cursor_idx ON workout_sessions (user_id, scheduled_for DESC, id DESC) WHERE status IN ('in_progress','paused');
