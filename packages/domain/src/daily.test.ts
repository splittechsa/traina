import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  ACTIVITY_KINDS,
  MEAL_SLOTS,
  assertActivityDuration,
  assertDiaryCopy,
  assertMeasurementMm,
  assertSupplementName,
  assertWaterServing,
  coachingDirectives,
  isActivityKind,
  isIsoDay,
  isMealSlot,
  mealSlotEnergyKcal,
  previousCalendarDay,
  waterMillilitersTotal,
} from './daily.js';

describe('daily logs', () => {
  it('sums logged water without inventing a remaining target', () => {
    expect(waterMillilitersTotal([{ milliliters: 250 }, { milliliters: 500 }])).toBe(750);
    expect(ACTIVITY_KINDS.length).toBeGreaterThanOrEqual(8);
    expect(isActivityKind('boxing')).toBe(true);
    expect(isActivityKind('prime')).toBe(false);
    expect(MEAL_SLOTS).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(isMealSlot('lunch')).toBe(true);
    expect(isMealSlot('prime')).toBe(false);
    expect(
      mealSlotEnergyKcal(
        [
          { mealSlot: 'breakfast', energyKcal: 320 },
          { mealSlot: 'lunch', energyKcal: 500 },
          { mealSlot: null, energyKcal: 80 },
        ],
        'breakfast',
      ),
    ).toBe(320);
  });

  it('accepts tape measurements in millimeters without inventing missing sites', () => {
    expect(() => assertMeasurementMm(null)).not.toThrow();
    expect(() => assertMeasurementMm(820)).not.toThrow();
    expect(() => assertMeasurementMm(10)).toThrow(DomainError);
  });

  it('rejects invented or out-of-range servings', () => {
    expect(() => assertWaterServing(10)).toThrow(DomainError);
    expect(() => assertActivityDuration(10)).toThrow(DomainError);
    expect(() => assertActivityDuration(30 * 60)).not.toThrow();
    expect(assertSupplementName('  كرياتين  ')).toBe('كرياتين');
    expect(() => assertSupplementName('x')).toThrow(DomainError);
  });

  it('copies a diary onto a different real calendar day only', () => {
    expect(isIsoDay('2026-06-01')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(previousCalendarDay('2026-06-01')).toBe('2026-05-31');
    expect(previousCalendarDay('2024-03-01')).toBe('2024-02-29');
    expect(() => previousCalendarDay('nope')).toThrow(DomainError);
    expect(() => assertDiaryCopy('2026-06-01', '2026-06-01')).toThrow(DomainError);
    expect(() => assertDiaryCopy('2026-06-01', '2026-06-02')).not.toThrow();
  });

  it('coaches from logged facts and will not invent sodium or extra supplements', () => {
    const behind = coachingDirectives({
      waterMl: 400,
      waterGoalMl: 2500,
      mealCount: 0,
      sessionsCompleted: 0,
      sessionsPlanned: 4,
      todaySessionStatus: 'scheduled',
      supplementsDue: ['كرياتين', 'Omega'],
      supplementsLogged: ['كرياتين'],
    });
    expect(behind.map((item) => item.key)).toEqual(['water_low', 'meals_empty', 'sessions_behind', 'supplement_due']);
    expect(behind.find((item) => item.key === 'supplement_due')?.name).toBe('Omega');
    expect(JSON.stringify(behind).toLowerCase()).not.toContain('sodium');
    expect(JSON.stringify(behind).toLowerCase()).not.toContain('صوديوم');

    const streak = coachingDirectives({
      waterMl: 2500,
      waterGoalMl: 2500,
      mealCount: 2,
      sessionsCompleted: 4,
      sessionsPlanned: 4,
      todaySessionStatus: 'completed',
      supplementsDue: [],
      supplementsLogged: [],
      waterDaysLoggedLast14: 4,
      nutritionPlanAlert: true,
    });
    expect(streak.map((item) => item.key)).toEqual(['water_streak_missed', 'plan_needs_review']);

    const held = coachingDirectives({
      waterMl: 2500,
      waterGoalMl: 2500,
      mealCount: 3,
      sessionsCompleted: 4,
      sessionsPlanned: 4,
      todaySessionStatus: 'completed',
      supplementsDue: ['كرياتين'],
      supplementsLogged: ['كرياتين'],
      waterDaysLoggedLast14: 12,
      nutritionPlanAlert: false,
    });
    expect(held).toEqual([{ key: 'day_held', status: 'ok', href: 'home', name: null }]);
  });
});
