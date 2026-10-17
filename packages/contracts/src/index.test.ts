import { describe, expect, it } from 'vitest';
import { commissionQuoteRequestSchema, memberStateResponseSchema, onboardingRequestSchema } from './index.js';

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
      sex: 'male',
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

  it('accepts a MemberState wire shape (schemaVersion 2)', () => {
    const parsed = memberStateResponseSchema.safeParse({
      authorized: true,
      state: {
        schemaVersion: 2,
        asOfDay: '2026-06-14',
        timeZone: 'Asia/Riyadh',
        goals: ['fat_loss'],
        currentProgramId: null,
        nutritionPhase: 'cutting',
        adherence: {
          windowDays: 14,
          mealDaysLogged: 1,
          waterDaysLogged: 1,
          sessionsCompleted: 0,
          supplementDaysLogged: 0,
          activityDaysLogged: 0,
          confirmedNonAdherence: false,
        },
        confidence: 'insufficient',
        dataCompletenessBps: 700,
        policyNotes: ['nutrition_adaptations_propose_only'],
        sleepLoggingAvailable: false,
      },
    });
    expect(parsed.success).toBe(true);
  });
});
