import { DomainError } from './errors.js';
import type { Actor } from './access.js';
import { authorize } from './access.js';
import { logSet, type WorkoutSession, type WorkoutSet } from './training.js';
import type { DiarySummary } from './nutrition.js';
import type { NormalizedOnboarding } from './onboarding.js';
import type { MemberState } from './member-state.js';

export const MEMBER_COACH_TOOLS = [
  'getUserProfile',
  'getActiveGoals',
  'getMemberState',
  'getCurrentTrainingProgram',
  'getTodaysWorkout',
  'getUpcomingWorkouts',
  'getWorkoutHistory',
  'getExercisePerformance',
  'getNutritionTargets',
  'getFoodDiary',
  'getActivitySummary',
  'getSupplementProfile',
  'getProgressTrends',
  'proposeProgramAdjustment',
  'proposeNutritionAdjustment',
  'logWorkoutSet',
  'logFoodEntry',
  'saveConfirmedMemory',
] as const;

export type CoachToolName = (typeof MEMBER_COACH_TOOLS)[number];

const REJECTED_ARGUMENT_KEYS = new Set(['sql', 'query', 'statement', 'userid', 'user_id', 'role', 'roles']);

export type MemberSnapshot = {
  userId: string;
  profile: NormalizedOnboarding | null;
  goals: readonly string[];
  programName: string | null;
  todayWorkout: WorkoutSession | null;
  upcomingWorkoutNames: readonly string[];
  recentCompletedSessionIds: readonly string[];
  nutrition: DiarySummary | null;
  activitySteps: number | null;
  supplementNames: readonly string[];
  /** Authorized MemberState projection — never raw DB dumps. */
  memberState: MemberState | null;
};

export type ToolQuota = {
  limit: number;
  used: number;
  windowStartMs: number;
  windowMs: number;
};

export type ToolExecution = {
  tool: CoachToolName;
  userId: string;
  persisted: false;
  quota: ToolQuota;
  body: Record<string, unknown>;
};

function isToolName(value: string): value is CoachToolName {
  return (MEMBER_COACH_TOOLS as readonly string[]).includes(value);
}

export function consumeToolQuota(quota: ToolQuota, atMs: number): { ok: true; quota: ToolQuota } | { ok: false; code: 'RATE_LIMITED' } {
  const elapsed = atMs - quota.windowStartMs;
  const base: ToolQuota = elapsed >= quota.windowMs ? { ...quota, used: 0, windowStartMs: atMs } : quota;
  if (base.used + 1 > base.limit) {
    return { ok: false, code: 'RATE_LIMITED' };
  }
  return { ok: true, quota: { ...base, used: base.used + 1 } };
}

export function executeCoachTool(input: {
  actor: Actor;
  tool: string;
  modelArguments: Readonly<Record<string, unknown>>;
  trusted: MemberSnapshot;
  quota: ToolQuota;
  atMs: number;
}): ToolExecution {
  const decision = authorize(input.actor, 'profile.read', { kind: 'user', userId: input.trusted.userId });
  if (!decision.allowed || decision.scope !== 'own') {
    throw new DomainError(decision.code ?? 'FORBIDDEN', 'Coach tools are scoped to the signed-in member');
  }
  if (input.actor.userId !== input.trusted.userId) {
    throw new DomainError('FORBIDDEN', 'Trusted snapshot does not belong to the actor');
  }
  for (const key of Object.keys(input.modelArguments)) {
    if (REJECTED_ARGUMENT_KEYS.has(key.toLowerCase())) {
      throw new DomainError('UNTRUSTED_ARGUMENT', 'The model supplied an argument it is not allowed to choose');
    }
  }
  if (!isToolName(input.tool)) {
    throw new DomainError('UNKNOWN_TOOL', 'The requested coach tool does not exist');
  }
  const quota = consumeToolQuota(input.quota, input.atMs);
  if (!quota.ok) {
    throw new DomainError(quota.code, 'Coach tool quota exceeded');
  }

  const body = toolBody(input.tool, input.modelArguments, input.trusted);
  return {
    tool: input.tool,
    userId: input.actor.userId,
    persisted: false,
    quota: quota.quota,
    body,
  };
}

function toolBody(
  tool: CoachToolName,
  args: Readonly<Record<string, unknown>>,
  trusted: MemberSnapshot,
): Record<string, unknown> {
  switch (tool) {
    case 'getUserProfile':
      return { profile: trusted.profile };
    case 'getActiveGoals':
      return { goals: trusted.goals };
    case 'getMemberState':
      return {
        state: trusted.memberState,
        note: trusted.memberState === null ? 'member_state_unavailable' : 'authorized_projection_only',
      };
    case 'getCurrentTrainingProgram':
      return { programName: trusted.programName };
    case 'getTodaysWorkout':
      return { workout: trusted.todayWorkout };
    case 'getUpcomingWorkouts':
      return { workouts: trusted.upcomingWorkoutNames };
    case 'getWorkoutHistory':
      return { sessionIds: trusted.recentCompletedSessionIds };
    case 'getExercisePerformance':
      return { exerciseId: typeof args.exerciseId === 'string' ? args.exerciseId : null, available: false };
    case 'getNutritionTargets':
      return { target: trusted.nutrition?.target ?? null };
    case 'getFoodDiary':
      return { summary: trusted.nutrition };
    case 'getActivitySummary':
      return { steps: trusted.activitySteps };
    case 'getSupplementProfile':
      return { supplements: trusted.supplementNames };
    case 'getProgressTrends':
      return { status: 'unavailable', reason: 'trend_store_not_configured' };
    case 'proposeProgramAdjustment':
    case 'proposeNutritionAdjustment':
      return { status: 'not_applied', reason: 'requires_user_confirmation_and_approved_rule' };
    case 'logFoodEntry':
      return { status: 'not_persisted', reason: 'food_diary_store_not_configured' };
    case 'saveConfirmedMemory':
      return { status: 'not_persisted', reason: 'memory_store_not_configured' };
    case 'logWorkoutSet':
      return proposeSetLog(args, trusted);
    default:
      throw new DomainError('UNKNOWN_TOOL', 'The requested coach tool does not exist');
  }
}

function proposeSetLog(args: Readonly<Record<string, unknown>>, trusted: MemberSnapshot): Record<string, unknown> {
  const session = trusted.todayWorkout;
  if (session === null) {
    return { status: 'not_found' };
  }
  const set = args.set;
  if (!isWorkoutSet(set)) {
    throw new DomainError('INVALID_SET', 'logWorkoutSet requires a set object');
  }
  if (session.userId !== trusted.userId) {
    throw new DomainError('FORBIDDEN', 'Session does not belong to the member');
  }
  const updated = logSet(session, set);
  return { status: 'accepted_for_domain_reducer', persisted: false, session: updated };
}

function isWorkoutSet(value: unknown): value is WorkoutSet {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const set = value as Partial<WorkoutSet>;
  return (
    typeof set.id === 'string' &&
    typeof set.exerciseId === 'string' &&
    typeof set.setIndex === 'number' &&
    typeof set.reps === 'number' &&
    typeof set.loadGrams === 'number' &&
    (set.rpeTenths === null || typeof set.rpeTenths === 'number') &&
    typeof set.completedAt === 'string'
  );
}
