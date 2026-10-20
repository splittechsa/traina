import { randomUUID } from 'node:crypto';
import {
  DomainError,
  adherenceRatioBps,
  assembleHomeDashboard,
  authorize,
  completeWorkout,
  decideRuleApproval,
  evaluateCoachingRules,
  executeCoachTool,
  logSet,
  replaceSet,
  parseScaledInteger,
  pauseWorkout,
  personalRecordsFromSessions,
  resolveAttribution,
  resumeWorkout,
  scalePer100g,
  abandonWorkout,
  assertActivityDuration,
  assertMeasurementMm,
  assertWaterServing,
  catalogTemplates,
  describeTemplateAudience,
  isActivityKind,
  isMealSlot,
  assertDiaryCopy,
  assertSupplementName,
  waterMillilitersTotal,
  assembleDayMealPlan,
  assembleMemberState,
  assertCanManageCoachAssignments,
  assertCanReadMemberStateFor,
  assertCoachEligibleForAssignment,
  assertMemberEligibleForAssignment,
  assertNotSelfRolePromotion,
  athleteEnergyPlan,
  assertEnergyPolicyApprovedForPaidCoaching,
  buildAuthorizedCoachPacket,
  calendarDayInTimeZone,
  COACH_SHARE_POLICY_VERSION,
  createCoachFeedback,
  applyPermittedRecommendation,
  beginMonitoringRecommendation,
  buildProgramAdaptationPlan,
  expireOpenRecommendations,
  generateRecommendationsFromMemberState,
  memberConfirmRecommendation,
  parseProgramVersionDocument,
  prioritizeRecommendations,
  suppressDuplicateRecommendations,
  transitionRecommendation,
  transitionWeeklyReview,
  validateRecommendation,
  type CoachingRecommendation,
  type WeeklyReviewStatus,
  customizeMealSlot,
  loggingDiscipline,
  LOGGING_WINDOW_DAYS,
  pickReadyMeal,
  proposeWeeklyNutritionStep,
  READY_MEAL_TEMPLATES,
  assertNutritionPace,
  assertNutritionPhase,
  buildWeeklyHumanCoachPacket,
  buildYazanDailyBrief,
  planDocumentDay,
  type ProgramDayDocument,
  planTemplateDay,
  recommendTemplates,
  scheduleWorkout,
  startWorkout,
  suggestExerciseSubstitutions,
  templateById,
  workoutElapsedSeconds,
  summarizeDiary,
  validateOnboarding,
  type MealPlanSlotPick,
  type MemberState,
  type NutritionPace,
  type NutritionPhase,
  type Actor,
  type Role,
  type CoachingRuleVersion,
  type FoodEntry,
  type NormalizedOnboarding,
  type OnboardingInput,
  type ProgressExerciseSetRow,
  type ProgressPersonalRecordRow,
  type ProgressSnapshot,
  type ProgressWeightRow,
  type RawMemberEvent,
  type WorkoutSession,
  type WorkoutSet,
  hasCapability,
  initialSubscription,
  projectEntitlements,
  type EntitlementProjection,
  type StoreChannel,
  type SubscriptionStatus,
} from '@sahhti/domain';
import { completeModelReply, streamModelReply, type CoachRuntime } from '../coach/provider.js';
import type { Database } from '../db/database.js';
import { ApiError } from '../identity/accounts.js';

function asJson<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function requireIso(value: unknown): string {
  const parsed = iso(value);
  if (parsed === null) {
    throw new ApiError(500, 'INVALID_ROW', 'Missing timestamp');
  }
  return parsed;
}

