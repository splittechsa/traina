# Sahhti

Sahhti (صحتي) is a Saudi fitness platform. The repository contains a modular TypeScript API, deterministic domain rules, a PostgreSQL schema, and an Expo member application.

It is not a finished consumer product. No iOS or Android binary has been compiled. No identity provider, payment verifier, or model provider is connected. The million-user target is a planning assumption, not a measured result.

## What runs today

```bash
npm install
npm test
npm run typecheck
```

`npm test` runs 74 tests: domain rules, wire contracts, design tokens, and the HTTP API, including PGlite persistence.

The member app is separate and is not part of the root workspace:

```bash
cd apps/mobile
npm install
npm test
npm run typecheck
npx expo start
```

Windows development and the EAS iOS path are described in [docs/architecture/expo-windows.md](docs/architecture/expo-windows.md).

## API

Without a database the API fails closed. With a development database:

```powershell
$env:SAHHTI_PGLITE_DIR = ".data/pglite"
$env:SAHHTI_TOKEN_SECRET = "development-token-secret"
npm run build
node services/api/dist/server.js
```

`GET /v1/health` returns live. `GET /v1/ready` stays 503 because store verification is not configured. PGlite does not start when `NODE_ENV=production`.

PostgreSQL on Neon is the system of record for the API. The phone never receives the database URL. Migrations live in `database/migrations`. `npm run migrate` reads the gitignored root `.env` and uses the direct URL.

```powershell
npm run migrate
```

## Layout

| Path | Role |
| --- | --- |
| `packages/domain` | Authoritative business rules. No HTTP, no database. |
| `packages/contracts` | Request schemas for the public API. |
| `packages/design-tokens` | Shared visual tokens. Arabic is RTL. |
| `services/api` | Fastify HTTP adapter over the domain. |
| `apps/mobile` | Expo member application. |
| `database/migrations` | PostgreSQL schema. Append-only ledger. |
| `docs` | Architecture, ADRs, security, and runbooks. |

## Status

See [STATUS.md](STATUS.md). Do not treat a document or a route as production-ready unless that file says it was executed.
