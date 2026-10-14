# ADR 0001 — Modular monolith

## Status

Accepted for the current codebase.

## Decision

Sahhti starts as one TypeScript backend with a pure domain package and a thin HTTP adapter. Domain modules can be tested without a network. We will not split microservices until a measured operational boundary needs its own deploy, scaling, or team.

## Consequences

`packages/domain` must not import Fastify, PostgreSQL, or an LLM SDK. Persistence and providers sit behind the API and future worker processes.
