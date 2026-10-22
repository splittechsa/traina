import type { Locale } from '../format';

const unspecified = { ar: 'غير محدد', en: 'Unspecified' } as const;

const tables = {
  capability: {
    'tracking.free': { ar: 'تسجيل التمارين والغذاء والتقدّم', en: 'Track workouts, food and progress' },
    'yazan.daily': { ar: 'محادثات يومية مع يزن', en: 'Daily conversations with Yazan' },
    'recommendations.propose': { ar: 'اقتراحات تناسب تقدّمك', en: 'Suggestions based on your progress' },
    'human_coach.weekly_review': { ar: 'مراجعة أسبوعية من مدرب بشري', en: 'Weekly human-coach review' },
    'human_coach.assignment': { ar: 'المتابعة مع مدربك', en: 'Follow-up with your coach' },
    'nutrition.paid_adaptations': { ar: 'تعديل خطة التغذية', en: 'Nutrition plan adjustments' },
  },
  subscriptionStatus: {
    free: { ar: 'مجاني', en: 'Free' },
    trialing: { ar: 'فترة تجريبية', en: 'Trial' },
    active: { ar: 'نشط', en: 'Active' },
    grace_period: { ar: 'مهلة تجديد', en: 'Renewal grace period' },
    billing_retry: { ar: 'بانتظار إكمال الدفع', en: 'Payment pending' },
    canceled: { ar: 'ملغى', en: 'Canceled' },
    expired: { ar: 'منتهٍ', en: 'Expired' },
    refunded: { ar: 'تم استرداد المبلغ', en: 'Refunded' },
    revoked: { ar: 'غير متاح', en: 'Unavailable' },
  },
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
    abductors: { ar: 'مُبعِدات الفخذ', en: 'Hip abductors' },
    adductors: { ar: 'مُقرِّبات الفخذ', en: 'Hip adductors' },
    calves: { ar: 'عضلات بطة الساق', en: 'Calves' },
    forearms: { ar: 'الساعدان', en: 'Forearms' },
    traps: { ar: 'العضلات شبه المنحرفة', en: 'Trapezius' },
    quadriceps: { ar: 'عضلات الفخذ', en: 'Quadriceps' },
    glutes: { ar: 'عضلات المؤخرة', en: 'Glutes' },
    chest: { ar: 'الصدر', en: 'Chest' },
    triceps: { ar: 'الترايسبس', en: 'Triceps' },
    hamstrings: { ar: 'خلفية الفخذ', en: 'Hamstrings' },
    shoulders: { ar: 'الأكتاف', en: 'Shoulders' },
    back: { ar: 'الظهر', en: 'Back' },
    biceps: { ar: 'البايسبس', en: 'Biceps' },
    core: { ar: 'الجذع', en: 'Core' },
    grip: { ar: 'القبضة', en: 'Grip' },
    posterior_chain: { ar: 'السلسلة الخلفية', en: 'Posterior chain' },
    full_body: { ar: 'كامل الجسم', en: 'Full body' },
  },
  equipment: {
    barbell: { ar: 'بار', en: 'Barbell' },
    rack: { ar: 'حامل', en: 'Rack' },
    bench: { ar: 'مقعد', en: 'Bench' },
    bodyweight: { ar: 'وزن الجسم', en: 'Bodyweight' },
    kettlebell: { ar: 'كيتل بيل', en: 'Kettlebell' },
    plyo_box: { ar: 'صندوق قفز', en: 'Plyo box' },
    dip_bars: { ar: 'متوازي', en: 'Dip bars' },
    bar: { ar: 'عارضة', en: 'Bar' },
    machine: { ar: 'جهاز مقاومة', en: 'Resistance machine' },
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
