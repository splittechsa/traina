import { DomainError } from './errors.js';
import { bmiHundredths } from './onboarding.js';
import type { Discipline, PlannedExercise } from './training.js';

/** Stored on program_versions.template.adaptation — bounded, auditable overlays. */
export type TrainingAdaptationOverlay = {
  kind: 'recovery_preference' | 'volume_deload' | 'session_intensity_ease' | 'progressive_overload_hint';
  volumeScaleBps: number;
  restSecondsDelta: number;
  loadIncrementPctMax: number;
  recommendationId: string;
  appliedAt: string;
};

const id = (n: string) => `10000000-0000-4000-8000-0000000000${n}`;

export type TemplateEnvironment = 'gym' | 'home' | 'outdoor';
export type TemplateFamily = 'strength' | 'crossfit' | 'calisthenics';
export type SplitKind = 'full_body' | 'ppl' | 'bro' | 'arnold' | 'upper_lower' | 'engine';

export type TrainingTemplateDay = {
  name_ar: string;
  name_en: string;
  exerciseIds: readonly string[];
};

export type TrainingTemplate = {
  id: string;
  family: TemplateFamily;
  split: SplitKind;
  daysPerWeek: number;
  discipline: Discipline;
  environment: TemplateEnvironment;
  name_ar: string;
  name_en: string;
  summary_ar: string;
  summary_en: string;
  days: readonly TrainingTemplateDay[];
};

export type RecommendProfile = {
  sessionsPerWeek: number | null;
  goals: readonly string[];
  discipline: string | null;
  sports: readonly string[];
  environment: string | null;
  experience: string | null;
  heightMm: number | null;
  weightGrams: number | null;
};

export type TemplateRecommendation = {
  id: string;
  score: number;
  reason_ar: string;
  reason_en: string;
};

const strengthPlan = (
  exerciseIds: readonly string[],
  adaptation: TrainingAdaptationOverlay | null = null,
): PlannedExercise[] => {
  const volumeScaleBps = adaptation?.volumeScaleBps ?? 10_000;
  const restDelta = adaptation?.restSecondsDelta ?? 0;
  const sets = Math.max(1, Math.round((3 * volumeScaleBps) / 10_000));
  const restSeconds = Math.max(30, 90 + restDelta);
  return exerciseIds.map((exerciseId) => ({
    exerciseId,
    prescription: {
      kind: 'strength',
      sets,
      reps: 8,
      restSeconds,
      loadGrams: null,
      rpeTenths: null,
    },
  }));
};

const calisthenicsPlan = (exerciseIds: readonly string[]): PlannedExercise[] =>
  exerciseIds.map((exerciseId) => ({
    exerciseId,
    prescription: {
      kind: 'calisthenics',
      progression: 'full',
      targetReps: 8,
      holdSeconds: exerciseId === id('10') ? 30 : null,
    },
  }));

const crossfitPlan = (exerciseIds: readonly string[]): PlannedExercise[] =>
  exerciseIds.map((exerciseId) => ({
    exerciseId,
    prescription: {
      kind: 'crossfit',
      format: 'amrap',
      timeCapSeconds: 720,
      rounds: 5,
    },
  }));

