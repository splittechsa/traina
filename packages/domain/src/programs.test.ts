import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  catalogTemplates,
  nextProgramDayIndex,
  planDocumentDay,
  planTemplateDay,
  recommendTemplates,
  suggestExerciseSubstitutions,
  templateById,
} from './programs.js';

describe('training program catalog', () => {
  it('exposes named splits with at least one day each', () => {
    const catalog = catalogTemplates();
    expect(catalog.map((item) => item.id)).toEqual([
      'gym_full_body',
      'push_pull_legs',
      'push_pull_legs_6',
      'bro_split',
      'arnold_split',
      'upper_lower',
      'home_calisthenics',
      'calisthenics_ppl',
      'calisthenics_intermediate',
      'calisthenics_skills',
      'conditioning_engine',
      'crossfit_three',
    ]);
    for (const template of catalog) {
      expect(template.days.length).toBeGreaterThan(0);
      expect(template.daysPerWeek).toBe(template.days.length);
      expect(template.days.every((day) => day.exerciseIds.length >= 3)).toBe(true);
    }
  });

  it('plans a strength day from the gym full-body template', () => {
    const planned = planTemplateDay('gym_full_body', 0);
    expect(planned.discipline).toBe('bodybuilding');
    expect(planned.exercises).toHaveLength(4);
    expect(planned.exercises[0]?.prescription).toEqual({
      kind: 'strength',
      sets: 3,
      reps: 8,
      restSeconds: 90,
      loadGrams: null,
      rpeTenths: null,
    });
  });

  it('plans a customized document day without leaving the template discipline', () => {
    const template = templateById('push_pull_legs');
    expect(template).not.toBeNull();
    const customized = planDocumentDay(
      {
        templateId: 'push_pull_legs',
        days: [
          {
            name_ar: 'دفع مخصص',
            name_en: 'Custom push',
            exerciseIds: [template!.days[0]!.exerciseIds[0]!, template!.days[0]!.exerciseIds[1]!],
          },
          ...template!.days.slice(1),
        ],
      },
      0,
    );
    expect(customized.discipline).toBe('bodybuilding');
    expect(customized.exercises).toHaveLength(2);
  });

  it('does not resurrect a removed day from the catalog when starting a customized program', () => {
    const template = templateById('push_pull_legs')!;
    const document = { templateId: template.id, days: [template.days[0]!] };
    expect(planDocumentDay(document, 0).exercises.length).toBeGreaterThan(0);
    expect(() => planDocumentDay(document, 1)).toThrow('That day is not in this program');
    // Legacy version documents without explicit days still use the catalog.
    expect(planDocumentDay({ templateId: template.id, days: [] }, 1).exercises.length).toBeGreaterThan(0);
  });

  it('honors member strength settings while retaining an approved recovery overlay', () => {
    const template = templateById('push_pull_legs')!;
    const day = template.days[0]!;
    const exerciseId = day.exerciseIds[0]!;
    const document = { templateId: template.id, days: [{ ...day, strengthOverrides: { [exerciseId]: { sets: 5, reps: 12, restSeconds: 120 } } }] };
    const plain = planDocumentDay(document, 0);
    expect(plain.exercises[0]?.prescription).toMatchObject({ sets: 5, reps: 12, restSeconds: 120 });
    const adapted = planDocumentDay(document, 0, { kind: 'recovery_preference', volumeScaleBps: 7000, restSecondsDelta: 30, loadIncrementPctMax: 0, recommendationId: 'rec-1', appliedAt: '2026-10-20T12:00:00.000Z' });
    expect(adapted.exercises[0]?.prescription).toMatchObject({ sets: 4, reps: 12, restSeconds: 150 });
    expect(() => planDocumentDay({ ...document, days: [{ ...day, strengthOverrides: { [exerciseId]: { sets: 0, reps: 12, restSeconds: 120 } } }] }, 0)).toThrow('Invalid exercise settings');
    expect(() => planDocumentDay({ ...document, days: [{ ...day, strengthOverrides: { unknown: { sets: 3, reps: 8, restSeconds: 90 } } }] }, 0)).toThrow('Invalid exercise settings');
  });

  it('ranks substitutes by shared primary muscle and equipment', () => {
    const ranked = suggestExerciseSubstitutions('a', [
      { id: 'a', primaryMuscles: ['chest'], equipment: ['barbell'], difficulty: 'intermediate' },
      { id: 'b', primaryMuscles: ['chest'], equipment: ['dumbbell'], difficulty: 'intermediate' },
      { id: 'c', primaryMuscles: ['chest'], equipment: ['barbell'], difficulty: 'beginner' },
      { id: 'd', primaryMuscles: ['back'], equipment: ['barbell'], difficulty: 'intermediate' },
    ]);
    expect(ranked[0]?.id).toBe('c');
    expect(ranked.map((item) => item.id)).not.toContain('a');
    expect(ranked.some((item) => item.id === 'd')).toBe(false);
  });

  it('holds a plank on the home calisthenics day', () => {
    const planned = planTemplateDay('home_calisthenics', 0);
    const plank = planned.exercises.find((item) => item.exerciseId.endsWith('010'));
    expect(plank?.prescription).toMatchObject({ kind: 'calisthenics', holdSeconds: 30 });
  });

  it('rejects unknown templates and days', () => {
    expect(templateById('nope')).toBeNull();
    expect(() => planTemplateDay('nope', 0)).toThrow(DomainError);
    expect(() => planTemplateDay('push_pull_legs', 9)).toThrow(DomainError);
  });

  it('recommends bro split for five gym days of iron work', () => {
    const ranked = recommendTemplates({
      sessionsPerWeek: 5,
      goals: ['muscle_gain'],
      discipline: 'bodybuilding',
      sports: ['bodybuilding'],
      environment: 'gym',
      experience: 'intermediate',
      heightMm: 1780,
      weightGrams: 82_000,
    });
    expect(ranked[0]?.id).toBe('bro_split');
  });

  it('recommends Arnold split for six advanced hypertrophy days', () => {
    const ranked = recommendTemplates({
      sessionsPerWeek: 6,
      goals: ['bulking'],
      discipline: 'bodybuilding',
      sports: ['bodybuilding'],
      environment: 'gym',
      experience: 'advanced',
      heightMm: 1800,
      weightGrams: 88_000,
    });
    expect(ranked[0]?.id).toBe('arnold_split');
  });

  it('recommends calisthenics for a home profile', () => {
    const ranked = recommendTemplates({
      sessionsPerWeek: 3,
      goals: ['general_health'],
      discipline: 'calisthenics',
      sports: ['calisthenics'],
      environment: 'home',
      experience: 'beginner',
      heightMm: 1700,
      weightGrams: 70_000,
    });
    expect(ranked[0]?.id).toBe('calisthenics_ppl');
  });

  it('recommends a three-day CrossFit table', () => {
    const ranked = recommendTemplates({
      sessionsPerWeek: 3,
      goals: ['endurance'],
      discipline: 'crossfit',
      sports: ['crossfit'],
      environment: 'gym',
      experience: 'intermediate',
      heightMm: 1750,
      weightGrams: 74_000,
    });
    expect(ranked[0]?.id).toBe('crossfit_three');
  });

  it('cycles program days from completed sessions', () => {
    expect(nextProgramDayIndex(0, 5)).toBe(0);
    expect(nextProgramDayIndex(5, 5)).toBe(0);
    expect(nextProgramDayIndex(7, 5)).toBe(2);
    expect(nextProgramDayIndex(2, 0)).toBe(0);
  });
});
