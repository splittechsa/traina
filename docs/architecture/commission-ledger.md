# Commission ledger

## Inputs

A verified charge supplies cash collected, store fee, and tax as integers. The contract supplies the model (`first_payment_only` or `recurring_revenue`), the base (`gross`, `net_of_store_fee`, or `net_of_store_fee_and_tax`), the rate in basis points, and the policy version.

The store fee is an input from the verifier, not a guessed store percentage. Tax comes from a named policy. Settlement refuses an unreviewed tax policy. A reviewed flag in a test is not a ZATCA opinion. The sample policy id used in tests is `test-vat-not-a-legal-determination`.

## Lines

For a charge, debits and credits must match:

- Debit `cash_clearing` for cash collected.
- Credit store fee, tax, gym commission, and platform revenue.

If commission plus fees and tax exceed cash, the function throws `COMMISSION_EXCEEDS_PROCEEDS` rather than posting a negative platform line.

A later charge on a first-payment contract posts a zero commission and `skipReason: first_payment_already_accrued`. The cash, fee, and tax lines are still balanced.

## Refunds and idempotency

Refunds swap the direction of the original lines and use new idempotency keys. They do not recompute the rate. Replaying the same keys is a no-op. A partial key collision throws.

## HTTP

`POST /v1/partnerships/commissions/quote` calculates and sets `persisted: false`. Priors in that request are caller-supplied and are not a ledger read. `POST /v1/internal/commissions/settle` does not post.

The SQL table `financial_ledger_entries` is append-only. The commission view cannot be written.
