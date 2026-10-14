import { z } from 'zod';

const shortList = z.array(z.string().max(80)).max(40);

export const onboardingRequestSchema = z
  .object({
    ageYears: z.number().int(),
    heightCm: z.string().max(8),
    weightKg: z.string().max(8),
    trainingExperience: z.string().max(40),
    goals: z.array(z.string()).min(1).max(3),
    discipline: z.string().max(40),
    sessionsPerWeek: z.number().int(),
    environment: z.string().max(40),
    equipment: shortList,
    activityLevel: z.string().max(40),
    dietaryPreferences: shortList,
    allergies: shortList,
    supplements: shortList,
    injuries: shortList,
    preferredWorkoutTimes: shortList,
    hasGymMembership: z.boolean(),
    gymReferralCode: z.string().max(64).optional(),
    locale: z.enum(['ar', 'en']),
    userReportedCalorieTarget: z.number().int().nonnegative().optional(),
    measurementUnits: z.enum(['metric', 'imperial']).optional(),
    sports: z.array(z.string().max(40)).max(7).optional(),
  })
  .strict();

export const foodEntrySchema = z
  .object({
    id: z.string().min(1).max(80),
    energyKcal: z.number().int().nonnegative(),
    proteinMg: z.number().int().nonnegative(),
    carbohydrateMg: z.number().int().nonnegative(),
    fatMg: z.number().int().nonnegative(),
    source: z.enum(['manual', 'barcode', 'image_estimate', 'recipe']),
  })
  .strict();

export const diarySummaryRequestSchema = z
  .object({
    entries: z.array(foodEntrySchema).max(200),
  })
  .strict();

const minor = z.number().int().nonnegative();

export const commissionQuoteRequestSchema = z
  .object({
    policy: z
      .object({
        contractId: z.string().min(1),
        policyVersion: z.number().int().positive(),
        model: z.enum(['first_payment_only', 'recurring_revenue']),
        rateBps: z.number().int().min(0).max(10_000),
        commissionBase: z.enum(['gross', 'net_of_store_fee', 'net_of_store_fee_and_tax']),
        currency: z.literal('SAR'),
      })
      .strict(),
    charge: z
      .object({
        paymentEventId: z.string().min(1),
        currency: z.literal('SAR'),
        cashCollectedMinor: minor,
        storeFeeMinor: minor,
        taxMinor: minor,
        isRenewal: z.boolean(),
      })
      .strict(),
    gymOrganizationId: z.string().min(1),
    attributionId: z.string().min(1),
    priorPaymentEventIds: z.array(z.string()).max(500),
    taxPolicy: z
      .object({
        id: z.string().min(1),
        treatment: z.enum(['inclusive', 'exclusive', 'none']),
        rateBps: z.number().int().min(0).max(10_000),
        legalReview: z.enum(['unreviewed', 'reviewed']),
      })
      .strict(),
  })
  .strict();

export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
export type DiarySummaryRequest = z.infer<typeof diarySummaryRequestSchema>;
export type CommissionQuoteRequest = z.infer<typeof commissionQuoteRequestSchema>;

export const registerSchema = z
  .object({
    email: z.string().email().max(200),
    password: z.string().min(1).max(128),
    locale: z.enum(['ar', 'en']),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email().max(200),
    password: z.string().min(1).max(128),
  })
  .strict();

export const tokenSchema = z.object({ token: z.string().min(20).max(200) }).strict();

export const verifySchema = z.union([
  z.object({ email: z.string().email().max(200), code: z.string().regex(/^\d{6}$/) }).strict(),
  z.object({ token: z.string().min(20).max(200) }).strict(),
]);

export const resendSchema = z.object({ email: z.string().email().max(200) }).strict();

export const refreshSchema = z.object({ refreshToken: z.string().min(10).max(200) }).strict();

export const resetSchema = z.union([
  z
    .object({
      email: z.string().email().max(200),
      code: z.string().regex(/^\d{6}$/),
      password: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      token: z.string().min(20).max(200),
      password: z.string().min(1).max(128),
    })
    .strict(),
]);

export const recoverSchema = z.object({ email: z.string().email().max(200) }).strict();

