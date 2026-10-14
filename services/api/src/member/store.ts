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
  parseScaledInteger,
  pauseWorkout,
  personalRecordsFromSessions,
  resolveAttribution,
  resumeWorkout,
  scalePer100g,
  scheduleWorkout,
  startWorkout,
  summarizeDiary,
  validateOnboarding,
  type Actor,
  type CoachingRuleVersion,
  type FoodEntry,
  type NormalizedOnboarding,
  type OnboardingInput,
  type ProgressExerciseSetRow,
  type ProgressPersonalRecordRow,
  type ProgressSnapshot,
  type ProgressWeightRow,
  type WorkoutSession,
  type WorkoutSet,
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
         user_id, age_years_reported, age_reported_on, height_mm, weight_grams, training_experience,
         discipline, sessions_per_week, environment, activity_level, dietary_preferences, allergies,
         supplements, injuries, has_gym_membership, locale, measurement_units, version
       ) VALUES (
         $1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1
       )
       ON CONFLICT (user_id) DO UPDATE SET
         age_years_reported = EXCLUDED.age_years_reported,
         age_reported_on = CURRENT_DATE,
         height_mm = EXCLUDED.height_mm,
         weight_grams = EXCLUDED.weight_grams,
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
         version = user_profiles.version + 1,
         updated_at = now()`,
      [
        userId,
        record.ageYears,
        record.heightMm,
        record.weightGrams,
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
    `SELECT display_name, age_years_reported, height_mm, weight_grams, discipline, sports, locale, measurement_units, version
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
  input: { name: string; discipline: string; scheduledFor: string; exercises: WorkoutSession['plannedExercises'] },
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
    `INSERT INTO workout_sessions (id, user_id, name, discipline, status, planned_exercises, scheduled_for, pauses)
     VALUES ($1, $2, $3, $4, 'scheduled', $5::jsonb, $6, '[]'::jsonb)`,
    [session.id, userId, session.name, session.discipline, JSON.stringify(session.plannedExercises), session.scheduledFor],
  );
  return session;
}

export async function mutateSession(
  db: Database,
  userId: string,
  sessionId: string,
  command: { type: 'start' | 'pause' | 'resume' | 'complete'; at: string } | { type: 'log_set'; set: WorkoutSet },
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
  const rows = await db.query(
    `SELECT id, name, discipline, status, scheduled_for, started_at, completed_at
     FROM workout_sessions WHERE user_id = $1 ORDER BY scheduled_for DESC`,
    [userId],
  );
  const seen = new Set<string>();
  const unique = [];
  for (const row of rows.rows) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(row);
  }
  return unique;
}

export async function getSession(db: Database, userId: string, sessionId: string): Promise<WorkoutSession> {
  return sessionOwned(db, userId, sessionId);
}

