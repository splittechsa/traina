# Traina architecture at the 2026-10-20 verification pass

Status: current-code overview, not a production-completion certificate.

| Layer | Current source | Boundary |
| --- | --- | --- |
| Member client | apps/mobile (Expo SDK 57, React Native, Expo Router) | Session tokens, localized UI, query cache, durable pending workout writes |
| Coach client | apps/coach-portal | Assigned member review operations through authorized API routes |
| Public site | apps/www | Static Arabic/English draft; paid checkout and store installation are not ready |
| Contracts | packages/contracts | Server request validation; program drafts optionally carry expectedVersion |
| Domain | packages/domain | Training/nutrition models, recommendation transitions, ENERGY_POLICY and coaching tools |
| API | services/api | Fastify, session authorization, persistence, entitlement projection and provider orchestration |
| Database | database/migrations; services/api/src/db/database.ts | Neon PostgreSQL in configured production; disposable PGlite in synthetic acceptance |
| Shared UI | packages/design-tokens; apps/mobile/src/theme and src/ui | Reusable visual tokens/components; native design acceptance remains open |

Program edits lock the owned active program, read its latest version and validate the submitted days within one transaction before adding a member_customize version. The current editor submits its initial version to detect stale saves. Approved adaptations use the existing program version system and deterministic recommendation transitions; nutrition approval restrictions remain active.

Workout UI projects durable pending writes over fetched session state for display. Sync independently fetches authoritative server state, preserves conflicts/failures, sends commands in insertion order and acknowledges only confirmed commands in a SQLite transaction. Full cold-start offline recovery and conflict-resolution UI are still open. Local cache state is never accepted as proof that the server saved a command.

Yazan uses the configured compatible provider and server-resolved member projections. Read tools do not authorize model-driven writes. Member confirmation and required human/scientific approval remain backend/domain boundaries. Three live synthetic smoke cases were observed; complete AI quality/safety/cost acceptance is outstanding.

Account closure revokes active sessions but does not prove historical erasure. The export endpoint currently returns a summary. Paid billing, push delivery, legal approvals, production restore and real-device acceptance remain release blockers.
