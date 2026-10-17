# Publish checklist (Traina / apps/mobile)

## Product path

- **Ship:** `apps/mobile` (Expo) + `services/api` + `packages/*`
- **Ignore for store builds:** legacy root `app/`, root `src/` (duplicates of older Expo trees)

## Required API env (root `.env`, never commit)

```bash
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...   # migrations
SAHHTI_TOKEN_SECRET=...     # enables auth: session
PORT=3040
# Optional coach model:
# SAHHTI_COACH_PROVIDER=openai_compatible
# SAHHTI_COACH_API_KEY=...
# SAHHTI_COACH_BASE_URL=...
# SAHHTI_COACH_MODEL=...
```

Without `SAHHTI_TOKEN_SECRET`, health reports `"auth":"unconfigured"` and login shows AUTH_NOT_CONFIGURED.

## Onboarding is the only profile intake

Age, sex, height, weight, sports, goals, activity, diet, and cut/bulk pace are collected in onboarding.  
`/macros` only **shows** derived targets — it does not re-ask the same facts.

Daily logs (water, food, workouts, supplements) remain free **input** for Yazan.

## Removed from settings (stubs)

Membership, help, and notifications empty screens are no longer linked from settings.

## Pre-flight

```bash
npm run build
npm test
npm run migrate
# API with .env loaded → /v1/health shows auth: session
cd apps/mobile && npx tsc -p tsconfig.json --noEmit
```

## Store notes

1. Set `EXPO_PUBLIC_API_URL` to the production API (HTTPS).
2. Confirm Arabic RTL on a real device.
3. Coach chat needs a configured model provider for free replies; daily check-in works without it.
4. Do not invent burned-kcal claims in store listing copy.