export async function saveOnboarding(
  db: Database,
  userId: string,
  input: OnboardingInput,
  units: 'metric' | 'imperial',
): Promise<{ persisted: true; onboardingCompleted: true; record: NormalizedOnboarding; requiresReview: boolean }> {
  const result = validateOnboarding(input);
  if (!result.ok) {
    throw new ApiError(422, 'ONBOARDING_INVALID', result.errors.map((error) => `${error.field}:${error.code}`).join(','));
  }
  const record = result.record;
  await db.transaction(async (tx) => {
    const versions = await tx.query<{ next: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM onboarding_snapshots WHERE user_id = $1`,
      [userId],
    );
    const version = Number(versions.rows[0]?.next ?? 1);
    await tx.query(
      `INSERT INTO user_profiles (
         user_id, age_years_reported, age_reported_on, height_mm, weight_grams, sex, training_experience,
         discipline, sessions_per_week, environment, activity_level, dietary_preferences, allergies,
         supplements, injuries, has_gym_membership, locale, measurement_units,
         nutrition_pace, horizon_weeks, version
       ) VALUES (
         $1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 1
       )
       ON CONFLICT (user_id) DO UPDATE SET
         age_years_reported = EXCLUDED.age_years_reported,
         age_reported_on = CURRENT_DATE,
         height_mm = EXCLUDED.height_mm,
         weight_grams = EXCLUDED.weight_grams,
         sex = EXCLUDED.sex,
         training_experience = EXCLUDED.training_experience,
         discipline = EXCLUDED.discipline,
         sessions_per_week = EXCLUDED.sessions_per_week,
         environment = EXCLUDED.environment,
         activity_level = EXCLUDED.activity_level,
         dietary_preferences = EXCLUDED.dietary_preferences,
         allergies = EXCLUDED.allergies,
         supplements = EXCLUDED.supplements,
         injuries = EXCLUDED.injuries,
         has_gym_membership = EXCLUDED.has_gym_membership,
         locale = EXCLUDED.locale,
         measurement_units = EXCLUDED.measurement_units,
         nutrition_pace = EXCLUDED.nutrition_pace,
         horizon_weeks = EXCLUDED.horizon_weeks,
         version = user_profiles.version + 1,
         updated_at = now()`,
      [
        userId,
        record.ageYears,
        record.heightMm,
        record.weightGrams,
        record.sex,
        record.trainingExperience,
        record.discipline,
        record.sessionsPerWeek,
        record.environment,
        record.activityLevel,
        record.dietaryPreferences,
        record.allergies,
        record.supplements,
        record.injuries,
        record.hasGymMembership,
        record.locale,
        units,
        record.nutritionPace,
        record.horizonWeeks,
      ],
    );
    await tx.query(`UPDATE user_profiles SET sports = $2::text[] WHERE user_id = $1`, [userId, record.sports]);
    await tx.query(
      `INSERT INTO onboarding_snapshots (user_id, version, payload, requires_review, risk_flags)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [userId, version, JSON.stringify(record), record.requiresReview, record.riskFlags],
    );
    await tx.query(
      `UPDATE user_goals SET status = 'abandoned', ended_on = CURRENT_DATE WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );
    for (const goal of record.goals) {
      await tx.query(
        `INSERT INTO user_goals (user_id, goal, status, started_on) VALUES ($1, $2, 'active', CURRENT_DATE)`,
        [userId, goal],
      );
    }
    await tx.query(
      `INSERT INTO weight_records (user_id, weight_grams, recorded_on, source)
       SELECT $1, $2, CURRENT_DATE, 'manual'
       WHERE NOT EXISTS (
         SELECT 1 FROM weight_records
         WHERE user_id = $1 AND recorded_on = CURRENT_DATE AND source = 'manual' AND weight_grams = $2
       )`,
      [userId, record.weightGrams],
    );
    await tx.query(
      `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id) VALUES ($1, 'onboarding.save', 'user', $2)`,
      [userId, userId],
    );
  });
  return { persisted: true, onboardingCompleted: true, record, requiresReview: record.requiresReview };
}

export async function readProfile(db: Database, userId: string) {
  const profile = await db.query<Record<string, unknown>>(
    `SELECT display_name, age_years_reported, height_mm, weight_grams, sex, discipline, sports, locale, measurement_units, version,
            training_experience, sessions_per_week, environment, supplements, nutrition_pace, horizon_weeks
     FROM user_profiles WHERE user_id = $1`,
    [userId],
  );
  const goals = await db.query<{ goal: string }>(
    `SELECT goal FROM user_goals WHERE user_id = $1 AND status = 'active' ORDER BY started_on`,
    [userId],
  );
  return { profile: profile.rows[0] ?? null, goals: goals.rows.map((row) => row.goal) };
}

export async function setDisplayName(db: Database, userId: string, displayName: string): Promise<void> {
  const updated = await db.query(`UPDATE user_profiles SET display_name = $2, updated_at = now() WHERE user_id = $1`, [
    userId,
    displayName.trim(),
  ]);
  if (updated.rowCount === 0) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Complete onboarding before naming the profile');
  }
}

async function sessionOwned(db: Database, userId: string, sessionId: string): Promise<WorkoutSession> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT id, user_id, name, discipline, status, planned_exercises, scheduled_for, started_at, completed_at, pauses
     FROM workout_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
  const row = rows.rows[0];
  if (row === undefined) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Workout was not found');
  }
  const sets = await db.query<Record<string, unknown>>(
    `SELECT id, exercise_id, set_index, reps, load_grams, rpe_tenths, completed_at
     FROM workout_sets WHERE session_id = $1 ORDER BY set_index, completed_at`,
    [sessionId],
  );
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    discipline: String(row.discipline) as WorkoutSession['discipline'],
    status: String(row.status) as WorkoutSession['status'],
    plannedExercises: asJson(row.planned_exercises),
    sets: sets.rows.map((set) => ({
      id: String(set.id),
      exerciseId: String(set.exercise_id),
      setIndex: Number(set.set_index),
      reps: Number(set.reps),
      loadGrams: Number(set.load_grams),
      rpeTenths: set.rpe_tenths === null ? null : Number(set.rpe_tenths),
      completedAt: requireIso(set.completed_at),
    })),
    scheduledFor: requireIso(row.scheduled_for),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    pauses: asJson(row.pauses ?? []),
  };
}

async function writeSession(db: Database, session: WorkoutSession): Promise<void> {
  await db.query(
    `UPDATE workout_sessions
     SET status = $3, started_at = $4, completed_at = $5, pauses = $6::jsonb
     WHERE id = $1 AND user_id = $2`,
    [session.id, session.userId, session.status, session.startedAt, session.completedAt, JSON.stringify(session.pauses)],
  );
}

export async function scheduleMemberWorkout(
  db: Database,
  userId: string,
  input: {
    name: string;
    discipline: string;
    scheduledFor: string;
    exercises: WorkoutSession['plannedExercises'];
    programVersionId?: string | null;
  },
): Promise<WorkoutSession> {
  for (const exercise of input.exercises) {
    const found = await db.query(`SELECT id FROM exercises WHERE id = $1`, [exercise.exerciseId]);
    if (found.rows[0] === undefined) {
      throw new ApiError(422, 'UNKNOWN_EXERCISE', 'Exercise is not in the library');
    }
  }
  let session: WorkoutSession;
  try {
    session = scheduleWorkout({
      id: randomUUID(),
      userId,
      name: input.name,
      discipline: input.discipline as WorkoutSession['discipline'],
      exercises: input.exercises,
      scheduledFor: input.scheduledFor,
    });
  } catch (error) {
    throw asApi(error);
  }
  await db.query(
    `INSERT INTO workout_sessions (id, user_id, name, discipline, status, planned_exercises, scheduled_for, pauses, program_version_id)
     VALUES ($1, $2, $3, $4, 'scheduled', $5::jsonb, $6, '[]'::jsonb, $7)`,
    [
      session.id,
      userId,
      session.name,
      session.discipline,
      JSON.stringify(session.plannedExercises),
      session.scheduledFor,
      input.programVersionId ?? null,
    ],
  );
  return session;
}

function publicTemplate(template: NonNullable<ReturnType<typeof templateById>>) {
  const audience = describeTemplateAudience(template.id);
  return {
    id: template.id,
    family: template.family,
    split: template.split,
    daysPerWeek: template.daysPerWeek,
    discipline: template.discipline,
    environment: template.environment,
    name_ar: template.name_ar,
    name_en: template.name_en,
    summary_ar: template.summary_ar,
    summary_en: template.summary_en,
    audience,
    days: template.days.map((day) => ({
      name_ar: day.name_ar,
      name_en: day.name_en,
      exerciseCount: day.exerciseIds.length,
      exerciseIds: [...day.exerciseIds],
    })),
  };
}

function recommendationsFor(profile: Record<string, unknown> | null, goals: readonly string[]) {
  const sports = Array.isArray(profile?.sports) ? profile.sports.map((item) => String(item)) : [];
  return recommendTemplates({
    sessionsPerWeek: profile?.sessions_per_week === null || profile?.sessions_per_week === undefined ? null : Number(profile.sessions_per_week),
    goals,
    discipline: profile?.discipline === null || profile?.discipline === undefined ? null : String(profile.discipline),
    sports,
    environment: profile?.environment === null || profile?.environment === undefined ? null : String(profile.environment),
    experience: profile?.training_experience === null || profile?.training_experience === undefined ? null : String(profile.training_experience),
    heightMm: profile?.height_mm === null || profile?.height_mm === undefined ? null : Number(profile.height_mm),
    weightGrams: profile?.weight_grams === null || profile?.weight_grams === undefined ? null : Number(profile.weight_grams),
  });
}

export function listTrainingTemplates() {
  return catalogTemplates().map((item) => publicTemplate(item));
}

export async function listMemberPrograms(db: Database, userId: string) {
  const { profile, goals } = await readProfile(db, userId);
  const ranked = recommendationsFor(profile, goals);
  const recommendedIds = new Set(ranked.slice(0, 3).map((item) => item.id));
  const active = await db.query<{
    id: string;
    template_id: string | null;
    name: string;
    discipline: string;
    nutrition_phase: string | null;
    nutrition_pace: string | null;
    horizon_weeks: number | null;
    weekly_energy_delta_kcal: number;
    maintenance_kcal: number | null;
  }>(
    `SELECT id, template_id, name, discipline, nutrition_phase, nutrition_pace, horizon_weeks,
            weekly_energy_delta_kcal, maintenance_kcal
     FROM programs WHERE user_id = $1 AND active = true LIMIT 1`,
    [userId],
  );
  const row = active.rows[0];
  const template = row?.template_id === undefined || row.template_id === null ? null : templateById(row.template_id);
  let energy = null;
  if (row !== undefined && row.nutrition_phase !== null && row.maintenance_kcal !== null) {
    try {
      energy = athleteEnergyPlan({
        maintenanceKcal: Number(row.maintenance_kcal),
        phase: assertNutritionPhase(row.nutrition_phase),
        pace: row.nutrition_pace === null ? undefined : assertNutritionPace(row.nutrition_pace),
        horizonWeeks: row.horizon_weeks === null ? null : Number(row.horizon_weeks),
        weeklyEnergyDeltaKcal: Number(row.weekly_energy_delta_kcal),
      });
    } catch {
      energy = null;
    }
  }
  let activeDays =
    template === null
      ? []
      : publicTemplate(template).days.map((day) => ({
          ...day,
          exerciseIds: day.exerciseIds,
          strengthOverrides: {} as NonNullable<ProgramDayDocument['strengthOverrides']>,
        }));
  let programVersion = 1;
  if (row !== undefined) {
    const versionRow = await db.query<{ version: number; template: unknown }>(
      `SELECT version, template FROM program_versions WHERE program_id = $1 ORDER BY version DESC LIMIT 1`,
      [row.id],
    );
    const latest = versionRow.rows[0];
    if (latest !== undefined) {
      programVersion = Number(latest.version);
      try {
        const parsed = parseProgramVersionDocument(
          latest.template ?? { templateId: row.template_id, days: template?.days ?? [] },
        );
        activeDays = parsed.days.map((day) => ({
          name_ar: day.name_ar,
          name_en: day.name_en,
          exerciseCount: day.exerciseIds.length,
          exerciseIds: [...day.exerciseIds],
          strengthOverrides: day.strengthOverrides ?? {},
        }));
      } catch {
        /* keep catalog days */
      }
    }
  }
  return {
    library: (await db.query<{ id: string; name: string; active: boolean; archived_at: string | null; version: number }>(
      'SELECT p.id, p.name, p.active, p.archived_at, (SELECT max(v.version) FROM program_versions v WHERE v.program_id = p.id) AS version FROM programs p WHERE p.user_id = $1 ORDER BY p.created_at DESC, p.id', [userId])).rows.map(p => ({ id: p.id, name: p.name, active: p.active, archivedAt: p.archived_at, version: Number(p.version) })),
    templates: catalogTemplates().map((item) => ({
      ...publicTemplate(item),
      recommended: recommendedIds.has(item.id),
    })),
    recommended: ranked.slice(0, 5),
    readyMeals: READY_MEAL_TEMPLATES,
    active:
      row === undefined
        ? null
        : {
            id: row.id,
            templateId: row.template_id,
            name: row.name,
            discipline: row.discipline,
            version: programVersion,
            days: activeDays,
            nutritionPhase: row.nutrition_phase,
            nutritionPace: row.nutrition_pace,
            horizonWeeks: row.horizon_weeks === null ? null : Number(row.horizon_weeks),
            maintenanceKcal: row.maintenance_kcal === null ? null : Number(row.maintenance_kcal),
            weeklyEnergyDeltaKcal: Number(row.weekly_energy_delta_kcal),
            energy,
          },
  };
}

export async function setProgramNutrition(
  db: Database,
  userId: string,
  input: {
    phase: string;
    maintenanceKcal: number;
    pace?: string;
    horizonWeeks?: number | null;
    weeklyEnergyDeltaKcal?: number;
  },
) {
  try {
    // Paid coaching apply path — block until ENERGY_POLICY is professionally approved (P0-SAFE-01).
    assertEnergyPolicyApprovedForPaidCoaching();
  } catch (error) {
    throw asApi(error);
  }
  let phase: NutritionPhase;
  let pace: NutritionPace | undefined;
  try {
    phase = assertNutritionPhase(input.phase);
    pace = input.pace === undefined ? undefined : assertNutritionPace(input.pace);
  } catch (error) {
    throw asApi(error);
  }
  let energy;
  try {
    energy = athleteEnergyPlan({
      maintenanceKcal: input.maintenanceKcal,
      phase,
      pace,
      horizonWeeks: input.horizonWeeks ?? null,
      weeklyEnergyDeltaKcal: input.weeklyEnergyDeltaKcal ?? 0,
    });
  } catch (error) {
    throw asApi(error);
  }
  const updated = await db.query<{ id: string }>(
    `UPDATE programs
     SET nutrition_phase = $2,
         maintenance_kcal = $3,
         weekly_energy_delta_kcal = $4,
         nutrition_pace = $5,
         horizon_weeks = $6
     WHERE user_id = $1 AND active = true
     RETURNING id`,
    [
      userId,
      phase,
      input.maintenanceKcal,
      energy.weeklyEnergyDeltaKcal,
      energy.pace,
      energy.horizonWeeks,
    ],
  );
  if (updated.rows[0] === undefined) {
    throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Activate a training program before setting nutrition');
  }
  return { programId: String(updated.rows[0].id), phase, pace: energy.pace, energy };
}

export async function nutritionDisciplineFor(db: Database, userId: string) {
  const windowDays = LOGGING_WINDOW_DAYS;
  const from = previousIsoDay(windowDays - 1);
  const to = new Date().toISOString().slice(0, 10);
  const diary = await diaryRangeFor(db, userId, from, to);
  const mealDaysLogged = diary.days.filter((day) => day.entryCount > 0).length;
  const water = await db.query<{ n: string }>(
    `SELECT COUNT(DISTINCT logged_on)::text AS n
     FROM water_logs
     WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [userId, from, to],
  );
  const waterDaysLogged = Number(water.rows[0]?.n ?? 0);
  let discipline;
  try {
    discipline = loggingDiscipline({ windowDays, mealDaysLogged, waterDaysLogged });
  } catch (error) {
    throw asApi(error);
  }
  let proposal = null;
  try {
    proposal = await proposeProgramNutritionStep(db, userId);
  } catch {
    proposal = null;
  }
  return {
    windowDays,
    from,
    to,
    discipline,
    proposal,
    alert: proposal?.proposal?.alert === true || discipline.status !== 'ok',
  };
}

export async function proposeProgramNutritionStep(db: Database, userId: string) {
  const active = await db.query<{
    nutrition_phase: string | null;
    nutrition_pace: string | null;
  }>(
    `SELECT nutrition_phase, nutrition_pace FROM programs WHERE user_id = $1 AND active = true LIMIT 1`,
    [userId],
  );
  const phaseRaw = active.rows[0]?.nutrition_phase;
  if (phaseRaw === null || phaseRaw === undefined) {
    throw new ApiError(404, 'NUTRITION_PHASE_MISSING', 'Set a nutrition phase on the active program first');
  }
  let phase: NutritionPhase;
  let pace: NutritionPace | undefined;
  try {
    phase = assertNutritionPhase(phaseRaw);
    const paceRaw = active.rows[0]?.nutrition_pace;
    pace = paceRaw === null || paceRaw === undefined ? undefined : assertNutritionPace(paceRaw);
  } catch (error) {
    throw asApi(error);
  }
  const weights = await db.query<{ recorded_on: string; weight_grams: number }>(
    `SELECT recorded_on::text AS recorded_on, weight_grams
     FROM weight_records WHERE user_id = $1
     ORDER BY recorded_on DESC LIMIT 8`,
    [userId],
  );
  const samples = weights.rows
    .map((row) => ({ recordedOn: row.recorded_on.slice(0, 10), weightGrams: Number(row.weight_grams) }))
    .reverse();
  const windowDays = LOGGING_WINDOW_DAYS;
  const from = previousIsoDay(windowDays - 1);
  const to = new Date().toISOString().slice(0, 10);
  const diary = await diaryRangeFor(db, userId, from, to);
  const mealDaysLogged = diary.days.filter((day) => day.entryCount > 0).length;
  const water = await db.query<{ n: string }>(
    `SELECT COUNT(DISTINCT logged_on)::text AS n
     FROM water_logs
     WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [userId, from, to],
  );
  const waterDaysLogged = Number(water.rows[0]?.n ?? 0);
  let discipline;
  try {
    discipline = loggingDiscipline({ windowDays, mealDaysLogged, waterDaysLogged });
  } catch (error) {
    throw asApi(error);
  }
  try {
    return {
      phase,
      pace: pace ?? 'steady',
      proposal: proposeWeeklyNutritionStep({
        phase,
        pace,
        samples,
        mealAdherenceBps: discipline.mealAdherenceBps,
        waterAdherenceBps: discipline.waterAdherenceBps,
      }),
      discipline,
      applied: false,
      note: 'Proposal only. Confirm before changing the athlete plan.',
    };
  } catch (error) {
    throw asApi(error);
  }
}

function previousIsoDay(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function isoDayAgo(asOfDay: string, daysAgo: number): string {
  const date = new Date(`${asOfDay}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

/**
 * P1-STATE-01 — project MemberState from existing daily tables.
 * Authorized via member_state.read (own member only until coach assignment exists).
 */
export async function memberStateFor(
  db: Database,
  actor: Actor,
  options: { windowDays?: number; timeZone?: string; asOfDay?: string; subjectUserId?: string } = {},
): Promise<{ state: MemberState; authorized: true }> {
  const subjectUserId = options.subjectUserId ?? actor.userId;
  const assignmentRow =
    subjectUserId === actor.userId
      ? null
      : await db.query<{ coach_user_id: string; member_user_id: string; active: boolean; assigned_at: string }>(
          `SELECT coach_user_id, member_user_id, active, assigned_at
           FROM coach_member_assignments
           WHERE coach_user_id = $1 AND member_user_id = $2 AND active = true
           LIMIT 1`,
          [actor.userId, subjectUserId],
        ).catch(() => ({ rows: [] as { coach_user_id: string; member_user_id: string; active: boolean; assigned_at: string }[] }));
  const assignment =
    assignmentRow !== null && assignmentRow.rows[0] !== undefined
      ? {
          coachUserId: String(assignmentRow.rows[0].coach_user_id),
          memberUserId: String(assignmentRow.rows[0].member_user_id),
          active: assignmentRow.rows[0].active === true,
          assignedAt: iso(assignmentRow.rows[0].assigned_at) ?? new Date().toISOString(),
        }
      : null;
  const consentGranted =
    subjectUserId === actor.userId || actor.roles.includes('admin')
      ? true
      : await hasCoachShareConsent(db, subjectUserId);
  try {
    assertCanReadMemberStateFor(actor, subjectUserId, assignment, {
      coachShareConsentGranted: consentGranted,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      // Uniform denial — do not leak assignment/consent/existence details.
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    throw error;
  }
  if (subjectUserId !== actor.userId) {
    await writeCoachAccessAudit(db, actor.userId, subjectUserId, 'member_state.read');
  }

  const windowDays = options.windowDays ?? LOGGING_WINDOW_DAYS;
  const timeZone = options.timeZone ?? 'Asia/Riyadh';
  const asOfDay = options.asOfDay ?? calendarDayInTimeZone(new Date().toISOString(), timeZone);
  const from = isoDayAgo(asOfDay, windowDays - 1);

  const profile = await readProfile(db, subjectUserId);
  const programs = await listMemberPrograms(db, subjectUserId);
  const active = programs.active;

  const foodDays = await db.query<{ logged_on: string }>(
    `SELECT DISTINCT logged_on::text AS logged_on FROM food_entries
     WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [subjectUserId, from, asOfDay],
  );
  const waterDays = await db.query<{ logged_on: string }>(
    `SELECT DISTINCT logged_on::text AS logged_on FROM water_logs
     WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [subjectUserId, from, asOfDay],
  );
  const weights = await db.query<{ id: string; recorded_on: string; weight_grams: number; created_at: string }>(
    `SELECT id::text AS id, recorded_on::text AS recorded_on, weight_grams, created_at
     FROM weight_records
     WHERE user_id = $1 AND recorded_on BETWEEN $2::date AND $3::date
     ORDER BY recorded_on, created_at`,
    [subjectUserId, from, asOfDay],
  );
  const sessions = await db.query<{ id: string; completed_at: string }>(
    `SELECT id::text AS id, completed_at
     FROM workout_sessions
     WHERE user_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
       AND completed_at::date BETWEEN $2::date AND $3::date`,
    [subjectUserId, from, asOfDay],
  );
  const supplements = await db.query<{ id: string; logged_on: string; created_at: string }>(
    `SELECT id::text AS id, logged_on::text AS logged_on, created_at
     FROM supplement_logs
     WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [subjectUserId, from, asOfDay],
  );
  const activities = await db.query<{ id: string; logged_on: string; duration_seconds: number; created_at: string }>(
    `SELECT id::text AS id, logged_on::text AS logged_on, duration_seconds, created_at
     FROM activity_logs
     WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [subjectUserId, from, asOfDay],
  );
  const measurements = await db.query<{ id: string; recorded_on: string; created_at: string }>(
    `SELECT id::text AS id, recorded_on::text AS recorded_on, created_at
     FROM body_measurements
     WHERE user_id = $1 AND recorded_on BETWEEN $2::date AND $3::date`,
    [subjectUserId, from, asOfDay],
  );
  const pending = await db.query<{ id: string; status: string; category: string }>(
    `SELECT id::text AS id, status, category FROM coaching_recommendations
     WHERE user_id = $1 AND status IN ('DRAFT', 'VALIDATED', 'REVIEW_REQUIRED', 'MEMBER_CONFIRMATION_REQUIRED', 'APPROVED')
     ORDER BY updated_at DESC LIMIT 20`,
    [subjectUserId],
  ).catch(() => ({ rows: [] as { id: string; status: string; category: string }[] }));

  const humanReview = await db.query<{ created_at: string }>(
    `SELECT created_at FROM coach_weekly_briefs
     WHERE user_id = $1 AND status IN ('seen_by_human', 'closed')
     ORDER BY created_at DESC LIMIT 1`,
    [subjectUserId],
  ).catch(() => ({ rows: [] as { created_at: string }[] }));

  const events: RawMemberEvent[] = [];
  for (const row of foodDays.rows) {
    const day = row.logged_on.slice(0, 10);
    events.push({
      eventId: `meal:${subjectUserId}:${day}`,
      memberId: subjectUserId,
      eventType: 'meal_day',
      occurredAt: `${day}T12:00:00.000Z`,
      recordedAt: `${day}T12:00:00.000Z`,
      source: 'food_entries',
      schemaVersion: 1,
      confidenceBps: 8_000,
      provenance: 'self_reported',
      payload: { observedOn: day },
    });
  }
  for (const row of waterDays.rows) {
    const day = row.logged_on.slice(0, 10);
    events.push({
      eventId: `water:${subjectUserId}:${day}`,
      memberId: subjectUserId,
      eventType: 'water_day',
      occurredAt: `${day}T12:00:00.000Z`,
      recordedAt: `${day}T12:00:00.000Z`,
      source: 'water_logs',
      schemaVersion: 1,
      confidenceBps: 8_000,
      provenance: 'self_reported',
      payload: { observedOn: day },
    });
  }
  for (const row of weights.rows) {
    const day = row.recorded_on.slice(0, 10);
    const recordedAt = iso(row.created_at) ?? `${day}T12:00:00.000Z`;
    events.push({
      eventId: `weight:${row.id}`,
      memberId: subjectUserId,
      eventType: 'weight',
      occurredAt: `${day}T12:00:00.000Z`,
      recordedAt,
      source: 'weight_records',
      schemaVersion: 1,
      confidenceBps: 9_000,
      provenance: 'self_reported',
      payload: { observedOn: day, value: Number(row.weight_grams), weightGrams: Number(row.weight_grams) },
    });
  }
  for (const row of sessions.rows) {
    const completedAt = iso(row.completed_at) ?? new Date().toISOString();
    const day = calendarDayInTimeZone(completedAt, timeZone);
    events.push({
      eventId: `session:${row.id}`,
      memberId: subjectUserId,
      eventType: 'session_completed',
      occurredAt: completedAt,
      recordedAt: completedAt,
      source: 'workout_sessions',
      schemaVersion: 1,
      confidenceBps: 9_000,
      provenance: 'measured',
      payload: { observedOn: day },
    });
  }
  for (const row of supplements.rows) {
    const day = row.logged_on.slice(0, 10);
    const recordedAt = iso(row.created_at) ?? `${day}T12:00:00.000Z`;
    events.push({
      eventId: `supp:${row.id}`,
      memberId: subjectUserId,
      eventType: 'supplement_taken',
      occurredAt: `${day}T12:00:00.000Z`,
      recordedAt,
      source: 'supplement_logs',
      schemaVersion: 1,
      confidenceBps: 8_000,
      provenance: 'self_reported',
      payload: { observedOn: day },
    });
  }
  for (const row of activities.rows) {
    const day = row.logged_on.slice(0, 10);
    const recordedAt = iso(row.created_at) ?? `${day}T12:00:00.000Z`;
    events.push({
      eventId: `activity:${row.id}`,
      memberId: subjectUserId,
      eventType: 'activity_minutes',
      occurredAt: `${day}T12:00:00.000Z`,
      recordedAt,
      source: 'activity_logs',
      schemaVersion: 1,
      confidenceBps: 7_000,
      provenance: 'self_reported',
      payload: { observedOn: day, value: Number(row.duration_seconds), durationSeconds: Number(row.duration_seconds) },
    });
  }
  for (const row of measurements.rows) {
    const day = row.recorded_on.slice(0, 10);
    const recordedAt = iso(row.created_at) ?? `${day}T12:00:00.000Z`;
    events.push({
      eventId: `measure:${row.id}`,
      memberId: subjectUserId,
      eventType: 'measurement',
      occurredAt: `${day}T12:00:00.000Z`,
      recordedAt,
      source: 'body_measurements',
      schemaVersion: 1,
      confidenceBps: 8_000,
      provenance: 'self_reported',
      payload: { observedOn: day },
    });
  }

  let state: MemberState;
  try {
    state = assembleMemberState({
      goals: profile.goals,
      currentProgramId: active?.id ?? null,
      nutritionPhase: active?.nutritionPhase ?? null,
      windowDays,
      asOfDay,
      timeZone,
      events,
      lastHumanReviewAt: humanReview.rows[0] !== undefined ? iso(humanReview.rows[0].created_at) : null,
      pendingRecommendations: pending.rows.map((row) => ({
        id: row.id,
        status: row.status as MemberState['pendingRecommendations'][number]['status'],
        category: row.category,
      })),
    });
  } catch (error) {
    throw asApi(error);
  }
  return { state, authorized: true };
}

type RecommendationDbRow = {
  id: string;
  user_id: string;
  category: string;
  status: string;
  summary: string;
  rationale: string;
  confidence: string;
  missing_data: unknown;
  evidence: unknown;
  policy_version: string;
  expires_at: string;
  payload: unknown;
  requires_human_review: boolean;
  requires_member_confirmation: boolean;
  safety_class?: string | null;
  audit: unknown;
  created_at: string;
  updated_at: string;
};

function recommendationRowToDomain(row: RecommendationDbRow): CoachingRecommendation {
  const requiresHumanReview = row.requires_human_review === true;
  const requiresMemberConfirmation = row.requires_member_confirmation === true;
  const category = row.category as CoachingRecommendation['category'];
  const fallbackSafety =
    category === 'human_required' || category === 'nutrition'
      ? 'blocked_policy'
      : requiresHumanReview
        ? 'human_review'
        : requiresMemberConfirmation
          ? 'member_confirm'
          : 'safe_guidance';
  return {
    id: String(row.id),
    memberId: String(row.user_id),
    category,
    status: row.status as CoachingRecommendation['status'],
    summary: row.summary,
    rationale: row.rationale,
    confidence: row.confidence as CoachingRecommendation['confidence'],
    missingData: asJson<string[]>(row.missing_data),
    evidence: asJson<CoachingRecommendation['evidence'][number][]>(row.evidence),
    policyVersion: row.policy_version,
    expiresAt: iso(row.expires_at) ?? row.expires_at,
    payload: asJson<Record<string, unknown>>(row.payload),
    requiresHumanReview,
    requiresMemberConfirmation,
    safetyClass: (row.safety_class as CoachingRecommendation['safetyClass'] | null | undefined) ?? fallbackSafety,
    createdAt: iso(row.created_at) ?? row.created_at,
    updatedAt: iso(row.updated_at) ?? row.updated_at,
    schemaVersion: 2,
    audit: asJson<CoachingRecommendation['audit'][number][]>(row.audit),
  };
}

async function persistRecommendation(db: Database, rec: CoachingRecommendation): Promise<void> {
  await db.query(
    `INSERT INTO coaching_recommendations (
       id, user_id, category, status, summary, rationale, confidence, missing_data, evidence,
       policy_version, expires_at, payload, requires_human_review, requires_member_confirmation,
       safety_class, audit, schema_version, created_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13,$14,$15,$16::jsonb,2,$17,$18
     )
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       summary = EXCLUDED.summary,
       rationale = EXCLUDED.rationale,
       confidence = EXCLUDED.confidence,
       missing_data = EXCLUDED.missing_data,
       evidence = EXCLUDED.evidence,
       payload = EXCLUDED.payload,
       requires_human_review = EXCLUDED.requires_human_review,
       requires_member_confirmation = EXCLUDED.requires_member_confirmation,
       safety_class = EXCLUDED.safety_class,
       audit = EXCLUDED.audit,
       updated_at = EXCLUDED.updated_at`,
    [
      rec.id,
      rec.memberId,
      rec.category,
      rec.status,
      rec.summary,
      rec.rationale,
      rec.confidence,
      JSON.stringify(rec.missingData),
      JSON.stringify(rec.evidence),
      rec.policyVersion,
      rec.expiresAt,
      JSON.stringify(rec.payload),
      rec.requiresHumanReview,
      rec.requiresMemberConfirmation,
      rec.safetyClass,
      JSON.stringify(rec.audit),
      rec.createdAt,
      rec.updatedAt,
    ],
  );
}

async function loadMemberRecommendationRows(db: Database, userId: string): Promise<CoachingRecommendation[]> {
  const rows = await db.query<RecommendationDbRow>(
    `SELECT * FROM coaching_recommendations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
    [userId],
  );
  return rows.rows.map(recommendationRowToDomain);
}

async function loadActiveProgramVersion(
  db: Database,
  userId: string,
): Promise<{
  programId: string;
  version: number;
  versionId: string;
  template: unknown;
  templateId: string | null;
} | null> {
  const program = await db.query<{ id: string; template_id: string | null }>(
    `SELECT id, template_id FROM programs WHERE user_id = $1 AND active = true LIMIT 1`,
    [userId],
  );
  const row = program.rows[0];
  if (row === undefined) return null;
  const version = await db.query<{ id: string; version: number; template: unknown }>(
    `SELECT id, version, template FROM program_versions WHERE program_id = $1 ORDER BY version DESC LIMIT 1`,
    [row.id],
  );
  const ver = version.rows[0];
  if (ver === undefined) return null;
  return {
    programId: row.id,
    version: Number(ver.version),
    versionId: ver.id,
    template: ver.template,
    templateId: row.template_id,
  };
}

/** Generate deterministic recommendations from MemberState; nutrition stays non-applied. */
export async function generateMemberRecommendations(db: Database, actor: Actor) {
  const { state } = await memberStateFor(db, actor, { timeZone: 'Asia/Riyadh' });
  const nowIso = new Date().toISOString();
  const existing = await loadMemberRecommendationRows(db, actor.userId);
  for (const expired of expireOpenRecommendations(existing, nowIso)) {
    if (expired.status === 'EXPIRED' && existing.find((row) => row.id === expired.id)?.status !== 'EXPIRED') {
      await persistRecommendation(db, expired);
    }
  }
  const refreshed = await loadMemberRecommendationRows(db, actor.userId);
  const activeProgram = await loadActiveProgramVersion(db, actor.userId);
  let drafts: CoachingRecommendation[];
  try {
    const validated = generateRecommendationsFromMemberState({
      memberId: actor.userId,
      state,
      nowIso,
      idFactory: () => randomUUID(),
    }).map((draft) => {
      const withProgram =
        draft.category === 'training' && activeProgram !== null
          ? {
              ...draft,
              payload: {
                ...draft.payload,
                expectedProgramVersion: activeProgram.version,
                programId: activeProgram.programId,
              },
            }
          : draft;
      return validateRecommendation(withProgram, nowIso, 'system:recommendation_engine');
    });
    drafts = prioritizeRecommendations(suppressDuplicateRecommendations(refreshed, validated));
  } catch (error) {
    throw asApi(error);
  }
  for (const rec of drafts) {
    await persistRecommendation(db, rec);
  }
  return {
    persisted: true,
    count: drafts.length,
    recommendations: drafts,
    suppressedDuplicates: true,
    note: 'Nutrition adaptations remain propose/review-only until ENERGY_POLICY approval. AI cannot apply.',
  };
}

export async function listMemberRecommendations(db: Database, actor: Actor) {
  await memberStateFor(db, actor, { timeZone: 'Asia/Riyadh' });
  const nowIso = new Date().toISOString();
  const rows = await loadMemberRecommendationRows(db, actor.userId);
  const expired = expireOpenRecommendations(rows, nowIso);
  for (const rec of expired) {
    const prior = rows.find((row) => row.id === rec.id);
    if (prior !== undefined && prior.status !== rec.status) {
      await persistRecommendation(db, rec);
    }
  }
  return { recommendations: prioritizeRecommendations(await loadMemberRecommendationRows(db, actor.userId)) };
}

export async function previewTrainingRecommendationApply(db: Database, actor: Actor, recommendationId: string) {
  const rows = await db.query<RecommendationDbRow>(
    `SELECT * FROM coaching_recommendations WHERE id = $1 AND user_id = $2`,
    [recommendationId, actor.userId],
  );
  const row = rows.rows[0];
  if (row === undefined) {
    throw new ApiError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
  }
  const rec = recommendationRowToDomain(row);
  const active = await loadActiveProgramVersion(db, actor.userId);
  if (active === null) {
    throw new ApiError(422, 'NO_ACTIVE_PROGRAM', 'Activate a training program before applying adaptations');
  }
  try {
    const plan = buildProgramAdaptationPlan({
      recommendation: rec,
      currentDocument: parseProgramVersionDocument(
        active.template ?? { templateId: active.templateId, days: [] },
      ),
      currentVersion: active.version,
      at: new Date().toISOString(),
      preview: true,
    });
    return {
      previewOnly: true,
      programId: active.programId,
      currentVersion: active.version,
      diff: plan.diff,
      note: 'No program mutation performed. Confirm then POST advance with status=APPLIED.',
    };
  } catch (error) {
    throw asApi(error);
  }
}

type AdaptationApplicationRow = {
  id: string;
  to_version: number;
  to_version_id: string;
  diff: unknown;
};

async function loadAdaptationApplication(
  db: Database,
  recommendationId: string,
  ownerUserId: string,
): Promise<AdaptationApplicationRow | null> {
  // Owner-scoped: never surface adaptation audit/diff for another member's recommendation.
  const existing = await db.query<AdaptationApplicationRow>(
    `SELECT a.id::text AS id, a.to_version, a.to_version_id::text AS to_version_id, a.diff
     FROM program_adaptation_applications a
     INNER JOIN coaching_recommendations r ON r.id = a.recommendation_id
     WHERE a.recommendation_id = $1 AND r.user_id = $2`,
    [recommendationId, ownerUserId],
  );
  return existing.rows[0] ?? null;
}

async function idempotentAdaptationResponse(
  db: Database,
  actor: Actor,
  recommendationId: string,
  existing: AdaptationApplicationRow,
) {
  const rows = await db.query<RecommendationDbRow>(
    `SELECT * FROM coaching_recommendations WHERE id = $1 AND user_id = $2`,
    [recommendationId, actor.userId],
  );
  const row = rows.rows[0];
  if (row === undefined) {
    throw new ApiError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
  }
  const rec = recommendationRowToDomain(row);
  return {
    persisted: true,
    idempotent: true,
    recommendation: rec,
    applied: rec.status === 'APPLIED',
    programVersion: Number(existing.to_version),
    programVersionId: existing.to_version_id,
    diff: existing.diff,
  };
}

/**
 * Transactional training apply: bump program_versions, audit row, then mark recommendation APPLIED.
 * Idempotent on recommendation_id (unique constraint + FOR UPDATE). Never marks APPLIED if mutation fails.
 */
export async function applyTrainingRecommendationToProgram(
  db: Database,
  actor: Actor,
  recommendationId: string,
) {
  const existingApply = await loadAdaptationApplication(db, recommendationId, actor.userId);
  if (existingApply !== null) {
    return idempotentAdaptationResponse(db, actor, recommendationId, existingApply);
  }

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx.query<RecommendationDbRow>(
        `SELECT * FROM coaching_recommendations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [recommendationId, actor.userId],
      );
      const row = rows.rows[0];
      if (row === undefined) {
        throw new ApiError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
      }

      // Re-check under row lock so concurrent / retry storms return idempotent success.
      const lockedExisting = await loadAdaptationApplication(tx, recommendationId, actor.userId);
      if (lockedExisting !== null) {
        return idempotentAdaptationResponse(tx, actor, recommendationId, lockedExisting);
      }

      let current = recommendationRowToDomain(row);
      const at = new Date().toISOString();
      if (current.status === 'APPLIED') {
        throw new ApiError(422, 'ALREADY_APPLIED_WITHOUT_AUDIT', 'Recommendation is APPLIED but adaptation audit is missing');
      }
      if (current.status === 'MEMBER_CONFIRMATION_REQUIRED') {
        current = memberConfirmRecommendation(current, at, actor.userId);
      }
      if (current.status !== 'APPROVED') {
        throw new ApiError(422, 'NOT_APPROVED', 'Only APPROVED training recommendations may be applied');
      }
      if (current.category !== 'training') {
        throw new ApiError(422, 'NOT_TRAINING_ADAPTATION', 'Use standard advance for non-training recommendations');
      }

      const program = await tx.query<{ id: string; template_id: string | null }>(
        `SELECT id, template_id FROM programs WHERE user_id = $1 AND active = true LIMIT 1 FOR UPDATE`,
        [actor.userId],
      );
      const programRow = program.rows[0];
      if (programRow === undefined) {
        throw new ApiError(422, 'NO_ACTIVE_PROGRAM', 'Activate a training program before applying adaptations');
      }
      const version = await tx.query<{ id: string; version: number; template: unknown }>(
        `SELECT id, version, template FROM program_versions WHERE program_id = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
        [programRow.id],
      );
      const ver = version.rows[0];
      if (ver === undefined) {
        throw new ApiError(422, 'NO_PROGRAM_VERSION', 'Program has no version to adapt');
      }

      let plan;
      try {
        plan = buildProgramAdaptationPlan({
          recommendation: current,
          currentDocument: parseProgramVersionDocument(
            ver.template ?? { templateId: programRow.template_id, days: [] },
          ),
          currentVersion: Number(ver.version),
          at,
        });
      } catch (error) {
        throw asApi(error);
      }

      const nextVersion = Number(ver.version) + 1;
      const nextVersionId = randomUUID();
      const applicationId = randomUUID();
      await tx.query(
        `INSERT INTO program_versions (id, program_id, version, source, template)
         VALUES ($1, $2, $3, 'approved_rules', $4::jsonb)`,
        [nextVersionId, programRow.id, nextVersion, JSON.stringify(plan.nextDocument)],
      );
      await tx.query(
        `INSERT INTO program_adaptation_applications (
           id, recommendation_id, program_id, from_version, to_version,
           from_version_id, to_version_id, kind, diff, actor_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [
          applicationId,
          recommendationId,
          programRow.id,
          Number(ver.version),
          nextVersion,
          ver.id,
          nextVersionId,
          plan.overlay.kind,
          JSON.stringify(plan.diff),
          actor.userId,
        ],
      );

      const applied = transitionRecommendation(
        {
          ...current,
          payload: {
            ...current.payload,
            lastApplyEffect: {
              kind: plan.overlay.kind,
              programMutation: 'program_version_bumped',
              fromVersion: Number(ver.version),
              toVersion: nextVersion,
              toVersionId: nextVersionId,
              punitiveForbidden: true,
            },
            lastAppliedAt: at,
          },
        },
        'APPLIED',
        at,
        { actorId: actor.userId, note: `program_version_${nextVersion}` },
      );
      await tx.query(
        `UPDATE coaching_recommendations SET
           status = $2, payload = $3::jsonb, audit = $4::jsonb, updated_at = $5::timestamptz
         WHERE id = $1 AND user_id = $6`,
        [
          applied.id,
          applied.status,
          JSON.stringify(applied.payload),
          JSON.stringify(applied.audit),
          applied.updatedAt,
          actor.userId,
        ],
      );

      return {
        persisted: true,
        idempotent: false,
        recommendation: applied,
        applied: true,
        programId: programRow.id,
        programVersion: nextVersion,
        programVersionId: nextVersionId,
        diff: plan.diff,
        applyResult: {
          applied: true as const,
          kind: plan.overlay.kind,
          effect: {
            programMutation: 'program_version_bumped',
            fromVersion: Number(ver.version),
            toVersion: nextVersion,
          },
          monitoredFrom: at,
        },
      };
    });
  } catch (error) {
    // Unique recommendation_id race: peer committed first — return idempotent read.
    const code =
      error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code === '23505') {
      const raced = await loadAdaptationApplication(db, recommendationId, actor.userId);
      if (raced !== null) {
        return idempotentAdaptationResponse(db, actor, recommendationId, raced);
      }
    }
    throw error;
  }
}

export async function advanceMemberRecommendation(
  db: Database,
  actor: Actor,
  recommendationId: string,
  nextStatus: 'APPROVED' | 'REJECTED' | 'APPLIED' | 'MEMBER_CONFIRMATION_REQUIRED' | 'MONITORED' | 'CANCELED' | 'REVERTED',
) {
  const rows = await db.query<RecommendationDbRow>(
    `SELECT * FROM coaching_recommendations WHERE id = $1 AND user_id = $2`,
    [recommendationId, actor.userId],
  );
  const row = rows.rows[0];
  if (row === undefined) {
    throw new ApiError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
  }
  let current = recommendationRowToDomain(row);
  const at = new Date().toISOString();
  let applyResult: ReturnType<typeof applyPermittedRecommendation>['result'] | null = null;
  let programDiff: unknown = null;
  try {
    if (nextStatus === 'APPROVED') {
      // Members may only confirm their own MEMBER_CONFIRMATION_REQUIRED items.
      // REVIEW_REQUIRED → APPROVED is coachDecideRecommendation only.
      if (current.status === 'REVIEW_REQUIRED') {
        throw new ApiError(
          403,
          'HUMAN_REVIEW_REQUIRED',
          'A human coach must approve recommendations that require human review',
        );
      }
      if (current.status !== 'MEMBER_CONFIRMATION_REQUIRED' && current.status !== 'APPROVED') {
        throw new ApiError(422, 'INVALID_TRANSITION', 'Member cannot approve from this status');
      }
      current = memberConfirmRecommendation(current, at, actor.userId);
    } else if (nextStatus === 'APPLIED') {
      if (current.category === 'training') {
        return applyTrainingRecommendationToProgram(db, actor, recommendationId);
      }
      const applied = applyPermittedRecommendation(current, at, actor.userId);
      current = applied.recommendation;
      applyResult = applied.result;
    } else if (nextStatus === 'MONITORED') {
      current = beginMonitoringRecommendation(current, at, actor.userId);
    } else {
      current = transitionRecommendation(current, nextStatus, at, {
        actorId: actor.userId,
        note: 'member_or_system_advance',
      });
    }
  } catch (error) {
    throw asApi(error);
  }
  await persistRecommendation(db, current);
  return {
    persisted: true,
    recommendation: current,
    applied: current.status === 'APPLIED',
    applyResult,
    diff: programDiff,
  };
}

const KNOWN_ROLES: readonly Role[] = [
  'member',
  'gym_owner',
  'gym_branch_manager',
  'support_agent',
  'coach_reviewer',
  'coach_supervisor',
  'finance',
  'moderator',
  'admin',
];

async function loadUserRolesStatus(
  db: Database,
  userId: string,
): Promise<{ roles: Role[]; status: 'active' | 'inactive' } | null> {
  const users = await db.query<{ status: string }>(
    `SELECT status FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const user = users.rows[0];
  if (user === undefined) return null;
  const assigned = await db.query<{ role: string }>(`SELECT role FROM role_assignments WHERE user_id = $1`, [userId]);
  const roles = assigned.rows
    .map((row) => row.role)
    .filter((role): role is Role => (KNOWN_ROLES as readonly string[]).includes(role));
  return { roles, status: user.status === 'active' ? 'active' : 'inactive' };
}

async function hasCoachShareConsent(db: Database, memberUserId: string): Promise<boolean> {
  const row = await db.query<{ status: string }>(
    `SELECT status FROM member_coach_share_consents
     WHERE member_user_id = $1 AND purpose = 'human_weekly_coaching_review' AND status = 'granted'
     LIMIT 1`,
    [memberUserId],
  ).catch(() => ({ rows: [] as { status: string }[] }));
  return row.rows[0]?.status === 'granted';
}

async function writeCoachAccessAudit(
  db: Database,
  coachUserId: string,
  memberUserId: string,
  action: string,
): Promise<void> {
  await db.query(
    `INSERT INTO coach_access_audit (coach_user_id, member_user_id, action) VALUES ($1, $2, $3)`,
    [coachUserId, memberUserId, action],
  );
}

/** Uniform denial for missing or unauthorized review IDs — no existence oracle. */
function denyReviewAccess(): never {
  throw new ApiError(403, 'FORBIDDEN', 'Access denied');
}

const CONSENT_JOIN = `INNER JOIN member_coach_share_consents c
  ON c.member_user_id = a.member_user_id
 AND c.purpose = 'human_weekly_coaching_review'
 AND c.status = 'granted'`;

async function requireAssignedCoach(
  db: Database,
  actor: Actor,
  memberUserId: string,
): Promise<void> {
  if (actor.roles.includes('admin')) return;
  const assignment = await db.query<{ id: string }>(
    `SELECT id FROM coach_member_assignments
     WHERE coach_user_id = $1 AND member_user_id = $2 AND active = true LIMIT 1`,
    [actor.userId, memberUserId],
  );
  if (assignment.rows[0] === undefined) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  if (!(await hasCoachShareConsent(db, memberUserId))) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
}

/** Admin/supervisor only — never self-serve assignment. */
export async function assignCoachToMember(
  db: Database,
  actor: Actor,
  coachUserId: string,
  memberUserId: string,
  reason = '',
) {
  try {
    assertCanManageCoachAssignments(actor);
    assertNotSelfRolePromotion(actor, coachUserId);
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    throw error;
  }
  const coach = await loadUserRolesStatus(db, coachUserId);
  const member = await loadUserRolesStatus(db, memberUserId);
  if (coach === null || member === null) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  try {
    assertCoachEligibleForAssignment(coach.roles, coach.status);
    assertMemberEligibleForAssignment(member.roles, member.status);
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    throw error;
  }

  const previous = await db.query<{ coach_user_id: string }>(
    `SELECT coach_user_id FROM coach_member_assignments
     WHERE member_user_id = $1 AND active = true AND coach_user_id <> $2`,
    [memberUserId, coachUserId],
  );
  const previousCoachId = previous.rows[0]?.coach_user_id ?? null;
  if (previousCoachId !== null) {
    await db.query(
      `UPDATE coach_member_assignments SET active = false WHERE member_user_id = $1 AND active = true`,
      [memberUserId],
    );
  }

  await db.query(
    `INSERT INTO coach_member_assignments (coach_user_id, member_user_id, active)
     VALUES ($1, $2, true)
     ON CONFLICT (coach_user_id, member_user_id) DO UPDATE SET active = true, assigned_at = now()`,
    [coachUserId, memberUserId],
  );
  await db.query(
    `INSERT INTO coach_assignment_events (actor_user_id, coach_user_id, member_user_id, action, reason, previous_coach_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      actor.userId,
      coachUserId,
      memberUserId,
      previousCoachId === null ? 'assign' : 'reassign',
      reason.slice(0, 500),
      previousCoachId,
    ],
  );
  await writeCoachAccessAudit(db, actor.userId, memberUserId, 'assignment.write');
  return {
    persisted: true,
    coachUserId,
    memberUserId,
    active: true,
    reassigned: previousCoachId !== null,
    previousCoachUserId: previousCoachId,
  };
}

export async function revokeCoachAssignment(
  db: Database,
  actor: Actor,
  coachUserId: string,
  memberUserId: string,
  reason = '',
) {
  try {
    assertCanManageCoachAssignments(actor);
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    throw error;
  }
  const updated = await db.query<{ id: string }>(
    `UPDATE coach_member_assignments SET active = false
     WHERE coach_user_id = $1 AND member_user_id = $2 AND active = true
     RETURNING id`,
    [coachUserId, memberUserId],
  );
  if (updated.rows[0] === undefined) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  await db.query(
    `INSERT INTO coach_assignment_events (actor_user_id, coach_user_id, member_user_id, action, reason)
     VALUES ($1, $2, $3, 'revoke', $4)`,
    [actor.userId, coachUserId, memberUserId, reason.slice(0, 500)],
  );
  await writeCoachAccessAudit(db, actor.userId, memberUserId, 'assignment.write');
  return { persisted: true, coachUserId, memberUserId, active: false };
}

export async function listCoachAssignmentsForActor(db: Database, actor: Actor) {
  // Supervisors/admins see all active assignments (ops roster). Coaches only see consented members.
  if (actor.roles.includes('admin') || actor.roles.includes('coach_supervisor')) {
    const rows = await db.query<{
      coach_user_id: string;
      member_user_id: string;
      active: boolean;
      assigned_at: string;
      consent_granted: boolean;
    }>(
      `SELECT a.coach_user_id, a.member_user_id, a.active, a.assigned_at,
              EXISTS (
                SELECT 1 FROM member_coach_share_consents c
                WHERE c.member_user_id = a.member_user_id
                  AND c.purpose = 'human_weekly_coaching_review'
                  AND c.status = 'granted'
              ) AS consent_granted
       FROM coach_member_assignments a
       WHERE a.active = true
       ORDER BY a.assigned_at DESC
       LIMIT 200`,
    );
    return {
      assignments: rows.rows.map((row) => ({
        coachUserId: String(row.coach_user_id),
        memberUserId: String(row.member_user_id),
        active: row.active,
        assignedAt: iso(row.assigned_at) ?? row.assigned_at,
        consentGranted: row.consent_granted === true,
      })),
    };
  }
  if (!actor.roles.includes('coach_reviewer')) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  const rows = await db.query<{
    coach_user_id: string;
    member_user_id: string;
    active: boolean;
    assigned_at: string;
  }>(
    `SELECT a.coach_user_id, a.member_user_id, a.active, a.assigned_at
     FROM coach_member_assignments a
     ${CONSENT_JOIN}
     WHERE a.coach_user_id = $1 AND a.active = true
     ORDER BY a.assigned_at DESC`,
    [actor.userId],
  );
  return {
    assignments: rows.rows.map((row) => ({
      coachUserId: String(row.coach_user_id),
      memberUserId: String(row.member_user_id),
      active: row.active,
      assignedAt: iso(row.assigned_at) ?? row.assigned_at,
      consentGranted: true as const,
    })),
  };
}

export async function grantCoachShareConsent(db: Database, actor: Actor) {
  await db.query(
    `INSERT INTO member_coach_share_consents (
       member_user_id, purpose, policy_version, status, granted_at, withdrawn_at, evidence_reference
     ) VALUES ($1, 'human_weekly_coaching_review', $2, 'granted', now(), NULL, 'in_app_acknowledgement')
     ON CONFLICT (member_user_id, purpose) DO UPDATE
       SET status = 'granted', policy_version = EXCLUDED.policy_version,
           granted_at = now(), withdrawn_at = NULL`,
    [actor.userId, COACH_SHARE_POLICY_VERSION],
  );
  return {
    persisted: true,
    purpose: 'human_weekly_coaching_review' as const,
    status: 'granted' as const,
    policyVersion: COACH_SHARE_POLICY_VERSION,
    disclosure:
      'An assigned human coach may see goals, approved plan, training adherence, weight trends, nutrition patterns, survey sleep when provided, your questions, data completeness, Yazan proposals, and safety flags. Daily sleep hours are unavailable until logging exists.',
  };
}

export async function withdrawCoachShareConsent(db: Database, actor: Actor) {
  await db.query(
    `INSERT INTO member_coach_share_consents (
       member_user_id, purpose, policy_version, status, granted_at, withdrawn_at, evidence_reference
     ) VALUES ($1, 'human_weekly_coaching_review', $2, 'withdrawn', NULL, now(), 'in_app_acknowledgement')
     ON CONFLICT (member_user_id, purpose) DO UPDATE
       SET status = 'withdrawn', withdrawn_at = now()`,
    [actor.userId, COACH_SHARE_POLICY_VERSION],
  );
  return {
    persisted: true,
    purpose: 'human_weekly_coaching_review' as const,
    status: 'withdrawn' as const,
    policyVersion: COACH_SHARE_POLICY_VERSION,
  };
}

export async function coachShareConsentFor(db: Database, actor: Actor) {
  const row = await db.query<{ status: string; policy_version: string; granted_at: string | null }>(
    `SELECT status, policy_version, granted_at FROM member_coach_share_consents
     WHERE member_user_id = $1 AND purpose = 'human_weekly_coaching_review' LIMIT 1`,
    [actor.userId],
  );
  const found = row.rows[0];
  return {
    purpose: 'human_weekly_coaching_review' as const,
    status: found?.status ?? 'none',
    policyVersion: found?.policy_version ?? COACH_SHARE_POLICY_VERSION,
    grantedAt: found?.granted_at ?? null,
    disclosure:
      'An assigned human coach may see coaching packet data listed in the grant response. Legal basis review remains blocked (P0-PRIV).',
  };
}

async function loadWeeklyReview(
  db: Database,
  reviewId: string,
): Promise<{
  id: string;
  memberUserId: string;
  coachUserId: string | null;
  weekOf: string;
  status: WeeklyReviewStatus;
  updatedAt: string;
  packet: unknown;
} | null> {
  const rows = await db.query<{
    id: string;
    member_user_id: string;
    coach_user_id: string | null;
    week_of: string;
    status: string;
    updated_at: string;
    packet: unknown;
  }>(
    `SELECT id::text AS id, member_user_id, coach_user_id, week_of::text AS week_of, status, updated_at, packet
     FROM weekly_review_queue WHERE id = $1`,
    [reviewId],
  );
  const row = rows.rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    memberUserId: String(row.member_user_id),
    coachUserId: row.coach_user_id === null ? null : String(row.coach_user_id),
    weekOf: row.week_of.slice(0, 10),
    status: row.status as WeeklyReviewStatus,
    updatedAt: iso(row.updated_at) ?? row.updated_at,
    packet: row.packet,
  };
}

async function persistWeeklyReviewTransition(
  db: Database,
  actor: Actor,
  reviewId: string,
  next: WeeklyReviewStatus,
  note: string,
  coachUserId?: string | null,
) {
  const current = await loadWeeklyReview(db, reviewId);
  if (current === null) {
    throw new ApiError(404, 'REVIEW_NOT_FOUND', 'Weekly review not found');
  }
  const at = new Date().toISOString();
  let transitioned;
  try {
    transitioned = transitionWeeklyReview(
      {
        id: current.id,
        memberUserId: current.memberUserId,
        coachUserId: current.coachUserId,
        weekOf: current.weekOf,
        status: current.status,
        updatedAt: current.updatedAt,
      },
      next,
      at,
      coachUserId,
    );
  } catch (error) {
    throw asApi(error);
  }
  await db.query(
    `UPDATE weekly_review_queue
     SET status = $2, coach_user_id = $3, updated_at = $4::timestamptz
     WHERE id = $1`,
    [reviewId, transitioned.status, transitioned.coachUserId, at],
  );
  await db.query(
    `INSERT INTO weekly_review_events (review_id, actor_user_id, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [reviewId, actor.userId, current.status, transitioned.status, note.slice(0, 500)],
  );
  return { ...transitioned, packet: current.packet };
}

/** Prepare authorized weekly packet and queue for human review. */
export async function prepareWeeklyReviewForMember(
  db: Database,
  actor: Actor,
  memberUserId: string,
  weekOf: string,
) {
  if (!actor.roles.includes('admin') && actor.userId !== memberUserId) {
    await requireAssignedCoach(db, actor, memberUserId);
  }
  const stateActor: Actor =
    actor.userId === memberUserId || actor.roles.includes('admin')
      ? { userId: memberUserId, roles: ['member', ...actor.roles.filter((role) => role !== 'member')], gymOrganizationIds: actor.gymOrganizationIds }
      : actor;
  const stateResult = await memberStateFor(db, stateActor, {
    subjectUserId: memberUserId,
    timeZone: 'Asia/Riyadh',
    asOfDay: weekOf,
  });
  const recs = await db.query<{
    id: string;
    user_id: string;
    category: string;
    status: string;
    summary: string;
    rationale: string;
    confidence: string;
    missing_data: unknown;
    evidence: unknown;
    policy_version: string;
    expires_at: string;
    payload: unknown;
    requires_human_review: boolean;
    requires_member_confirmation: boolean;
    audit: unknown;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM coaching_recommendations WHERE user_id = $1 AND status IN ('REVIEW_REQUIRED', 'VALIDATED', 'DRAFT')
     ORDER BY updated_at DESC LIMIT 20`,
    [memberUserId],
  );
  const survey = await db.query<{ survey: unknown }>(
    `SELECT survey FROM coach_weekly_briefs WHERE user_id = $1 AND week_of = $2::date LIMIT 1`,
    [memberUserId, weekOf],
  );
  const surveyObj =
    survey.rows[0] === undefined
      ? null
      : asJson<{ sleep?: number; questionForCoach?: string; difficulties?: string }>(survey.rows[0].survey);
  const surveySleep = surveyObj !== null && typeof surveyObj.sleep === 'number' ? surveyObj.sleep : null;
  const memberQuestions = [
    ...stateResult.state.openCoachingQuestions,
    ...(surveyObj?.questionForCoach && surveyObj.questionForCoach.trim().length > 0
      ? [surveyObj.questionForCoach.trim()]
      : []),
    ...(surveyObj?.difficulties && surveyObj.difficulties.trim().length > 0
      ? [`Difficulties: ${surveyObj.difficulties.trim()}`]
      : []),
  ];
  const packet = buildAuthorizedCoachPacket({
    weekOf,
    memberUserId,
    state: stateResult.state,
    recommendations: recs.rows.map(recommendationRowToDomain),
    surveySleep,
    memberQuestions,
  });
  const assignment = await db.query<{ coach_user_id: string }>(
    `SELECT coach_user_id FROM coach_member_assignments
     WHERE member_user_id = $1 AND active = true LIMIT 1`,
    [memberUserId],
  );
  const coachUserId = assignment.rows[0] === undefined ? null : String(assignment.rows[0].coach_user_id);
  const upserted = await db.query<{ id: string; status: string }>(
    `INSERT INTO weekly_review_queue (member_user_id, coach_user_id, week_of, status, packet, updated_at)
     VALUES ($1, $2, $3::date, 'AUTO_SUMMARY_READY', $4::jsonb, now())
     ON CONFLICT (member_user_id, week_of) DO UPDATE
       SET packet = EXCLUDED.packet, coach_user_id = COALESCE(EXCLUDED.coach_user_id, weekly_review_queue.coach_user_id),
           status = CASE
             WHEN weekly_review_queue.status = 'FAILED' THEN weekly_review_queue.status
             WHEN weekly_review_queue.status IN ('COMPLETED', 'FEEDBACK_SENT') THEN 'REOPENED'
             ELSE 'AUTO_SUMMARY_READY'
           END,
           updated_at = now()
     RETURNING id::text AS id, status`,
    [memberUserId, coachUserId, weekOf, JSON.stringify(packet)],
  );
  const reviewId = String(upserted.rows[0]?.id);
  const statusAfter = upserted.rows[0]?.status;
  await db.query(
    `INSERT INTO weekly_review_events (review_id, actor_user_id, from_status, to_status, note)
     VALUES ($1, $2, NULL, $3, 'packet_prepared')`,
    [reviewId, actor.userId, statusAfter ?? 'AUTO_SUMMARY_READY'],
  );
  // Queue for a human only when the member has Coach-plan entitlement OR an active
  // coach assignment (pilot path). Free members without assignment keep a Yazan-ready
  // packet and are not placed in the human inbox.
  const memberEntitlements = await entitlementsFor(db, { userId: memberUserId, roles: ['member'], gymOrganizationIds: [] });
  const mayQueueHuman =
    hasCapability(memberEntitlements, 'human_coach.weekly_review') || coachUserId !== null;
  if ((statusAfter === 'AUTO_SUMMARY_READY' || statusAfter === 'REOPENED') && mayQueueHuman) {
    const queued = await persistWeeklyReviewTransition(db, actor, reviewId, 'QUEUED_FOR_HUMAN', 'queued_after_summary');
    return { review: queued, packet, queuedForHuman: true as const };
  }
  return {
    review: await loadWeeklyReview(db, reviewId),
    packet,
    queuedForHuman: false as const,
    entitlementGate: mayQueueHuman ? null : 'human_coach.weekly_review',
  };
}

export async function listWeeklyReviewsForCoach(db: Database, actor: Actor) {
  if (actor.roles.includes('admin') || actor.roles.includes('coach_supervisor')) {
    const rows = await db.query<{
      id: string;
      member_user_id: string;
      coach_user_id: string | null;
      week_of: string;
      status: string;
      updated_at: string;
      consent_granted: boolean;
    }>(
      `SELECT q.id::text AS id, q.member_user_id, q.coach_user_id, q.week_of::text AS week_of, q.status, q.updated_at,
              EXISTS (
                SELECT 1 FROM member_coach_share_consents c
                WHERE c.member_user_id = q.member_user_id
                  AND c.purpose = 'human_weekly_coaching_review'
                  AND c.status = 'granted'
              ) AS consent_granted
       FROM weekly_review_queue q
       WHERE q.status NOT IN ('COMPLETED', 'FAILED')
       ORDER BY q.updated_at ASC
       LIMIT 100`,
    );
    return {
      reviews: rows.rows.map((row) => ({
        id: row.id,
        memberUserId: String(row.member_user_id),
        coachUserId: row.coach_user_id === null ? null : String(row.coach_user_id),
        weekOf: row.week_of.slice(0, 10),
        status: row.status,
        updatedAt: iso(row.updated_at) ?? row.updated_at,
        consentGranted: row.consent_granted === true,
      })),
    };
  }
  if (!actor.roles.includes('coach_reviewer')) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  const rows = await db.query<{
    id: string;
    member_user_id: string;
    coach_user_id: string | null;
    week_of: string;
    status: string;
    updated_at: string;
  }>(
    `SELECT q.id::text AS id, q.member_user_id, q.coach_user_id, q.week_of::text AS week_of, q.status, q.updated_at
     FROM weekly_review_queue q
     INNER JOIN coach_member_assignments a
       ON a.member_user_id = q.member_user_id AND a.coach_user_id = $1 AND a.active = true
     INNER JOIN member_coach_share_consents c
       ON c.member_user_id = q.member_user_id
      AND c.purpose = 'human_weekly_coaching_review'
      AND c.status = 'granted'
     WHERE q.status NOT IN ('COMPLETED', 'FAILED')
       AND (q.coach_user_id IS NULL OR q.coach_user_id = $1)
     ORDER BY q.updated_at ASC
     LIMIT 100`,
    [actor.userId],
  );
  return {
    reviews: rows.rows.map((row) => ({
      id: row.id,
      memberUserId: String(row.member_user_id),
      coachUserId: row.coach_user_id === null ? null : String(row.coach_user_id),
      weekOf: row.week_of.slice(0, 10),
      status: row.status,
      updatedAt: iso(row.updated_at) ?? row.updated_at,
      consentGranted: true as const,
    })),
  };
}

export async function claimWeeklyReview(db: Database, actor: Actor, reviewId: string) {
  if (!actor.roles.includes('coach_reviewer') && !actor.roles.includes('admin')) {
    denyReviewAccess();
  }
  const current = await loadWeeklyReview(db, reviewId);
  if (current === null) {
    denyReviewAccess();
  }
  try {
    await requireAssignedCoach(db, actor, current.memberUserId);
  } catch {
    denyReviewAccess();
  }
  // Optimistic claim — only one concurrent claim wins from queue states.
  if (
    current.status === 'QUEUED_FOR_HUMAN' ||
    current.status === 'REASSIGNED' ||
    current.status === 'OVERDUE'
  ) {
    const claimed = await db.query<{ id: string }>(
      `UPDATE weekly_review_queue
       SET status = 'ASSIGNED', coach_user_id = $2, updated_at = now()
       WHERE id = $1 AND status = $3
       RETURNING id`,
      [reviewId, actor.userId, current.status],
    );
    if (claimed.rows[0] === undefined) {
      throw new ApiError(409, 'REVIEW_CLAIM_CONFLICT', 'Another coach claimed this review');
    }
    await db.query(
      `INSERT INTO weekly_review_events (review_id, actor_user_id, from_status, to_status, note)
       VALUES ($1, $2, $3, 'ASSIGNED', 'coach_claim')`,
      [reviewId, actor.userId, current.status],
    );
    await persistWeeklyReviewTransition(db, actor, reviewId, 'IN_REVIEW', 'start_review', actor.userId);
  } else if (current.status === 'ASSIGNED') {
    if (current.coachUserId !== null && current.coachUserId !== actor.userId && !actor.roles.includes('admin')) {
      denyReviewAccess();
    }
    await persistWeeklyReviewTransition(db, actor, reviewId, 'IN_REVIEW', 'start_review', actor.userId);
  } else {
    throw new ApiError(422, 'INVALID_REVIEW_TRANSITION', 'Review cannot be claimed in its current status');
  }
  await writeCoachAccessAudit(db, actor.userId, current.memberUserId, 'review.claim');
  return { review: await loadWeeklyReview(db, reviewId) };
}

export async function readWeeklyReviewPacket(db: Database, actor: Actor, reviewId: string) {
  const current = await loadWeeklyReview(db, reviewId);
  if (current === null) {
    denyReviewAccess();
  }
  if (actor.userId === current.memberUserId) {
    return { review: current, packet: current.packet };
  }
  try {
    await requireAssignedCoach(db, actor, current.memberUserId);
  } catch {
    denyReviewAccess();
  }
  await writeCoachAccessAudit(db, actor.userId, current.memberUserId, 'packet.read');
  return { review: current, packet: current.packet };
}

export async function escalateWeeklyReview(db: Database, actor: Actor, reviewId: string, note = '') {
  if (
    !actor.roles.includes('coach_reviewer') &&
    !actor.roles.includes('coach_supervisor') &&
    !actor.roles.includes('admin')
  ) {
    denyReviewAccess();
  }
  const current = await loadWeeklyReview(db, reviewId);
  if (current === null) {
    denyReviewAccess();
  }
  if (!actor.roles.includes('admin') && !actor.roles.includes('coach_supervisor')) {
    try {
      await requireAssignedCoach(db, actor, current.memberUserId);
    } catch {
      denyReviewAccess();
    }
  }
  const review = await persistWeeklyReviewTransition(db, actor, reviewId, 'ESCALATED', note || 'escalated');
  return { review };
}

export async function sendCoachFeedback(
  db: Database,
  actor: Actor,
  reviewId: string,
  body: string,
) {
  if (!actor.roles.includes('coach_reviewer') && !actor.roles.includes('admin')) {
    denyReviewAccess();
  }
  const current = await loadWeeklyReview(db, reviewId);
  if (current === null) {
    denyReviewAccess();
  }
  try {
    await requireAssignedCoach(db, actor, current.memberUserId);
  } catch {
    denyReviewAccess();
  }
  if (current.status !== 'IN_REVIEW' && current.status !== 'ASSIGNED' && current.status !== 'REOPENED') {
    throw new ApiError(422, 'INVALID_REVIEW_TRANSITION', 'Feedback requires an in-review assignment');
  }
  if (current.status === 'ASSIGNED' || current.status === 'REOPENED') {
    await persistWeeklyReviewTransition(db, actor, reviewId, 'IN_REVIEW', 'enter_review_before_feedback', actor.userId);
  }
  const at = new Date().toISOString();
  let feedback;
  try {
    feedback = createCoachFeedback({
      id: randomUUID(),
      reviewId,
      coachUserId: actor.userId,
      memberUserId: current.memberUserId,
      body,
      createdAt: at,
    });
  } catch (error) {
    throw asApi(error);
  }
  await db.query(
    `INSERT INTO coach_feedback (id, review_id, coach_user_id, member_user_id, body, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
    [feedback.id, reviewId, actor.userId, current.memberUserId, feedback.body, at],
  );
  await persistWeeklyReviewTransition(db, actor, reviewId, 'FEEDBACK_SENT', 'human_feedback_sent', actor.userId);
  await persistWeeklyReviewTransition(db, actor, reviewId, 'COMPLETED', 'review_completed', actor.userId);
  await writeCoachAccessAudit(db, actor.userId, current.memberUserId, 'feedback.send');
  const conversationId = await conversationFor(db, current.memberUserId);
  await db.query(`INSERT INTO coach_messages (conversation_id, role, body) VALUES ($1, 'human_coach', $2)`, [
    conversationId,
    feedback.body,
  ]);
  await db.query(
    `INSERT INTO member_in_app_notifications (
       user_id, kind, title, body, href, related_id, author_kind
     ) VALUES ($1, 'human_coach_feedback', $2, $3, '/weekly-checkin', $4::uuid, 'human_coach')`,
    [
      current.memberUserId,
      'Human coach feedback',
      feedback.body.slice(0, 1000),
      feedback.id,
    ],
  ).catch(() => undefined);
  return { persisted: true, feedback };
}

/**
 * P3-ENT-01 — Server-authoritative capability projection for the signed-in member.
 * Reads the latest subscriptions row when present; otherwise free defaults.
 * Never unlocks paid capabilities from client flags. Nutrition adaptations stay blocked.
 */
/** Member data export for account portability — no secrets, tokens, or password hashes. */
export async function exportMemberAccount(db: Database, actor: Actor) {
  const profile = await readProfile(db, actor.userId);
  const progress = await progressFor(db, actor.userId);
  const sessions = await listSessions(db, actor.userId);
  const diary = await diaryFor(db, actor.userId, new Date().toISOString().slice(0, 10));
  const entitlements = await entitlementsFor(db, actor);
  return {
    exportedAt: new Date().toISOString(),
    userId: actor.userId,
    profile: profile.profile,
    goals: profile.goals,
    entitlements: {
      planCode: entitlements.planCode,
      capabilities: entitlements.capabilities,
      limits: entitlements.limits,
      purchasesEnabled: entitlements.purchasesEnabled,
    },
    progress: {
      completedWorkouts: progress.completedWorkouts,
      weightCount: progress.weights.length,
    },
    sessions: sessions.map((session) => ({
      id: session.id,
      name: session.name,
      status: session.status,
      scheduledFor: session.scheduled_for,
      durationSeconds: session.duration_seconds,
    })),
    todayDiary: {
      entryCount: diary.summary.entryCount,
      consumed: diary.summary.consumed,
    },
    notice: 'Credentials and session tokens are omitted from this export.',
  };
}

export async function registerPushDevice(
  db: Database,
  userId: string,
  input: { expoPushToken: string; platform: string },
) {
  await db.query(
    `INSERT INTO member_push_devices (user_id, expo_push_token, platform, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, expo_push_token)
     DO UPDATE SET platform = EXCLUDED.platform, updated_at = now(), revoked_at = NULL`,
    [userId, input.expoPushToken, input.platform],
  );
  return { registered: true, deliveryConfigured: false, notice: 'Token stored; push delivery provider is not enabled yet.' };
}

export async function entitlementsFor(
  db: Database,
  actor: Actor,
): Promise<EntitlementProjection & { purchasesEnabled: false; source: 'subscriptions' | 'default_free' }> {
  const rows = await db.query<{
    status: string;
    store: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    last_event_at: string | null;
    product_code: string | null;
  }>(
    `SELECT s.status,
            s.store,
            s.current_period_end::text AS current_period_end,
            s.cancel_at_period_end,
            s.last_event_at::text AS last_event_at,
            p.code AS product_code
     FROM subscriptions s
     LEFT JOIN products p ON p.id = s.product_id
     WHERE s.user_id = $1
     ORDER BY s.updated_at DESC NULLS LAST
     LIMIT 1`,
    [actor.userId],
  ).catch(() => ({ rows: [] as {
    status: string;
    store: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    last_event_at: string | null;
    product_code: string | null;
  }[] }));

  const row = rows.rows[0];
  if (row === undefined) {
    const projection = projectEntitlements({ subscription: initialSubscription(), planCode: 'free' });
    return { ...projection, purchasesEnabled: false, source: 'default_free' };
  }

  const status = row.status as SubscriptionStatus;
  const productCode = row.product_code;
  const planCode: 'free' | 'traina_ai' | 'traina_coach' =
    productCode?.includes('coach') ? 'traina_coach'
      : productCode?.includes('ai') ? 'traina_ai'
        : 'free';

  const projection = projectEntitlements({
    subscription: {
      status,
      productId: productCode,
      store: (row.store as StoreChannel | null) ?? null,
      currentPeriodEnd: row.current_period_end === null ? null : iso(row.current_period_end) ?? row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      lastEventAt: row.last_event_at === null ? null : iso(row.last_event_at) ?? row.last_event_at,
      processedEventIds: [],
    },
    planCode,
  });
  return { ...projection, purchasesEnabled: false, source: 'subscriptions' };
}

export async function listMemberNotifications(db: Database, actor: Actor) {
  const rows = await db.query<{
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string | null;
    related_id: string | null;
    author_kind: string;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT id::text AS id, kind, title, body, href, related_id::text AS related_id, author_kind,
            read_at::text AS read_at, created_at::text AS created_at
     FROM member_in_app_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [actor.userId],
  ).catch(() => ({ rows: [] as {
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string | null;
    related_id: string | null;
    author_kind: string;
    read_at: string | null;
    created_at: string;
  }[] }));
  return {
    notifications: rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      relatedId: row.related_id,
      authorKind: row.author_kind,
      readAt: row.read_at === null ? null : iso(row.read_at) ?? row.read_at,
      createdAt: iso(row.created_at) ?? row.created_at,
      isHumanCoach: row.author_kind === 'human_coach',
    })),
  };
}

export async function markMemberNotificationRead(db: Database, actor: Actor, notificationId: string) {
  const result = await db.query(
    `UPDATE member_in_app_notifications
     SET read_at = now()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL
     RETURNING id::text AS id`,
    [notificationId, actor.userId],
  );
  if (result.rows[0] === undefined) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }
  return { persisted: true, id: String((result.rows[0] as { id: string }).id) };
}

export async function listMemberCoachFeedback(db: Database, actor: Actor) {
  const rows = await db.query<{
    id: string;
    review_id: string;
    coach_user_id: string;
    body: string;
    created_at: string;
  }>(
    `SELECT id::text AS id, review_id::text AS review_id, coach_user_id, body, created_at
     FROM coach_feedback WHERE member_user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [actor.userId],
  );
  return {
    feedback: rows.rows.map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      coachUserId: String(row.coach_user_id),
      body: row.body,
      createdAt: iso(row.created_at) ?? row.created_at,
      authorKind: 'human_coach' as const,
    })),
  };
}

