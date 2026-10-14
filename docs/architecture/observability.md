# Observability

Not deployed.

## Signals to add with the first real environment

- Request logs with the `x-request-id` already set by the API, without body content that includes health text.
- Counters for 401, 503 `AUTH_NOT_CONFIGURED`, 501 billing, and 422 domain errors.
- Ledger post attempts versus `IDEMPOTENCY_CONFLICT`.
- Queue depth once workers exist.
- Model token use and cost once a provider exists.
- PostgreSQL saturation, slow queries, and replication lag.

## SLOs to adopt after a baseline, not before

These are drafts: API availability 99.9% monthly excluding planned maintenance; p95 read latency under 300 ms at the edge; workout writes acknowledged only after a database commit; payment events processed idempotently within 5 minutes of receipt; AI p95 under 8 seconds for a short turn. None of these have an error budget or a measurement.

`/v1/ready` is the readiness gate. It is intentionally not ready.
