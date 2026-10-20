import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  activateProgramSchema,
  coachMessageSchema,
  weeklyCoachSurveySchema,
  coachingRuleSchema,
  communityCommentSchema,
  communityPostSchema,
  customExerciseSchema,
  copyDiarySchema,
  customFoodSchema,
  customMealSchema,
  foodLogSchema,
  foodPortionSchema,
  programNutritionSchema,
  mealPlanDaySchema,
  loginSchema,
  logSetSchema,
  replaceSetSchema,
  onboardingRequestSchema,
  profilePatchSchema,
  recoverSchema,
  referralSchema,
  refreshSchema,
  registerSchema,
  resendSchema,
  resetSchema,
  ruleDecisionSchema,
  scheduleSessionSchema,
  sessionTimeSchema,
  simulateSchema,
  startProgramDaySchema,
  customizeProgramSchema,
  programActionSchema,
  programHistoryQuerySchema,
  verifySchema,
  weightSchema,
  waterLogSchema,
  supplementNameSchema,
  supplementLogSchema,
  activityLogSchema,
  bodyMeasurementSchema,
} from '@sahhti/contracts';
import type { CoachingRuleVersion, OnboardingInput } from '@sahhti/domain';
import type { Database } from '../db/database.js';
import { ApiError } from '../identity/accounts.js';
import { emailProvider } from '../identity/mail.js';
import { createThrottle } from '../identity/throttle.js';
import {
  deleteAccount,
  loginAccount,
  logoutSession,
  refreshSession,
  registerAccount,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  resetPasswordWithCode,
  startSession,
  verifyEmail,
  verifyEmailCode,
  latestDevCode,
} from '../identity/accounts.js';
import {
  activateMemberProgram,
  customizeMemberProgram,
  memberProgramHistory,
  memberProgramDetail,
  manageMemberProgram,
  exerciseSubstitutionsFor,
  answerCoach,
  attributeReferral,
  blockMember,
  commentOnPost,
  createCommunityPost,
  copyDiaryDay,
  createCustomFood,
  createCustomMeal,
  listCustomMeals,
  updateCustomMeal,
  createDraftRule,
  createMemberExercise,
  decideRule,
  deleteFoodEntry,
  deleteOwnCommunityPost,
  diaryFor,
  diaryRangeFor,
  favoriteFood,
  findExerciseByScanCode,
  followMember,
  getSession,
  abandonOpenWorkouts,
  homeFor,
  listCoachMessages,
  listMemberPrograms,
  listComments,
  listCommunityFeed,
  listEquipmentManufacturers,
  listExercises,
  listFavoriteFoods,
  listReadyMeals,
  listSessions,
  mealPlanFor,
  memberStateFor,
  generateMemberRecommendations,
  listMemberRecommendations,
  advanceMemberRecommendation,
  previewTrainingRecommendationApply,
  assignCoachToMember,
  revokeCoachAssignment,
  listCoachAssignmentsForActor,
  grantCoachShareConsent,
  withdrawCoachShareConsent,
  coachShareConsentFor,
  prepareWeeklyReviewForMember,
  listWeeklyReviewsForCoach,
  claimWeeklyReview,
  escalateWeeklyReview,
  readWeeklyReviewPacket,
  sendCoachFeedback,
  listMemberCoachFeedback,
  listMemberNotifications,
  entitlementsFor,
  exportMemberAccount,
  registerPushDevice,
  markMemberNotificationRead,
  addCoachNote,
  listCoachNotes,
  coachWorkloadMetrics,
  coachDecideRecommendation,
  markOverdueWeeklyReviews,
  memberWeeklyHumanReviewStatus,
  previewWeeklySharePacket,
  addCoachFollowUp,
  listCoachFollowUps,
  nutritionDisciplineFor,
  ensureDailyYazanCheckin,
  latestWeeklyCoachBrief,
  proposeProgramNutritionStep,
  saveMealPlanDay,
  setProgramNutrition,
  submitWeeklyCoachBrief,
  logFood,
  logFoodPortion,
  mutateSession,
  progressFor,
  publishRule,
  readGym,
  readProfile,
  recordWeight,
  listSupplements,
  addMemberSupplement,
  logSupplement,
  unlogSupplement,
  logWater,
  waterFor,
  logActivity,
  activitiesFor,
  logBodyMeasurements,
  measurementsFor,
  rollbackRule,
  searchFoods,
  saveOnboarding,
  scheduleMemberWorkout,
  setDisplayName,
  simulateRules,
  startProgramDay,
  submitRule,
  toggleSupport,
  updateOwnCommunityPost,
} from '../member/store.js';
import { coachRuntimeFromEnv, type CoachRuntime } from '../coach/provider.js';
import type { DevClaims } from '../auth.js';

export type ProductOptions = {
  database: Database | null;
  tokenSecret: string | null;
  coachProvider: 'development_mock' | 'unconfigured';
  coach?: CoachRuntime;
  fetchImpl?: typeof fetch;
  exposeDevTokens?: boolean;
};

function coachOf(options: ProductOptions): CoachRuntime {
  if (options.coach !== undefined) {
    return options.coach;
  }
  if (options.coachProvider === 'development_mock') {
    return { name: 'development_mock' };
  }
  return coachRuntimeFromEnv({});
}



const loginThrottle = createThrottle(8, 15 * 60 * 1000);
const registerThrottle = createThrottle(5, 60 * 60 * 1000);
const resendThrottle = createThrottle(5, 15 * 60 * 1000);
const recoverThrottle = createThrottle(5, 15 * 60 * 1000);

