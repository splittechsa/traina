# EAS builds & device QA (no local Xcode / no local ADB)

Traina mobile (`apps/mobile`) uses Expo native modules (SQLite, camera, sensors, notifications). Use **EAS Build** to produce installable iOS/Android binaries without a Mac or local Android SDK.

## Profiles (`apps/mobile/eas.json`)

| Profile | Purpose | Distribution |
| --- | --- | --- |
| `development` | Dev Client with native modules; hot reload against Metro | Internal (TestFlight / internal) |
| `preview` | Internal QA build closer to production | Internal |
| `production` | Store-bound release | Store / submit |

## Required Expo configuration

- Project already linked: `extra.eas.projectId` in `app.json`
- Bundle IDs: iOS `sa.sahhti.member`, Android `sa.sahhti.member`
- Runtime version policy: `appVersion`
- Updates URL configured for EAS Update channel

## Environment variables (never bake secrets into the binary)

| Variable | Where | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `.env` / EAS env (non-secret) | Staging or LAN API. Physical devices cannot use `127.0.0.1`. |
| `SAHHTI_COACH_*` | **API server only** | Gemini / OpenAI-compatible keys stay on the API host |
| `DATABASE_URL` | **API server only** | Never in the mobile build |
| Apple / Google signing | EAS Credentials | Managed by Expo; not committed |

Use EAS secrets / environment for preview/production. Do not put API keys in `EXPO_PUBLIC_*`.

## Development vs preview

1. **Development client** — `eas build -p ios --profile development` then `npx expo start --dev-client`
2. **Preview** — installable QA build pointed at staging API via `EXPO_PUBLIC_API_URL`

## iOS signing (external dependency)

Without Apple Developer credentials / device UDIDs registered, **iOS internal builds are BLOCKED** at Apple signing — not at engineering.

Exact dependency:

1. Apple Developer Program membership
2. EAS credentials: `eas credentials -p ios`
3. Ad-hoc or TestFlight distribution
4. Device UDID registered for ad-hoc (or TestFlight tester invite)

Until then: ship Android preview + keep iOS acceptance **BLOCKED**.

## Android requirements

- `eas build -p android --profile preview` produces an APK/AAB
- Install via Expo dashboard link or `adb install` when ADB is available
- No Play signing required for internal preview

## Installation

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build -p ios --profile development   # needs Apple creds
npx eas-cli build -p android --profile preview
```

Install from the Expo build page QR / link. For Dev Client:

```bash
cd apps/mobile
# EXPO_PUBLIC_API_URL=https://staging.example.com  (or LAN IP)
npx expo start --dev-client
```

## API connection

1. Run staging API with coach env configured on the **server**
2. Set `EXPO_PUBLIC_API_URL` to a reachable HTTPS or LAN URL
3. Confirm `/v1/health` (or login) from the phone browser first

## Screenshot & log collection

- Screenshots: iOS Screenshot / Android Volume+Power
- Logs: Expo Dev Tools, or `npx expo start` Metro logs; attach Crashlytics later
- Save under `docs/evidence/pr49-device/` with screen name + locale

## Test accounts

Create via register/verify flow on staging. Do not embed passwords in builds or docs. Prefer dedicated QA accounts with coach entitlement flags set **server-side**.

## Acceptance states for device journeys

Until installs succeed: journeys are **BLOCKED** (signing/hardware) or **NOT TESTED** — not **FAIL**.
