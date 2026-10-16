import { describe, expect, it } from 'vitest';
import { activityFromSteps, estimateTargets, mifflinStJeor, validateTargetInput, type TargetInput } from './targets';

const base: TargetInput = { sex: 'male', ageYears: 28, heightCm: 172, weightKg: 75, activity: 'moderate', goal: 'maintain' };

describe('mifflinStJeor', () => {
  it('matches the published equation', () => {
    expect(mifflinStJeor(base)).toBe(1690); // 10·75 + 6.25·172 − 5·28 + 5
    expect(mifflinStJeor({ sex: 'female', ageYears: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25);
  });
});

describe('estimateTargets', () => {
  it('computes maintenance targets and macros that add back up to the energy', () => {
    const t = estimateTargets(base, new Date('2026-10-14T00:00:00Z'));
    expect(t.maintenanceKcal).toBe(2620);
    expect(t.energyKcal).toBe(2620);
    expect(t.proteinG).toBe(120);
    expect(t.fatG).toBe(73);
    expect(t.carbsG).toBe(371);
    expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.energyKcal)).toBeLessThanOrEqual(4);
    expect(t.floored).toBe(false);
  });

  it('applies the goal adjustment', () => {
    const lose = estimateTargets({ ...base, sex: 'female', ageYears: 30, heightCm: 165, weightKg: 60, activity: 'sedentary', goal: 'lose' });
    expect(lose.energyKcal).toBe(1270);
    expect(lose.proteinG).toBe(120); // 2.0 g/kg while cutting
    const gain = estimateTargets({ ...base, goal: 'gain' });
    expect(gain.energyKcal).toBe(2880);
  });

  it('never goes below the safety floor', () => {
    const t = estimateTargets({ sex: 'female', ageYears: 60, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'lose' });
    expect(t.energyKcal).toBe(1200);
    expect(t.floored).toBe(true);
  });

  it('rejects out-of-range input', () => {
    expect(validateTargetInput({ ...base, ageYears: 15 })).toEqual(['ageYears']);
    expect(() => estimateTargets({ ...base, heightCm: 300 })).toThrow('INVALID_TARGET_INPUT');
  });
});

describe('activityFromSteps', () => {
  it('needs at least three days of data', () => {
    expect(activityFromSteps([])).toBeNull();
    expect(activityFromSteps([9000, 9000])).toBeNull();
  });

  it('maps average daily steps to a level', () => {
    expect(activityFromSteps([3000, 4000, 4500])).toBe('sedentary');
    expect(activityFromSteps([8000, 9000, 9500])).toBe('moderate');
    expect(activityFromSteps([13000, 14000, 15000])).toBe('athlete');
  });
});