function clientKey(request: { ip: string }, email?: string): string {
  return `${request.ip}:${email ?? ''}`;
}

function dbOf(options: ProductOptions): Database {
  if (options.database === null) {
    throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'PostgreSQL is not configured');
  }
  return options.database;
}

function actorOf(claims: DevClaims | null) {
  if (claims === null) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in is required');
  }
  return { userId: claims.sub, roles: claims.roles, gymOrganizationIds: claims.gymOrganizationIds };
}

// Fifth attempt. Scoreboard so far: attempt 3 (`S extends ZodTypeAny`, reading T off S via
// Zod's `infer` utility) fixed 65 of 67 call sites — confirmed by the build going from 67
// errors to exactly 2, both on verifySchema/resetSchema, the only two z.union(...) schemas.
// Attempt 4 (switch to the throwing `.parse()` so T infers from a direct, non-union return
// type instead) was a regression — it broke all 67 again, including the 65 that attempt 3
// had already fixed. That regression is the key data point: it means inferring T from ANY
// call-site return type — union or not — is fragile here, while attempt 3's mechanism
// (reading T off the schema's OWN declared type via indexed access, S['_output']) is
// fundamentally sound and got 65/67 right. The only thing that needs fixing is why `S
// extends ZodTypeAny` specifically rejects ZodUnion: that constraint forces TypeScript to
// structurally validate the schema's ENTIRE class shape against ZodType's full member list
// (_type, _parse, _getType, _getOrReturnCtx, and more) before it'll even bind S, and that
// full-shape comparison is what collapses for ZodUnion's recursive tuple generics — it has
// nothing to do with whether T itself can be read off correctly afterwards.
//
// So: keep attempt 3's mechanism, shrink the constraint. Instead of requiring the full
// ZodTypeAny shape, require only the one property this function actually needs evidence
// of — `_output`, the phantom marker every Zod schema (object, union, effects, whatever)
// declares for exactly this purpose — plus a loosely-typed `safeParse` we don't ask
// TypeScript to structurally match against a union return shape at all (we read its result
// through an explicit, local `as` cast instead, which needs no inference and so can't
// collapse the way attempts 2 and 4 did). A single-property structural check can't trip over
// ZodUnion's recursive generics the way comparing a dozen inherited members can.
function parse<S extends { _output: unknown }>(schema: S, body: unknown, reply: FastifyReply): S['_output'] | undefined {
  const result = (schema as unknown as { safeParse: (value: unknown) => unknown }).safeParse(body) as
    | { success: true; data: S['_output'] }
    | { success: false; error: { issues: Array<{ path: unknown[]; code: string }> } };
  if (!result.success) {
    void reply.code(400).send({
      error: {
        code: 'VALIDATION',
        message: 'The request is not valid',
        issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
      },
    });
    return undefined;
  }
  return result.data;
}

