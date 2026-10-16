export type EquipmentManufacturer = {
  id: string;
  name: string;
  name_ar: string;
  categories: string[] | string;
  catalog_status: 'registry_only' | 'verified_models';
};

export type EquipmentBrand = string;
export type TrainingEnvironment = 'all' | 'home' | 'gym' | 'outdoor';

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
  },
): LibraryExercise[] {
  const needle = filters.query.trim().toLocaleLowerCase();
  return rows.filter((item) => {
    const disciplines = asLibraryList(item.disciplines);
    const environments = asLibraryList(item.environments);
    const brands = asLibraryList(item.equipment_brands);
    const matchesText =
      needle.length === 0 ||
      item.name_ar.includes(filters.query.trim()) ||
      item.name_en.toLocaleLowerCase().includes(needle);
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
    return matchesText && matchesDiscipline && matchesEnvironment && matchesBrand;
  });
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
