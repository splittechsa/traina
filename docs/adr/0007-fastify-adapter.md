# ADR 0007 — Fastify HTTP adapter

## Status

Accepted for this increment.

## Decision

The recommended long-term shape was a NestJS modular monolith. The domain is framework-neutral, and the first HTTP adapter is Fastify so the routes stay thin and testable with `inject`.

NestJS remains an option if the team wants its module container later. That move must not pull business rules into controllers.

## Consequences

OpenAPI in `docs/api/openapi.yaml` describes the routes that exist. It is not a generated Nest surface.
