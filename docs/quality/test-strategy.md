# Test strategy

## What passed in this workspace

`npm test` ran 67 tests under Vitest 5:

- Money, tax extraction, and decimal parsing.
- Nutrition sums, image-estimate separation, and refusal of unapproved targets.
- Coaching evaluation, safety stops, and self-approval.
- Subscription duplicates, out-of-order events, unverified events, and entitlement.
- Attribution lock and commission balance, skips, refunds, idempotency, and settlement guards.
- Workout completion, personal records, and offline conflicts.
- Onboarding units and risk flags.
- Coach tool injection and quotas.
- API health, fail-closed auth, onboarding, diary summary, commission quote, and the 503/501 gates.
- The migration file contains no `INSERT` and no password column, and it defines the ledger trigger.

`npm run typecheck` succeeded. `npm audit` reported no vulnerabilities after the Vitest upgrade.

## What was not run

PostgreSQL apply, store webhook replay, device UI tests, Arabic screen tests, accessibility audits, load tests, backup restore, and prompt-injection tests against a live model.

## Pyramid we still need

Integration tests against PostgreSQL, end-to-end member flows once clients exist, tenant tests through SQL roles, and mobile UI tests. Security cases that exist as unit tests should be repeated against the HTTP and database boundary when those stores exist.
