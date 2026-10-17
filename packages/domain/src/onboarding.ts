import { DomainError } from './errors.js';
import { DISCIPLINES, type Discipline } from './training.js';
import { parseScaledInteger } from './money.js';

export const GOALS = [
  'cutting',
  'fat_loss',
  'bulking',
  'muscle_gain',
  'body_recomposition',
  'strength',
  'endurance',
  'general_health',
] as const;

export const SPORTS = ['bodybuilding', 'calisthenics', 'crossfit', 'powerlifting', 'running', 'boxing', 'general_fitness'] as const;

export const EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const;
export const ENVIRONMENTS = ['home', 'gym', 'outdoor', 'mixed'] as const;
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'high', 'athlete'] as const;

export type Goal = (typeof GOALS)[number];
export type Sport = (typeof SPORTS)[number];
export type Experience = (typeof EXPERIENCES)[number];
export type TrainingEnvironment = (typeof ENVIRONMENTS)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export type RiskFlag =
  | 'minor_requires_review'
  | 'injury_reported'
  | 'body_mass_extreme'
  | 'self_reported_calorie_target_ignored';

export type BiologicalSex = 'male' | 'female';

export type OnboardingInput = {
  ageYears: number;
  heightCm: string;
  weightKg: string;
  /** Required for energy estimates (Mifflin). Collected in onboarding only. */
  sex: BiologicalSex;
  trainingExperience: Experience;
  goals: readonly Goal[];
  discipline: Discipline;
  sessionsPerWeek: number;
  environment: TrainingEnvironment;
  equipment: readonly string[];
  activityLevel: ActivityLevel;
  dietaryPreferences: readonly string[];
  allergies: readonly string[];
  supplements: readonly string[];
  injuries: readonly string[];
  preferredWorkoutTimes: readonly string[];
  hasGymMembership: boolean;
  gymReferralCode?: string;
  locale: 'ar' | 'en';
  userReportedCalorieTarget?: number;
  sports?: readonly Sport[];
  /** Optional coaching pace for cut/bulk — Yazan builds from this. */
  nutritionPace?: 'sprint' | 'steady' | 'gentle';
  horizonWeeks?: number | null;
};

export type FieldError = { field: string; code: string };

export type NormalizedOnboarding = {
  ageYears: number;
  heightMm: number;
  weightGrams: number;
  bmiHundredths: number;
  sex: BiologicalSex;
  trainingExperience: Experience;
  goals: readonly Goal[];
  discipline: Discipline;
  sessionsPerWeek: number;
  environment: TrainingEnvironment;
  equipment: readonly string[];
  activityLevel: ActivityLevel;
  dietaryPreferences: readonly string[];
  allergies: readonly string[];
  supplements: readonly string[];
  injuries: readonly string[];
  preferredWorkoutTimes: readonly string[];
  hasGymMembership: boolean;
  gymReferralCode: string | null;
  locale: 'ar' | 'en';
  sports: readonly Sport[];
  nutritionPace: 'sprint' | 'steady' | 'gentle' | null;
  horizonWeeks: number | null;
  authoritativeCalorieTarget: null;
  userReportedCalorieTarget: number | null;
  riskFlags: readonly RiskFlag[];
  requiresReview: boolean;
};

export type OnboardingResult =
  | { ok: true; record: NormalizedOnboarding }
  | { ok: false; errors: readonly FieldError[] };

function cleanList(values: readonly string[], field: string, maxItems: number, errors: FieldError[]): string[] {
  if (values.length > maxItems) {
    errors.push({ field, code: 'TOO_MANY' });
    return [];
  }
  return values.map((value) => value.trim()).filter((value) => value.length > 0 && value.length <= 80);
}

function includes<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

const sportDiscipline: Record<Sport, Discipline> = {
  bodybuilding: 'bodybuilding',
  calisthenics: 'calisthenics',
  crossfit: 'crossfit',
  powerlifting: 'powerlifting',
  running: 'functional_training',
  boxing: 'functional_training',
  general_fitness: 'general_fitness',
};

/** One stored discipline for the existing profile column. Several sports become hybrid. */
export function disciplineForSports(sports: readonly Sport[]): Discipline {
  const mapped = [...new Set(sports.map((sport) => sportDiscipline[sport]))];
  if (mapped.length === 1 && mapped[0] !== undefined) {
    return mapped[0];
  }
  return mapped.length > 1 ? 'hybrid' : 'general_fitness';
}

export function goalsForSports(sports: readonly Sport[]): readonly Goal[] {
  const allowed = new Set<Goal>();
  for (const sport of sports) {
    if (sport === 'bodybuilding') {
      allowed.add('cutting');
      allowed.add('bulking');
      allowed.add('body_recomposition');
      allowed.add('muscle_gain');
    }
    if (sport === 'powerlifting') allowed.add('strength');
    if (sport === 'running') allowed.add('endurance');
    if (sport === 'boxing' || sport === 'crossfit') {
      allowed.add('endurance');
      allowed.add('strength');
      allowed.add('general_health');
    }
    if (sport === 'calisthenics') {
      allowed.add('strength');
      allowed.add('general_health');
    }
    if (sport === 'general_fitness') allowed.add('general_health');
  }
  const ordered = GOALS.filter((goal) => allowed.has(goal));
  return ordered.length > 0 ? ordered : GOALS;
}

export function bmiHundredths(weightGrams: number, heightMm: number): number {
  return Number((BigInt(weightGrams) * 100_000n) / (BigInt(heightMm) * BigInt(heightMm)));
}

