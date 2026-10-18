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
  'getHumanCoachFeedback',
  'getRecommendationStatus',
  'requestMissingData',
  'prepareDailyCoachingGuidance',
  'prepareWeeklyReviewSummary',
  'draftRecommendationProposal',
  'escalateToHumanCoach',
  'navigateToScreen',
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
  /** Latest active program version facts — never invent applied adaptations. */
  activeProgram: {
    programId: string;
    version: number;
    templateId: string | null;
    adaptationKind: string | null;
    sourceRecommendationId: string | null;
  } | null;
  todayWorkout: WorkoutSession | null;
  upcomingWorkoutNames: readonly string[];
  recentCompletedSessionIds: readonly string[];
  nutrition: DiarySummary | null;
  activitySteps: number | null;
  supplementNames: readonly string[];
  /** Authorized MemberState projection — never raw DB dumps. */
  memberState: MemberState | null;
  /** Persisted human feedback only — never invented. */
  humanFeedback: readonly {
    id: string;
    body: string;
    createdAt: string;
    authorKind: 'human_coach';
  }[];
  /** Recommendation lifecycle facts — pending ≠ applied. */
  recommendations: readonly {
    id: string;
    category: string;
    status: string;
    summary: string;
    requiresHumanReview: boolean;
  }[];
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
      return {
        programName: trusted.programName,
        activeProgram: trusted.activeProgram,
        inventsAdaptations: false,
        note:
          trusted.activeProgram === null
            ? 'no_active_program'
            : 'Only report adaptationKind when present on the stored program version. Never claim APPLIED without this.',
      };
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
      return {
        fromMemberState: trusted.memberState !== null,
        weightTrendGramsPerWeek: trusted.memberState?.weightTrendGramsPerWeek ?? null,
        confidence: trusted.memberState?.confidence ?? 'insufficient',
        dataCompletenessBps: trusted.memberState?.dataCompletenessBps ?? 0,
        adherence: trusted.memberState?.adherence ?? null,
        inventsTrends: false,
        note:
          trusted.memberState === null
            ? 'member_state_unavailable'
            : 'Trends come only from authorized MemberState — never invent weight or adherence.',
      };
    case 'getHumanCoachFeedback':
      return {
        authorKind: 'human_coach' as const,
        inventsComments: false,
        feedback: trusted.humanFeedback,
        note:
          trusted.humanFeedback.length === 0
            ? 'no_human_feedback_on_file'
            : 'Only persisted human_coach feedback is listed. Do not invent coach comments.',
      };
    case 'getRecommendationStatus':
      return {
        inventsApprovals: false,
        pendingIsNotApplied: true,
        nutritionApplyBlockedUntilEnergyPolicy: true,
        recommendations: trusted.recommendations.map((row) => ({
          ...row,
          applied: row.status === 'APPLIED',
          treatAsGuidanceOnly: row.status !== 'APPLIED',
        })),
        note: 'Never treat REVIEW_REQUIRED, APPROVED, or DRAFT as APPLIED. Nutrition stays propose-only while ENERGY_POLICY is unapproved.',
      };
    case 'requestMissingData': {
      const missing =
        trusted.memberState === null
          ? ['member_state']
          : [
              ...(trusted.memberState.adherence.mealDaysLogged < 3 ? (['meal_logs'] as const) : []),
              ...(trusted.memberState.adherence.waterDaysLogged < 3 ? (['water_logs'] as const) : []),
              ...(trusted.memberState.weightTrendGramsPerWeek === null ? (['weight_trend'] as const) : []),
              ...(!trusted.memberState.sleepLoggingAvailable ? (['daily_sleep_hours'] as const) : []),
            ];
      return {
        missing,
        inventsData: false,
        promptHint: 'Ask the member only for these missing signals. Do not invent values.',
      };
    }
    case 'prepareDailyCoachingGuidance':
      return {
        persisted: false,
        inventsFacts: false,
        focus: {
          programName: trusted.programName,
          todayWorkout: trusted.todayWorkout !== null,
          mealsLoggedToday: trusted.nutrition !== null,
          openRecommendations: trusted.recommendations.filter((row) => row.status !== 'APPLIED' && row.status !== 'REJECTED')
            .length,
          humanFeedbackCount: trusted.humanFeedback.length,
          confidence: trusted.memberState?.confidence ?? 'insufficient',
        },
        note: 'Compose guidance from these facts only. Separate AI voice from human_coach feedback.',
      };
    case 'prepareWeeklyReviewSummary':
      return {
        persisted: false,
        inventsFacts: false,
        packetHints: {
          adherence: trusted.memberState?.adherence ?? null,
          weightTrendGramsPerWeek: trusted.memberState?.weightTrendGramsPerWeek ?? null,
          humanFeedback: trusted.humanFeedback,
          recommendations: trusted.recommendations,
        },
        note: 'Summary is for the member/coach UI — never mark pending recommendations as applied.',
      };
    case 'draftRecommendationProposal': {
      const category = typeof args.category === 'string' ? args.category : 'daily_guidance';
      if (category === 'nutrition') {
        return {
          status: 'draft_only',
          mayAutoApply: false,
          blockedByEnergyPolicy: true,
          note: 'Nutrition drafts require human review and ENERGY_POLICY approval before apply.',
        };
      }
      return {
        status: 'draft_only',
        mayAutoApply: false,
        category,
        summary: typeof args.summary === 'string' ? args.summary.slice(0, 500) : null,
        note: 'Tool drafts only. Persist via recommendation engine generate/advance — AI cannot apply.',
      };
    }
    case 'escalateToHumanCoach':
      return {
        status: 'escalation_hint',
        persisted: false,
        reason: typeof args.reason === 'string' ? args.reason.slice(0, 500) : 'member_requested',
        navigateTo: '/weekly-checkin',
        note: 'Does not invent a coach reply. Member should use weekly check-in / assigned human coach.',
      };
    case 'navigateToScreen': {
      const allowed = new Set([
        '/(tabs)/home',
        '/(tabs)/training',
        '/(tabs)/nutrition',
        '/weekly-checkin',
        '/yazan',
        '/progress',
      ]);
      const screen = typeof args.screen === 'string' ? args.screen : '';
      return {
        allowed: allowed.has(screen),
        screen: allowed.has(screen) ? screen : null,
        note: allowed.has(screen) ? 'UI may navigate' : 'Unknown or disallowed screen',
      };
    }
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
