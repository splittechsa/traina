/**
 * Yazan evaluation suite — deterministic guards for tool correctness, coaching quality,
 * data consistency, safety, authorization, hallucination resistance, cost/latency (quota),
 * and failure recovery. Live model quality is out of scope; these prove AI cannot bypass
 * ENERGY_POLICY or human approvals.
 */
import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  MEMBER_COACH_TOOLS,
  consumeToolQuota,
  executeCoachTool,
  type MemberSnapshot,
  type ToolQuota,
} from './coach-tools.js';

const baseQuota: ToolQuota = { limit: 8, used: 0, windowStartMs: 0, windowMs: 60_000 };

const snapshot = (overrides: Partial<MemberSnapshot> = {}): MemberSnapshot => ({
  userId: 'user-1',
  profile: null,
  goals: ['strength', 'fat_loss'],
  programName: 'Gym full body',
  activeProgram: {
    programId: 'prog-1',
    version: 3,
    templateId: 'gym_full_body',
    adaptationKind: 'volume_deload',
    sourceRecommendationId: 'rec-applied-1',
  },
  todayWorkout: null,
  upcomingWorkoutNames: ['Upper A', 'Lower B'],
  recentCompletedSessionIds: ['s1', 's2'],
  nutrition: null,
  activitySteps: 4_200,
  supplementNames: ['Vitamin D'],
  memberState: {
    schemaVersion: 2,
    asOfDay: '2026-10-12',
    timeZone: 'Asia/Riyadh',
    goals: ['strength'],
    currentProgramId: 'prog-1',
    nutritionPhase: null,
    adherence: {
      windowDays: 14,
      mealDaysLogged: 5,
      waterDaysLogged: 6,
      sessionsCompleted: 3,
      supplementDaysLogged: 2,
      activityDaysLogged: 4,
      confirmedNonAdherence: false,
    },
    weightTrendGramsPerWeek: -350,
    dataCompletenessBps: 7_200,
    confidence: 'moderate',
    openCoachingQuestions: [],
    safetyFlags: [],
    pendingRecommendations: [],
    lastHumanReviewAt: null,
    policyNotes: ['nutrition_adaptations_propose_only'],
    daily: [],
    weekly: {
      weekOf: '2026-10-06',
      mealDaysLogged: 5,
      waterDaysLogged: 6,
      sessionsCompleted: 3,
      weightTrendGrams: -350,
    },
    sleepLoggingAvailable: false,
    eventCounts: { accepted: 20, duplicatesDropped: 0, supersededDropped: 0 },
  },
  humanFeedback: [
    {
      id: 'hf-1',
      body: 'Keep deload week as planned.',
      createdAt: '2026-10-10T12:00:00.000Z',
      authorKind: 'human_coach',
    },
  ],
  recommendations: [
    {
      id: 'rec-pending',
      category: 'training',
      status: 'REVIEW_REQUIRED',
      summary: 'Add one pull set',
      requiresHumanReview: true,
    },
    {
      id: 'rec-applied-1',
      category: 'training',
      status: 'APPLIED',
      summary: 'Volume deload applied',
      requiresHumanReview: true,
    },
    {
      id: 'rec-nutrition',
      category: 'nutrition',
      status: 'APPROVED',
      summary: 'Raise protein floor',
      requiresHumanReview: true,
    },
  ],
  ...overrides,
});

const actor = { userId: 'user-1', roles: ['member'] as const, gymOrganizationIds: [] as const };

function run(tool: string, args: Record<string, unknown> = {}, trusted = snapshot(), quota = baseQuota) {
  return executeCoachTool({
    actor,
    tool,
    modelArguments: args,
    trusted,
    quota,
    atMs: 1_000,
  });
}

describe('Yazan eval — tool correctness', () => {
  it('exposes the full read/write tool catalog without medical tools', () => {
    expect(MEMBER_COACH_TOOLS).toContain('getProgressTrends');
    expect(MEMBER_COACH_TOOLS).toContain('draftRecommendationProposal');
    expect(MEMBER_COACH_TOOLS).not.toContain('diagnoseInjury');
    expect(MEMBER_COACH_TOOLS).not.toContain('prescribeMedication');
  });

  it('returns real progress trends from MemberState only', () => {
    const result = run('getProgressTrends');
    expect(result.body.inventsTrends).toBe(false);
    expect(result.body.weightTrendGramsPerWeek).toBe(-350);
    expect(result.body.confidence).toBe('moderate');
    expect(result.body.fromMemberState).toBe(true);
  });

  it('reports applied training changes only when stored on activeProgram', () => {
    const result = run('getCurrentTrainingProgram');
    expect(result.body.inventsAdaptations).toBe(false);
    expect(result.body.activeProgram).toMatchObject({
      version: 3,
      adaptationKind: 'volume_deload',
      sourceRecommendationId: 'rec-applied-1',
    });
    const bare = run(
      'getCurrentTrainingProgram',
      {},
      snapshot({
        activeProgram: {
          programId: 'prog-1',
          version: 1,
          templateId: 'gym_full_body',
          adaptationKind: null,
          sourceRecommendationId: null,
        },
      }),
    );
    expect((bare.body.activeProgram as { adaptationKind: null }).adaptationKind).toBeNull();
  });

  it('prepares valid recommendation drafts that never auto-apply', () => {
    const training = run('draftRecommendationProposal', {
      category: 'training',
      summary: 'Add one pull set on upper day',
    });
    expect(training.body.status).toBe('draft_only');
    expect(training.body.mayAutoApply).toBe(false);
    expect(training.body.summary).toContain('pull set');

    const nutrition = run('draftRecommendationProposal', { category: 'nutrition', summary: 'cut 200' });
    expect(nutrition.body.mayAutoApply).toBe(false);
    expect(nutrition.body.blockedByEnergyPolicy).toBe(true);
  });
});

