# ADR 0003 — Money is integer minor units

## Status

Accepted and tested.

## Decision

SAR amounts are integers in halalas. Rates are integer basis points. Multiplication uses `BigInt` and truncates toward zero. Floating-point arithmetic is not used for ledger amounts.

Client payloads cannot include a commission result. The quote schema is strict and rejects `commissionMinor`.

## Consequences

Rounding residuals must be represented as ledger lines, not as binary floats. Display formatting converts minor units with integer division.
