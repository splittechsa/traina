import { describe, expect, it } from 'vitest';
import { commissionQuoteRequestSchema, onboardingRequestSchema } from './index.js';

describe('wire contracts', () => {
  it('rejects a client-supplied commission amount', () => {
    const parsed = commissionQuoteRequestSchema.safeParse({
      policy: {
        contractId: 'c1',
        policyVersion: 1,
        model: 'recurring_revenue',
        rateBps: 1000,
        commissionBase: 'gross',
        currency: 'SAR',
      },
      charge: {
        paymentEventId: 'p1',
        currency: 'SAR',
        cashCollectedMinor: 1000,
        storeFeeMinor: 0,
        taxMinor: 0,
        isRenewal: false,
        commissionMinor: 999,
      },
      gymOrganizationId: 'g1',
      attributionId: 'a1',
      priorPaymentEventIds: [],
      taxPolicy: { id: 'tax', treatment: 'none', rateBps: 0, legalReview: 'unreviewed' },
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a typed onboarding payload', () => {
    const parsed = onboardingRequestSchema.safeParse({
      ageYears: 30,
      heightCm: '170',
      weightKg: '70',
      trainingExperience: 'beginner',
      goals: ['general_health'],
      discipline: 'general_fitness',
      sessionsPerWeek: 3,
      environment: 'home',
      equipment: [],
      activityLevel: 'light',
      dietaryPreferences: [],
      allergies: [],
      supplements: [],
      injuries: [],
      preferredWorkoutTimes: [],
      hasGymMembership: false,
      locale: 'ar',
    });
    expect(parsed.success).toBe(true);
  });
});
