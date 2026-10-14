import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  coachMessageSchema,
  coachingRuleSchema,
  communityCommentSchema,
  communityPostSchema,
  customExerciseSchema,
  customFoodSchema,
  foodLogSchema,
  foodPortionSchema,
  loginSchema,
  logSetSchema,
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
  verifySchema,
  weightSchema,
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
  answerCoach,
  attributeReferral,
  blockMember,
  commentOnPost,
  createCommunityPost,
  createCustomFood,
  createDraftRule,
  createMemberExercise,
  decideRule,
  deleteFoodEntry,
  deleteOwnCommunityPost,
  diaryFor,
  favoriteFood,
  followMember,
  getSession,
  homeFor,
  listCoachMessages,
  listComments,
  listCommunityFeed,
  listExercises,
  listSessions,
  logFood,
  logFoodPortion,
  mutateSession,
  progressFor,
  publishRule,
  readGym,
  readProfile,
  recordWeight,
  rollbackRule,
  searchFoods,
  saveOnboarding,
  scheduleMemberWorkout,
  setDisplayName,
  simulateRules,
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
    demonstrationMedia: null,
  }));

  app.post('/v1/exercises', async (request, reply) => {
    const body = parse(customExerciseSchema, request.body, reply);
    if (body === undefined) return;
    return createMemberExercise(dbOf(options), actorOf(request.claims).userId, body);
  });

  app.post('/v1/training/sessions', async (request, reply) => {
    const body = parse(scheduleSessionSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    const session = await scheduleMemberWorkout(dbOf(options), actor.userId, {
      name: body.name,
      discipline: body.discipline,
      scheduledFor: body.scheduledFor,
      exercises: body.exercises,
    });
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

  app.post('/v1/nutrition/foods/:id/favorite', async (request) => {
    const params = request.params as { id: string };
    return favoriteFood(dbOf(options), actorOf(request.claims).userId, params.id);
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

  app.post('/v1/weight', async (request, reply) => {
    const body = parse(weightSchema, request.body, reply);
    if (body === undefined) return;
    const actor = actorOf(request.claims);
    return recordWeight(dbOf(options), actor.userId, body.weightKg, body.recordedOn);
  });

  app.get('/v1/progress', async (request) => progressFor(dbOf(options), actorOf(request.claims).userId));

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
    return {
      messages: await listCoachMessages(dbOf(options), actor.userId),
      productionIntelligence: runtime.name === 'openai_compatible',
      providerConfigured: runtime.name !== 'unconfigured',
      provider: runtime.name,
      requiredEnv: runtime.name === 'unconfigured' ? runtime.missing : [],
    };
  });

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