export async function addCoachNote(db: Database, actor: Actor, memberUserId: string, body: string) {
  await requireAssignedCoach(db, actor, memberUserId);
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new ApiError(400, 'INVALID_NOTE', 'Note must be 1–4000 characters');
  }
  const id = randomUUID();
  await db.query(
    `INSERT INTO coach_notes (id, coach_user_id, member_user_id, body) VALUES ($1, $2, $3, $4)`,
    [id, actor.userId, memberUserId, trimmed],
  );
  return { persisted: true, id, internal: true as const };
}

export async function listCoachNotes(db: Database, actor: Actor, memberUserId: string) {
  await requireAssignedCoach(db, actor, memberUserId);
  const rows = await db.query<{ id: string; body: string; created_at: string }>(
    `SELECT id::text AS id, body, created_at FROM coach_notes
     WHERE member_user_id = $1 AND coach_user_id = $2
     ORDER BY created_at DESC LIMIT 50`,
    [memberUserId, actor.userId],
  );
  return {
    notes: rows.rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: iso(row.created_at) ?? row.created_at,
      internal: true as const,
    })),
  };
}

export async function coachWorkloadMetrics(db: Database, actor: Actor) {
  if (!actor.roles.includes('coach_reviewer') && !actor.roles.includes('admin') && !actor.roles.includes('coach_supervisor')) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  const coachFilter = actor.roles.includes('admin') || actor.roles.includes('coach_supervisor') ? null : actor.userId;
  const assigned = await db.query<{ n: string }>(
    coachFilter === null
      ? `SELECT COUNT(*)::text AS n FROM coach_member_assignments WHERE active = true`
      : `SELECT COUNT(*)::text AS n FROM coach_member_assignments WHERE active = true AND coach_user_id = $1`,
    coachFilter === null ? [] : [coachFilter],
  );
  const inbox = await db.query<{ n: string }>(
    coachFilter === null
      ? `SELECT COUNT(*)::text AS n FROM weekly_review_queue WHERE status IN ('QUEUED_FOR_HUMAN','ASSIGNED','IN_REVIEW','OVERDUE','ESCALATED')`
      : `SELECT COUNT(*)::text AS n FROM weekly_review_queue q
         INNER JOIN coach_member_assignments a ON a.member_user_id = q.member_user_id AND a.active = true AND a.coach_user_id = $1
         WHERE q.status IN ('QUEUED_FOR_HUMAN','ASSIGNED','IN_REVIEW','OVERDUE','ESCALATED')`,
    coachFilter === null ? [] : [coachFilter],
  );
  const completed = await db.query<{ n: string }>(
    coachFilter === null
      ? `SELECT COUNT(*)::text AS n FROM weekly_review_queue WHERE status = 'COMPLETED' AND updated_at > now() - interval '14 days'`
      : `SELECT COUNT(*)::text AS n FROM weekly_review_queue
         WHERE status = 'COMPLETED' AND coach_user_id = $1 AND updated_at > now() - interval '14 days'`,
    coachFilter === null ? [] : [coachFilter],
  );
  const overdue = await db.query<{ n: string }>(
    coachFilter === null
      ? `SELECT COUNT(*)::text AS n FROM weekly_review_queue WHERE status = 'OVERDUE'`
      : `SELECT COUNT(*)::text AS n FROM weekly_review_queue WHERE status = 'OVERDUE' AND coach_user_id = $1`,
    coachFilter === null ? [] : [coachFilter],
  );
  const capacity = coachFilter === null
    ? null
    : await db.query<{ max_active_members: number; response_hours_target: number; available: boolean }>(
        `SELECT max_active_members, response_hours_target, available FROM coach_capacity WHERE coach_user_id = $1`,
        [coachFilter],
      );
  const cap = capacity?.rows[0];
  const assignedCount = Number(assigned.rows[0]?.n ?? 0);
  const maxMembers = cap?.max_active_members ?? 40;
  return {
    assignedMembers: assignedCount,
    openReviews: Number(inbox.rows[0]?.n ?? 0),
    completedLast14Days: Number(completed.rows[0]?.n ?? 0),
    overdueReviews: Number(overdue.rows[0]?.n ?? 0),
    capacity: {
      maxActiveMembers: maxMembers,
      availableSlots: Math.max(0, maxMembers - assignedCount),
      responseHoursTarget: cap?.response_hours_target ?? 72,
      available: cap?.available ?? true,
      atCapacity: assignedCount >= maxMembers,
    },
  };
}