export const TRAINING_TEMPLATES: readonly TrainingTemplate[] = [
  {
    id: 'gym_full_body',
    family: 'strength',
    split: 'full_body',
    daysPerWeek: 3,
    discipline: 'bodybuilding',
    environment: 'gym',
    name_ar: 'جسم كامل في النادي',
    name_en: 'Gym full body',
    summary_ar: 'ثلاثة أيام مركّبة على أجهزة وبار. هيكل تدريب، وليست وصفة مراجعة.',
    summary_en: 'Three compound gym days. A training structure, not a reviewed prescription.',
    days: [
      { name_ar: 'يوم أ', name_en: 'Day A', exerciseIds: [id('01'), id('02'), id('05'), id('10')] },
      { name_ar: 'يوم ب', name_en: 'Day B', exerciseIds: [id('19'), id('04'), id('21'), id('08')] },
      { name_ar: 'يوم ج', name_en: 'Day C', exerciseIds: [id('07'), id('20'), id('06'), id('16')] },
    ],
  },
  {
    id: 'push_pull_legs',
    family: 'strength',
    split: 'ppl',
    daysPerWeek: 3,
    discipline: 'bodybuilding',
    environment: 'gym',
    name_ar: 'بوش بول ليق',
    name_en: 'Push pull legs',
    summary_ar: 'تقسيم كلاسيكي لثلاثة أيام: دفع، سحب، أرجل.',
    summary_en: 'A classic three-day gym split: push, pull, legs.',
    days: [
      { name_ar: 'دفع', name_en: 'Push', exerciseIds: [id('02'), id('04'), id('20'), id('15')] },
      { name_ar: 'سحب', name_en: 'Pull', exerciseIds: [id('21'), id('05'), id('06'), id('18')] },
      { name_ar: 'أرجل', name_en: 'Legs', exerciseIds: [id('01'), id('19'), id('22'), id('08')] },
    ],
  },
  {
    id: 'push_pull_legs_6',
    family: 'strength',
    split: 'ppl',
    daysPerWeek: 6,
    discipline: 'bodybuilding',
    environment: 'gym',
    name_ar: 'بوش بول ليق ٦ أيام',
    name_en: 'Push pull legs 6 days',
    summary_ar: 'نفس تقسيم الدفع والسحب والأرجل مرتين في الأسبوع.',
    summary_en: 'The same push, pull, legs split, twice each week.',
    days: [
      { name_ar: 'دفع أ', name_en: 'Push A', exerciseIds: [id('02'), id('04'), id('20'), id('15')] },
      { name_ar: 'سحب أ', name_en: 'Pull A', exerciseIds: [id('21'), id('05'), id('06'), id('18')] },
      { name_ar: 'أرجل أ', name_en: 'Legs A', exerciseIds: [id('01'), id('19'), id('22'), id('08')] },
      { name_ar: 'دفع ب', name_en: 'Push B', exerciseIds: [id('20'), id('04'), id('09'), id('15')] },
      { name_ar: 'سحب ب', name_en: 'Pull B', exerciseIds: [id('21'), id('18'), id('06'), id('05')] },
      { name_ar: 'أرجل ب', name_en: 'Legs B', exerciseIds: [id('07'), id('19'), id('08'), id('10')] },
    ],
  },
  {
    id: 'bro_split',
    family: 'strength',
    split: 'bro',
    daysPerWeek: 5,
    discipline: 'bodybuilding',
    environment: 'gym',
    name_ar: 'برو سبلت',
    name_en: 'Bro split',
    summary_ar: 'خمسة أيام: صدر، ظهر، أكتاف، ذراعين، أرجل.',
    summary_en: 'Five days: chest, back, shoulders, arms, legs.',
    days: [
      { name_ar: 'صدر', name_en: 'Chest', exerciseIds: [id('02'), id('20'), id('09'), id('15')] },
      { name_ar: 'ظهر', name_en: 'Back', exerciseIds: [id('21'), id('05'), id('06'), id('18')] },
      { name_ar: 'أكتاف', name_en: 'Shoulders', exerciseIds: [id('04'), id('17'), id('10')] },
      { name_ar: 'ذراعين', name_en: 'Arms', exerciseIds: [id('15'), id('09'), id('16')] },
      { name_ar: 'أرجل', name_en: 'Legs', exerciseIds: [id('01'), id('19'), id('22'), id('08')] },
    ],
  },
  {
    id: 'arnold_split',
    family: 'strength',
    split: 'arnold',
    daysPerWeek: 6,
    discipline: 'bodybuilding',
    environment: 'gym',
    name_ar: 'أرنولد سبلت',
    name_en: 'Arnold split',
    summary_ar: 'ستة أيام: صدر/ظهر، أكتاف/ذراعين، أرجل — مرتين.',
    summary_en: 'Six days: chest/back, shoulders/arms, legs — twice.',
    days: [
      { name_ar: 'صدر وظهر أ', name_en: 'Chest & back A', exerciseIds: [id('02'), id('21'), id('20'), id('05')] },
      { name_ar: 'أكتاف وذراعين أ', name_en: 'Shoulders & arms A', exerciseIds: [id('04'), id('15'), id('17'), id('09')] },
      { name_ar: 'أرجل أ', name_en: 'Legs A', exerciseIds: [id('01'), id('19'), id('07'), id('08')] },
      { name_ar: 'صدر وظهر ب', name_en: 'Chest & back B', exerciseIds: [id('20'), id('06'), id('02'), id('18')] },
      { name_ar: 'أكتاف وذراعين ب', name_en: 'Shoulders & arms B', exerciseIds: [id('04'), id('15'), id('16'), id('10')] },
      { name_ar: 'أرجل ب', name_en: 'Legs B', exerciseIds: [id('03'), id('22'), id('08'), id('07')] },
    ],
  },
  {
    id: 'upper_lower',
    family: 'strength',
    split: 'upper_lower',
    daysPerWeek: 4,
    discipline: 'bodybuilding',
    environment: 'gym',
    name_ar: 'علوي سفلي',
    name_en: 'Upper lower',
    summary_ar: 'أربعة أيام: علوي وسفلي مرتين.',
    summary_en: 'Four days: upper and lower, twice.',
    days: [
      { name_ar: 'علوي أ', name_en: 'Upper A', exerciseIds: [id('02'), id('21'), id('04'), id('05')] },
      { name_ar: 'سفلي أ', name_en: 'Lower A', exerciseIds: [id('01'), id('19'), id('22'), id('08')] },
      { name_ar: 'علوي ب', name_en: 'Upper B', exerciseIds: [id('20'), id('06'), id('15'), id('18')] },
      { name_ar: 'سفلي ب', name_en: 'Lower B', exerciseIds: [id('07'), id('03'), id('08'), id('10')] },
    ],
  },
  {
    id: 'home_calisthenics',
    family: 'calisthenics',
    split: 'full_body',
    daysPerWeek: 2,
    discipline: 'calisthenics',
    environment: 'home',
    name_ar: 'وزن الجسم في البيت',
    name_en: 'Home bodyweight',
    summary_ar: 'يومان بدون أجهزة، مناسبان للبيت أو الخارج.',
    summary_en: 'Two equipment-light days for home or outdoors.',
    days: [
      { name_ar: 'ضغط وثبات', name_en: 'Push and brace', exerciseIds: [id('09'), id('18'), id('08'), id('10')] },
      { name_ar: 'سحب وحركة', name_en: 'Pull and move', exerciseIds: [id('06'), id('11'), id('12'), id('16')] },
    ],
  },
  {
    id: 'calisthenics_ppl',
    family: 'calisthenics',
    split: 'ppl',
    daysPerWeek: 3,
    discipline: 'calisthenics',
    environment: 'home',
    name_ar: 'كاليثنكس دفع سحب أرجل',
    name_en: 'Calisthenics PPL',
    summary_ar: 'ثلاثة أيام بوزن الجسم: دفع، سحب، أرجل.',
    summary_en: 'Three bodyweight days: push, pull, legs.',
    days: [
      { name_ar: 'دفع', name_en: 'Push', exerciseIds: [id('09'), id('15'), id('17'), id('10')] },
      { name_ar: 'سحب', name_en: 'Pull', exerciseIds: [id('06'), id('18'), id('16')] },
      { name_ar: 'أرجل', name_en: 'Legs', exerciseIds: [id('08'), id('12'), id('11'), id('10')] },
    ],
  },
  {
    id: 'conditioning_engine',
    family: 'crossfit',
    split: 'engine',
    daysPerWeek: 2,
    discipline: 'crossfit',
    environment: 'gym',
    name_ar: 'لياقة وظيفية',
    name_en: 'Conditioning engine',
    summary_ar: 'يومان AMRAP بحركات مركّبة. ليس برنامجاً تنافسياً.',
    summary_en: 'Two AMRAP days of compound work. Not a competitive program.',
    days: [
      { name_ar: 'محرك أ', name_en: 'Engine A', exerciseIds: [id('11'), id('13'), id('12')] },
      { name_ar: 'محرك ب', name_en: 'Engine B', exerciseIds: [id('09'), id('08'), id('13')] },
    ],
  },
  {
    id: 'crossfit_three',
    family: 'crossfit',
    split: 'engine',
    daysPerWeek: 3,
    discipline: 'crossfit',
    environment: 'gym',
    name_ar: 'كروس فت ثلاثة أيام',
    name_en: 'CrossFit three days',
    summary_ar: 'ثلاثة أيام محرك وظيفي. ليس برنامجاً تنافسياً.',
    summary_en: 'Three conditioning days. Not a competitive program.',
    days: [
      { name_ar: 'محرك أ', name_en: 'Engine A', exerciseIds: [id('11'), id('13'), id('12')] },
      { name_ar: 'محرك ب', name_en: 'Engine B', exerciseIds: [id('09'), id('08'), id('13')] },
      { name_ar: 'محرك ج', name_en: 'Engine C', exerciseIds: [id('14'), id('11'), id('12')] },
    ],
  },
];

