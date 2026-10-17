# Human coaching E2E evidence (synthetic)

Generated from verification of PR #41 (merged) + P2-HUM-01 follow-up.

## Disposition

| Item | Value |
| --- | --- |
| PR | [#41](https://github.com/splittechsa/traina/pull/41) **MERGED** |
| Merge commit | `ff2bb872f0cd7770fff151c6295a1268a84ec2e4` |
| CI (final head `69f8383`) | api + mobile **SUCCESS** |

## Automated security / workflow evidence

| Check | Result |
| --- | --- |
| Domain tests | 115 passed |
| API tests | 52 passed (includes `coach-ops.integration.test.ts`) |
| Typecheck domain/contracts/api + mobile | passed |
| Coach portal production build | passed (`apps/coach-portal` vite build) |
| Migrations through `0024_human_coach_identity` on disposable PGlite | passed (idempotent re-run) |
| Live Neon schema | `coach_assignment_events`, `member_coach_share_consents`, `weekly_review_queue`, `coach_capacity` present |
| Live runtime demo | `docs/architecture/human-coach-live-runtime.json` |

### Security scenarios covered in `coach-ops.integration.test.ts`

1. Coach self-assignment → `403 FORBIDDEN`
2. Member self-assignment → `403 FORBIDDEN`
3. Unassigned coach MemberState / packet → `403`, no `state` field
4. Consent required; withdrawal blocks subsequent reads
5. Missing review ID → same `403 FORBIDDEN` (no existence oracle)
6. Weekly submit idempotent (single queue row per member+week)
7. Concurrent claims — one winner / conflict path exercised
8. Revoke + reassign — previous coach denied, new coach allowed
9. Full loop: consent → assign → activity → weekly brief → claim → feedback → member feedback inbox

## Live runtime demonstration (2026-10-17, synthetic Neon accounts)

Executed via `scripts/live-coach-demo.mjs` against local API on port 3040 + Neon Postgres after merge `ff2bb87`.

| Step | Result |
| --- | --- |
| Coach self-assign | `403 FORBIDDEN` |
| Member consent | `granted` |
| Admin assign | `persisted: true` |
| Unassigned coach IDOR | `403`, no `state` |
| Assigned coach read | `200`, confidence returned |
| Weekly brief | `QUEUED_FOR_HUMAN` |
| Coach inbox | 1 review |
| Claim | `IN_REVIEW` |
| Packet | `sleepLoggingAvailable: false`; member questions preserved |
| Feedback | `authorKind: human_coach` |
| Member received feedback | yes |
| Workload metrics | assigned/capacity/SLA fields present |
| Revoke | coach subsequent read `403`, no `state` |

Coach Workspace UI verified at `http://127.0.0.1:5174/` (login composition captured in session).

Mobile weekly check-in: `apps/mobile/app/weekly-checkin.tsx` (typecheck passed; Expo UI not screenshot in this run — API path covered live).

## Compliance blockers (unchanged)

- **P0-PRIV** — Saudi legal/privacy review incomplete.
- **ENERGY_POLICY** — nutrition apply remains blocked.
- No real customer health data in pilot tooling until privacy/security gates clear.
