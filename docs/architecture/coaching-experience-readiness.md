# P2 — Coaching experience & operational readiness

## Release baseline

| Item | Value |
| --- | --- |
| PR #41 | MERGED — `ff2bb872f0cd7770fff151c6295a1268a84ec2e4` |
| PR #42 (evidence, sanitized) | MERGED — `deb009d31cf36acee8d8a221583eee47dae046e3` |
| Master HEAD (merge base for readiness work) | `deb009d` |
| Dirty-tree backup | `backup/dirty-tree-2026-10-17` (retained; do not delete) |
| Migrations 0023–0024 | Fresh apply + same-DB upgrade covered in `migrate.integration.test.ts` |
| Demo API | Live on `:3040` after `npm run build -w @sahhti/api` + `node scripts/dev-api.mjs` — health `{"live":true,"database":"postgres"}`; `/v1/coach/assignments` present |
| Coach portal | `:5174` with `VITE_API_PROXY=http://127.0.0.1:3040` (default proxy `:3000` is wrong for this stack) |

## UI evidence checklist

| Surface | Evidence | Status |
| --- | --- | --- |
| Coach Workspace login | `docs/evidence/p2-coaching/01-coach-workspace-login.png` | Captured |
| Coach Workspace inbox + metrics | `docs/evidence/p2-coaching/02-coach-workspace-inbox.png` | Captured |
| Coach review desk (packet + claim) | `docs/evidence/p2-coaching/03-coach-review-desk.png` | Captured |
| Coach Workspace after feedback | `docs/evidence/p2-coaching/04-coach-workspace-completed.png` (Completed 14d = 1, inbox clear) | Captured |
| Expo Metro (device connect) | Metro `packager-status:running` on `:8081` | Running — QR/device shot pending |
| Mobile weekly check-in (physical iPhone) | Expo Go on device | **BLOCKER for milestone exit** |
| Member sees human feedback in Traina UI | API proves `authorKind: human_coach` + COMPLETED; UI screenshot still needs iPhone | Partial |

## Synthetic member → coach walkthrough (this session)

1. Bootstrap synthetic coach/admin/member (`*.sahhti.test`); grant `admin` / `coach_reviewer` via Neon `role_assignments`.
2. Member grants coach-share consent; admin assigns coach; member submits weekly brief (`QUEUED_FOR_HUMAN`).
3. Coach signs into Coach Workspace (`http://127.0.0.1:5174/`), opens inbox item, loads authorized packet (no invented weight).
4. Claim → `IN_REVIEW`; send personalized feedback → `authorKind: human_coach`; review → `COMPLETED`.
5. Member `GET /v1/member/weekly-review` returns unread feedback with human coach identity (not assistant).
6. Cohort ops (`scripts/coach-cohort-ops.mjs`, 3 members / 2 coaches): assign, claim, feedback, mark-overdue, revoke → 403; mean automated claim→feedback **5763 ms** (API wall clock — **not** staff capacity). Evidence: `docs/architecture/human-coach-cohort-runtime.json`.

## Yazan integration

- Tools: `getHumanCoachFeedback`, `getRecommendationStatus` (domain + mock provider).
- Never invent coach comments; pending recommendations are not treated as applied; nutrition safety / ENERGY_POLICY gate preserved.

## Privacy / production safety

- **P0-PRIV** blocked — Saudi legal review required.
- **ENERGY_POLICY** blocked — scientific review required.
- Consent withdrawal fail-closed for coach reads; historical feedback retention TBD by counsel.
- No coach packet CDN cache; portal refreshes ~20s from API.
- No real member health data in pilots.
- Details: `docs/architecture/data-flow-and-privacy.md`.

## Tests (readiness branch)

| Suite | Result |
| --- | --- |
| Domain | 117 passed (human feedback / recommendation tools) |
| API | 54 passed (Yazan feedback retrieval + coach ops + migrate upgrade) |
| Mobile typecheck | passed |
| Cohort runtime | passed — see `human-coach-cohort-runtime.json` |

## Deployment / rollback

| Step | Verification |
| --- | --- |
| Deploy | Apply migrations 0023–0024 on staging via upgrade path (not only empty DB); ship API build that includes `/v1/coach/*` |
| Smoke | `/v1/health` live+postgres; coach login; inbox; one synthetic claim/feedback |
| Rollback | Revert API release to previous image; do **not** reverse 0023–0024 in place — add forward fix migrations if schema must change. Portal is static Vite — roll back asset deploy independently. Dirty-tree backup branch remains available for local recovery |

## Outstanding release blockers

1. **Physical iPhone Expo screenshots** of weekly check-in (survey, share disclosure, status states, human feedback card) — required for acceptance.
2. **P0-PRIV** legal review before real member data.
3. **ENERGY_POLICY** scientific review before applying nutrition energy changes.
4. Measure **real coach staff time** in a supervised pilot (do not treat ~5.8s API timings as capacity).

## Acceptance criterion status

> Synthetic member completes weekly check-in on iPhone → coach reviews in web portal → personalized feedback → member sees feedback in Traina.

**Coach portal path: demonstrated with screenshots.**  
**iPhone member path: not yet demonstrated on device — milestone incomplete.**
