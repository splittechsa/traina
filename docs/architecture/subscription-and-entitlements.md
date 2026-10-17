# Subscription & entitlements

## Principle

Entitlements are **server-side**, independent of UI chrome. Client state must never unlock paid coaching alone.

## Current state

| Piece | Status |
| --- | --- |
| Domain subscription helpers | Partial — `packages/domain/src/subscription.ts` |
| StoreKit / Play verification | Not connected (API returns not configured / 501 paths historically) |
| Product SKUs Traina AI / Coach | Missing (issue #24 maps partially) |
| Fair-use AI quotas | Partial — hourly `ai_usage` count |
| Downgrade / grace / refund handling | Domain sketches only |

## Target packaging

See `docs/product/coaching-service-model.md`. Price and entitlement matrices require financial modeling (AI cost, coach labor, store fees, churn) — not competitor copy alone.

## Billing engineering checklist

- Server verification of store transactions  
- Renewal/cancel events, grace, refunds  
- Idempotent billing events  
- Correct downgrade (lose human review when leaving Coach tier)  
- No forged client entitlements  
