# ADR 0013 — PGlite is a development database only

## Status

Accepted.

## Decision

PostgreSQL 16 remains the system of record (ADR 0002). This machine has no PostgreSQL client and no Docker, so development and integration tests use file-backed PGlite. `server.ts` refuses to boot PGlite when `NODE_ENV=production`.

Supabase is not selected. Saudi data residency, backups, and point-in-time recovery have not been verified for any managed host.

## Consequences

Restart survival is proven only for PGlite in `product.integration.test.ts`. That is not evidence of managed PostgreSQL, connection limits, or million-user capacity.
