export type EquipmentManufacturer = {
  id: string;
  name: string;
  name_ar: string;
  categories: string[] | string;
  catalog_status: 'registry_only' | 'verified_models';
};

export type EquipmentBrand = string;
export type TrainingEnvironment = 'all' | 'home' | 'gym' | 'outdoor';
export type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full_body';
export type EquipmentKind = 'all' | 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable' | 'kettlebell';
export type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

export const MUSCLE_GROUP_MATCH: Record<Exclude<MuscleGroup, 'all'>, readonly string[]> = {
  chest: ['chest'],
  back: ['back', 'lats', 'traps'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['core', 'abs'],
  full_body: ['full_body', 'posterior_chain'],
};

export const EQUIPMENT_KIND_MATCH: Record<Exclude<EquipmentKind, 'all'>, readonly string[]> = {
  barbell: ['barbell', 'trap_bar', 'smith_machine'],
  dumbbell: ['dumbbell'],
  machine: ['machine'],
  bodyweight: ['bodyweight', 'bar', 'rings', 'dip_bars'],
  cable: ['cable'],
  kettlebell: ['kettlebell'],
};

const SEARCH_ALIASES: Record<string, readonly string[]> = {
  chest: ['صدر', 'الصدر'],
  back: ['ظهر', 'الظهر', 'لات'],
  lats: ['ظهر', 'لات', 'عريض'],
  traps: ['ترابيز', 'ترابيس'],
  quadriceps: ['فخذ', 'ارجل', 'أرجل', 'كواد'],
  hamstrings: ['هامسترنق', 'خلفية الفخذ'],
  glutes: ['مؤخرة', 'غلوتس'],
  calves: ['سمانة', 'سمانات'],
  adductors: ['تقريب'],
  abductors: ['تبعيد'],
  shoulders: ['كتف', 'أكتاف', 'اكتاف'],
  biceps: ['باي', 'بايسبس'],
  triceps: ['تراي', 'ترايسبس'],
  forearms: ['ساعد'],
  core: ['جذع', 'بطن', 'كور'],
  abs: ['بطن'],
  full_body: ['كامل', 'جسم كامل'],
  posterior_chain: ['سلسلة خلفية'],
  barbell: ['بار', 'باربل'],
  dumbbell: ['دمبل', 'دامبل'],
  machine: ['جهاز', 'ماكنة', 'مكنة'],
  cable: ['كابل'],
  kettlebell: ['كيتل', 'كيتل بيل'],
  bodyweight: ['وزن الجسم', 'أرضي'],
  smith_machine: ['سميث'],
  beginner: ['مبتدئ', 'سهل'],
  intermediate: ['متوسط'],
  advanced: ['متقدم', 'صعب'],
};

export type LibraryExercise = {
  id: string;
  name_ar: string;
  name_en: string;
  primary_muscles: string[] | string;
  secondary_muscles: string[] | string;
  movement_pattern: string;
  equipment: string[] | string;
  difficulty: string;
  instructions_ar: string[] | string;
  instructions_en: string[] | string;
  disciplines: string[] | string;
  environments: string[] | string;
  equipment_brands: string[] | string;
  demonstrationMedia: {
    type: 'procedural' | 'glb';
    profile: string | null;
    modelUri: string | null;
    licenseSpdx: string | null;
    attribution: string | null;
    reviewStatus: 'unreviewed' | 'reviewed';
  } | null;
  reviewStatus?: 'unreviewed' | 'reviewed';
};

export function asLibraryList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.length === 0) return [];
  return value
    .replace(/[{}]/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function filterExerciseLibrary(
  rows: readonly LibraryExercise[],
  filters: {
    query: string;
    discipline: string;
    environment: TrainingEnvironment;
    brand: EquipmentBrand | 'all';
    muscle?: MuscleGroup;
    equipmentKind?: EquipmentKind;
    difficulty?: DifficultyFilter;
  },
): LibraryExercise[] {
  const needle = filters.query.trim().toLocaleLowerCase();
  const queryText = filters.query.trim();
  const muscleGroup = filters.muscle ?? 'all';
  const equipmentKind = filters.equipmentKind ?? 'all';
  const difficulty = filters.difficulty ?? 'all';
  return rows.filter((item) => {
    const disciplines = asLibraryList(item.disciplines);
    const environments = asLibraryList(item.environments);
    const brands = asLibraryList(item.equipment_brands);
    const muscles = [...asLibraryList(item.primary_muscles), ...asLibraryList(item.secondary_muscles)];
    const equipment = asLibraryList(item.equipment);
    const aliases = [...muscles, ...equipment, item.difficulty].flatMap((key) => SEARCH_ALIASES[key] ?? []);
    const haystack = [
      item.name_ar,
      item.name_en,
      item.movement_pattern,
      ...muscles,
      ...equipment,
      ...aliases,
    ].join(' ').toLocaleLowerCase();
    const matchesText = needle.length === 0 || item.name_ar.includes(queryText) || haystack.includes(needle);
    const matchesDiscipline =
      filters.discipline === 'all' ||
      disciplines.length === 0 ||
      (filters.discipline === 'strength'
        ? disciplines.includes('bodybuilding') || disciplines.includes('powerlifting')
        : filters.discipline === 'crossfit'
          ? disciplines.includes('crossfit') || disciplines.includes('functional_training')
          : disciplines.includes(filters.discipline));
    const matchesEnvironment =
      filters.environment === 'all' ||
      environments.length === 0 ||
      environments.includes(filters.environment);
    const matchesBrand = filters.brand === 'all' || brands.includes(filters.brand);
    const matchesMuscle =
      muscleGroup === 'all' || muscles.some((muscle) => MUSCLE_GROUP_MATCH[muscleGroup].includes(muscle));
    const matchesEquipment =
      equipmentKind === 'all' || equipment.some((itemEquipment) => EQUIPMENT_KIND_MATCH[equipmentKind].includes(itemEquipment));
    const matchesDifficulty = difficulty === 'all' || item.difficulty === difficulty;
    return matchesText && matchesDiscipline && matchesEnvironment && matchesBrand && matchesMuscle && matchesEquipment && matchesDifficulty;
  });
}

export function disciplineForExercise(exercise: LibraryExercise): string {
  const disciplines = asLibraryList(exercise.disciplines);
  if (disciplines.includes('bodybuilding') || disciplines.includes('powerlifting')) return 'bodybuilding';
  if (disciplines.includes('crossfit') || disciplines.includes('functional_training')) return 'crossfit';
  if (disciplines.includes('calisthenics')) return 'calisthenics';
  return 'general_fitness';
}

export function normalizeScanCode(raw: string): string {
  const trimmed = raw.trim();
  const prefixed = /^traina:exercise:(.+)$/i.exec(trimmed);
  if (prefixed?.[1] !== undefined) return prefixed[1].trim().toLowerCase();
  return trimmed.replace(/\s+/g, '').toUpperCase();
}

export function demoProfileFor(exercise: Pick<LibraryExercise, 'movement_pattern' | 'demonstrationMedia'>): string {
  return exercise.demonstrationMedia?.profile ?? exercise.movement_pattern;
}

export function brandLabel(
  brand: EquipmentBrand,
  locale: 'ar' | 'en',
  manufacturers: readonly EquipmentManufacturer[] = [],
): string {
  const manufacturer = manufacturers.find((item) => item.id === brand);
  if (manufacturer !== undefined) return locale === 'ar' ? manufacturer.name_ar : manufacturer.name;
  return brand
    .split('_')
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ');
}
