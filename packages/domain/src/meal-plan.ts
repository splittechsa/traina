import { DomainError } from './errors.js';
import { MEAL_SLOTS, type MealSlot } from './daily.js';

/** Coaching phase derived from the athlete's own goals — not one template for all. */
export type NutritionPhase = 'cutting' | 'maintain' | 'gain' | 'fitness';

/**
 * How hard / how fast the athlete wants the phase.
 * sprint = short window, aggressive (e.g. cut in a few weeks)
 * steady = natural timeline
 * gentle = slow, sustainable
 */
export type NutritionPace = 'sprint' | 'steady' | 'gentle';

/**
 * Absolute daily energy offsets vs maintenance (kcal).
 *
 * POLICY STATUS: unapproved for paid coaching deployment.
 * These are engineering placeholders from early Yazan-style experiments.
 * Do NOT treat as universally safe. See docs/architecture/coaching-decision-engine.md
 * and task P0-SAFE-01. Professional sports-nutrition review required before paid use.
 */
export const ENERGY_POLICY = {
  id: 'cut_deficit_by_pace_v0',
  status: 'unapproved_pending_professional_review' as const,
  approvedForPaidCoaching: false,
};

/** Absolute daily energy offset vs maintenance for Traina Training (kcal). */
export const CUT_DEFICIT_BY_PACE = {
  sprint: 1_100,
  steady: 650,
  gentle: 400,
} as const;

export const GAIN_SURPLUS_BY_PACE = {
  sprint: 450,
  steady: 300,
  gentle: 200,
} as const;

/** @deprecated Prefer CUT_DEFICIT_BY_PACE[pace] — kept for callers that still assume a mid cut. */
export const TRAINING_CUT_DEFICIT_KCAL = CUT_DEFICIT_BY_PACE.steady;
export const TRAINING_GAIN_SURPLUS_KCAL = GAIN_SURPLUS_BY_PACE.steady;
export const TRAINING_ENERGY_FLOOR_KCAL = 1_200;
export const TRAINING_ENERGY_CEILING_KCAL = 6_000;

export const LOGGING_WINDOW_DAYS = 14;

export type AthleteEnergyInput = {
  maintenanceKcal: number;
  phase: NutritionPhase;
  /** Athlete-chosen pace. Defaults to steady when omitted. */
  pace?: NutritionPace;
  /**
   * Optional horizon in weeks. When set for cutting/gain, overrides pace:
   * ≤4 → sprint, 5–10 → steady, ≥11 → gentle.
   */
  horizonWeeks?: number | null;
  /** Extra weekly step already confirmed for this athlete (can be negative). */
  weeklyEnergyDeltaKcal?: number;
};

export type AthleteEnergyPlan = {
  maintenanceKcal: number;
  phase: NutritionPhase;
  pace: NutritionPace;
  horizonWeeks: number | null;
  deficitOrSurplusKcal: number;
  weeklyEnergyDeltaKcal: number;
  targetKcal: number;
  floored: boolean;
  /** Always false until ENERGY_POLICY is professionally approved. */
  policyApprovedForPaidCoaching: boolean;
};

/** Hard gate for paid coaching apply paths — never silent-bypass. */
export function assertEnergyPolicyApprovedForPaidCoaching(): void {
  if (!ENERGY_POLICY.approvedForPaidCoaching) {
    throw new DomainError(
      'ENERGY_POLICY_UNAPPROVED',
      'Cut/gain energy presets are not approved for paid coaching until professional review (P0-SAFE-01)',
    );
  }
}

export function assertNutritionPhase(value: string): NutritionPhase {
  if (value === 'cutting' || value === 'maintain' || value === 'gain' || value === 'fitness') return value;
  throw new DomainError('UNKNOWN_PHASE', 'Nutrition phase must be cutting, maintain, gain, or fitness');
}

export function assertNutritionPace(value: string): NutritionPace {
  if (value === 'sprint' || value === 'steady' || value === 'gentle') return value;
  throw new DomainError('UNKNOWN_PACE', 'Nutrition pace must be sprint, steady, or gentle');
}

/** Map onboarding goals → nutrition phase (first matching intent wins). */
export function phaseFromAthleteGoals(goals: readonly string[]): NutritionPhase {
  const set = new Set(goals);
  if (set.has('cutting') || set.has('fat_loss')) return 'cutting';
  if (set.has('bulking') || set.has('muscle_gain')) return 'gain';
  if (set.has('general_health') || set.has('endurance')) return 'fitness';
  if (set.has('body_recomposition')) return 'cutting';
  if (set.has('strength')) return 'gain';
  return 'maintain';
}

