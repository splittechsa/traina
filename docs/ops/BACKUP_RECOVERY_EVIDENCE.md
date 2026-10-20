# Backup and recovery evidence

2026-10-20: production recovery is NOT_TESTED.

Verified: the historical Git backup branch resolves to 0a45fdd5cfbca68defae8f20154479e7acae6037. This is code history, not a database backup. Read-only inspection confirmed the configured production Neon schema and migrations 0001–0030. No production snapshot, reset, restore or deletion was performed.

Required evidence: approved backup schedule/retention, access and encryption controls, a known recovery point, restore into an isolated environment, application acceptance against the restored database, measured recovery time/data loss, operator sign-off and a reviewed cutover/rollback procedure. Use synthetic or explicitly approved data; do not copy customer health information into unapproved test environments.
