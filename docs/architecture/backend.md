# Backend architecture

`services/api` is a Fastify process.

Public routes: `GET /v1/health`, `GET /v1/ready`, `GET /v1/meta`.

Authenticated routes, when auth is configured:

- `POST /v1/onboarding/validate` — validation only, `persisted: false`
- `POST /v1/nutrition/diary/summarize` — arithmetic only, no client calorie target
- `POST /v1/partnerships/commissions/quote` — quote only, `settlementAllowed` forced false
- `POST /v1/internal/commissions/settle` — always 503 `LEDGER_DATABASE_REQUIRED`
- `POST /v1/internal/billing/verify` — always 501 `STORE_VERIFIER_NOT_CONFIGURED`

Default auth mode is unconfigured, so those posts return 503.

Ledger inserts, when a repository is later connected, must use `insertLedgerStatement`, which passes values as parameters.

The migrate script reads `database/migrations` in filename order, records `schema_migrations`, and exits with `DATABASE_NOT_CONFIGURED` when `DATABASE_URL` is missing. That path was unit tested. A live apply was not.

Workers, Redis, and the model orchestrator are not processes yet. The outbox table is reserved for them.
