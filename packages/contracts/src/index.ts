import { z } from 'zod';

const shortList = z.array(z.string().max(80)).max(40);

export const onboardingRequestSchema = z
  .object({
    ageYears: z.number().int(),
    heightCm: z.string().max(8),
    weightKg: z.string().max(8),
    sex: z.enum(['male', 'female']),
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
    nutritionPace: z.enum(['sprint', 'steady', 'gentle']).optional(),
    horizonWeeks: z.number().int().min(1).max(52).nullable().optional(),
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

export const activateProgramSchema = z
  .object({
    templateId: z.string().min(1).max(40),
  })
  .strict();

export const startProgramDaySchema = z
  .object({
    dayIndex: z.number().int().min(0).max(13),
    startNow: z.boolean().optional(),
  })
  .strict();

export const customizeProgramSchema = z
  .object({
    expectedVersion: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(80).optional(),
    days: z
      .array(
        z
          .object({
            name_ar: z.string().trim().min(1).max(80),
            name_en: z.string().trim().min(1).max(80),
            exerciseIds: z.array(z.string().uuid()).min(1).max(20),
            strengthOverrides: z.record(z.string().uuid(), z.object({
              sets: z.number().int().min(1).max(20),
              reps: z.number().int().min(1).max(100),
              restSeconds: z.number().int().min(0).max(1800),
            }).strict()).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(14),
  })
  .strict();

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
    startNow: z.boolean().optional(),
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

export const customMealIngredientSchema = z
  .object({
    foodItemId: z.string().uuid(),
    quantityGrams: z.number().int().min(1).max(2000),
  })
  .strict();

export const customMealSchema = z
  .object({
    nameAr: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    servings: z.number().int().min(1).max(20).default(1),
    ingredients: z.array(customMealIngredientSchema).min(1).max(30),
  })
  .strict();

export const foodPortionSchema = z
  .object({
    foodItemId: z.string().uuid(),
    quantityGrams: z.number().int().min(1).max(2000),
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
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
    mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    /** Member-visible name for ready meals / custom logs. */
    label: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const copyDiarySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const programNutritionSchema = z
  .object({
    phase: z.enum(['cutting', 'maintain', 'gain', 'fitness']),
    maintenanceKcal: z.number().int().min(1000).max(8000),
    pace: z.enum(['sprint', 'steady', 'gentle']).optional(),
    horizonWeeks: z.number().int().min(1).max(52).nullable().optional(),
    weeklyEnergyDeltaKcal: z.number().int().min(-1000).max(1000).optional(),
  })
  .strict();

export const mealPlanSlotSchema = z
  .object({
    slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    templateId: z.string().min(1).max(80).optional(),
    custom: z
      .object({
        label: z.string().trim().min(2).max(80),
        energyKcal: z.number().int().nonnegative().max(2500),
        proteinMg: z.number().int().nonnegative(),
        carbohydrateMg: z.number().int().nonnegative(),
        fatMg: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => (value.templateId !== undefined) !== (value.custom !== undefined), {
    message: 'Provide either templateId or custom macros',
  });

export const mealPlanDaySchema = z
  .object({
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetKcal: z.number().int().min(1200).max(6000),
    slots: z.array(mealPlanSlotSchema).max(4),
  })
  .strict();

export const weightSchema = z
  .object({
    weightKg: z.string().max(8),
    recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const waterLogSchema = z
  .object({
    milliliters: z.number().int().min(50).max(2000),
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const supplementNameSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export const supplementLogSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const activityLogSchema = z
  .object({
    kind: z.string().min(1).max(40),
    durationSeconds: z.number().int().min(60).max(28800),
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const bodyMeasurementSchema = z
  .object({
    recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    waistMm: z.number().int().min(200).max(2500).nullable().optional(),
    chestMm: z.number().int().min(200).max(2500).nullable().optional(),
    hipMm: z.number().int().min(200).max(2500).nullable().optional(),
    armMm: z.number().int().min(200).max(2500).nullable().optional(),
    thighMm: z.number().int().min(200).max(2500).nullable().optional(),
    neckMm: z.number().int().min(200).max(2500).nullable().optional(),
  })
  .strict();

export const profilePatchSchema = z.object({ displayName: z.string().min(1).max(80) }).strict();

/** Query for GET /v1/member/state — server projects MemberState; client never invents it. */
export const memberStateQuerySchema = z
  .object({
    windowDays: z.coerce.number().int().min(1).max(90).optional(),
    timeZone: z.string().min(1).max(64).optional(),
    asOfDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export const memberStateResponseSchema = z
  .object({
    authorized: z.literal(true),
    state: z
      .object({
        schemaVersion: z.literal(2),
        asOfDay: z.string(),
        timeZone: z.string(),
        goals: z.array(z.string()),
        currentProgramId: z.string().nullable(),
        nutritionPhase: z.string().nullable(),
        adherence: z
          .object({
            windowDays: z.number().int(),
            mealDaysLogged: z.number().int(),
            waterDaysLogged: z.number().int(),
            sessionsCompleted: z.number().int(),
            supplementDaysLogged: z.number().int(),
            activityDaysLogged: z.number().int(),
            confirmedNonAdherence: z.literal(false),
          })
          .strict(),
        confidence: z.enum(['high', 'medium', 'low', 'insufficient']),
        dataCompletenessBps: z.number().int(),
        policyNotes: z.array(z.string()),
        sleepLoggingAvailable: z.literal(false),
      })
      .passthrough(),
  })
  .strict();

export const coachMessageSchema = z.object({ message: z.string().min(1).max(2000) }).strict();

export const weeklyCoachSurveySchema = z
  .object({
    weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    energy: z.number().int().min(1).max(5),
    sleep: z.number().int().min(1).max(5),
    stress: z.number().int().min(1).max(5),
    hunger: z.number().int().min(1).max(5),
    /** Perceived training effort this week. */
    effort: z.number().int().min(1).max(5).optional(),
    /** Recovery quality (distinct from nightly sleep score). */
    recovery: z.number().int().min(1).max(5).optional(),
    /** How satisfied the member is with the week. */
    satisfaction: z.number().int().min(1).max(5).optional(),
    difficulties: z.string().max(500).optional().default(''),
    questionForCoach: z.string().max(500).optional().default(''),
    notes: z.string().max(500).optional().default(''),
  })
  .strict();

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

export const coachAssignmentSchema = z
  .object({
    coachUserId: z.string().uuid(),
    memberUserId: z.string().uuid(),
    reason: z.string().max(500).optional().default(''),
  })
  .strict();

export const coachFeedbackSchema = z.object({ body: z.string().trim().min(1).max(8000) }).strict();

export const coachRecommendationDecisionSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().max(500).optional().default(''),
  })
  .strict();

export const weeklyReviewPrepareSchema = z
  .object({
    memberUserId: z.string().uuid(),
    weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const simulateSchema = z
  .object({
    asOf: z.string().min(10),
    facts: z.record(z.union([z.string(), z.number(), z.boolean()])),
  })
  .strict();


export const programActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('duplicate'), expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal('rename'), expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal('restore'), expectedVersion: z.number().int().positive(), version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('activate'), expectedVersion: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('archive'), expectedVersion: z.number().int().positive() }).strict(),
]);
export const programHistoryQuerySchema = z.object({ before: z.coerce.number().int().positive().optional() }).strict();