/** Mark queued/assigned reviews older than SLA as OVERDUE. Admin/supervisor only. */
export async function markOverdueWeeklyReviews(db: Database, actor: Actor, olderThanHours = 72) {
  if (!actor.roles.includes('admin') && !actor.roles.includes('coach_supervisor')) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  const hours = Math.min(336, Math.max(1, olderThanHours));
  const updated = await db.query<{ id: string; status: string }>(
    `UPDATE weekly_review_queue
     SET status = 'OVERDUE', updated_at = now()
     WHERE status IN ('QUEUED_FOR_HUMAN', 'ASSIGNED', 'IN_REVIEW')
       AND updated_at < now() - make_interval(hours => $1::int)
     RETURNING id::text AS id, status`,
    [hours],
  );
  for (const row of updated.rows) {
    await db.query(
      `INSERT INTO weekly_review_events (review_id, actor_user_id, from_status, to_status, note)
       VALUES ($1, $2, 'SLA_BREACH', 'OVERDUE', $3)`,
      [row.id, actor.userId, `older_than_${hours}h`],
    );
  }
  return { marked: updated.rows.length, olderThanHours: hours };
}

export async function memberWeeklyHumanReviewStatus(db: Database, actor: Actor) {
  const review = await db.query<{
    id: string;
    week_of: string;
    status: string;
    updated_at: string;
    coach_user_id: string | null;
  }>(
    `SELECT id::text AS id, week_of::text AS week_of, status, updated_at, coach_user_id
     FROM weekly_review_queue WHERE member_user_id = $1
     ORDER BY week_of DESC LIMIT 1`,
    [actor.userId],
  );
  const feedback = await listMemberCoachFeedback(db, actor);
  const assignment = await db.query<{ coach_user_id: string }>(
    `SELECT coach_user_id FROM coach_member_assignments
     WHERE member_user_id = $1 AND active = true LIMIT 1`,
    [actor.userId],
  );
  const row = review.rows[0];
  return {
    hasAssignedCoach: assignment.rows[0] !== undefined,
    coachAvailable: assignment.rows[0] !== undefined,
    noCoachMessage:
      assignment.rows[0] === undefined
        ? 'No human coach is assigned yet. Weekly summaries stay with Yazan until an authorized coach is assigned.'
        : null,
    review:
      row === undefined
        ? null
        : {
            id: row.id,
            weekOf: row.week_of.slice(0, 10),
            status: row.status,
            updatedAt: iso(row.updated_at) ?? row.updated_at,
          },
    unreadHumanFeedback: feedback.feedback.slice(0, 5),
  };
}

/** Preview of what will be shared with an assigned coach — facts only; does not queue a review. */
export async function previewWeeklySharePacket(db: Database, actor: Actor, weekOf: string) {
  const consent = await coachShareConsentFor(db, actor);
  const stateResult = await memberStateFor(db, actor, {
    subjectUserId: actor.userId,
    timeZone: 'Asia/Riyadh',
    asOfDay: weekOf,
  });
  const survey = await db.query<{ survey: unknown }>(
    `SELECT survey FROM coach_weekly_briefs WHERE user_id = $1 AND week_of = $2::date LIMIT 1`,
    [actor.userId, weekOf],
  );
  const surveyObj =
    survey.rows[0] === undefined
      ? null
      : asJson<{ sleep?: number; questionForCoach?: string; difficulties?: string }>(survey.rows[0].survey);
  const packet = buildAuthorizedCoachPacket({
    weekOf,
    memberUserId: actor.userId,
    state: stateResult.state,
    recommendations: [],
    surveySleep: surveyObj !== null && typeof surveyObj.sleep === 'number' ? surveyObj.sleep : null,
    memberQuestions: [
      ...stateResult.state.openCoachingQuestions,
      ...(surveyObj?.questionForCoach?.trim() ? [surveyObj.questionForCoach.trim()] : []),
    ],
  });
  return {
    consentStatus: consent.status,
    disclosure: consent.disclosure,
    packet,
    inventsMissingValues: false as const,
  };
}

export async function addCoachFollowUp(
  db: Database,
  actor: Actor,
  reviewId: string,
  body: string,
  dueOn?: string,
) {
  const current = await loadWeeklyReview(db, reviewId);
  if (current === null) denyReviewAccess();
  try {
    await requireAssignedCoach(db, actor, current.memberUserId);
  } catch {
    denyReviewAccess();
  }
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    throw new ApiError(400, 'INVALID_FOLLOW_UP', 'Follow-up must be 1–2000 characters');
  }
  const id = randomUUID();
  await db.query(
    `INSERT INTO coach_follow_ups (id, review_id, coach_user_id, member_user_id, body, due_on)
     VALUES ($1, $2, $3, $4, $5, $6::date)`,
    [id, reviewId, actor.userId, current.memberUserId, trimmed, dueOn ?? null],
  );
  return { persisted: true, id, status: 'open' as const };
}

export async function listCoachFollowUps(db: Database, actor: Actor) {
  if (!actor.roles.includes('coach_reviewer') && !actor.roles.includes('admin')) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  const rows = await db.query<{
    id: string;
    review_id: string;
    member_user_id: string;
    body: string;
    due_on: string | null;
    status: string;
  }>(
    `SELECT id::text AS id, review_id::text AS review_id, member_user_id, body, due_on::text AS due_on, status
     FROM coach_follow_ups
     WHERE coach_user_id = $1 AND status = 'open'
     ORDER BY due_on NULLS LAST, created_at
     LIMIT 50`,
    [actor.userId],
  );
  return {
    followUps: rows.rows.map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      memberUserId: String(row.member_user_id),
      body: row.body,
      dueOn: row.due_on === null ? null : row.due_on.slice(0, 10),
      status: row.status,
    })),
  };
}

