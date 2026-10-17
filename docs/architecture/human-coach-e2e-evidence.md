# Human coaching E2E evidence (synthetic)

Generated from local verification of PR #41 follow-up hardening + P2-HUM-01.

## Automated security / workflow evidence

| Check | Result |
| --- | --- |
| Domain tests | 115 passed |
| API tests | 52 passed (includes `coach-ops.integration.test.ts`) |
| Typecheck domain/contracts/api | passed |
| Coach portal production build | passed (`apps/coach-portal` vite build) |
| Migrations through `0024_human_coach_identity` on disposable PGlite | passed (idempotent re-run) |
| Prior CI on PR #41 head `b38acc3` | api + mobile **SUCCESS** (GitHub Actions) |

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

## Live app demo procedure (synthetic accounts only)

1. Start API (`npm run dev:api`) and Coach Workspace (`apps/coach-portal` → `npm run dev`).
2. Admin grants `coach_reviewer` via DB `role_assignments` (no self-serve role API).
3. Admin `POST /v1/coach/assignments`.
4. Member grants `POST /v1/member/coach-share-consent` (or via mobile weekly check-in).
5. Member logs water/food/sessions; opens **Weekly check-in** in mobile.
6. Member submits survey; coach inbox shows review.
7. Coach claims, rejects/approves proposals, sends feedback, optional escalate/follow-up.
8. Member sees human feedback in weekly check-in + coach tab (`authorKind: human_coach`).
9. Admin revokes assignment; coach reads return `403`.

## Compliance blockers (unchanged)

- **P0-PRIV** — Saudi legal/privacy review incomplete.
- **ENERGY_POLICY** — nutrition apply remains blocked.
- No real customer health data in pilot tooling until privacy/security gates clear.
