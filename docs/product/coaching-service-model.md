# Coaching service model

## Roles

| Role | Responsibility |
| --- | --- |
| Member | Logs facts, confirms plan changes, completes weekly check-in |
| Yazan (AI) | Daily presence, explanations, drafts within approved tools |
| Decision engine | Deterministic recommendations + safety/confidence gates |
| Human coach | Reviews weekly packet, edits/rejects AI drafts, sends feedback |
| Supervisor | Workload, escalation, quality |

## Service tiers (product concepts)

### Free — Tracking

Basic workout/nutrition/water/weight logging and history. Educational tips only. No adaptive paid coaching loop.

### Traina AI — Adaptive Coaching

Daily Yazan check-ins, personalized goals, adaptive recommendations within fair-use AI limits, advanced progress insights. Significant adaptations still require member confirmation; some require human review depending on policy.

### Traina Coach — Human + AI

Everything in Traina AI plus assigned coach/team, weekly professional review, personalized feedback, human escalation within a documented SLA.

## Commercial channel (product)

- **Primary purchase:** Traina landing page + external payment gateway (same Traina account).  
- **Entitlements:** Server-authoritative; shared across web and mobile.  
- **iOS:** Do not assume external checkout links from the app are allowed. Digital coaching unlocks generally need an Apple-compliant purchase strategy (IAP where required). Live person-to-person coaching exceptions are evaluated separately and **do not** automatically cover async human reviews + AI.  
- Details: `docs/architecture/subscription-and-entitlements.md`.

## What we do **not** claim

- 24/7 human availability.
- Guaranteed physical results.
- Medical diagnosis or treatment.
- That an AI summary was “human approved” without a real coach action.

## Logging vs coaching

Every meaningful input must support progress understanding, plan improvement, problem detection, adherence, human review, or explaining a recommendation. Do not collect fields “because other apps do.”