/** Infer pace from a chosen horizon; athlete can still override explicitly. */
export function paceFromHorizonWeeks(weeks: number): NutritionPace {
  if (!Number.isSafeInteger(weeks) || weeks < 1 || weeks > 52) {
    throw new DomainError('INVALID_HORIZON', 'Horizon must be a whole number of weeks from 1 to 52');
  }
  if (weeks <= 4) return 'sprint';
  if (weeks <= 10) return 'steady';
  return 'gentle';
}

function resolvePace(input: AthleteEnergyInput): NutritionPace {
  if (input.horizonWeeks !== undefined && input.horizonWeeks !== null) {
    return paceFromHorizonWeeks(input.horizonWeeks);
  }
  if (input.pace !== undefined) return assertNutritionPace(input.pace);
  return 'steady';
}

function baseOffsetKcal(phase: NutritionPhase, pace: NutritionPace): number {
  if (phase === 'cutting') return -CUT_DEFICIT_BY_PACE[pace];
  if (phase === 'gain') return GAIN_SURPLUS_BY_PACE[pace];
  if (phase === 'fitness') return -CUT_DEFICIT_BY_PACE.gentle / 2; // light lean for fitness
  return 0;
}

/** Per-athlete daily energy — built from their goal, pace/horizon, and confirmed weekly steps. */
export function athleteEnergyPlan(input: AthleteEnergyInput): AthleteEnergyPlan {
  if (!Number.isSafeInteger(input.maintenanceKcal) || input.maintenanceKcal < 1_000 || input.maintenanceKcal > 8_000) {
    throw new DomainError('INVALID_MAINTENANCE', 'Maintenance must be a whole number of kcal from 1000 to 8000');
  }
  const weekly = input.weeklyEnergyDeltaKcal ?? 0;
  if (!Number.isSafeInteger(weekly) || weekly < -1_000 || weekly > 1_000) {
    throw new DomainError('INVALID_WEEKLY_DELTA', 'Weekly energy step must be between -1000 and 1000 kcal');
  }
  const pace = resolvePace(input);
  const base = baseOffsetKcal(input.phase, pace);
  const raw = input.maintenanceKcal + base + weekly;
  const floored = raw < TRAINING_ENERGY_FLOOR_KCAL;
  const targetKcal = Math.min(TRAINING_ENERGY_CEILING_KCAL, Math.max(TRAINING_ENERGY_FLOOR_KCAL, raw));
  return {
    maintenanceKcal: input.maintenanceKcal,
    phase: input.phase,
    pace,
    horizonWeeks: input.horizonWeeks ?? null,
    deficitOrSurplusKcal: base,
    weeklyEnergyDeltaKcal: weekly,
    targetKcal,
    floored,
    policyApprovedForPaidCoaching: ENERGY_POLICY.approvedForPaidCoaching,
  };
}

export type WeightTrendSample = {
  recordedOn: string;
  weightGrams: number;
};

export type LoggingDiscipline = {
  windowDays: number;
  mealDaysLogged: number;
  waterDaysLogged: number;
  mealAdherenceBps: number;
  waterAdherenceBps: number;
  status: 'ok' | 'meals_low' | 'water_low' | 'both_low';
};

/**
 * Last N days of logging discipline. Missing logs count as zero — we never invent adherence.
 */
export function loggingDiscipline(input: {
  windowDays?: number;
  mealDaysLogged: number;
  waterDaysLogged: number;
}): LoggingDiscipline {
  const windowDays = input.windowDays ?? LOGGING_WINDOW_DAYS;
  if (!Number.isSafeInteger(windowDays) || windowDays < 1 || windowDays > 60) {
    throw new DomainError('INVALID_WINDOW', 'Logging window must be 1–60 days');
  }
  for (const [code, value] of [
    ['INVALID_MEAL_DAYS', input.mealDaysLogged],
    ['INVALID_WATER_DAYS', input.waterDaysLogged],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || value > windowDays) {
      throw new DomainError(code, 'Logged day counts must fit the window');
    }
  }
  const mealAdherenceBps = Math.round((input.mealDaysLogged * 10_000) / windowDays);
  const waterAdherenceBps = Math.round((input.waterDaysLogged * 10_000) / windowDays);
  const mealsLow = mealAdherenceBps < 5_000;
  const waterLow = waterAdherenceBps < 5_000;
  return {
    windowDays,
    mealDaysLogged: input.mealDaysLogged,
    waterDaysLogged: input.waterDaysLogged,
    mealAdherenceBps,
    waterAdherenceBps,
    status: mealsLow && waterLow ? 'both_low' : mealsLow ? 'meals_low' : waterLow ? 'water_low' : 'ok',
  };
}

