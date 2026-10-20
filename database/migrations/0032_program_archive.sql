-- Archive retains immutable versions and existing workout references.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE programs ADD CONSTRAINT programs_archived_inactive CHECK (archived_at IS NULL OR active = false);
CREATE INDEX IF NOT EXISTS programs_member_library_idx ON programs (user_id, created_at DESC) WHERE archived_at IS NULL;
