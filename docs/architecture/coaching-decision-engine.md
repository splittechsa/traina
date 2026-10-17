# Coaching decision engine

## Rule

The LLM **must not** invent calorie prescriptions, supplement dosages, exercise restrictions, or arbitrary cut rules. Deterministic policies decide; AI explains.

## Current implementation (audit)

| Piece | Location | Status |
| --- | --- | --- |
| Fixed cut deficits by pace | `packages/domain/src/meal-plan.ts` `CUT_DEFICIT_BY_PACE` sprint=1100 / steady=650 / gentle=400 | **UNSAFE FOR PAID DEPLOYMENT** as universal presets — P0 audit required |
| Weekly propose from weight + meal/water adherence | `proposeWeeklyNutritionStep` | Partial; alert flag exists; no versioned apply workflow |
| Daily directives | `packages/domain/src/daily.ts` `coachingDirectives` | Existing, today-scoped |
| Yazan daily brief | `packages/domain/src/yazan-coach.ts` | Existing deterministic opener |
| Approved formula calorie targets | `packages/domain/src/nutrition.ts` | Refuses authoritative targets until approved |

## Required registry (target)

Each policy/formula needs: id, rationale, population, inputs/units, contraindications, evidence quality, limitations, review date, tests, approval status.

Coverage: energy estimates, macro ranges, weight trends, progression, volume/frequency, adherence, recovery, activity — with confidence gates.

## Critical P0 action

Do **not** treat `CUT_DEFICIT_BY_PACE` as universally safe. Replace with individualized, professionally reviewed constraints and exclusion rules before paid coaching launch. Extreme horizons must be rejected or revised, not blindly accepted.

## Recommendation categories

- **A** Daily low-risk guidance  
- **B** Training adaptations  
- **C** Nutrition adaptations (no meal-by-meal punishment)  
- **D** Human-required decisions  

See `docs/quality/coaching-safety-tests.md`.