export function templateById(templateId: string): TrainingTemplate | null {
  return TRAINING_TEMPLATES.find((item) => item.id === templateId) ?? null;
}

export function planTemplateDay(
  templateId: string,
  dayIndex: number,
  adaptation: TrainingAdaptationOverlay | null = null,
): { name: string; name_ar: string; name_en: string; discipline: Discipline; exercises: PlannedExercise[] } {
  const template = templateById(templateId);
  if (template === null) {
    throw new DomainError('UNKNOWN_TEMPLATE', 'Training template is not in the catalog');
  }
  const day = template.days[dayIndex];
  if (day === undefined) {
    throw new DomainError('UNKNOWN_TEMPLATE_DAY', 'That day is not in this program');
  }
  const exercises =
    template.discipline === 'crossfit'
      ? crossfitPlan(day.exerciseIds)
      : template.discipline === 'calisthenics'
        ? calisthenicsPlan(day.exerciseIds)
        : strengthPlan(day.exerciseIds, adaptation);
  const loadHint =
    adaptation !== null && adaptation.loadIncrementPctMax > 0
      ? ` · +≤${adaptation.loadIncrementPctMax}% load hint`
      : '';
  return {
    name: day.name_en,
    name_ar: `${template.name_ar} · ${day.name_ar}`,
    name_en: `${template.name_en} · ${day.name_en}${loadHint}`,
    discipline: template.discipline,
    exercises,
  };
}

