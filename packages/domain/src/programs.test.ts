import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { catalogTemplates, nextProgramDayIndex, planTemplateDay, recommendTemplates, templateById } from './programs.js';

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
