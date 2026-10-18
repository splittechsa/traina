-- Allow weekly briefs that are saved for Yazan without entering the human inbox.
-- Free members without Coach entitlement / assignment keep a local summary only.

ALTER TABLE coach_weekly_briefs
  DROP CONSTRAINT IF EXISTS coach_weekly_briefs_status_check;

ALTER TABLE coach_weekly_briefs
  ADD CONSTRAINT coach_weekly_briefs_status_check
  CHECK (status IN ('queued_for_human', 'seen_by_human', 'closed', 'saved_for_yazan'));
