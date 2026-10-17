# Dirty-tree inventory — 2026-10-17

**Recoverable backup branch:** `backup/dirty-tree-2026-10-17`  
**Compared against:** `origin/master` @ `84f5639`  
**Policy:** No force-push; no discard without explicit approval; no secrets committed.

## Classification

### Documentation / infra
| Path | Kind | Notes |
| --- | --- | --- |
| `.env.example` | Modified | Placeholders only (`PORT`, auth comments) — safe |

### Database
| Path | Kind | Notes |
| --- | --- | --- |
| `database/migrations/0011`–`0020` | Untracked | Gym catalog, programs, daily logs, meal slots, supplements, meal plans, pace/horizon, Yazan daily/weekly, profile sex/pace |

### Domain / coaching engine
| Path | Kind | Notes |
| --- | --- | --- |
| `packages/domain/src/daily.ts` (+ test) | Untracked | Daily logging domain |
| `packages/domain/src/programs.ts` (+ test) | Untracked | Program templates |
| `packages/domain/src/yazan-coach.ts` (+ test) | Untracked | Daily brief / weekly packet |
| `packages/domain/src/progress.test.ts` | Untracked | |
| `packages/domain/src/index.ts` | Modified | Re-exports |
| `packages/domain/src/onboarding.ts` (+ test) | Modified | Sex/pace/horizon |
| `packages/domain/src/progress.ts` | Modified | |
| `packages/domain/src/training.ts` (+ test) | Modified | |

### Contracts
| Path | Kind | Notes |
| --- | --- | --- |
| `packages/contracts/src/index.ts` (+ test) | Modified | Meal-plan / nutrition schemas |

### API
| Path | Kind | Notes |
| --- | --- | --- |
| `services/api/src/routes/product.ts` | Modified | Product routes incl. nutrition/coach |
| `services/api/src/coach/provider.ts` (+ test) | Modified | Yazan persona |
| `services/api/src/app.test.ts` | Modified | |
| `services/api/src/onboarding-loop.integration.test.ts` | Modified | |
| `services/api/src/member/store.ts` | *(already on master for energy gate)* | Large local coaching store may still differ if further edits |

### Mobile — screens
| Path | Kind | Notes |
| --- | --- | --- |
| Onboarding, tabs (home/coach/nutrition/training), food-log, macros, progress, scanner, settings, supplements, exercises, workout/[id] | Modified | Coaching-centered UX |
| `meal-plan`, `measurements`, `plan`, `quick-activity`, `water`, `week-report` | Untracked | New screens |

### Mobile — src
| Path | Kind | Notes |
| --- | --- | --- |
| `src/daily/*` | Untracked | Home coaching desk / shortcuts |
| `src/nutrition/fromProfile.ts` | Untracked | Profile → free estimate |
| `src/nutrition/logFood.ts`, `targets.ts` *(targets gate on master)* | Modified | |
| `src/training/*`, `src/api/errors*`, `src/format*`, `src/i18n/*`, `src/onboarding/*`, `src/storage/local.ts`, `src/ui/*` | Modified / untracked | |

## Sensitive-file check

| Candidate | Action |
| --- | --- |
| `.env` / real secrets | Not staged (gitignored) |
| `.env.example` | Placeholders only — OK to commit |
| Member PII / health dumps | None found in tree |

## Regressions / unfinished (known)

- Migrations 0011–0020 uncommitted ⇒ API code that depends on them will fail on a clean `master` checkout.
- Domain modules (`daily`, `programs`, `yazan-coach`) uncommitted but imported by API/mobile locally.
- Energy policy: `athleteEnergyPlan` / `proposeWeeklyNutritionStep` still *compute* placeholders; apply paths gated — see P0-SAFE-01 audit.
- Human coach dashboard / MemberState engine still missing.

## Reconciliation plan

1. Snapshot commit on `backup/dirty-tree-2026-10-17` (this inventory + all coherent work).
2. Push backup branch (non-destructive).
3. Slice logical commits onto feature branches from `master` after tests pass per slice.
4. Keep master protected; merge only verified slices.