/** Human coach approve/reject — never AI; nutrition still blocked from APPLIED by ENERGY_POLICY. */
export async function coachDecideRecommendation(
  db: Database,
  actor: Actor,
  memberUserId: string,
  recommendationId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
) {
  if (!actor.roles.includes('coach_reviewer') && !actor.roles.includes('admin')) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
  await requireAssignedCoach(db, actor, memberUserId);
  const rows = await db.query<{
    id: string;
    user_id: string;
    category: string;
    status: string;
    summary: string;
    rationale: string;
    confidence: string;
    missing_data: unknown;
    evidence: unknown;
    policy_version: string;
    expires_at: string;
    payload: unknown;
    requires_human_review: boolean;
    requires_member_confirmation: boolean;
    audit: unknown;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM coaching_recommendations WHERE id = $1 AND user_id = $2`, [recommendationId, memberUserId]);
  const row = rows.rows[0];
  if (row === undefined) {
    throw new ApiError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
  }
  let current = recommendationRowToDomain(row);
  if (current.status !== 'REVIEW_REQUIRED' && current.status !== 'VALIDATED') {
    throw new ApiError(422, 'INVALID_RECOMMENDATION_TRANSITION', 'Only review-required recommendations can be decided by a coach');
  }
  const at = new Date().toISOString();
  try {
    if (current.status === 'VALIDATED' && current.requiresHumanReview) {
      current = transitionRecommendation(current, 'REVIEW_REQUIRED', at, {
        actorId: actor.userId,
        note: 'human_coach_claimed_review',
      });
    }
    current = transitionRecommendation(current, decision, at, {
      actorId: actor.userId,
      note: `human_coach_${decision.toLowerCase()}:${reason.slice(0, 200)}`,
    });
  } catch (error) {
    throw asApi(error);
  }
  await persistRecommendation(db, current);
  await writeCoachAccessAudit(
    db,
    actor.userId,
    memberUserId,
    decision === 'APPROVED' ? 'recommendation.approve' : 'recommendation.reject',
  );
  return {
    persisted: true,
    recommendation: current,
    humanApproved: decision === 'APPROVED',
    authorKind: 'human_coach' as const,
    energyPolicyBlocksApply: current.category === 'nutrition',
  };
}

export async function listReadyMeals() {
  return { meals: READY_MEAL_TEMPLATES, catalog: true, inventedDishes: false };
}

export async function mealPlanFor(db: Database, userId: string, loggedOn: string) {
  const day = await db.query<{ id: string; target_kcal: number }>(
    `SELECT id, target_kcal FROM member_meal_plan_days WHERE user_id = $1 AND logged_on = $2`,
    [userId, loggedOn],
  );
  const row = day.rows[0];
  if (row === undefined) {
    return { loggedOn, plan: null, readyMeals: READY_MEAL_TEMPLATES };
  }
  const slots = await db.query<{
    meal_slot: string;
    template_id: string | null;
    custom_label: string | null;
    energy_kcal: number;
    protein_mg: number;
    carbohydrate_mg: number;
    fat_mg: number;
  }>(
    `SELECT meal_slot, template_id, custom_label, energy_kcal, protein_mg, carbohydrate_mg, fat_mg
     FROM member_meal_plan_slots WHERE day_id = $1 ORDER BY meal_slot`,
    [row.id],
  );
  const picks: MealPlanSlotPick[] = slots.rows.map((slot) => ({
    slot: slot.meal_slot as MealPlanSlotPick['slot'],
    templateId: slot.template_id,
    customLabel: slot.custom_label,
    energyKcal: Number(slot.energy_kcal),
    proteinMg: Number(slot.protein_mg),
    carbohydrateMg: Number(slot.carbohydrate_mg),
    fatMg: Number(slot.fat_mg),
  }));
  return {
    loggedOn,
    plan: assembleDayMealPlan(Number(row.target_kcal), picks),
    readyMeals: READY_MEAL_TEMPLATES,
  };
}

export async function saveMealPlanDay(
  db: Database,
  userId: string,
  input: {
    loggedOn: string;
    targetKcal: number;
    slots: Array<{
      slot: string;
      templateId?: string;
      custom?: { label: string; energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number };
    }>;
  },
) {
  const picks: MealPlanSlotPick[] = [];
  try {
    for (const slot of input.slots) {
      if (!isMealSlot(slot.slot)) {
        throw new DomainError('UNKNOWN_MEAL_SLOT', 'That meal slot is not in the catalog');
      }
      if (slot.templateId !== undefined) {
        picks.push(pickReadyMeal(slot.slot, slot.templateId));
      } else if (slot.custom !== undefined) {
        picks.push(customizeMealSlot(slot.slot, slot.custom));
      } else {
        throw new DomainError('INVALID_MEAL_SLOT', 'Provide a ready meal or custom macros');
      }
    }
    assembleDayMealPlan(input.targetKcal, picks);
  } catch (error) {
    throw asApi(error);
  }
  return db.transaction(async (tx) => {
    await tx.query(`DELETE FROM member_meal_plan_days WHERE user_id = $1 AND logged_on = $2`, [userId, input.loggedOn]);
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO member_meal_plan_days (user_id, logged_on, target_kcal) VALUES ($1, $2, $3) RETURNING id`,
      [userId, input.loggedOn, input.targetKcal],
    );
    const dayId = String(inserted.rows[0]?.id);
    for (const pick of picks) {
      await tx.query(
        `INSERT INTO member_meal_plan_slots (
           day_id, meal_slot, template_id, custom_label, energy_kcal, protein_mg, carbohydrate_mg, fat_mg
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          dayId,
          pick.slot,
          pick.templateId,
          pick.customLabel,
          pick.energyKcal,
          pick.proteinMg,
          pick.carbohydrateMg,
          pick.fatMg,
        ],
      );
    }
    return {
      loggedOn: input.loggedOn,
      plan: assembleDayMealPlan(input.targetKcal, picks),
      readyMeals: READY_MEAL_TEMPLATES,
    };
  });
}

export async function memberProgramDetail(db: Database, userId: string, programId: string) {
  const rows = await db.query<{ id: string; name: string; discipline: string; active: boolean; archived_at: string | null; version: number; template: unknown }>(
    'SELECT p.id, p.name, p.discipline, p.active, p.archived_at, v.version, v.template FROM programs p JOIN LATERAL (SELECT version, template FROM program_versions WHERE program_id = p.id ORDER BY version DESC LIMIT 1) v ON true WHERE p.id = $1 AND p.user_id = $2', [programId, userId]);
  const row = rows.rows[0];
  if (!row) throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Program is not on this account');
  const doc = parseProgramVersionDocument(row.template);
  return { program: { id: row.id, name: row.name, discipline: row.discipline, active: row.active, archivedAt: row.archived_at, version: Number(row.version), days: doc.days } };
}

export async function memberProgramHistory(db: Database, userId: string, programId: string, before?: number) {
  const owned = await db.query('SELECT id FROM programs WHERE id = $1 AND user_id = $2', [programId, userId]);
  if (!owned.rows.length) throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Program is not on this account');
  const rows = await db.query<{ version: number; source: string; template: unknown; created_at: string }>(
    'SELECT version, source, template, created_at FROM program_versions WHERE program_id = $1 AND ($2::integer IS NULL OR version < $2) ORDER BY version DESC LIMIT 51', [programId, before ?? null]);
  return { versions: rows.rows.slice(0, 50).map(row => ({ version: Number(row.version), source: row.source, document: row.template, createdAt: row.created_at })),
    nextBefore: rows.rows.length > 50 ? Number(rows.rows[49]!.version) : null };
}

type ProgramAction = { action: 'duplicate' | 'rename' | 'restore' | 'activate' | 'archive'; expectedVersion: number; name?: string; version?: number };
export async function manageMemberProgram(db: Database, userId: string, programId: string, input: ProgramAction) {
  return db.transaction(async tx => {
    // Serialize activation changes per member, then lock the program, always in that order.
    await tx.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const owned = await tx.query<{ id: string; template_id: string; name: string; discipline: string; archived_at: string | null }>(
      'SELECT id, template_id, name, discipline, archived_at FROM programs WHERE id = $1 AND user_id = $2 FOR UPDATE', [programId, userId]);
    const program = owned.rows[0];
    if (!program) throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Program is not on this account');
    if (program.archived_at !== null) throw new ApiError(409, 'PROGRAM_ARCHIVED', 'Archived programs cannot be changed');
    const rows = await tx.query<{ version: number; template: unknown }>('SELECT version, template FROM program_versions WHERE program_id = $1 ORDER BY version DESC LIMIT 1', [programId]);
    const latest = rows.rows[0];
    if (!latest || Number(latest.version) !== input.expectedVersion) throw new ApiError(409, 'PROGRAM_VERSION_CONFLICT', 'Reload the program before changing it');
    let id = programId, version = Number(latest.version);
    if (input.action === 'activate') {
      await tx.query('UPDATE programs SET active = false WHERE user_id = $1 AND active = true', [userId]);
      await tx.query('UPDATE programs SET active = true WHERE id = $1', [programId]);
    } else if (input.action === 'archive') {
      await tx.query('UPDATE programs SET active = false, archived_at = now() WHERE id = $1', [programId]);
    } else {
      let raw = latest.template;
      if (input.action === 'restore') {
        const historical = await tx.query<{ template: unknown }>('SELECT template FROM program_versions WHERE program_id = $1 AND version = $2', [programId, input.version]);
        if (!historical.rows[0]) throw new ApiError(404, 'PROGRAM_VERSION_NOT_FOUND', 'Version is not in this program');
        raw = historical.rows[0].template;
      }
      const document = parseProgramVersionDocument(raw);
      // A restored or copied document must still refer to exercises accessible to this member.
      for (let i = 0; i < document.days.length; i++) {
        planDocumentDay(document, i, document.adaptation ?? null);
        for (const exerciseId of document.days[i]!.exerciseIds) {
          const found = await tx.query('SELECT id FROM exercises WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)', [exerciseId, userId]);
          if (!found.rows.length) throw new ApiError(404, 'EXERCISE_NOT_FOUND', 'Exercise is no longer accessible');
        }
      }
      let name = input.name ?? program.name;
      if (input.action === 'restore') {
        const saved = raw as { programName?: unknown };
        if (typeof saved.programName === 'string') name = saved.programName;
      }
      if (input.action === 'duplicate') {
        id = randomUUID(); version = 1;
        await tx.query('INSERT INTO programs (id, user_id, discipline, name, template_id, active) VALUES ($1, $2, $3, $4, $5, false)', [id, userId, program.discipline, name, program.template_id]);
      } else {
        version++;
        await tx.query('UPDATE programs SET name = $1 WHERE id = $2', [name, id]);
      }
      await tx.query(
        "INSERT INTO program_versions (id, program_id, version, source, template) VALUES ($1, $2, $3, 'member_customize', $4::jsonb)",
        [randomUUID(), id, version, JSON.stringify({ ...document, programName: name, memberAction: input.action,
          ...(input.action === 'restore' ? { restoredFromVersion: input.version } : {}),
          ...(input.action === 'duplicate' ? { copiedFromProgram: programId, copiedFromVersion: Number(latest.version) } : {}) })]);
    }
    await tx.query('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $4)', [userId, 'program.' + input.action, 'program', id]);
    return { id, version, action: input.action };
  });
}

export async function activateMemberProgram(db: Database, userId: string, templateId: string) {
  const template = templateById(templateId);
  if (template === null) {
    throw new ApiError(404, 'UNKNOWN_TEMPLATE', 'Training template is not in the catalog');
  }
  return db.transaction(async (tx) => {
    await tx.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    await tx.query(`UPDATE programs SET active = false WHERE user_id = $1 AND active = true`, [userId]);
    const programId = randomUUID();
    const versionId = randomUUID();
    await tx.query(
      `INSERT INTO programs (id, user_id, discipline, name, template_id, active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [programId, userId, template.discipline, template.name_en, template.id],
    );
    await tx.query(
      `INSERT INTO program_versions (id, program_id, version, source, template)
       VALUES ($1, $2, 1, 'explicit', $3::jsonb)`,
      [versionId, programId, JSON.stringify({ templateId: template.id, days: template.days, programName: template.name_en })],
    );
    return {
      id: programId,
      templateId: template.id,
      name: template.name_en,
      discipline: template.discipline,
      days: publicTemplate(template).days,
    };
  });
}

export async function customizeMemberProgram(
  db: Database,
  userId: string,
  programId: string,
  input: {
    name?: string;
    expectedVersion?: number;
    days: ProgramDayDocument[];
  },
) {
  return db.transaction(async (tx) => {
    const owned = await tx.query<{ id: string; template_id: string | null; name: string }>(
      `SELECT id, template_id, name FROM programs WHERE id = $1 AND user_id = $2 AND archived_at IS NULL FOR UPDATE`,
      [programId, userId],
    );
    const program = owned.rows[0];
    if (program === undefined || program.template_id === null) {
      throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Program is not on this account');
    }
    if (!Array.isArray(input.days) || input.days.length < 1 || input.days.length > 14) {
      throw new ApiError(422, 'INVALID_PROGRAM_DAYS', 'Provide between 1 and 14 program days');
    }
    for (const day of input.days) {
      if (day.exerciseIds.length < 1 || day.exerciseIds.length > 20) {
        throw new ApiError(422, 'INVALID_PROGRAM_DAY', 'Each day needs 1–20 exercises');
      }
      for (const exerciseId of day.exerciseIds) {
        const found = await tx.query(
          `SELECT id FROM exercises WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`,
          [exerciseId, userId],
        );
        if (found.rows[0] === undefined) {
          throw new ApiError(404, 'EXERCISE_NOT_FOUND', 'An exercise in the plan was not found');
        }
      }
    }
    const latest = await tx.query<{ version: number; template: unknown }>(
      `SELECT version, template FROM program_versions WHERE program_id = $1 ORDER BY version DESC LIMIT 1`,
      [programId],
    );
    const currentVersion = Number(latest.rows[0]?.version ?? 0);
    if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
      throw new ApiError(409, 'PROGRAM_VERSION_CONFLICT', 'The program has changed. Reload before saving.');
    }
    let adaptation = null;
    let sourceRecommendationId = null;
    try {
      const parsed = parseProgramVersionDocument(
        latest.rows[0]?.template ?? { templateId: program.template_id, days: input.days },
      );
      adaptation = parsed.adaptation ?? null;
      sourceRecommendationId = parsed.sourceRecommendationId ?? null;
    } catch (error) {
      throw asApi(error);
    }
    const nextVersion = currentVersion + 1;
    const document = {
      programName: input.name?.trim() || program.name,
      memberAction: 'edit',
      templateId: program.template_id,
      days: input.days,
      adaptation,
      sourceRecommendationId,
    };
    try {
      for (let dayIndex = 0; dayIndex < document.days.length; dayIndex += 1) {
        planDocumentDay(document, dayIndex, adaptation);
      }
    } catch (error) {
      throw asApi(error);
    }
    const name = input.name?.trim().length ? input.name.trim().slice(0, 80) : program.name;
    await tx.query(`UPDATE programs SET name = $1 WHERE id = $2 AND user_id = $3`, [name, programId, userId]);
    await tx.query(
      `INSERT INTO program_versions (id, program_id, version, source, template)
       VALUES ($1, $2, $3, 'member_customize', $4::jsonb)`,
      [randomUUID(), programId, nextVersion, JSON.stringify(document)],
    );
    return {
      id: programId,
      templateId: program.template_id,
      name,
      version: nextVersion,
      days: input.days.map((day) => ({
        name_ar: day.name_ar,
        name_en: day.name_en,
        exerciseCount: day.exerciseIds.length,
        exerciseIds: day.exerciseIds,
        strengthOverrides: day.strengthOverrides ?? {},
      })),
    };
  });
}

export async function exerciseSubstitutionsFor(
  db: Database,
  userId: string,
  exerciseId: string,
) {
  const library = await listExercises(db, userId);
  const ranked = suggestExerciseSubstitutions(
    exerciseId,
    library.map((row) => ({
      id: String(row.id),
      primaryMuscles: Array.isArray(row.primary_muscles) ? row.primary_muscles.map(String) : [],
      equipment: Array.isArray(row.equipment) ? row.equipment.map(String) : [],
      difficulty: String(row.difficulty ?? 'beginner'),
    })),
  );
  const byId = new Map(library.map((row) => [String(row.id), row]));
  return {
    exerciseId,
    alternatives: ranked
      .map((item) => {
        const row = byId.get(item.id);
        if (row === undefined) return null;
        return { ...row, score: item.score };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  };
}

export async function abandonOpenWorkouts(db: Database, userId: string) {
  const open = await db.query<{ id: string }>(
    `SELECT id FROM workout_sessions
     WHERE user_id = $1 AND status IN ('scheduled', 'in_progress', 'paused')
     ORDER BY scheduled_for DESC`,
    [userId],
  );
  const at = new Date().toISOString();
  for (const row of open.rows) {
    const current = await sessionOwned(db, userId, row.id);
    try {
      await writeSession(db, abandonWorkout(current, at));
    } catch (error) {
      if (error instanceof DomainError && error.code === 'INVALID_SESSION_STATE') {
        continue;
      }
      throw error;
    }
  }
}

export async function startProgramDay(
  db: Database,
  userId: string,
  programId: string,
  input: { dayIndex: number; startNow?: boolean; locale?: 'ar' | 'en' },
) {
  const owned = await db.query<{ id: string; template_id: string | null }>(
    `SELECT id, template_id FROM programs WHERE id = $1 AND user_id = $2 AND active = true AND archived_at IS NULL`,
    [programId, userId],
  );
  const program = owned.rows[0];
  if (program === undefined || program.template_id === null) {
    throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Program is not on this account');
  }
  const latestDoc = await db.query<{ id: string; template: unknown }>(
    `SELECT id, template FROM program_versions WHERE program_id = $1 ORDER BY version DESC LIMIT 1`,
    [programId],
  );
  let adaptation = null;
  let document: { templateId: string; days: ProgramDayDocument[] } = {
    templateId: program.template_id,
    days: (templateById(program.template_id)?.days ?? []).map((day) => ({
      name_ar: day.name_ar,
      name_en: day.name_en,
      exerciseIds: [...day.exerciseIds],
    })),
  };
  try {
    const parsed = parseProgramVersionDocument(
      latestDoc.rows[0]?.template ?? { templateId: program.template_id, days: document.days },
    );
    adaptation = parsed.adaptation ?? null;
    if (parsed.days.length > 0) {
      document = {
        templateId: parsed.templateId,
        days: parsed.days.map((day) => ({
          name_ar: day.name_ar,
          name_en: day.name_en,
          exerciseIds: [...day.exerciseIds],
          strengthOverrides: day.strengthOverrides,
        })),
      };
    }
  } catch (error) {
    throw asApi(error);
  }
  let planned: ReturnType<typeof planTemplateDay>;
  try {
    planned = planDocumentDay(document, input.dayIndex, adaptation);
  } catch (error) {
    throw asApi(error);
  }
  if (input.startNow === true) {
    await abandonOpenWorkouts(db, userId);
  }
  const session = await scheduleMemberWorkout(db, userId, {
    name: input.locale === 'en' ? planned.name_en : planned.name_ar,
    discipline: planned.discipline,
    scheduledFor: new Date().toISOString(),
    exercises: planned.exercises,
    programVersionId: latestDoc.rows[0]?.id ?? null,
  });
  if (input.startNow === true) {
    return mutateSession(db, userId, session.id, { type: 'start', at: new Date().toISOString() });
  }
  return session;
}

export async function mutateSession(
  db: Database,
  userId: string,
  sessionId: string,
  command:
    | { type: 'start' | 'pause' | 'resume' | 'complete'; at: string }
    | { type: 'log_set'; set: WorkoutSet }
    | { type: 'replace_set'; set: WorkoutSet },
): Promise<WorkoutSession> {
  const current = await sessionOwned(db, userId, sessionId);
  try {
    if (command.type === 'start') {
      const next = startWorkout(current, command.at);
      await writeSession(db, next);
      return next;
    }
    if (command.type === 'pause') {
      const next = pauseWorkout(current, command.at);
      await writeSession(db, next);
      return next;
    }
    if (command.type === 'resume') {
      const next = resumeWorkout(current, command.at);
      await writeSession(db, next);
      return next;
    }
    if (command.type === 'log_set') {
      const existing = current.sets.find((set) => set.id === command.set.id);
      if (existing !== undefined) {
        const same =
          existing.reps === command.set.reps &&
          existing.loadGrams === command.set.loadGrams &&
          existing.exerciseId === command.set.exerciseId;
        if (same) {
          return current;
        }
        throw new ApiError(409, 'SET_CONFLICT', 'This set id was already logged with different values');
      }
      const next = logSet(current, command.set);
      const added = next.sets[next.sets.length - 1];
      if (added === undefined) {
        throw new ApiError(500, 'SET_MISSING', 'Set was not recorded');
      }
      await db.query(
        `INSERT INTO workout_sets (id, session_id, exercise_id, set_index, reps, load_grams, rpe_tenths, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [added.id, sessionId, added.exerciseId, added.setIndex, added.reps, added.loadGrams, added.rpeTenths, added.completedAt],
      );
      return next;
    }
    if (command.type === 'replace_set') {
      const next = replaceSet(current, command.set);
      const updated = next.sets.find((set) => set.id === command.set.id);
      if (updated === undefined) {
        throw new ApiError(500, 'SET_MISSING', 'Set was not updated');
      }
      await db.query(
        `UPDATE workout_sets
         SET reps = $1, load_grams = $2, rpe_tenths = $3, completed_at = $4
         WHERE id = $5 AND session_id = $6`,
        [updated.reps, updated.loadGrams, updated.rpeTenths, updated.completedAt, updated.id, sessionId],
      );
      return next;
    }
    const finished = completeWorkout(current, command.at);
    await writeSession(db, finished.session);
    const history = await completedSessions(db, userId);
    const records = personalRecordsFromSessions(history.map((session) => (session.id === finished.session.id ? finished.session : session)));
    for (const record of records) {
      await db.query(`DELETE FROM personal_records WHERE user_id = $1 AND exercise_id = $2`, [userId, record.exerciseId]);
      await db.query(
        `INSERT INTO personal_records (user_id, exercise_id, session_id, set_id, load_grams, reps, achieved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, record.exerciseId, record.sessionId, record.setId, record.loadGrams, record.reps, record.achievedAt],
      );
    }
    return finished.session;
  } catch (error) {
    throw asApi(error);
  }
}

async function completedSessions(db: Database, userId: string): Promise<WorkoutSession[]> {
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM workout_sessions WHERE user_id = $1 AND status = 'completed'`,
    [userId],
  );
  const sessions: WorkoutSession[] = [];
  for (const row of rows.rows) {
    sessions.push(await sessionOwned(db, userId, row.id));
  }
  return sessions;
}

export async function listSessions(db: Database, userId: string) {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT id, name, discipline, status, scheduled_for, started_at, completed_at, pauses
     FROM workout_sessions WHERE user_id = $1 ORDER BY scheduled_for DESC`,
    [userId],
  );
  const seen = new Set<string>();
  const unique = [];
  for (const row of rows.rows) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const startedAt = iso(row.started_at);
    const completedAt = iso(row.completed_at);
    unique.push({
      id,
      name: row.name,
      discipline: row.discipline,
      status: row.status,
      scheduled_for: row.scheduled_for,
      started_at: startedAt,
      completed_at: completedAt,
      duration_seconds: startedAt === null ? 0 : workoutElapsedSeconds(
        { startedAt, completedAt, pauses: asJson(row.pauses ?? []) },
        completedAt ?? new Date().toISOString(),
      ),
    });
  }
  return unique;
}

export async function getSession(db: Database, userId: string, sessionId: string): Promise<WorkoutSession> {
  return sessionOwned(db, userId, sessionId);
}

export async function logFood(
  db: Database,
  userId: string,
  entry: {
    loggedOn: string;
    energyKcal: number;
    proteinMg: number;
    carbohydrateMg: number;
    fatMg: number;
    source: FoodEntry['source'];
    mealSlot?: string;
    label?: string;
  },
) {
  const mealSlot = entry.mealSlot === undefined ? null : isMealSlot(entry.mealSlot) ? entry.mealSlot : null;
  if (entry.mealSlot !== undefined && mealSlot === null) {
    throw new ApiError(422, 'UNKNOWN_MEAL_SLOT', 'That meal slot is not in the catalog');
  }
  const label = typeof entry.label === 'string' && entry.label.trim().length > 0 ? entry.label.trim().slice(0, 120) : null;
  await db.query(
    `INSERT INTO food_entries (user_id, logged_on, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, estimate, meal_slot, label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [userId, entry.loggedOn, entry.energyKcal, entry.proteinMg, entry.carbohydrateMg, entry.fatMg, entry.source, entry.source === 'image_estimate', mealSlot, label],
  );
  return diaryFor(db, userId, entry.loggedOn);
}

export async function diaryFor(db: Database, userId: string, day: string) {
  const rows = await db.query<{
    id: string;
    energy_kcal: number;
    protein_mg: number;
    carbohydrate_mg: number;
    fat_mg: number;
    source: FoodEntry['source'];
    label: string | null;
    meal_slot: string | null;
  }>(
    `SELECT id, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, label, meal_slot
     FROM food_entries WHERE user_id = $1 AND logged_on = $2 ORDER BY created_at, id`,
    [userId, day],
  );
  const entries = rows.rows.map((row) => ({
    id: row.id,
    energyKcal: Number(row.energy_kcal),
    proteinMg: Number(row.protein_mg),
    carbohydrateMg: Number(row.carbohydrate_mg),
    fatMg: Number(row.fat_mg),
    source: row.source,
    label: row.label,
    mealSlot: row.meal_slot,
  }));
  return { persisted: true, target: null, referenceDatabase: false, entries, summary: summarizeDiary(null, entries) };
}

export async function diaryRangeFor(db: Database, userId: string, from: string, to: string) {
  const rows = await db.query<{
    logged_on: string;
    energy_kcal: number;
    protein_mg: number;
    carbohydrate_mg: number;
    fat_mg: number;
    entry_count: number;
  }>(
    `SELECT logged_on::text AS logged_on,
            SUM(energy_kcal)::int AS energy_kcal,
            SUM(protein_mg)::bigint AS protein_mg,
            SUM(carbohydrate_mg)::bigint AS carbohydrate_mg,
            SUM(fat_mg)::bigint AS fat_mg,
            COUNT(*)::int AS entry_count
     FROM food_entries
     WHERE user_id = $1 AND logged_on BETWEEN $2 AND $3
     GROUP BY logged_on
     ORDER BY logged_on`,
    [userId, from, to],
  );
  return {
    days: rows.rows.map((row) => ({
      loggedOn: row.logged_on.slice(0, 10),
      energyKcal: Number(row.energy_kcal),
      proteinMg: Number(row.protein_mg),
      carbohydrateMg: Number(row.carbohydrate_mg),
      fatMg: Number(row.fat_mg),
      entryCount: Number(row.entry_count),
    })),
  };
}

export async function recordWeight(db: Database, userId: string, weightKg: string, recordedOn: string) {
  let grams = 0;
  try {
    grams = parseScaledInteger(weightKg, 1000);
  } catch (error) {
    throw asApi(error);
  }
  if (grams < 30_000 || grams > 300_000) {
    throw new ApiError(422, 'WEIGHT_OUT_OF_RANGE', 'Weight is outside the accepted range');
  }
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO weight_records (user_id, weight_grams, recorded_on, source) VALUES ($1, $2, $3, 'manual') RETURNING id`,
    [userId, grams, recordedOn],
  );
  return { id: String(inserted.rows[0]?.id), weightGrams: grams, recordedOn };
}

export async function logWater(db: Database, userId: string, milliliters: number, loggedOn: string) {
  try {
    assertWaterServing(milliliters);
  } catch (error) {
    throw asApi(error);
  }
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO water_logs (user_id, logged_on, milliliters) VALUES ($1, $2, $3) RETURNING id`,
    [userId, loggedOn, milliliters],
  );
  return waterFor(db, userId, loggedOn, String(inserted.rows[0]?.id));
}

export async function waterFor(db: Database, userId: string, loggedOn: string, lastId?: string) {
  const rows = await db.query<{ id: string; milliliters: number; created_at: string }>(
    `SELECT id, milliliters, created_at FROM water_logs WHERE user_id = $1 AND logged_on = $2 ORDER BY created_at`,
    [userId, loggedOn],
  );
  const entries = rows.rows.map((row) => ({
    id: String(row.id),
    milliliters: Number(row.milliliters),
    createdAt: row.created_at,
  }));
  return { loggedOn, milliliters: waterMillilitersTotal(entries), entries, lastId: lastId ?? null };
}

async function seedMemberSupplements(db: Database, userId: string): Promise<void> {
  const existing = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM member_supplements WHERE user_id = $1`,
    [userId],
  );
  if (Number(existing.rows[0]?.n ?? 0) > 0) return;
  const profile = await db.query<{ supplements: string[] | null }>(
    `SELECT supplements FROM user_profiles WHERE user_id = $1`,
    [userId],
  );
  const names = profile.rows[0]?.supplements ?? [];
  for (const raw of names) {
    let name: string;
    try {
      name = assertSupplementName(String(raw));
    } catch {
      continue;
    }
    await db.query(
      `INSERT INTO member_supplements (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, name],
    );
  }
}

export async function listSupplements(db: Database, userId: string, loggedOn: string) {
  await seedMemberSupplements(db, userId);
  const items = await db.query<{ name: string }>(
    `SELECT name FROM member_supplements WHERE user_id = $1 ORDER BY created_at, name`,
    [userId],
  );
  const taken = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM supplement_logs WHERE user_id = $1 AND logged_on = $2`,
    [userId, loggedOn],
  );
  const takenByName = new Map(taken.rows.map((row) => [row.name, String(row.id)]));
  return {
    loggedOn,
    catalog: false,
    items: items.rows.map((row) => ({
      name: row.name,
      taken: takenByName.has(row.name),
      logId: takenByName.get(row.name) ?? null,
    })),
  };
}

