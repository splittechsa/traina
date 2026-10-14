# Coaching rulebook

## Records

Methodology, rule, version, condition, action, approval, evidence, evaluation, and user plan version. The SQL tables match those names. No rows are seeded.

## Version rules

- Status moves to approved or rejected only from `in_review`.
- The reviewer must be a coach reviewer or admin and must not be the author.
- Production evaluation selects the highest effective approved version per rule id.
- Rejected and retired versions do not run.
- Drafts run only in simulation and cannot be saved as a plan.
- Safety blocks suppress the rule's other actions and stop the chain.

## What is deliberately absent

No cutting, bulking, or progression rule from a coach has been entered. Evidence rows require a citation and a review status. An unreviewed citation is not scientific approval.

The internal editor UI is not built. The functions `evaluateCoachingRules` and `decideRuleApproval` are the editor's future API.