export type WeeklyStepReason =
  | 'weight_stalled_on_cut'
  | 'weight_dropping_fast'
  | 'weight_rising_on_cut'
  | 'weight_stalled_on_gain'
  | 'adherence_low'
  | 'water_adherence_low'
  | 'stable'
  | 'insufficient_data'
  | 'ease_aggressive_pace';

export type WeeklyStepProposal = {
  status: 'propose' | 'hold';
  energyDeltaKcal: number;
  carbDeltaG: number;
  reason: WeeklyStepReason;
  /** When true, surface a member alert (schedule changed or needs attention). */
  alert: boolean;
  /** Always false until ENERGY_POLICY is professionally approved (P0-SAFE-01). */
  policyApprovedForPaidCoaching: boolean;
  /** Proposals never auto-apply; paid persist must call assertEnergyPolicyApprovedForPaidCoaching. */
  mayAutoApply: false;
};

/**
 * Suggest a per-athlete weekly energy/carb move from logged weight + meal/water discipline.
 * Does not apply itself — caller must confirm (paid Traina Training).
 * Low water logging over the window softens an aggressive plan and raises an alert.
 */
export function proposeWeeklyNutritionStep(input: {
  phase: NutritionPhase;
  pace?: NutritionPace;
  samples: readonly WeightTrendSample[];
  mealAdherenceBps: number | null;
  waterAdherenceBps?: number | null;
}): WeeklyStepProposal {
  if (input.mealAdherenceBps !== null && (!Number.isSafeInteger(input.mealAdherenceBps) || input.mealAdherenceBps < 0 || input.mealAdherenceBps > 10_000)) {
    throw new DomainError('INVALID_ADHERENCE', 'Meal adherence must be basis points 0–10000');
  }
  if (
    input.waterAdherenceBps !== undefined &&
    input.waterAdherenceBps !== null &&
    (!Number.isSafeInteger(input.waterAdherenceBps) || input.waterAdherenceBps < 0 || input.waterAdherenceBps > 10_000)
  ) {
    throw new DomainError('INVALID_ADHERENCE', 'Water adherence must be basis points 0–10000');
  }

  const seal = (row: Omit<WeeklyStepProposal, 'policyApprovedForPaidCoaching' | 'mayAutoApply'>): WeeklyStepProposal => ({
    ...row,
    policyApprovedForPaidCoaching: ENERGY_POLICY.approvedForPaidCoaching,
    mayAutoApply: false,
  });

  const waterBps = input.waterAdherenceBps ?? null;
  if (waterBps !== null && waterBps < 5_000) {
    const pace = input.pace ?? 'steady';
    // Soften sprint/steady cuts when the athlete is not logging water — schedule changes + alert.
    if (input.phase === 'cutting' && (pace === 'sprint' || pace === 'steady')) {
      return seal({ status: 'propose', energyDeltaKcal: 200, carbDeltaG: 25, reason: 'water_adherence_low', alert: true });
    }
    return seal({ status: 'hold', energyDeltaKcal: 0, carbDeltaG: 0, reason: 'water_adherence_low', alert: true });
  }

  if (input.mealAdherenceBps !== null && input.mealAdherenceBps < 5_000) {
    return seal({ status: 'hold', energyDeltaKcal: 0, carbDeltaG: 0, reason: 'adherence_low', alert: true });
  }

  const ordered = [...input.samples]
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.recordedOn) && Number.isSafeInteger(row.weightGrams) && row.weightGrams >= 30_000)
    .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
  if (ordered.length < 2) {
    return seal({ status: 'hold', energyDeltaKcal: 0, carbDeltaG: 0, reason: 'insufficient_data', alert: false });
  }
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const deltaGrams = last.weightGrams - first.weightGrams;
  const days = Math.max(1, Math.round((Date.parse(`${last.recordedOn}T12:00:00.000Z`) - Date.parse(`${first.recordedOn}T12:00:00.000Z`)) / 86_400_000));
  const perWeekGrams = Math.round((deltaGrams * 7) / days);
  const pace = input.pace ?? 'steady';

  if (input.phase === 'cutting') {
    if (pace === 'sprint' && perWeekGrams > -400 && perWeekGrams <= 200) {
      return seal({ status: 'propose', energyDeltaKcal: -200, carbDeltaG: -40, reason: 'ease_aggressive_pace', alert: true });
    }
    if (perWeekGrams > 200) {
      return seal({ status: 'propose', energyDeltaKcal: -200, carbDeltaG: -40, reason: 'weight_rising_on_cut', alert: true });
    }
    if (perWeekGrams > -200 && perWeekGrams <= 200) {
      return seal({ status: 'propose', energyDeltaKcal: -150, carbDeltaG: -30, reason: 'weight_stalled_on_cut', alert: true });
    }
    if (perWeekGrams < -1_200) {
      return seal({ status: 'propose', energyDeltaKcal: 150, carbDeltaG: 30, reason: 'weight_dropping_fast', alert: true });
    }
  }
  if (input.phase === 'gain' && perWeekGrams < 100) {
    return seal({ status: 'propose', energyDeltaKcal: 150, carbDeltaG: 30, reason: 'weight_stalled_on_gain', alert: true });
  }
  if (input.phase === 'fitness' && perWeekGrams > 400) {
    return seal({ status: 'propose', energyDeltaKcal: -100, carbDeltaG: -20, reason: 'weight_rising_on_cut', alert: true });
  }
  return seal({ status: 'hold', energyDeltaKcal: 0, carbDeltaG: 0, reason: 'stable', alert: false });
}

