# Privacy and data governance

Sahhti will hold account data and fitness data that may be sensitive personal data under the Saudi Personal Data Protection Law. This document is a plan. It is not a filing, an assessment sign-off, or a certification.

## Data classes

- Identity: email, phone, locale, sessions.
- Profile: age, body measurements, goals, injuries as reported text, diet.
- Training and nutrition logs.
- Subscription and ledger amounts.
- Gym attribution.
- Support tickets and audit logs.
- Optional health-platform samples later (steps, weight, sleep). Those integrations are not built. Denial of health access must still leave the app usable once the apps exist.

## Rules already reflected in code

- Self-reported calories are not treated as an authoritative target.
- Injuries are flags, not diagnoses.
- Ages under 13 are rejected.
- Support authorization does not grant a full health scope.
- There is no sample user in the seed path. `database/seeds` explains that.
- Account deletion and export are required before store release and are not implemented.

## Not decided

Lawful basis and consent copy, retention periods, cross-border transfers, processor list, breach notice timeline, and whether any analytics tool may receive health fields. Analytics, if added, must use a separate schema and must not copy injury text or raw health samples into a marketing warehouse.

Consent rows have a table. No consent screen writes to it yet.
