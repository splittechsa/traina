-- Expo push device tokens for future notification delivery.
-- Tokens only — no provider secrets. Delivery remains disabled until ops configures Expo/FCM.
CREATE TABLE member_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, expo_push_token)
);

CREATE INDEX member_push_devices_user_idx ON member_push_devices (user_id) WHERE revoked_at IS NULL;
