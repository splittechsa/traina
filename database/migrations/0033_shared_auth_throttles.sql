-- Shared fixed-window throttles survive serverless instance replacement.
CREATE TABLE auth_rate_limits (
  key_hash text PRIMARY KEY,
  bucket bigint NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_rate_limits_expiry_idx ON auth_rate_limits (expires_at);
