import { phaseFromAthleteGoals, type NutritionPace } from '@sahhti/domain';
import { estimateTargets, type ActivityLevel, type Goal, type MacroTargets, type Sex } from './targets';

/** Map domain activity labels onto the on-device estimator. */
export function activityForEstimate(level: string): ActivityLevel {
  if (level === 'high' || level === 'very') return 'very';
  if (level === 'sedentary' || level === 'light' || level === 'moderate' || level === 'athlete') return level;
  return 'moderate';
}

export function goalForEstimate(goals: readonly string[]): Goal {
  const phase = phaseFromAthleteGoals(goals);
  if (phase === 'cutting') return 'lose';
  if (phase === 'gain') return 'gain';
  if (phase === 'fitness') return 'fitness';
  return 'maintain';
}

/**
 * Local free-tier estimate from onboarding facts — soft % goals only.
 * Must NOT use `training` absolute deficits (P0-SAFE-01); those require an approved
 * ENERGY_POLICY and a gated paid apply path on the server.
 */
export function targetsFromOnboarding(input: {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goals: readonly string[];
  /** Retained for call-site compatibility; ignored until ENERGY_POLICY is approved. */
  nutritionPace?: NutritionPace | null;
  horizonWeeks?: number | null;
}): MacroTargets {
  void input.nutritionPace;
  void input.horizonWeeks;
  return estimateTargets(
    {
      sex: input.sex,
      ageYears: input.ageYears,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      activity: activityForEstimate(input.activityLevel),
      goal: goalForEstimate(input.goals),
    },
    new Date(),
    'free',
  );
}
