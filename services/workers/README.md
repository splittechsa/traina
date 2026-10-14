# Workers

Not a running process. The `outbox` table is the intended handoff for notifications, store reconciliation, and settlement drafts.

When this service exists it should import `@sahhti/domain` rather than reimplement commission or subscription rules.
