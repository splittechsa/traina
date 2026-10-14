import { describe, expect, it } from 'vitest';
import { assembleHomeDashboard, greetingFor, hourInTimeZone } from './home.js';

describe('home dashboard', () => {
  it('uses the Riyadh civil hour for the greeting', () => {
    expect(hourInTimeZone('2026-01-15T09:30:00.000Z', 'Asia/Riyadh')).toBe(12);
    expect(greetingFor('ar', 9, 'أحمد')).toBe('صباح الخير، أحمد');
    expect(greetingFor('ar', 18, null)).toBe('مساء الخير');
  });

  it('leaves missing sections unavailable instead of inventing zeros', () => {
    const dashboard = assembleHomeDashboard({
      asOf: '2026-01-15T09:30:00.000Z',
      locale: 'ar',
      displayName: null,
      goal: null,
      phase: null,
      adherence: null,
      today: null,
      nutrition: null,
      gymName: null,
      approvedRuleFlags: null,
    });
    expect(dashboard.greeting).toBe('مساء الخير');
    expect(dashboard.todayWorkout.status).toBe('unavailable');
    expect(dashboard.nutrition.status).toBe('unavailable');
    expect(dashboard.coachingInsight).toEqual({
      status: 'unavailable',
      reason: 'model_provider_not_configured',
    });
  });

  it('reports adherence only from supplied counts', () => {
    const dashboard = assembleHomeDashboard({
      asOf: '2026-06-01T06:00:00.000Z',
      locale: 'en',
      displayName: 'Nora',
      goal: 'strength',
      phase: null,
      adherence: { completed: 3, planned: 4 },
      today: null,
      nutrition: null,
      gymName: 'Al Nakheel Gym',
      approvedRuleFlags: ['adherence_met'],
    });
    expect(dashboard.adherence).toMatchObject({ status: 'ready', data: { ratioBps: 7_500 } });
    expect(dashboard.coachingInsight).toMatchObject({
      status: 'ready',
      data: { source: 'approved_rules', flags: ['adherence_met'] },
    });
  });
});
