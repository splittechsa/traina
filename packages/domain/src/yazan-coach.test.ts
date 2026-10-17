import { describe, expect, it } from 'vitest';
import { buildWeeklyHumanCoachPacket, buildYazanDailyBrief } from './yazan-coach.js';

describe('Yazan coach spine', () => {
  it('prioritizes water, then meals, then training from logged facts', () => {
    const water = buildYazanDailyBrief({
      goals: ['fat_loss'],
      waterMl: 200,
      waterGoalMl: 2500,
      mealCount: 0,
      energyKcal: null,
      sessionsCompleted: 0,
      sessionsPlanned: 4,
      nutritionPhase: 'cutting',
      nutritionPace: 'sprint',
      waterDaysLogged14: 10,
      mealDaysLogged14: 10,
      weightTrendGrams: null,
    });
    expect(water.focus).toBe('water');
    expect(water.messageAr).toContain('يزن');

    const meals = buildYazanDailyBrief({
      goals: ['muscle_gain'],
      waterMl: 2000,
      waterGoalMl: 2500,
      mealCount: 0,
      energyKcal: null,
      sessionsCompleted: 1,
      sessionsPlanned: 4,
      nutritionPhase: 'gain',
      nutritionPace: 'steady',
      waterDaysLogged14: 12,
      mealDaysLogged14: 5,
      weightTrendGrams: null,
    });
    expect(meals.focus).toBe('meals');

    const stable = buildYazanDailyBrief({
      goals: ['general_health'],
      waterMl: 2500,
      waterGoalMl: 2500,
      mealCount: 3,
      energyKcal: 2100,
      sessionsCompleted: 4,
      sessionsPlanned: 4,
      nutritionPhase: 'fitness',
      nutritionPace: 'gentle',
      waterDaysLogged14: 13,
      mealDaysLogged14: 13,
      weightTrendGrams: 0,
    });
    expect(stable.focus).toBe('stable');
    expect(stable.priority).toBe('hold');
  });

  it('builds a weekly human-coach file from survey + logs', () => {
    const packet = buildWeeklyHumanCoachPacket({
      weekOf: '2026-06-09',
      goals: ['fat_loss'],
      mealDaysLogged: 6,
      waterDaysLogged: 4,
      sessionsCompleted: 3,
      energyKcalTotal: 14_000,
      weightStartGrams: 90_000,
      weightEndGrams: 89_200,
      nutritionPhase: 'cutting',
      nutritionPace: 'sprint',
      survey: { energy: 3, sleep: 4, stress: 2, hunger: 4, notes: 'التعب بعد العصر' },
    });
    expect(packet.escalateToHuman).toBe(true);
    expect(packet.briefAr).toContain('مدرب بشري');
    expect(packet.briefAr).toContain('التعب بعد العصر');
    expect(packet.briefEn).toContain('Weekly human-coach file');
  });
});