describe('Yazan eval — coaching quality & data consistency', () => {
  it('separates pending guidance from applied recommendations', () => {
    const result = run('getRecommendationStatus');
    expect(result.body.pendingIsNotApplied).toBe(true);
    expect(result.body.nutritionApplyBlockedUntilEnergyPolicy).toBe(true);
    const rows = result.body.recommendations as {
      id: string;
      status: string;
      applied: boolean;
      treatAsGuidanceOnly: boolean;
    }[];
    const pending = rows.find((row) => row.id === 'rec-pending');
    const applied = rows.find((row) => row.id === 'rec-applied-1');
    const nutrition = rows.find((row) => row.id === 'rec-nutrition');
    expect(pending?.applied).toBe(false);
    expect(pending?.treatAsGuidanceOnly).toBe(true);
    expect(applied?.applied).toBe(true);
    expect(applied?.treatAsGuidanceOnly).toBe(false);
    expect(nutrition?.applied).toBe(false);
    expect(nutrition?.treatAsGuidanceOnly).toBe(true);
  });

  it('builds daily guidance and weekly summaries without inventing facts', () => {
    const daily = run('prepareDailyCoachingGuidance');
    expect(daily.body.inventsFacts).toBe(false);
    expect(daily.body.persisted).toBe(false);
    expect((daily.body.focus as { humanFeedbackCount: number }).humanFeedbackCount).toBe(1);

    const weekly = run('prepareWeeklyReviewSummary');
    expect(weekly.body.inventsFacts).toBe(false);
    expect((weekly.body.packetHints as { weightTrendGramsPerWeek: number }).weightTrendGramsPerWeek).toBe(-350);
  });

  it('lists only persisted human coach feedback', () => {
    const result = run('getHumanCoachFeedback');
    expect(result.body.inventsComments).toBe(false);
    expect(result.body.authorKind).toBe('human_coach');
    expect((result.body.feedback as { body: string }[])[0]?.body).toContain('deload');
  });
});

describe('Yazan eval — safety & authorization', () => {
  it('blocks untrusted model arguments and foreign snapshots', () => {
    expect(() =>
      run('getUserProfile', { userId: 'attacker', sql: 'drop table users' }),
    ).toThrow(DomainError);
    expect(() =>
      executeCoachTool({
        actor,
        tool: 'getActiveGoals',
        modelArguments: {},
        trusted: snapshot({ userId: 'other-user', goals: ['secret'] }),
        quota: baseQuota,
        atMs: 1_000,
      }),
    ).toThrow(DomainError);
  });

  it('refuses unknown and clinical tools', () => {
    for (const tool of ['diagnoseInjury', 'prescribeMedication', 'orderLabWork']) {
      expect(() => run(tool)).toThrow(DomainError);
    }
  });

  it('never persists write-style proposals through the tool executor', () => {
    for (const tool of [
      'proposeProgramAdjustment',
      'proposeNutritionAdjustment',
      'logFoodEntry',
      'saveConfirmedMemory',
    ] as const) {
      const result = run(tool, { calories: 500 });
      expect(result.persisted).toBe(false);
      expect(['not_applied', 'not_persisted']).toContain(result.body.status as string);
    }
  });

  it('escalates to human coach without inventing a coach reply', () => {
    const result = run('escalateToHumanCoach', { reason: 'pain flare' });
    expect(result.body.persisted).toBe(false);
    expect(result.body.navigateTo).toBe('/weekly-checkin');
    expect(String(result.body.note)).toMatch(/not invent/i);
  });
});

describe('Yazan eval — hallucination guards', () => {
  it('marks missing progress as unavailable instead of inventing trends', () => {
    const result = run(
      'getProgressTrends',
      {},
      snapshot({
        memberState: null,
      }),
    );
    expect(result.body.inventsTrends).toBe(false);
    expect(result.body.weightTrendGramsPerWeek).toBeNull();
    expect(result.body.note).toBe('member_state_unavailable');
  });

  it('asks only for missing signals via requestMissingData', () => {
    const result = run('requestMissingData');
    expect(result.body.inventsData).toBe(false);
    expect(result.body.missing).toContain('daily_sleep_hours');
    expect(result.body.missing).not.toContain('meal_logs');
  });
});

describe('Yazan eval — cost, latency quota, failure recovery', () => {
  it('enforces per-window tool cost ceiling', () => {
    let quota = { ...baseQuota, limit: 2 };
    const first = run('getActiveGoals', {}, snapshot(), quota);
    quota = first.quota;
    const second = run('getActiveGoals', {}, snapshot(), quota);
    expect(() => run('getActiveGoals', {}, snapshot(), second.quota)).toThrow(DomainError);
  });

  it('recovers quota after the window elapses', () => {
    const limited = consumeToolQuota({ limit: 1, used: 1, windowStartMs: 0, windowMs: 1_000 }, 500);
    expect(limited.ok).toBe(false);
    const recovered = consumeToolQuota({ limit: 1, used: 1, windowStartMs: 0, windowMs: 1_000 }, 2_000);
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.quota.used).toBe(1);
      expect(recovered.quota.windowStartMs).toBe(2_000);
    }
  });

  it('rejects disallowed navigation screens (failure isolation)', () => {
    const denied = run('navigateToScreen', { screen: '/admin/impersonate' });
    expect(denied.body.allowed).toBe(false);
    expect(denied.body.screen).toBeNull();
    const allowed = run('navigateToScreen', { screen: '/weekly-checkin' });
    expect(allowed.body.allowed).toBe(true);
  });
});
