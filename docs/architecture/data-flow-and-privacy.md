# Data flow & privacy

## Current flow (as implemented)

```text
Mobile → HTTPS /v1 → Fastify → PostgreSQL
                         ↓
                   Coach provider (optional, server-side keys)
```

- Auth: session JWT when `SAHHTI_TOKEN_SECRET` set (`docs/publish.md`).
- Onboarding writes `user_profiles` + `onboarding_snapshots`.
- Daily logs write domain tables (water, food, sessions, supplements, weight).
- Yazan daily check-in / chat / weekly brief write coach tables.
- Local SecureStore on device holds macro estimate and UI prefs — **not** authoritative server targets.

## Target additions

| Capability | Status |
| --- | --- |
| Purpose-tagged consent ledger | Missing |
| Role-based coach access (assigned members only) | Missing |
| Retention jobs + deletion workflow | Partial / undocumented ops |
| Cross-border transfer assessment | Docs stub (`0009`, `0015`) |
| Minimal AI context packing | Partial |

## Principles

- Collect only for defined coaching/service purposes.
- Separate optional consents (analytics, optional AI, media sharing).
- Legal basis ≠ “consent for everything.”
- Encrypted in transit; secrets never in the mobile client.
- Access and coaching decisions must be auditable.
- Regulatory sign-off requires qualified Saudi counsel — not an AI checklist.

Related: `docs/security/privacy.md`, `docs/security/threat-model.md`.
