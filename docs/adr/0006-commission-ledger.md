# ADR 0006 — Commissions come from ledger lines

## Status

Accepted for the calculation. Settlement persistence is not available.

## Decision

A commission is a balanced set of ledger lines derived from a verified cash amount, an explicit store fee, an explicit tax amount, and a versioned contract policy. Dashboard totals are not an input.

First-payment contracts record a skip reason on later charges instead of omitting the decision. Refunds reverse the original lines. Idempotency keys are derived from the payment event id. A partial key overlap is a conflict.

`purpose: "quote"` never sets `settlementAllowed`. The HTTP settle route returns 503 until the ledger database is configured. `InMemoryLedger` is a test double and is not wired to the API.

## Consequences

A quote response is not a payout, an invoice, or proof that a store charge occurred.
