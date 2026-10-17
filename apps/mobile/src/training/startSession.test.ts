import { describe, expect, it } from 'vitest';
import type { LibraryExercise } from './library';
import { quickPlanFor } from './startSession';

const squat: LibraryExercise = {
  id: '10000000-0000-4000-8000-000000000001',
  name_ar: 'سكوات خلفي',
  name_en: 'Back squat',
  primary_muscles: ['quadriceps'],
  secondary_muscles: ['glutes'],
  movement_pattern: 'squat',
  equipment: ['barbell'],
  difficulty: 'intermediate',
  instructions_ar: [],
  instructions_en: [],
  disciplines: ['bodybuilding'],
  environments: ['gym'],
  equipment_brands: [],
  demonstrationMedia: null,
};

describe('quickPlanFor', () => {
  it('starts a strength session from a library exercise', () => {
    const quick = quickPlanFor([squat]);
    expect(quick.discipline).toBe('bodybuilding');
    expect(quick.plan).toEqual([
      {
        exerciseId: squat.id,
        prescription: {
          kind: 'strength',
          sets: 3,
          reps: 8,
          restSeconds: 90,
          loadGrams: null,
          rpeTenths: null,
        },
      },
    ]);
  });
});