/** Ready meal with declared macros only — never invent a Saudi dish calculator. */
export type ReadyMealIngredient = {
  nameAr: string;
  nameEn: string;
  /** Declared quantity string for the member UI — not a lab assay. */
  quantityAr: string;
  quantityEn: string;
};

export type ReadyMealTemplate = {
  id: string;
  slot: MealSlot;
  nameAr: string;
  nameEn: string;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  /** Provenance label shown to the member. */
  provenance: 'program_template';
  /** Approximate recipe lines — declared templates, not lab-verified assays. */
  ingredients?: readonly ReadyMealIngredient[];
  prepAr?: string;
  prepEn?: string;
  servings?: number;
  tags?: readonly string[];
};

export type MealPlanSlotPick = {
  slot: MealSlot;
  templateId: string | null;
  customLabel: string | null;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
};

export type DayMealPlan = {
  targetKcal: number;
  slots: readonly MealPlanSlotPick[];
  plannedKcal: number;
  remainingKcal: number;
};

function assertMealMacros(meal: Omit<ReadyMealTemplate, 'id' | 'slot' | 'nameAr' | 'nameEn' | 'provenance'>): void {
  for (const [code, value] of [
    ['INVALID_ENERGY', meal.energyKcal],
    ['INVALID_PROTEIN', meal.proteinMg],
    ['INVALID_CARBOHYDRATE', meal.carbohydrateMg],
    ['INVALID_FAT', meal.fatMg],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new DomainError(code, 'Meal macros must be non-negative safe integers');
    }
  }
  if (meal.energyKcal > 2_500) {
    throw new DomainError('INVALID_ENERGY', 'A single ready meal cannot exceed 2500 kcal');
  }
}

