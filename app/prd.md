# Product requirements

## Product

Sahhti is a Saudi B2B2C fitness service. Members get training, nutrition, and an AI coach. Gym partners get attribution and a contract-specific commission. Sahhti keeps the remainder after store fees, tax, refunds, and that commission.

## Users

- Members in Arabic (RTL) and English (LTR).
- Gym owners and branch managers, isolated by organization.
- Internal support, finance, coach reviewers, moderators, and admins.

## In scope for the product, not all built

Member onboarding, home dashboard, training, nutrition, supplements, activity, community, subscriptions, gym partnerships, admin, and support. The engineering status of each is in [STATUS.md](../../STATUS.md).

## Rules that bind the product

- Entitlements, money, workout completion, calorie arithmetic, and permissions are deterministic.
- Coaching rules are versioned and approved by a person other than the author.
- The model cannot change those rules or pick a user id.
- Testimonials are not evidence.
- The product is general fitness, not a government service and not a medical device.

## This increment

A member can have an onboarding payload validated, a food diary summed, and a commission quote calculated. None of those calls create an account, a meal log, or a payout.
