# ADR 0002 — PostgreSQL is the system of record

## Status

Accepted as the data direction. The migration has not been executed.

## Context

The product needs transactions, foreign keys, and an immutable financial ledger. Supabase can host PostgreSQL, Auth, Storage, and row-level security, but that does not decide residency, backup, or regional limits.

## Decision

PostgreSQL 16 is the system of record. Supabase is not selected for production in this increment. It remains a candidate only if a later review shows a region, backup story, and data-residency posture that fit Saudi personal data.

Until that review, production should be a managed PostgreSQL offering in a region the operator has accepted for this data, with separate authentication, object storage, and the Sahhti API. Candidate regions to evaluate include AWS `me-south-1` (Bahrain), Google Cloud `me-central2` (Dammam), and Saudi-operated clouds. None of those accounts exist in this workspace.

## Consequences

Migrations live in `database/migrations` and are applied by `services/api/src/migrate.ts`. There is no embedded database and no sample user seed.
