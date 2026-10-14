import { describe, expect, it } from 'vitest';
import { plannedExercises } from './plan';

const base = {
  exerciseIds: ['11111111-1111-4111-8111-111111111111'],
  sets: 4,
  reps: 8,
  format: 'amrap' as const,
  minutes: 12,
  rounds: 5,
  progression: 'full',
  holdSeconds: null,
};

describe('plannedExercises', () => {
  it('builds a strength plan for bodybuilding', () => {
    const [exercise] = plannedExercises({ ...base, discipline: 'bodybuilding' });
    expect(exercise?.prescription).toEqual({
      kind: 'strength',
      sets: 4,
      reps: 8,
      restSeconds: 90,
      loadGrams: null,
      rpeTenths: null,
    });
  });

  it('builds a hold-capable calisthenics plan', () => {
    const [exercise] = plannedExercises({ ...base, discipline: 'calisthenics', holdSeconds: 20 });
    expect(exercise?.prescription.kind).toBe('calisthenics');
    if (exercise?.prescription.kind === 'calisthenics') {
      expect(exercise.prescription.holdSeconds).toBe(20);
      expect(exercise.prescription.progression).toBe('full');
    }
  });

  it('builds a CrossFit plan with a time cap in seconds', () => {
    const [exercise] = plannedExercises({ ...base, discipline: 'crossfit' });
    expect(exercise?.prescription).toEqual({
      kind: 'crossfit',
      format: 'amrap',
      timeCapSeconds: 720,
      rounds: 5,
    });
  });
});
