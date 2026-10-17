-- P1-REC-02: expiration/cancel terminal statuses + safety_class on coaching recommendations.

ALTER TABLE coaching_recommendations
  DROP CONSTRAINT IF EXISTS coaching_recommendations_status_check;

ALTER TABLE coaching_recommendations
  ADD CONSTRAINT coaching_recommendations_status_check CHECK (status IN (
    'DRAFT', 'VALIDATED', 'REVIEW_REQUIRED', 'MEMBER_CONFIRMATION_REQUIRED',
    'APPROVED', 'APPLIED', 'MONITORED', 'SUPERSEDED', 'REVERTED', 'REJECTED',
    'EXPIRED', 'CANCELED'
  ));

ALTER TABLE coaching_recommendations
  ADD COLUMN IF NOT EXISTS safety_class text NOT NULL DEFAULT 'member_confirm'
    CHECK (safety_class IN ('safe_guidance', 'member_confirm', 'human_review', 'blocked_policy'));

UPDATE coaching_recommendations
SET safety_class = CASE
  WHEN category IN ('nutrition', 'human_required') THEN 'blocked_policy'
  WHEN requires_human_review THEN 'human_review'
  WHEN requires_member_confirmation THEN 'member_confirm'
  ELSE 'safe_guidance'
END
WHERE safety_class = 'member_confirm'
  AND (
    category IN ('nutrition', 'human_required')
    OR requires_human_review = true
    OR requires_member_confirmation = false
  );
