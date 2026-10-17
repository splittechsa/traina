// Personal calorie & macro estimate (Mifflin–St Jeor + activity factor + goal adjustment).
//
// Deliberately an on-device *estimate*, not a server target: the domain package refuses to
// produce authoritative targets until a formula version is approved
// (packages/domain/src/nutrition.ts → authoritativeTargetFromFormula). This calculator never
// writes a NutritionTarget to the API; it's stored locally and labelled as an estimate.

import {
  assertEnergyPolicyApprovedForPaidCoaching,
  CUT_DEFICIT_BY_PACE,
  GAIN_SURPLUS_BY_PACE,
  type NutritionPace,
} from '@sahhti/domain';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';
export type Goal = 'lose' | 'maintain' | 'gain' | 'fitness';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

/**
 * Free on-device estimate (relative %). Soft % cut is for the free calculator only.
 * Traina Training uses absolute deficits by athlete-chosen pace (sprint/steady/gentle).
 */
export const GOAL_ADJUSTMENT: Record<Goal, number> = { lose: -0.2, maintain: 0, gain: 0.1, fitness: -0.05 };

/** @deprecated Prefer CUT_DEFICIT_BY_PACE — mid/natural cut. */
export const TRAINING_CUT_DEFICIT_KCAL = CUT_DEFICIT_BY_PACE.steady;

/** Protein in g per kg body weight (within the ISSN 1.6–2.2 g/kg range for trained people). */
export const PROTEIN_G_PER_KG: Record<Goal, number> = { lose: 2.0, maintain: 1.6, gain: 1.8, fitness: 1.6 };

export const LIMITS = {
  ageYears: { min: 16, max: 90 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
} as const;

/** Minimum daily energy we will ever suggest, by sex — common clinical floors. */
export const ENERGY_FLOOR_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };

export type TargetInput = {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
};

export type MacroTargets = {
  bmrKcal: number;
  maintenanceKcal: number;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** True when the goal deficit was capped by the energy floor. */
  floored: boolean;
  input: TargetInput;
  createdAt: string;
  style: EstimateStyle;
  pace: NutritionPace | null;
  horizonWeeks: number | null;
};

export function validateTargetInput(input: TargetInput): string[] {
  const problems: string[] = [];
  const within = (value: number, range: { min: number; max: number }) => Number.isFinite(value) && value >= range.min && value <= range.max;
  if (!within(input.ageYears, LIMITS.ageYears)) problems.push('ageYears');
  if (!within(input.heightCm, LIMITS.heightCm)) problems.push('heightCm');
  if (!within(input.weightKg, LIMITS.weightKg)) problems.push('weightKg');
  if (!(input.activity in ACTIVITY_FACTORS)) problems.push('activity');
  if (!(input.goal in GOAL_ADJUSTMENT)) problems.push('goal');
  if (input.sex !== 'male' && input.sex !== 'female') problems.push('sex');
  return problems;
}

/** Mifflin–St Jeor resting energy, kcal/day. */
export function mifflinStJeor(input: Pick<TargetInput, 'sex' | 'ageYears' | 'heightCm' | 'weightKg'>): number {
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + (input.sex === 'male' ? 5 : -161);
}

function roundTo(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

export type EstimateStyle = 'free' | 'training';

export { CUT_DEFICIT_BY_PACE, type NutritionPace };

function paceFromHorizon(weeks: number | null | undefined): NutritionPace {
  if (weeks === null || weeks === undefined) return 'steady';
  if (weeks <= 4) return 'sprint';
  if (weeks <= 10) return 'steady';
  return 'gentle';
}

/**
 * @param style `free` = soft % cut for the free calculator.
 *              `training` = adaptive AI absolute offset by pace/horizon.
 */
export function estimateTargets(
  input: TargetInput,
  now = new Date(),
  style: EstimateStyle = 'free',
  options: { pace?: NutritionPace; horizonWeeks?: number | null } = {},
): MacroTargets {
  const problems = validateTargetInput(input);
  if (problems.length > 0) throw new Error(`INVALID_TARGET_INPUT:${problems.join(',')}`);

  const bmr = mifflinStJeor(input);
  const maintenance = bmr * ACTIVITY_FACTORS[input.activity];
  const pace =
    style === 'training'
      ? options.horizonWeeks !== undefined && options.horizonWeeks !== null
        ? paceFromHorizon(options.horizonWeeks)
        : (options.pace ?? 'steady')
      : null;

  // Training-style absolute deficits are unapproved for paid coaching (P0-SAFE-01).
  if (style === 'training') {
    assertEnergyPolicyApprovedForPaidCoaching();
  }

  let adjusted: number;
  if (style === 'training' && pace !== null) {
    if (input.goal === 'lose') adjusted = maintenance - CUT_DEFICIT_BY_PACE[pace];
    else if (input.goal === 'gain') adjusted = maintenance + GAIN_SURPLUS_BY_PACE[pace];
    else if (input.goal === 'fitness') adjusted = maintenance - CUT_DEFICIT_BY_PACE.gentle / 2;
    else adjusted = maintenance;
  } else {
    adjusted = maintenance * (1 + GOAL_ADJUSTMENT[input.goal]);
  }

  const floor = ENERGY_FLOOR_KCAL[input.sex];
  const floored = adjusted < floor;
  const energyKcal = roundTo(Math.max(adjusted, floor), 10);

  const proteinG = Math.round(PROTEIN_G_PER_KG[input.goal] * input.weightKg);
  const fatG = Math.round(Math.max((energyKcal * 0.25) / 9, 0.6 * input.weightKg));
  const carbsG = Math.max(0, Math.round((energyKcal - proteinG * 4 - fatG * 9) / 4));

  return {
    bmrKcal: Math.round(bmr),
    maintenanceKcal: roundTo(maintenance, 10),
    energyKcal,
    proteinG,
    carbsG,
    fatG,
    floored,
    input,
    createdAt: now.toISOString(),
    style,
    pace,
    horizonWeeks: options.horizonWeeks ?? null,
  };
}

/**
 * Suggests an activity level from average daily steps (Tudor-Locke step-count bands).
 * Returns null without enough data so we never guess from a single day.
 */
export function activityFromSteps(dailySteps: readonly number[]): ActivityLevel | null {
  const days = dailySteps.filter((value) => Number.isFinite(value) && value >= 0);
  if (days.length < 3) return null;
  const average = days.reduce((sum, value) => sum + value, 0) / days.length;
  if (average < 5000) return 'sedentary';
  if (average < 7500) return 'light';
  if (average < 10000) return 'moderate';
  if (average < 12500) return 'very';
  return 'athlete';
}