export function catalogTemplates(): readonly TrainingTemplate[] {
  return TRAINING_TEMPLATES;
}

export function nextProgramDayIndex(completedCount: number, dayCount: number): number {
  if (!Number.isSafeInteger(completedCount) || !Number.isSafeInteger(dayCount) || dayCount <= 0) {
    return 0;
  }
  const cycle = completedCount < 0 ? 0 : completedCount;
  return cycle % dayCount;
}

function preferredFamily(profile: RecommendProfile): TemplateFamily {
  const sports = profile.sports.map((item) => item.toLowerCase());
  const discipline = (profile.discipline ?? '').toLowerCase();
  if (discipline === 'crossfit' || sports.includes('crossfit')) {
    return 'crossfit';
  }
  if (
    discipline === 'calisthenics' ||
    sports.includes('calisthenics') ||
    profile.environment === 'home' ||
    profile.environment === 'outdoor'
  ) {
    return 'calisthenics';
  }
  return 'strength';
}

function wantedDays(profile: RecommendProfile): number {
  const value = profile.sessionsPerWeek;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 3;
  }
  return Math.min(14, Math.max(1, Math.round(value)));
}

function goalVolume(profile: RecommendProfile): 'cut' | 'gain' | 'recomp' {
  if (profile.goals.includes('cutting') || profile.goals.includes('fat_loss')) {
    return 'cut';
  }
  if (profile.goals.includes('bulking') || profile.goals.includes('muscle_gain')) {
    return 'gain';
  }
  return 'recomp';
}

export function recommendTemplates(profile: RecommendProfile): readonly TemplateRecommendation[] {
  const family = preferredFamily(profile);
  const days = wantedDays(profile);
  const volume = goalVolume(profile);
  const experience = profile.experience ?? 'beginner';
  const bmi =
    profile.heightMm !== null &&
    profile.weightGrams !== null &&
    profile.heightMm > 0 &&
    profile.weightGrams > 0
      ? bmiHundredths(profile.weightGrams, profile.heightMm)
      : null;

  const ranked = TRAINING_TEMPLATES.map((template) => {
    let score = 0;
    let reason_ar = template.summary_ar;
    let reason_en = template.summary_en;

    if (template.family === family) {
      score += 50;
      reason_ar =
        family === 'crossfit' ? 'يناسب الكروس فت من ملفك' : family === 'calisthenics' ? 'يناسب وزن الجسم من ملفك' : 'يناسب تدريب الحديد من ملفك';
      reason_en =
        family === 'crossfit'
          ? 'Matches CrossFit on your profile'
          : family === 'calisthenics'
            ? 'Matches calisthenics on your profile'
            : 'Matches iron training on your profile';
    }

    const dayGap = Math.abs(template.daysPerWeek - days);
    score += Math.max(0, 36 - dayGap * 12);
    if (dayGap === 0) {
      reason_ar = `يطابق ${days} أيام تدريب في الأسبوع`;
      reason_en = `Matches ${days} training days a week`;
    }

    if (experience === 'beginner' && (template.split === 'arnold' || template.split === 'bro' || template.id === 'push_pull_legs_6')) {
      score -= 20;
    }
    if (experience === 'beginner' && (template.split === 'full_body' || (template.split === 'ppl' && template.daysPerWeek === 3))) {
      score += 12;
    }
    if (experience === 'advanced' && (template.split === 'arnold' || template.id === 'push_pull_legs_6')) {
      score += 14;
    }

    if (volume === 'cut' && (template.split === 'full_body' || template.family === 'crossfit' || template.daysPerWeek <= 4)) {
      score += 10;
    }
    if (volume === 'gain' && (template.split === 'bro' || template.split === 'arnold' || template.split === 'ppl')) {
      score += 10;
    }

    if (bmi !== null && bmi >= 2750 && (template.split === 'full_body' || (template.split === 'ppl' && template.daysPerWeek === 3))) {
      score += 8;
    }
    if (bmi !== null && bmi >= 2750 && template.split === 'arnold') {
      score -= 8;
    }

    if (profile.environment === 'home' && template.environment === 'home') {
      score += 20;
    }
    if (profile.environment === 'gym' && template.environment === 'gym') {
      score += 8;
    }

    return { id: template.id, score, reason_ar, reason_en };
  });

  return ranked.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}