/** Catalog of ready meals with declared macros (program templates, not lab assays). */
export const READY_MEAL_TEMPLATES: readonly ReadyMealTemplate[] = [
  {
    id: 'breakfast_eggs_oats',
    slot: 'breakfast',
    nameAr: 'بيض + شوفان',
    nameEn: 'Eggs and oats',
    energyKcal: 420,
    proteinMg: 32_000,
    carbohydrateMg: 42_000,
    fatMg: 14_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['saudi', 'high_protein'],
    ingredients: [
      { nameAr: 'بيض كامل', nameEn: 'Whole eggs', quantityAr: '٢ حبة', quantityEn: '2 eggs' },
      { nameAr: 'شوفان مطبوخ', nameEn: 'Cooked oats', quantityAr: '١٥٠ غ', quantityEn: '150 g' },
      { nameAr: 'زيت زيتون', nameEn: 'Olive oil', quantityAr: '٥ مل', quantityEn: '5 ml' },
    ],
    prepAr: 'اطبخ الشوفان، اقلي البيض بخفة، واخلط مع زيت الزيتون.',
    prepEn: 'Cook oats, lightly scramble eggs, finish with olive oil.',
  },
  {
    id: 'breakfast_yogurt_fruit',
    slot: 'breakfast',
    nameAr: 'زبادي يوناني + فاكهة',
    nameEn: 'Greek yogurt and fruit',
    energyKcal: 280,
    proteinMg: 24_000,
    carbohydrateMg: 30_000,
    fatMg: 6_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['quick', 'no_cook'],
    ingredients: [
      { nameAr: 'زبادي يوناني', nameEn: 'Greek yogurt', quantityAr: '١٧٠ غ', quantityEn: '170 g' },
      { nameAr: 'فاكهة طازجة', nameEn: 'Fresh fruit', quantityAr: '١٢٠ غ', quantityEn: '120 g' },
    ],
    prepAr: 'اخلط الزبادي مع الفاكهة وقدّم مباشرة.',
    prepEn: 'Mix yogurt with fruit and serve.',
  },
  {
    id: 'lunch_chicken_rice',
    slot: 'lunch',
    nameAr: 'صدر دجاج + رز',
    nameEn: 'Chicken breast and rice',
    energyKcal: 520,
    proteinMg: 45_000,
    carbohydrateMg: 55_000,
    fatMg: 10_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['saudi', 'high_protein', 'gym'],
    ingredients: [
      { nameAr: 'صدر دجاج مشوي', nameEn: 'Grilled chicken breast', quantityAr: '١٥٠ غ', quantityEn: '150 g' },
      { nameAr: 'رز مطبوخ', nameEn: 'Cooked rice', quantityAr: '١٨٠ غ', quantityEn: '180 g' },
      { nameAr: 'خضار مشكلة', nameEn: 'Mixed vegetables', quantityAr: '١٠٠ غ', quantityEn: '100 g' },
      { nameAr: 'زيت زيتون', nameEn: 'Olive oil', quantityAr: '١٠ غ', quantityEn: '10 g' },
    ],
    prepAr: 'اشوِ الدجاج، قدّم مع الرز والخضار وملعقة زيت زيتون.',
    prepEn: 'Grill chicken; serve with rice, vegetables, and olive oil.',
  },
  {
    id: 'lunch_beef_potato',
    slot: 'lunch',
    nameAr: 'لحم بقري + بطاطس',
    nameEn: 'Beef and potato',
    energyKcal: 580,
    proteinMg: 42_000,
    carbohydrateMg: 48_000,
    fatMg: 18_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['saudi'],
    ingredients: [
      { nameAr: 'لحم بقري قليل الدهن', nameEn: 'Lean beef', quantityAr: '١٤٠ غ', quantityEn: '140 g' },
      { nameAr: 'بطاطس مشوية', nameEn: 'Baked potato', quantityAr: '٢٠٠ غ', quantityEn: '200 g' },
    ],
    prepAr: 'اطبخ اللحم والقِ البطاطس. قدّم معاً.',
    prepEn: 'Cook beef and bake potato. Serve together.',
  },
  {
    id: 'dinner_fish_veg',
    slot: 'dinner',
    nameAr: 'سمك + خضار',
    nameEn: 'Fish and vegetables',
    energyKcal: 380,
    proteinMg: 38_000,
    carbohydrateMg: 18_000,
    fatMg: 14_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['light'],
    ingredients: [
      { nameAr: 'سمك أبيض', nameEn: 'White fish', quantityAr: '١٦٠ غ', quantityEn: '160 g' },
      { nameAr: 'خضار مشوية', nameEn: 'Roasted vegetables', quantityAr: '٢٠٠ غ', quantityEn: '200 g' },
    ],
    prepAr: 'اشوِ السمك والخضار مع توابل خفيفة.',
    prepEn: 'Bake fish and vegetables with light seasoning.',
  },
  {
    id: 'dinner_chicken_salad',
    slot: 'dinner',
    nameAr: 'دجاج + سلطة',
    nameEn: 'Chicken and salad',
    energyKcal: 340,
    proteinMg: 40_000,
    carbohydrateMg: 12_000,
    fatMg: 12_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['light', 'high_protein'],
    ingredients: [
      { nameAr: 'صدر دجاج', nameEn: 'Chicken breast', quantityAr: '١٥٠ غ', quantityEn: '150 g' },
      { nameAr: 'سلطة خضراء', nameEn: 'Green salad', quantityAr: '١٥٠ غ', quantityEn: '150 g' },
    ],
    prepAr: 'قطّع الدجاج المشوي فوق السلطة.',
    prepEn: 'Slice grilled chicken over salad.',
  },
  {
    id: 'snack_whey_banana',
    slot: 'snack',
    nameAr: 'واي + موز',
    nameEn: 'Whey and banana',
    energyKcal: 250,
    proteinMg: 28_000,
    carbohydrateMg: 27_000,
    fatMg: 3_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['quick', 'post_workout'],
    ingredients: [
      { nameAr: 'بروتين واي', nameEn: 'Whey protein', quantityAr: '١ مغرفة', quantityEn: '1 scoop' },
      { nameAr: 'موز', nameEn: 'Banana', quantityAr: '١ حبة متوسطة', quantityEn: '1 medium' },
    ],
    prepAr: 'اخلط الواي بالماء وقدّم مع الموز.',
    prepEn: 'Shake whey with water; serve with banana.',
  },
  {
    id: 'snack_cottage_dates',
    slot: 'snack',
    nameAr: 'جبن قريش + تمر',
    nameEn: 'Cottage cheese and dates',
    energyKcal: 220,
    proteinMg: 18_000,
    carbohydrateMg: 28_000,
    fatMg: 4_000,
    provenance: 'program_template',
    servings: 1,
    tags: ['saudi', 'quick'],
    ingredients: [
      { nameAr: 'جبن قريش', nameEn: 'Cottage cheese', quantityAr: '١٥٠ غ', quantityEn: '150 g' },
      { nameAr: 'تمر', nameEn: 'Dates', quantityAr: '٣ حبات', quantityEn: '3 dates' },
    ],
    prepAr: 'قدّم الجبن مع التمر مباشرة.',
    prepEn: 'Serve cottage cheese with dates.',
  },
];

