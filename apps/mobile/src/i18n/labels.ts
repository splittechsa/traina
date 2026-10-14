import type { Locale } from '../format';

const unspecified = { ar: 'غير محدد', en: 'Unspecified' } as const;

const tables = {
  goal: {
    cutting: { ar: 'تنشيف', en: 'Cutting' },
    fat_loss: { ar: 'خسارة دهون', en: 'Fat loss' },
    bulking: { ar: 'تضخيم', en: 'Bulking' },
    muscle_gain: { ar: 'بناء عضل', en: 'Muscle gain' },
    body_recomposition: { ar: 'إعادة تشكيل', en: 'Recomposition' },
    strength: { ar: 'قوة', en: 'Strength' },
    endurance: { ar: 'تحمّل', en: 'Endurance' },
    general_health: { ar: 'صحة عامة', en: 'General health' },
  },
  discipline: {
    bodybuilding: { ar: 'كمال أجسام', en: 'Bodybuilding' },
    powerlifting: { ar: 'رفع أثقال', en: 'Powerlifting' },
    crossfit: { ar: 'كروس فت', en: 'CrossFit' },
    calisthenics: { ar: 'كالستنكس', en: 'Calisthenics' },
    functional_training: { ar: 'تدريب وظيفي', en: 'Functional training' },
    general_fitness: { ar: 'لياقة عامة', en: 'General fitness' },
    hybrid: { ar: 'أكثر من رياضة', en: 'More than one sport' },
  },
  sport: {
    bodybuilding: { ar: 'كمال الأجسام', en: 'Bodybuilding' },
    calisthenics: { ar: 'كالستنكس', en: 'Calisthenics' },
    crossfit: { ar: 'كروس فت', en: 'CrossFit' },
    powerlifting: { ar: 'باورلفتنق', en: 'Powerlifting' },
    running: { ar: 'جري', en: 'Running' },
    boxing: { ar: 'ملاكمة', en: 'Boxing' },
    general_fitness: { ar: 'لياقة عامة', en: 'General fitness' },
  },
  experience: {
    beginner: { ar: 'مبتدئ', en: 'Beginner' },
    intermediate: { ar: 'متوسط', en: 'Intermediate' },
    advanced: { ar: 'متقدم', en: 'Advanced' },
  },
  environment: {
    home: { ar: 'المنزل', en: 'Home' },
    gym: { ar: 'النادي', en: 'Gym' },
    outdoor: { ar: 'في الخارج', en: 'Outdoors' },
    mixed: { ar: 'متنوع', en: 'Mixed' },
  },
  activity: {
    sedentary: { ar: 'قليل الحركة', en: 'Mostly seated' },
    light: { ar: 'حركة خفيفة', en: 'Light' },
    moderate: { ar: 'حركة متوسطة', en: 'Moderate' },
    high: { ar: 'نشيط', en: 'Active' },
    athlete: { ar: 'رياضي', en: 'Athlete' },
  },
  session: {
    scheduled: { ar: 'مجدول', en: 'Scheduled' },
    in_progress: { ar: 'جارٍ الآن', en: 'In progress' },
    paused: { ar: 'متوقف', en: 'Paused' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    abandoned: { ar: 'متروك', en: 'Abandoned' },
  },
  muscle: {
    quadriceps: { ar: 'عضلات الفخذ', en: 'Quadriceps' },
    glutes: { ar: 'عضلات المؤخرة', en: 'Glutes' },
    chest: { ar: 'الصدر', en: 'Chest' },
    triceps: { ar: 'الترايسبس', en: 'Triceps' },
  },
  equipment: {
    barbell: { ar: 'بار', en: 'Barbell' },
    rack: { ar: 'حامل', en: 'Rack' },
    bench: { ar: 'مقعد', en: 'Bench' },
    bodyweight: { ar: 'وزن الجسم', en: 'Bodyweight' },
  },
  foodSource: {
    manual: { ar: 'إدخال يدوي', en: 'Entered manually' },
    image_estimate: { ar: 'تقدير صورة', en: 'Photo estimate' },
    barcode: { ar: 'باركود', en: 'Barcode' },
    recipe: { ar: 'وصفة', en: 'Recipe' },
  },
  diet: {
    no_preference: { ar: 'بدون تفضيل', en: 'No preference' },
    higher_protein: { ar: 'اهتمام أعلى بالبروتين', en: 'Higher protein' },
    vegetarian: { ar: 'نباتي', en: 'Vegetarian' },
    no_dairy: { ar: 'بدون ألبان', en: 'No dairy' },
  },
  time: {
    morning: { ar: 'صباحاً', en: 'Morning' },
    evening: { ar: 'مساءً', en: 'Evening' },
  },
} as const;

export type LabelGroup = keyof typeof tables;

export function label(locale: Locale, group: LabelGroup, value: string): string {
  const table = tables[group] as Record<string, { ar: string; en: string }>;
  return table[value]?.[locale] ?? unspecified[locale];
}

export function labelList(locale: Locale, group: LabelGroup, values: readonly string[]): string {
  if (values.length === 0) {
    return unspecified[locale];
  }
  return values.map((value) => label(locale, group, value)).join(locale === 'ar' ? '، ' : ', ');
}
