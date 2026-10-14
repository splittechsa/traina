# Payments and subscription states

## States

`free`, `trialing`, `active`, `grace_period`, `billing_retry`, `canceled`, `expired`, `refunded`, `revoked`.

Verified purchases and trials require a product id and a store channel. Renewals keep an active subscription. `cancel_scheduled` sets `cancelAtPeriodEnd` without leaving `active`. Access continues through grace, and through the paid period after cancellation. Billing retry keeps access only until `currentPeriodEnd`. Refund and revoke remove access.

Duplicate event ids are ignored even if the second payload says refund. Older events are ignored unless they are refunds or revocations. Unverified events throw `UNVERIFIED_STORE_EVENT`.

## What is not connected

App Store Server Notifications, Play real-time developer notifications, StoreKit 2, and Play Billing. The verify route returns 501. A client callback cannot mark a payment successful.

Web, gym-contract, and corporate payments are separate future flows. No Saudi payment gateway is integrated. No card data is stored.

## Entitlement

`entitlementAllowsAccess` is the authority. The database `subscriptions` table is the future record of that snapshot. It is empty because the migration has not been applied.
