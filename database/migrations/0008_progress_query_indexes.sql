-- Supports the /v1/progress training-frequency and exercise-progression queries (progressFor
-- in services/api/src/member/store.ts), which filter completed workout_sessions by
-- user_id + completed_at. Previously only (user_id, scheduled_for) and (user_id, started_at)
-- were indexed, so this read had to fall back to a user_id-only index scan followed by a
-- filter + sort on completed_at. This partial index covers the common case directly: only
-- completed sessions are ever read by this path.
CREATE INDEX workout_sessions_user_completed_idx
  ON workout_sessions (user_id, completed_at DESC)
  WHERE status = 'completed';
