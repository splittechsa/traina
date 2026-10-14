# Database

PostgreSQL 16 is the intended server. `0001_core.sql` creates the domains in the product brief: identity, training, nutrition, coaching, AI records, commerce, partnerships, community, support, audit, and the outbox.

The file inserts nothing. Ledger and audit tables reject updates and deletes. `commission_ledger` is a read view.

Apply with `npm run migrate`. The command reads the gitignored root `.env` and uses `DATABASE_URL_UNPOOLED` when it is present. It was applied to the linked Neon production branch on 2026-10-12.

`policies/001_privileges.sql` is a DBA script for a future application role. It is not part of the migrate runner, because creating roles needs a privileged account that this project does not have.
