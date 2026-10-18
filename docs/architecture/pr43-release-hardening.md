# PR #43 — Release hardening evidence (2026-10-18)

**Branch:** `p1/real-training-adaptation`  
**PR:** https://github.com/splittechsa/traina/pull/43  
**Backup preserved:** `backup/dirty-tree-2026-10-17`

## Atomicity

`applyTrainingRecommendationToProgram` runs inside `db.transaction`:

1. `FOR UPDATE` on recommendation (scoped `user_id`)  
2. Re-check `program_adaptation_applications` under lock  
3. `FOR UPDATE` active program + latest `program_versions`  
4. Insert next `program_versions`  
5. Insert `program_adaptation_applications` (UNIQUE `recommendation_id`)  
6. Update recommendation → `APPLIED`  

On any failure → `ROLLBACK` (no false APPLIED).  
Concurrent applies: unique violation `23505` or locked re-check → idempotent success. Exactly one version bump.

## Hardening coverage (`program-adaptation.integration.test.ts`)

| Case | Result |
| --- | --- |
| Preview before/after | pass |
| Confirm → apply | pass |
| Concurrent triple apply | pass (1 winner, 2 idempotent) |
| Single audit row | pass |
| Workout sets reflect v2 adaptation (3→2) | pass |
| Session linked to program_versions.version=2 | pass |
| Stale expectedProgramVersion | pass (rejected) |
| Cross-user apply | pass (404) |
| Nutrition APPLIED / program nutrition | pass (ENERGY_POLICY blocked) |

## Migrations 0025–0027 (Neon staging)

Verified present on `fragrant-fog-72018396`.  

**Rollback:** restore app image; do **not** DROP forward migrations. Snapshot restore only with ops approval. Forward-fix if schema must change.

## ENERGY_POLICY

- `applyPermittedRecommendation` refuses training (must use program service) and blocks nutrition.  
- `POST /v1/training/programs/nutrition` gated by `assertEnergyPolicyApprovedForPaidCoaching`.  
- No alternate apply route found that mutates nutrition targets without the gate.

## Live Gemini smoke (local env)

- `POST /v1/coach/messages` with `{ "message": "..." }` only  
- Result: **200**, reply `gemini-ok`, `productionIntelligence` path active (provider configured)  
- No API key logged or committed  

## Suites executed (this hardening pass)

| Suite | Result |
| --- | --- |
| Domain | 128 passed |
| Contracts | 3 passed |
| API migrate + coach-ops + program-adaptation | 7 passed |
| Mobile typecheck | passed |
| Prior GitHub CI on PR #43 | api + mobile SUCCESS (pre-hardening SHA) |

## Independent review findings (2026-10-18) — fixed on branch

| Severity | Finding | Fix |
| --- | --- | --- |
| High | Idempotent apply IDOR leaked `diff` / version after apply | Owner-scoped `loadAdaptationApplication` JOIN; 404 when recommendation not owned |
| High | Member could `APPROVED` from `REVIEW_REQUIRED` then apply | Member advance rejects with `HUMAN_REVIEW_REQUIRED`; coach decide only |
| Medium | Adaptation apply without `expectedProgramVersion` | Fail closed (`MISSING_EXPECTED_PROGRAM_VERSION`) except preview |
| Medium | Soft/no-op integration asserts | Hard asserts for stale, post-apply IDOR, ENERGY_POLICY code |

## Remaining before VERIFIED / merge

- [x] Push review-fix commit; CI green on **latest** SHA  
- [ ] Explicit human approve on GitHub (automated review findings addressed)  
- [ ] Physical iPhone evidence still open (non-blocking for API apply gate; blocks full P2 product exit)
