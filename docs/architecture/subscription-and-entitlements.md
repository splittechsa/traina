# Subscription & entitlements (web-first)

## Commercial decision (2026-10-17)

**Primary sales channel:** Traina landing page + **external payment gateway**.  
Customers register and purchase on the website. The same Traina account carries **server-authoritative entitlements** to supported clients (web, mobile).

The mobile app must never grant paid coaching from client-side flags, local stores, or an unverified payment redirect.

**Card data:** Never implement custom storage of payment card numbers or CVVs. Use the gateway’s hosted checkout / PCI-scoped components only.

---

## Principle — billing ≠ entitlements

| Layer | Owns | Must not |
| --- | --- | --- |
| **Payment provider adapter** | Checkout sessions, charges, refunds, webhooks | Decide product capabilities |
| **Subscription lifecycle** | Periods, renewal, cancel, grace, expiry | Invent features |
| **Entitlement service** | Which capabilities the account may use now | Trust the client |
| **Clients (web/mobile)** | Present UX for entitled capabilities | Unlock paid access locally |

Multiple payment channels map into one entitlement projection:

```text
Web gateway  ──┐
Apple IAP    ──┼──► verified events ──► Subscriptions ──► Entitlements ──► Capabilities
Play Billing ──┘         (idempotent)
Promotional  ──┘
```

Apple IAP must be addable **without redesigning** the core subscription / entitlement schema.

---

## Target data model

Validated contracts + migrations + idempotent writes. Names may adapt to existing `products` / `subscriptions` tables.

| Entity | Purpose |
| --- | --- |
| **Plans** | Product packaging (Free / Traina AI / Traina Coach) |
| **Prices** | Currency, interval, channel-specific SKUs (web vs Apple) |
| **Customers** | Billing customer linked 1:1 (or N:1) to Traina `user_id` |
| **Checkout sessions** | Hosted checkout intent; expires; never stores PAN/CVV |
| **Payment transactions** | Provider payment ids, amounts, status |
| **Subscriptions** | Lifecycle status + current period + channel |
| **Entitlements** | Effective capabilities + usage limits for the account |
| **Usage limits** | Fair-use AI, messaging, coach reviews |
| **Webhook events** | Raw signed payloads + processing disposition |
| **Refunds** | Provider refund ids linked to transactions |

### Suggested subscription statuses

Align with domain `SubscriptionStatus`: `free` | `trialing` | `active` | `grace_period` | `billing_retry` | `canceled` | `expired` | `refunded` | `revoked`.

### Idempotency

- Webhook `event_id` unique; duplicate → `duplicate` disposition (no double entitlement).
- Checkout completion and renewals key on provider ids.
- Concurrent updates: optimistic version or transactional row lock on subscription.

---

## Website-first flows

1. Landing page pricing → choose plan.  
2. Register / sign in (same identity as mobile).  
3. Hosted checkout (provider abstraction).  
4. Server verifies session/payment **before** granting entitlements.  
5. Signed webhook validates signature + timestamp; replay rejected.  
6. Entitlement service projects capabilities.  
7. Customer billing portal: invoices, cancel, update payment method (via provider).  
8. Billing audit log + reconciliation reports.

Saudi entity: invoice/tax handling must follow counsel-approved VAT / e-invoicing rules (task **P3-WEB-TAX-01**). Engineering does not invent tax law.

---

## Apple App Store — policy constraints (engineering)

Source of truth: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) §§ **3.1.1**, **3.1.3** (review again before each iOS submission; guidelines change).

### 3.1.1 In-App Purchase

Unlocking digital features/subscriptions **inside the iOS app** generally requires Apple IAP. Apps must not use their own mechanisms (license keys, QR codes, crypto, etc.) to unlock in-app functionality.

### 3.1.3 Other purchase methods

Limited exceptions (reader apps, multiplatform services, physical goods, person-to-person services, etc.). Critical points for Traina:

| Topic | Engineering stance |
| --- | --- |
| **Website sales** | Allowed outside the iOS app. Primary web checkout stays on the landing page. |
| **Linking from iOS to external checkout** | **Do not assume permitted.** Do not ship prohibited external-purchase buttons, purchase redirects, or misleading upgrade prompts from the Saudi iOS app. |
| **3.1.3(b) Multiplatform** | May allow access to subscriptions acquired on the website **provided those items are also available as IAP within the app** (Apple’s current wording). Treat “web-only unlock of digital coaching features on iOS without IAP” as **high App Review risk**. |
| **Reader entitlement** | Fitness coaching is **not** assumed to qualify as a reader app (magazines/books/audio/video). Do not plan on External Link Account as the Traina Coach strategy without counsel + Apple confirmation. |
| **Person-to-person services** | Live 1:1 coaching may have a different analysis. **Do not automatically classify** async human weekly reviews + AI coaching as exempt real-time person-to-person services. Evaluate separately with counsel. |

### Compliant mobile experience (target)

1. **Server entitlements** always — same identity as web.  
2. **Apple IAP channel** implemented where required for digital coaching unlocks on iOS (same Plans/Entitlements tables; Apple price SKUs).  
3. **No** in-app CTA that routes users to web checkout to bypass IAP where 3.1.1 applies.  
4. Account sign-in / manage existing subscription status may surface **non-purchase** account info carefully; purchase CTAs on iOS use StoreKit when digital unlocks are offered.  
5. Counsel signs off on the exact iOS upgrade UX before App Store submission (**P3-APPLE-POLICY-01**).

---

## Provider abstraction

```text
BillingProvider
  createCheckoutSession(planPriceId, customerId, returnUrls)
  verifyCheckoutSession(sessionId)
  parseAndVerifyWebhook(rawBody, headers) → WebhookEvent
  createCustomerPortalSession(customerId)
  refund(transactionId, amount?)
```

Implementations: first external gateway (TBD — Moyasar / Tap / Stripe-capable Saudi rails, etc.), then `AppleStoreKitProvider`. Domain entitlements stay provider-agnostic.

---

## Current repo state

| Piece | Status |
| --- | --- |
| Domain subscription state machine | Partial — `packages/domain/src/subscription.ts` (includes `web` channel) |
| Server entitlement service | Missing |
| Web checkout / landing pricing | Missing |
| Payment gateway adapter + webhooks | Missing |
| StoreKit verification | Not connected |
| Product SKUs Traina AI / Coach | Missing (#24 superseded by **P3-WEB-*** / **P3-APPLE-***) |
| Fair-use AI quotas | Partial — `ai_usage` |
| Invoice / Saudi tax | Missing |
| Customer billing portal | Missing |
| Billing audit / reconciliation | Missing |

---

## Packaging

See `docs/product/coaching-service-model.md`. Prices require financial modeling (AI cost, coach labor, gateway fees, Apple commission where used, churn) — not competitor copy alone.

## Safety / privacy coupling

Billing work **must not** bypass P0 safety (ENERGY_POLICY) or privacy/consent release gates. Paid entitlements unlock coaching features that remain subject to those gates.
