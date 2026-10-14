-- Short verification and reset codes. Existing token hashes remain valid.

ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE password_resets
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

ALTER TABLE password_resets
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