export async function logFood(
  db: Database,
  userId: string,
  entry: { loggedOn: string; energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number; source: FoodEntry['source'] },
) {
  await db.query(
    `INSERT INTO food_entries (user_id, logged_on, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, estimate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, entry.loggedOn, entry.energyKcal, entry.proteinMg, entry.carbohydrateMg, entry.fatMg, entry.source, entry.source === 'image_estimate'],
  );
  return diaryFor(db, userId, entry.loggedOn);
}

export async function diaryFor(db: Database, userId: string, day: string) {
  const rows = await db.query<{ id: string; energy_kcal: number; protein_mg: number; carbohydrate_mg: number; fat_mg: number; source: FoodEntry['source']; label: string | null }>(
    `SELECT id, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, label
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
  }));
  return { persisted: true, target: null, referenceDatabase: false, entries, summary: summarizeDiary(null, entries) };
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
  return {
    weights: weights.rows,
    personalRecords: records.rows,
    completedWorkouts: Number(completed.rows[0]?.count ?? 0),
    completedSessionDates: completedDates.rows.map((row) => row.completed_at),
    exerciseSets: exerciseSets.rows,
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

export async function listExercises(db: Database, userId: string) {
  const rows = await db.query(
    `SELECT id, name_ar, name_en, primary_muscles, secondary_muscles, equipment, difficulty, instructions_ar, instructions_en
     FROM exercises
     WHERE owner_user_id IS NULL OR owner_user_id = $1
     ORDER BY name_en`,
    [userId],
  );
  return rows.rows.map((row) => ({ ...row, demonstrationMedia: null, reviewStatus: 'unreviewed' }));
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
  return {
    profile,
    todayWorkout,
    diary,
    context: {
      displayName: profile.profile?.display_name ?? null,
      goals: profile.goals,
      todayDiary: diary.summary,
      recentSessions: sessions.slice(0, 5),
      recentWeights: progress.weights.slice(-5),
      personalRecords: progress.personalRecords,
      missingData: 'Absent values are unknown. Do not invent them.',
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

async function assertCoachQuota(db: Database, userId: string): Promise<void> {
  const used = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ai_usage WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [userId],
  );
  if (Number(used.rows[0]?.count ?? 0) >= 20) {
    throw new ApiError(429, 'RATE_LIMITED', 'Coach rate limit reached for this hour');
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
  await assertCoachQuota(db, actor.userId);
  const snapshot = await coachSnapshot(db, actor);
  const localeHint = /[\u0600-\u06FF]/.test(message) ? 'ar' as const : 'en' as const;
  const history = await listCoachMessages(db, actor.userId);
  let text = '';
  let tool: string | null = null;
  let tokens = 0;
  if (runtime.name === 'development_mock') {
    tool = message.toLowerCase().includes('food') || message.includes('غداء') ? 'getFoodDiary' : 'getTodaysWorkout';
    const execution = executeCoachTool({
      actor,
      tool,
      modelArguments: {},
      trusted: {
        userId: actor.userId,
        profile: null,
        goals: snapshot.profile.goals,
        programName: null,
        todayWorkout: snapshot.todayWorkout,
        upcomingWorkoutNames: [],
        recentCompletedSessionIds: [],
        nutrition: snapshot.diary.summary,
        activitySteps: null,
        supplementNames: [],
      },
      quota: { limit: 30, used: 0, windowStartMs: Date.now(), windowMs: 60_000 },
      atMs: Date.now(),
    });
    tool = execution.tool;
    text = tool === 'getFoodDiary'
      ? `Development mock. Consumed ${snapshot.diary.summary.consumed.energyKcal} kcal. This is not a production coach.`
      : `Development mock. Workout: ${snapshot.todayWorkout?.name ?? 'none scheduled'}. This is not a production coach.`;
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
    const completed = await completeModelReply({
      runtime,
      localeHint,
      history: [...history.filter((item) => item.role === 'member' || item.role === 'assistant').map((item) => ({ role: item.role === 'assistant' ? 'assistant' as const : 'member' as const, body: item.body })), { role: 'member' as const, body: message }],
      context: snapshot.context,
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
  }));
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
    foods: rows.rows.map((row) => ({ ...row, perQuantity: '100 g' })),
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

export async function logFoodPortion(
  db: Database,
  userId: string,
  input: { foodItemId: string; quantityGrams: number; loggedOn: string },
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
  if (food.per_quantity !== '100 g') {
    throw new ApiError(422, 'UNSUPPORTED_PORTION', 'This food is not stored per 100 g');
  }
  let scaled;
  try {
    scaled = scalePer100g({
      energyKcal: Number(food.energy_kcal),
      proteinMg: Number(food.protein_mg),
      carbohydrateMg: Number(food.carbohydrate_mg),
      fatMg: Number(food.fat_mg),
    }, input.quantityGrams);
  } catch (error) {
    throw asApi(error);
  }
  await db.query(
    `INSERT INTO food_entries (
       user_id, food_item_id, logged_on, energy_kcal, protein_mg, carbohydrate_mg, fat_mg, source, estimate, label
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', false, $8)`,
    [
      userId,
      input.foodItemId,
      input.loggedOn,
      scaled.energyKcal,
      scaled.proteinMg,
      scaled.carbohydrateMg,
      scaled.fatMg,
      `${food.name_ar} · ${input.quantityGrams} g`,
    ],
  );
  return diaryFor(db, userId, input.loggedOn);
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
