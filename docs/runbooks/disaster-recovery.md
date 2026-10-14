# Disaster recovery

No backup has been taken and no restore has been demonstrated.

## Target

- PostgreSQL point-in-time recovery with a written RPO of 5 minutes and RTO of 1 hour for the primary, once the managed service supports it. These numbers are targets, not a contract with a vendor.
- Ledger and audit tables are part of the same backup as the primary. They are not rebuilt from a dashboard.
- Object storage versioning for media.
- Migration history in `schema_migrations`.
- A staging restore drill before production traffic.

## Current procedure

There is no database. `npm run migrate` will not run without `DATABASE_URL`. If a future restore is attempted, apply the same migration files to an empty server only when `schema_migrations` says they were not applied, then compare ledger debit and credit sums.

## Not done

Multi-region failover, a run of restore, and a game day.
