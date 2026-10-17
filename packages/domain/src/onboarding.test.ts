import { describe, expect, it } from 'vitest';
import { assertNoAuthoritativeCalories, bmiHundredths, disciplineForSports, goalsForSports, validateOnboarding, type OnboardingInput } from './onboarding.js';

function input(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    ageYears: 28,
    heightCm: '170.5',
    weightKg: '70.25',
    sex: 'male',
    trainingExperience: 'intermediate',
    goals: ['strength'],
    discipline: 'powerlifting',
    sessionsPerWeek: 4,
    environment: 'gym',
    equipment: ['barbell', 'rack'],
    activityLevel: 'moderate',
    dietaryPreferences: ['halal'],
    allergies: [],
    supplements: [],
    injuries: [],
    preferredWorkoutTimes: ['evening'],
    hasGymMembership: true,
    locale: 'ar',
    ...overrides,
  };
}

describe('onboarding', () => {
  it('stores measurements as integers and never authorizes a calorie target', () => {
    const result = validateOnboarding(input({ userReportedCalorieTarget: 1200 }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok');
    }
    expect(result.record.heightMm).toBe(1_705);
    expect(result.record.weightGrams).toBe(70_250);
    expect(result.record.authoritativeCalorieTarget).toBeNull();
    expect(result.record.riskFlags).toContain('self_reported_calorie_target_ignored');
    expect(result.record.requiresReview).toBe(true);
    expect(() => assertNoAuthoritativeCalories(result.record)).not.toThrow();
  });

  it('rejects children under 13 and flags ages 13 through 17 for review', () => {
    expect(validateOnboarding(input({ ageYears: 12 })).ok).toBe(false);
    const teen = validateOnboarding(input({ ageYears: 16 }));
    expect(teen.ok).toBe(true);
    if (teen.ok) {
      expect(teen.record.riskFlags).toContain('minor_requires_review');
    }
  });

  it('flags reported injuries without treating them as a diagnosis', () => {
    const result = validateOnboarding(input({ injuries: ['knee pain while squatting'] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.riskFlags).toContain('injury_reported');
      expect(result.record.requiresReview).toBe(true);
    }
  });

  it('keeps sport and goal separate and stores several sports as hybrid', () => {
    expect(disciplineForSports(['bodybuilding'])).toBe('bodybuilding');
    expect(disciplineForSports(['running'])).toBe('functional_training');
    expect(disciplineForSports(['bodybuilding', 'boxing'])).toBe('hybrid');
    expect(goalsForSports(['bodybuilding'])).toContain('bulking');
    expect(goalsForSports(['bodybuilding'])).not.toContain('endurance');
    const saved = validateOnboarding(input({ sports: ['running', 'boxing'], discipline: 'hybrid', goals: ['endurance'] }));
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.record.sports).toEqual(['running', 'boxing']);
    }
  });
  it('computes BMI hundredths for a known height and weight', () => {
    expect(bmiHundredths(70_000, 1_700)).toBe(2_422);
  });
});