export async function addMemberSupplement(db: Database, userId: string, rawName: string, loggedOn: string) {
  let name: string;
  try {
    name = assertSupplementName(rawName);
  } catch (error) {
    throw asApi(error);
  }
  await db.query(
    `INSERT INTO member_supplements (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, name],
  );
  return listSupplements(db, userId, loggedOn);
}

export async function logSupplement(db: Database, userId: string, rawName: string, loggedOn: string) {
  let name: string;
  try {
    name = assertSupplementName(rawName);
  } catch (error) {
    throw asApi(error);
  }
  const owned = await db.query(
    `SELECT name FROM member_supplements WHERE user_id = $1 AND name = $2`,
    [userId, name],
  );
  if (owned.rows[0] === undefined) {
    throw new ApiError(404, 'SUPPLEMENT_NOT_FOUND', 'That name is not on the member list');
  }
  await db.query(
    `INSERT INTO supplement_logs (user_id, name, logged_on) VALUES ($1, $2, $3) ON CONFLICT (user_id, name, logged_on) DO NOTHING`,
    [userId, name, loggedOn],
  );
  return listSupplements(db, userId, loggedOn);
}

export async function unlogSupplement(db: Database, userId: string, logId: string, loggedOn: string) {
  const removed = await db.query(
    `DELETE FROM supplement_logs WHERE id = $1 AND user_id = $2 RETURNING id`,
    [logId, userId],
  );
  if (removed.rows[0] === undefined) {
    throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Supplement log was not found');
  }
  return listSupplements(db, userId, loggedOn);
}

export async function logActivity(
  db: Database,
  userId: string,
  input: { kind: string; durationSeconds: number; loggedOn: string },
) {
  if (!isActivityKind(input.kind)) {
    throw new ApiError(422, 'UNKNOWN_ACTIVITY', 'That activity is not in the catalog');
  }
  try {
    assertActivityDuration(input.durationSeconds);
  } catch (error) {
    throw asApi(error);
  }
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO activity_logs (user_id, logged_on, kind, duration_seconds) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, input.loggedOn, input.kind, input.durationSeconds],
  );
  return { id: String(inserted.rows[0]?.id), ...input };
}

export async function activitiesFor(db: Database, userId: string, loggedOn: string) {
  const rows = await db.query<{ id: string; kind: string; duration_seconds: number; created_at: string }>(
    `SELECT id, kind, duration_seconds, created_at FROM activity_logs WHERE user_id = $1 AND logged_on = $2 ORDER BY created_at`,
    [userId, loggedOn],
  );
  return {
    loggedOn,
    activities: rows.rows.map((row) => ({
      id: String(row.id),
      kind: row.kind,
      durationSeconds: Number(row.duration_seconds),
      createdAt: row.created_at,
    })),
  };
}

export async function logBodyMeasurements(
  db: Database,
  userId: string,
  input: {
    recordedOn: string;
    waistMm?: number | null;
    chestMm?: number | null;
    hipMm?: number | null;
    armMm?: number | null;
    thighMm?: number | null;
    neckMm?: number | null;
  },
) {
  const values = {
    waistMm: input.waistMm ?? null,
    chestMm: input.chestMm ?? null,
    hipMm: input.hipMm ?? null,
    armMm: input.armMm ?? null,
    thighMm: input.thighMm ?? null,
    neckMm: input.neckMm ?? null,
  };
  if (Object.values(values).every((value) => value === null)) {
    throw new ApiError(422, 'EMPTY_MEASUREMENT', 'At least one circumference is required');
  }
  try {
    for (const value of Object.values(values)) assertMeasurementMm(value);
  } catch (error) {
    throw asApi(error);
  }
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO body_measurements (user_id, recorded_on, waist_mm, chest_mm, hip_mm, arm_mm, thigh_mm, neck_mm)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [userId, input.recordedOn, values.waistMm, values.chestMm, values.hipMm, values.armMm, values.thighMm, values.neckMm],
  );
  return { id: String(inserted.rows[0]?.id), recordedOn: input.recordedOn, ...values };
}

export async function measurementsFor(db: Database, userId: string) {
  const rows = await db.query<{
    id: string;
    recorded_on: string;
    waist_mm: number | null;
    chest_mm: number | null;
    hip_mm: number | null;
    arm_mm: number | null;
    thigh_mm: number | null;
    neck_mm: number | null;
  }>(
    `SELECT id, recorded_on, waist_mm, chest_mm, hip_mm, arm_mm, thigh_mm, neck_mm
     FROM body_measurements WHERE user_id = $1 ORDER BY recorded_on DESC, created_at DESC LIMIT 60`,
    [userId],
  );
  return {
    measurements: rows.rows.map((row) => ({
      id: String(row.id),
      recordedOn: row.recorded_on,
      waistMm: row.waist_mm,
      chestMm: row.chest_mm,
      hipMm: row.hip_mm,
      armMm: row.arm_mm,
      thighMm: row.thigh_mm,
      neckMm: row.neck_mm,
    })),
  };
}

// Bounds on how much history a single /v1/progress response will ever carry. These exist so a
// multi-year, highly-active account cannot turn this endpoint into an unbounded payload or an
// unbounded sort: every list below is already restricted by a WHERE clause (120-day window, or
// "one row per exercise"), but a hard LIMIT is cheap insurance against a account whose row count
// still exceeds what's reasonable to ship to a phone in one response. Mobile only ever renders
// the most recent slice of each list, so truncating the oldest rows first is safe.
const MAX_WEIGHT_ROWS = 1000;
const MAX_SESSION_DATES = 1000;
const MAX_EXERCISE_SET_ROWS = 3000;

export async function progressFor(db: Database, userId: string): Promise<ProgressSnapshot> {
  // Empty-history behavior: every query below is a plain SELECT with no aggregation that would
  // fail on zero rows, so a brand-new member (no weights logged, no completed workouts) gets
  // back empty arrays and completedWorkouts: 0 rather than an error or a null field — verified
  // by inspection of each query's shape, not by a live run (see the "Tests actually executed"
  // section of the final report for what was run vs. only reasoned about).
  // Capped to the MOST RECENT MAX_WEIGHT_ROWS entries (inner query), but re-sorted back to
  // ascending order for the response: apps/mobile/app/weight.tsx and progress.tsx both read
  // this array positionally (weights[weights.length - 1] as "latest", Sparkline drawn
  // left-to-right in array order) rather than re-sorting it themselves, so the wire order is
  // part of the contract and must stay oldest-to-newest even when the cap trims older rows.
  const weights = await db.query<ProgressWeightRow>(
    `SELECT id, weight_grams, recorded_on, source FROM (
       SELECT id, weight_grams, recorded_on, source, created_at FROM weight_records
       WHERE user_id = $1
       ORDER BY recorded_on DESC, created_at DESC
       LIMIT ${MAX_WEIGHT_ROWS}
     ) recent
     ORDER BY recorded_on, created_at`,
    [userId],
  );
  const records = await db.query<ProgressPersonalRecordRow>(
    `SELECT id, exercise_id, load_grams, reps, achieved_at FROM personal_records WHERE user_id = $1`,
    [userId],
  );
  const completed = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM workout_sessions WHERE user_id = $1 AND status = 'completed'`,
    [userId],
  );
  // Real session dates behind the training-frequency chart. Bucketing into weeks happens
  // client-side (same Riyadh-anchored day math used elsewhere) rather than in SQL, so the
  // chart's week boundaries match what the member actually sees on the training screen.
  // Covered by the workout_sessions_user_completed_idx partial index added in
  // database/migrations/0008_progress_query_indexes.sql.
  // Already bounded to a 120-day window (at most a few hundred rows for even a very active
  // member), so MAX_SESSION_DATES is a defensive ceiling rather than a normal-operation limit.
  // Capped to the most recent rows, then re-sorted ascending to match the order the training
  // screen's week-bucketing already expects.
  const completedDates = await db.query<{ completed_at: string }>(
    `SELECT completed_at FROM (
       SELECT completed_at FROM workout_sessions
       WHERE user_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
         AND completed_at >= now() - interval '120 days'
       ORDER BY completed_at DESC
       LIMIT ${MAX_SESSION_DATES}
     ) recent
     ORDER BY completed_at`,
    [userId],
  );
  // Real per-session top set for every exercise actually logged, behind the exercise-progression
  // chart. personal_records only keeps the single current best per exercise (it is overwritten in
  // place — see mutateSession's 'complete' branch), so this reads workout_sets/workout_sessions
  // directly instead of inventing a progression that isn't stored anywhere. Also bounded to the
  // same 120-day window; MAX_EXERCISE_SET_ROWS is a ceiling for a pathological account, not
  // something normal use is expected to reach. Known limitation: because the cap applies to the
  // combined (exercise_id, date)-ordered result rather than per exercise, a account that somehow
  // did exceed it would lose whole trailing exercises (alphabetically) rather than having each
  // exercise's oldest points trimmed evenly — acceptable for a bound this unlikely to bind, but
  // worth revisiting with a per-exercise window function if real accounts ever approach it.
  const exerciseSets = await db.query<ProgressExerciseSetRow>(
    `SELECT exercise_id, date, load_grams, reps FROM (
       SELECT DISTINCT ON (ws.exercise_id, s.id)
         ws.exercise_id AS exercise_id, s.completed_at AS date, ws.load_grams AS load_grams, ws.reps AS reps
       FROM workout_sets ws
       JOIN workout_sessions s ON s.id = ws.session_id
       WHERE s.user_id = $1 AND s.status = 'completed' AND s.completed_at IS NOT NULL
         AND s.completed_at >= now() - interval '120 days'
       ORDER BY ws.exercise_id, s.id, ws.load_grams DESC, ws.reps DESC
     ) top
     ORDER BY exercise_id, date
     LIMIT ${MAX_EXERCISE_SET_ROWS}`,
    [userId],
  );
  const sessionLoads = await db.query<{ completed_at: string; started_at: string | null; discipline: string; pauses: unknown }>(
    `SELECT completed_at, started_at, discipline, pauses FROM (
       SELECT completed_at, started_at, discipline, pauses FROM workout_sessions
       WHERE user_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
         AND completed_at >= now() - interval '120 days'
       ORDER BY completed_at DESC
       LIMIT ${MAX_SESSION_DATES}
     ) recent
     ORDER BY completed_at`,
    [userId],
  );
  return {
    weights: weights.rows,
    personalRecords: records.rows,
    completedWorkouts: Number(completed.rows[0]?.count ?? 0),
    completedSessionDates: completedDates.rows.map((row) => row.completed_at),
    exerciseSets: exerciseSets.rows,
    sessionLoads: sessionLoads.rows.map((row) => ({
      completed_at: row.completed_at,
      discipline: row.discipline,
      duration_seconds: workoutElapsedSeconds(
        { startedAt: iso(row.started_at), completedAt: row.completed_at, pauses: asJson(row.pauses ?? []) },
        row.completed_at,
      ),
    })),
  };
}

export async function homeFor(db: Database, userId: string, asOf: string, locale: 'ar' | 'en') {
  const profile = await readProfile(db, userId);
  if (profile.profile === null) {
    return { onboarded: false as const, dashboard: null };
  }
  const today = asOf.slice(0, 10);
  const sessions = await db.query<{ id: string; status: string; scheduled_for: string }>(
    `SELECT id, status, scheduled_for FROM workout_sessions WHERE user_id = $1 AND scheduled_for::date = $2::date ORDER BY scheduled_for LIMIT 1`,
    [userId, today],
  );
  const todayRow = sessions.rows[0];
  const todaySession = todayRow === undefined ? null : await sessionOwned(db, userId, String(todayRow.id));
  const counts = await db.query<{ completed: string; planned: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
       COUNT(*)::text AS planned
     FROM workout_sessions
     WHERE user_id = $1 AND scheduled_for >= $2::timestamptz - interval '7 days' AND scheduled_for <= $2::timestamptz`,
    [userId, asOf],
  );
  const completed = Number(counts.rows[0]?.completed ?? 0);
  const planned = Number(counts.rows[0]?.planned ?? 0);
  const diary = await diaryFor(db, userId, today);
  const gym = await db.query<{ display_name: string }>(
    `SELECT gym_organizations.display_name
     FROM gym_attributions
     JOIN gym_organizations ON gym_organizations.id = gym_attributions.organization_id
     WHERE gym_attributions.user_id = $1`,
    [userId],
  );
  const displayName = profile.profile.display_name === null ? null : String(profile.profile.display_name);
  return {
    onboarded: true as const,
    dashboard: assembleHomeDashboard({
      asOf,
      locale,
      displayName,
      goal: profile.goals[0] ?? null,
      phase: null,
      adherence: { completed, planned },
      today: todaySession,
      nutrition: diary.summary.entryCount === 0 && diary.summary.target === null ? diary.summary : diary.summary,
      gymName: gym.rows[0]?.display_name ?? null,
      approvedRuleFlags: null,
    }),
    adherenceRatioBps: adherenceRatioBps(completed, planned),
    authoritativeCalorieTarget: null,
  };
}

const exerciseSelect = `id, name_ar, name_en, primary_muscles, secondary_muscles, movement_pattern,
            equipment, difficulty, instructions_ar, instructions_en,
            disciplines, environments, equipment_brands,
            demo_type, demo_profile, demo_model_uri, demo_license_spdx,
            demo_attribution, demo_review_status`;

function mapExerciseRow<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    demonstrationMedia:
      row.demo_type === 'none'
        ? null
        : {
            type: row.demo_type,
            profile: row.demo_profile,
            modelUri: row.demo_model_uri,
            licenseSpdx: row.demo_license_spdx,
            attribution: row.demo_attribution,
            reviewStatus: row.demo_review_status,
          },
    reviewStatus: row.demo_review_status,
  };
}

export function normalizeScanCode(raw: string): string {
  const trimmed = raw.trim();
  const prefixed = /^traina:exercise:(.+)$/i.exec(trimmed);
  if (prefixed?.[1] !== undefined) return prefixed[1].trim().toLowerCase();
  return trimmed.replace(/\s+/g, '').toUpperCase();
}

export async function listExercises(db: Database, userId: string) {
  const rows = await db.query(
    `SELECT ${exerciseSelect}
     FROM exercises
     WHERE owner_user_id IS NULL OR owner_user_id = $1
     ORDER BY name_en`,
    [userId],
  );
  return rows.rows.map((row) => mapExerciseRow(row));
}

export async function findExerciseByScanCode(db: Database, userId: string, raw: string) {
  const code = normalizeScanCode(raw);
  if (code.length < 4 || code.length > 80) return null;
  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
  const rows = byId
    ? await db.query(
        `SELECT ${exerciseSelect}
         FROM exercises
         WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`,
        [code, userId],
      )
    : await db.query(
        `SELECT exercises.id, exercises.name_ar, exercises.name_en, exercises.primary_muscles, exercises.secondary_muscles,
                exercises.movement_pattern, exercises.equipment, exercises.difficulty, exercises.instructions_ar, exercises.instructions_en,
                exercises.disciplines, exercises.environments, exercises.equipment_brands,
                exercises.demo_type, exercises.demo_profile, exercises.demo_model_uri, exercises.demo_license_spdx,
                exercises.demo_attribution, exercises.demo_review_status
         FROM exercise_scan_codes AS codes
         JOIN exercises ON exercises.id = codes.exercise_id
         WHERE codes.code = $1 AND (exercises.owner_user_id IS NULL OR exercises.owner_user_id = $2)`,
        [code, userId],
      );
  const row = rows.rows[0];
  return row === undefined ? null : mapExerciseRow(row);
}

export async function listEquipmentManufacturers(db: Database) {
  const rows = await db.query(
    `SELECT id, name, name_ar, categories, catalog_status
     FROM equipment_manufacturers
     ORDER BY name`,
  );
  return rows.rows;
}

export async function readGym(db: Database, actor: Actor, organizationId: string) {
  const decision = authorize(actor, 'gym.read', { kind: 'gym', organizationId });
  if (!decision.allowed) {
    throw new ApiError(403, decision.code ?? 'FORBIDDEN', 'Gym access denied');
  }
  const rows = await db.query(
    `SELECT id, display_name, city, status FROM gym_organizations WHERE id = $1`,
    [organizationId],
  );
  if (rows.rows[0] === undefined) {
    throw new ApiError(404, 'GYM_NOT_FOUND', 'Gym was not found');
  }
  return rows.rows[0];
}

export async function attributeReferral(db: Database, userId: string, codeValue: string, scannedAt: string) {
  const existingRows = await db.query<Record<string, unknown>>(
    `SELECT id, user_id, organization_id, branch_id, contract_id, referral_code, attributed_at
     FROM gym_attributions WHERE user_id = $1`,
    [userId],
  );
  const existingRow = existingRows.rows[0];
  const existing = existingRow === undefined
    ? null
    : {
        id: String(existingRow.id),
        userId: String(existingRow.user_id),
        gymOrganizationId: String(existingRow.organization_id),
        branchId: String(existingRow.branch_id),
        contractId: String(existingRow.contract_id),
        referralCode: String(existingRow.referral_code),
        attributedAt: requireIso(existingRow.attributed_at),
        locked: true as const,
      };
  const codes = await db.query<Record<string, unknown>>(
    `SELECT code, status, organization_id, branch_id, contract_id, expires_at FROM gym_referral_codes WHERE code = $1`,
    [codeValue],
  );
  const code = codes.rows[0];
  if (code === undefined && existing === null) {
    throw new ApiError(404, 'CODE_NOT_FOUND', 'Referral code was not found');
  }
  const contractId = existing?.contractId ?? String(code?.contract_id);
  const contracts = await db.query<Record<string, unknown>>(
    `SELECT id, status, attribution_window_days FROM gym_contracts WHERE id = $1`,
    [contractId],
  );
  const contract = contracts.rows[0];
  if (contract === undefined || code === undefined && existing === null) {
    throw new ApiError(404, 'CONTRACT_NOT_FOUND', 'Contract was not found');
  }
  if (code === undefined) {
    throw new ApiError(404, 'CODE_NOT_FOUND', 'Referral code was not found');
  }
  const resolution = resolveAttribution({
    userId,
    existing,
    code: {
      code: String(code.code),
      status: String(code.status) as 'active' | 'revoked',
      gymOrganizationId: String(code.organization_id),
      branchId: String(code.branch_id),
      contractId: String(code.contract_id),
      expiresAt: iso(code.expires_at),
    },
    contract: {
      id: String(contract.id),
      status: String(contract.status) as 'draft' | 'active' | 'expired' | 'terminated',
      attributionWindowDays: Number(contract.attribution_window_days),
    },
    scannedAt,
    newAttributionId: randomUUID(),
  });
  if (resolution.result === 'rejected') {
    throw new ApiError(422, resolution.reason.toUpperCase(), 'Referral was not accepted');
  }
  if (resolution.result === 'created') {
    const created = resolution.attribution;
    await db.query(
      `INSERT INTO gym_attributions (id, user_id, organization_id, branch_id, contract_id, referral_code, attributed_at, locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [created.id, created.userId, created.gymOrganizationId, created.branchId, created.contractId, created.referralCode, created.attributedAt],
    );
  }
  return resolution;
}

async function coachSnapshot(db: Database, actor: Actor) {
  const profile = await readProfile(db, actor.userId);
  const today = new Date().toISOString().slice(0, 10);
  const sessions = await listSessions(db, actor.userId);
  const first = sessions[0] as { id?: string; status?: string } | undefined;
  const todayWorkout = first?.id !== undefined ? await sessionOwned(db, actor.userId, String(first.id)) : null;
  const diary = await diaryFor(db, actor.userId, today);
  const progress = await progressFor(db, actor.userId);
  const water = await waterFor(db, actor.userId, today);
  const supplements = await listSupplements(db, actor.userId, today);
  const programs = await listMemberPrograms(db, actor.userId);
  const active = programs.active;
  const windowDays = LOGGING_WINDOW_DAYS;
  const from = previousIsoDay(windowDays - 1);
  const diaryRange = await diaryRangeFor(db, actor.userId, from, today);
  const mealDaysLogged = diaryRange.days.filter((day) => day.entryCount > 0).length;
  const waterDays = await db.query<{ n: string }>(
    `SELECT COUNT(DISTINCT logged_on)::text AS n
     FROM water_logs WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [actor.userId, from, today],
  );
  const waterDaysLogged = Number(waterDays.rows[0]?.n ?? 0);
  let discipline = null;
  try {
    discipline = loggingDiscipline({ windowDays, mealDaysLogged, waterDaysLogged });
  } catch {
    discipline = null;
  }
  let memberState: MemberState | null = null;
  try {
    memberState = (await memberStateFor(db, actor, { windowDays, timeZone: 'Asia/Riyadh' })).state;
  } catch {
    memberState = null;
  }
  const humanFeedback = (await listMemberCoachFeedback(db, actor)).feedback.slice(0, 5);
  const recommendationRows = await listMemberRecommendations(db, actor);
  const recommendations = recommendationRows.recommendations.slice(0, 20).map((row) => ({
    id: row.id,
    category: row.category,
    status: row.status,
    summary: row.summary,
    requiresHumanReview: row.requiresHumanReview,
  }));
  const activeVersion = await loadActiveProgramVersion(db, actor.userId);
  let activeProgram: {
    programId: string;
    version: number;
    templateId: string | null;
    adaptationKind: string | null;
    sourceRecommendationId: string | null;
  } | null = null;
  if (activeVersion !== null) {
    try {
      const doc = parseProgramVersionDocument(
        activeVersion.template ?? { templateId: activeVersion.templateId, days: [] },
      );
      activeProgram = {
        programId: activeVersion.programId,
        version: activeVersion.version,
        templateId: activeVersion.templateId,
        adaptationKind: doc.adaptation?.kind ?? null,
        sourceRecommendationId: doc.sourceRecommendationId ?? null,
      };
    } catch {
      activeProgram = {
        programId: activeVersion.programId,
        version: activeVersion.version,
        templateId: activeVersion.templateId,
        adaptationKind: null,
        sourceRecommendationId: null,
      };
    }
  }
  return {
    profile,
    todayWorkout,
    diary,
    water,
    discipline,
    memberState,
    humanFeedback,
    recommendations,
    activeProgram,
    programName: active?.name ?? null,
    context: {
      coachPersona: 'yazan',
      product: 'Traina — AI coach reads daily logs as infrastructure',
      displayName: profile.profile?.display_name ?? null,
      goals: profile.goals,
      todayDiary: diary.summary,
      todayWaterMl: water.milliliters,
      supplementsDue: supplements.items.filter((item) => !item.taken).map((item) => item.name),
      supplementsTaken: supplements.items.filter((item) => item.taken).map((item) => item.name),
      nutritionPhase: active?.nutritionPhase ?? null,
      nutritionPace: active?.nutritionPace ?? null,
      horizonWeeks: active?.horizonWeeks ?? null,
      energyPlan: active?.energy ?? null,
      loggingDiscipline14d: discipline,
      memberState: memberState === null
        ? null
        : {
            confidence: memberState.confidence,
            dataCompletenessBps: memberState.dataCompletenessBps,
            adherence: memberState.adherence,
            weightTrendGramsPerWeek: memberState.weightTrendGramsPerWeek,
            policyNotes: memberState.policyNotes,
            weekly: memberState.weekly,
            pendingRecommendations: memberState.pendingRecommendations,
          },
      humanCoachFeedback: humanFeedback.map((row) => ({
        authorKind: 'human_coach' as const,
        body: row.body,
        createdAt: row.createdAt,
      })),
      recommendations: recommendations.map((row) => ({
        id: row.id,
        category: row.category,
        status: row.status,
        summary: row.summary,
        applied: row.status === 'APPLIED',
        guidanceOnly: row.status !== 'APPLIED',
      })),
      humanVsAi:
        'human_coach feedback is real staff writing. Yazan must not invent coach comments or treat pending recommendations as applied. Nutrition apply remains blocked by ENERGY_POLICY.',
      recentSessions: sessions.slice(0, 5),
      recentWeights: progress.weights.slice(-5),
      personalRecords: progress.personalRecords,
      missingData: 'Absent values are unknown. Do not invent them. No burned-kcal invention.',
      activeProgram,
      programName: active?.name ?? null,
    },
  };
}

async function conversationFor(db: Database, userId: string): Promise<string> {
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM coach_conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const found = existing.rows[0];
  if (found !== undefined) {
    return found.id;
  }
  const id = randomUUID();
  await db.query(`INSERT INTO coach_conversations (id, user_id) VALUES ($1, $2)`, [id, userId]);
  return id;
}

async function assertCoachQuota(db: Database, actor: Actor): Promise<void> {
  const hourly = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ai_usage WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [actor.userId],
  );
  if (Number(hourly.rows[0]?.count ?? 0) >= 20) {
    throw new ApiError(429, 'RATE_LIMITED', 'Coach rate limit reached for this hour');
  }
  const entitlements = await entitlementsFor(db, actor);
  const daily = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ai_usage WHERE user_id = $1 AND created_at > date_trunc('day', now())`,
    [actor.userId],
  );
  if (Number(daily.rows[0]?.count ?? 0) >= entitlements.limits.yazanTurnsPerDay) {
    throw new ApiError(429, 'DAILY_QUOTA', 'Yazan daily turn limit reached for this plan');
  }
}