export function registerProductRoutes(app: FastifyInstance, options: ProductOptions): void {
  app.post('/v1/auth/register', async (request, reply) => {
    const body = parse(registerSchema, request.body, reply);
    if (body === undefined) return;
    if (!registerThrottle(clientKey(request, body.email), Date.now())) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many registration attempts' } });
    }
    await registerAccount(dbOf(options), body);
    return reply.code(201).send({ accepted: true });
  });

  app.post('/v1/auth/verify', async (request, reply) => {
    const body = parse(verifySchema, request.body, reply);
    if (body === undefined) return;
    const userId = 'code' in body ? await verifyEmailCode(dbOf(options), body.email, body.code) : await verifyEmail(dbOf(options), body.token);
    if (options.tokenSecret === null) {
      return { status: 'active' as const };
    }
    return { status: 'active' as const, ...(await startSession(dbOf(options), options.tokenSecret, userId)) };
  });

  app.post('/v1/auth/verify/resend', async (request, reply) => {
    const body = parse(resendSchema, request.body, reply);
    if (body === undefined) return;
    if (!resendThrottle(clientKey(request, body.email), Date.now())) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many verification requests' } });
    }
    await resendVerification(dbOf(options), body.email);
    return { accepted: true };
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const body = parse(loginSchema, request.body, reply);
    if (body === undefined) return;
    if (options.tokenSecret === null) {
      return reply.code(503).send({
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Sign-in is not configured. Start the API with a database and SAHHTI_TOKEN_SECRET.',
        },
      });
    }
    if (!loginThrottle(clientKey(request, body.email), Date.now())) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts' } });
    }
    return loginAccount(dbOf(options), options.tokenSecret, body);
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    const body = parse(refreshSchema, request.body, reply);
    if (body === undefined) return;
    if (options.tokenSecret === null) {
      return reply.code(503).send({
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Sign-in is not configured. Start the API with a database and SAHHTI_TOKEN_SECRET.',
        },
      });
    }
    return refreshSession(dbOf(options), options.tokenSecret, body.refreshToken);
  });

  app.post('/v1/auth/recover', async (request, reply) => {
    const body = parse(recoverSchema, request.body, reply);
    if (body === undefined) return;
    if (!recoverThrottle(clientKey(request, body.email), Date.now())) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many reset requests' } });
    }
    await requestPasswordReset(dbOf(options), body.email);
    return reply.code(202).send({ accepted: true });
  });

  app.post('/v1/auth/reset', async (request, reply) => {
    const body = parse(resetSchema, request.body, reply);
    if (body === undefined) return;
    if ('code' in body) {
      await resetPasswordWithCode(dbOf(options), body.email, body.code, body.password);
    } else {
      await resetPassword(dbOf(options), body.token, body.password);
    }
    return { reset: true };
  });

  app.get('/v1/dev/mailbox', async (request, reply) => {
    if (options.exposeDevTokens !== true) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    }
    const query = request.query as { email?: string; include?: string };
    const email = query.email ?? '';
    if (!email.includes('@')) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Email is required' } });
    }
    const includeCode = query.include === 'code';
    const latest = includeCode ? await latestDevCode(dbOf(options), email) : null;
    return {
      developmentOnly: true,
      provider: emailProvider(process.env),
      code: latest?.code ?? null,
      purpose: latest?.purpose ?? null,
    };
  });

  app.post('/v1/auth/logout', async (request) => {
    const claims = actorOf(request.claims);
    if (request.claims?.sid === undefined) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session is not active');
    }
    await logoutSession(dbOf(options), request.claims.sid);
    return { loggedOut: true, userId: claims.userId };
  });

  app.delete('/v1/account', async (request) => {
    const actor = actorOf(request.claims);
    await deleteAccount(dbOf(options), actor.userId);
    return { deleted: true };
  });

  app.get('/v1/account/export', async (request) => {
    return exportMemberAccount(dbOf(options), actorOf(request.claims));
  });

  app.post('/v1/member/push-devices', async (request, reply) => {
    const body = request.body as { expoPushToken?: string; platform?: string };
    if (typeof body?.expoPushToken !== 'string' || body.expoPushToken.trim().length < 8) {
      return reply.code(422).send({ error: { code: 'INVALID_PUSH_TOKEN', message: 'expoPushToken is required' } });
    }
    const platform = body.platform === 'android' || body.platform === 'ios' || body.platform === 'web' ? body.platform : 'unknown';
    return registerPushDevice(dbOf(options), actorOf(request.claims).userId, {
      expoPushToken: body.expoPushToken.trim().slice(0, 512),
      platform,
    });
  });

  app.get('/v1/me', async (request) => {
    const actor = actorOf(request.claims);
    const profile = await readProfile(dbOf(options), actor.userId);
    return {
      userId: actor.userId,
      roles: actor.roles,
      onboardingCompleted: profile.profile !== null,
      profile: profile.profile,
      goals: profile.goals,
    };
  });

  app.post('/v1/onboarding', async (request, reply) => {
    const body = parse(onboardingRequestSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    const { measurementUnits, ...domainInput } = body;
    return saveOnboarding(dbOf(options), actor.userId, domainInput as OnboardingInput, measurementUnits ?? 'metric');
  });

  app.patch('/v1/profile', async (request, reply) => {
    const body = parse(profilePatchSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    await setDisplayName(dbOf(options), actor.userId, body.displayName);
    return { persisted: true };
  });

  app.get('/v1/home', async (request) => {
    const actor = actorOf(request.claims);
    const locale = request.headers['accept-language']?.startsWith('en') ? 'en' : 'ar';
    return homeFor(dbOf(options), actor.userId, new Date().toISOString(), locale);
  });

  app.get('/v1/exercises', async (request) => ({
    exercises: await listExercises(dbOf(options), actorOf(request.claims).userId),
  }));

  app.get('/v1/exercises/scan', async (request, reply) => {
    const actor = actorOf(request.claims);
    const code = typeof (request.query as { code?: unknown }).code === 'string' ? (request.query as { code: string }).code : '';
    const exercise = await findExerciseByScanCode(dbOf(options), actor.userId, code);
    if (exercise === null) {
      return reply.code(404).send({ error: { code: 'EXERCISE_CODE_UNKNOWN', message: 'No exercise is linked to this code' } });
    }
    return { exercise };
  });

  app.get('/v1/equipment/manufacturers', async (request) => {
    actorOf(request.claims);
    return { manufacturers: await listEquipmentManufacturers(dbOf(options)) };
  });

  app.post('/v1/exercises', async (request, reply) => {
    const body = parse(customExerciseSchema, request.body, reply);
    if (body === undefined) return;
    return createMemberExercise(dbOf(options), actorOf(request.claims).userId, body);
  });

  app.get('/v1/training/programs', async (request) => (
    listMemberPrograms(dbOf(options), actorOf(request.claims).userId)
  ));

  app.post('/v1/training/programs', async (request, reply) => {
    const body = parse(activateProgramSchema, request.body, reply);
    if (body === undefined) return;
    return {
      persisted: true,
      program: await activateMemberProgram(dbOf(options), actorOf(request.claims).userId, body.templateId),
    };
  });

  app.post('/v1/training/programs/nutrition', async (request, reply) => {
    const body = parse(programNutritionSchema, request.body, reply);
    if (body === undefined) return;
    return {
      persisted: true,
      ...(await setProgramNutrition(dbOf(options), actorOf(request.claims).userId, body)),
    };
  });

  app.get('/v1/training/programs/nutrition/propose', async (request) => (
    proposeProgramNutritionStep(dbOf(options), actorOf(request.claims).userId)
  ));

  app.get('/v1/nutrition/discipline', async (request) => (
    nutritionDisciplineFor(dbOf(options), actorOf(request.claims).userId)
  ));

  app.post('/v1/training/programs/:id/start-day', async (request, reply) => {
    const body = parse(startProgramDaySchema, request.body, reply);
    if (body === undefined) return;
    const locale = request.headers['accept-language']?.startsWith('en') ? 'en' : 'ar';
    const params = request.params as { id: string };
    return {
      persisted: true,
      session: await startProgramDay(dbOf(options), actorOf(request.claims).userId, params.id, {
        dayIndex: body.dayIndex,
        startNow: body.startNow,
        locale,
      }),
    };
  });

  app.get('/v1/training/programs/:id', async request => memberProgramDetail(dbOf(options), actorOf(request.claims).userId, (request.params as { id: string }).id));
  app.get('/v1/training/programs/:id/history', async (request, reply) => {
    const query = parse(programHistoryQuerySchema, request.query, reply);
    if (!query) return;
    return memberProgramHistory(dbOf(options), actorOf(request.claims).userId, (request.params as { id: string }).id, query.before);
  });
  app.post('/v1/training/programs/:id/actions', async (request, reply) => {
    const body = parse(programActionSchema, request.body, reply);
    if (!body) return;
    return { program: await manageMemberProgram(dbOf(options), actorOf(request.claims).userId, (request.params as { id: string }).id, body) };
  });

  app.put('/v1/training/programs/:id', async (request, reply) => {
    const body = parse(customizeProgramSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { id: string };
    return {
      program: await customizeMemberProgram(dbOf(options), actorOf(request.claims).userId, params.id, body),
    };
  });

  app.get('/v1/exercises/:id/substitutions', async (request) => {
    const params = request.params as { id: string };
    return exerciseSubstitutionsFor(dbOf(options), actorOf(request.claims).userId, params.id);
  });

  app.get('/v1/nutrition/ready-meals', async () => listReadyMeals());

  app.get('/v1/nutrition/meal-plan', async (request) => {
    const on = (request.query as { on?: string }).on ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      throw new ApiError(400, 'INVALID_DATE', 'A valid on date is required');
    }
    return mealPlanFor(dbOf(options), actorOf(request.claims).userId, on);
  });

  app.put('/v1/nutrition/meal-plan', async (request, reply) => {
    const body = parse(mealPlanDaySchema, request.body, reply);
    if (body === undefined) return;
    return {
      persisted: true,
      ...(await saveMealPlanDay(dbOf(options), actorOf(request.claims).userId, body)),
    };
  });

  app.post('/v1/training/sessions', async (request, reply) => {
    const body = parse(scheduleSessionSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    if (body.startNow === true) {
      await abandonOpenWorkouts(dbOf(options), actor.userId);
    }
    const session = await scheduleMemberWorkout(dbOf(options), actor.userId, {
      name: body.name,
      discipline: body.discipline,
      scheduledFor: body.scheduledFor,
      exercises: body.exercises,
    });
    if (body.startNow === true) {
      return {
        persisted: true,
        session: await mutateSession(dbOf(options), actor.userId, session.id, {
          type: 'start',
          at: new Date().toISOString(),
        }),
      };
    }
    return { persisted: true, session };
  });

  app.get('/v1/training/sessions', async (request) => {
    const actor = actorOf(request.claims);
    return { sessions: await listSessions(dbOf(options), actor.userId) };
  });

  app.get('/v1/training/sessions/:id', async (request) => {
    const actor = actorOf(request.claims);
    const params = request.params as { id: string };
    return { session: await getSession(dbOf(options), actor.userId, params.id) };
  });

  app.post('/v1/training/sessions/:id/start', async (request, reply) => {
    const body = parse(sessionTimeSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    const params = request.params as { id: string };
    return { persisted: true, session: await mutateSession(dbOf(options), actor.userId, params.id, { type: 'start', at: body.at }) };
  });

  app.post('/v1/training/sessions/:id/sets', async (request, reply) => {
    const body = parse(logSetSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    const params = request.params as { id: string };
    return { persisted: true, session: await mutateSession(dbOf(options), actor.userId, params.id, { type: 'log_set', set: body }) };
  });

  app.put('/v1/training/sessions/:id/sets/:setId', async (request, reply) => {
    const body = parse(replaceSetSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { id: string; setId: string };
    if (body.id !== params.setId) {
      return reply.code(422).send({ error: { code: 'SET_ID_MISMATCH', message: 'Body id must match the path set id' } });
    }
    return {
      persisted: true,
      session: await mutateSession(dbOf(options), actorOf(request.claims).userId, params.id, { type: 'replace_set', set: { id: body.id, exerciseId: body.exerciseId, setIndex: body.setIndex, reps: body.reps, loadGrams: body.loadGrams, rpeTenths: body.rpeTenths, completedAt: body.completedAt }, expectedSet: body.expectedSet }),
    };
  });

  app.post('/v1/training/sessions/:id/pause', async (request, reply) => {
    const body = parse(sessionTimeSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { id: string };
    return { persisted: true, session: await mutateSession(dbOf(options), actorOf(request.claims).userId, params.id, { type: 'pause', at: body.at }) };
  });

  app.post('/v1/training/sessions/:id/resume', async (request, reply) => {
    const body = parse(sessionTimeSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { id: string };
    return { persisted: true, session: await mutateSession(dbOf(options), actorOf(request.claims).userId, params.id, { type: 'resume', at: body.at }) };
  });

  app.post('/v1/training/sessions/:id/complete', async (request, reply) => {
    const body = parse(sessionTimeSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    const params = request.params as { id: string };
    return { persisted: true, session: await mutateSession(dbOf(options), actor.userId, params.id, { type: 'complete', at: body.at }) };
  });

  app.get('/v1/nutrition/foods', async (request) => {
    const query = request.query as { q?: string };
    return searchFoods(dbOf(options), actorOf(request.claims).userId, query.q ?? '');
  });

  app.post('/v1/nutrition/foods', async (request, reply) => {
    const body = parse(customFoodSchema, request.body, reply);
    if (body === undefined) return;
    return createCustomFood(dbOf(options), actorOf(request.claims).userId, body);
  });

  app.get('/v1/nutrition/custom-meals', async (request) => {
    return listCustomMeals(dbOf(options), actorOf(request.claims).userId);
  });

  app.post('/v1/nutrition/custom-meals', async (request, reply) => {
    const body = parse(customMealSchema, request.body, reply);
    if (body === undefined) return;
    return createCustomMeal(dbOf(options), actorOf(request.claims).userId, body);
  });

  app.put('/v1/nutrition/custom-meals/:id', async (request, reply) => {
    const body = parse(customMealSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { id: string };
    return updateCustomMeal(dbOf(options), actorOf(request.claims).userId, params.id, body);
  });

  app.get('/v1/nutrition/favorites', async (request) => {
    return listFavoriteFoods(dbOf(options), actorOf(request.claims).userId);
  });

  app.post('/v1/nutrition/foods/:id/favorite', async (request) => {
    const params = request.params as { id: string };
    return favoriteFood(dbOf(options), actorOf(request.claims).userId, params.id);
  });

  app.post('/v1/nutrition/diary/copy', async (request, reply) => {
    const body = parse(copyDiarySchema, request.body, reply);
    if (body === undefined) return;
    return copyDiaryDay(dbOf(options), actorOf(request.claims).userId, body.from, body.to);
  });

  app.post('/v1/nutrition/portions', async (request, reply) => {
    const body = parse(foodPortionSchema, request.body, reply);
    if (body === undefined) return;
    return logFoodPortion(dbOf(options), actorOf(request.claims).userId, body);
  });

  app.post('/v1/nutrition/entries', async (request, reply) => {
    const body = parse(foodLogSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    return logFood(dbOf(options), actor.userId, body);
  });

  app.delete('/v1/nutrition/entries/:id', async (request) => {
    const params = request.params as { id: string };
    return deleteFoodEntry(dbOf(options), actorOf(request.claims).userId, params.id);
  });

  app.get('/v1/nutrition/diary', async (request) => {
    const actor = actorOf(request.claims);
    const query = request.query as { on?: string };
    const day = query.on ?? new Date().toISOString().slice(0, 10);
    return diaryFor(dbOf(options), actor.userId, day);
  });

  app.get('/v1/nutrition/diary-range', async (request) => {
    const actor = actorOf(request.claims);
    const query = request.query as { from?: string; to?: string };
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (query.from === undefined || query.to === undefined || !pattern.test(query.from) || !pattern.test(query.to)) {
      throw new ApiError(400, 'INVALID_DATE_RANGE', 'A valid from and to date are required');
    }
    const from = Date.parse(`${query.from}T00:00:00.000Z`);
    const to = Date.parse(`${query.to}T00:00:00.000Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 31 * 86_400_000) {
      throw new ApiError(400, 'INVALID_DATE_RANGE', 'Date range must be ordered and no longer than 31 days');
    }
    return diaryRangeFor(dbOf(options), actor.userId, query.from, query.to);
  });

  app.post('/v1/weight', async (request, reply) => {
    const body = parse(weightSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    return recordWeight(dbOf(options), actor.userId, body.weightKg, body.recordedOn);
  });

  app.get('/v1/water', async (request) => {
    const on = (request.query as { on?: string }).on ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      throw new ApiError(400, 'INVALID_DATE', 'A valid on date is required');
    }
    return waterFor(dbOf(options), actorOf(request.claims).userId, on);
  });

  app.post('/v1/water', async (request, reply) => {
    const body = parse(waterLogSchema, request.body, reply);
    if (body === undefined) return;
    return { persisted: true, ...(await logWater(dbOf(options), actorOf(request.claims).userId, body.milliliters, body.loggedOn)) };
  });

  app.get('/v1/supplements', async (request) => {
    const on = (request.query as { on?: string }).on ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      throw new ApiError(400, 'INVALID_DATE', 'A valid on date is required');
    }
    return listSupplements(dbOf(options), actorOf(request.claims).userId, on);
  });

  app.post('/v1/supplements', async (request, reply) => {
    const body = parse(supplementNameSchema, request.body, reply);
    if (body === undefined) return;
    const day = body.loggedOn ?? new Date().toISOString().slice(0, 10);
    return { persisted: true, ...(await addMemberSupplement(dbOf(options), actorOf(request.claims).userId, body.name, day)) };
  });

  app.post('/v1/supplements/log', async (request, reply) => {
    const body = parse(supplementLogSchema, request.body, reply);
    if (body === undefined) return;
    return { persisted: true, ...(await logSupplement(dbOf(options), actorOf(request.claims).userId, body.name, body.loggedOn)) };
  });

  app.delete('/v1/supplements/log/:id', async (request) => {
    const params = request.params as { id: string };
    const on = (request.query as { on?: string }).on ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      throw new ApiError(400, 'INVALID_DATE', 'A valid on date is required');
    }
    return unlogSupplement(dbOf(options), actorOf(request.claims).userId, params.id, on);
  });

  app.get('/v1/activity', async (request) => {
    const on = (request.query as { on?: string }).on ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      throw new ApiError(400, 'INVALID_DATE', 'A valid on date is required');
    }
    return activitiesFor(dbOf(options), actorOf(request.claims).userId, on);
  });

  app.post('/v1/activity', async (request, reply) => {
    const body = parse(activityLogSchema, request.body, reply);
    if (body === undefined) return;
    return { persisted: true, activity: await logActivity(dbOf(options), actorOf(request.claims).userId, body) };
  });

  app.get('/v1/measurements', async (request) => measurementsFor(dbOf(options), actorOf(request.claims).userId));

  app.post('/v1/measurements', async (request, reply) => {
    const body = parse(bodyMeasurementSchema, request.body, reply);
    if (body === undefined) return;
    return { persisted: true, measurement: await logBodyMeasurements(dbOf(options), actorOf(request.claims).userId, body) };
  });

  app.get('/v1/progress', async (request) => progressFor(dbOf(options), actorOf(request.claims).userId));

  app.get('/v1/member/state', async (request) => {
    const query = request.query as { windowDays?: string; timeZone?: string; asOfDay?: string };
    const windowDays = query.windowDays === undefined ? undefined : Number(query.windowDays);
    if (windowDays !== undefined && (!Number.isSafeInteger(windowDays) || windowDays < 1 || windowDays > 90)) {
      throw new ApiError(400, 'INVALID_WINDOW', 'windowDays must be an integer from 1 to 90');
    }
    if (query.asOfDay !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(query.asOfDay)) {
      throw new ApiError(400, 'INVALID_DATE', 'asOfDay must be YYYY-MM-DD');
    }
    return memberStateFor(dbOf(options), actorOf(request.claims), {
      windowDays,
      timeZone: query.timeZone,
      asOfDay: query.asOfDay,
    });
  });

  app.post('/v1/member/recommendations/generate', async (request) => (
    generateMemberRecommendations(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/member/recommendations', async (request) => (
    listMemberRecommendations(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/member/recommendations/:id/preview-apply', async (request) => {
    const params = request.params as { id: string };
    return previewTrainingRecommendationApply(dbOf(options), actorOf(request.claims), params.id);
  });

  app.post('/v1/member/recommendations/:id/advance', async (request, reply) => {
    const body = request.body as { status?: string };
    const allowed = [
      'APPROVED',
      'REJECTED',
      'APPLIED',
      'MEMBER_CONFIRMATION_REQUIRED',
      'MONITORED',
      'CANCELED',
      'REVERTED',
    ] as const;
    if (body?.status === undefined || !(allowed as readonly string[]).includes(body.status)) {
      throw new ApiError(
        400,
        'INVALID_STATUS',
        'status must be APPROVED, REJECTED, APPLIED, MEMBER_CONFIRMATION_REQUIRED, MONITORED, CANCELED, or REVERTED',
      );
    }
    const params = request.params as { id: string };
    return advanceMemberRecommendation(
      dbOf(options),
      actorOf(request.claims),
      params.id,
      body.status as (typeof allowed)[number],
    );
  });

  app.post('/v1/coach/assignments', async (request) => {
    const body = request.body as { coachUserId?: string; memberUserId?: string; reason?: string };
    if (typeof body?.coachUserId !== 'string' || typeof body?.memberUserId !== 'string') {
      throw new ApiError(400, 'INVALID_ASSIGNMENT', 'coachUserId and memberUserId are required');
    }
    return assignCoachToMember(
      dbOf(options),
      actorOf(request.claims),
      body.coachUserId,
      body.memberUserId,
      typeof body.reason === 'string' ? body.reason : '',
    );
  });

  app.delete('/v1/coach/assignments', async (request) => {
    const body = request.body as { coachUserId?: string; memberUserId?: string; reason?: string };
    if (typeof body?.coachUserId !== 'string' || typeof body?.memberUserId !== 'string') {
      throw new ApiError(400, 'INVALID_ASSIGNMENT', 'coachUserId and memberUserId are required');
    }
    return revokeCoachAssignment(
      dbOf(options),
      actorOf(request.claims),
      body.coachUserId,
      body.memberUserId,
      typeof body.reason === 'string' ? body.reason : '',
    );
  });

  app.get('/v1/coach/assignments', async (request) => (
    listCoachAssignmentsForActor(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/member/coach-share-consent', async (request) => (
    coachShareConsentFor(dbOf(options), actorOf(request.claims))
  ));

  app.post('/v1/member/coach-share-consent', async (request) => (
    grantCoachShareConsent(dbOf(options), actorOf(request.claims))
  ));

  app.delete('/v1/member/coach-share-consent', async (request) => (
    withdrawCoachShareConsent(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/coach/members/:memberUserId/state', async (request) => {
    const params = request.params as { memberUserId: string };
    return memberStateFor(dbOf(options), actorOf(request.claims), {
      subjectUserId: params.memberUserId,
      timeZone: 'Asia/Riyadh',
    });
  });

  app.get('/v1/coach/workspace/inbox', async (request) => (
    listWeeklyReviewsForCoach(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/coach/workspace/metrics', async (request) => (
    coachWorkloadMetrics(dbOf(options), actorOf(request.claims))
  ));

  app.post('/v1/coach/workspace/mark-overdue', async (request) => {
    const body = request.body as { olderThanHours?: number };
    return markOverdueWeeklyReviews(
      dbOf(options),
      actorOf(request.claims),
      typeof body?.olderThanHours === 'number' ? body.olderThanHours : 72,
    );
  });

  app.get('/v1/coach/workspace/follow-ups', async (request) => (
    listCoachFollowUps(dbOf(options), actorOf(request.claims))
  ));

  app.post('/v1/coach/reviews/:id/follow-ups', async (request) => {
    const body = request.body as { body?: string; dueOn?: string };
    if (typeof body?.body !== 'string') {
      throw new ApiError(400, 'INVALID_FOLLOW_UP', 'body is required');
    }
    const params = request.params as { id: string };
    return addCoachFollowUp(
      dbOf(options),
      actorOf(request.claims),
      params.id,
      body.body,
      typeof body.dueOn === 'string' ? body.dueOn : undefined,
    );
  });

  app.get('/v1/member/weekly-review', async (request) => (
    memberWeeklyHumanReviewStatus(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/member/weekly-share-preview', async (request) => {
    const weekOf = (request.query as { weekOf?: string }).weekOf ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) {
      throw new ApiError(400, 'INVALID_DATE', 'weekOf must be YYYY-MM-DD');
    }
    return previewWeeklySharePacket(dbOf(options), actorOf(request.claims), weekOf);
  });

  app.post('/v1/coach/reviews/prepare', async (request) => {
    const body = request.body as { memberUserId?: string; weekOf?: string };
    if (typeof body?.memberUserId !== 'string' || typeof body?.weekOf !== 'string') {
      throw new ApiError(400, 'INVALID_REVIEW', 'memberUserId and weekOf are required');
    }
    return prepareWeeklyReviewForMember(
      dbOf(options),
      actorOf(request.claims),
      body.memberUserId,
      body.weekOf,
    );
  });

  app.get('/v1/coach/reviews/:id/packet', async (request) => {
    const params = request.params as { id: string };
    return readWeeklyReviewPacket(dbOf(options), actorOf(request.claims), params.id);
  });

  app.post('/v1/coach/reviews/:id/claim', async (request) => {
    const params = request.params as { id: string };
    return claimWeeklyReview(dbOf(options), actorOf(request.claims), params.id);
  });

  app.post('/v1/coach/reviews/:id/feedback', async (request) => {
    const body = request.body as { body?: string };
    if (typeof body?.body !== 'string') {
      throw new ApiError(400, 'INVALID_FEEDBACK', 'body is required');
    }
    const params = request.params as { id: string };
    return sendCoachFeedback(dbOf(options), actorOf(request.claims), params.id, body.body);
  });

  app.post('/v1/coach/reviews/:id/escalate', async (request) => {
    const body = request.body as { note?: string };
    const params = request.params as { id: string };
    return escalateWeeklyReview(
      dbOf(options),
      actorOf(request.claims),
      params.id,
      typeof body?.note === 'string' ? body.note : '',
    );
  });

  app.get('/v1/member/coach-feedback', async (request) => (
    listMemberCoachFeedback(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/member/notifications', async (request) => (
    listMemberNotifications(dbOf(options), actorOf(request.claims))
  ));

  app.get('/v1/member/entitlements', async (request) => (
    entitlementsFor(dbOf(options), actorOf(request.claims))
  ));

  app.post('/v1/member/notifications/:id/read', async (request) => {
    const params = request.params as { id: string };
    return markMemberNotificationRead(dbOf(options), actorOf(request.claims), params.id);
  });

  app.get('/v1/coach/members/:memberUserId/notes', async (request) => {
    const params = request.params as { memberUserId: string };
    return listCoachNotes(dbOf(options), actorOf(request.claims), params.memberUserId);
  });

  app.post('/v1/coach/members/:memberUserId/notes', async (request) => {
    const body = request.body as { body?: string };
    if (typeof body?.body !== 'string') {
      throw new ApiError(400, 'INVALID_NOTE', 'body is required');
    }
    const params = request.params as { memberUserId: string };
    return addCoachNote(dbOf(options), actorOf(request.claims), params.memberUserId, body.body);
  });

  app.post('/v1/coach/members/:memberUserId/recommendations/:id/decide', async (request) => {
    const body = request.body as { decision?: string; reason?: string };
    if (body?.decision !== 'APPROVED' && body?.decision !== 'REJECTED') {
      throw new ApiError(400, 'INVALID_DECISION', 'decision must be APPROVED or REJECTED');
    }
    const params = request.params as { memberUserId: string; id: string };
    return coachDecideRecommendation(
      dbOf(options),
      actorOf(request.claims),
      params.memberUserId,
      params.id,
      body.decision,
      typeof body.reason === 'string' ? body.reason : '',
    );
  });

  app.get('/v1/gyms/:organizationId', async (request) => {
    const params = request.params as { organizationId: string };
    return readGym(dbOf(options), actorOf(request.claims), params.organizationId);
  });

  app.post('/v1/referrals', async (request, reply) => {
    const body = parse(referralSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    return attributeReferral(dbOf(options), actor.userId, body.code, new Date().toISOString());
  });

  app.get('/v1/community/posts', async (request) => {
    const actor = actorOf(request.claims);
    const query = request.query as { before?: string };
    return {
      posts: await listCommunityFeed(dbOf(options), actor.userId, query.before),
      publishing: true,
      mediaStorage: false,
    };
  });

  app.post('/v1/community/posts', async (request, reply) => {
    const body = parse(communityPostSchema, request.body, reply);
    if (body === undefined) return;
    return createCommunityPost(dbOf(options), actorOf(request.claims).userId, body.body, body.visibility);
  });

  app.patch('/v1/community/posts/:id', async (request, reply) => {
    const body = parse(communityCommentSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { id: string };
    return updateOwnCommunityPost(dbOf(options), actorOf(request.claims).userId, params.id, body.body);
  });

  app.delete('/v1/community/posts/:id', async (request) => {
    const params = request.params as { id: string };
    return deleteOwnCommunityPost(dbOf(options), actorOf(request.claims).userId, params.id);
  });

  app.get('/v1/community/posts/:id/comments', async (request) => {
    const params = request.params as { id: string };
    return { comments: await listComments(dbOf(options), actorOf(request.claims).userId, params.id) };
  });

  app.post('/v1/community/posts/:id/comments', async (request, reply) => {
    const body = parse(communityCommentSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { id: string };
    return commentOnPost(dbOf(options), actorOf(request.claims).userId, params.id, body.body);
  });

  app.post('/v1/community/posts/:id/support', async (request) => {
    const params = request.params as { id: string };
    return toggleSupport(dbOf(options), actorOf(request.claims).userId, params.id);
  });

  app.post('/v1/community/follows/:userId', async (request) => {
    const params = request.params as { userId: string };
    return followMember(dbOf(options), actorOf(request.claims).userId, params.userId);
  });

  app.post('/v1/community/blocks/:userId', async (request) => {
    const params = request.params as { userId: string };
    return blockMember(dbOf(options), actorOf(request.claims).userId, params.userId);
  });

  app.get('/v1/coach/messages', async (request) => {
    const actor = actorOf(request.claims);
    const runtime = coachOf(options);
    const db = dbOf(options);
    const entitlements = await entitlementsFor(db, actor);
    const usedRows = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ai_usage WHERE user_id = $1 AND created_at > date_trunc('day', now())`,
      [actor.userId],
    );
    const used = Number(usedRows.rows[0]?.count ?? 0);
    return {
      messages: await listCoachMessages(db, actor.userId),
      productionIntelligence: runtime.name === 'openai_compatible',
      providerConfigured: runtime.name !== 'unconfigured',
      provider: runtime.name,
      persona: 'yazan',
      requiredEnv: runtime.name === 'unconfigured' ? runtime.missing : [],
      quota: {
        used,
        limit: entitlements.limits.yazanTurnsPerDay,
        remaining: Math.max(0, entitlements.limits.yazanTurnsPerDay - used),
      },
    };
  });

  app.post('/v1/coach/daily-checkin', async (request) => {
    const locale = request.headers['accept-language']?.startsWith('en') ? 'en' : 'ar';
    return ensureDailyYazanCheckin(dbOf(options), actorOf(request.claims), { locale });
  });

  app.post('/v1/coach/weekly-brief', async (request, reply) => {
    const body = parse(weeklyCoachSurveySchema, request.body, reply);
    if (body === undefined) return;
    return submitWeeklyCoachBrief(dbOf(options), actorOf(request.claims), body);
  });

  app.get('/v1/coach/weekly-brief', async (request) => (
    latestWeeklyCoachBrief(dbOf(options), actorOf(request.claims).userId)
  ));

  app.post('/v1/coach/messages', async (request, reply) => {
    const body = parse(coachMessageSchema, request.body, reply);
    if (body === undefined) return;
    const runtime = coachOf(options);
    if (runtime.name === 'unconfigured') {
      return reply.code(503).send({
        error: {
          code: 'MODEL_PROVIDER_NOT_CONFIGURED',
          message: 'The coach provider is not configured',
          requiredEnv: runtime.missing,
          productionIntelligence: false,
        },
      });
    }
    const wantsStream = request.headers.accept === 'text/event-stream' && runtime.name === 'openai_compatible';
    const answer = await answerCoach(dbOf(options), actorOf(request.claims), body.message, runtime, {
      fetchImpl: options.fetchImpl,
      stream: wantsStream,
    });
    if (wantsStream) {
      reply.header('content-type', 'text/event-stream; charset=utf-8');
      return `data: ${JSON.stringify({ text: answer.text, persisted: true })}\n\n`;
    }
    return answer;
  });

  app.post('/v1/admin/coaching/rules', async (request, reply) => {
    const body = parse(coachingRuleSchema, request.body, reply);
    if (body === undefined) return;
    return createDraftRule(dbOf(options), actorOf(request.claims), {
      ...body,
      conditions: body.conditions as CoachingRuleVersion['conditions'],
      actions: body.actions,
    });
  });

  app.post('/v1/admin/coaching/rules/:ruleId/submit', async (request) => {
    const params = request.params as { ruleId: string };
    return submitRule(dbOf(options), actorOf(request.claims), params.ruleId);
  });

  app.post('/v1/admin/coaching/rules/:ruleId/decide', async (request, reply) => {
    const body = parse(ruleDecisionSchema, request.body, reply);
    if (body === undefined) return;
    const params = request.params as { ruleId: string };
    return decideRule(dbOf(options), actorOf(request.claims), params.ruleId, body.decision, new Date().toISOString());
  });

  app.post('/v1/admin/coaching/rules/:ruleId/publish', async (request) => {
    const params = request.params as { ruleId: string };
    return publishRule(dbOf(options), params.ruleId);
  });

  app.post('/v1/admin/coaching/rules/:ruleId/rollback', async (request) => {
    const params = request.params as { ruleId: string };
    return rollbackRule(dbOf(options), params.ruleId);
  });

  app.post('/v1/admin/coaching/simulate', async (request, reply) => {
    const body = parse(simulateSchema, request.body, reply);
    if (body === undefined) return;
    const evaluation = await simulateRules(dbOf(options), body.facts, body.asOf);
    return { persistedPlan: false, evaluation };
  });
}