export function validateOnboarding(input: OnboardingInput): OnboardingResult {
  const errors: FieldError[] = [];
  if (!Number.isSafeInteger(input.ageYears)) {
    errors.push({ field: 'ageYears', code: 'INVALID' });
  } else if (input.ageYears < 13 || input.ageYears > 100) {
    errors.push({ field: 'ageYears', code: 'OUT_OF_RANGE' });
  }
  let heightMm = 0;
  let weightGrams = 0;
  try {
    heightMm = parseScaledInteger(input.heightCm, 10);
    if (heightMm < 1_000 || heightMm > 2_500) {
      errors.push({ field: 'heightCm', code: 'OUT_OF_RANGE' });
    }
  } catch {
    errors.push({ field: 'heightCm', code: 'INVALID' });
  }
  try {
    weightGrams = parseScaledInteger(input.weightKg, 1000);
    if (weightGrams < 30_000 || weightGrams > 300_000) {
      errors.push({ field: 'weightKg', code: 'OUT_OF_RANGE' });
    }
  } catch {
    errors.push({ field: 'weightKg', code: 'INVALID' });
  }
  if (!includes(EXPERIENCES, input.trainingExperience)) {
    errors.push({ field: 'trainingExperience', code: 'INVALID' });
  }
  if (input.goals.length < 1 || input.goals.length > 3 || input.goals.some((goal) => !includes(GOALS, goal))) {
    errors.push({ field: 'goals', code: 'INVALID' });
  }
  if (!includes(DISCIPLINES, input.discipline)) {
    errors.push({ field: 'discipline', code: 'INVALID' });
  }
  if (!Number.isSafeInteger(input.sessionsPerWeek) || input.sessionsPerWeek < 1 || input.sessionsPerWeek > 14) {
    errors.push({ field: 'sessionsPerWeek', code: 'OUT_OF_RANGE' });
  }
  if (!includes(ENVIRONMENTS, input.environment)) {
    errors.push({ field: 'environment', code: 'INVALID' });
  }
  if (!includes(ACTIVITY_LEVELS, input.activityLevel)) {
    errors.push({ field: 'activityLevel', code: 'INVALID' });
  }
  if (input.locale !== 'ar' && input.locale !== 'en') {
    errors.push({ field: 'locale', code: 'INVALID' });
  }
  if (input.sex !== 'male' && input.sex !== 'female') {
    errors.push({ field: 'sex', code: 'INVALID' });
  }
  if (input.nutritionPace !== undefined && input.nutritionPace !== 'sprint' && input.nutritionPace !== 'steady' && input.nutritionPace !== 'gentle') {
    errors.push({ field: 'nutritionPace', code: 'INVALID' });
  }
  if (input.horizonWeeks !== undefined && input.horizonWeeks !== null) {
    if (!Number.isSafeInteger(input.horizonWeeks) || input.horizonWeeks < 1 || input.horizonWeeks > 52) {
      errors.push({ field: 'horizonWeeks', code: 'OUT_OF_RANGE' });
    }
  }
  const sports = [...(input.sports ?? [])];
  if (sports.length > SPORTS.length || sports.some((sport) => !includes(SPORTS, sport))) {
    errors.push({ field: 'sports', code: 'INVALID' });
  }
  const equipment = cleanList(input.equipment, 'equipment', 40, errors);
  const dietaryPreferences = cleanList(input.dietaryPreferences, 'dietaryPreferences', 20, errors);
  const allergies = cleanList(input.allergies, 'allergies', 30, errors);
  const supplements = cleanList(input.supplements, 'supplements', 30, errors);
  const injuries = cleanList(input.injuries, 'injuries', 30, errors);
  const preferredWorkoutTimes = cleanList(input.preferredWorkoutTimes, 'preferredWorkoutTimes', 14, errors);
  if (input.userReportedCalorieTarget !== undefined) {
    if (!Number.isSafeInteger(input.userReportedCalorieTarget) || input.userReportedCalorieTarget < 0) {
      errors.push({ field: 'userReportedCalorieTarget', code: 'INVALID' });
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const riskFlags: RiskFlag[] = [];
  if (input.ageYears < 18) {
    riskFlags.push('minor_requires_review');
  }
  if (injuries.length > 0) {
    riskFlags.push('injury_reported');
  }
  const bmi = bmiHundredths(weightGrams, heightMm);
  if (bmi < 1_600 || bmi > 4_000) {
    riskFlags.push('body_mass_extreme');
  }
  if (input.userReportedCalorieTarget !== undefined) {
    riskFlags.push('self_reported_calorie_target_ignored');
  }

  return {
    ok: true,
    record: {
      ageYears: input.ageYears,
      heightMm,
      weightGrams,
      bmiHundredths: bmi,
      sex: input.sex,
      trainingExperience: input.trainingExperience,
      goals: input.goals,
      discipline: input.discipline,
      sessionsPerWeek: input.sessionsPerWeek,
      environment: input.environment,
      equipment,
      activityLevel: input.activityLevel,
      dietaryPreferences,
      allergies,
      supplements,
      injuries,
      preferredWorkoutTimes,
      hasGymMembership: input.hasGymMembership,
      gymReferralCode: input.gymReferralCode?.trim() ? input.gymReferralCode.trim() : null,
      locale: input.locale,
      sports,
      nutritionPace: input.nutritionPace ?? null,
      horizonWeeks: input.horizonWeeks ?? null,
      authoritativeCalorieTarget: null,
      userReportedCalorieTarget: input.userReportedCalorieTarget ?? null,
      riskFlags,
      requiresReview: riskFlags.length > 0,
    },
  };
}

export function assertNoAuthoritativeCalories(record: NormalizedOnboarding): void {
  if (record.authoritativeCalorieTarget !== null) {
    throw new DomainError('UNAPPROVED_CALORIE_TARGET', 'Self-reported calories are not an authoritative target');
  }
}
