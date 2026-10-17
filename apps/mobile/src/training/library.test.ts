import { describe, expect, it } from 'vitest';
import { brandLabel, demoProfileFor, disciplineForExercise, filterExerciseLibrary, normalizeScanCode, type LibraryExercise } from './library';

const base: LibraryExercise = {
  id: 'exercise',
  name_ar: 'ضغط الصدر على الجهاز',
  name_en: 'Machine chest press',
  primary_muscles: ['chest'],
  secondary_muscles: ['triceps'],
  movement_pattern: 'horizontal_push',
  equipment: ['machine'],
  difficulty: 'beginner',
  instructions_ar: [],
  instructions_en: [],
  disciplines: ['bodybuilding'],
  environments: ['gym'],
  equipment_brands: ['panatta', 'matrix'],
  demonstrationMedia: null,
};

describe('filterExerciseLibrary', () => {
  it('combines discipline, environment, brand, and text filters', () => {
    const rows = [
      base,
      {
        ...base,
        id: 'home',
        name_ar: 'ضغط أرضي',
        name_en: 'Push-up',
        disciplines: ['calisthenics'],
        environments: ['home'],
        equipment_brands: [],
      },
    ];
    expect(filterExerciseLibrary(rows, {
      query: 'chest',
      discipline: 'bodybuilding',
      environment: 'gym',
      brand: 'panatta',
    }).map((item) => item.id)).toEqual(['exercise']);
  });

  it('does not claim untagged equipment belongs to a selected brand', () => {
    expect(filterExerciseLibrary([{ ...base, equipment_brands: [] }], {
      query: '',
      discipline: 'all',
      environment: 'all',
      brand: 'matrix',
    })).toEqual([]);
  });

  it('groups bodybuilding and powerlifting under the strength family', () => {
    const rows = [
      base,
      { ...base, id: 'power', disciplines: ['powerlifting'] },
      { ...base, id: 'crossfit', disciplines: ['crossfit'] },
    ];
    expect(filterExerciseLibrary(rows, {
      query: '',
      discipline: 'strength',
      environment: 'all',
      brand: 'all',
    }).map((item) => item.id)).toEqual(['exercise', 'power']);
  });

  it('filters by muscle group, equipment, difficulty, and muscle search', () => {
    const rows = [
      base,
      { ...base, id: 'row', name_ar: 'سحب', name_en: 'Row', primary_muscles: ['back'], equipment: ['cable'], difficulty: 'advanced' },
    ];
    expect(filterExerciseLibrary(rows, {
      query: 'سحب',
      discipline: 'all',
      environment: 'all',
      brand: 'all',
    }).map((item) => item.id)).toEqual(['row']);
    expect(filterExerciseLibrary(rows, {
      query: '',
      discipline: 'all',
      environment: 'all',
      brand: 'all',
      muscle: 'chest',
      equipmentKind: 'machine',
      difficulty: 'beginner',
    }).map((item) => item.id)).toEqual(['exercise']);
  });

  it('matches Arabic muscle and equipment aliases without the name containing them', () => {
    const rows = [
      { ...base, id: 'bench', name_ar: 'بنش', name_en: 'Bench', primary_muscles: ['chest'], equipment: ['barbell'] },
      { ...base, id: 'row', name_ar: 'رو', name_en: 'Row', primary_muscles: ['back'], equipment: ['cable'] },
    ];
    expect(filterExerciseLibrary(rows, {
      query: 'صدر',
      discipline: 'all',
      environment: 'all',
      brand: 'all',
    }).map((item) => item.id)).toEqual(['bench']);
    expect(filterExerciseLibrary(rows, {
      query: 'كابل',
      discipline: 'all',
      environment: 'all',
      brand: 'all',
    }).map((item) => item.id)).toEqual(['row']);
  });

  it('keeps functional training inside the CrossFit family', () => {
    expect(filterExerciseLibrary([{ ...base, disciplines: ['functional_training'] }], {
      query: '',
      discipline: 'crossfit',
      environment: 'all',
      brand: 'all',
    })).toHaveLength(1);
  });
});

describe('disciplineForExercise and scan codes', () => {
  it('maps library tags to a startable discipline and normalizes gym codes', () => {
    expect(disciplineForExercise(base)).toBe('bodybuilding');
    expect(normalizeScanCode(' trn-legpress ')).toBe('TRN-LEGPRESS');
    expect(normalizeScanCode('traina:exercise:10000000-0000-4000-8000-000000000019')).toBe('10000000-0000-4000-8000-000000000019');
  });
});

describe('demoProfileFor', () => {
  it('prefers persisted demonstration profiles and falls back to movement pattern', () => {
    expect(demoProfileFor(base)).toBe('horizontal_push');
    expect(demoProfileFor({
      ...base,
      demonstrationMedia: {
        type: 'procedural',
        profile: 'squat',
        modelUri: null,
        licenseSpdx: null,
        attribution: null,
        reviewStatus: 'unreviewed',
      },
    })).toBe('squat');
  });
});

describe('brandLabel', () => {
  it('uses the server catalog and falls back safely for unknown registry ids', () => {
    const manufacturers = [{
      id: 'panatta',
      name: 'Panatta',
      name_ar: 'باناتا',
      categories: ['strength_machine'],
      catalog_status: 'registry_only' as const,
    }];
    expect(brandLabel('panatta', 'ar', manufacturers)).toBe('باناتا');
    expect(brandLabel('future_brand', 'en', manufacturers)).toBe('Future Brand');
  });
});
