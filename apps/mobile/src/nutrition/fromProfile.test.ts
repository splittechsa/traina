import { describe, expect, it } from 'vitest';
import { targetsFromOnboarding } from './fromProfile';

describe('targetsFromOnboarding (P0-SAFE-01)', () => {
  it('uses free soft estimates and does not throw on pace/horizon', () => {
    const t = targetsFromOnboarding({
      sex: 'male',
      ageYears: 28,
      heightCm: 175,
      weightKg: 85,
      activityLevel: 'moderate',
      goals: ['fat_loss'],
      nutritionPace: 'sprint',
      horizonWeeks: 3,
    });
    // Soft free cut — not the quarantined 1100 sprint absolute deficit.
    expect(t.maintenanceKcal - t.energyKcal).toBeLessThan(600);
    expect(t.energyKcal).toBeGreaterThan(1_500);
  });
});
