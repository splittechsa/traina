# Member app on Windows

Sahhti's member client is Expo SDK 57 in `apps/mobile`. It is a React Native application, not a WebView. ADR 0012 records that choice.

## What this machine can do

Install dependencies and start the JavaScript bundler:

```powershell
cd apps/mobile
npm install
npm test
npm run typecheck
npx expo start
```

Expo Go on a physical iPhone can load screens that stay inside the Expo Go native runtime. SecureStore, SQLite, camera, and notifications are included in Expo Go for this SDK. A physical phone cannot reach `127.0.0.1` on the Windows PC. Set `EXPO_PUBLIC_API_URL` to the PC's LAN address. See `apps/mobile/.env.example`.

The API for a physical iPhone listens on port **3040**, not 3000. Port 3000 on this PC is already taken by another program, and a phone request to it can miss Sahhti.

```powershell
npm run dev:api
```

In the app, set the API field to `http://192.168.8.39:3040` while this PC's Wi-Fi address stays `192.168.8.39`. The phone talks only to Fastify. Fastify talks to Neon. Do not put `DATABASE_URL` in `apps/mobile/.env` or in the API field. `127.0.0.1` is the phone itself, not the PC. The app stores the API address and restores it before the first signed-in request. If the start screen cannot load the profile, it shows the reason and the address, with Try again and Sign out.

Reload Expo Go after changing `apps/mobile/.env`. The value is development configuration and is not a production address.

PGlite is refused when `NODE_ENV=production`. The coach flag `SAHHTI_COACH_PROVIDER=development_mock` enables a labeled development mock. Leave it unset and the coach route returns `MODEL_PROVIDER_NOT_CONFIGURED`.

## What still needs Apple's cloud macOS

These commands were not run. No EAS project id is stored, and no binary has been compiled.

- `eas login` and `eas init` need an Expo account. Do not invent a project id.
- `eas build --platform ios --profile development` compiles on EAS-hosted macOS and needs an Apple Developer Program membership.
- `eas submit --platform ios` and TestFlight need App Store Connect credentials.
- `npm run ios` needs a local Mac. Do not use it on Windows.

Android cloud builds (`eas build --platform android`) also were not run. They do not need a local Android SDK, and they do not need a Mac. Play internal testing still needs a Play Console account.

Store review, Sign in with Apple, StoreKit, and Play Billing are not configured.
