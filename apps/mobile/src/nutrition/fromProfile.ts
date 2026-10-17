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

/** Build the local estimate from onboarding facts — no second data-entry form. */
export function targetsFromOnboarding(input: {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goals: readonly string[];
  nutritionPace?: NutritionPace | null;
  horizonWeeks?: number | null;
}): MacroTargets {
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
    'training',
    {
      pace: input.nutritionPace ?? 'steady',
      horizonWeeks: input.horizonWeeks ?? null,
    },
  );
}