export async function answerCoach(
  db: Database,
  actor: Actor,
  message: string,
  runtime: CoachRuntime,
  options: { fetchImpl?: typeof fetch; stream?: boolean } = {},
) {
  if (runtime.name === 'unconfigured') {
    throw new ApiError(503, 'MODEL_PROVIDER_NOT_CONFIGURED', 'Set SAHHTI_COACH_PROVIDER, SAHHTI_COACH_API_KEY, SAHHTI_COACH_BASE_URL, and SAHHTI_COACH_MODEL');
  }
  await assertCoachQuota(db, actor);
  const snapshot = await coachSnapshot(db, actor);
  const memberState = snapshot.memberState;
  const localeHint = /[\u0600-\u06FF]/.test(message) ? 'ar' as const : 'en' as const;
  const history = await listCoachMessages(db, actor.userId);
  let text = '';
  let tool: string | null = null;
  let tokens = 0;
  if (runtime.name === 'development_mock') {
    const lower = message.toLowerCase();
    const wantsFeedback =
      lower.includes('human feedback') ||
      lower.includes('coach feedback') ||
      message.includes('ملاحظة المدرب') ||
      message.includes('رد المدرب');
    const wantsRecs =
      lower.includes('recommendation') ||
      lower.includes('approval') ||
      message.includes('توصية') ||
      message.includes('اعتماد');
    const wantsState =
      lower.includes('state') ||
      message.includes('حالتي') ||
      message.includes('وضع');
    tool = wantsFeedback
      ? 'getHumanCoachFeedback'
      : wantsRecs
        ? 'getRecommendationStatus'
        : wantsState
          ? 'getMemberState'
          : lower.includes('food') || message.includes('غداء')
            ? 'getFoodDiary'
            : 'getTodaysWorkout';
    const execution = executeCoachTool({
      actor,
      tool,
      modelArguments: {},
      trusted: {
        userId: actor.userId,
        profile: null,
        goals: snapshot.profile.goals,
        programName: (await listMemberPrograms(db, actor.userId)).active?.name ?? null,
        activeProgram: await (async () => {
          const active = await loadActiveProgramVersion(db, actor.userId);
          if (active === null) return null;
          try {
            const doc = parseProgramVersionDocument(
              active.template ?? { templateId: active.templateId, days: [] },
            );
            return {
              programId: active.programId,
              version: active.version,
              templateId: active.templateId,
              adaptationKind: doc.adaptation?.kind ?? null,
              sourceRecommendationId: doc.sourceRecommendationId ?? null,
            };
          } catch {
            return {
              programId: active.programId,
              version: active.version,
              templateId: active.templateId,
              adaptationKind: null,
              sourceRecommendationId: null,
            };
          }
        })(),
        todayWorkout: snapshot.todayWorkout,
        upcomingWorkoutNames: [],
        recentCompletedSessionIds: [],
        nutrition: snapshot.diary.summary,
        activitySteps: null,
        supplementNames: (await listSupplements(db, actor.userId, new Date().toISOString().slice(0, 10))).items.map((item) => item.name),
        memberState,
        humanFeedback: snapshot.humanFeedback,
        recommendations: snapshot.recommendations,
      },
      quota: { limit: 30, used: 0, windowStartMs: Date.now(), windowMs: 60_000 },
      atMs: Date.now(),
    });
    tool = execution.tool;
    if (tool === 'getHumanCoachFeedback') {
      const rows = snapshot.humanFeedback;
      text =
        rows.length === 0
          ? 'Development mock. No human coach feedback is on file. I will not invent coach comments. This is not a production coach.'
          : `Development mock. Latest human coach feedback (authorKind=human_coach): ${rows[0]?.body ?? ''}. This is not a production coach.`;
    } else if (tool === 'getRecommendationStatus') {
      const pending = snapshot.recommendations.filter((row) => row.status !== 'APPLIED');
      text = `Development mock. ${pending.length} recommendation(s) are guidance-only (not applied). Nutrition remains blocked by ENERGY_POLICY until scientific approval. This is not a production coach.`;
    } else if (tool === 'getMemberState') {
      text = `Development mock. MemberState confidence=${memberState?.confidence ?? 'none'}; meals=${memberState?.adherence.mealDaysLogged ?? 0}/${memberState?.adherence.windowDays ?? 0}. This is not a production coach.`;
    } else if (tool === 'getFoodDiary') {
      text = `Development mock. Consumed ${snapshot.diary.summary.consumed.energyKcal} kcal. This is not a production coach.`;
    } else {
      text = `Development mock. Workout: ${snapshot.todayWorkout?.name ?? 'none scheduled'}. This is not a production coach.`;
    }
    tokens = text.length;
  } else if (options.stream === true) {
    const streamed = await streamModelReply({
      runtime,
      localeHint,
      history: [...history.filter((item) => item.role === 'member' || item.role === 'assistant').map((item) => ({ role: item.role === 'assistant' ? 'assistant' as const : 'member' as const, body: item.body })), { role: 'member' as const, body: message }],
      context: snapshot.context,
      fetchImpl: options.fetchImpl,
    }).catch((error: unknown) => {
      const code = error instanceof Error ? error.message : 'MODEL_REQUEST_FAILED';
      throw new ApiError(502, code === 'MODEL_EMPTY' ? 'MODEL_EMPTY' : 'MODEL_REQUEST_FAILED', 'The model provider did not return a reply');
    });
    text = streamed.text;
    tokens = streamed.promptTokens + streamed.completionTokens;
  } else {
    const trusted = {
      userId: actor.userId,
      profile: null,
      goals: snapshot.profile.goals,
      programName: snapshot.programName,
      activeProgram: snapshot.activeProgram,
      todayWorkout: snapshot.todayWorkout,
      upcomingWorkoutNames: [] as string[],
      recentCompletedSessionIds: [] as string[],
      nutrition: snapshot.diary.summary,
      activitySteps: null as number | null,
      supplementNames: (await listSupplements(db, actor.userId, new Date().toISOString().slice(0, 10))).items.map((item) => item.name),
      memberState: snapshot.memberState,
      humanFeedback: snapshot.humanFeedback.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        authorKind: 'human_coach' as const,
      })),
      recommendations: snapshot.recommendations,
    };
    const completed = await completeModelReply({
      runtime,
      localeHint,
      history: [...history.filter((item) => item.role === 'member' || item.role === 'assistant').map((item) => ({ role: item.role === 'assistant' ? 'assistant' as const : 'member' as const, body: item.body })), { role: 'member' as const, body: message }],
      context: snapshot.context,
      resolveTool: (toolName) => {
        const execution = executeCoachTool({
          actor,
          tool: toolName,
          modelArguments: {},
          trusted,
          quota: { limit: 30, used: 0, windowStartMs: Date.now(), windowMs: 60_000 },
          atMs: Date.now(),
        });
        return execution.body;
      },
      fetchImpl: options.fetchImpl,
    }).catch((error: unknown) => {
      const code = error instanceof Error ? error.message : 'MODEL_REQUEST_FAILED';
      throw new ApiError(502, code === 'MODEL_EMPTY' ? 'MODEL_EMPTY' : 'MODEL_REQUEST_FAILED', 'The model provider did not return a reply');
    });
    text = completed.text;
    tool = completed.tool;
    tokens = completed.promptTokens + completed.completionTokens;
  }
  const conversationId = await conversationFor(db, actor.userId);
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO coach_messages (conversation_id, role, body) VALUES ($1, 'member', $2), ($1, 'assistant', $3)`,
      [conversationId, message, text],
    );
    if (tool !== null) {
      await tx.query(
        `INSERT INTO coach_tool_executions (user_id, conversation_id, tool_name, persisted) VALUES ($1, $2, $3, false)`,
        [actor.userId, conversationId, tool],
      );
    }
    await tx.query(`INSERT INTO ai_usage (user_id, provider, tokens) VALUES ($1, $2, $3)`, [actor.userId, runtime.name, tokens]);
  });
  return {
    provider: runtime.name,
    productionIntelligence: runtime.name === 'openai_compatible',
    persisted: true,
    conversationId,
    text,
    tool,
    toolUserId: actor.userId,
  };
}

export async function listCoachMessages(db: Database, userId: string) {
  const rows = await db.query<{ id: string; role: string; body: string; created_at: string }>(
    `SELECT coach_messages.id, coach_messages.role, coach_messages.body, coach_messages.created_at
     FROM coach_messages
     JOIN coach_conversations ON coach_conversations.id = coach_messages.conversation_id
     WHERE coach_conversations.user_id = $1
     ORDER BY coach_messages.created_at, coach_messages.id
     LIMIT 50`,
    [userId],
  );
  return rows.rows.map((row) => ({
    id: String(row.id),
    role: row.role,
    body: row.body,
    createdAt: row.created_at,
    authorKind: row.role === 'human_coach' ? ('human_coach' as const) : row.role === 'assistant' ? ('yazan_ai' as const) : ('member' as const),
  }));
}

/**
 * Proactive daily message from Yazan based on today's logs.
 * Idempotent per calendar day — logging remains input; this is the coach speaking first.
 */
export async function ensureDailyYazanCheckin(
  db: Database,
  actor: Actor,
  options: { locale?: 'ar' | 'en'; waterGoalMl?: number } = {},
) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.query<{ id: string; body: string; focus: string }>(
    `SELECT id, body, focus FROM coach_daily_checkins WHERE user_id = $1 AND logged_on = $2`,
    [actor.userId, today],
  );
  if (existing.rows[0] !== undefined) {
    return {
      loggedOn: today,
      created: false,
      focus: existing.rows[0].focus,
      text: existing.rows[0].body,
      persona: 'yazan' as const,
    };
  }

  const snapshot = await coachSnapshot(db, actor);
  const weights = snapshot.context.recentWeights as { weight_grams?: number; weightGrams?: number }[];
  const firstW = weights[0];
  const lastW = weights[weights.length - 1];
  const startG = firstW !== undefined ? Number(firstW.weight_grams ?? firstW.weightGrams ?? NaN) : NaN;
  const endG = lastW !== undefined ? Number(lastW.weight_grams ?? lastW.weightGrams ?? NaN) : NaN;
  const weightTrendGrams =
    Number.isFinite(startG) && Number.isFinite(endG) && weights.length >= 2 ? endG - startG : null;

  const sessions = (snapshot.context.recentSessions as { status?: string }[]) ?? [];
  const sessionsCompleted = sessions.filter((row) => row.status === 'completed').length;
  let brief;
  try {
    brief = buildYazanDailyBrief({
      goals: snapshot.profile.goals,
      waterMl: snapshot.water.milliliters,
      waterGoalMl: options.waterGoalMl ?? 2_500,
      mealCount: snapshot.diary.summary.entryCount,
      energyKcal: snapshot.diary.summary.consumed.energyKcal,
      sessionsCompleted,
      sessionsPlanned: Math.max(sessionsCompleted, sessions.length),
      nutritionPhase: (snapshot.context.nutritionPhase as string | null) ?? null,
      nutritionPace: (snapshot.context.nutritionPace as string | null) ?? null,
      waterDaysLogged14: snapshot.discipline?.waterDaysLogged ?? 0,
      mealDaysLogged14: snapshot.discipline?.mealDaysLogged ?? 0,
      weightTrendGrams,
    });
  } catch (error) {
    throw asApi(error);
  }
  const locale = options.locale ?? 'ar';
  const text = locale === 'en' ? brief.messageEn : brief.messageAr;
  const conversationId = await conversationFor(db, actor.userId);
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO coach_daily_checkins (user_id, logged_on, focus, body) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, logged_on) DO NOTHING`,
      [actor.userId, today, brief.focus, text],
    );
    await tx.query(
      `INSERT INTO coach_messages (conversation_id, role, body) VALUES ($1, 'assistant', $2)`,
      [conversationId, text],
    );
  });
  return {
    loggedOn: today,
    created: true,
    focus: brief.focus,
    priority: brief.priority,
    text,
    persona: 'yazan' as const,
  };
}

export async function submitWeeklyCoachBrief(
  db: Database,
  actor: Actor,
  input: {
    weekOf: string;
    energy: number;
    sleep: number;
    stress: number;
    hunger: number;
    effort?: number;
    recovery?: number;
    satisfaction?: number;
    difficulties?: string;
    questionForCoach?: string;
    notes?: string;
  },
) {
  const profile = await readProfile(db, actor.userId);
  const programs = await listMemberPrograms(db, actor.userId);
  const active = programs.active;
  const weekStart = input.weekOf;
  const weekEndDate = new Date(`${weekStart}T12:00:00.000Z`);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const diary = await diaryRangeFor(db, actor.userId, weekStart, weekEnd);
  const mealDaysLogged = diary.days.filter((day) => day.entryCount > 0).length;
  const energyKcalTotal = diary.days.reduce((sum, day) => sum + day.energyKcal, 0);
  const water = await db.query<{ n: string }>(
    `SELECT COUNT(DISTINCT logged_on)::text AS n
     FROM water_logs WHERE user_id = $1 AND logged_on BETWEEN $2::date AND $3::date`,
    [actor.userId, weekStart, weekEnd],
  );
  const waterDaysLogged = Number(water.rows[0]?.n ?? 0);
  const sessions = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM workout_sessions
     WHERE user_id = $1 AND status = 'completed'
       AND completed_at::date BETWEEN $2::date AND $3::date`,
    [actor.userId, weekStart, weekEnd],
  );
  const weights = await db.query<{ recorded_on: string; weight_grams: number }>(
    `SELECT recorded_on::text AS recorded_on, weight_grams FROM weight_records
     WHERE user_id = $1 AND recorded_on BETWEEN $2::date AND $3::date
     ORDER BY recorded_on`,
    [actor.userId, weekStart, weekEnd],
  );
  const firstWeight = weights.rows[0];
  const lastWeight = weights.rows[weights.rows.length - 1];
  let packet;
  try {
    packet = buildWeeklyHumanCoachPacket({
      weekOf: weekStart,
      goals: profile.goals,
      mealDaysLogged,
      waterDaysLogged,
      sessionsCompleted: Number(sessions.rows[0]?.n ?? 0),
      energyKcalTotal,
      weightStartGrams: firstWeight === undefined ? null : Number(firstWeight.weight_grams),
      weightEndGrams: lastWeight === undefined ? null : Number(lastWeight.weight_grams),
      nutritionPhase: active?.nutritionPhase ?? null,
      nutritionPace: active?.nutritionPace ?? null,
      survey: {
        energy: input.energy,
        sleep: input.sleep,
        stress: input.stress,
        hunger: input.hunger,
        effort: input.effort,
        recovery: input.recovery,
        satisfaction: input.satisfaction,
        difficulties: (input.difficulties ?? '').trim(),
        questionForCoach: (input.questionForCoach ?? '').trim(),
        notes: input.notes ?? '',
      },
    });
  } catch (error) {
    throw asApi(error);
  }
  const prepared = await prepareWeeklyReviewForMember(db, actor, actor.userId, weekStart);
  const escalateToHuman = prepared.queuedForHuman === true;
  const briefStatus = escalateToHuman ? 'queued_for_human' : 'saved_for_yazan';
  // Idempotent per member+week — updates the same brief/review rather than creating duplicates.
  const saved = await db.query<{ id: string }>(
    `INSERT INTO coach_weekly_briefs (user_id, week_of, survey, packet, status)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
     ON CONFLICT (user_id, week_of) DO UPDATE
       SET survey = EXCLUDED.survey, packet = EXCLUDED.packet, status = EXCLUDED.status, created_at = now()
     RETURNING id`,
    [actor.userId, weekStart, JSON.stringify(packet.survey), JSON.stringify(packet), briefStatus],
  );
  const conversationId = await conversationFor(db, actor.userId);
  const notice = escalateToHuman
    ? packet.briefAr.slice(0, 400) + '\n\n— يزن: رفعت ملف الأسبوع لمدرب بشري للمراجعة.'
    : packet.briefAr.slice(0, 400) +
      '\n\n— يزن: حفظت ملخص الأسبوع. المراجعة البشرية تتطلب خطة كوتش أو تعيين مدرب.';
  await db.query(`INSERT INTO coach_messages (conversation_id, role, body) VALUES ($1, 'assistant', $2)`, [
    conversationId,
    notice,
  ]);
  return {
    id: String(saved.rows[0]?.id),
    persisted: true,
    escalateToHuman,
    status: briefStatus,
    packet,
    review: prepared.review,
    entitlementGate: prepared.entitlementGate ?? null,
  };
}

export async function latestWeeklyCoachBrief(db: Database, userId: string) {
  const row = await db.query<{ id: string; week_of: string; packet: unknown; status: string; created_at: string }>(
    `SELECT id, week_of::text AS week_of, packet, status, created_at
     FROM coach_weekly_briefs WHERE user_id = $1 ORDER BY week_of DESC LIMIT 1`,
    [userId],
  );
  const found = row.rows[0];
  if (found === undefined) return { brief: null };
  return {
    brief: {
      id: String(found.id),
      weekOf: found.week_of.slice(0, 10),
      packet: found.packet,
      status: found.status,
      createdAt: found.created_at,
    },
  };
}

async function memberFoodSource(db: Database): Promise<string> {
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM food_sources WHERE name = 'member' AND version = '1'`,
  );
  const row = existing.rows[0];
  if (row !== undefined) {
    return row.id;
  }
  const id = randomUUID();
  await db.query(
    `INSERT INTO food_sources (id, name, provenance, version)
     VALUES ($1, 'member', 'Entered by the member. Sahhti did not measure or verify these values.', '1')`,
    [id],
  );
  return id;
}

export async function searchFoods(db: Database, userId: string, query: string) {
  const term = query.trim();
  if (term.length < 2) {
    return { foods: [], referenceDatabase: false };
  }
  const rows = await db.query(
    `SELECT id, name_ar, name_en, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, per_quantity, owner_user_id
     FROM food_items
     WHERE (owner_user_id IS NULL OR owner_user_id = $1)
       AND (name_ar ILIKE $2 OR name_en ILIKE $2)
     ORDER BY name_en
     LIMIT 20`,
    [userId, `%${term}%`],
  );
  return {
    foods: rows.rows.map((row) => ({
      ...row,
      perQuantity: String(row.per_quantity ?? '100 g'),
      per_quantity: String(row.per_quantity ?? '100 g'),
    })),
    referenceDatabase: false,
  };
}

