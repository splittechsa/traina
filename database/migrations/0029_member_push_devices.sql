-- Device push token registry. Delivery (APNs/FCM) stays ops-gated; storing tokens is allowed.
CREATE TABLE IF NOT EXISTS member_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  push_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, push_token)
);

CREATE INDEX IF NOT EXISTS member_push_devices_user_idx
  ON member_push_devices (user_id)
  WHERE revoked_at IS NULL;
