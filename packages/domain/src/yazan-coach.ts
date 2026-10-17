import { DomainError } from './errors.js';

/**
 * Traina product spine: the AI coach ("يزن") is the product.
 * Daily logs (water, food, sessions, supplements, weight) are input infrastructure
 * the coach reads — not the destination experience.
 *
 * Science-based stance: use only logged facts; never invent burned kcal, labs, or dishes.
 * Weekly survey packages facts + athlete answers for a human coach review file.
 */

export type YazanDailyFacts = {
  goals: readonly string[];
  waterMl: number;
  waterGoalMl: number;
  mealCount: number;
  energyKcal: number | null;
  sessionsCompleted: number;
  sessionsPlanned: number;
  nutritionPhase: string | null;
  nutritionPace: string | null;
  waterDaysLogged14: number;
  mealDaysLogged14: number;
  /** Net grams over recent samples; null when unknown. */
  weightTrendGrams: number | null;
};

export type YazanDailyFocus = 'water' | 'meals' | 'training' | 'nutrition_plan' | 'stable';

export type YazanDailyBrief = {
  kind: 'daily_checkin';
  priority: 'act' | 'encourage' | 'hold';
  focus: YazanDailyFocus;
  /** Deterministic coach opener from facts — model may polish, not invent numbers. */
  messageAr: string;
  messageEn: string;
};

function assertNonNegInt(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(code, 'Daily coach facts must be non-negative integers');
  }
}

/** Pick today's coaching focus from logged facts only. */
export function buildYazanDailyBrief(facts: YazanDailyFacts): YazanDailyBrief {
  assertNonNegInt(facts.waterMl, 'INVALID_WATER');
  assertNonNegInt(facts.waterGoalMl, 'INVALID_WATER');
  assertNonNegInt(facts.mealCount, 'INVALID_MEALS');
  assertNonNegInt(facts.sessionsCompleted, 'INVALID_SESSIONS');
  assertNonNegInt(facts.sessionsPlanned, 'INVALID_SESSIONS');
  assertNonNegInt(facts.waterDaysLogged14, 'INVALID_WATER');
  assertNonNegInt(facts.mealDaysLogged14, 'INVALID_MEALS');

  const goals = facts.goals.length > 0 ? facts.goals.join('، ') : 'هدف عام';
  const phase =
    facts.nutritionPhase === 'cutting'
      ? facts.nutritionPace === 'sprint'
        ? 'تنشيف سريع'
        : facts.nutritionPace === 'gentle'
          ? 'تنشيف هادئ'
          : 'تنشيف'
      : facts.nutritionPhase === 'gain'
        ? 'تضخيم'
        : facts.nutritionPhase === 'fitness'
          ? 'لياقة'
          : null;

  if (facts.waterGoalMl > 0 && facts.waterMl * 2 < facts.waterGoalMl) {
    return {
      kind: 'daily_checkin',
      priority: 'act',
      focus: 'water',
      messageAr: `معك يزن. اليوم الموية ناقصة (${facts.waterMl} من ${facts.waterGoalMl} مل). سجّل اللي تشربه — أبني اليوم من اللي تدخل، مو من التخمين.`,
      messageEn: `Yazan here. Water is behind (${facts.waterMl} of ${facts.waterGoalMl} ml). Log what you drink — I coach from what you enter, not guesses.`,
    };
  }
  if (facts.waterDaysLogged14 < 7) {
    return {
      kind: 'daily_checkin',
      priority: 'act',
      focus: 'water',
      messageAr: `معك يزن. آخر ١٤ يوم سجّلت الموية ${facts.waterDaysLogged14} يوم فقط. انضباط التسجيل يغيّر جدولك — كمّل اليوم.`,
      messageEn: `Yazan here. Water logged only ${facts.waterDaysLogged14} of the last 14 days. Logging discipline changes your plan — finish today.`,
    };
  }
  if (facts.mealCount === 0) {
    return {
      kind: 'daily_checkin',
      priority: 'act',
      focus: 'meals',
      messageAr: `معك يزن. ما في وجبة مسجّلة اليوم${phase !== null ? ` وخطتك ${phase}` : ''}. ادخل الأكل عشان أضبط الكارب والطاقة على هدفك (${goals}).`,
      messageEn: `Yazan here. No meal logged today${phase !== null ? ` and your plan is ${phase}` : ''}. Log food so I can tune energy to your goals (${goals}).`,
    };
  }
  if (facts.sessionsPlanned > 0 && facts.sessionsCompleted < facts.sessionsPlanned) {
    return {
      kind: 'daily_checkin',
      priority: 'encourage',
      focus: 'training',
      messageAr: `معك يزن. الحصص ${facts.sessionsCompleted} من ${facts.sessionsPlanned} هذا الأسبوع. ابدأ جلسة لما تقدر — الوقت المسجّل هو اللي أبني عليه.`,
      messageEn: `Yazan here. Sessions ${facts.sessionsCompleted} of ${facts.sessionsPlanned} this week. Start when you can — logged time is what I build on.`,
    };
  }
  if (facts.nutritionPhase === 'cutting' && facts.weightTrendGrams !== null && facts.weightTrendGrams > 200) {
    return {
      kind: 'daily_checkin',
      priority: 'act',
      focus: 'nutrition_plan',
      messageAr: `معك يزن. الوزن صاعد وأنت على تنشيف. راجع التزام الوجبات؛ اقترح تعديل بعد تأكيدك — ما أغيّر الجدول صامت.`,
      messageEn: `Yazan here. Weight is up on a cut. Review meal adherence; I'll propose a change after you confirm — I never silent-edit the plan.`,
    };
  }
  const kcal =
    facts.energyKcal === null
      ? ''
      : ` سعرات اليوم المسجّلة ${facts.energyKcal}.`;
  return {
    kind: 'daily_checkin',
    priority: 'hold',
    focus: 'stable',
    messageAr: `معك يزن. يومك متماسك: موية ووجبات مسجّلة${kcal} الهدف (${goals})${phase !== null ? ` · ${phase}` : ''}. كمّل بنفس الانضباط — أنا أتابع المدخلات يومياً.`,
    messageEn: `Yazan here. Day holding: water and meals logged${kcal} Goals (${goals})${phase !== null ? ` · ${phase}` : ''}. Keep the discipline — I follow your inputs daily.`,
  };
}