export async function createCustomFood(
  db: Database,
  userId: string,
  input: { nameAr: string; nameEn: string; energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number },
) {
  const sourceId = await memberFoodSource(db);
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO food_items (
       source_id, owner_user_id, name_ar, name_en, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, per_quantity
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '100 g')
     RETURNING id`,
    [sourceId, userId, input.nameAr, input.nameEn, input.energyKcal, input.proteinMg, input.carbohydrateMg, input.fatMg],
  );
  return { id: String(inserted.rows[0]?.id), perQuantity: '100 g', referenceDatabase: false };
}

type CustomMealIngredientInput = { foodItemId: string; quantityGrams: number };

async function sumIngredientMacros(
  db: Database,
  userId: string,
  ingredients: readonly CustomMealIngredientInput[],
) {
  let energyKcal = 0;
  let proteinMg = 0;
  let carbohydrateMg = 0;
  let fatMg = 0;
  const resolved: { foodItemId: string; quantityGrams: number; nameAr: string; nameEn: string }[] = [];
  for (const ingredient of ingredients) {
    const rows = await db.query<{
      id: string;
      name_ar: string;
      name_en: string;
      energy_kcal: number;
      protein_mg: number;
      carbohydrate_mg: number;
      fat_mg: number;
      per_quantity: string;
    }>(
      `SELECT id, name_ar, name_en, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, per_quantity
       FROM food_items
       WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`,
      [ingredient.foodItemId, userId],
    );
    const food = rows.rows[0];
    if (food === undefined) {
      throw new ApiError(404, 'FOOD_NOT_FOUND', 'An ingredient food was not found');
    }
    if (food.per_quantity !== '100 g') {
      throw new ApiError(422, 'UNSUPPORTED_PORTION', 'Custom meal ingredients must be foods stored per 100 g');
    }
    let scaled;
    try {
      scaled = scalePer100g(
        {
          energyKcal: Number(food.energy_kcal),
          proteinMg: Number(food.protein_mg),
          carbohydrateMg: Number(food.carbohydrate_mg),
          fatMg: Number(food.fat_mg),
        },
        ingredient.quantityGrams,
      );
    } catch (error) {
      throw asApi(error);
    }
    energyKcal += scaled.energyKcal;
    proteinMg += scaled.proteinMg;
    carbohydrateMg += scaled.carbohydrateMg;
    fatMg += scaled.fatMg;
    resolved.push({
      foodItemId: food.id,
      quantityGrams: ingredient.quantityGrams,
      nameAr: food.name_ar,
      nameEn: food.name_en,
    });
  }
  return { energyKcal, proteinMg, carbohydrateMg, fatMg, resolved };
}

function perServingMacros(
  totals: { energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number },
  servings: number,
) {
  return {
    energyKcal: Math.floor(totals.energyKcal / servings),
    proteinMg: Math.floor(totals.proteinMg / servings),
    carbohydrateMg: Math.floor(totals.carbohydrateMg / servings),
    fatMg: Math.floor(totals.fatMg / servings),
  };
}

export async function listCustomMeals(db: Database, userId: string) {
  const meals = await db.query<{
    id: string;
    food_item_id: string;
    name_ar: string;
    name_en: string;
    servings: number;
    energy_kcal: number;
    protein_mg: number;
    carbohydrate_mg: number;
    fat_mg: number;
    updated_at: string;
  }>(
    `SELECT m.id, m.food_item_id, m.name_ar, m.name_en, m.servings,
            f.energy_kcal, f.protein_mg, f.carbohydrate_mg, f.fat_mg, m.updated_at::text
     FROM member_custom_meals m
     JOIN food_items f ON f.id = m.food_item_id
     WHERE m.user_id = $1
     ORDER BY m.updated_at DESC
     LIMIT 50`,
    [userId],
  );
  const result = [];
  for (const meal of meals.rows) {
    const ingredients = await db.query<{
      food_item_id: string;
      quantity_grams: number;
      name_ar: string;
      name_en: string;
      position: number;
    }>(
      `SELECT i.food_item_id, i.quantity_grams, i.position, f.name_ar, f.name_en
       FROM member_custom_meal_ingredients i
       JOIN food_items f ON f.id = i.food_item_id
       WHERE i.meal_id = $1
       ORDER BY i.position`,
      [meal.id],
    );
    result.push({
      id: meal.id,
      foodItemId: meal.food_item_id,
      nameAr: meal.name_ar,
      nameEn: meal.name_en,
      servings: Number(meal.servings),
      energyKcal: Number(meal.energy_kcal),
      proteinMg: Number(meal.protein_mg),
      carbohydrateMg: Number(meal.carbohydrate_mg),
      fatMg: Number(meal.fat_mg),
      perQuantity: '1 serving',
      updatedAt: meal.updated_at,
      ingredients: ingredients.rows.map((row) => ({
        foodItemId: row.food_item_id,
        quantityGrams: Number(row.quantity_grams),
        nameAr: row.name_ar,
        nameEn: row.name_en,
        position: Number(row.position),
      })),
    });
  }
  return { meals: result };
}

export async function createCustomMeal(
  db: Database,
  userId: string,
  input: { nameAr: string; nameEn: string; servings: number; ingredients: CustomMealIngredientInput[] },
) {
  const totals = await sumIngredientMacros(db, userId, input.ingredients);
  const perServing = perServingMacros(totals, input.servings);
  const sourceId = await memberFoodSource(db);
  return db.transaction(async (tx) => {
    const food = await tx.query<{ id: string }>(
      `INSERT INTO food_items (
         source_id, owner_user_id, name_ar, name_en, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, per_quantity
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '1 serving')
       RETURNING id`,
      [sourceId, userId, input.nameAr, input.nameEn, perServing.energyKcal, perServing.proteinMg, perServing.carbohydrateMg, perServing.fatMg],
    );
    const foodItemId = String(food.rows[0]?.id);
    const meal = await tx.query<{ id: string }>(
      `INSERT INTO member_custom_meals (user_id, food_item_id, name_ar, name_en, servings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, foodItemId, input.nameAr, input.nameEn, input.servings],
    );
    const mealId = String(meal.rows[0]?.id);
    for (const [index, ingredient] of totals.resolved.entries()) {
      await tx.query(
        `INSERT INTO member_custom_meal_ingredients (meal_id, position, food_item_id, quantity_grams)
         VALUES ($1, $2, $3, $4)`,
        [mealId, index, ingredient.foodItemId, ingredient.quantityGrams],
      );
    }
    await tx.query(
      `INSERT INTO food_favorites (user_id, food_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, foodItemId],
    );
    return {
      id: mealId,
      foodItemId,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      servings: input.servings,
      energyKcal: perServing.energyKcal,
      proteinMg: perServing.proteinMg,
      carbohydrateMg: perServing.carbohydrateMg,
      fatMg: perServing.fatMg,
      perQuantity: '1 serving',
      ingredients: totals.resolved.map((row, position) => ({ ...row, position })),
    };
  });
}

export async function updateCustomMeal(
  db: Database,
  userId: string,
  mealId: string,
  input: { nameAr: string; nameEn: string; servings: number; ingredients: CustomMealIngredientInput[] },
) {
  const existing = await db.query<{ id: string; food_item_id: string }>(
    `SELECT id, food_item_id FROM member_custom_meals WHERE id = $1 AND user_id = $2`,
    [mealId, userId],
  );
  const row = existing.rows[0];
  if (row === undefined) {
    throw new ApiError(404, 'MEAL_NOT_FOUND', 'Custom meal was not found');
  }
  const totals = await sumIngredientMacros(db, userId, input.ingredients);
  const perServing = perServingMacros(totals, input.servings);
  return db.transaction(async (tx) => {
    await tx.query(
      `UPDATE food_items
       SET name_ar = $1, name_en = $2, energy_kcal = $3, protein_mg = $4, carbohydrate_mg = $5, fat_mg = $6, per_quantity = '1 serving'
       WHERE id = $7 AND owner_user_id = $8`,
      [input.nameAr, input.nameEn, perServing.energyKcal, perServing.proteinMg, perServing.carbohydrateMg, perServing.fatMg, row.food_item_id, userId],
    );
    await tx.query(
      `UPDATE member_custom_meals
       SET name_ar = $1, name_en = $2, servings = $3, updated_at = now()
       WHERE id = $4 AND user_id = $5`,
      [input.nameAr, input.nameEn, input.servings, mealId, userId],
    );
    await tx.query(`DELETE FROM member_custom_meal_ingredients WHERE meal_id = $1`, [mealId]);
    for (const [index, ingredient] of totals.resolved.entries()) {
      await tx.query(
        `INSERT INTO member_custom_meal_ingredients (meal_id, position, food_item_id, quantity_grams)
         VALUES ($1, $2, $3, $4)`,
        [mealId, index, ingredient.foodItemId, ingredient.quantityGrams],
      );
    }
    return {
      id: mealId,
      foodItemId: row.food_item_id,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      servings: input.servings,
      energyKcal: perServing.energyKcal,
      proteinMg: perServing.proteinMg,
      carbohydrateMg: perServing.carbohydrateMg,
      fatMg: perServing.fatMg,
      perQuantity: '1 serving',
      ingredients: totals.resolved.map((ing, position) => ({ ...ing, position })),
    };
  });
}

export async function logFoodPortion(
  db: Database,
  userId: string,
  input: { foodItemId: string; quantityGrams: number; loggedOn: string; mealSlot?: string },
) {
  const rows = await db.query<{
    name_ar: string;
    name_en: string;
    energy_kcal: number;
    protein_mg: number;
    carbohydrate_mg: number;
    fat_mg: number;
    per_quantity: string;
  }>(
    `SELECT name_ar, name_en, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, per_quantity
     FROM food_items
     WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`,
    [input.foodItemId, userId],
  );
  const food = rows.rows[0];
  if (food === undefined) {
    throw new ApiError(404, 'FOOD_NOT_FOUND', 'Food was not found');
  }
  const mealSlot = input.mealSlot === undefined ? null : isMealSlot(input.mealSlot) ? input.mealSlot : null;
  if (input.mealSlot !== undefined && mealSlot === null) {
    throw new ApiError(422, 'UNKNOWN_MEAL_SLOT', 'That meal slot is not in the catalog');
  }
  let scaled;
  let label: string;
  let source: 'manual' | 'recipe' = 'manual';
  try {
    if (food.per_quantity === '100 g') {
      scaled = scalePer100g(
        {
          energyKcal: Number(food.energy_kcal),
          proteinMg: Number(food.protein_mg),
          carbohydrateMg: Number(food.carbohydrate_mg),
          fatMg: Number(food.fat_mg),
        },
        input.quantityGrams,
      );
      label = `${food.name_ar} · ${input.quantityGrams} g`;
    } else if (food.per_quantity === '1 serving') {
      if (!Number.isSafeInteger(input.quantityGrams) || input.quantityGrams < 1 || input.quantityGrams > 20) {
        throw new ApiError(422, 'INVALID_PORTION', 'Servings must be a whole number from 1 to 20');
      }
      scaled = {
        energyKcal: Number(food.energy_kcal) * input.quantityGrams,
        proteinMg: Number(food.protein_mg) * input.quantityGrams,
        carbohydrateMg: Number(food.carbohydrate_mg) * input.quantityGrams,
        fatMg: Number(food.fat_mg) * input.quantityGrams,
      };
      label = `${food.name_ar} · ${input.quantityGrams} serving`;
      source = 'recipe';
    } else {
      throw new ApiError(422, 'UNSUPPORTED_PORTION', 'This food portion unit is not supported');
    }
  } catch (error) {
    throw asApi(error);
  }
  await db.query(
    `INSERT INTO food_entries (
       user_id, food_item_id, logged_on, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, estimate, label, meal_slot
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10)`,
    [
      userId,
      input.foodItemId,
      input.loggedOn,
      scaled.energyKcal,
      scaled.proteinMg,
      scaled.carbohydrateMg,
      scaled.fatMg,
      source,
      label,
      mealSlot,
    ],
  );
  return diaryFor(db, userId, input.loggedOn);
}

export async function copyDiaryDay(db: Database, userId: string, from: string, to: string) {
  try {
    assertDiaryCopy(from, to);
  } catch (error) {
    throw asApi(error);
  }
  const source = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM food_entries WHERE user_id = $1 AND logged_on = $2`,
    [userId, from],
  );
  if (Number(source.rows[0]?.n ?? 0) === 0) {
    throw new ApiError(404, 'NOTHING_TO_COPY', 'There is no food logged on that day');
  }
  const target = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM food_entries WHERE user_id = $1 AND logged_on = $2`,
    [userId, to],
  );
  if (Number(target.rows[0]?.n ?? 0) > 0) {
    throw new ApiError(409, 'DIARY_DAY_NOT_EMPTY', 'That day already has logged food');
  }
  await db.query(
    `INSERT INTO food_entries (
       user_id, food_item_id, logged_on, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, estimate, label, meal_slot
     )
     SELECT user_id, food_item_id, $3::date, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, estimate, label, meal_slot
     FROM food_entries
     WHERE user_id = $1 AND logged_on = $2
     ORDER BY created_at, id`,
    [userId, from, to],
  );
  return diaryFor(db, userId, to);
}

export async function listFavoriteFoods(db: Database, userId: string) {
  const rows = await db.query(
    `SELECT food_items.id, food_items.name_ar, food_items.name_en, food_items.energy_kcal,
            food_items.protein_mg, food_items.carbohydrate_mg, food_items.fat_mg, food_items.per_quantity
     FROM food_favorites
     JOIN food_items ON food_items.id = food_favorites.food_item_id
     WHERE food_favorites.user_id = $1
       AND (food_items.owner_user_id IS NULL OR food_items.owner_user_id = $1)
     ORDER BY food_favorites.created_at DESC, food_items.name_en
     LIMIT 24`,
    [userId],
  );
  return {
    foods: rows.rows.map((row) => ({
      ...row,
      perQuantity: String(row.per_quantity ?? '100 g'),
      per_quantity: String(row.per_quantity ?? '100 g'),
    })),
    referenceDatabase: false,
  };
}

export async function deleteFoodEntry(db: Database, userId: string, entryId: string) {
  const removed = await db.query<{ logged_on: string }>(
    `DELETE FROM food_entries WHERE id = $1 AND user_id = $2 RETURNING logged_on::text`,
    [entryId, userId],
  );
  const day = removed.rows[0]?.logged_on;
  if (day === undefined) {
    throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Food entry was not found');
  }
  return diaryFor(db, userId, day.slice(0, 10));
}

export async function favoriteFood(db: Database, userId: string, foodItemId: string) {
  const owned = await db.query(
    `SELECT id FROM food_items WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`,
    [foodItemId, userId],
  );
  if (owned.rows[0] === undefined) {
    throw new ApiError(404, 'FOOD_NOT_FOUND', 'Food was not found');
  }
  await db.query(
    `INSERT INTO food_favorites (user_id, food_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, foodItemId],
  );
  return { saved: true };
}

export async function createMemberExercise(
  db: Database,
  userId: string,
  input: { nameAr: string; nameEn: string; primaryMuscles: string[]; equipment: string[] },
) {
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO exercises (
       owner_user_id, name_ar, name_en, primary_muscles, secondary_muscles, movement_pattern, equipment, difficulty,
       instructions_ar, instructions_en
     ) VALUES ($1, $2, $3, $4, '{}', 'custom', $5, 'beginner', '{}', '{}')
     RETURNING id`,
    [userId, input.nameAr, input.nameEn, input.primaryMuscles, input.equipment],
  );
  return { id: String(inserted.rows[0]?.id), demonstrationMedia: null, reviewStatus: 'unreviewed' };
}

export async function listCommunityFeed(db: Database, userId: string, before: string | undefined) {
  const rows = await db.query<{
    id: string;
    body: string;
    visibility: string;
    created_at: string;
    author_user_id: string;
    display_name: string | null;
    support_count: string;
    supported: boolean;
  }>(
    `SELECT community_posts.id, community_posts.body, community_posts.visibility, community_posts.created_at,
            community_posts.author_user_id, user_profiles.display_name,
            (SELECT COUNT(*)::text FROM community_reactions WHERE post_id = community_posts.id) AS support_count,
            EXISTS (
              SELECT 1 FROM community_reactions
              WHERE post_id = community_posts.id AND user_id = $1
            ) AS supported
     FROM community_posts
     LEFT JOIN user_profiles ON user_profiles.user_id = community_posts.author_user_id
     WHERE (
       community_posts.author_user_id = $1
       OR (
         community_posts.visibility = 'members'
         AND NOT EXISTS (
           SELECT 1 FROM community_blocks
           WHERE blocker_user_id = $1 AND blocked_user_id = community_posts.author_user_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM community_blocks
           WHERE blocker_user_id = community_posts.author_user_id AND blocked_user_id = $1
         )
       )
     )
       AND ($2::timestamptz IS NULL OR community_posts.created_at < $2::timestamptz)
     ORDER BY community_posts.created_at DESC
     LIMIT 20`,
    [userId, before ?? null],
  );
  return rows.rows.map((row) => ({
    id: String(row.id),
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at,
    authorUserId: String(row.author_user_id),
    authorName: row.display_name,
    supportCount: Number(row.support_count),
    supported: row.supported === true || String(row.supported) === 't' || String(row.supported) === 'true',
  }));
}

async function visiblePost(db: Database, userId: string, postId: string) {
  const rows = await db.query<{ author_user_id: string; visibility: string }>(
    `SELECT author_user_id, visibility FROM community_posts WHERE id = $1`,
    [postId],
  );
  const post = rows.rows[0];
  if (post === undefined) {
    throw new ApiError(404, 'POST_NOT_FOUND', 'Post was not found');
  }
  if (String(post.author_user_id) === userId) {
    return post;
  }
  if (post.visibility !== 'members') {
    throw new ApiError(404, 'POST_NOT_FOUND', 'Post was not found');
  }
  const blocked = await db.query(
    `SELECT 1 FROM community_blocks
     WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
        OR (blocker_user_id = $2 AND blocked_user_id = $1)
     LIMIT 1`,
    [userId, post.author_user_id],
  );
  if (blocked.rows[0] !== undefined) {
    throw new ApiError(404, 'POST_NOT_FOUND', 'Post was not found');
  }
  return post;
}

export async function createCommunityPost(db: Database, userId: string, body: string, visibility: 'private' | 'members') {
  const recent = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM community_posts
     WHERE author_user_id = $1 AND created_at > now() - interval '1 hour'`,
    [userId],
  );
  if (Number(recent.rows[0]?.count ?? 0) >= 8) {
    throw new ApiError(429, 'RATE_LIMITED', 'Post rate limit reached for this hour');
  }
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO community_posts (author_user_id, body, visibility) VALUES ($1, $2, $3) RETURNING id`,
    [userId, body, visibility],
  );
  return { id: String(inserted.rows[0]?.id), media: false };
}

export async function updateOwnCommunityPost(db: Database, userId: string, postId: string, body: string) {
  const updated = await db.query(
    `UPDATE community_posts SET body = $3 WHERE id = $1 AND author_user_id = $2 RETURNING id`,
    [postId, userId, body],
  );
  if (updated.rows[0] === undefined) {
    throw new ApiError(404, 'POST_NOT_FOUND', 'Post was not found');
  }
  return { id: postId };
}

export async function deleteOwnCommunityPost(db: Database, userId: string, postId: string) {
  await db.query(`DELETE FROM community_reactions WHERE post_id = $1 AND EXISTS (SELECT 1 FROM community_posts WHERE id = $1 AND author_user_id = $2)`, [postId, userId]);
  await db.query(`DELETE FROM community_comments WHERE post_id = $1 AND EXISTS (SELECT 1 FROM community_posts WHERE id = $1 AND author_user_id = $2)`, [postId, userId]);
  const removed = await db.query(`DELETE FROM community_posts WHERE id = $1 AND author_user_id = $2 RETURNING id`, [postId, userId]);
  if (removed.rows[0] === undefined) {
    throw new ApiError(404, 'POST_NOT_FOUND', 'Post was not found');
  }
  return { deleted: true };
}

export async function commentOnPost(db: Database, userId: string, postId: string, body: string) {
  await visiblePost(db, userId, postId);
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO community_comments (post_id, author_user_id, body) VALUES ($1, $2, $3) RETURNING id`,
    [postId, userId, body],
  );
  return { id: String(inserted.rows[0]?.id) };
}

export async function listComments(db: Database, userId: string, postId: string) {
  await visiblePost(db, userId, postId);
  const rows = await db.query<{ id: string; body: string; author_user_id: string; display_name: string | null; created_at: string }>(
    `SELECT community_comments.id, community_comments.body, community_comments.author_user_id,
            user_profiles.display_name, community_comments.created_at
     FROM community_comments
     LEFT JOIN user_profiles ON user_profiles.user_id = community_comments.author_user_id
     WHERE community_comments.post_id = $1
     ORDER BY community_comments.created_at, community_comments.id`,
    [postId],
  );
  return rows.rows.map((row) => ({
    id: String(row.id),
    body: row.body,
    authorUserId: String(row.author_user_id),
    authorName: row.display_name,
    createdAt: row.created_at,
  }));
}

export async function toggleSupport(db: Database, userId: string, postId: string) {
  await visiblePost(db, userId, postId);
  const existing = await db.query(
    `SELECT 1 FROM community_reactions WHERE post_id = $1 AND user_id = $2 AND kind = 'support'`,
    [postId, userId],
  );
  if (existing.rows[0] === undefined) {
    await db.query(
      `INSERT INTO community_reactions (post_id, user_id, kind) VALUES ($1, $2, 'support')`,
      [postId, userId],
    );
    return { supported: true };
  }
  await db.query(`DELETE FROM community_reactions WHERE post_id = $1 AND user_id = $2 AND kind = 'support'`, [postId, userId]);
  return { supported: false };
}

export async function followMember(db: Database, userId: string, followedUserId: string) {
  if (followedUserId === userId) {
    throw new ApiError(422, 'INVALID_FOLLOW', 'You cannot follow yourself');
  }
  const found = await db.query(`SELECT id FROM users WHERE id = $1`, [followedUserId]);
  if (found.rows[0] === undefined) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Member was not found');
  }
  await db.query(
    `INSERT INTO community_follows (follower_user_id, followed_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, followedUserId],
  );
  return { following: true };
}

export async function blockMember(db: Database, userId: string, blockedUserId: string) {
  if (blockedUserId === userId) {
    throw new ApiError(422, 'INVALID_BLOCK', 'You cannot block yourself');
  }
  await db.query(
    `INSERT INTO community_blocks (blocker_user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, blockedUserId],
  );
  await db.query(
    `DELETE FROM community_follows
     WHERE (follower_user_id = $1 AND followed_user_id = $2)
        OR (follower_user_id = $2 AND followed_user_id = $1)`,
    [userId, blockedUserId],
  );
  return { blocked: true };
}

async function methodologyId(db: Database): Promise<string> {
  const existing = await db.query<{ id: string }>(`SELECT id FROM coaching_methodologies ORDER BY created_at LIMIT 1`);
  const row = existing.rows[0];
  if (row !== undefined) {
    return row.id;
  }
  const id = randomUUID();
  await db.query(`INSERT INTO coaching_methodologies (id, name, status) VALUES ($1, 'Unreviewed', 'draft')`, [id]);
  return id;
}

export async function createDraftRule(
  db: Database,
  actor: Actor,
  input: {
    ruleKey: string;
    priority: number;
    effectiveFrom: string;
    conditions: CoachingRuleVersion['conditions'];
    actions: CoachingRuleVersion['actions'];
    safetyBlocks: string[];
  },
) {
  const decision = authorize(actor, 'rule.author', { kind: 'coaching_rule' });
  if (!decision.allowed) {
    throw new ApiError(403, decision.code ?? 'FORBIDDEN', 'Rule authoring denied');
  }
  const method = await methodologyId(db);
  const ruleId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO coaching_rules (id, methodology_id, rule_key, author_user_id) VALUES ($1, $2, $3, $4)`,
      [ruleId, method, input.ruleKey, actor.userId],
    );
    await tx.query(
      `INSERT INTO coaching_rule_versions (
         rule_id, version, status, priority, effective_from, conditions, actions, safety_blocks
       ) VALUES ($1, 1, 'draft', $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [ruleId, input.priority, input.effectiveFrom, JSON.stringify(input.conditions), JSON.stringify(input.actions), input.safetyBlocks],
    );
  });
  return { ruleId, version: 1, status: 'draft' as const, published: false };
}

export async function submitRule(db: Database, actor: Actor, ruleId: string) {
  const updated = await db.query(
    `UPDATE coaching_rule_versions
     SET status = 'in_review'
     WHERE rule_id = $1 AND status = 'draft'
       AND rule_id IN (SELECT id FROM coaching_rules WHERE author_user_id = $2)
     RETURNING version`,
    [ruleId, actor.userId],
  );
  if (updated.rows[0] === undefined) {
    throw new ApiError(422, 'INVALID_RULE_STATE', 'Only the author can submit a draft');
  }
  return { ruleId, status: 'in_review' as const };
}

export async function decideRule(db: Database, actor: Actor, ruleId: string, decision: 'approved' | 'rejected', at: string) {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT v.version, v.status, r.author_user_id
     FROM coaching_rule_versions v
     JOIN coaching_rules r ON r.id = v.rule_id
     WHERE v.rule_id = $1
     ORDER BY v.version DESC LIMIT 1`,
    [ruleId],
  );
  const row = rows.rows[0];
  if (row === undefined) {
    throw new ApiError(404, 'RULE_NOT_FOUND', 'Rule was not found');
  }
  try {
    const result = decideRuleApproval({
      rule: {
        ruleId,
        version: Number(row.version),
        status: String(row.status) as CoachingRuleVersion['status'],
        authorUserId: String(row.author_user_id),
      },
      decision,
      reviewerUserId: actor.userId,
      reviewerRoles: actor.roles,
      decidedAt: at,
    });
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE coaching_rule_versions SET status = $3 WHERE rule_id = $1 AND version = $2`, [
        ruleId,
        result.approval.version,
        result.status,
      ]);
      await tx.query(
        `INSERT INTO coaching_rule_approvals (rule_version_id, decision, reviewer_user_id, decided_at)
         SELECT id, $2, $3, $4 FROM coaching_rule_versions WHERE rule_id = $1 AND version = $5`,
        [ruleId, decision, actor.userId, at, result.approval.version],
      );
    });
    return result;
  } catch (error) {
    throw asApi(error);
  }
}

export async function publishRule(db: Database, ruleId: string) {
  const updated = await db.query(
    `UPDATE coaching_rule_versions
     SET published_at = now()
     WHERE rule_id = $1 AND status = 'approved' AND published_at IS NULL
     RETURNING version`,
    [ruleId],
  );
  if (updated.rows[0] === undefined) {
    throw new ApiError(422, 'NOT_PUBLISHABLE', 'Only an approved unpublished rule can be published');
  }
  return { ruleId, published: true };
}

export async function rollbackRule(db: Database, ruleId: string) {
  const rows = await db.query<{ version: number }>(
    `SELECT version FROM coaching_rule_versions WHERE rule_id = $1 AND status = 'approved' ORDER BY version DESC`,
    [ruleId],
  );
  const latest = rows.rows[0];
  const previous = rows.rows[1];
  if (latest === undefined || previous === undefined) {
    throw new ApiError(422, 'ROLLBACK_UNAVAILABLE', 'Rollback needs an older approved version');
  }
  await db.query(
    `UPDATE coaching_rule_versions SET status = 'retired', published_at = NULL WHERE rule_id = $1 AND version = $2`,
    [ruleId, latest.version],
  );
  return { ruleId, activeVersion: previous.version };
}

export async function simulateRules(db: Database, facts: Record<string, string | number | boolean>, asOf: string) {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT r.id AS rule_id, r.author_user_id, v.version, v.status, v.priority, v.effective_from, v.effective_until,
            v.conditions, v.actions, v.safety_blocks
     FROM coaching_rule_versions v
     JOIN coaching_rules r ON r.id = v.rule_id`,
  );
  const rules: CoachingRuleVersion[] = rows.rows.map((row) => ({
    ruleId: String(row.rule_id),
    version: Number(row.version),
    status: String(row.status) as CoachingRuleVersion['status'],
    priority: Number(row.priority),
    authorUserId: String(row.author_user_id),
    effectiveFrom: requireIso(row.effective_from),
    effectiveUntil: iso(row.effective_until),
    conditions: asJson(row.conditions),
    actions: asJson(row.actions),
    safetyBlocks: asJson<string[]>(row.safety_blocks ?? []),
  }));
  const evaluation = evaluateCoachingRules({ rules, facts, asOf, mode: 'simulation' });
  await db.query(
    `INSERT INTO rule_evaluations (user_id, mode, persistable, result) VALUES (NULL, 'simulation', false, $1::jsonb)`,
    [JSON.stringify(evaluation)],
  );
  return evaluation;
}

export async function insertLedgerLines(db: Database, text: string, values: readonly unknown[]): Promise<void> {
  await db.query(text, values);
}

function asApi(error: unknown): Error {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof DomainError) {
    return new ApiError(422, error.code, error.message);
  }
  return error instanceof Error ? error : new Error('UNKNOWN');
}
