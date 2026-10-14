# Engineering roadmap

The product brief's ten milestones still stand. This repository finishes the testable core of milestone 1 and the deterministic parts of later milestones. It does not finish the milestone.

1. Foundation — repository, domain, schema, API, CI, ADRs. In progress. Tests pass. Database not applied.
2. Identity and onboarding — validation and RBAC exist. Accounts do not persist. OIDC is missing.
3. Training — session reducer and records exist. Exercise catalog and schedules are not stored.
4. Nutrition — arithmetic exists. Saudi food data, barcode, and image estimation do not.
5. AI coach — tool guard exists. Provider, memory store, and evals do not.
6. Commerce — state machine exists. Store verification does not.
7. Gym partnerships — attribution and commission math exist. Portal, QR, and payouts do not.
8. Scanner, health platforms, supplements, community — schema stubs only.
9. Admin, support, moderation, analytics — roles exist in code. UIs do not.
10. Hardening — not started. No load evidence, no restore evidence, no store submission.

Each later milestone should land as a vertical slice with tests, not as a mock screen.
