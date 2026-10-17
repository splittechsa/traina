# Target architecture (logical modules)

Preserve the monorepo. Prefer **modules + contracts** over premature microservices.

```text
Traina Mobile (apps/mobile)
      |
      v
API Gateway / Fastify (services/api)
      |
      +-- Auth & Member Profiles
      +-- Daily Logging
      +-- Workout & Nutrition
      +-- Member State Engine          [MISSING]
      +-- Scientific Rules Engine     [PARTIAL — unsafe presets present]
      +-- Adaptation / Recommendation [PARTIAL — propose only]
      +-- AI Coaching Orchestrator    [PARTIAL — chat + daily check-in]
      +-- Weekly Review Service       [PARTIAL — packet queued, no coach UI]
      +-- Human Coach Operations      [MISSING]
      +-- Billing & Entitlements      [PARTIAL — domain only; website-first gateway planned]
      +-- Landing / Web Checkout      [MISSING — primary sales channel]
      +-- Privacy & Consent           [PARTIAL — docs exist, no runtime consent ledger]
      |
      +-- PostgreSQL (Neon)
      +-- Job Queue / Workers         [NOT BUILT]
      +-- Monitoring / Audit Logs     [PARTIAL]
      +-- Approved AI Providers       [OPTIONAL env]
```

## Existing packages (keep)

| Path | Role |
| --- | --- |
| `packages/domain` | Pure rules |
| `packages/contracts` | Zod wire shapes |
| `packages/design-tokens` | UI tokens |
| `services/api` | Fastify adapter + store |
| `database/migrations` | Additive SQL |
| `apps/mobile` | Expo member app |

## Decision pipeline (target)

```text
Member events → validated facts → MemberState → policies → candidates
  → safety/confidence → approval requirements → member/human confirm → versioned plan
```

Recommendation states: `DRAFT → VALIDATED → HUMAN_REVIEW_REQUIRED | MEMBER_CONFIRMATION_REQUIRED → APPROVED → APPLIED → MONITORED → SUPERSEDED | REVERTED`

## Split services only when

Scale, team ownership, or compliance isolation requires it — not for aesthetics.
