import { describe, expect, it } from 'vitest';
import { yazanTip } from './yazanPresence';

describe('yazanTip', () => {
  it('nudges resume on home when a session is open', () => {
    const tip = yazanTip('en', {
      surface: 'home',
      hasResume: true,
      hasTodayWorkout: false,
      mealLogged: true,
      weekCompleted: 0,
      weekPlanned: 3,
      completedWorkouts: 1,
    });
    expect(tip.toLowerCase()).toContain('open session');
  });

  it('guides training when there is no active plan', () => {
    const tip = yazanTip('ar', {
      surface: 'training',
      hasActivePlan: false,
      hasResume: false,
      todayCount: 0,
    });
    expect(tip).toContain('خطة');
  });

  it('mentions the active exercise on workout', () => {
    const tip = yazanTip('en', {
      surface: 'workout',
      exerciseName: 'Barbell squat',
      setCount: 0,
    });
    expect(tip).toContain('Barbell squat');
  });
});
