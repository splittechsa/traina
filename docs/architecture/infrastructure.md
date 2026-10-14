# Infrastructure

Nothing in this file has been provisioned.

## Target, after a residency decision

- API and workers as containers, at least two instances, behind a load balancer.
- Managed PostgreSQL 16 with point-in-time recovery, private networking, and a role that cannot update ledger tables.
- Redis for cache, rate limits, and a queue.
- Object storage and a CDN for media, with private buckets and scanned uploads.
- Secret manager, managed logs, metrics, traces, and a container registry.
- Separate local, development, staging, and production projects.

## Regions to evaluate

AWS Bahrain (`me-south-1`), Google Cloud Dammam (`me-central2`), and Saudi-operated clouds. The choice is blocked on ADR 0009.

## This workspace

No Terraform state, no cloud credentials, and no Docker daemon. `infrastructure/terraform` records that absence. CI is a GitHub Actions workflow that runs `npm test` and `npm run typecheck` on Ubuntu. It does not deploy.
