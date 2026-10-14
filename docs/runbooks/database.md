# Database operations

## Local development

Port 3000 on this PC is already used by another application. Sahhti’s development API listens on port 3040 and refuses to share that port.

```powershell
npm run dev:api
```

That command builds the API, creates `.data/dev-token-secret` if needed, and stores PostgreSQL-compatible data in `.data/pglite`. Restarting the Windows process does not delete `.data/pglite`.

Do not set `NODE_ENV=production` with `SAHHTI_PGLITE_DIR`. The process exits.

## Neon

The API reads `DATABASE_URL` and `DATABASE_URL_UNPOOLED` from the gitignored root `.env`. `npm run dev:api` loads only those two keys. It does not pass them to Expo. When `DATABASE_URL` is set, the dev script removes `SAHHTI_PGLITE_DIR`, and a Postgres connection error stops the process instead of opening PGlite.

```powershell
cd C:\Users\Ahmed\Desktop\app
npm run dev:api
```

`GET http://127.0.0.1:3040/v1/health` returns `"database":"postgres"` and `"auth":"session"`. `/v1/ready` still reports `store_verifier` until store receipt checks exist.

This PC cannot open TCP port 5432 to Neon (`ETIMEDOUT`). Port 443 is open, so the API uses Neon's TLS WebSocket (`useSecureWebSocket`) for `*.neon.tech` hosts. The pooled URL serves the app. Migrations use the direct URL. The driver removes `channel_binding` because the Node client does not support it; `sslmode=require` stays. Other hosts still use `node-postgres` with certificate verification.

Migrations `0001` through `0004` are additive. They were applied on branch `sahhti-schema-check` (`br-lingering-frog-b4urbnyl`) and then on production. A second production apply wrote nothing. Local PGlite rows were inserted with `ON CONFLICT DO NOTHING`. `.data/pglite` was left in place. A second copy inserted zero rows.

Outbound `psql` and `neon inspect` cannot reach port 5432 from this PC. A snapshot restore comparison has not been run. Set a spending limit in the Neon console before leaving the free plan.

## PGlite copy

Copying `.data/pglite` is the local backup. The integration test reopens that directory in a new process connection and reads the same profile. A copied directory can be opened with `SAHHTI_PGLITE_DIR` pointing at the copy.
