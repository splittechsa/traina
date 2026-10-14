# Infrastructure as code

No cloud project is connected. Terraform has not been initialized and there is no state file.

When a region is chosen under `docs/adr/0009-residency-unverified.md`, add modules here for the network, PostgreSQL, the API service, Redis, object storage, and secrets. Do not commit credentials or a `.tfstate` file.
