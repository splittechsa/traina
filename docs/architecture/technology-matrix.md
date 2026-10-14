# Technology decision matrix

| Choice | Selected now | Alternative | Why |
| --- | --- | --- | --- |
| System of record | PostgreSQL 16 | Supabase-hosted Postgres | Transactions and foreign keys are required. Supabase region, backup, and Saudi residency were not verified here, so it is not selected. |
| Auth | Unconfigured; fail closed | Supabase Auth, Clerk, or custom passwords | Passwords are not stored. A provider is a later decision. |
| API | Fastify | NestJS | Domain stays framework-free. Nest remains possible later. See ADR 0007. |
| Money | Integer halalas and basis points | Floating point or client totals | Reproducible ledger math. |
| Mobile | Native SwiftUI and Compose, not started | React Native or a WebView | The product requires native health, billing, and camera APIs. Those projects are not compiled on this machine. |
| AI | Tool boundary only | A single chat transcript | Structured memory and tools are specified. No provider is wired, so there is no live coach. |
| Queue | Designed as a later worker | A dozen microservices | Outbox table exists in SQL. No Redis or BullMQ process is running. |
| IaC | Documented, not applied | Clicked cloud consoles | No cloud account is configured in this workspace. |

Supabase would be reconsidered only with written evidence of region, point-in-time recovery, backup restore, and a residency decision. Marketing claims are not that evidence.