const strengthPrescription = z
  .object({
    kind: z.literal('strength'),
    sets: z.number().int().positive(),
    reps: z.number().int().nonnegative(),
    restSeconds: z.number().int().nonnegative(),
    loadGrams: z.number().int().nonnegative().nullable(),
    rpeTenths: z.number().int().min(0).max(100).nullable(),
  })
  .strict();

const crossfitPrescription = z
  .object({
    kind: z.literal('crossfit'),
    format: z.enum(['amrap', 'emom', 'for_time']),
    timeCapSeconds: z.number().int().nonnegative().nullable(),
    rounds: z.number().int().nonnegative().nullable(),
  })
  .strict();

const calisthenicsPrescription = z
  .object({
    kind: z.literal('calisthenics'),
    progression: z.string().min(1).max(80),
    targetReps: z.number().int().nonnegative().nullable(),
    holdSeconds: z.number().int().nonnegative().nullable(),
  })
  .strict();

const sessionPrescription = z.union([strengthPrescription, crossfitPrescription, calisthenicsPrescription]);

export const scheduleSessionSchema = z
  .object({
    name: z.string().min(1).max(80),
    discipline: z.string().min(1).max(40),
    scheduledFor: z.string().min(10),
    exercises: z
      .array(
        z
          .object({
            exerciseId: z.string().uuid(),
            prescription: sessionPrescription,
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export const sessionTimeSchema = z.object({ at: z.string().min(10) }).strict();

export const logSetSchema = z
  .object({
    id: z.string().uuid(),
    exerciseId: z.string().uuid(),
    setIndex: z.number().int().positive(),
    reps: z.number().int().nonnegative(),
    loadGrams: z.number().int().nonnegative(),
    rpeTenths: z.number().int().min(0).max(100).nullable(),
    completedAt: z.string().min(10),
  })
  .strict();

export const customFoodSchema = z
  .object({
    nameAr: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    energyKcal: z.number().int().nonnegative(),
    proteinMg: z.number().int().nonnegative(),
    carbohydrateMg: z.number().int().nonnegative(),
    fatMg: z.number().int().nonnegative(),
  })
  .strict();

export const foodPortionSchema = z
  .object({
    foodItemId: z.string().uuid(),
    quantityGrams: z.number().int().min(1).max(2000),
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const foodLogSchema = z
  .object({
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    energyKcal: z.number().int().nonnegative(),
    proteinMg: z.number().int().nonnegative(),
    carbohydrateMg: z.number().int().nonnegative(),
    fatMg: z.number().int().nonnegative(),
    source: z.enum(['manual', 'barcode', 'image_estimate', 'recipe']),
  })
  .strict();

export const weightSchema = z
  .object({
    weightKg: z.string().max(8),
    recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const profilePatchSchema = z.object({ displayName: z.string().min(1).max(80) }).strict();

export const coachMessageSchema = z.object({ message: z.string().min(1).max(2000) }).strict();

export const communityPostSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
    visibility: z.enum(['private', 'members']),
  })
  .strict();

export const communityCommentSchema = z.object({ body: z.string().trim().min(1).max(1000) }).strict();

export const customExerciseSchema = z
  .object({
    nameAr: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    primaryMuscles: z.array(z.string().trim().min(1).max(40)).min(1).max(4),
    equipment: z.array(z.string().trim().min(1).max(40)).max(4),
  })
  .strict();

export const referralSchema = z.object({ code: z.string().min(1).max(64) }).strict();

export const coachingRuleSchema = z
  .object({
    ruleKey: z.string().min(1).max(80),
    priority: z.number().int().nonnegative(),
    effectiveFrom: z.string().min(10),
    conditions: z.object({ type: z.literal('fact'), fact: z.string(), op: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }).strict(),
    actions: z.array(z.object({ type: z.literal('set_flag'), flag: z.string().min(1).max(80) }).strict()).min(1),
    safetyBlocks: z.array(z.string()).max(20),
  })
  .strict();

export const ruleDecisionSchema = z.object({ decision: z.enum(['approved', 'rejected']) }).strict();

export const simulateSchema = z
  .object({
    asOf: z.string().min(10),
    facts: z.record(z.union([z.string(), z.number(), z.boolean()])),
  })
  .strict();

