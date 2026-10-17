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
    hamstrings: { ar: 'خلفية الفخذ', en: 'Hamstrings' },
    shoulders: { ar: 'الأكتاف', en: 'Shoulders' },
    back: { ar: 'الظهر', en: 'Back' },
    biceps: { ar: 'البايسبس', en: 'Biceps' },
    core: { ar: 'الجذع', en: 'Core' },
    grip: { ar: 'القبضة', en: 'Grip' },
    posterior_chain: { ar: 'السلسلة الخلفية', en: 'Posterior chain' },
    full_body: { ar: 'كامل الجسم', en: 'Full body' },
    calves: { ar: 'السمانة', en: 'Calves' },
    lats: { ar: 'الظهر العريض', en: 'Lats' },
    traps: { ar: 'الترابيز', en: 'Traps' },
    adductors: { ar: 'المقرّبات', en: 'Adductors' },
    abductors: { ar: 'المبعّدات', en: 'Abductors' },
    forearms: { ar: 'الساعد', en: 'Forearms' },
    abs: { ar: 'البطن', en: 'Abs' },
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
    dumbbell: { ar: 'دمبل', en: 'Dumbbell' },
    cable: { ar: 'كابل', en: 'Cable' },
    trap_bar: { ar: 'بار سداسي', en: 'Trap bar' },
    smith_machine: { ar: 'جهاز سميث', en: 'Smith machine' },
    rings: { ar: 'حلقات', en: 'Rings' },
    rope: { ar: 'حبل', en: 'Rope' },
    sled: { ar: 'زلاجة', en: 'Sled' },
    bike: { ar: 'دراجة', en: 'Bike' },
    rower: { ar: 'جهاز تجديف', en: 'Rower' },
    jump_rope: { ar: 'حبل قفز', en: 'Jump rope' },
    medicine_ball: { ar: 'كرة طبية', en: 'Medicine ball' },
    bands: { ar: 'أشرطة مقاومة', en: 'Bands' },
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
  activityKind: {
    walking: { ar: 'مشي', en: 'Walking' },
    running: { ar: 'جري', en: 'Running' },
    cycling: { ar: 'ركوب الدراجة', en: 'Cycling' },
    football: { ar: 'كرة القدم', en: 'Football' },
    basketball: { ar: 'كرة السلة', en: 'Basketball' },
    tennis: { ar: 'تنس', en: 'Tennis' },
    boxing: { ar: 'ملاكمة', en: 'Boxing' },
    swimming: { ar: 'سباحة', en: 'Swimming' },
    dance: { ar: 'رقص', en: 'Dance' },
    elliptical: { ar: 'جهاز بيضاوي', en: 'Elliptical' },
    jump_rope: { ar: 'نط الحبل', en: 'Jump rope' },
    hiit: { ar: 'تدريب عالي الكثافة', en: 'HIIT' },
    other: { ar: 'نشاط آخر', en: 'Other' },
  },
  meal: {
    breakfast: { ar: 'وجبة الفطور', en: 'Breakfast' },
    lunch: { ar: 'وجبة الغداء', en: 'Lunch' },
    dinner: { ar: 'وجبة العشاء', en: 'Dinner' },
    snack: { ar: 'وجبة خفيفة', en: 'Snack' },
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