export function readyMealById(id: string): ReadyMealTemplate | null {
  return READY_MEAL_TEMPLATES.find((meal) => meal.id === id) ?? null;
}

export function readyMealsForSlot(slot: MealSlot): ReadyMealTemplate[] {
  return READY_MEAL_TEMPLATES.filter((meal) => meal.slot === slot);
}

export function pickReadyMeal(slot: MealSlot, templateId: string): MealPlanSlotPick {
  const meal = readyMealById(templateId);
  if (meal === null || meal.slot !== slot) {
    throw new DomainError('UNKNOWN_READY_MEAL', 'That ready meal is not in the catalog for this slot');
  }
  assertMealMacros(meal);
  return {
    slot,
    templateId: meal.id,
    customLabel: null,
    energyKcal: meal.energyKcal,
    proteinMg: meal.proteinMg,
    carbohydrateMg: meal.carbohydrateMg,
    fatMg: meal.fatMg,
  };
}

export function customizeMealSlot(
  slot: MealSlot,
  input: { label: string; energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number },
): MealPlanSlotPick {
  if (!(MEAL_SLOTS as readonly string[]).includes(slot)) {
    throw new DomainError('UNKNOWN_MEAL_SLOT', 'That meal slot is not in the catalog');
  }
  const label = input.label.replace(/\s+/g, ' ').trim();
  if (label.length < 2 || label.length > 80) {
    throw new DomainError('INVALID_MEAL_LABEL', 'Custom meal label must be 2 to 80 characters');
  }
  assertMealMacros(input);
  return {
    slot,
    templateId: null,
    customLabel: label,
    energyKcal: input.energyKcal,
    proteinMg: input.proteinMg,
    carbohydrateMg: input.carbohydrateMg,
    fatMg: input.fatMg,
  };
}

export function assembleDayMealPlan(targetKcal: number, slots: readonly MealPlanSlotPick[]): DayMealPlan {
  if (!Number.isSafeInteger(targetKcal) || targetKcal < TRAINING_ENERGY_FLOOR_KCAL || targetKcal > TRAINING_ENERGY_CEILING_KCAL) {
    throw new DomainError('INVALID_ENERGY', 'Day target is outside the accepted range');
  }
  const seen = new Set<string>();
  let plannedKcal = 0;
  for (const slot of slots) {
    if (seen.has(slot.slot)) {
      throw new DomainError('DUPLICATE_MEAL_SLOT', 'Each meal slot may appear once on a day plan');
    }
    seen.add(slot.slot);
    assertMealMacros(slot);
    plannedKcal += slot.energyKcal;
  }
  return {
    targetKcal,
    slots,
    plannedKcal,
    remainingKcal: targetKcal - plannedKcal,
  };
}
