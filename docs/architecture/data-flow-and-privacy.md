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
| Purpose-tagged consent ledger | Partial — `member_coach_share_consents` for human coaching; full ledger + legal bases still **P0-PRIV blocked** |
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

---

## Appendix A — Personal / sensitive data inventory (P0-DATA-01)

Audit of migration-defined tables that can hold member-identifying or health-adjacent data. **Purposes are engineering intent only — not legal bases.** Retention = TBD pending counsel (P0-PRIV-01).

| Table / area | Examples of fields | Coaching purpose | Sensitivity | Notes |
| --- | --- | --- | --- | --- |
| `users` | email, locale | Account | Personal | Auth identity |
| `user_credentials` / codes / resets | password hash, tokens | Auth | Credential | Never to AI |
| `device_sessions` | device/session metadata | Auth | Personal | |
| `user_profiles` | sex, DOB/age, height, weight, experience, pace, horizon | Onboarding → plan params | Health-adjacent | Measured vs self-reported TBD |
| `onboarding_snapshots` | full intake JSON | Audit of intake | Health-adjacent | Versioned snapshot |
| `user_goals` | goal codes | Coaching goals | Low–medium | |
| `consents` | purpose, status | Legal/consent | Personal | Exists; ledger design incomplete |
| `weight_records` | weight_grams, dates | Progress / trends | Health | |
| `body_measurements` | girths / mm | Progress | Health | |
| `food_entries` / diary | macros, portions | Nutrition logging | Health-adjacent | |
| `nutrition_targets` | kcal/macros | Plan targets | Health-adjacent | Must not invent authority |
| `member_meal_plan_*` | day targets, slots | Meal plan | Health-adjacent | |
| `water_logs` / `activity_logs` | ml, steps, duration | Lifestyle signals | Low–medium | |
| `member_supplements` / `supplement_logs` | names, ticks | Adherence | Medium | Never infer take from reminder |
| `workout_sessions` / `workout_sets` / PRs | loads, reps, RPE | Training | Health-adjacent | |
| `programs` / `program_versions` | phase, pace, maintenance_kcal | Active plan | Health-adjacent | Energy apply gated by P0-SAFE-01 |
| `coach_*` (messages, memory, tools, checkins, briefs) | chat, summaries, queues | Yazan + human review | High | Minimize AI context |
| `ai_usage` | tokens/cost | Cost control | Operational | Not health content |
| `subscriptions` / payment / ledger | SKUs, money events | Billing | Financial | |
| `audit_logs` / `outbox` | system events | Security/ops | Mixed | |
| Community / media tables | posts, reports | Social (if enabled) | Personal | Separate consent |
| Local SecureStore (mobile) | macro estimate prefs | UX only | Device | Not authoritative server targets |

**AI processing:** Coach provider receives assembled context only — not unrestricted DB dumps. Cross-border transfer assessment still open (#13 / P0-PRIV-01).

**Evidence date:** 2026-10-17 · Baseline commit with vision docs: `24327cf`.