export type WeeklySurveyAnswers = {
  energy: number;
  sleep: number;
  stress: number;
  hunger: number;
  notes: string;
};

export type WeeklyHumanCoachPacket = {
  weekOf: string;
  goals: readonly string[];
  mealDaysLogged: number;
  waterDaysLogged: number;
  sessionsCompleted: number;
  energyKcalTotal: number;
  weightStartGrams: number | null;
  weightEndGrams: number | null;
  nutritionPhase: string | null;
  nutritionPace: string | null;
  survey: WeeklySurveyAnswers;
  /** File-ready summary for a human coach. */
  briefAr: string;
  briefEn: string;
  escalateToHuman: true;
};

function assertSurveyScore(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 5) {
    throw new DomainError('INVALID_SURVEY', `${field} must be an integer 1–5`);
  }
}

/** Build a weekly packet the member can raise to a human coach. Facts only + survey. */
export function buildWeeklyHumanCoachPacket(input: {
  weekOf: string;
  goals: readonly string[];
  mealDaysLogged: number;
  waterDaysLogged: number;
  sessionsCompleted: number;
  energyKcalTotal: number;
  weightStartGrams: number | null;
  weightEndGrams: number | null;
  nutritionPhase: string | null;
  nutritionPace: string | null;
  survey: WeeklySurveyAnswers;
}): WeeklyHumanCoachPacket {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekOf)) {
    throw new DomainError('INVALID_DATE', 'weekOf must be YYYY-MM-DD');
  }
  assertSurveyScore(input.survey.energy, 'energy');
  assertSurveyScore(input.survey.sleep, 'sleep');
  assertSurveyScore(input.survey.stress, 'stress');
  assertSurveyScore(input.survey.hunger, 'hunger');
  const notes = input.survey.notes.replace(/\s+/g, ' ').trim();
  if (notes.length > 500) {
    throw new DomainError('INVALID_SURVEY', 'Notes must be at most 500 characters');
  }
  assertNonNegInt(input.mealDaysLogged, 'INVALID_MEALS');
  assertNonNegInt(input.waterDaysLogged, 'INVALID_WATER');
  assertNonNegInt(input.sessionsCompleted, 'INVALID_SESSIONS');
  assertNonNegInt(input.energyKcalTotal, 'INVALID_ENERGY');

  const weightLine =
    input.weightStartGrams !== null && input.weightEndGrams !== null
      ? `${(input.weightStartGrams / 1000).toFixed(1)} → ${(input.weightEndGrams / 1000).toFixed(1)} كغ`
      : 'غير متوفر';
  const survey = { ...input.survey, notes };
  const briefAr = [
    `ملف أسبوعي لمدرب بشري — أسبوع ${input.weekOf}`,
    `الأهداف: ${input.goals.join('، ') || 'غير محددة'}`,
    `المرحلة: ${input.nutritionPhase ?? '—'} · الوتيرة: ${input.nutritionPace ?? '—'}`,
    `تسجيل: وجبات ${input.mealDaysLogged}/7 · موية ${input.waterDaysLogged}/7 · حصص ${input.sessionsCompleted}`,
    `سعرات مسجّلة (مجموع الأسبوع): ${input.energyKcalTotal}`,
    `الوزن: ${weightLine}`,
    `استطلاع: طاقة ${survey.energy}/5 · نوم ${survey.sleep}/5 · ضغط ${survey.stress}/5 · جوع ${survey.hunger}/5`,
    notes.length > 0 ? `ملاحظات المتدرب: ${notes}` : 'بدون ملاحظات إضافية',
    'مصدر: مدخلات ترينا فقط — لا سعرات محروقة مخترعة.',
  ].join('\n');
  const briefEn = [
    `Weekly human-coach file — week of ${input.weekOf}`,
    `Goals: ${input.goals.join(', ') || 'unset'}`,
    `Phase: ${input.nutritionPhase ?? '—'} · Pace: ${input.nutritionPace ?? '—'}`,
    `Logging: meals ${input.mealDaysLogged}/7 · water ${input.waterDaysLogged}/7 · sessions ${input.sessionsCompleted}`,
    `Logged energy (week sum): ${input.energyKcalTotal} kcal`,
    `Weight: ${
      input.weightStartGrams !== null && input.weightEndGrams !== null
        ? `${(input.weightStartGrams / 1000).toFixed(1)} → ${(input.weightEndGrams / 1000).toFixed(1)} kg`
        : 'unavailable'
    }`,
    `Survey: energy ${survey.energy}/5 · sleep ${survey.sleep}/5 · stress ${survey.stress}/5 · hunger ${survey.hunger}/5`,
    notes.length > 0 ? `Athlete notes: ${notes}` : 'No extra notes',
    'Source: Traina logged inputs only — no invented burned calories.',
  ].join('\n');

  return {
    weekOf: input.weekOf,
    goals: input.goals,
    mealDaysLogged: input.mealDaysLogged,
    waterDaysLogged: input.waterDaysLogged,
    sessionsCompleted: input.sessionsCompleted,
    energyKcalTotal: input.energyKcalTotal,
    weightStartGrams: input.weightStartGrams,
    weightEndGrams: input.weightEndGrams,
    nutritionPhase: input.nutritionPhase,
    nutritionPace: input.nutritionPace,
    survey,
    briefAr,
    briefEn,
    escalateToHuman: true,
  };
}
