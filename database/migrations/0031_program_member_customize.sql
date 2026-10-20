-- Allow member-driven program customizations as a distinct version source.
ALTER TABLE program_versions
  DROP CONSTRAINT IF EXISTS program_versions_source_check;

ALTER TABLE program_versions
  ADD CONSTRAINT program_versions_source_check
  CHECK (source IN ('explicit', 'approved_rules', 'member_customize'));
