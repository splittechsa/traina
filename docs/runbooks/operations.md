# Operational runbooks

## Local checks

```bash
npm install
npm test
npm run typecheck
```

Expect 67 tests and a successful typecheck. If `GET /v1/ready` is ever 200 in this revision, that is a defect: readiness requires a database, production auth, and store verifiers.

## Start the API

```bash
npm run build
node services/api/dist/server.js
```

The process listens on port 3000. Member routes return 503 until `SAHHTI_AUTH_MODE` is set. Do not set `hmac_dev` in production. The server throws if that combination is used.

## Migrate

Set `DATABASE_URL` to a PostgreSQL 16 database you control, then `npm run migrate`. The script has not been executed here. If it fails, the transaction for that file rolls back. Do not edit an applied migration; add a new file.

## Settlement

There is no operational settlement. The settle route returns 503. Do not pay a gym from a quote response or from a spreadsheet total.

## Incidents

There is no on-call rotation, status page, or pager. Add them before production traffic. Ledger corrections are reversing entries by a finance role, written to the audit log.

## Secrets

Do not commit `.env`. The example file lists names only.
