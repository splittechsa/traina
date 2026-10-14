-- Query indexes for the member home and progress reads.

CREATE INDEX workout_sessions_user_scheduled_idx ON workout_sessions (user_id, scheduled_for DESC);
CREATE INDEX weight_records_user_recorded_idx ON weight_records (user_id, recorded_on DESC);
